//! ´mod:module:removal´
//!
//! Per-content removal (erasure.md §1; api-spec.md `removeContent`): an
//! author removes a post or a comment they wrote, and its words and
//! pictures leave every reader's view behind a visible mark. Pure L2
//! policy — nothing is authored, severed or deleted on the graph; the
//! record keeps its place, its routing, its standing and its replies.
//!
//! This engine decides *which* acts go and owns their display tombstones;
//! the redaction substrate ([`crate::redaction`]) does each act.
//!
//! **The scope is the revision chain.** A post or comment is its genesis
//! act and every edit its author made after it, landed or still in flight
//! (post.md §4). With `includeRevisions` the whole chain goes — what the
//! product's "Remove" promises, every earlier version's words included;
//! without it, the named act alone.
//!
//! **One transaction per act, display included.** Each act is archived,
//! reduced and reaped, its version rows tombstoned and its media held in
//! one transaction, under the node's row lock — so no committed state
//! shows a reduced act's words on screen, and no crash leaves plaintext
//! display rows over reduced carriage for a reconciler to find (there is
//! no request record to reconcile from). A failure part-way leaves every
//! earlier act fully removed and the rest untouched, and a retry
//! completes it: every step is idempotent.
//!
//! **Nothing joins the chain unseen.** The act whose transaction takes the
//! node down re-reads the chain under the lock; an edit staged since the
//! scope was read rolls that transaction back into a wider scope. After
//! the node reads removed, an edit is refused at prepare and at its
//! pre-sign, which takes the same lock.

use std::collections::HashSet;

use common::l1::census::Family;
use common::l1::identifier::ActId;
use postgres_store::removal::{self as store, ActRows, ContentNode};
use postgres_store::{PgPool, content as content_store, mirror, staged};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::l1::L1Boundary;
use crate::media::MediaAreas;
use crate::redaction::{self, Redacted, Redaction, RedactionError};

/// How many times a removal widens its scope for edits staged under it
/// before giving up. Each widening needs an edit prepared in the window
/// between two of the removal's own transactions, so a second one is
/// already a race; the bound only keeps a pathological client from
/// holding the request open.
const MAX_WIDENINGS: usize = 4;

