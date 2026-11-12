//! The key of record decides (layer1-interface.md §8.3): records are
//! ordered by `(epoch, position)`, and "a time comparison never decides
//! precedence". On stand-in data positions follow act time, so every
//! ordering would pass under either rule; each mirror case here lands
//! records whose later position carries the LOWER act time — the real
//! Layer 1's freedom — and asserts that position decides. Display rows
//! carry the key of record alone; their cases give the later position the
//! EARLIER authoring instant, so a wall-clock ordering fails them.

use common::l1::Family;
use common::l1::census::{LegRole, leg_params};
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::{self, ContentCursor, LandingOrder, Post};
use postgres_store::{auth, genesis, mirror, references};
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

fn at(secs: i64) -> Timestamp {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

/// A landing at `(epoch, position)`.
fn landing(epoch: i64, position: i64) -> LandingOrder {
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

/// A landed post at `at_key`, authored at an instant that falls as the
/// position rises.
async fn landed_post(pool: &PgPool, author: Uuid, at_key: LandingOrder, body: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &format!("mint:act:{id}:0:publish"),
        "a=0;o=0",
        Some(at_key),
        at(100 - at_key.position),
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
/// Inside one epoch the post listing pages by position, whatever instant the posts were authored at.
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
        "the backward walk resumes at the next position, not the next instant"
    );
}

/// A node's current version is the one whose record holds the later
/// position, though it was authored earlier.
///
/// The current version is the latest landing by the key of record, whatever instant it was authored at.
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
            at(10 - position),
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

/// A record of `family` by `author` at `(1, position)`, its act time
/// falling as the position rises.
fn record(
    author: &str,
    seq: u64,
    family: Family,
    position: i64,
    legs: Vec<PublishedLeg>,
) -> PublishedRecord {
    PublishedRecord {
        act_id: ActId::new(author, seq, family).expect("act id"),
        author: author.to_string(),
        family,
        epoch: 1,
        act_time: 100 - position,
        position,
        payload_marked: false,
        payload_witness: vec![0; 32],
        legs,
    }
}

fn leg(role: LegRole, source: NodeId, target: NodeId, p_d: f64, p_i: f64) -> PublishedLeg {
    let (p_d, p_i) = leg_params(role, p_d, p_i);
    PublishedLeg {
        role,
        source,
        target,
        p_d,
        p_i,
        tau: 0.0,
    }
}

async fn ingest_one_epoch(pool: &PgPool, records: Vec<PublishedRecord>) {
    mirror::ingest_epoch(
        pool,
        &EpochPackage {
            epoch: 1,
            attested_at: chrono::Utc::now(),
            records,
            closure: Default::default(),
        },
    )
    .await
    .expect("ingests");
}

/// Of one author's two Registrations in one epoch, the genesis is the
/// earlier position, though it carries the higher act time — in the record
/// count and the bundle count alike.
///
/// A Registration is a genesis by the key of record, in the record and the bundle count alike.
/// ´claim:mirror:the-genesis-count-reads-the-key-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_genesis_count_reads_the_key_of_record(pool: PgPool) {
    let first = NodeId::Prof("alice".to_string());
    let second = NodeId::Prof("alice-again".to_string());
    let addr = NodeId::Addr("alice".to_string());
    ingest_one_epoch(
        &pool,
        vec![
            record(
                "alice",
                0,
                Family::Registration,
                1,
                vec![leg(LegRole::Binary, addr.clone(), first.clone(), 1.0, 1.0)],
            ),
            record(
                "alice",
                1,
                Family::Registration,
                2,
                vec![leg(LegRole::Binary, addr, second.clone(), 1.0, 1.0)],
            ),
        ],
    )
    .await;

    for (target, genesis) in [(first, 1), (second, 0)] {
        let filter = mirror::RecordFilter {
            target: Some(target.to_string()),
            genesis: Some(true),
            ..Default::default()
        };
        assert_eq!(
            mirror::count_records(&pool, &filter).await.expect("counts"),
            genesis,
            "records toward {target}"
        );
        assert_eq!(
            mirror::count_bundles(&pool, &filter).await.expect("counts"),
            genesis,
            "bundles toward {target}"
        );
    }
}

