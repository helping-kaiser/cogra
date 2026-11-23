//! What a guest's stance faces wear (`design/guidelines/stance-control.md`
//! "A guest's view"; FeedBare.md:7, TagPage.md:53): the borrowed view's
//! own stance, read-only, and the hollow face wherever it holds none.
//! `borrowedStance` serves it on every stance-able node for a request
//! with no session — the vantage `Query.borrowedView` names, the Genesis
//! Moderator — and nothing for a signed-in one, whose faces are their own.

use std::sync::{Mutex, OnceLock};

use common::l1::client::ActorKey;
use postgres_store::{PgPool, genesis};
use serde_json::{Value, json};
use tracing::field::{Field, Visit};
use tracing_subscriber::layer::{Context, SubscriberExt};
use tracing_subscriber::{Layer, Registry};
use uuid::Uuid;

use api::ratelimit::RateLimitConfig;

mod rig;
use rig::WireRig;

/// The fields a face reads, asked identically of both reads.
const FACE: &str = "pDirected pInterest recordCount inert severed";

/// The grouped read only the guest-stance loader issues.
const BATCH_READ: &str = "JOIN UNNEST($2::text[], $3::text[]) AS k(family, target)";

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) { node writes { id canonicalProposal } userErrors { code } }
}"#;

const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
  prepareComment(input: $input) { node writes { id canonicalProposal } userErrors { code } }
}"#;

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) { writes { id canonicalProposal } userErrors { code } }
}"#;

const PREPARE_SEVERANCE: &str = r#"mutation($input: PrepareSeveranceInput!) {
  prepareSeverance(input: $input) { writes { id canonicalProposal } userErrors { code } }
}"#;

/// Every statement sqlx runs in this test binary, as its log event names
/// it — what the read count below is measured from.
fn statements() -> &'static Mutex<Vec<String>> {
    static LOG: OnceLock<Mutex<Vec<String>>> = OnceLock::new();
    LOG.get_or_init(|| {
        let subscriber = Registry::default().with(StatementLog);
        tracing::subscriber::set_global_default(subscriber).expect("one subscriber");
        Mutex::new(Vec::new())
    })
}

struct StatementLog;

impl<S: tracing::Subscriber> Layer<S> for StatementLog {
    fn enabled(&self, metadata: &tracing::Metadata<'_>, _: Context<'_, S>) -> bool {
        metadata.target() == "sqlx::query"
    }

    fn on_event(&self, event: &tracing::Event<'_>, _: Context<'_, S>) {
        let mut text = StatementText(String::new());
        event.record(&mut text);
        if let Ok(mut log) = statements().lock() {
            log.push(text.0);
        }
    }
}

struct StatementText(String);

impl Visit for StatementText {
    fn record_str(&mut self, field: &Field, value: &str) {
        if matches!(field.name(), "summary" | "db.statement") {
            self.0.push_str(value);
        }
    }

    fn record_debug(&mut self, _: &Field, _: &dyn std::fmt::Debug) {}
}

/// Holds this binary's tests one at a time, so the statement log of one
/// request holds that request's statements alone.
async fn serial() -> tokio::sync::MutexGuard<'static, ()> {
    static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    statements();
    SERIAL.lock().await
}

/// The statements one request ran.
async fn statements_of<F: std::future::Future<Output = Value>>(request: F) -> (Value, Vec<String>) {
    let start = statements().lock().expect("log").len();
    let data = request.await;
    let log = statements().lock().expect("log");
    (data, log[start..].to_vec())
}

struct World {
    rig: WireRig,
    lender: (String, ActorKey),
    ada: String,
    ada_id: Uuid,
    post: String,
    untouched: String,
    pending: String,
    comment: String,
}

