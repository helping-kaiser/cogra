//! The current-topics fold (hashtag.md §4) and the naming-service
//! registry, against a live schema.
//!
//! Fixtures render Tag legs through `census::leg_params`, exactly as the
//! seal does, so the transposition the census specifies is present in the
//! stored rows rather than assumed by the assertions.

use common::hashtag::canonicalize;
use common::l1::Family;
use common::l1::census::{LegRole, leg_params};
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::topics::{TagChannel, TopicView};
use postgres_store::{hashtag, mirror, topics};
use sqlx::PgPool;
use uuid::Uuid;

/// A content node authored by `author` — a minted node names its genesis
/// act, which is what makes the content's author readable from its id.
fn content_of(author: &str, seq: u64) -> NodeId {
    NodeId::Mint(ActId::new(author, seq, Family::Publish).expect("valid act id"))
}

/// One Tag act as the seal renders it: an A-leg into the middle carrying
/// the tuple directly, and a T-leg out of it carrying it transposed.
#[allow(clippy::too_many_arguments)]
fn tag(
    author: &str,
    seq: u64,
    content: &NodeId,
    name: &str,
    relevance: f64,
    confidence: f64,
    epoch: i64,
    act_time: i64,
    position: i64,
) -> PublishedRecord {
    let (a_pd, a_pi) = leg_params(LegRole::A, relevance, confidence);
    let (t_pd, t_pi) = leg_params(LegRole::T, relevance, confidence);
    PublishedRecord {
        act_id: ActId::new(author, seq, Family::Tag).expect("valid act id"),
        author: author.to_string(),
        family: Family::Tag,
        epoch,
        act_time,
        position,
        payload_marked: false,
        payload_witness: vec![0; 32],
        legs: vec![
            PublishedLeg {
                role: LegRole::A,
                source: NodeId::Addr(author.to_string()),
                target: content.clone(),
                p_d: a_pd,
                p_i: a_pi,
                tau: 0.0,
            },
            PublishedLeg {
                role: LegRole::T,
                source: content.clone(),
                target: NodeId::name(name).expect("valid type name"),
                p_d: t_pd,
                p_i: t_pi,
                tau: 0.0,
            },
        ],
    }
}

/// Lands one epoch holding the given records. Epochs are ingested in
/// order, so `epoch` doubles as the call index.
async fn land(pool: &PgPool, epoch: i64, records: Vec<PublishedRecord>) {
    mirror::ingest_epoch(pool, &EpochPackage { epoch, records })
        .await
        .expect("ingests");
}

/// Stages a Tag act that has been pre-signed but has not landed. The
/// staged row carries the act tuple itself, not a leg rendering — the
/// opposite column order from the landed T-leg.
async fn stage_tag(
    pool: &PgPool,
    author: &str,
    seq: i64,
    content: &NodeId,
    name: &str,
    relevance: f64,
    confidence: f64,
) {
    let actor_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM actors WHERE handle = $1 AND kind = 'user'")
            .bind(author)
            .fetch_optional(pool)
            .await
            .expect("actor lookup");
    let actor_id = match actor_id {
        Some(id) => id,
        None => {
            sqlx::query_scalar("INSERT INTO actors (kind, handle) VALUES ('user', $1) RETURNING id")
                .bind(author)
                .fetch_one(pool)
                .await
                .expect("actor insert")
        }
    };
    sqlx::query(
        "INSERT INTO staged_writes
             (id, actor_id, act_id, author, seq, family, middle, target,
              p_d, p_i, payload, prepared_epoch, state, pre_signed_at)
         VALUES ($1, $2, $3, $4, $5, 'tag', $6, $7, $8, $9, ''::bytea, 0,
                 'awaiting_approval', NOW() + ($5 || ' seconds')::interval)",
    )
    .bind(Uuid::new_v4())
    .bind(actor_id)
    .bind(format!("act:{author}:{seq}:tag"))
    .bind(author)
    .bind(seq)
    .bind(content.to_string())
    .bind(NodeId::name(name).expect("valid type name").to_string())
    .bind(relevance)
    .bind(confidence)
    .execute(pool)
    .await
    .expect("stages");
}

fn names(claims: &[topics::TopicClaim]) -> Vec<&str> {
    claims.iter().map(|c| c.name.as_str()).collect()
}

