//! Seam + ingestion integration: a signed record submitted through the
//! L1 boundary lands in the mirror once the epoch closes — the slice-0
//! hand test, automated (roadmap.md Slice 0).

use api::l1::{L1Boundary, StandInBoundary};
use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::NodeId;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::mirror;
use sqlx::PgPool;

fn registration(actor: &ActorKey) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq: 0,
            family: Family::Registration,
            middle: None,
            target: NodeId::Prof(actor.address()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: b"profile".to_vec(),
        deps: vec![],
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_record_crosses_the_seam_into_the_mirror(pool: PgPool) {
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let boundary = StandInBoundary(standin.clone());
    let actor = ActorKey::generate();
    standin
        .credit_burn(&actor.address(), 10_000_000)
        .await
        .expect("burn");

    // The write path's two relay legs, through the boundary trait.
    let proposal = registration(&actor);
    let act_id = proposal.body.act_id();
    let pre = actor.pre_sign(proposal);
    let sealed = boundary.seal(pre.clone()).await.expect("seals");
    let host_key = boundary.host_public_key().await.expect("host key");
    let witness = actor.approve(&pre, &sealed, &host_key).expect("approves");
    boundary.approve(witness).await.expect("approved");

    // Nothing to ingest before the epoch closes.
    let landed = api::ingest::ingest_pending(&boundary, &pool)
        .await
        .expect("pass");
    assert_eq!(landed, 0);
    assert_eq!(
        mirror::last_ingested_epoch(&pool).await.expect("cursor"),
        -1
    );

    // Close and ingest: the record lands, the cursor advances.
    standin.close_epoch().await.expect("closes").expect("acts");
    let landed = api::ingest::ingest_pending(&boundary, &pool)
        .await
        .expect("pass");
    assert_eq!(landed, 1);
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 0);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 0).await.expect("ids"),
        vec![act_id.to_string()]
    );

    // A second pass is a no-op — ingestion resumes from the cursor.
    let landed = api::ingest::ingest_pending(&boundary, &pool)
        .await
        .expect("pass");
    assert_eq!(landed, 0);

    // The B_i read through the boundary sees the consummated debit.
    let balance = boundary.balance(&actor.address()).await.expect("balance");
    assert_eq!(balance.action_count, 1);
    assert!(balance.balance < balance.burned_total);
}