impl World {
    /// The lender is seeded first, with the custodied genesis key: the
    /// earliest such user is the Genesis Moderator a bare visitor borrows.
    async fn new(pool: PgPool) -> Self {
        let rig = WireRig::new(pool, RateLimitConfig::unlimited());
        let (lender_id, lender_key) = rig.seed_member("genesismod", "gm@example.com").await;
        let mut conn = rig.pool.acquire().await.expect("conn");
        genesis::insert_system_key(&mut conn, lender_id, &lender_key.seed())
            .await
            .expect("system key");
        drop(conn);
        let (ada_id, ada_key) = rig.seed_member("ada", "ada@example.com").await;
        let lender = rig.log_in("gm@example.com").await;
        let ada = rig.log_in("ada@example.com").await;

        let post = landed(
            &rig,
            &ada,
            &ada_key,
            PREPARE_POST,
            "preparePost",
            post_input(),
        )
        .await;
        let untouched = landed(
            &rig,
            &ada,
            &ada_key,
            PREPARE_POST,
            "preparePost",
            post_input(),
        )
        .await;
        let pending = landed(
            &rig,
            &ada,
            &ada_key,
            PREPARE_POST,
            "preparePost",
            post_input(),
        )
        .await;
        let comment = landed(
            &rig,
            &ada,
            &ada_key,
            PREPARE_COMMENT,
            "prepareComment",
            json!({
                "target": post,
                "content": "a reply",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "pDirected": 0.1,
                "pInterest": 0.1,
                "tags": [{ "name": "rust", "pDirected": 0.1, "pInterest": 1.0 }],
            }),
        )
        .await;

        let world = Self {
            rig,
            lender: (lender, lender_key),
            ada,
            ada_id,
            post,
            untouched,
            pending,
            comment,
        };
        world
            .stance(json!({ "target": world.post }), 0.6, 0.4, true)
            .await;
        world
            .stance(json!({ "target": world.comment }), 0.3, -0.2, true)
            .await;
        world
            .stance(json!({ "target": world.ada_id }), 0.5, 0.5, true)
            .await;
        world
            .stance(json!({ "target": world.ada_id }), -0.5, -0.5, true)
            .await;
        world
            .stance(json!({ "topicName": "rust" }), 0.2, 0.8, true)
            .await;
        world
            .stance(json!({ "target": world.pending }), 0.7, 0.7, false)
            .await;
        world
    }

    /// One stance by the lender, signed; landed only when `land`.
    async fn stance(&self, target: Value, p_d: f64, p_i: f64, land: bool) {
        let mut input = json!({ "pDirected": p_d, "pInterest": p_i });
        for (k, v) in target.as_object().expect("target").clone() {
            input[k.as_str()] = v;
        }
        let (token, key) = &self.lender;
        let prepared = self
            .rig
            .gql(Some(token), PREPARE_STANCE, json!({ "input": input }))
            .await;
        assert_eq!(
            prepared["prepareStance"]["userErrors"],
            json!([]),
            "{prepared}"
        );
        self.rig
            .sign_prepared(token, key, &prepared["prepareStance"]["writes"])
            .await;
        if land {
            self.rig.close_and_ingest().await;
        }
    }

    /// Every target's face as `field` reads it for `token`, one request.
    async fn faces(&self, token: Option<&str>, field: &str) -> Value {
        let query = format!(
            r#"query($post: UUID!, $untouched: UUID!, $pending: UUID!, $comment: UUID!, $ada: UUID!) {{
                 post: post(id: $post) {{ f: {field} {{ {FACE} }} }}
                 untouched: post(id: $untouched) {{ f: {field} {{ {FACE} }} }}
                 pending: post(id: $pending) {{ f: {field} {{ {FACE} }} }}
                 comment: comment(id: $comment) {{ f: {field} {{ {FACE} }} }}
                 profile: user(id: $ada) {{ f: {field} {{ {FACE} }} }}
                 topic: hashtag(name: "rust") {{ f: {field} {{ {FACE} }} }}
               }}"#
        );
        self.rig
            .gql(
                token,
                &query,
                json!({
                    "post": self.post, "untouched": self.untouched, "pending": self.pending,
                    "comment": self.comment, "ada": self.ada_id,
                }),
            )
            .await
    }
}

