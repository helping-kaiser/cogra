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

/// The instant a fixture epoch closed: a minute per epoch.
fn closed_at(epoch: i64) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(1_850_000_000 + epoch * 60, 0).expect("instant")
}

fn package(epoch: i64, records: Vec<PublishedRecord>) -> EpochPackage {
    EpochPackage {
        epoch,
        attested_at: closed_at(epoch),
        records,
    }
}

/// The mirror keeps each epoch's attested boundary timestamp beside its
/// records, and a rebuild clears it with them (X-SR3).
///
/// An ingested epoch carries its attested boundary timestamp, cleared with the mirror on a rebuild.
/// ´claim:mirror:an-epoch-carries-its-attested-instant´
#[sqlx::test(migrations = "../../migrations")]
async fn an_ingested_epoch_carries_its_attested_instant(pool: PgPool) {
    mirror::ingest_epoch(&pool, &package(0, vec![registration("alice", 0, 0)]))
        .await
        .expect("ingests");
    mirror::ingest_epoch(&pool, &package(1, vec![]))
        .await
        .expect("ingests");
    let instants = mirror::epoch_instants(&pool, &[0, 1, 2])
        .await
        .expect("instants");
    assert_eq!(instants.len(), 2);
    assert_eq!(instants[&0], closed_at(0));
    assert_eq!(instants[&1], closed_at(1));
    mirror::reset(&pool).await.expect("reset");
    assert!(
        mirror::epoch_instants(&pool, &[0, 1])
            .await
            .expect("instants")
            .is_empty()
    );
}

/// Ingesting a package appends its records and advances the cursor, and
/// the leg rows come back carrying the family-fixed census metadata.
///
/// A published package arrives whole: its records, its legs, and each leg's family-fixed census metadata.
/// ´claim:mirror:a-published-package-arrives-whole´
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

/// Only the cursor's successor is accepted: a gap ahead of the cursor and
/// a replay of an already-ingested epoch are refused alike.
///
/// Only the cursor's successor is accepted: a gap ahead of it and a replay behind it are refused alike.
/// ´claim:mirror:only-the-cursors-successor-is-accepted´
#[sqlx::test(migrations = "../../migrations")]
async fn ingestion_is_strictly_sequential(pool: PgPool) {
    let p1 = package(1, vec![registration("alice", 1, 0)]);
    let err = mirror::ingest_epoch(&pool, &p1).await.expect_err("refused");
    assert!(matches!(
        err,
        MirrorError::OutOfOrder { got: 1, cursor: -1 }
    ));

    let p0 = package(0, vec![registration("alice", 0, 0)]);
    mirror::ingest_epoch(&pool, &p0).await.expect("ingests");
    let err = mirror::ingest_epoch(&pool, &p0).await.expect_err("refused");
    assert!(matches!(err, MirrorError::OutOfOrder { got: 0, cursor: 0 }));
}

/// Dropping the mirror and replaying the published sequence restores it record for record.
/// ´claim:mirror:the-mirror-rebuilds-from-the-published-sequence´
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
