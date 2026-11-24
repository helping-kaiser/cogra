//! A person's chronicle (api-spec.md `User.chronicle`): their records in
//! landing order, with the posts and comments they signed that are still
//! settling leading them in the content listings' pending namespace.
//! These exercise the store walk directly, because the window it guards —
//! a record already mirrored while its display row still reads pending —
//! closes inside one ingestion and cannot be held open end to end.

use common::l1::Family;
use common::l1::census::{LegRole, leg_params};
use common::l1::handshake::{ActAuthentication, EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::{self, ChronicleEntry, ContentCursor, LandingOrder, Listing};
use postgres_store::{genesis, mirror};
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// The author's L1 address, as the mirror's records carry it.
const ALICE: &str = "alice";

fn at(secs: i64) -> Timestamp {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

fn order(epoch: i64, position: i64) -> LandingOrder {
    LandingOrder {
        landed_epoch: epoch,
        position,
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

fn act(seq: u64, family: Family) -> ActId {
    ActId::new(ALICE, seq, family).expect("act id")
}

/// A post row minted by `minted_by`, pending unless `landing` is given.
async fn post(
    pool: &PgPool,
    author: Uuid,
    minted_by: &ActId,
    landing: Option<LandingOrder>,
    created_at: Timestamp,
) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &NodeId::Mint(minted_by.clone()).to_string(),
        "a=0;o=0",
        landing,
        created_at,
        Some("title"),
        None,
        "body",
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

/// A pending comment row on `target`, minted by `minted_by`.
async fn pending_comment(
    pool: &PgPool,
    author: Uuid,
    target: Uuid,
    minted_by: &ActId,
    created_at: Timestamp,
) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment(
        &mut tx,
        id,
        target,
        "post",
        author,
        &NodeId::Mint(minted_by.clone()).to_string(),
        "a=0;o=0",
        None,
        created_at,
        "a comment",
        None,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    id
}

/// A binary record by the author toward `target` at `(epoch, position)`.
fn binary(act_id: ActId, epoch: i64, position: i64, target: NodeId) -> PublishedRecord {
    let family = act_id.family;
    let (p_d, p_i) = leg_params(LegRole::Binary, 0.5, 0.5);
    PublishedRecord {
        authentication: ActAuthentication::unverified(&act_id),
        act_id,
        author: ALICE.to_string(),
        family,
        epoch,
        act_time: position,
        position,
        payload_witness: vec![0; 32],
        legs: vec![PublishedLeg {
            role: LegRole::Binary,
            source: NodeId::Addr(ALICE.to_string()),
            target,
            p_d,
            p_i,
            tau: 0.0,
        }],
    }
}

/// The Publish that mints its own node — a post's genesis record.
fn publish(act_id: ActId, epoch: i64, position: i64) -> PublishedRecord {
    let mint = NodeId::Mint(act_id.clone());
    binary(act_id, epoch, position, mint)
}

/// An Opinion toward a person — an act that is no post or comment.
fn opinion(seq: u64, epoch: i64, position: i64) -> PublishedRecord {
    binary(
        act(seq, Family::Opinion),
        epoch,
        position,
        NodeId::Prof("bob".to_string()),
    )
}

async fn ingest(pool: &PgPool, epoch: i64, records: Vec<PublishedRecord>) {
    mirror::ingest_epoch(
        pool,
        &EpochPackage {
            epoch,
            asserted_at: chrono::Utc::now(),
            records,
            closure: Default::default(),
        },
    )
    .await
    .expect("ingests");
}

/// What one entry is, as a test names it: a record by its id, a settling
/// post or comment by its row id.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Seen {
    Record(String),
    Post(Uuid),
    Comment(Uuid),
}

fn seen(entry: &ChronicleEntry) -> Seen {
    match entry {
        ChronicleEntry::Record(r) => Seen::Record(r.record_id.clone()),
        ChronicleEntry::Post(p) => Seen::Post(p.id),
        ChronicleEntry::Comment(c) => Seen::Comment(c.id),
    }
}

/// The cursor the resolver hands back for entry `i` of a page: its place
/// in the walk, its id if it has one, and the walk's horizon.
fn cursor_at(page: &Listing<ChronicleEntry>, i: usize) -> ContentCursor {
    ContentCursor::of(&page.items[i], page.horizon)
}

async fn page(
    pool: &PgPool,
    author: Uuid,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Listing<ChronicleEntry> {
    content::chronicle(
        pool,
        author,
        ALICE,
        cursor,
        backward,
        limit,
        include_pending,
    )
    .await
    .expect("chronicle")
}

fn ids(entries: &Listing<ChronicleEntry>) -> Vec<Seen> {
    entries.items.iter().map(seen).collect()
}

/// Walks the whole chronicle one entry at a time, forward.
async fn walk_one_by_one(pool: &PgPool, author: Uuid) -> Vec<Seen> {
    let mut walked = Vec::new();
    let mut cursor = None;
    loop {
        let one = page(pool, author, cursor, false, 1, true).await;
        let Some(entry) = one.items.first() else {
            break;
        };
        walked.push(seen(entry));
        cursor = Some(cursor_at(&one, 0));
        assert!(walked.len() <= 16, "the walk must end: {walked:?}");
    }
    walked
}

/// The two landed opinions, the settling post and the settling comment
/// of one author, as the chronicle tests share them.
struct Fixture {
    author: Uuid,
    older_opinion: String,
    newer_opinion: String,
    settling_post: Uuid,
    settling_comment: Uuid,
}

async fn fixture(pool: &PgPool) -> Fixture {
    let author = actor(pool, ALICE).await;
    let older = opinion(1, 1, 1);
    let newer = opinion(2, 1, 2);
    let (older_opinion, newer_opinion) = (older.act_id.to_string(), newer.act_id.to_string());
    ingest(pool, 1, vec![older, newer]).await;
    let landed = post(
        pool,
        author,
        &act(3, Family::Publish),
        Some(order(1, 3)),
        at(0),
    )
    .await;
    let settling_post = post(pool, author, &act(4, Family::Publish), None, at(10)).await;
    let settling_comment =
        pending_comment(pool, author, landed, &act(5, Family::Review), at(20)).await;
    Fixture {
        author,
        older_opinion,
        newer_opinion,
        settling_post,
        settling_comment,
    }
}

/// The settling post and comment lead the records, newest signed first,
/// and a settled read serves the records alone — the page `records`
/// serves for the same author.
///
/// A person's settling posts and comments lead their chronicle, and a settled read serves the records alone.
/// ´claim:chronicle:settling-posts-and-comments-lead-the-chronicle´
#[sqlx::test(migrations = "../../migrations")]
async fn settling_posts_and_comments_lead_the_chronicle(pool: PgPool) {
    let f = fixture(&pool).await;

    assert_eq!(
        ids(&page(&pool, f.author, None, false, 10, true).await),
        vec![
            Seen::Comment(f.settling_comment),
            Seen::Post(f.settling_post),
            Seen::Record(f.newer_opinion.clone()),
            Seen::Record(f.older_opinion.clone()),
        ]
    );
    assert_eq!(
        ids(&page(&pool, f.author, None, false, 10, false).await),
        vec![Seen::Record(f.newer_opinion), Seen::Record(f.older_opinion)]
    );
}

/// One entry a page, forward across the namespace boundary and back
/// again: every entry once, in the one order, and the walk ends.
///
/// The chronicle pages across its two namespaces in both directions, every entry once.
/// ´claim:chronicle:the-chronicle-pages-across-both-namespaces´
#[sqlx::test(migrations = "../../migrations")]
async fn the_chronicle_pages_across_both_namespaces(pool: PgPool) {
    let f = fixture(&pool).await;
    let expected = vec![
        Seen::Comment(f.settling_comment),
        Seen::Post(f.settling_post),
        Seen::Record(f.newer_opinion.clone()),
        Seen::Record(f.older_opinion.clone()),
    ];
    assert_eq!(walk_one_by_one(&pool, f.author).await, expected);

    let all = page(&pool, f.author, None, false, 10, true).await;
    let mut back = Vec::new();
    let mut cursor = Some(cursor_at(&all, all.items.len() - 1));
    loop {
        let one = page(&pool, f.author, cursor, true, 1, true).await;
        let Some(entry) = one.items.first() else {
            break;
        };
        back.push(seen(entry));
        cursor = Some(cursor_at(&one, 0));
        assert!(back.len() <= 16, "the walk back must end: {back:?}");
    }
    back.reverse();
    assert_eq!(back, expected[..3].to_vec(), "every entry above the oldest");
}

/// Page one ends on the settling post; the post then lands, its record
/// mirrored and its row promoted. Page two resumes where the post sits
/// now: neither the post's record nor anything above it comes again, and
/// nothing below it is lost.
///
/// An entry landing under the chronicle's page boundary is served neither twice nor never.
/// ´claim:chronicle:an-entry-landing-under-the-boundary-is-served-once´
#[sqlx::test(migrations = "../../migrations")]
async fn an_entry_landing_under_the_boundary_is_served_once(pool: PgPool) {
    let f = fixture(&pool).await;
    let first = page(&pool, f.author, None, false, 2, true).await;
    assert_eq!(
        ids(&first),
        vec![
            Seen::Comment(f.settling_comment),
            Seen::Post(f.settling_post)
        ]
    );
    let boundary = cursor_at(&first, 1);

    let minting = act(4, Family::Publish);
    ingest(&pool, 2, vec![publish(minting, 2, 1)]).await;
    let mut tx = pool.begin().await.expect("tx");
    assert!(
        content::land_post(&mut tx, f.settling_post, order(2, 1))
            .await
            .expect("lands")
    );
    tx.commit().await.expect("commit");

    assert_eq!(
        ids(&page(&pool, f.author, Some(boundary), false, 10, true).await),
        vec![Seen::Record(f.newer_opinion), Seen::Record(f.older_opinion)],
        "the landed post is above the boundary now and must not come again"
    );
}

/// Between the mirror taking a post's record and the landing pass
/// promoting its row, the row still reads pending. The chronicle serves
/// the record, which is ordered fact, and leaves the lagging row out —
/// and a row left out of a one-entry batch does not end the settling
/// branch early: the settling post behind it is still served first.
///
/// A settling row whose minting record is already mirrored is served once, as its record, and never cuts the settling branch short.
/// ´claim:chronicle:a-mirrored-genesis-is-served-once-as-its-record´
#[sqlx::test(migrations = "../../migrations")]
async fn a_mirrored_genesis_is_served_once_as_its_record(pool: PgPool) {
    let author = actor(&pool, ALICE).await;
    let older = post(&pool, author, &act(1, Family::Publish), None, at(0)).await;
    let lagging_act = act(2, Family::Publish);
    let lagging = post(&pool, author, &lagging_act, None, at(10)).await;
    let lagging_record = lagging_act.to_string();
    ingest(&pool, 1, vec![publish(lagging_act, 1, 1)]).await;

    assert_eq!(
        ids(&page(&pool, author, None, false, 10, true).await),
        vec![Seen::Post(older), Seen::Record(lagging_record.clone())],
        "the lagging row stands as its record alone"
    );
    assert_eq!(
        walk_one_by_one(&pool, author).await,
        vec![Seen::Post(older), Seen::Record(lagging_record)]
    );
    assert!(
        !ids(&page(&pool, author, None, false, 10, true).await).contains(&Seen::Post(lagging)),
        "the row is never served beside its record"
    );
}

/// Two landed opinions and three settling entries — two posts and, newest,
/// a comment — so a two-entry page one ends inside the settling set with
/// a settling post still below it: `C3 P2 P1 newer older`.
struct Boundary {
    author: Uuid,
    older_opinion: String,
    newer_opinion: String,
    p1: Uuid,
    p2: Uuid,
    c3: Uuid,
}

async fn boundary_fixture(pool: &PgPool) -> Boundary {
    let author = actor(pool, ALICE).await;
    let host = post(pool, author, &act(9, Family::Publish), None, at(0)).await;
    let older = opinion(1, 1, 1);
    let newer = opinion(2, 1, 2);
    let (older_opinion, newer_opinion) = (older.act_id.to_string(), newer.act_id.to_string());
    ingest(
        pool,
        1,
        vec![older, newer, publish(act(9, Family::Publish), 1, 3)],
    )
    .await;
    let mut tx = pool.begin().await.expect("tx");
    assert!(
        content::land_post(&mut tx, host, order(1, 3))
            .await
            .expect("lands")
    );
    tx.commit().await.expect("commit");
    let p1 = post(pool, author, &act(3, Family::Publish), None, at(10)).await;
    let p2 = post(pool, author, &act(4, Family::Publish), None, at(20)).await;
    let c3 = pending_comment(pool, author, host, &act(5, Family::Review), at(30)).await;
    Boundary {
        author,
        older_opinion,
        newer_opinion,
        p1,
        p2,
        c3,
    }
}

/// Page one ends on a settling post that then lands — record mirrored,
/// row promoted — while an older settling post still pends below it. Page
/// two owes that post ahead of the records.
///
/// The chronicle's boundary entry landing between two pages leaves the settling entries below it due.
/// ´claim:chronicle:the-boundary-landing-keeps-the-settling-entries-below-it´
#[sqlx::test(migrations = "../../migrations")]
async fn the_chronicle_boundary_landing_keeps_the_settling_entries_below_it(pool: PgPool) {
    let f = boundary_fixture(&pool).await;
    let host_record = act(9, Family::Publish).to_string();
    let first = page(&pool, f.author, None, false, 2, true).await;
    assert_eq!(ids(&first), vec![Seen::Comment(f.c3), Seen::Post(f.p2)]);
    let boundary = cursor_at(&first, 1);

    ingest(&pool, 2, vec![publish(act(4, Family::Publish), 2, 1)]).await;
    let mut tx = pool.begin().await.expect("tx");
    assert!(
        content::land_post(&mut tx, f.p2, order(2, 1))
            .await
            .expect("lands")
    );
    tx.commit().await.expect("commit");

    assert_eq!(
        ids(&page(&pool, f.author, Some(boundary), false, 10, true).await),
        vec![
            Seen::Post(f.p1),
            Seen::Record(host_record),
            Seen::Record(f.newer_opinion),
            Seen::Record(f.older_opinion),
        ],
        "the settling post below the boundary must not be dropped"
    );
}

/// Page one serves the settling comment above its boundary; the comment
/// lands while the boundary post still pends. It was served once, so its
/// record must not come back on page two.
///
/// An entry above the chronicle's page boundary landing between two pages is not served again as its record.
/// ´claim:chronicle:an-entry-above-the-boundary-landing-is-not-served-again´
#[sqlx::test(migrations = "../../migrations")]
async fn a_chronicle_entry_above_the_boundary_landing_is_not_served_again(pool: PgPool) {
    let f = boundary_fixture(&pool).await;
    let host_record = act(9, Family::Publish).to_string();
    let first = page(&pool, f.author, None, false, 2, true).await;
    assert_eq!(ids(&first), vec![Seen::Comment(f.c3), Seen::Post(f.p2)]);
    let boundary = cursor_at(&first, 1);

    ingest(&pool, 2, vec![publish(act(5, Family::Review), 2, 1)]).await;
    let mut tx = pool.begin().await.expect("tx");
    assert!(
        content::land_comment(&mut tx, f.c3, order(2, 1))
            .await
            .expect("lands")
    );
    tx.commit().await.expect("commit");

    assert_eq!(
        ids(&page(&pool, f.author, Some(boundary), false, 10, true).await),
        vec![
            Seen::Post(f.p1),
            Seen::Record(host_record),
            Seen::Record(f.newer_opinion),
            Seen::Record(f.older_opinion),
        ],
        "the comment served on page one must not come again as its record"
    );
}