fn post_input() -> Value {
    json!({
        "title": "a post",
        "content": "a body",
        "license": { "attribution": 1.0, "provenance": 0.0 },
        "pDirected": 0.1,
        "tags": [{ "name": "rust", "pDirected": 0.1, "pInterest": 1.0 }],
    })
}

/// A content batch prepared, signed and landed; the minted node's id.
async fn landed(
    rig: &WireRig,
    token: &str,
    key: &ActorKey,
    mutation: &str,
    field: &str,
    input: Value,
) -> String {
    let prepared = rig
        .gql(Some(token), mutation, json!({ "input": input }))
        .await;
    assert_eq!(prepared[field]["userErrors"], json!([]), "{prepared}");
    rig.sign_prepared(token, key, &prepared[field]["writes"])
        .await;
    rig.close_and_ingest().await;
    prepared[field]["node"].as_str().expect("node").to_string()
}

const TARGETS: [&str; 6] = [
    "post",
    "untouched",
    "pending",
    "comment",
    "profile",
    "topic",
];

/// A guest's face on every stance-able node is exactly what the lender's
/// own session reads of its landed bundle there — the walk-back severed,
/// the topic's follow, a comment's opinion — and null wherever the lender
/// holds no landed record, its act still in flight included.
///
/// Without a session every stance-able node answers the borrowed view's own landed bundle, and null where it holds none.
/// ´claim:borrowed:a-guest-reads-the-lenders-own-landed-bundle´
#[sqlx::test(migrations = "../../migrations")]
async fn a_guest_reads_the_lenders_own_landed_bundle(pool: PgPool) {
    let _serial = serial().await;
    let world = World::new(pool).await;
    let guest = world.faces(None, "borrowedStance").await;
    let lender = world
        .faces(Some(&world.lender.0), "viewerStance(includePending: false)")
        .await;

    for target in TARGETS {
        let own = &lender[target]["f"];
        if own["recordCount"] == 0 {
            assert!(guest[target]["f"].is_null(), "{target}: {guest}");
        } else {
            assert_eq!(&guest[target]["f"], own, "{target}");
        }
    }
    assert_eq!(guest["post"]["f"]["pDirected"], 0.6);
    assert_eq!(guest["comment"]["f"]["pInterest"], -0.2);
    assert_eq!(
        guest["profile"]["f"]["severed"], true,
        "the walk-back reads severed"
    );
    assert_eq!(
        guest["topic"]["f"]["pInterest"], 0.8,
        "the follow is an Affinity"
    );
    assert!(guest["untouched"]["f"].is_null(), "the hollow face");
    assert!(
        guest["pending"]["f"].is_null(),
        "an act in flight is its author's read alone"
    );
    let in_flight = world.faces(Some(&world.lender.0), "viewerStance").await;
    assert_eq!(
        in_flight["pending"]["f"]["recordCount"], 1,
        "the lender sees it in flight"
    );
}

/// The field is a guest's only: a signed-in request — the lender's own
/// included — answers null on every node, and a guest's `viewerStance`
/// stays null, so nothing a client keys its own bundle on changes.
///
/// A request with a session reads no borrowed stance, and a guest still reads no viewer stance.
/// ´claim:borrowed:a-session-reads-no-borrowed-stance´
#[sqlx::test(migrations = "../../migrations")]
async fn a_session_reads_no_borrowed_stance(pool: PgPool) {
    let _serial = serial().await;
    let world = World::new(pool).await;
    for token in [&world.ada, &world.lender.0] {
        let signed_in = world.faces(Some(token), "borrowedStance").await;
        for target in TARGETS {
            assert!(signed_in[target]["f"].is_null(), "{target}: {signed_in}");
        }
    }
    let guest = world.faces(None, "viewerStance").await;
    for target in TARGETS {
        assert!(guest[target]["f"].is_null(), "{target}: {guest}");
    }
}

