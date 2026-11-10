//! ´mod:module:close´
//!
//! Epoch close and publication (layer1-interface.md §11.6, §8.3, §11.7).
//!
//! Selection among valid ordered sequences is host discretion (§11.6):
//! this host takes approved acts in approval order, defers any act whose
//! declared dependencies or asserted parents are not yet in history,
//! defers any act whose author cannot pay θ (W1 — the author stays free
//! to burn and land later), and caps the epoch at the act budget. The
//! W2a/W2b evaluation points are here so the real substrate's verdicts
//! slot in at the swap (stamps ≡ 1 — see the crate root).
//!
//! # The price an epoch charges
//!
//! Close k charges θ^(k), the burn image of the wall in force: the wall
//! close k − 1 delivered, or — when the last closed epoch ran no
//! controller, or there is none — the declared initialization
//! ([`crate::wall`]). The W1 solvency gate and every debit of the epoch read
//! that one value, recorded as the epoch's debit vintage. The close then
//! runs one controller step and publishes its delivered wall, whose burn
//! image θ^(k+1) close k + 1 charges and [`crate::StandIn::current_theta`]
//! reads in between (one-boundary lead, §11.8 X5).
//!
//! # The selection is pure; only the ends touch the database
//!
//! [`select_and_order`] takes the loaded rows and the ledger state and
//! returns the epoch it would publish. `close_epoch` is load → select →
//! persist, so the fixpoint, the Lamport assignment, the θ-solvency
//! deferral and the maturity replay are all testable without a database.
//!
//! # One malformed stored row stops the substrate, deliberately
//!
//! A row whose `family`, `middle`, `target`, `settlement_ref` or
//! `asserted_parents` will not parse fails the whole close, stays
//! `approved`, and is selected again on the next close — and the same
//! value in a published epoch fails all of [`epochs_since`], so mirror
//! ingestion stops there too. There is no quarantine status and no
//! per-act isolation, and that is the ruled behavior rather than an
//! oversight: nothing this crate seals can reach that state (every column
//! is written from a value that already parsed, through a
//! `Display`/`parse` round trip), so a poison row means the database was
//! written around the crate that owns it. On a substrate that is replaced
//! wholesale, wedging loudly is worth more than machinery for skipping
//! rows nobody should be able to write. `a_malformed_stored_act_wedges_the_close`
//! pins it.
//!
//! # The swap constraint on these tables
//!
//! The `l1_*` tables are dropped when the real Layer 1 lands — but not
//! their migrations. `20260820000002_license_float_model.sql` reads
//! `l1_acts` to backfill CoGra display state, and an applied migration is
//! never edited: sqlx records a checksum per migration and a changed file
//! fails every existing database's next run. So `l1_acts` must survive in
//! the migration timeline past the swap — as a table the replay creates
//! and the swap's own migration drops, never as one the swap can delete
//! from history. `no_migration_outside_the_stand_in_reads_its_tables`
//! (tests/table_ownership.rs) holds the line at the one recorded case.
//!
//! # Cost
//!
//! A close loads every accepted act's time and the whole node-state table,
//! and writes back every node it touched. Cost therefore grows with total
//! history, not with epoch size. That is accepted for a substrate that is
//! thrown away, and budgeted rather than hidden.
//!
//! **Budget: an epoch of 40 acts over an empty history closes in ≤ 150 ms**
//! (measured 2026-09-04 on the dev database at 28 ms; the budget carries
//! the headroom a loaded machine needs). The number is small because the
//! writes are batched — one statement per set, not one per record. A close
//! that starts taking seconds means history has grown past what a
//! full-table load can carry, which is a finding, not a cost to absorb.

use std::collections::{BTreeMap, HashMap, HashSet};

use common::l1::census::LegRole;
use common::l1::handshake::{
    ClosureCause, EpochClosure, EpochPackage, FIRST_POSITION, LedgerLine, MarkerPolicy,
    PublishedLeg, PublishedRecord, Ratio, WallStep,
};
use common::l1::identifier::NodeId;
use sqlx::PgConnection;

use crate::seal::{projection_legs, stored_body};
use crate::wall::DECLARATION;
use crate::{StandIn, StandInError};

/// One approved act as the selection sees it: the parsed body plus the
/// three columns publication carries. Where the row came from is the
/// caller's business.
#[derive(Debug, Clone)]
pub(crate) struct Candidate {
    pub act_id: String,
    pub author: String,
    pub body: common::l1::StructuralBody,
    pub payload_len: usize,
    pub payload_witness: Vec<u8>,
    /// Declared dependencies and causal parents together — every act this
    /// one must follow.
    pub prerequisites: Vec<String>,
    /// The causal parents alone, which form the dependent-set partition.
    pub parents: Vec<String>,
}

/// An act's causal parents (`def:graph:act-causal-parents`): its asserted
/// parents and, for the settlement family, the act it settles — the
/// settles-pointer is that family's instance of the field. Declared
/// dependencies constrain placement but are not parents.
pub(crate) fn causal_parents(
    asserted_parents: &[String],
    settlement_ref: Option<&String>,
) -> Vec<String> {
    let mut parents = asserted_parents.to_vec();
    parents.extend(settlement_ref.cloned());
    parents
}

/// The dependent-set partition of one epoch (`def:graph:dependent-act-set`):
/// each act's principal closure is the act with its causal ancestors outside
/// the history finalized before the epoch, and closures that intersect join
/// one block. Two closures intersect exactly when the acts are linked
/// through parents inside the epoch, so the blocks are the connected
/// components of that relation — whatever order the acts are given in.
///
/// Takes each act's position, identifier and causal parents; returns the
/// blocks as ascending positions, ordered by their first position.
pub(crate) fn dependent_sets(acts: &[(i64, String, Vec<String>)]) -> Vec<Vec<i64>> {
    let index: HashMap<&str, usize> = acts
        .iter()
        .enumerate()
        .map(|(i, (_, id, _))| (id.as_str(), i))
        .collect();
    let mut root: Vec<usize> = (0..acts.len()).collect();
    fn find(root: &mut [usize], mut i: usize) -> usize {
        while root[i] != i {
            root[i] = root[root[i]];
            i = root[i];
        }
        i
    }
    for (i, (_, _, parents)) in acts.iter().enumerate() {
        for parent in parents {
            if let Some(&j) = index.get(parent.as_str()) {
                let (a, b) = (find(&mut root, i), find(&mut root, j));
                root[a.max(b)] = a.min(b);
            }
        }
    }
    let mut blocks: BTreeMap<usize, Vec<i64>> = BTreeMap::new();
    for (i, (position, _, _)) in acts.iter().enumerate() {
        let r = find(&mut root, i);
        blocks.entry(r).or_default().push(*position);
    }
    let mut blocks: Vec<Vec<i64>> = blocks
        .into_values()
        .map(|mut block| {
            block.sort_unstable();
            block
        })
        .collect();
    blocks.sort_unstable_by_key(|block| block.first().copied());
    blocks
}

