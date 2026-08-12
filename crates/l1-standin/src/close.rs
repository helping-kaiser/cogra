// Epoch close and publication (layer1-interface.md §11.6, §8.3, §11.7).
//
// Selection among valid ordered sequences is host discretion (§11.6): this
// host takes approved acts in approval order, defers any act whose
// declared dependencies or asserted parents are not yet in history, defers
// any act whose author cannot pay θ (W1 — the author stays free to burn
// and land later), and caps the epoch at the act budget. The W2a/W2b
// evaluation points are here so the real substrate's verdicts slot in at
// the swap (stamps ≡ 1 — see the crate header).

use std::collections::{HashMap, HashSet};

use common::l1::census::LegRole;
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::NodeId;
use sqlx::PgConnection;

use crate::seal::{projection_legs, rebuild_body};
use crate::{StandIn, StandInError};

struct Candidate {
    author: String,
    body: common::l1::StructuralBody,
    payload_len: usize,
    payload_witness: Vec<u8>,
    parents_and_deps: Vec<String>,
    act_time: i64,
}

pub(crate) async fn close_epoch(standin: &StandIn) -> Result<Option<EpochPackage>, StandInError> {
    let mut tx = standin.pool().begin().await?;

    // Serialize concurrent closes on the epoch table.
    sqlx::query!("LOCK TABLE l1_epochs IN EXCLUSIVE MODE")
        .execute(&mut *tx)
        .await?;
    let epoch = sqlx::query_scalar!(r#"SELECT COALESCE(MAX(epoch) + 1, 0) AS "e!" FROM l1_epochs"#)
        .fetch_one(&mut *tx)
        .await?;

    // Approved acts in approval order — the host's selection order.
    let rows = sqlx::query!(
        "SELECT act_id, author, seq, family, middle, target, p_d, p_i,
                settlement_ref, license, asserted_parents, deps,
                length(payload) AS payload_len, content_commitment
         FROM l1_acts WHERE status = 'approved'
         ORDER BY approved_at, act_id",
    )
    .fetch_all(&mut *tx)
    .await?;
    if rows.is_empty() {
        tx.rollback().await?;
        return Ok(None);
    }

    // History: acts already accepted, with their times (dependency targets).
    let mut accepted_times: HashMap<String, i64> = sqlx::query!(
        r#"SELECT act_id, act_time AS "act_time!" FROM l1_acts WHERE status = 'accepted'"#
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|r| (r.act_id, r.act_time))
    .collect();

    // Author balances, exclusive while selecting (W1 is debited).
    let authors: HashSet<String> = rows.iter().map(|r| r.author.clone()).collect();
    let author_list: Vec<String> = authors.into_iter().collect();
    let mut balances: HashMap<String, i64> = sqlx::query!(
        "SELECT address, balance_micro FROM l1_accounts
         WHERE address = ANY($1) FOR UPDATE",
        &author_list,
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|r| (r.address, r.balance_micro))
    .collect();

    // Node replay state: Lamport frontiers and projected degrees.
    let mut frontiers: HashMap<String, i64> = HashMap::new();
    let mut degrees: HashMap<String, i64> = HashMap::new();
    for r in sqlx::query!("SELECT node_id, frontier, degree FROM l1_node_state")
        .fetch_all(&mut *tx)
        .await?
    {
        frontiers.insert(r.node_id.clone(), r.frontier);
        degrees.insert(r.node_id, r.degree);
    }

    // Selection + Lamport assignment in selection order. Acts sharing an
    // endpoint or a dependency get strictly increasing times, so the
    // stable sort by time below never reorders a causally related pair —
    // the published order linearizes every declared dependency and
    // asserted parent at a strictly lower key (§8.3).
    // Multi-pass over the approval order until a fixpoint: an act whose
    // same-close dependency was approved after it is picked up on a later
    // pass, so approval order never forces a causally satisfiable act to
    // defer. Deferral remains for dependencies outside the close (unknown
    // acts, insolvent dependency authors).
    let theta = standin.config().theta_micro;
    let target_budget = standin.config().epoch_target_acts;
    let mut selected: Vec<Candidate> = Vec::new();
    let mut selected_ids: HashSet<String> = HashSet::new();
    let mut pending_times: HashMap<String, i64> = HashMap::new();
    let mut remaining = rows;
    loop {
        let mut progressed = false;
        let mut deferred = Vec::with_capacity(remaining.len());
        for row in remaining {
            if (selected.len() as i64) >= target_budget {
                deferred.push(row);
                continue;
            }
            let mut parents_and_deps = row.deps.clone();
            parents_and_deps.extend(row.asserted_parents.iter().cloned());
            // Dependency validity at this position: every named act already
            // in history or earlier in this selection (dependent sets land
            // whole or not at all — a member whose dep was deferred defers
            // with it).
            if !parents_and_deps
                .iter()
                .all(|d| accepted_times.contains_key(d) || selected_ids.contains(d))
            {
                deferred.push(row);
                continue;
            }
            // W1 — solvency, debited: only the actor's own balance pays θ.
            let balance = balances.entry(row.author.clone()).or_insert(0);
            if *balance < theta {
                deferred.push(row);
                continue;
            }
            *balance -= theta;
            let body = rebuild_body(
                &row.author,
                row.seq,
                &row.family,
                row.middle.as_deref(),
                &row.target,
                row.p_d,
                row.p_i,
                row.settlement_ref.as_deref(),
                row.license.as_deref(),
                &row.asserted_parents,
            )?;

            // Lamport time: one more than the maximum over the incident
            // endpoints' frontiers and the predecessors' times.
            let legs = projection_legs(&body);
            let mut max_base: i64 = 0;
            for (_, src, tgt, _, _) in &legs {
                for node in [src, tgt] {
                    max_base = max_base.max(*frontiers.get(&node.to_string()).unwrap_or(&0));
                }
            }
            for d in &parents_and_deps {
                let t = accepted_times
                    .get(d)
                    .or_else(|| pending_times.get(d))
                    .copied()
                    .unwrap_or(0);
                max_base = max_base.max(t);
            }
            let act_time = max_base + 1;
            for (_, src, tgt, _, _) in &legs {
                for node in [src, tgt] {
                    let f = frontiers.entry(node.to_string()).or_insert(0);
                    *f = (*f).max(act_time);
                }
            }
            pending_times.insert(row.act_id.clone(), act_time);
            selected_ids.insert(row.act_id.clone());
            progressed = true;
            selected.push(Candidate {
                author: row.author,
                body,
                payload_len: row.payload_len.unwrap_or(0) as usize,
                payload_witness: row.content_commitment,
                parents_and_deps,
                act_time,
            });
        }
        remaining = deferred;
        if !progressed || remaining.is_empty() || (selected.len() as i64) >= target_budget {
            break;
        }
    }
    if selected.is_empty() {
        tx.rollback().await?;
        return Ok(None);
    }

    // The authoritative order: stable sort by Lamport time (position
    // totalizes equal frontiers — `def:graph:authoritative-act-order`).
    selected.sort_by_key(|c| c.act_time);

    // Authoritative replay in the published order: maturities from the
    // pre-act projected degrees; both legs of a hyper-edge see the same
    // pre-act state and do not mature one another (§8.3).
    let mut records: Vec<PublishedRecord> = Vec::with_capacity(selected.len());
    for (position, cand) in selected.iter().enumerate() {
        let legs = projection_legs(&cand.body);
        let mut published_legs: Vec<PublishedLeg> = Vec::with_capacity(legs.len());
        for (role, src, tgt, p_d, p_i) in &legs {
            let pre = [src, tgt]
                .into_iter()
                .map(|n| *degrees.get(&n.to_string()).unwrap_or(&0))
                .max()
                .unwrap_or(0);
            let tau = 1.0 - 1.0 / (1.0 + pre as f64);
            published_legs.push(PublishedLeg {
                role: *role,
                source: src.clone(),
                target: tgt.clone(),
                p_d: *p_d,
                p_i: *p_i,
                tau,
            });
        }
        for (_, src, tgt, _, _) in &legs {
            for node in [src, tgt] {
                *degrees.entry(node.to_string()).or_insert(0) += 1;
            }
        }
        records.push(PublishedRecord {
            act_id: cand.body.act_id(),
            author: cand.author.clone(),
            family: cand.body.family,
            epoch,
            act_time: cand.act_time,
            position: position as i64,
            payload_marked: cand.payload_len > 0,
            payload_witness: cand.payload_witness.clone(),
            legs: published_legs,
        });
    }

    // Persist: accepted acts with their causal keys, legs, θ-debits and
    // count increments, node state, and the epoch row.
    for record in &records {
        sqlx::query!(
            "UPDATE l1_acts
             SET status = 'accepted', epoch = $2, act_time = $3, position = $4
             WHERE act_id = $1",
            record.act_id.to_string(),
            epoch,
            record.act_time,
            record.position,
        )
        .execute(&mut *tx)
        .await?;
        for leg in &record.legs {
            sqlx::query!(
                "INSERT INTO l1_act_legs (act_id, leg, source, target, p_d, p_i, tau)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
                record.act_id.to_string(),
                leg.role.as_str(),
                leg.source.to_string(),
                leg.target.to_string(),
                leg.p_d,
                leg.p_i,
                leg.tau,
            )
            .execute(&mut *tx)
            .await?;
        }
        // θ-debit + count increment, consummated at the writing epoch's
        // price and never re-calculated (§11.7).
        sqlx::query!(
            "UPDATE l1_accounts
             SET balance_micro = balance_micro - $2, action_count = action_count + 1
             WHERE address = $1",
            record.author,
            theta,
        )
        .execute(&mut *tx)
        .await?;
        accepted_times.insert(record.act_id.to_string(), record.act_time);
    }
    for (node, frontier) in &frontiers {
        let degree = degrees.get(node).copied().unwrap_or(0);
        sqlx::query!(
            "INSERT INTO l1_node_state (node_id, frontier, degree)
             VALUES ($1, $2, $3)
             ON CONFLICT (node_id) DO UPDATE
             SET frontier = EXCLUDED.frontier, degree = EXCLUDED.degree",
            node,
            frontier,
            degree,
        )
        .execute(&mut *tx)
        .await?;
    }
    sqlx::query!(
        "INSERT INTO l1_epochs (epoch, act_count) VALUES ($1, $2)",
        epoch,
        records.len() as i64,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    // Selection consumed candidates in order; a deferred act stays
    // 'approved' for a later close. Sanity: every selected dependency was
    // honored (debug builds only — the selection loop guarantees it).
    debug_assert!(
        records.iter().enumerate().all(|(i, r)| {
            let earlier: HashSet<String> =
                records[..i].iter().map(|p| p.act_id.to_string()).collect();
            selected[i].parents_and_deps.iter().all(|d| {
                earlier.contains(d) || accepted_times.get(d).is_some_and(|t| *t < r.act_time)
            })
        }),
        "published order fails to linearize a declared dependency"
    );

    Ok(Some(EpochPackage { epoch, records }))
}

pub(crate) async fn epochs_since(
    standin: &StandIn,
    after: i64,
) -> Result<Vec<EpochPackage>, StandInError> {
    let mut conn = standin.pool().acquire().await?;
    let epochs = sqlx::query!(
        "SELECT epoch FROM l1_epochs WHERE epoch > $1 ORDER BY epoch",
        after,
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut packages = Vec::with_capacity(epochs.len());
    for e in epochs {
        packages.push(load_epoch(&mut conn, e.epoch).await?);
    }
    Ok(packages)
}

async fn load_epoch(conn: &mut PgConnection, epoch: i64) -> Result<EpochPackage, StandInError> {
    let rows = sqlx::query!(
        r#"SELECT act_id, author, family, act_time AS "act_time!",
                  position AS "position!", length(payload) AS payload_len,
                  content_commitment
           FROM l1_acts WHERE epoch = $1 AND status = 'accepted'
           ORDER BY position"#,
        epoch,
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut records = Vec::with_capacity(rows.len());
    for row in rows {
        let leg_rows = sqlx::query!(
            "SELECT leg, source, target, p_d, p_i, tau FROM l1_act_legs
             WHERE act_id = $1 ORDER BY leg",
            row.act_id,
        )
        .fetch_all(&mut *conn)
        .await?;
        let mut legs = Vec::with_capacity(leg_rows.len());
        for l in leg_rows {
            legs.push(PublishedLeg {
                role: LegRole::parse(&l.leg).ok_or_else(|| {
                    StandInError::Formation(format!("stored leg role {} unknown", l.leg))
                })?,
                source: NodeId::parse(&l.source)
                    .map_err(|e| StandInError::Formation(e.to_string()))?,
                target: NodeId::parse(&l.target)
                    .map_err(|e| StandInError::Formation(e.to_string()))?,
                p_d: l.p_d,
                p_i: l.p_i,
                tau: l.tau,
            });
        }
        // Hyper legs order: A before T ('a' < 't' lexically) — matches the
        // projection order.
        records.push(PublishedRecord {
            act_id: common::l1::ActId::parse(&row.act_id)
                .map_err(|e| StandInError::Formation(e.to_string()))?,
            author: row.author,
            family: common::l1::Family::parse(&row.family).ok_or_else(|| {
                StandInError::Formation(format!("stored family {} unknown", row.family))
            })?,
            epoch,
            act_time: row.act_time,
            position: row.position,
            payload_marked: row.payload_len.unwrap_or(0) > 0,
            payload_witness: row.content_commitment,
            legs,
        });
    }
    Ok(EpochPackage { epoch, records })
}