/// Why a removal was refused.
#[derive(Debug, thiserror::Error)]
pub enum RemovalError {
    /// No record and no staged act answers to the identifier.
    #[error("no record has this identifier")]
    NotFound,
    /// The viewer did not author the record.
    #[error("only its author removes a record")]
    NotAuthor,
    /// The record is not a post or a comment — the content this verb
    /// removes (RM-G4: Publish and Review).
    #[error("a {0} record is not content this removes")]
    OutOfScope(String),
    /// An act of the scope is carried with an application: it never
    /// reached Layer 1 or a reader, and it is deleted with its account.
    #[error("act {0} is carried with an application")]
    Carried(String),
    #[error("redaction: {0}")]
    Redaction(#[from] RedactionError),
    #[error("storage: {0}")]
    Storage(String),
}

impl From<sqlx::Error> for RemovalError {
    fn from(e: sqlx::Error) -> Self {
        Self::Storage(e.to_string())
    }
}

impl From<mirror::MirrorError> for RemovalError {
    fn from(e: mirror::MirrorError) -> Self {
        Self::Storage(e.to_string())
    }
}

impl From<staged::StagedError> for RemovalError {
    fn from(e: staged::StagedError) -> Self {
        Self::Storage(e.to_string())
    }
}

impl From<content_store::ContentError> for RemovalError {
    fn from(e: content_store::ContentError) -> Self {
        Self::Storage(e.to_string())
    }
}

/// What a removal did.
#[derive(Debug, Clone, Default)]
pub struct Removed {
    /// Every act of the scope, oldest first — landed and in flight. The
    /// payload serves the landed ones as records; one still in flight has
    /// no record yet, and lands reduced.
    pub acts: Vec<String>,
    /// What each act's redaction did, in the same order.
    pub redacted: Vec<Redacted>,
}

/// One act of the scope: its identifier, the display rows it owns, and
/// whether it is carried.
#[derive(Debug, Clone, PartialEq, Eq)]
struct ScopeAct {
    act_id: String,
    rows: ActRows,
    carried: bool,
}

impl ScopeAct {
    /// The order the scope is worked in, the node's current version last:
    /// acts with no display row first, then landed acts in their order,
    /// then pending ones by authoring instant — the order the current
    /// version rule ranks their rows in.
    fn rank(
        &self,
    ) -> (
        u8,
        Option<content_store::LandingOrder>,
        Option<chrono::DateTime<chrono::Utc>>,
    ) {
        match (self.rows.order, self.rows.instant) {
            (Some(order), _) => (1, Some(order), None),
            (None, Some(instant)) => (2, None, Some(instant)),
            (None, None) => (0, None, None),
        }
    }
}

/// The node a record belongs to, as its own leg names it.
struct Located {
    act: ActId,
    family: Family,
    /// The node's minted identifier — the act's own target.
    node: String,
    carried: bool,
}

/// Removes the record `record` the viewer authored — with
/// `include_revisions`, its whole revision chain.
///
/// Refusals come before anything is written: an unknown record, a record
/// someone else authored, a record that is not a post or comment, and a
/// carried act each leave every row as it was.
pub async fn remove_content<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    areas: &MediaAreas,
    viewer: Uuid,
    record: &str,
    include_revisions: bool,
) -> Result<Removed, RemovalError> {
    let located = locate(pool, record).await?;
    let address = crate::nodes::required_address(pool, viewer)
        .await
        .map_err(|e| RemovalError::Storage(e.to_string()))?;
    if located.act.author != address {
        return Err(RemovalError::NotAuthor);
    }
    if !removable(located.family) {
        return Err(RemovalError::OutOfScope(
            located.family.as_str().to_string(),
        ));
    }
    if located.carried {
        return Err(RemovalError::Carried(record.to_string()));
    }
    let node = match located.family {
        Family::Publish => content_store::post_by_node(pool, &located.node)
            .await?
            .map(|p| ContentNode::Post(p.id)),
        _ => content_store::comment_by_node(pool, &located.node)
            .await?
            .map(|c| ContentNode::Comment(c.id)),
    };
    let chain = Chain {
        viewer,
        address: &address,
        family: located.family,
        node: &located.node,
        record,
        include_revisions,
    };

    let mut conn = pool.acquire().await?;
    let mut scope = chain.resolve(&mut conn).await?;
    drop(conn);
    if let Some(carried) = scope.iter().find(|a| a.carried) {
        return Err(RemovalError::Carried(carried.act_id.clone()));
    }

    let redacted_by = viewer.to_string();
    let mut done: Vec<(String, Redacted)> = Vec::with_capacity(scope.len());
    let mut finished: HashSet<String> = HashSet::new();
    let mut widenings = 0;
    while let Some(act) = scope
        .iter()
        .find(|a| !finished.contains(&a.act_id))
        .cloned()
    {
        let last = scope
            .iter()
            .filter(|a| !finished.contains(&a.act_id))
            .count()
            == 1;
        let r = Redaction {
            actor_id: viewer,
            act_id: &act.act_id,
            reason: store::AUTHOR_REMOVAL,
            redacted_by: &redacted_by,
        };
        // The act's own rows are locked first, the node's second — the
        // order a landing takes them in, so the two never wait on each
        // other in a cycle.
        let mut tx = pool.begin().await?;
        let reduced = redaction::reduce_in(&mut tx, &r).await?;
        let head = match node {
            Some(node) => store::lock_node(&mut tx, node).await?,
            None => None,
        };
        if last && include_revisions {
            let now = chain.resolve(&mut tx).await?;
            let grown: Vec<ScopeAct> = now
                .into_iter()
                .filter(|a| !scope.iter().any(|known| known.act_id == a.act_id))
                .collect();
            if !grown.is_empty() {
                drop(reduced);
                drop(tx);
                widenings += 1;
                if widenings > MAX_WIDENINGS {
                    return Err(RemovalError::Storage(
                        "edits kept arriving while the post was removed".into(),
                    ));
                }
                if let Some(carried) = grown.iter().find(|a| a.carried) {
                    return Err(RemovalError::Carried(carried.act_id.clone()));
                }
                scope.extend(grown);
                scope.sort_by_key(ScopeAct::rank);
                continue;
            }
        }
        if let (Some(node), Some(head)) = (node, &head) {
            store::tombstone_act(&mut tx, node, head, &act.rows, store::AUTHOR_REMOVAL).await?;
        }
        let redacted = reduced.hold_in(&mut tx).await?;
        tx.commit().await?;
        finished.insert(act.act_id.clone());
        done.push((act.act_id, redacted));
    }

    let acts: Vec<String> = scope.iter().map(|a| a.act_id.clone()).collect();
    let mut redacted: Vec<Redacted> = acts
        .iter()
        .map(|id| {
            done.iter()
                .find(|(act, _)| act == id)
                .map(|(_, r)| r.clone())
                .unwrap_or_default()
        })
        .collect();
    redaction::release(boundary, pool, areas, &acts, &mut redacted).await?;
    Ok(Removed { acts, redacted })
}