/// The ledger state a close reads and moves: act times already in history,
/// author balances, and per-node frontier and degree.
#[derive(Debug, Default, Clone)]
pub(crate) struct LedgerState {
    pub accepted_times: HashMap<String, i64>,
    pub balances: HashMap<String, i64>,
    pub frontiers: HashMap<String, i64>,
    pub degrees: HashMap<String, i64>,
}

/// What a close would publish, and everything the persist step needs.
#[derive(Debug, Default)]
pub(crate) struct Selection {
    pub records: Vec<PublishedRecord>,
    /// How many acts each author landed, so θ is debited once per author
    /// rather than once per act.
    pub acts_per_author: BTreeMap<String, i64>,
    /// Only the nodes this epoch moved, as (frontier, degree).
    pub touched_nodes: BTreeMap<String, (i64, i64)>,
    pub dependent_sets: Vec<Vec<i64>>,
}

/// The selection, ordering and maturity replay, over loaded state alone.
///
/// A multi-pass fixpoint over the approval order, with author balances
/// debited as it proceeds since W1 solvency is consummated here — only the
/// actor's own balance pays θ. Acts sharing an endpoint or a dependency get
/// strictly increasing Lamport times, so the stable sort by time never
/// reorders a causally related pair, and an act whose same-close dependency
/// was approved after it is picked up on a later pass — approval order
/// never forces a causally satisfiable act to defer. Dependency validity at
/// each position requires every named act already in history or earlier in
/// this selection: dependent sets land whole or not at all, so a member
/// whose dependency was deferred defers with it. Deferral remains only for
/// dependencies outside the close (unknown acts, insolvent dependency
/// authors); a deferred act simply stays 'approved' for a later close. A
/// selected act's Lamport time is one more than the maximum over its
/// incident endpoints' frontiers and its prerequisites' times.
///
/// The published order is the host's choice (layer1-interface.md §8.3,
/// `rem:graph:host-ordering-discretion`): this host takes the stable sort
/// of the selection by those Lamport times, and positions number it from 1
/// to |𝒬_k|. That sequence is the order of record; the act time each record
/// carries is the §8.3 recurrence recomputed along it, which the selection's
/// times already are: everything that raised an act's inputs during the
/// selection — a prerequisite, or an earlier pick sharing an endpoint — has
/// a strictly lower time and so sorts before it, and nothing sorting before
/// it without such a link touches its inputs.
/// `the_published_act_times_are_the_recurrence_along_the_positions` checks
/// that over arbitrary candidate sets. Replay in the published order
/// derives maturities from the pre-act projected degrees; both legs of a
/// hyper-edge see the same pre-act state and do not mature one another.
pub(crate) fn select_and_order(
    candidates: Vec<Candidate>,
    state: &mut LedgerState,
    epoch: i64,
    theta: i64,
    budget: i64,
) -> Result<Selection, StandInError> {
    let mut selected: Vec<Candidate> = Vec::new();
    let mut selected_ids: HashSet<String> = HashSet::new();
    let mut pending_times: HashMap<String, i64> = HashMap::new();
    let mut times: Vec<i64> = Vec::new();
    let mut touched: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    let mut remaining = candidates;
    loop {
        let mut progressed = false;
        let mut deferred = Vec::with_capacity(remaining.len());
        for candidate in remaining {
            if (selected.len() as i64) >= budget {
                deferred.push(candidate);
                continue;
            }
            if !candidate
                .prerequisites
                .iter()
                .all(|d| state.accepted_times.contains_key(d) || selected_ids.contains(d))
            {
                deferred.push(candidate);
                continue;
            }
            let balance = state.balances.entry(candidate.author.clone()).or_insert(0);
            if *balance < theta {
                deferred.push(candidate);
                continue;
            }
            *balance -= theta;

            let legs = projection_legs(&candidate.body)?;
            let mut max_base: i64 = 0;
            for (_, src, tgt, _, _) in &legs {
                for node in [src, tgt] {
                    max_base = max_base.max(*state.frontiers.get(&node.to_string()).unwrap_or(&0));
                }
            }
            for d in &candidate.prerequisites {
                let t = state
                    .accepted_times
                    .get(d)
                    .or_else(|| pending_times.get(d))
                    .copied()
                    .unwrap_or(0);
                max_base = max_base.max(t);
            }
            let act_time = max_base + 1;
            for (_, src, tgt, _, _) in &legs {
                for node in [src, tgt] {
                    let frontier = state.frontiers.entry(node.to_string()).or_insert(0);
                    *frontier = (*frontier).max(act_time);
                }
            }
            pending_times.insert(candidate.act_id.clone(), act_time);
            selected_ids.insert(candidate.act_id.clone());
            progressed = true;
            times.push(act_time);
            selected.push(candidate);
        }
        remaining = deferred;
        if !progressed || remaining.is_empty() || (selected.len() as i64) >= budget {
            break;
        }
    }
    if selected.is_empty() {
        return Ok(Selection::default());
    }

    let mut ordered: Vec<(i64, Candidate)> = times.into_iter().zip(selected).collect();
    ordered.sort_by_key(|(act_time, _)| *act_time);

    let mut records: Vec<PublishedRecord> = Vec::with_capacity(ordered.len());
    let mut acts_per_author: BTreeMap<String, i64> = BTreeMap::new();
    for (position, (act_time, candidate)) in (FIRST_POSITION..).zip(ordered.iter()) {
        let legs = projection_legs(&candidate.body)?;
        let mut published_legs: Vec<PublishedLeg> = Vec::with_capacity(legs.len());
        for (role, src, tgt, p_d, p_i) in &legs {
            let pre = [src, tgt]
                .into_iter()
                .map(|n| state.degrees.get(&n.to_string()).copied().unwrap_or(0))
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
                let key = node.to_string();
                let degree = state.degrees.entry(key.clone()).or_insert(0);
                *degree += 1;
                let frontier = state.frontiers.get(&key).copied().unwrap_or(0);
                touched.insert(key, (frontier, *degree));
            }
        }
        *acts_per_author.entry(candidate.author.clone()).or_insert(0) += 1;
        records.push(PublishedRecord {
            act_id: candidate.body.act_id(),
            author: candidate.author.clone(),
            family: candidate.body.family,
            epoch,
            act_time: *act_time,
            position,
            payload_marked: candidate.payload_len > 0,
            payload_witness: candidate.payload_witness.clone(),
            legs: published_legs,
        });
    }

    let prerequisites: Vec<&[String]> = ordered
        .iter()
        .map(|(_, candidate)| candidate.prerequisites.as_slice())
        .collect();
    linearizes(&records, &prerequisites, &state.accepted_times)?;
    let parents: Vec<(i64, String, Vec<String>)> = records
        .iter()
        .zip(&ordered)
        .map(|(record, (_, candidate))| {
            (
                record.position,
                candidate.act_id.clone(),
                candidate.parents.clone(),
            )
        })
        .collect();

    Ok(Selection {
        dependent_sets: dependent_sets(&parents),
        records,
        acts_per_author,
        touched_nodes: touched,
    })
}

