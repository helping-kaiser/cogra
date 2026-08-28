//! The current-references fold against the census table read by hand.
//!
//! Every other test of this fold writes its fixtures through the same
//! code the read side uses — the gesture builder, or `census::leg_params`
//! — so store and fixture agree by construction: a transposition wrong in
//! both halves is wrong identically and passes. This file writes the
//! T-leg rendering straight from layer1-interface.md §9.6's Reference row
//! — T-leg `p_d = e` (support), `p_i = f` (relevance) — with raw inserts
//! and no shared helper, so it fails when the code's reading of the
//! census and the table's own text come apart.
//!
//! Every fixture bundle is asymmetric between the two slots wherever a
//! transposition could hide, and the netted bundle sits at a pair whose
//! records are individually loud: a fold that picked newest-wins, or
//! clipped before summing, serves it as a live citation instead of
//! hiding it.

use postgres_store::references::{self, ReferenceView};
use sqlx::PgPool;

const ARTIFACT: &str = "mint:act:ada:7:publish";
const ZOE: &str = "mint:act:zoe:1:publish";
const CAROL: &str = "mint:act:carol:2:publish";
const BOB: &str = "prof:bob";

/// A stored T-leg beside its record, read back raw: record id, target,
/// `p_d`, `p_i`, author, payload mark. The hand computation reads these
/// columns, not the store's interpretation of them.
type RawLeg = (String, String, f64, f64, String, bool);

/// One Reference record and its terminal leg, written the way the census
/// renders a Reference's T-leg: `p_d` carries support (enthusiasm `e`),
/// `p_i` carries relevance (effort `f`). The T-leg is Tribal, mask
/// `(1,1,1,1)`, tier Full.
///
/// `claim` is the act tuple `(relevance, support)` — what an author
/// picked — so the transposition happens here, in the fixture, exactly
/// once and by hand.
async fn land_reference(
    pool: &PgPool,
    record_id: &str,
    author: &str,
    target: &str,
    claim: (f64, f64),
    epoch: i64,
    payload_marked: bool,
) {
    let (relevance, support) = claim;
    sqlx::query(
        "INSERT INTO mirror_records
             (record_id, family, author, epoch, act_time, position,
              payload_marked, payload_witness)
         VALUES ($1, 'reference', $2, $3, $4, 0, $5, '\\x00'::bytea)",
    )
    .bind(record_id)
    .bind(author)
    .bind(epoch)
    .bind(epoch * 10)
    .bind(payload_marked)
    .execute(pool)
    .await
    .expect("record insert");

    sqlx::query(
        "INSERT INTO mirror_record_legs
             (record_id, leg, source, target, p_d, p_i, domain,
              mask_a00, mask_a01, mask_a10, mask_a11, tier, tau,
              family, epoch, act_time, position)
         VALUES ($1, 't', $2, $3, $4, $5, 'tribal',
                 TRUE, TRUE, TRUE, TRUE, 'full', 0.0,
                 'reference', $6, $7, 0)",
    )
    .bind(record_id)
    .bind(ARTIFACT)
    .bind(target)
    .bind(support)
    .bind(relevance)
    .bind(epoch)
    .bind(epoch * 10)
    .execute(pool)
    .await
    .expect("leg insert");
}

/// Eight Reference records hung off one artifact, each bundle built
/// around one trap.
///
/// - **zoe** — `c1` and `c2` net to a live citation, and `c7` is a
///   payload-marked record loud enough to change the answer if the fold
///   counted it.
/// - **carol** — `c5` and `c6` sum past the census ceiling on one axis
///   only, so clip-then-sum and sum-then-clip disagree.
/// - **bob** — `c3` and its exact counter `c4`: the withdrawal shape.
/// - **c8** is a stranger's citation off ada's artifact, belonging to
///   another bundle entirely.
async fn fixture(pool: &PgPool) {
    land_reference(pool, "c1", "ada", ZOE, (0.40, 0.90), 3, false).await;
    land_reference(pool, "c2", "ada", ZOE, (0.30, -0.50), 4, false).await;
    land_reference(pool, "c3", "ada", BOB, (0.60, 0.50), 2, false).await;
    land_reference(pool, "c4", "ada", BOB, (-0.60, -0.50), 5, false).await;
    land_reference(pool, "c5", "ada", CAROL, (0.80, 0.30), 6, false).await;
    land_reference(pool, "c6", "ada", CAROL, (0.70, 0.25), 7, false).await;
    land_reference(pool, "c7", "ada", ZOE, (0.90, 0.90), 8, true).await;
    land_reference(pool, "c8", "bob", ZOE, (0.95, 0.95), 9, false).await;
}