/// Several claims about the same (author, content, Type) bundle: only the
/// newest is the author's current claim, and the earlier ones are history.
#[sqlx::test(migrations = "../../migrations")]
async fn newest_wins_within_a_bundle(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![tag("alice", 0, &post, "rust", 0.2, 0.5, 0, 10, 0)],
    )
    .await;
    land(
        &pool,
        1,
        vec![tag("alice", 1, &post, "rust", 0.9, 0.8, 1, 20, 0)],
    )
    .await;

    let current = topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
        .await
        .expect("folds");
    assert_eq!(current.len(), 1);
    assert_eq!(current[0].name, "rust");
    assert_eq!(current[0].relevance, 0.9);
    assert_eq!(current[0].confidence, 0.8);
    assert!(!current[0].pending);
}

/// Inside one epoch the causal key orders the bundle: act_time decides
/// first, and position breaks a tie at equal act_time.
#[sqlx::test(migrations = "../../migrations")]
async fn within_one_epoch_the_causal_key_decides(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![
            tag("alice", 0, &post, "rust", 0.1, 0.1, 0, 5, 0),
            tag("alice", 1, &post, "rust", 0.7, 0.2, 0, 9, 0),
            tag("alice", 2, &post, "rust", 0.4, 0.3, 0, 5, 1),
        ],
    )
    .await;

    let current = topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
        .await
        .expect("folds");
    assert_eq!(current.len(), 1);
    assert_eq!(current[0].relevance, 0.7, "highest act_time is newest");

    land(
        &pool,
        1,
        vec![
            tag("alice", 3, &post, "ferris", 0.2, 0.4, 1, 7, 0),
            tag("alice", 4, &post, "ferris", 0.6, 0.4, 1, 7, 3),
        ],
    )
    .await;
    let current = topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
        .await
        .expect("folds");
    let ferris = current
        .iter()
        .find(|c| c.name == "ferris")
        .expect("present");
    assert_eq!(ferris.relevance, 0.6, "highest position is newest");
}

/// The un-tag is a further Tag at relevance 0, held at full confidence. It
/// is an ordinary record: the earlier claim becomes history rather than
/// being erased, so both acts keep both legs on the graph.
#[sqlx::test(migrations = "../../migrations")]
async fn relevance_zero_withdraws_the_pair(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![tag("alice", 0, &post, "rust", 0.8, 1.0, 0, 1, 0)],
    )
    .await;
    assert_eq!(
        names(
            &topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
                .await
                .expect("folds")
        ),
        vec!["rust"]
    );

    land(
        &pool,
        1,
        vec![tag("alice", 1, &post, "rust", 0.0, 1.0, 1, 2, 0)],
    )
    .await;
    assert!(
        topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
            .await
            .expect("folds")
            .is_empty(),
        "relevance 0 reads as withdrawn"
    );

    let records: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM mirror_record_legs WHERE family = 'tag'")
            .fetch_one(&pool)
            .await
            .expect("count");
    assert_eq!(records, 4, "both acts keep both legs — nothing is erased");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_topic_can_be_reclaimed_after_withdrawal(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![tag("alice", 0, &post, "rust", 0.8, 0.9, 0, 1, 0)],
    )
    .await;
    land(
        &pool,
        1,
        vec![tag("alice", 1, &post, "rust", 0.0, 0.9, 1, 2, 0)],
    )
    .await;
    land(
        &pool,
        2,
        vec![tag("alice", 2, &post, "rust", 0.3, 0.7, 2, 3, 0)],
    )
    .await;

    let current = topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
        .await
        .expect("folds");
    assert_eq!(current.len(), 1);
    assert_eq!(current[0].relevance, 0.3);
    assert_eq!(current[0].confidence, 0.7);
}

/// Each Type is its own bundle, so withdrawing one leaves the other
/// standing.
#[sqlx::test(migrations = "../../migrations")]
async fn each_type_folds_in_its_own_bundle(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![
            tag("alice", 0, &post, "rust", 0.5, 0.9, 0, 1, 0),
            tag("alice", 1, &post, "ferris", 0.4, 0.8, 0, 2, 0),
        ],
    )
    .await;
    land(
        &pool,
        1,
        vec![tag("alice", 2, &post, "rust", 0.0, 0.9, 1, 3, 0)],
    )
    .await;

    assert_eq!(
        names(
            &topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
                .await
                .expect("folds")
        ),
        vec!["ferris"]
    );
}