/// Finds the act a record identifier names: in the mirror once it
/// landed, in the staged writes while it is in flight. Its node is its
/// own leg's target — a genesis act's own mint, an edit's node.
async fn locate(pool: &PgPool, record: &str) -> Result<Located, RemovalError> {
    let act = ActId::parse(record).map_err(|_| RemovalError::NotFound)?;
    let staged_row = staged::staged_act(pool, record).await?;
    if let Some(landed) = mirror::record_full(pool, record).await? {
        let node = landed
            .legs
            .iter()
            .find(|l| l.leg == "binary" || l.leg == "t")
            .map(|l| l.target.clone())
            .ok_or_else(|| RemovalError::Storage(format!("record {record} has no own leg")))?;
        return Ok(Located {
            family: act.family,
            act,
            node,
            carried: false,
        });
    }
    let Some(row) = staged_row else {
        return Err(RemovalError::NotFound);
    };
    Ok(Located {
        family: act.family,
        act,
        node: row.target,
        carried: row.state == staged::StagedState::Carried.as_str(),
    })
}

/// The scope's resolver: one author's chain on one node, or one act.
struct Chain<'a> {
    viewer: Uuid,
    address: &'a str,
    family: Family,
    node: &'a str,
    record: &'a str,
    include_revisions: bool,
}

impl Chain<'_> {
    /// The scope as the stores hold it now, in the order it is worked in.
    /// The landed half comes off the mirror with its landing coordinates,
    /// the in-flight half off the staged writes with its authoring
    /// instant; an act in both carries both, either of which names its
    /// rows.
    async fn resolve(&self, conn: &mut PgConnection) -> Result<Vec<ScopeAct>, RemovalError> {
        let landed = mirror::chain_records(conn, self.address, self.family, self.node).await?;
        let staged_acts = staged::chain_acts(conn, self.viewer, self.family, self.node).await?;
        let mut scope: Vec<ScopeAct> = Vec::new();
        for r in landed {
            scope.push(ScopeAct {
                act_id: r.record_id,
                rows: ActRows {
                    order: Some(content_store::LandingOrder {
                        landed_epoch: r.epoch,
                        act_time: r.act_time,
                        position: r.position,
                    }),
                    instant: None,
                },
                carried: false,
            });
        }
        for s in staged_acts {
            match scope.iter_mut().find(|a| a.act_id == s.act_id) {
                Some(known) => known.rows.instant = s.pre_signed_at,
                None => scope.push(ScopeAct {
                    act_id: s.act_id,
                    rows: ActRows {
                        order: None,
                        instant: s.pre_signed_at,
                    },
                    carried: s.state == staged::StagedState::Carried.as_str(),
                }),
            }
        }
        if !self.include_revisions {
            scope.retain(|a| a.act_id == self.record);
        }
        scope.sort_by_key(ScopeAct::rank);
        Ok(scope)
    }
}

/// Whether a family's records are content this verb removes (RM-G4): a
/// post's Publish chain and a comment's Review chain. A Send is a chat
/// message (post-MVP), and a Registration is the person's own profile —
/// removing the admission act would take the handle by the back door.
fn removable(family: Family) -> bool {
    matches!(family, Family::Publish | Family::Review)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Removal reaches posts and comments, and nothing else — a stance, a
    /// chat message, a profile registration answer BAD_INPUT.
    ///
    /// Only a post's or a comment's chain is removable content.
    /// ´claim:removal:only-posts-and-comments-are-removable´
    #[test]
    fn only_a_post_or_a_comment_is_removable_content() {
        assert!(removable(Family::Publish));
        assert!(removable(Family::Review));
        for family in [
            Family::Registration,
            Family::Send,
            Family::Opinion,
            Family::Affinity,
            Family::Tag,
            Family::Reference,
        ] {
            assert!(!removable(family), "{family:?}");
        }
    }
}