/// The fold, computed by hand from the fixture and asserted against the
/// store's answer.
///
/// `references_of(artifact, ada)` nets per (author, artifact, target),
/// sums then clips, and drops a bundle that reaches `(0, 0)`:
///
/// - **carol** — `0.80 + 0.70 = 1.50` relevance, clipped to `1.0`;
///   `0.30 + 0.25 = 0.55` support, under the ceiling and left alone.
///   Clipping each record first would give `1.0` on the second axis too.
/// - **zoe** — `0.40 + 0.30 = 0.70` relevance, `0.90 − 0.50 = 0.40`
///   support, over two records. `c7` is payload-marked and enters no
///   bundle; counting it would serve `(1.0, 1.0)`. `c8` is bob's.
/// - **bob** — `0.60 − 0.60 = 0` and `0.50 − 0.50 = 0`: withdrawn, and
///   absent from the view rather than served at zero.
///
/// Ordered by target, that is carol then zoe.
#[sqlx::test(migrations = "../../migrations")]
async fn hand_computed_reference_fold_agrees(pool: PgPool) {
    fixture(&pool).await;

    let raw: Vec<RawLeg> = sqlx::query_as(
        "SELECT r.record_id, l.target, l.p_d, l.p_i, r.author, r.payload_marked
         FROM mirror_record_legs l
         JOIN mirror_records r ON r.record_id = l.record_id
         WHERE l.source = $1 AND l.leg = 't'
         ORDER BY r.record_id",
    )
    .bind(ARTIFACT)
    .fetch_all(&pool)
    .await
    .expect("raw read");
    for row in &raw {
        println!("RAW {row:?}");
    }

    let current = references::references_of(&pool, ARTIFACT, "ada", ReferenceView::Landed)
        .await
        .expect("fold");
    for claim in &current {
        println!("CLAIM {claim:?}");
    }

    let got: Vec<(&str, f64, f64, u32, bool)> = current
        .iter()
        .map(|c| {
            (
                c.target.as_str(),
                c.relevance,
                c.support,
                c.records,
                c.pending,
            )
        })
        .collect();
    assert_eq!(
        got,
        vec![(CAROL, 1.0, 0.55, 2, false), (ZOE, 0.70, 0.40, 2, false),],
        "references_of disagrees with the hand-computed fold"
    );
}

/// The withdrawn bundle's raw sum is still readable, and it is what the
/// withdrawal gesture prices its batch against: `bundle` returns sums
/// before the clip, so a bundle already at zero quotes an empty batch
/// while a live one quotes the walk back.
#[sqlx::test(migrations = "../../migrations")]
async fn the_raw_bundle_sums_match_the_hand_computation(pool: PgPool) {
    fixture(&pool).await;

    let withdrawn = references::bundle(&pool, "ada", ARTIFACT, BOB, ReferenceView::Landed)
        .await
        .expect("bundle");
    assert_eq!((withdrawn.p_d, withdrawn.p_i), (0.0, 0.0));
    assert_eq!(withdrawn.records, 2, "the records stand; the stance nets");
    assert!(
        withdrawn.severance_batch().is_empty(),
        "nothing left to walk back"
    );

    let over = references::bundle(&pool, "ada", ARTIFACT, CAROL, ReferenceView::Landed)
        .await
        .expect("bundle");
    assert_eq!(
        (over.p_d, over.p_i),
        (1.5, 0.55),
        "the raw sum keeps how far past the ceiling the bundle stands"
    );
    assert_eq!(
        over.severance_batch().len(),
        2,
        "a bundle summing past 1 needs more than one record to walk back"
    );
}