/// The census renders the T-leg with the tuple transposed, so relevance is
/// the T-leg's `p_i` and confidence its `p_d`. Reading the columns the
/// other way round would swap every claim's two parameters, and the
/// fixtures here are asymmetric so that the swap changes the *answer*, not
/// just the numbers.
///
/// The raw leg row is asserted on too, so the test fails if the *fixture*
/// stops matching the census rather than only if the fold does.
///
/// Two cases pin the direction. A withdrawal held at full confidence
/// (r = 0, c = 1) must withdraw: read from the wrong column its winner
/// looks like relevance 1 and the topic would wrongly stay on the chip
/// row. Its mirror image, a claim at full relevance held at zero
/// confidence, is still a claim: read from the wrong column it would
/// vanish.
#[sqlx::test(migrations = "../../migrations")]
async fn relevance_is_read_from_the_transposed_leg(pool: PgPool) {
    let post = content_of("alice", 0);

    land(
        &pool,
        0,
        vec![tag("alice", 0, &post, "rust", 0.25, 0.75, 0, 1, 0)],
    )
    .await;
    let current = topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
        .await
        .expect("folds");
    assert_eq!(current[0].relevance, 0.25);
    assert_eq!(current[0].confidence, 0.75);

    let (t_pd, t_pi): (f64, f64) = sqlx::query_as(
        "SELECT p_d, p_i FROM mirror_record_legs
         WHERE leg = 't' AND record_id = 'act:alice:0:tag'",
    )
    .fetch_one(&pool)
    .await
    .expect("leg row");
    assert_eq!((t_pd, t_pi), (0.75, 0.25), "T-leg carries (c, r)");

    land(
        &pool,
        1,
        vec![tag("alice", 1, &post, "rust", 0.0, 1.0, 1, 2, 0)],
    )
    .await;
    assert!(
        topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
            .await
            .expect("folds")
            .is_empty(),
        "an un-tag at full confidence must withdraw, not survive"
    );

    let other = content_of("alice", 1);
    land(
        &pool,
        2,
        vec![tag("alice", 2, &other, "rust", 1.0, 0.0, 2, 3, 0)],
    )
    .await;
    let current = topics::topics_of(&pool, &other.to_string(), "alice", TopicView::Landed)
        .await
        .expect("folds");
    assert_eq!(current.len(), 1, "zero confidence is not a withdrawal");
    assert_eq!(current[0].relevance, 1.0);
    assert_eq!(current[0].confidence, 0.0);
}

/// The staged row carries the act tuple and the landed leg carries it
/// transposed — the same claim in opposite columns, so a fold that reads
/// one rule for both halves gets exactly one of them wrong. A staged
/// withdrawal at full confidence withdraws just as a landed one does.
#[sqlx::test(migrations = "../../migrations")]
async fn a_staged_claim_is_not_transposed(pool: PgPool) {
    let post = content_of("alice", 0);
    stage_tag(&pool, "alice", 0, &post, "rust", 0.25, 0.75).await;

    let current = topics::topics_of(
        &pool,
        &post.to_string(),
        "alice",
        TopicView::IncludingPending { actor: "alice" },
    )
    .await
    .expect("folds");
    assert_eq!(current.len(), 1);
    assert_eq!(current[0].relevance, 0.25);
    assert_eq!(current[0].confidence, 0.75);
    assert!(current[0].pending);

    let other = content_of("alice", 1);
    stage_tag(&pool, "alice", 1, &other, "rust", 0.0, 1.0).await;
    assert!(
        topics::topics_of(
            &pool,
            &other.to_string(),
            "alice",
            TopicView::IncludingPending { actor: "alice" }
        )
        .await
        .expect("folds")
        .is_empty()
    );
}