/// Reading the borrowed faces gives a guest nothing to act with: the
/// stance and severance prepares still refuse a request with no session,
/// and nothing is staged by the reads or the refusals.
///
/// A guest's stance and severance prepares are refused unauthenticated and stage nothing.
/// ´claim:borrowed:a-guest-still-cannot-act´
#[sqlx::test(migrations = "../../migrations")]
async fn a_guest_still_cannot_act(pool: PgPool) {
    let _serial = serial().await;
    let world = World::new(pool).await;
    let staged = || async {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM staged_writes")
            .fetch_one(&world.rig.pool)
            .await
            .expect("count")
    };
    let before = staged().await;
    world.faces(None, "borrowedStance").await;
    for (mutation, input) in [
        (
            PREPARE_STANCE,
            json!({ "target": world.post, "pDirected": 0.6, "pInterest": 0.4 }),
        ),
        (PREPARE_SEVERANCE, json!({ "target": world.post })),
    ] {
        let refused = world
            .rig
            .gql_raw(None, mutation, json!({ "input": input }))
            .await;
        assert_eq!(
            refused["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
            "{refused}"
        );
    }
    assert_eq!(staged().await, before, "nothing staged");
}

/// A page of guest faces is one batch: every card at one depth of the
/// document shares two reads — the vantage and one grouped bundle read —
/// however many cards the page holds.
///
/// A page of borrowed faces at one depth costs one grouped bundle read, whatever its size.
/// ´claim:borrowed:a-page-of-faces-is-one-batch´
#[sqlx::test(migrations = "../../migrations")]
async fn a_page_of_faces_is_one_batch(pool: PgPool) {
    let _serial = serial().await;
    let world = World::new(pool).await;
    let page = |faces: bool| {
        let selection = if faces {
            format!("borrowedStance {{ {FACE} }}")
        } else {
            "__typename".to_string()
        };
        let query = format!(
            "{{ hashtag(name: \"rust\") {{ taggedContent {{ node {{ id
               ... on Post {{ {selection} }} ... on Comment {{ {selection} }} }} }} }} }}"
        );
        let rig = &world.rig;
        async move { rig.gql(None, &query, json!({})).await }
    };

    let (bare, bare_reads) = statements_of(page(false)).await;
    let (data, reads) = statements_of(page(true)).await;
    let cards = data["hashtag"]["taggedContent"].as_array().expect("cards");
    assert_eq!(cards.len(), 4, "three posts and a comment: {bare}");
    let batches = reads.iter().filter(|s| s.contains(BATCH_READ)).count();
    assert_eq!(batches, 1, "{reads:#?}");
    println!(
        "a tag page of {} cards: {} statements bare, {} with every face",
        cards.len(),
        bare_reads.len(),
        reads.len()
    );

    let one_face = |token: Option<String>, field: &'static str| {
        let query = format!("query($id: UUID!) {{ post(id: $id) {{ id {field} {{ {FACE} }} }} }}");
        let rig = &world.rig;
        let id = world.post.clone();
        async move { rig.gql(token.as_deref(), &query, json!({ "id": id })).await }
    };
    let (_, guest) = statements_of(one_face(None, "borrowedStance")).await;
    let (_, member) = statements_of(one_face(Some(world.ada.clone()), "viewerStance")).await;
    println!(
        "one face per request: guest borrowedStance {} statements, member viewerStance {}",
        guest.len(),
        member.len()
    );
    for (who, log) in [("guest", &guest), ("member", &member), ("page", &reads)] {
        for statement in log.iter() {
            let line: String = statement.split_whitespace().collect::<Vec<_>>().join(" ");
            println!("  {who}: {}", line.chars().take(110).collect::<String>());
        }
    }
}
