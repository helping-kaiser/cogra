//! Mirror-contract integration tests: sequential ingestion under the
//! cursor, the fold-index row shape, and rebuildability from the
//! published sequence.

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::mirror::{self, MirrorError};
use sqlx::PgPool;

fn registration(author: &str, epoch: i64, position: i64) -> PublishedRecord {
    PublishedRecord {
        act_id: ActId::new(author, 0, Family::Registration).expect("ok"),
        author: author.to_string(),
        family: Family::Registration,
        epoch,
        act_time: position + 1,
        position,
        payload_marked: true,
        payload_witness: vec![0xAB; 32],
        legs: vec![PublishedLeg {
            role: LegRole::Binary,
            source: NodeId::Addr(author.to_string()),
            target: NodeId::Prof(author.to_string()),
            p_d: 1.0,
            p_i: 1.0,
            tau: 0.0,
        }],
    }
}

fn package(epoch: i64, records: Vec<PublishedRecord>) -> EpochPackage {
    EpochPackage { epoch, records }
}

#[sqlx::test(migrations = "../../migrations")]
async fn ingestion_appends_and_advances_the_cursor(pool: PgPool) {
    assert_eq!(
        mirror::last_ingested_epoch(&pool).await.expect("cursor"),
        -1
    );

    let p0 = package(0, vec![registration("alice", 0, 0)]);
    mirror::ingest_epoch(&pool, &p0).await.expect("ingests");
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 0);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 0).await.expect("ids"),
        vec!["act:alice:0:registration".to_string()]
    );
    assert!(
        mirror::has_record_by(&pool, "alice", Family::Registration)
            .await
            .expect("gate")
    );
    assert!(
        !mirror::has_record_by(&pool, "alice", Family::Publish)
            .await
            .expect("gate")
    );

    // Leg rows carry the family-fixed census metadata.
    let (domain, tier, mask_a00): (String, String, bool) = sqlx::query_as(
        "SELECT domain, tier, mask_a00 FROM mirror_record_legs WHERE record_id = $1",
    )
    .bind("act:alice:0:registration")
    .fetch_one(&pool)
    .await
    .expect("leg row");
    assert_eq!(domain, "identity");
    assert_eq!(tier, "full");
    assert!(mask_a00);
}

#[sqlx::test(migrations = "../../migrations")]
async fn ingestion_is_strictly_sequential(pool: PgPool) {
    let p1 = package(1, vec![registration("alice", 1, 0)]);
    let err = mirror::ingest_epoch(&pool, &p1).await.expect_err("refused");
    assert!(matches!(
        err,
        MirrorError::OutOfOrder { got: 1, cursor: -1 }
    ));

    // Re-ingesting an already-ingested epoch is refused the same way.
    let p0 = package(0, vec![registration("alice", 0, 0)]);
    mirror::ingest_epoch(&pool, &p0).await.expect("ingests");
    let err = mirror::ingest_epoch(&pool, &p0).await.expect_err("refused");
    assert!(matches!(err, MirrorError::OutOfOrder { got: 0, cursor: 0 }));
}

#[sqlx::test(migrations = "../../migrations")]
async fn mirror_is_rebuildable_from_the_published_sequence(pool: PgPool) {
    let packages = [
        package(0, vec![registration("alice", 0, 0)]),
        package(1, vec![registration("bob", 1, 0)]),
    ];
    for p in &packages {
        mirror::ingest_epoch(&pool, p).await.expect("ingests");
    }
    let before: Vec<String> = sqlx::query_scalar(
        "SELECT record_id || ':' || epoch::text || ':' || position::text
         FROM mirror_records ORDER BY epoch, position",
    )
    .fetch_all(&pool)
    .await
    .expect("rows");

    // Wipe and replay the same published sequence: identical state.
    mirror::reset(&pool).await.expect("reset");
    assert_eq!(
        mirror::last_ingested_epoch(&pool).await.expect("cursor"),
        -1
    );
    for p in &packages {
        mirror::ingest_epoch(&pool, p).await.expect("re-ingests");
    }
    let after: Vec<String> = sqlx::query_scalar(
        "SELECT record_id || ':' || epoch::text || ':' || position::text
         FROM mirror_records ORDER BY epoch, position",
    )
    .fetch_all(&pool)
    .await
    .expect("rows");
    assert_eq!(before, after);
}