/// D8: with no ranker in the tree a third party's claim cannot be gated at
/// the viewer's forward-path weight, so this slice reads only the
/// content-intrinsic channel. A stranger's claim is still on the graph and
/// readable through its own author — it is scoped out, not erased.
#[sqlx::test(migrations = "../../migrations")]
async fn a_chip_row_shows_only_the_content_authors_own_tags(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![
            tag("alice", 0, &post, "rust", 0.5, 0.9, 0, 1, 0),
            tag("mallory", 0, &post, "spam", 0.9, 1.0, 0, 2, 0),
        ],
    )
    .await;

    assert_eq!(
        names(
            &topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
                .await
                .expect("folds")
        ),
        vec!["rust"],
        "a stranger's claim is not the author's"
    );
    assert_eq!(
        names(
            &topics::topics_of(&pool, &post.to_string(), "mallory", TopicView::Landed)
                .await
                .expect("folds")
        ),
        vec!["spam"]
    );
}

/// One author's withdrawal leaves another's claim standing: folding across
/// authors would let one author's un-tag hide another's claim.
#[sqlx::test(migrations = "../../migrations")]
async fn bundles_of_different_authors_do_not_fold_together(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![
            tag("alice", 0, &post, "rust", 0.5, 0.9, 0, 1, 0),
            tag("bob", 0, &post, "rust", 0.7, 0.9, 0, 2, 0),
        ],
    )
    .await;
    land(
        &pool,
        1,
        vec![tag("bob", 1, &post, "rust", 0.0, 0.9, 1, 3, 0)],
    )
    .await;

    assert_eq!(
        topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
            .await
            .expect("folds")
            .len(),
        1
    );
    assert!(
        topics::topics_of(&pool, &post.to_string(), "bob", TopicView::Landed)
            .await
            .expect("folds")
            .is_empty()
    );
}

/// The author-owned channel admits only content-intrinsic claims — an
/// author tagging their own post — and drops a third party's tag of
/// someone else's. The any-author channel is the union of both, and the
/// page reads the same transposed leg the chip row does.
#[sqlx::test(migrations = "../../migrations")]
async fn the_topic_page_gates_third_party_claims(pool: PgPool) {
    let alices = content_of("alice", 0);
    let bobs = content_of("bob", 0);
    land(
        &pool,
        0,
        vec![
            tag("alice", 0, &alices, "rust", 0.5, 0.9, 0, 1, 0),
            tag("mallory", 0, &bobs, "rust", 0.9, 1.0, 0, 2, 0),
        ],
    )
    .await;

    let owned = topics::tagged_with(
        &pool,
        "rust",
        TagChannel::AuthorOwned,
        TopicView::Landed,
        50,
    )
    .await
    .expect("folds");
    assert_eq!(owned.len(), 1);
    assert_eq!(owned[0].node, alices.to_string());
    assert_eq!(owned[0].author, "alice");
    assert_eq!(owned[0].relevance, 0.5);
    assert_eq!(owned[0].confidence, 0.9);

    let all = topics::tagged_with(&pool, "rust", TagChannel::AnyAuthor, TopicView::Landed, 50)
        .await
        .expect("folds");
    assert_eq!(all.len(), 2, "the union is the documented fold");
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_topic_page_folds_and_orders_newest_first(pool: PgPool) {
    let first = content_of("alice", 0);
    let second = content_of("bob", 0);
    let withdrawn = content_of("carol", 0);
    land(
        &pool,
        0,
        vec![
            tag("alice", 0, &first, "rust", 0.5, 0.9, 0, 1, 0),
            tag("carol", 0, &withdrawn, "rust", 0.6, 0.9, 0, 2, 0),
        ],
    )
    .await;
    land(
        &pool,
        1,
        vec![
            tag("bob", 0, &second, "rust", 0.4, 0.8, 1, 5, 0),
            tag("carol", 1, &withdrawn, "rust", 0.0, 0.9, 1, 6, 0),
        ],
    )
    .await;

    let listed = topics::tagged_with(
        &pool,
        "rust",
        TagChannel::AuthorOwned,
        TopicView::Landed,
        50,
    )
    .await
    .expect("folds");
    let nodes: Vec<&str> = listed.iter().map(|t| t.node.as_str()).collect();
    assert_eq!(
        nodes,
        vec![second.to_string(), first.to_string()],
        "newest claim first, the withdrawn bundle absent"
    );

    let limited = topics::tagged_with(&pool, "rust", TagChannel::AuthorOwned, TopicView::Landed, 1)
        .await
        .expect("folds");
    assert_eq!(limited.len(), 1);
    assert_eq!(limited[0].node, second.to_string());
}

/// The same guard as the chip row, at the other read direction: a
/// withdrawal held at full confidence must drop the node, and a claim held
/// at zero confidence must keep it. Swapping the two columns inverts both.
#[sqlx::test(migrations = "../../migrations")]
async fn the_topic_page_reads_relevance_from_the_transposed_leg(pool: PgPool) {
    let withdrawn = content_of("alice", 0);
    let kept = content_of("bob", 0);
    land(
        &pool,
        0,
        vec![tag("alice", 0, &withdrawn, "rust", 0.6, 0.9, 0, 1, 0)],
    )
    .await;
    land(
        &pool,
        1,
        vec![
            tag("alice", 1, &withdrawn, "rust", 0.0, 1.0, 1, 2, 0),
            tag("bob", 0, &kept, "rust", 1.0, 0.0, 1, 3, 0),
        ],
    )
    .await;

    let listed = topics::tagged_with(
        &pool,
        "rust",
        TagChannel::AuthorOwned,
        TopicView::Landed,
        50,
    )
    .await
    .expect("folds");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].node, kept.to_string());
    assert_eq!(listed[0].relevance, 1.0);
    assert_eq!(listed[0].confidence, 0.0);
}