/// A citation and its counter-record in one epoch: the withdrawal is the
/// record at the later position, though it carries the lower act time.
///
/// A citation's withdrawal is read in the order of record, whatever act time its records carry.
/// ´claim:references:a-withdrawal-reads-in-the-order-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn a_withdrawal_reads_in_the_order_of_record(pool: PgPool) {
    let artifact = NodeId::Mint(ActId::new("alice", 0, Family::Publish).expect("act id"));
    let cited = NodeId::Mint(ActId::new("bob", 0, Family::Publish).expect("act id"));
    let citation = |seq: u64, position: i64, sign: f64| {
        record(
            "alice",
            seq,
            Family::Reference,
            position,
            vec![
                leg(
                    LegRole::A,
                    NodeId::Addr("alice".to_string()),
                    artifact.clone(),
                    0.0,
                    0.5 * sign,
                ),
                leg(
                    LegRole::T,
                    artifact.clone(),
                    cited.clone(),
                    0.5 * sign,
                    0.5 * sign,
                ),
            ],
        )
    };
    let records = vec![citation(1, 1, 1.0), citation(2, 2, -1.0)];
    let ids: Vec<String> = records.iter().map(|r| r.act_id.to_string()).collect();
    ingest_one_epoch(&pool, records).await;

    let withdrawn = references::withdrawal_records(&pool, &ids)
        .await
        .expect("reads");
    assert_eq!(withdrawn, std::collections::HashSet::from([ids[1].clone()]));
}

/// A landed Opinion by `voucher` that vouches for `account` at `(1,
/// position)`, through an application of its own — the account's landed
/// one if it has none yet (one landed application per account).
async fn vouch(
    pool: &PgPool,
    account: Uuid,
    ask_link: Uuid,
    voucher: (Uuid, &str),
    seq: u64,
    position: i64,
) -> PublishedRecord {
    let application: Uuid = sqlx::query_scalar(
        "INSERT INTO auth_applications (account_id, approver_id, ask_link_id, approved_at, landed_at)
         VALUES ($1, $2, $3, NOW(),
                 CASE WHEN NOT EXISTS (SELECT 1 FROM auth_applications
                                       WHERE account_id = $1 AND landed_at IS NOT NULL)
                      THEN NOW() END)
         RETURNING id",
    )
    .bind(account)
    .bind(voucher.0)
    .bind(ask_link)
    .fetch_one(pool)
    .await
    .expect("application");
    let opinion = record(
        voucher.1,
        seq,
        Family::Opinion,
        position,
        vec![leg(
            LegRole::Binary,
            NodeId::Addr(voucher.1.to_string()),
            NodeId::Prof(account.to_string()),
            1.0,
            1.0,
        )],
    );
    sqlx::query(
        "INSERT INTO auth_application_vouches (application_id, voucher_id, act_id, landed_at)
         VALUES ($1, $2, $3, NOW())",
    )
    .bind(application)
    .bind(voucher.0)
    .bind(opinion.act_id.to_string())
    .execute(pool)
    .await
    .expect("vouch");
    opinion
}

/// Two vouches for one account in one epoch: the one that let it in is
/// the earlier position, though it carries the higher act time; and the
/// voucher's list pages newest position first.
///
/// The vouched-in list picks the admitting vouch and pages by the key of record, whatever act time the vouches carry.
/// ´claim:auth:the-vouched-in-list-reads-the-key-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_vouched_in_list_reads_the_key_of_record(pool: PgPool) {
    let ana = actor(&pool, "ana").await;
    let ben = actor(&pool, "ben").await;
    let mira = actor(&pool, "mira").await;
    let kai = actor(&pool, "kai").await;
    let mut links = std::collections::HashMap::new();
    for account in [mira, kai] {
        let link: Uuid =
            sqlx::query_scalar("INSERT INTO auth_ask_links (account_id) VALUES ($1) RETURNING id")
                .bind(account)
                .fetch_one(&pool)
                .await
                .expect("ask link");
        links.insert(account, link);
    }
    let records = vec![
        vouch(&pool, mira, links[&mira], (ana, "addr-ana"), 1, 1).await,
        vouch(&pool, mira, links[&mira], (ben, "addr-ben"), 1, 2).await,
        vouch(&pool, kai, links[&kai], (ana, "addr-ana"), 2, 3).await,
    ];
    ingest_one_epoch(&pool, records).await;

    let listed = |voucher: Uuid, cursor: Option<(i64, i64)>, backward: bool| {
        let pool = pool.clone();
        async move {
            auth::vouched_in_by(&pool, voucher, cursor, backward, 10)
                .await
                .expect("lists")
                .into_iter()
                .map(|row| row.account_id)
                .collect::<Vec<_>>()
        }
    };
    assert_eq!(
        listed(ana, None, false).await,
        vec![kai, mira],
        "newest position first"
    );
    assert_eq!(
        listed(ben, None, false).await,
        Vec::<Uuid>::new(),
        "ben's vouch landed second"
    );
    assert_eq!(
        listed(ana, Some((1, 3)), false).await,
        vec![mira],
        "forward from kai"
    );
    assert_eq!(
        listed(ana, Some((1, 1)), true).await,
        vec![kai],
        "backward from mira"
    );
}