/// Every record's prerequisites lie at a strictly lower key of record:
/// earlier in this epoch, or anywhere in accepted history, every act of
/// which sits in an earlier epoch. Precedence is read off membership and
/// position, never off a time comparison (layer1-interface.md §8.3,
/// `cond:graph:authoritative-order-dependency-placement`).
///
/// The selection loop guarantees it; this is the check that keeps a
/// violation from becoming durable, so it runs before the transaction
/// commits and reports rather than asserts — a `debug_assert` after the
/// commit would panic in debug on an epoch already written and, in release,
/// would not run at all.
fn linearizes(
    records: &[PublishedRecord],
    prerequisites: &[&[String]],
    accepted: &HashMap<String, i64>,
) -> Result<(), StandInError> {
    let mut earlier: HashSet<String> = HashSet::new();
    for (record, needed) in records.iter().zip(prerequisites) {
        for dependency in *needed {
            let honored = earlier.contains(dependency) || accepted.contains_key(dependency);
            if !honored {
                return Err(StandInError::Host(format!(
                    "published order fails to linearize {} before {}",
                    dependency, record.act_id
                )));
            }
        }
        earlier.insert(record.act_id.to_string());
    }
    Ok(())
}

/// Closes the current epoch: loads the approved acts and the ledger state,
/// runs [`select_and_order`], and persists what it returns (§11.6, §8.3,
/// §11.7). The lock taken first serializes concurrent closes on the epoch
/// table.
///
/// Persisted with the accepted acts' causal keys and legs: the θ-debit and
/// count increment, consummated at the writing epoch's price and never
/// re-calculated (§11.7); the node state the epoch moved; and the epoch
/// row with its closure outputs and final ledger. The admission burns due
/// by this epoch settle in the same transaction, after the selection: a
/// burn pinned by epoch k funds acts from epoch k + 1 on, never the epoch
/// it was pinned in.
pub(crate) async fn close_epoch(standin: &StandIn) -> Result<Option<EpochPackage>, StandInError> {
    standin.config().check()?;
    let mut tx = standin.pool().begin().await?;

    sqlx::query!("LOCK TABLE l1_epochs IN EXCLUSIVE MODE")
        .execute(&mut *tx)
        .await?;
    let epoch = crate::last_closed_epoch(&mut tx).await? + 1;
    let wall_in_force = load_wall_in_force(&mut tx).await?;
    let theta = DECLARATION.burn_image(wall_in_force).map_err(wall_fault)?;

    let rows = sqlx::query!(
        "SELECT act_id, author, seq, family, middle, target, p_d, p_i,
                settlement_ref, license, asserted_parents, deps,
                payload_len, content_commitment
         FROM l1_acts WHERE status = 'approved'
         ORDER BY approved_at, act_id",
    )
    .fetch_all(&mut *tx)
    .await?;
    if rows.is_empty() {
        tx.rollback().await?;
        return Ok(None);
    }

    let mut candidates = Vec::with_capacity(rows.len());
    for row in &rows {
        let parents = causal_parents(&row.asserted_parents, row.settlement_ref.as_ref());
        let mut prerequisites = row.deps.clone();
        prerequisites.extend(parents.iter().cloned());
        candidates.push(Candidate {
            act_id: row.act_id.clone(),
            author: row.author.clone(),
            body: stored_body!(row).to_body()?,
            payload_len: usize::try_from(row.payload_len).map_err(|_| {
                StandInError::Formation(format!("stored act {} has a negative length", row.act_id))
            })?,
            payload_witness: row.content_commitment.clone(),
            prerequisites,
            parents,
        });
    }

    let accepted_times: HashMap<String, i64> = sqlx::query!(
        r#"SELECT act_id, act_time AS "act_time!" FROM l1_acts WHERE status = 'accepted'"#
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|r| (r.act_id, r.act_time))
    .collect();

    let authors: HashSet<&str> = candidates.iter().map(|c| c.author.as_str()).collect();
    let author_list: Vec<String> = authors.into_iter().map(str::to_string).collect();
    let accounts = sqlx::query!(
        "SELECT address, balance_micro, action_count FROM l1_accounts
         WHERE address = ANY($1) FOR UPDATE",
        &author_list,
    )
    .fetch_all(&mut *tx)
    .await?;
    let counts: HashMap<String, i64> = accounts
        .iter()
        .map(|r| (r.address.clone(), r.action_count))
        .collect();
    let balances: HashMap<String, i64> = accounts
        .into_iter()
        .map(|r| (r.address, r.balance_micro))
        .collect();

    let mut frontiers: HashMap<String, i64> = HashMap::new();
    let mut degrees: HashMap<String, i64> = HashMap::new();
    for r in sqlx::query!("SELECT node_id, frontier, degree FROM l1_node_state")
        .fetch_all(&mut *tx)
        .await?
    {
        frontiers.insert(r.node_id.clone(), r.frontier);
        degrees.insert(r.node_id, r.degree);
    }
    let mut state = LedgerState {
        accepted_times,
        balances,
        frontiers,
        degrees,
    };

    let budget = standin.config().epoch_target_acts;
    let selection = select_and_order(candidates, &mut state, epoch, theta, budget)?;
    if selection.records.is_empty() {
        tx.rollback().await?;
        return Ok(None);
    }

    let closure = closure_outputs(&selection, &state, &counts, wall_in_force, theta, budget)?;
    let attested_at = persist(&mut tx, epoch, &selection, &closure).await?;
    crate::settle_due(&mut tx, epoch).await?;
    let package = EpochPackage {
        epoch,
        attested_at,
        records: selection.records,
        closure,
    };
    publishable(&package)?;
    tx.commit().await?;

    Ok(Some(package))
}

/// The wall in force at the next close: what the last closed epoch's
/// controller step delivered, or the declared initialization when there is
/// no closed epoch or the last one ran no controller.
async fn load_wall_in_force(conn: &mut PgConnection) -> Result<Ratio, StandInError> {
    let last = sqlx::query!(
        "SELECT delivered_num, delivered_den FROM l1_epochs ORDER BY epoch DESC LIMIT 1"
    )
    .fetch_optional(conn)
    .await?;
    match last.and_then(|row| row.delivered_num.zip(row.delivered_den)) {
        Some((n, d)) => stored_ratio(n, d),
        None => Ok(DECLARATION.initialization),
    }
}

/// θ^(k+1) as the last close published it — the price the next close
/// charges — or the initialization's burn image before any controller step.
pub(crate) async fn current_theta(standin: &StandIn) -> Result<i64, StandInError> {
    let mut conn = standin.pool().acquire().await?;
    let wall = load_wall_in_force(&mut conn).await?;
    DECLARATION.burn_image(wall).map_err(wall_fault)
}

fn wall_fault(e: crate::wall::WallError) -> StandInError {
    StandInError::Host(format!("wall controller: {e}"))
}

fn stored_ratio(numerator: i64, denominator: i64) -> Result<Ratio, StandInError> {
    Ratio::new(numerator, denominator).ok_or_else(|| {
        StandInError::Host(format!(
            "stored ratio {numerator}/{denominator} has no value"
        ))
    })
}