/// An unlanded act is not on the graph, so only the L2 view counts it —
/// and only for its own author. Another actor's in-flight act is nobody
/// else's to see.
#[sqlx::test(migrations = "../../migrations")]
async fn pending_claims_are_counted_only_in_the_l2_view(pool: PgPool) {
    let post = content_of("alice", 0);
    stage_tag(&pool, "alice", 0, &post, "rust", 0.5, 0.9).await;

    assert!(
        topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
            .await
            .expect("folds")
            .is_empty(),
        "an unlanded act is not on the graph"
    );
    assert_eq!(
        names(
            &topics::topics_of(
                &pool,
                &post.to_string(),
                "alice",
                TopicView::IncludingPending { actor: "alice" }
            )
            .await
            .expect("folds")
        ),
        vec!["rust"]
    );
    assert!(
        topics::topics_of(
            &pool,
            &post.to_string(),
            "alice",
            TopicView::IncludingPending { actor: "bob" }
        )
        .await
        .expect("folds")
        .is_empty()
    );
}

/// A withdrawal still in flight supersedes the landed claim it replaces
/// for its own author: L1 still shows the claim, L2 does not.
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_claim_supersedes_a_landed_one(pool: PgPool) {
    let post = content_of("alice", 0);
    land(
        &pool,
        0,
        vec![tag("alice", 0, &post, "rust", 0.8, 0.9, 0, 1, 0)],
    )
    .await;
    stage_tag(&pool, "alice", 1, &post, "rust", 0.0, 0.9).await;

    assert_eq!(
        topics::topics_of(&pool, &post.to_string(), "alice", TopicView::Landed)
            .await
            .expect("folds")
            .len(),
        1
    );
    assert!(
        topics::topics_of(
            &pool,
            &post.to_string(),
            "alice",
            TopicView::IncludingPending { actor: "alice" }
        )
        .await
        .expect("folds")
        .is_empty()
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_topic_page_takes_the_same_pending_split(pool: PgPool) {
    let post = content_of("alice", 0);
    stage_tag(&pool, "alice", 0, &post, "rust", 0.5, 0.9).await;

    assert!(
        topics::tagged_with(
            &pool,
            "rust",
            TagChannel::AuthorOwned,
            TopicView::Landed,
            50
        )
        .await
        .expect("folds")
        .is_empty()
    );
    let pending = topics::tagged_with(
        &pool,
        "rust",
        TagChannel::AuthorOwned,
        TopicView::IncludingPending { actor: "alice" },
        50,
    )
    .await
    .expect("folds");
    assert_eq!(pending.len(), 1);
    assert!(pending[0].pending);
}

/// No viewer, no pending half: an anonymous read cannot see anyone's acts
/// in flight, so asking for them without a viewer falls back to the landed
/// view.
#[sqlx::test(migrations = "../../migrations")]
async fn include_pending_needs_a_viewer(pool: PgPool) {
    let post = content_of("alice", 0);
    stage_tag(&pool, "alice", 0, &post, "rust", 0.5, 0.9).await;

    let view = TopicView::from_include_pending(true, None);
    assert_eq!(view, TopicView::Landed);
    assert!(
        topics::topics_of(&pool, &post.to_string(), "alice", view)
            .await
            .expect("folds")
            .is_empty()
    );
    assert_eq!(
        TopicView::from_include_pending(true, Some("alice")),
        TopicView::IncludingPending { actor: "alice" }
    );
    assert_eq!(
        TopicView::from_include_pending(false, Some("alice")),
        TopicView::Landed
    );
}

/// The Moderator's verdict is a Tag at (0, 0) carrying its payload. It
/// declares no topic, so folds must read it individually rather than
/// through the topic surface.
#[sqlx::test(migrations = "../../migrations")]
async fn verdict_marks_are_not_topics(pool: PgPool) {
    let post = content_of("alice", 0);
    let mut verdict = tag("moderator", 0, &post, "illegal", 0.0, 0.0, 0, 1, 0);
    verdict.payload_marked = true;
    land(&pool, 0, vec![verdict]).await;

    assert!(
        topics::topics_of(&pool, &post.to_string(), "moderator", TopicView::Landed)
            .await
            .expect("folds")
            .is_empty()
    );
    assert!(
        topics::tagged_with(
            &pool,
            "illegal",
            TagChannel::AnyAuthor,
            TopicView::Landed,
            50
        )
        .await
        .expect("folds")
        .is_empty()
    );
}

/// The verdict is excluded from the bundle entirely, so it cannot win the
/// newest-wins pick and withdraw the author's own standing claim.
#[sqlx::test(migrations = "../../migrations")]
async fn a_verdict_mark_does_not_hide_a_real_claim(pool: PgPool) {
    let post = content_of("moderator", 0);
    land(
        &pool,
        0,
        vec![tag("moderator", 0, &post, "rust", 0.5, 0.9, 0, 1, 0)],
    )
    .await;
    let mut verdict = tag("moderator", 1, &post, "rust", 0.0, 0.0, 1, 2, 0);
    verdict.payload_marked = true;
    land(&pool, 1, vec![verdict]).await;

    let current = topics::topics_of(&pool, &post.to_string(), "moderator", TopicView::Landed)
        .await
        .expect("folds");
    assert_eq!(current.len(), 1);
    assert_eq!(current[0].relevance, 0.5);
}

/// Seeds enough tag legs that the planner has a real choice to make: a
/// handful of rows is always a sequential scan, whatever the indexes say.
async fn seed_bulk_tags(pool: &PgPool) {
    sqlx::query(
        "INSERT INTO mirror_records
             (record_id, family, author, epoch, act_time, position,
              payload_marked, payload_witness)
         SELECT 'act:a' || (i % 400) || ':' || i || ':tag', 'tag',
                'a' || (i % 400), i / 100, i, i % 100, FALSE, ''::bytea
         FROM generate_series(1, 20000) AS i",
    )
    .execute(pool)
    .await
    .expect("seeds records");
    sqlx::query(
        "INSERT INTO mirror_record_legs
             (record_id, leg, source, target, p_d, p_i, domain,
              mask_a00, mask_a01, mask_a10, mask_a11, tier, tau,
              family, epoch, act_time, position)
         SELECT 'act:a' || (i % 400) || ':' || i || ':tag', 't',
                'mint:act:a' || (i % 400) || ':' || (i % 500) || ':publish',
                'name:t' || (i % 50), 0.5, 0.5, 'epistemic',
                FALSE, TRUE, FALSE, TRUE, 'marginal', 0.0,
                'tag', i / 100, i, i % 100
         FROM generate_series(1, 20000) AS i",
    )
    .execute(pool)
    .await
    .expect("seeds legs");
    sqlx::query("ANALYZE mirror_records, mirror_record_legs")
        .execute(pool)
        .await
        .expect("analyzes");
}

async fn plan_of(pool: &PgPool, sql: &str) -> String {
    let rows: Vec<String> = sqlx::query_scalar(&format!("EXPLAIN {sql}"))
        .fetch_all(pool)
        .await
        .expect("explains");
    rows.join("\n")
}

/// The mirror's existing indexes are expected to serve both read
/// directions with no migration of this slice's own, and this test is that
/// expectation's oracle: it explains the access path each query's
/// candidates CTE takes — the part index choice actually turns on — and
/// fails if the planner falls back to scanning the leg table.
///
/// The chip-row direction reads legs out of one content node, where
/// `mirror_legs_bundle_idx` (source, family, target) is the prefix match;
/// the topic-page direction reads legs into one Type, where
/// `mirror_legs_fold_idx` (family, target, epoch) is.
///
/// Only the leg table is asserted on. Whether `mirror_records` is reached
/// by a nested loop over its primary key or built into a hash is a
/// join-strategy choice the planner remakes as the table grows; the leg
/// side is the one an index has to serve.
#[sqlx::test(migrations = "../../migrations")]
async fn the_fold_reads_through_existing_indexes(pool: PgPool) {
    seed_bulk_tags(&pool).await;

    let chip = plan_of(
        &pool,
        "SELECT l.target, l.p_i, l.p_d, r.epoch, r.act_time, r.position
         FROM mirror_record_legs l
         JOIN mirror_records r ON r.record_id = l.record_id
         WHERE l.leg = 't' AND l.family = 'tag'
           AND l.source = 'mint:act:a7:7:publish'
           AND r.author = 'a7' AND NOT r.payload_marked",
    )
    .await;
    assert!(
        !chip.contains("Seq Scan on mirror_record_legs"),
        "chip-row read scans the leg table:\n{chip}"
    );

    let page = plan_of(
        &pool,
        "SELECT l.source, r.author, l.p_i, l.p_d, r.epoch, r.act_time, r.position
         FROM mirror_record_legs l
         JOIN mirror_records r ON r.record_id = l.record_id
         WHERE l.leg = 't' AND l.family = 'tag'
           AND l.target = 'name:t7' AND NOT r.payload_marked",
    )
    .await;
    assert!(
        !page.contains("Seq Scan on mirror_record_legs"),
        "topic-page read scans the leg table:\n{page}"
    );
}

/// The registry keys a canonical name by its derived id, and the upsert is
/// idempotent: the row is the same row and the id the same id.
#[sqlx::test(migrations = "../../migrations")]
async fn the_registry_upserts_by_derived_id(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    let name = canonicalize("#Rust").expect("legal");
    let id = hashtag::upsert(&mut conn, &name).await.expect("upserts");
    assert_eq!(id, common::hashtag_uuid("rust"));

    let again = hashtag::upsert(&mut conn, &name).await.expect("upserts");
    assert_eq!(again, id);
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hashtags WHERE name = 'rust'")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(rows, 1);

    assert_eq!(
        hashtag::id_by_name(&pool, "rust").await.expect("looks up"),
        Some(id)
    );
    assert_eq!(
        hashtag::name_by_id(&pool, id).await.expect("looks up"),
        Some("rust".to_string())
    );
}

/// D4: a Type is anchored vacuously, so a name resolves whether or not the
/// registry has seen it — and a read must not make it seen.
#[sqlx::test(migrations = "../../migrations")]
async fn resolving_a_name_never_writes_a_row(pool: PgPool) {
    assert_eq!(
        hashtag::id_by_name(&pool, "never-tagged")
            .await
            .expect("looks up"),
        None
    );
    assert_eq!(
        hashtag::name_by_id(&pool, common::hashtag_uuid("never-tagged"))
            .await
            .expect("looks up"),
        None
    );
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hashtags")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(rows, 0, "reads write nothing");
}

/// D5: the name and the act that references it commit together, so an
/// abandoned prepare leaves no row behind.
#[sqlx::test(migrations = "../../migrations")]
async fn the_registry_rolls_back_with_its_transaction(pool: PgPool) {
    let mut tx = pool.begin().await.expect("begins");
    hashtag::upsert(&mut tx, "rust").await.expect("upserts");
    tx.rollback().await.expect("rolls back");

    assert_eq!(
        hashtag::id_by_name(&pool, "rust").await.expect("looks up"),
        None
    );
}
