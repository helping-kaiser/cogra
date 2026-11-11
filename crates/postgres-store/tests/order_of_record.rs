//! The key of record decides (layer1-interface.md §8.3): records are
//! ordered by `(epoch, position)`, and "a time comparison never decides
//! precedence". On stand-in data positions follow act time, so every
//! ordering would pass under either rule; each case here lands records
//! whose later position carries the LOWER act time — the real Layer 1's
//! freedom — and asserts that position decides.

use common::l1::Family;
use common::l1::census::{LegRole, leg_params};
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::{self, ContentCursor, LandingOrder, LandingStamp, Post};
use postgres_store::{genesis, mirror};
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

fn at(secs: i64) -> Timestamp {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

/// A landing at `(epoch, position)` whose act time falls as the position
/// rises.
fn landing(epoch: i64, position: i64) -> LandingStamp {
    LandingStamp {
        order: LandingOrder {
            landed_epoch: epoch,
            position,
        },
        act_time: 100 - position,
    }
}

async fn actor(pool: &PgPool, handle: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        format!("pk-{handle}").as_bytes(),
        &format!("addr-{handle}"),
    )
    .await
    .expect("actor row");
    id
}

async fn landed_post(pool: &PgPool, author: Uuid, at_key: LandingStamp, body: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &format!("mint:act:{id}:0:publish"),
        "a=0;o=0",
        Some(at_key),
        at(at_key.order.position),
        Some("title"),
        None,
        body,
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

fn cursor_of(p: &Post) -> ContentCursor {
    ContentCursor {
        order: p.sort_key(),
        id: Some(p.id),
    }
}

/// The landed listing pages newest first by position inside one epoch,
/// forward and backward, across every page boundary.
///
/// Inside one epoch the post listing pages by position, whatever act time the posts carry.
/// ´claim:content:the-listing-pages-by-the-key-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_listing_pages_by_the_key_of_record(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let first = landed_post(&pool, author, landing(1, 1), "first").await;
    let second = landed_post(&pool, author, landing(1, 2), "second").await;
    let third = landed_post(&pool, author, landing(1, 3), "third").await;

    let mut walked = Vec::new();
    let mut cursor = None;
    loop {
        let page = content::list_posts(&pool, cursor, false, 1, false)
            .await
            .expect("lists");
        let Some(p) = page.first() else { break };
        walked.push(p.id);
        cursor = Some(cursor_of(p));
    }
    assert_eq!(walked, vec![third, second, first], "newest position first");

    let oldest = content::post(&pool, first)
        .await
        .expect("reads")
        .expect("the post");
    let back = content::list_posts(&pool, Some(cursor_of(&oldest)), true, 1, false)
        .await
        .expect("lists back");
    assert_eq!(
        back.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![second],
        "the backward walk resumes at the next position, not the next act time"
    );
}

/// A node's current version is the one whose record holds the later
/// position, though it carries the lower act time.
///
/// The current version is the latest landing by the key of record, whatever act time it carries.
/// ´claim:content:the-current-version-is-the-latest-by-the-key-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_current_version_is_the_latest_by_the_key_of_record(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = landed_post(&pool, author, landing(1, 1), "genesis").await;
    let mut tx = pool.begin().await.expect("tx");
    for (position, text) in [(1, "earlier edit"), (2, "later edit")] {
        content::insert_post_version(
            &mut tx,
            id,
            Some("title"),
            None,
            text,
            None,
            Some(landing(2, position)),
            at(10 + position),
        )
        .await
        .expect("version");
    }
    tx.commit().await.expect("commit");

    let post = content::post(&pool, id)
        .await
        .expect("reads")
        .expect("the post");
    assert_eq!(post.content, "later edit");
}

/// A Tag act toward `name:topic` from `author` at `(epoch, position)`,
/// its act time falling as the position rises.
fn tag(author: &str, seq: u64, epoch: i64, position: i64) -> PublishedRecord {
    let content = NodeId::Mint(ActId::new(author, 0, Family::Publish).expect("act id"));
    let (a_pd, a_pi) = leg_params(LegRole::A, 0.5, 0.5);
    let (t_pd, t_pi) = leg_params(LegRole::T, 0.5, 0.5);
    PublishedRecord {
        act_id: ActId::new(author, seq, Family::Tag).expect("act id"),
        author: author.to_string(),
        family: Family::Tag,
        epoch,
        act_time: 100 - position,
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
                source: content,
                target: NodeId::name("topic").expect("type name"),
                p_d: t_pd,
                p_i: t_pi,
                tau: 0.0,
            },
        ],
    }
}

/// The chronicle pages by position inside one epoch, and the chain head
/// is the later position.
///
/// The record chronicle and the chain head order by the key of record, whatever act time the records carry.
/// ´claim:mirror:the-chronicle-orders-by-the-key-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_chronicle_orders_by_the_key_of_record(pool: PgPool) {
    let records: Vec<PublishedRecord> = (1..=3).map(|p| tag("alice", p as u64, 1, p)).collect();
    let ids: Vec<String> = records.iter().map(|r| r.act_id.to_string()).collect();
    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 1,
            attested_at: chrono::Utc::now(),
            records,
            closure: Default::default(),
        },
    )
    .await
    .expect("ingests");

    let filter = mirror::RecordFilter::default();
    let mut walked = Vec::new();
    let mut cursor = None;
    loop {
        let page = mirror::records(&pool, &filter, cursor, false, 1)
            .await
            .expect("records");
        let Some(r) = page.first() else { break };
        walked.push(r.record_id.clone());
        cursor = Some((r.epoch, r.position));
    }
    assert_eq!(walked, vec![ids[2].clone(), ids[1].clone(), ids[0].clone()]);
    let back = mirror::records(&pool, &filter, Some((1, 1)), true, 1)
        .await
        .expect("records back");
    assert_eq!(back[0].record_id, ids[1]);

    let head = mirror::chain_head(&pool, "alice", Family::Tag, "name:topic")
        .await
        .expect("head");
    assert_eq!(head.as_deref(), Some(ids[2].as_str()));
}