/// The closure outputs of a selected epoch: why it closed, its partition,
/// its final ledger at the debit vintage it was charged, and one controller
/// step from the wall in force under the deployment's declared inputs.
fn closure_outputs(
    selection: &Selection,
    state: &LedgerState,
    counts_before: &HashMap<String, i64>,
    wall_in_force: Ratio,
    theta: i64,
    budget: i64,
) -> Result<EpochClosure, StandInError> {
    let size = i64::try_from(selection.records.len()).unwrap_or(i64::MAX);
    let cause = if size >= budget {
        ClosureCause::TargetFilled
    } else {
        ClosureCause::DurationElapsed
    };
    let mut ledger = Vec::with_capacity(selection.acts_per_author.len());
    for (address, acts) in &selection.acts_per_author {
        let residual = state.balances.get(address).copied().ok_or_else(|| {
            StandInError::Host(format!("author {address} landed acts with no account"))
        })?;
        ledger.push(LedgerLine {
            address: address.clone(),
            accepted_acts: *acts,
            action_count: counts_before.get(address).copied().unwrap_or(0) + acts,
            residual_balance_micro: Some(residual),
        });
    }
    let step = DECLARATION
        .step(wall_in_force, DECLARATION.width, DECLARATION.accepted_rung)
        .map_err(wall_fault)?;
    Ok(EpochClosure {
        cause,
        dependent_sets: selection.dependent_sets.clone(),
        ledger,
        theta_charged_micro: theta,
        wall: Some(WallStep {
            wall_in_force,
            width: DECLARATION.width,
            accepted_rung: DECLARATION.accepted_rung,
            proposal: step.proposal,
            delivered: step.delivered,
            theta_next_micro: DECLARATION.burn_image(step.delivered).map_err(wall_fault)?,
        }),
        marker: DECLARATION.marker(),
    })
}

/// The package has an order of record — epoch and positions numbered from
/// 1, no gap, no repeat (layer1-interface.md §7.2) — checked before the
/// close commits, like [`linearizes`], so a malformed epoch is never
/// written. Dropping the transaction on the error rolls the close back.
fn publishable(package: &EpochPackage) -> Result<(), StandInError> {
    package
        .check_order_of_record()
        .map_err(|malformed| StandInError::Host(format!("refusing to publish: {malformed}")))
}

