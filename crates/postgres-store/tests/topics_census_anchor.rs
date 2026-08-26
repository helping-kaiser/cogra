//! The current-topics fold against the census table read by hand.
//!
//! tests/topics.rs renders its fixtures through `census::leg_params`, so
//! store and fixture agree by construction: a transposition wrong in
//! `leg_params` itself would be wrong identically on both sides and
//! pass. This file writes the T-leg rendering straight from
//! layer1-interface.md §9.6 — `p_d` confidence, `p_i` relevance — with
//! raw inserts and no shared helper, so it fails when the code's reading
//! of the census and the table's own text come apart.
//!
//! Every fixture value differs between the two slots, and the withdrawn
//! bundle sits at `(r, c) = (0, 0.8)`: a transposed read would serve it
//! as a live claim at relevance 0.8 instead of hiding it.

use postgres_store::topics::{self, TagChannel, TopicView};
use sqlx::PgPool;

const NODE: &str = "mint:act:ada:7:publish";

/// One Tag record and its terminal leg, written the way the census
/// renders a Tag's T-leg: `p_d` carries confidence, `p_i` carries
/// relevance.
#[allow(clippy::too_many_arguments)]
async fn land_tag(
    pool: &PgPool,
    record_id: &str,
    author: &str,
    name: &str,
    relevance: f64,
    confidence: f64,
    epoch: i64,
    act_time: i64,
    position: i64,
    payload_marked: bool,
) {
    sqlx::query(
        "INSERT INTO mirror_records
             (record_id, family, author, epoch, act_time, position,
              payload_marked, payload_witness)
         VALUES ($1, 'tag', $2, $3, $4, $5, $6, '\\x00'::bytea)",
    )
    .bind(record_id)
    .bind(author)
    .bind(epoch)
    .bind(act_time)
    .bind(position)
    .bind(payload_marked)
    .execute(pool)
    .await
    .expect("record insert");

    sqlx::query(
        "INSERT INTO mirror_record_legs
             (record_id, leg, source, target, p_d, p_i, domain,
              mask_a00, mask_a01, mask_a10, mask_a11, tier, tau,
              family, epoch, act_time, position)
         VALUES ($1, 't', $2, $3, $4, $5, 'epistemic',
                 FALSE, TRUE, FALSE, TRUE, 'marginal', 0.0,
                 'tag', $6, $7, $8)",
    )
    .bind(record_id)
    .bind(NODE)
    .bind(format!("name:{name}"))
    .bind(confidence)
    .bind(relevance)
    .bind(epoch)
    .bind(act_time)
    .bind(position)
    .execute(pool)
    .await
    .expect("leg insert");
}

/// Seven Tag records on one post, each bundle built around one trap.
///
/// - **cryptography** — `r1` and `r2` sit in one epoch at one act_time,
///   so only position separates them, and `r7` is the verdict mark:
///   `(0, 0)` + payload, newest of everything, and no candidate at all.
/// - **gardening** — `r4` withdraws at relevance 0 from a later epoch
///   but a far smaller act_time, so an act_time-first ordering
///   resurrects the withdrawn `r3`.
/// - **chess** — `r5` is ada's own claim, `r6` a stranger's louder one
///   on the same content.
async fn fixture(pool: &PgPool) {
    land_tag(pool, "r1", "ada", "cryptography", 0.40, 0.90, 3, 100, 0, false).await;
    land_tag(pool, "r2", "ada", "cryptography", -0.75, 0.25, 3, 100, 5, false).await;
    land_tag(pool, "r3", "ada", "gardening", 0.60, 0.30, 2, 500, 9, false).await;
    land_tag(pool, "r4", "ada", "gardening", 0.0, 0.80, 5, 1, 0, false).await;
    land_tag(pool, "r5", "ada", "chess", 0.15, 1.00, 4, 7, 2, false).await;
    land_tag(pool, "r6", "bob", "chess", 0.95, 0.50, 6, 9, 1, false).await;
    land_tag(pool, "r7", "ada", "cryptography", 0.0, 0.0, 7, 900, 0, true).await;
}

/// The fold, computed by hand from the fixture and asserted against the
/// store's answer.
///
/// `topics_of(post, ada)`: cryptography's candidates are `r1` and `r2`,
/// and `r2` wins on position — relevance −0.75, so the claim stands;
/// gardening's are `r3` and `r4`, and `r4` wins because epoch is the
/// outermost key — relevance 0, so the bundle is hidden; chess has only
/// `r5`, bob's `r6` belonging to another bundle. Ordered by target, that
/// is chess then cryptography.
///
/// `tagged_with(chess)`: the middle names its genesis act, so the
/// content's author is `ada` — the author-owned channel admits `r5`
/// alone, and the open channel adds `r6` ahead of it on epoch. Gardening
/// answers with nothing, its withdrawal being a record rather than an
/// erasure.
#[sqlx::test(migrations = "../../migrations")]
async fn hand_computed_fold_agrees(pool: PgPool) {
    fixture(&pool).await;

    let raw: Vec<(String, String, f64, f64, i64, i64, i64, bool)> = sqlx::query_as(
        "SELECT r.record_id, l.target, l.p_d, l.p_i, r.epoch, r.act_time,
                r.position, r.payload_marked
         FROM mirror_record_legs l
         JOIN mirror_records r ON r.record_id = l.record_id
         WHERE l.source = $1
         ORDER BY r.record_id",
    )
    .bind(NODE)
    .fetch_all(&pool)
    .await
    .expect("raw read");
    for row in &raw {
        println!("RAW {row:?}");
    }

    let current = topics::topics_of(&pool, NODE, "ada", TopicView::Landed)
        .await
        .expect("fold");
    for claim in &current {
        println!("CLAIM {claim:?}");
    }

    let got: Vec<(&str, f64, f64, bool)> = current
        .iter()
        .map(|c| (c.name.as_str(), c.relevance, c.confidence, c.pending))
        .collect();
    assert_eq!(
        got,
        vec![
            ("chess", 0.15, 1.00, false),
            ("cryptography", -0.75, 0.25, false),
        ],
        "topics_of disagrees with the hand-computed fold"
    );

    let owned = topics::tagged_with(&pool, "chess", TagChannel::AuthorOwned, TopicView::Landed, 10)
        .await
        .expect("author-owned");
    println!("AUTHOR-OWNED {owned:?}");
    assert_eq!(owned.len(), 1, "only the author's own claim is intrinsic");
    assert_eq!(owned[0].author, "ada");
    assert_eq!(owned[0].relevance, 0.15);
    assert_eq!(owned[0].confidence, 1.00);

    let any = topics::tagged_with(&pool, "chess", TagChannel::AnyAuthor, TopicView::Landed, 10)
        .await
        .expect("any author");
    println!("ANY-AUTHOR {any:?}");
    assert_eq!(
        any.iter()
            .map(|n| (n.author.as_str(), n.relevance))
            .collect::<Vec<_>>(),
        vec![("bob", 0.95), ("ada", 0.15)]
    );

    let gardening = topics::tagged_with(
        &pool,
        "gardening",
        TagChannel::AuthorOwned,
        TopicView::Landed,
        10,
    )
    .await
    .expect("gardening");
    assert!(gardening.is_empty(), "a withdrawn claim surfaces nowhere");
}
