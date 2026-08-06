// The generic stance gesture (api-spec "The generic stance"): the client
// states the intended net state of its Opinion bundle toward a target;
// the backend derives the delta record and stages it. In slice 1 the
// target is an actor's Profile — the reciprocation completing the
// CoGra-join mutual pair rides exactly this path (invitations.md §2).

use common::l1::census::Family;
use common::l1::identifier::NodeId;
use postgres_store::{PgPool, auth as store, mirror};
use uuid::Uuid;

use crate::l1::L1Boundary;
use crate::prepare::{self, Gesture, PrepareError};

#[derive(Debug, thiserror::Error)]
pub enum StanceError {
    #[error("{message}")]
    BadInput {
        field: &'static str,
        message: String,
    },
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    #[error("internal: {0}")]
    Internal(String),
}

/// Prepares the viewer's stance toward a target actor's Profile as a
/// delta record whose bundle nets to the stated intent.
pub async fn prepare_stance<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    target: Uuid,
    p_d: f64,
    p_i: f64,
) -> Result<prepare::Prepared, StanceError> {
    if !(-1.0..=1.0).contains(&p_d) || !(-1.0..=1.0).contains(&p_i) {
        return Err(StanceError::BadInput {
            field: "pDirected",
            message: "stance parameters must lie in [-1, 1]".into(),
        });
    }
    let author_address = store::actor_identity(pool, viewer)
        .await?
        .and_then(|identity| identity.l0_address)
        .ok_or_else(|| StanceError::Internal("viewer without an attached address".into()))?;
    // A keyless account (an applicant before its ceremony) has no
    // Profile on the graph to point at — the same refusal as an unknown
    // id.
    let target_address = store::actor_identity(pool, target)
        .await?
        .and_then(|identity| identity.l0_address)
        .ok_or(StanceError::BadInput {
            field: "target",
            message: "target is not a known actor".into(),
        })?;

    // The delta the bundle needs to net to the intent. Slice 1 authors
    // stances only toward fresh pairs (the reciprocation), where the
    // current net is zero; a delta outside the parameter range would
    // need more than one record and is refused until the netting rule
    // is specified for that case.
    let (net_d, net_i) = mirror::net_opinion(
        pool,
        &NodeId::Addr(author_address.clone()).to_string(),
        &NodeId::Prof(target_address.clone()).to_string(),
    )
    .await
    .map_err(|e| StanceError::Internal(e.to_string()))?;
    let delta_d = p_d - net_d;
    let delta_i = p_i - net_i;
    if delta_d == 0.0 && delta_i == 0.0 {
        return Err(StanceError::BadInput {
            field: "pDirected",
            message: "the bundle already nets to the intended state".into(),
        });
    }
    if !(-1.0..=1.0).contains(&delta_d) || !(-1.0..=1.0).contains(&delta_i) {
        return Err(StanceError::BadInput {
            field: "pDirected",
            message: "intent is out of one record's reach from the current net".into(),
        });
    }

    Ok(prepare::prepare(
        boundary,
        pool,
        gc_after_epochs,
        viewer,
        Gesture {
            author: author_address,
            family: Family::Opinion,
            middle: None,
            target: NodeId::Prof(target_address),
            p_d: delta_d,
            p_i: delta_i,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: vec![],
        },
    )
    .await?)
}