/// Writes one closed epoch. Every set is written in one statement over
/// unnested arrays rather than one statement per record: the epoch holds an
/// `EXCLUSIVE` lock while it runs, and at the default budget a per-record
/// loop is tens of thousands of round trips inside it. Returns the epoch
/// row's close instant — the boundary timestamp the package attests.
///
/// Acceptance ends the host's handshake custody: the payload, its content
/// salt and the proposal nonce are nulled together in the statement that
/// accepts, and the row keeps its length and both commitments. The nonce
/// goes with them because the public pre-commitment is formed over it and
/// the payload, so a kept nonce would let anyone confirm a guessed
/// payload. The dependency salt stays — the ordering fraud proof opens it
/// (data-model.md "Act payload carriage").
async fn persist(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    epoch: i64,
    selection: &Selection,
    closure: &EpochClosure,
) -> Result<chrono::DateTime<chrono::Utc>, StandInError> {
    let theta = closure.theta_charged_micro;
    let mut act_ids: Vec<String> = Vec::with_capacity(selection.records.len());
    let mut act_times: Vec<i64> = Vec::with_capacity(selection.records.len());
    let mut positions: Vec<i64> = Vec::with_capacity(selection.records.len());
    let mut leg_acts: Vec<String> = Vec::new();
    let mut leg_roles: Vec<String> = Vec::new();
    let mut leg_sources: Vec<String> = Vec::new();
    let mut leg_targets: Vec<String> = Vec::new();
    let mut leg_p_d: Vec<f64> = Vec::new();
    let mut leg_p_i: Vec<f64> = Vec::new();
    let mut leg_tau: Vec<f64> = Vec::new();
    for record in &selection.records {
        let id = record.act_id.to_string();
        act_times.push(record.act_time);
        positions.push(record.position);
        for leg in &record.legs {
            leg_acts.push(id.clone());
            leg_roles.push(leg.role.as_str().to_string());
            leg_sources.push(leg.source.to_string());
            leg_targets.push(leg.target.to_string());
            leg_p_d.push(leg.p_d);
            leg_p_i.push(leg.p_i);
            leg_tau.push(leg.tau);
        }
        act_ids.push(id);
    }

    sqlx::query!(
        "UPDATE l1_acts SET status = 'accepted', epoch = $1,
                act_time = published.act_time, position = published.position,
                payload = NULL, content_salt = NULL, nonce = NULL
           FROM UNNEST($2::TEXT[], $3::BIGINT[], $4::BIGINT[])
                AS published(act_id, act_time, position)
          WHERE l1_acts.act_id = published.act_id",
        epoch,
        &act_ids,
        &act_times,
        &positions,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query!(
        "INSERT INTO l1_act_legs (act_id, leg, source, target, p_d, p_i, tau)
         SELECT * FROM UNNEST($1::TEXT[], $2::TEXT[], $3::TEXT[], $4::TEXT[],
                              $5::DOUBLE PRECISION[], $6::DOUBLE PRECISION[],
                              $7::DOUBLE PRECISION[])",
        &leg_acts,
        &leg_roles,
        &leg_sources,
        &leg_targets,
        &leg_p_d,
        &leg_p_i,
        &leg_tau,
    )
    .execute(&mut **tx)
    .await?;

    let debited: Vec<String> = selection.acts_per_author.keys().cloned().collect();
    let counts: Vec<i64> = selection.acts_per_author.values().copied().collect();
    sqlx::query!(
        "UPDATE l1_accounts
            SET balance_micro = balance_micro - $1 * landed.acts,
                action_count  = action_count + landed.acts
           FROM UNNEST($2::TEXT[], $3::BIGINT[]) AS landed(address, acts)
          WHERE l1_accounts.address = landed.address",
        theta,
        &debited,
        &counts,
    )
    .execute(&mut **tx)
    .await?;

    let nodes: Vec<String> = selection.touched_nodes.keys().cloned().collect();
    let frontiers: Vec<i64> = selection
        .touched_nodes
        .values()
        .map(|(frontier, _)| *frontier)
        .collect();
    let degrees: Vec<i64> = selection
        .touched_nodes
        .values()
        .map(|(_, degree)| *degree)
        .collect();
    sqlx::query!(
        "INSERT INTO l1_node_state (node_id, frontier, degree)
         SELECT * FROM UNNEST($1::TEXT[], $2::BIGINT[], $3::BIGINT[])
         ON CONFLICT (node_id) DO UPDATE
         SET frontier = EXCLUDED.frontier, degree = EXCLUDED.degree",
        &nodes,
        &frontiers,
        &degrees,
    )
    .execute(&mut **tx)
    .await?;

    let step = closure
        .wall
        .as_ref()
        .ok_or_else(|| StandInError::Host("a close publishes its controller step".into()))?;
    let attested_at = sqlx::query_scalar!(
        "INSERT INTO l1_epochs
             (epoch, act_count, theta_charged_micro, closure_cause,
              marker_policy, marker_edition,
              wall_num, wall_den, width_num, width_den, rung_num, rung_den,
              proposal_num, proposal_den, delivered_num, delivered_den,
              theta_next_micro)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING closed_at",
        epoch,
        selection.records.len() as i64,
        theta,
        closure.cause.as_str(),
        closure.marker.identity,
        closure.marker.edition,
        step.wall_in_force.numerator(),
        step.wall_in_force.denominator(),
        step.width.numerator(),
        step.width.denominator(),
        step.accepted_rung.numerator(),
        step.accepted_rung.denominator(),
        step.proposal.numerator(),
        step.proposal.denominator(),
        step.delivered.numerator(),
        step.delivered.denominator(),
        step.theta_next_micro,
    )
    .fetch_one(&mut **tx)
    .await?;

    let mut addresses: Vec<String> = Vec::with_capacity(closure.ledger.len());
    let mut accepted: Vec<i64> = Vec::with_capacity(closure.ledger.len());
    let mut action_counts: Vec<i64> = Vec::with_capacity(closure.ledger.len());
    let mut residuals: Vec<Option<i64>> = Vec::with_capacity(closure.ledger.len());
    for line in &closure.ledger {
        addresses.push(line.address.clone());
        accepted.push(line.accepted_acts);
        action_counts.push(line.action_count);
        residuals.push(line.residual_balance_micro);
    }
    sqlx::query!(
        "INSERT INTO l1_epoch_ledger (epoch, address, accepted_acts, action_count, balance_micro)
         SELECT $1, * FROM UNNEST($2::TEXT[], $3::BIGINT[], $4::BIGINT[], $5::BIGINT[])",
        epoch,
        &addresses,
        &accepted,
        &action_counts,
        &residuals as &[Option<i64>],
    )
    .execute(&mut **tx)
    .await?;

    Ok(attested_at)
}

pub(crate) async fn epochs_since(
    standin: &StandIn,
    after: i64,
) -> Result<Vec<EpochPackage>, StandInError> {
    let mut conn = standin.pool().acquire().await?;
    let epochs = sqlx::query!(
        "SELECT epoch, closed_at, theta_charged_micro, closure_cause,
                marker_policy, marker_edition,
                wall_num, wall_den, width_num, width_den, rung_num, rung_den,
                proposal_num, proposal_den, delivered_num, delivered_den,
                theta_next_micro
         FROM l1_epochs WHERE epoch > $1 ORDER BY epoch",
        after,
    )
    .fetch_all(&mut *conn)
    .await?;
    let mut packages = Vec::with_capacity(epochs.len());
    for e in epochs {
        let wall = match (
            e.wall_num,
            e.wall_den,
            e.width_num,
            e.width_den,
            e.rung_num,
            e.rung_den,
            e.proposal_num,
            e.proposal_den,
            e.delivered_num,
            e.delivered_den,
            e.theta_next_micro,
        ) {
            (
                Some(wall_n),
                Some(wall_d),
                Some(width_n),
                Some(width_d),
                Some(rung_n),
                Some(rung_d),
                Some(proposal_n),
                Some(proposal_d),
                Some(delivered_n),
                Some(delivered_d),
                Some(theta_next_micro),
            ) => Some(WallStep {
                wall_in_force: stored_ratio(wall_n, wall_d)?,
                width: stored_ratio(width_n, width_d)?,
                accepted_rung: stored_ratio(rung_n, rung_d)?,
                proposal: stored_ratio(proposal_n, proposal_d)?,
                delivered: stored_ratio(delivered_n, delivered_d)?,
                theta_next_micro,
            }),
            _ => None,
        };
        let cause = ClosureCause::parse(&e.closure_cause).ok_or_else(|| {
            StandInError::Host(format!("stored closure cause {} unknown", e.closure_cause))
        })?;
        let mut package = load_epoch(&mut conn, e.epoch, e.closed_at).await?;
        package.closure.cause = cause;
        package.closure.theta_charged_micro = e.theta_charged_micro;
        package.closure.wall = wall;
        package.closure.marker = MarkerPolicy {
            identity: e.marker_policy,
            edition: e.marker_edition,
        };
        packages.push(package);
    }
    Ok(packages)
}

/// Rebuilds one published epoch's records and final ledger from storage,
/// in position order, with its dependent-set partition recomputed from
/// the records' stored causal parents — immutable structural fields, so
/// the partition reads back as the close published it. Each record's legs
/// are read back ordered by role ('a' before 't' lexically), matching
/// `projection_legs`'s own ordering. The epoch row's own closure columns
/// are the caller's.
///
/// The legs come back in one query and are grouped in memory: a query per
/// record is the same N+1 the write side avoids.
async fn load_epoch(
    conn: &mut PgConnection,
    epoch: i64,
    attested_at: chrono::DateTime<chrono::Utc>,
) -> Result<EpochPackage, StandInError> {
    let rows = sqlx::query!(
        r#"SELECT act_id, author, family, act_time AS "act_time!",
                  position AS "position!", payload_len, content_commitment,
                  asserted_parents, settlement_ref
           FROM l1_acts WHERE epoch = $1 AND status = 'accepted'
           ORDER BY position"#,
        epoch,
    )
    .fetch_all(&mut *conn)
    .await?;
    let parents: Vec<(i64, String, Vec<String>)> = rows
        .iter()
        .map(|r| {
            (
                r.position,
                r.act_id.clone(),
                causal_parents(&r.asserted_parents, r.settlement_ref.as_ref()),
            )
        })
        .collect();

    let ledger = sqlx::query!(
        r#"SELECT address, accepted_acts, action_count, balance_micro
           FROM l1_epoch_ledger WHERE epoch = $1 ORDER BY address COLLATE "C""#,
        epoch,
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|l| LedgerLine {
        address: l.address,
        accepted_acts: l.accepted_acts,
        action_count: l.action_count,
        residual_balance_micro: l.balance_micro,
    })
    .collect();

    let act_ids: Vec<String> = rows.iter().map(|r| r.act_id.clone()).collect();
    let mut legs_by_act: HashMap<String, Vec<PublishedLeg>> = HashMap::new();
    for l in sqlx::query!(
        "SELECT act_id, leg, source, target, p_d, p_i, tau FROM l1_act_legs
         WHERE act_id = ANY($1) ORDER BY act_id, leg",
        &act_ids,
    )
    .fetch_all(&mut *conn)
    .await?
    {
        legs_by_act.entry(l.act_id).or_default().push(PublishedLeg {
            role: LegRole::parse(&l.leg).ok_or_else(|| {
                StandInError::Formation(format!("stored leg role {} unknown", l.leg))
            })?,
            source: NodeId::parse(&l.source).map_err(|e| StandInError::Formation(e.to_string()))?,
            target: NodeId::parse(&l.target).map_err(|e| StandInError::Formation(e.to_string()))?,
            p_d: l.p_d,
            p_i: l.p_i,
            tau: l.tau,
        });
    }

    let mut records = Vec::with_capacity(rows.len());
    for row in rows {
        records.push(PublishedRecord {
            act_id: common::l1::ActId::parse(&row.act_id)
                .map_err(|e| StandInError::Formation(e.to_string()))?,
            legs: legs_by_act.remove(&row.act_id).unwrap_or_default(),
            author: row.author,
            family: common::l1::Family::parse(&row.family).ok_or_else(|| {
                StandInError::Formation(format!("stored family {} unknown", row.family))
            })?,
            epoch,
            act_time: row.act_time,
            position: row.position,
            payload_marked: row.payload_len > 0,
            payload_witness: row.content_commitment,
        });
    }
    Ok(EpochPackage {
        epoch,
        attested_at,
        records,
        closure: EpochClosure {
            dependent_sets: dependent_sets(&parents),
            ledger,
            ..EpochClosure::default()
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::l1::Family;
    use common::l1::identifier::ActId;

    const THETA: i64 = crate::REFERENCE_THETA_MICRO;

    fn candidate(author: &str, seq: u64, target: &str, prerequisites: &[&str]) -> Candidate {
        let body = common::l1::StructuralBody {
            author: author.to_string(),
            seq,
            family: Family::Opinion,
            middle: None,
            target: NodeId::Prof(target.to_string()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        };
        Candidate {
            act_id: body.act_id().to_string(),
            author: author.to_string(),
            body,
            payload_len: 0,
            payload_witness: vec![],
            prerequisites: prerequisites.iter().map(|p| p.to_string()).collect(),
            parents: vec![],
        }
    }

    fn id(author: &str, seq: u64) -> String {
        ActId::new(author, seq, Family::Opinion)
            .expect("valid")
            .to_string()
    }

    fn funded(authors: &[&str], acts: i64) -> LedgerState {
        LedgerState {
            balances: authors
                .iter()
                .map(|a| ((*a).to_string(), acts * THETA))
                .collect(),
            ..LedgerState::default()
        }
    }

    fn published(selection: &Selection) -> Vec<String> {
        selection
            .records
            .iter()
            .map(|r| r.act_id.to_string())
            .collect()
    }

    /// A dependency approved after its dependent still lands in the same
    /// close, ahead of it: approval order never forces a causally
    /// satisfiable act to defer, and the published order linearizes what
    /// the selection admitted.
    ///
    /// A dependency approved after its dependent still lands ahead of it in the same close.
    /// ´claim:close:approval-order-never-defers-a-satisfiable-act´
    #[test]
    fn a_later_approved_dependency_still_lands_first() {
        let mut state = funded(&["alice"], 4);
        let selection = select_and_order(
            vec![
                candidate("alice", 1, "bob", &[&id("alice", 0)]),
                candidate("alice", 0, "bob", &[]),
            ],
            &mut state,
            1,
            THETA,
            10,
        )
        .expect("selects");
        assert_eq!(published(&selection), vec![id("alice", 0), id("alice", 1)]);
    }

    /// A prerequisite outside this close defers its dependent, and every
    /// act that depends on the deferred one defers with it: dependent sets
    /// land whole or not at all.
    ///
    /// An act whose prerequisite is outside the close defers, and its dependents defer with it.
    /// ´claim:close:a-dependent-set-lands-whole-or-not-at-all´
    #[test]
    fn an_unsatisfied_prerequisite_defers_the_whole_chain() {
        let mut state = funded(&["alice"], 4);
        let selection = select_and_order(
            vec![
                candidate("alice", 0, "bob", &["act:nobody:0:opinion"]),
                candidate("alice", 1, "bob", &[&id("alice", 0)]),
                candidate("alice", 2, "bob", &[]),
            ],
            &mut state,
            1,
            THETA,
            10,
        )
        .expect("selects");
        assert_eq!(published(&selection), vec![id("alice", 2)]);
    }

    /// An insolvent author's act defers rather than landing unpaid, and a
    /// solvent author is debited exactly θ per act landed. `mallory` has no
    /// account at all: the gate is a balance, never a default.
    ///
    /// An insolvent author's act defers, and a solvent author pays θ once per act.
    /// ´claim:close:solvency-is-debited-once-per-act´
    #[test]
    fn insolvency_defers_and_solvency_is_debited_once_per_act() {
        let mut state = LedgerState {
            balances: [("alice".to_string(), 2 * THETA)].into_iter().collect(),
            ..LedgerState::default()
        };
        let selection = select_and_order(
            vec![
                candidate("alice", 0, "bob", &[]),
                candidate("alice", 1, "bob", &[]),
                candidate("alice", 2, "bob", &[]),
                candidate("mallory", 0, "bob", &[]),
            ],
            &mut state,
            1,
            THETA,
            10,
        )
        .expect("selects");
        assert_eq!(selection.records.len(), 2);
        assert_eq!(selection.acts_per_author.get("alice"), Some(&2));
        assert_eq!(selection.acts_per_author.get("mallory"), None);
        assert_eq!(state.balances.get("alice"), Some(&0));
    }

    /// The act budget caps the epoch; the rest stays for a later close.
    ///
    /// The act budget caps how many acts one close publishes.
    /// ´claim:close:the-budget-caps-what-one-close-publishes´
    #[test]
    fn the_budget_caps_the_epoch() {
        let mut state = funded(&["alice"], 5);
        let selection = select_and_order(
            (0..5)
                .map(|seq| candidate("alice", seq, "bob", &[]))
                .collect(),
            &mut state,
            1,
            THETA,
            2,
        )
        .expect("selects");
        assert_eq!(selection.records.len(), 2);
        assert_eq!(state.balances.get("alice"), Some(&(3 * THETA)));
    }

    /// However a dependency chain is presented to the selection, the
    /// published order linearizes every declared dependency and the
    /// positions are the order itself. Every permutation of a five-act
    /// chain is checked, so the property is not read off one arrangement.
    ///
    /// The published order linearizes every dependency, however the chain was presented.
    /// ´claim:close:the-published-order-linearizes-every-dependency´
    #[test]
    fn every_arrangement_of_a_chain_publishes_in_dependency_order() {
        let chain: Vec<Candidate> = (0..5u64)
            .map(|seq| {
                let prerequisites: Vec<String> = if seq == 0 {
                    vec![]
                } else {
                    vec![id("alice", seq - 1)]
                };
                let mut c = candidate("alice", seq, "bob", &[]);
                c.prerequisites = prerequisites;
                c
            })
            .collect();

        for arrangement in permutations(chain) {
            let mut state = funded(&["alice"], 5);
            let selection = select_and_order(arrangement, &mut state, 1, THETA, 10)
                .expect("every arrangement selects");
            assert_eq!(
                published(&selection),
                (0..5).map(|seq| id("alice", seq)).collect::<Vec<_>>()
            );
            let positions: Vec<i64> = selection.records.iter().map(|r| r.position).collect();
            assert_eq!(positions, vec![1, 2, 3, 4, 5]);
        }
    }

    /// Whatever the selection holds — several authors, a dependency, a
    /// deferral — positions number its acts 1..=|𝒬_k| in the published
    /// order, every record names the closing epoch, and the package passes
    /// the order-of-record check the close runs before committing.
    ///
    /// A close numbers its acts from 1 with no gap, in the epoch it closes.
    /// ´claim:close:positions-number-the-epoch-from-one´
    #[test]
    fn positions_number_the_epoch_from_one() {
        let mut state = funded(&["alice", "bob"], 3);
        let selection = select_and_order(
            vec![
                candidate("bob", 0, "carol", &[&id("alice", 0)]),
                candidate("alice", 0, "carol", &[]),
                candidate("alice", 1, "dave", &["act:nobody:0:opinion"]),
                candidate("bob", 1, "dave", &[]),
            ],
            &mut state,
            4,
            THETA,
            10,
        )
        .expect("selects");
        let package = EpochPackage {
            epoch: 4,
            attested_at: chrono::DateTime::from_timestamp(1_800_000_000, 0).expect("instant"),
            records: selection.records,
            closure: EpochClosure::default(),
        };
        let positions: Vec<i64> = package.records.iter().map(|r| r.position).collect();
        assert_eq!(positions, vec![1, 2, 3]);
        assert!(package.records.iter().all(|r| r.epoch == 4));
        publishable(&package).expect("an order of record");
    }

    /// The pre-commit check refuses what has no order of record: the close
    /// reports a host fault instead of writing an epoch 0 or a position 0.
    ///
    /// The close refuses to publish an epoch 0 or a position outside 1..=n.
    /// ´claim:close:a-malformed-epoch-is-never-published´
    #[test]
    fn a_malformed_package_is_not_publishable() {
        let mut state = funded(&["alice"], 2);
        let selection = select_and_order(
            vec![
                candidate("alice", 0, "bob", &[]),
                candidate("alice", 1, "bob", &[]),
            ],
            &mut state,
            0,
            THETA,
            10,
        )
        .expect("selects");
        let mut package = EpochPackage {
            epoch: 0,
            attested_at: chrono::DateTime::from_timestamp(1_800_000_000, 0).expect("instant"),
            records: selection.records,
            closure: EpochClosure::default(),
        };
        assert!(matches!(publishable(&package), Err(StandInError::Host(_))));
        package.epoch = 1;
        for record in &mut package.records {
            record.epoch = 1;
        }
        publishable(&package).expect("renumbered, it is publishable");
        package.records[1].position = 0;
        assert!(matches!(publishable(&package), Err(StandInError::Host(_))));
    }

    /// Both legs of a hyper act see the same pre-act degrees, so neither
    /// matures the other; the second act over the same endpoints then reads
    /// the degrees the first left.
    ///
    /// Maturity replays from pre-act degrees, so a hyper act's two legs never mature one another.
    /// ´claim:close:maturity-replays-from-pre-act-degrees´
    #[test]
    fn a_hyper_acts_two_legs_do_not_mature_one_another() {
        let chat = ActId::new("alice", 0, Family::Participant).expect("valid");
        let body = common::l1::StructuralBody {
            author: "alice".to_string(),
            seq: 0,
            family: Family::Participant,
            middle: Some(NodeId::Mint(chat.clone())),
            target: NodeId::Mint(chat.clone()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        };
        let founding = Candidate {
            act_id: body.act_id().to_string(),
            author: "alice".to_string(),
            body,
            payload_len: 0,
            payload_witness: vec![],
            prerequisites: vec![],
            parents: vec![],
        };

        let mut state = funded(&["alice"], 4);
        let first =
            select_and_order(vec![founding.clone()], &mut state, 1, THETA, 10).expect("selects");
        let legs = &first.records[0].legs;
        assert_eq!(legs.len(), 2);
        assert!(
            legs.iter().all(|leg| leg.tau == 0.0),
            "both legs read the same pre-act degrees: {legs:?}"
        );

        let mut second_body = founding.body.clone();
        second_body.seq = 1;
        second_body.family = Family::Participant;
        let again = Candidate {
            act_id: second_body.act_id().to_string(),
            body: second_body,
            ..founding
        };
        let second = select_and_order(vec![again], &mut state, 2, THETA, 10).expect("selects");
        assert!(
            second.records[0].legs.iter().all(|leg| leg.tau > 0.0),
            "the endpoints have matured"
        );
    }

    /// The partition joins acts linked through causal parents inside the
    /// epoch and nothing else: a parent already in history joins nobody,
    /// even when two acts share it, and a declared dependency is not a
    /// parent. The blocks are the same however the acts are listed.
    ///
    /// The dependent-set partition joins acts linked through in-epoch causal parents, and only those.
    /// ´claim:close:the-partition-joins-in-epoch-causal-parents-only´
    #[test]
    fn the_partition_joins_in_epoch_causal_parents_only() {
        let acts: Vec<(i64, String, Vec<String>)> = vec![
            (1, "a".into(), vec![]),
            (2, "b".into(), vec!["a".into()]),
            (3, "c".into(), vec!["historical".into()]),
            (4, "d".into(), vec!["c".into()]),
            (5, "e".into(), vec!["historical".into()]),
            (6, "f".into(), vec!["d".into(), "b".into()]),
            (7, "g".into(), vec![]),
        ];
        assert_eq!(
            dependent_sets(&acts),
            vec![vec![1, 2, 3, 4, 6], vec![5], vec![7]]
        );
        let mut reversed = acts.clone();
        reversed.reverse();
        assert_eq!(dependent_sets(&reversed), dependent_sets(&acts));
        assert_eq!(dependent_sets(&acts[..2]), vec![vec![1, 2]]);
        assert!(dependent_sets(&[]).is_empty());

        assert_eq!(
            causal_parents(&["p".to_string()], Some(&"settled".to_string())),
            vec!["p".to_string(), "settled".to_string()],
            "the settles-pointer is a causal parent"
        );

        let mut state = funded(&["alice"], 3);
        let mut dependent = candidate("alice", 1, "bob", &[&id("alice", 0)]);
        dependent.parents = vec![];
        let selection = select_and_order(
            vec![candidate("alice", 0, "bob", &[]), dependent],
            &mut state,
            1,
            THETA,
            10,
        )
        .expect("selects");
        assert_eq!(
            selection.dependent_sets,
            vec![vec![1], vec![2]],
            "a declared dependency orders the pair but does not join their blocks"
        );
    }

    /// A dependency in accepted history is honored by membership: it sits
    /// in an earlier epoch, so at a lower key of record, even where its act
    /// time is higher than the dependent's — times on disjoint endpoints
    /// order nothing. A dependency in neither history nor the earlier part
    /// of the epoch is refused.
    ///
    /// A history dependency is honored by membership, never by comparing act times.
    /// ´claim:close:a-history-dependency-is-honored-by-membership´
    #[test]
    fn a_history_dependency_is_honored_by_membership() {
        let mut state = funded(&["alice"], 1);
        let selection = select_and_order(
            vec![candidate("alice", 0, "bob", &[])],
            &mut state,
            2,
            THETA,
            10,
        )
        .expect("selects");
        let low_time = &selection.records;
        assert_eq!(low_time[0].act_time, 1);
        let history: HashMap<String, i64> = [("act:carol:0:opinion".to_string(), 9)].into();
        let needs = ["act:carol:0:opinion".to_string()];
        linearizes(low_time, &[&needs[..]], &history)
            .expect("an accepted act precedes every act of a later epoch");
        let unknown = ["act:nobody:0:opinion".to_string()];
        assert!(matches!(
            linearizes(low_time, &[&unknown[..]], &history),
            Err(StandInError::Host(_))
        ));
    }

    /// One generated candidate: author, target node, whether it is a hyper
    /// act through a middle node, and which earlier candidates or history
    /// acts it must follow.
    #[derive(Debug, Clone)]
    struct Shape {
        author: usize,
        target: usize,
        hyper: Option<usize>,
        prerequisites: Vec<usize>,
        history: Vec<usize>,
    }

    const AUTHORS: [&str; 3] = ["alice", "bob", "carol"];
    const NODES: usize = 5;
    const HISTORY: [(&str, i64); 3] = [
        ("act:hist:0:opinion", 3),
        ("act:hist:1:opinion", 7),
        ("act:hist:2:opinion", 1),
    ];

    fn shapes() -> impl proptest::strategy::Strategy<Value = Vec<Shape>> {
        use proptest::prelude::*;
        let shape = (
            0..AUTHORS.len(),
            0..NODES,
            proptest::option::of(0..NODES),
            proptest::collection::vec(0usize..12, 0..3),
            proptest::collection::vec(0..HISTORY.len(), 0..2),
        )
            .prop_map(|(author, target, hyper, prerequisites, history)| Shape {
                author,
                target,
                hyper,
                prerequisites,
                history,
            });
        proptest::collection::vec(shape, 1..12)
    }

    fn generated(shapes: &[Shape]) -> Vec<Candidate> {
        let ids: Vec<String> = shapes
            .iter()
            .enumerate()
            .map(|(seq, s)| {
                let family = if s.hyper.is_some() {
                    Family::Tag
                } else {
                    Family::Opinion
                };
                ActId::new(AUTHORS[s.author], seq as u64, family)
                    .expect("valid")
                    .to_string()
            })
            .collect();
        shapes
            .iter()
            .enumerate()
            .map(|(seq, s)| {
                let body = common::l1::StructuralBody {
                    author: AUTHORS[s.author].to_string(),
                    seq: seq as u64,
                    family: if s.hyper.is_some() {
                        Family::Tag
                    } else {
                        Family::Opinion
                    },
                    middle: s.hyper.map(|m| NodeId::Prof(format!("n{m}"))),
                    target: match s.hyper {
                        Some(_) => NodeId::name(&format!("role{}", s.target)).expect("name"),
                        None => NodeId::Prof(format!("n{}", s.target)),
                    },
                    p_d: 0.0,
                    p_i: 0.0,
                    settlement_ref: None,
                    license: None,
                    asserted_parents: vec![],
                };
                let mut prerequisites: Vec<String> = s
                    .prerequisites
                    .iter()
                    .filter(|&&p| p != seq && p < shapes.len())
                    .map(|&p| ids[p].clone())
                    .collect();
                prerequisites.extend(s.history.iter().map(|&h| HISTORY[h].0.to_string()));
                Candidate {
                    act_id: ids[seq].clone(),
                    author: AUTHORS[s.author].to_string(),
                    body,
                    payload_len: 0,
                    payload_witness: vec![],
                    prerequisites,
                    parents: vec![],
                }
            })
            .collect()
    }

    use proptest::{prop_assert, prop_assert_eq};

    proptest::proptest! {
        /// Over arbitrary candidate sets — shared and disjoint endpoints,
        /// binary and hyper acts, in-epoch and history prerequisites,
        /// dependency cycles that can never land, and a budget that may
        /// cut the epoch short — the §8.3 recurrence recomputed along the
        /// published positions, from the frontiers the epoch started with,
        /// reproduces every published act time: one more than the maximum
        /// over the act's incident endpoints' frontiers and its finalized
        /// predecessors' times. Every prerequisite sits at a lower key.
        ///
        /// The published act times are the §8.3 recurrence recomputed along the published positions.
        /// ´claim:close:act-times-are-the-recurrence-along-the-positions´
        #[test]
        fn the_published_act_times_are_the_recurrence_along_the_positions(
            shapes in shapes(),
            frontiers in proptest::collection::vec(0i64..10, NODES),
            budget in 1i64..14,
        ) {
            let candidates = generated(&shapes);
            let prerequisites: HashMap<String, Vec<String>> = candidates
                .iter()
                .map(|c| (c.act_id.clone(), c.prerequisites.clone()))
                .collect();
            let mut state = funded(&AUTHORS, 20);
            state.accepted_times = HISTORY.iter().map(|(id, t)| (id.to_string(), *t)).collect();
            state.frontiers = (0..NODES)
                .map(|n| (NodeId::Prof(format!("n{n}")).to_string(), frontiers[n]))
                .collect();
            let start = state.clone();

            let selection = select_and_order(candidates, &mut state, 3, THETA, budget)
                .expect("selects");
            prop_assert!(selection.records.len() as i64 <= budget);

            let mut frontier = start.frontiers.clone();
            let mut finalized = start.accepted_times.clone();
            for (expected_position, record) in (FIRST_POSITION..).zip(&selection.records) {
                prop_assert_eq!(record.position, expected_position);
                let id = record.act_id.to_string();
                let mut endpoints: Vec<String> = Vec::new();
                for leg in &record.legs {
                    endpoints.push(leg.source.to_string());
                    endpoints.push(leg.target.to_string());
                }
                let mut base = 0;
                for endpoint in &endpoints {
                    base = base.max(frontier.get(endpoint).copied().unwrap_or(0));
                }
                for predecessor in &prerequisites[&id] {
                    let at = finalized.get(predecessor).copied();
                    prop_assert!(at.is_some(), "{} precedes {}", predecessor, id);
                    base = base.max(at.unwrap_or(0));
                }
                prop_assert_eq!(record.act_time, base + 1, "act time of {}", id);
                for endpoint in endpoints {
                    let f = frontier.entry(endpoint).or_insert(0);
                    *f = (*f).max(record.act_time);
                }
                finalized.insert(id, record.act_time);
            }
        }
    }

    fn permutations(items: Vec<Candidate>) -> Vec<Vec<Candidate>> {
        if items.len() <= 1 {
            return vec![items];
        }
        let mut out = Vec::new();
        for pick in 0..items.len() {
            let mut rest = items.clone();
            let head = rest.remove(pick);
            for mut tail in permutations(rest) {
                tail.insert(0, head.clone());
                out.push(tail);
            }
        }
        out
    }
}
