//! Exact decimal netting through the store's own SQL (edges.md §1:
//! "netting is exact decimal arithmetic").
//!
//! The stance read sums `numeric` over each float8's shortest decimal; the
//! ranker folds with common's `BundleSum::of_records`. Both must answer the
//! same bits for the same records in any order — dirty floats and off-grid
//! values included — or a bundle reads severed on one surface and standing
//! on another.

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::fold::BundleSum;
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::mirror;
use postgres_store::stance::{self, BundleView};
use sqlx::PgPool;
use uuid::Uuid;

const AUTHOR: &str = "ada";

/// Lands one Opinion record by ada toward `person`'s Profile, as its own
/// epoch.
async fn land(pool: &PgPool, epoch: i64, seq: u64, person: &str, (p_d, p_i): (f64, f64)) {
    let record = PublishedRecord {
        act_id: ActId::new(AUTHOR, seq, Family::Opinion).expect("valid act id"),
        author: AUTHOR.to_string(),
        family: Family::Opinion,
        epoch,
        act_time: epoch,
        position: 0,
        payload_marked: false,
        payload_witness: vec![0; 32],
        legs: vec![PublishedLeg {
            role: LegRole::Binary,
            source: NodeId::Addr(AUTHOR.to_string()),
            target: NodeId::Prof(person.to_string()),
            p_d,
            p_i,
            tau: 0.0,
        }],
    };
    mirror::ingest_epoch(
        pool,
        &EpochPackage {
            epoch,
            attested_at: chrono::Utc::now(),
            records: vec![record],
        },
    )
    .await
    .expect("ingests");
}

/// Stages one pre-signed Opinion by ada toward `person` that has not landed.
async fn stage(pool: &PgPool, seq: i64, person: &str, (p_d, p_i): (f64, f64)) {
    let actor_id: Uuid = sqlx::query_scalar(
        "INSERT INTO actors (kind, handle) VALUES ('user', $1) RETURNING id",
    )
    .bind(format!("{AUTHOR}-{seq}"))
    .fetch_one(pool)
    .await
    .expect("actor insert");
    sqlx::query(
        "INSERT INTO staged_writes
             (id, actor_id, act_id, author, seq, family, middle, target,
              p_d, p_i, payload, prepared_epoch, state, pre_signed_at)
         VALUES ($1, $2, $3, $4, $5, 'opinion', NULL, $6, $7, $8, ''::bytea, 0,
                 'awaiting_approval', NOW())",
    )
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .bind(format!("act:{AUTHOR}:{seq}:opinion"))
    .bind(AUTHOR)
    .bind(seq)
    .bind(format!("prof:{person}"))
    .bind(p_d)
    .bind(p_i)
    .execute(pool)
    .await
    .expect("stages");
}

async fn read(pool: &PgPool, person: &str, view: BundleView) -> BundleSum {
    stance::bundle(pool, AUTHOR, Family::Opinion, &format!("prof:{person}"), view)
        .await
        .expect("bundle")
}

/// The same records in several orders, each order its own bundle: the
/// store's sums are the exact decimal sum every time, bit for bit equal to
/// the fold the ranker runs — where floating addition would answer
/// differently by order.
///
/// The store's bundle sums are exact and equal the ranker's fold bit for bit, in any order.
/// ´claim:stance:the-store-sums-agree-with-the-fold-in-any-order´
#[sqlx::test(migrations = "../../migrations")]
async fn the_store_sums_agree_with_the_fold_in_any_order(pool: PgPool) {
    let records = [(0.1, 0.7), (0.2, -0.1), (-0.3, 0.3), (0.6, -0.2)];
    let orders = [
        [0, 1, 2, 3],
        [3, 2, 1, 0],
        [2, 0, 3, 1],
        [1, 3, 0, 2],
    ];
    let mut epoch = 0;
    for (k, order) in orders.iter().enumerate() {
        let person = format!("p{k}");
        let picked: Vec<(f64, f64)> = order.iter().map(|&i| records[i]).collect();
        for (seq, pair) in picked.iter().enumerate() {
            land(&pool, epoch, (k * 10 + seq) as u64, &person, *pair).await;
            epoch += 1;
        }
        let stored = read(&pool, &person, BundleView::Landed).await;
        let folded = BundleSum::of_records(picked.iter().copied()).expect("finite");
        assert_eq!(stored.p_d.to_bits(), folded.p_d.to_bits(), "order {order:?}");
        assert_eq!(stored.p_i.to_bits(), folded.p_i.to_bits(), "order {order:?}");
        assert_eq!((stored.p_d, stored.p_i), (0.6, 0.7));
        assert_eq!(stored.records, 4);
    }
}

