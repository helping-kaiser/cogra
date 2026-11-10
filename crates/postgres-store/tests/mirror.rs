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
    mirror::ingest_epoch(&pool, &package(1, vec![registration("alice", 1, 1)]))
        .await
        .expect("ingests");
    mirror::ingest_epoch(&pool, &package(2, vec![]))
        .await
        .expect("ingests");
    let instants = mirror::epoch_instants(&pool, &[1, 2, 3])
        .await
        .expect("instants");
    assert_eq!(instants.len(), 2);
    assert_eq!(instants[&1], closed_at(1));
    assert_eq!(instants[&2], closed_at(2));
    mirror::reset(&pool).await.expect("reset");
    assert!(
        mirror::epoch_instants(&pool, &[1, 2])
            .await
            .expect("instants")
            .is_empty()
    );
}

/// Ingested epochs run 1..=cursor, so the instant repair finds nothing
/// to do at the empty boundary 0 or over a complete set, and names the
/// oldest epoch whose instant is missing — never the boundary.
///
/// The instant repair searches the ingested epochs 1..=cursor, and nothing at the empty boundary.
/// ´claim:mirror:the-instant-repair-searches-epochs-from-one´
#[sqlx::test(migrations = "../../migrations")]
async fn the_instant_repair_searches_epochs_from_one(pool: PgPool) {
    assert_eq!(
        mirror::first_epoch_without_instant(&pool)
            .await
            .expect("reads"),
        None,
        "nothing ingested, nothing missing"
    );
    for epoch in 1..=3 {
        mirror::ingest_epoch(&pool, &package(epoch, vec![]))
            .await
            .expect("ingests");
    }
    assert_eq!(
        mirror::first_epoch_without_instant(&pool)
            .await
            .expect("reads"),
        None
    );
    sqlx::query("DELETE FROM mirror_epochs WHERE epoch IN (2, 3)")
        .execute(&pool)
        .await
        .expect("the fixture drops two instants");
    assert_eq!(
        mirror::first_epoch_without_instant(&pool)
            .await
            .expect("reads"),
        Some(2)
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
        0,
        "the empty boundary before the first epoch"
    );

    let p1 = package(1, vec![registration("alice", 1, 1)]);
    mirror::ingest_epoch(&pool, &p1).await.expect("ingests");
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 1);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 1).await.expect("ids"),
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
    let p2 = package(2, vec![registration("alice", 2, 1)]);
    let err = mirror::ingest_epoch(&pool, &p2).await.expect_err("refused");
    assert!(matches!(err, MirrorError::OutOfOrder { got: 2, cursor: 0 }));

    let p1 = package(1, vec![registration("alice", 1, 1)]);
    mirror::ingest_epoch(&pool, &p1).await.expect("ingests");
    let err = mirror::ingest_epoch(&pool, &p1).await.expect_err("refused");
    assert!(matches!(err, MirrorError::OutOfOrder { got: 1, cursor: 1 }));
}

/// A package with no order of record (layer1-interface.md §7.2) is
/// refused before anything is written, whatever the cursor: an epoch 0, a
/// position 0, a gap, a repeat, a record placed in another epoch. The
/// cursor stays put and no row lands, so ingestion stops loudly there.
///
/// The mirror refuses an epoch 0, a position outside 1..=n, a gap or a repeat, and writes nothing.
/// ´claim:mirror:a-package-without-an-order-of-record-is-refused´
#[sqlx::test(migrations = "../../migrations")]
async fn a_package_without_an_order_of_record_is_refused(pool: PgPool) {
    let two = |epoch: i64, first: i64, second: i64| {
        let mut bob = registration("bob", epoch, second);
        bob.act_time = 1;
        package(epoch, vec![registration("alice", epoch, first), bob])
    };
    let mut misplaced = two(1, 1, 2);
    misplaced.records[1].epoch = 2;
    for (case, malformed) in [
        ("an epoch 0", package(0, vec![registration("alice", 0, 1)])),
        ("a position 0", two(1, 0, 1)),
        ("a gap", two(1, 1, 3)),
        ("a repeat", two(1, 1, 1)),
        ("a misplaced record", misplaced),
    ] {
        let err = mirror::ingest_epoch(&pool, &malformed)
            .await
            .expect_err(case);
        assert!(matches!(err, MirrorError::Unordered(_)), "{case}: {err:?}");
        assert_eq!(
            mirror::last_ingested_epoch(&pool).await.expect("cursor"),
            0,
            "{case}: the cursor stays"
        );
        let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mirror_records")
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(rows, 0, "{case}: nothing lands");
    }
    mirror::ingest_epoch(&pool, &two(1, 2, 1))
        .await
        .expect("positions 1..=2 in any listed order ingest");
}

/// The mirror's tables hold the numbering too, for a writer that goes
/// around `ingest_epoch`: no epoch 0, no position 0, no repeated
/// (epoch, position), and a cursor never below the empty boundary.
///
/// The mirror's tables refuse an epoch 0, a position 0, a repeat and a cursor below 0.
/// ´claim:mirror:the-tables-refuse-a-numbering-without-an-order-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_mirror_tables_refuse_a_numbering_without_an_order_of_record(pool: PgPool) {
    let insert = |id: &'static str, epoch: i64, position: i64| {
        sqlx::query(
            "INSERT INTO mirror_records
                 (record_id, family, author, epoch, act_time, position,
                  payload_marked, payload_witness)
             VALUES ($1, 'registration', 'alice', $2, 1, $3, FALSE, ''::bytea)",
        )
        .bind(id)
        .bind(epoch)
        .bind(position)
    };
    assert!(insert("a", 0, 1).execute(&pool).await.is_err(), "epoch 0");
    assert!(
        insert("a", 1, 0).execute(&pool).await.is_err(),
        "position 0"
    );
    insert("a", 1, 1)
        .execute(&pool)
        .await
        .expect("1, 1 is fine");
    assert!(insert("b", 1, 1).execute(&pool).await.is_err(), "a repeat");
    assert!(
        sqlx::query("INSERT INTO mirror_epochs (epoch, attested_at) VALUES (0, NOW())")
            .execute(&pool)
            .await
            .is_err(),
        "an epoch 0 instant"
    );
    assert!(
        sqlx::query("UPDATE mirror_epoch_cursor SET last_epoch = -1")
            .execute(&pool)
            .await
            .is_err(),
        "the cursor below the boundary"
    );
}

/// Dropping the mirror and replaying the published sequence restores it record for record.
/// ´claim:mirror:the-mirror-rebuilds-from-the-published-sequence´
#[sqlx::test(migrations = "../../migrations")]
async fn mirror_is_rebuildable_from_the_published_sequence(pool: PgPool) {
    let packages = [
        package(1, vec![registration("alice", 1, 1)]),
        package(2, vec![registration("bob", 2, 1)]),
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
        0,
        "a reset returns the cursor to the empty boundary"
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