/// The known-dirty pattern walks back to exact zero through both halves of
/// the bundle — landed 0.1 and 0.2, a pending −0.3 — and the read says
/// severed, as the projection said it would.
///
/// A dirty bundle walked back across the landed and pending halves reads exactly severed.
/// ´claim:stance:a-dirty-walk-back-reads-severed-across-both-halves´
#[sqlx::test(migrations = "../../migrations")]
async fn a_dirty_walk_back_reads_severed_across_both_halves(pool: PgPool) {
    land(&pool, 0, 1, "bob", (0.1, 0.1)).await;
    land(&pool, 1, 2, "bob", (0.2, 0.2)).await;
    let landed = read(&pool, "bob", BundleView::Landed).await;
    assert_eq!((landed.p_d, landed.p_i), (0.3, 0.3), "not 0.30000000000000004");
    assert!(landed.project(-0.3, -0.3).is_severed());

    stage(&pool, 3, "bob", (-0.3, -0.3)).await;
    let with_pending = read(&pool, "bob", BundleView::IncludingPending).await;
    assert_eq!((with_pending.p_d, with_pending.p_i), (0.0, 0.0));
    assert!(with_pending.fold().is_severed());
    assert_eq!(with_pending.records, 3);
    assert_eq!(with_pending.severance_cost(), 0);
}

/// Off-grid values authored before the grid was enforced are held to their
/// last digit: they sum exactly, agree with the fold, and walk back
/// exactly — never rounded onto the grid on the way.
///
/// An off-grid stored value is summed exactly and agrees with the fold.
/// ´claim:stance:an-off-grid-stored-value-sums-exactly´
#[sqlx::test(migrations = "../../migrations")]
async fn an_off_grid_stored_value_sums_exactly(pool: PgPool) {
    let legacy = 0.00047147125005719825;
    land(&pool, 0, 1, "bob", (legacy, 1.0)).await;
    let alone = read(&pool, "bob", BundleView::Landed).await;
    assert_eq!(alone.p_d.to_bits(), legacy.to_bits());
    let batch = alone.severance_batch();
    assert_eq!(batch, vec![(-legacy, -1.0)]);

    land(&pool, 1, 2, "bob", (0.1, 0.0)).await;
    land(&pool, 2, 3, "bob", (-0.37, 0.25)).await;
    let mixed = read(&pool, "bob", BundleView::Landed).await;
    let folded =
        BundleSum::of_records([(legacy, 1.0), (0.1, 0.0), (-0.37, 0.25)]).expect("finite");
    assert_eq!(mixed.p_d.to_bits(), folded.p_d.to_bits());
    assert_eq!(mixed.p_i.to_bits(), folded.p_i.to_bits());
}

/// The store's sums read each float8 through its text, so they are exact
/// only while the session renders floats in their shortest precise form —
/// PostgreSQL's default for any `extra_float_digits` above 0, and sqlx
/// connects at 3. A session that rounded to fifteen digits would merge
/// distinct values; this pins that it does not.
///
/// The store's sessions render a float in its shortest precise decimal, the decimal the exact sums read.
/// ´claim:stance:the-session-renders-floats-shortest-precise´
#[sqlx::test(migrations = "../../migrations")]
async fn the_session_renders_floats_shortest_precise(pool: PgPool) {
    let text: String = sqlx::query_scalar("SELECT 0.4372918374625184::float8::text")
        .fetch_one(&pool)
        .await
        .expect("renders");
    assert_eq!(text, "0.4372918374625184");
    let sum: String = sqlx::query_scalar(
        "SELECT SUM(x::text::numeric)::text
         FROM unnest(ARRAY[0.1, 0.2, -0.3]::float8[]) AS x",
    )
    .fetch_one(&pool)
    .await
    .expect("sums");
    assert_eq!(sum, "0.0", "exact, where SUM(float8) is not");
}
