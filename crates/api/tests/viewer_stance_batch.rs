//! A member's stance faces read as one batch (api-spec.md "The generic
//! stance"): `viewerStance` on every stance-able node answers exactly what
//! the single bundle read answers for that viewer — the L1 and L2 views,
//! a walk-back, an empty sign, an inert bundle, an act in flight, an act
//! never signed, a node the viewer holds nothing toward — while a page of
//! faces shares a constant number of reads, and no viewer's faces are
//! answered from anyone else's bundle.

use std::sync::{Mutex, OnceLock};

use common::l1::client::ActorKey;
use common::l1::fold::Standing;
use postgres_store::PgPool;
use serde_json::{Value, json};
use tracing::field::{Field, Visit};
use tracing_subscriber::layer::{Context, SubscriberExt};
use tracing_subscriber::{Layer, Registry};
use uuid::Uuid;

use api::ratelimit::RateLimitConfig;

mod rig;
use rig::WireRig;

/// Every field a stance face can ask, the projection included.
const FACE: &str = "targetGraphId pDirected pInterest rawPDirected rawPInterest recordCount \
                    inert severed severanceCost projected { pDirected pInterest inert severed }";

/// The grouped landed read only the batched member read issues.
const BATCH_READ: &str = "WITH ORDINALITY AS k(source, family, target, ord)";

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
/// it — what the read counts below are measured from.
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

/// A member who reads faces: their row id, session and device key.
struct Member {
    id: Uuid,
    token: String,
    key: ActorKey,
}

/// The fixture matrix. `carol` authors every node; `ada` and `bob` hold
/// different stances toward the same nodes, so a face answered from the
/// wrong viewer's bundle reads wrong.
struct World {
    rig: WireRig,
    ada: Member,
    bob: Member,
    carol: Member,
    /// The posts, by the cell they stand for.
    posts: Vec<(&'static str, String)>,
    comment: String,
}

impl World {
    async fn new(pool: PgPool) -> Self {
        let rig = WireRig::new(pool, RateLimitConfig::unlimited());
        let mut members = Vec::new();
        for handle in ["ada", "bob", "carol"] {
            let email = format!("{handle}@example.com");
            let (id, key) = rig.seed_member(handle, &email).await;
            let token = rig.log_in(&email).await;
            members.push(Member { id, token, key });
        }
        let carol = members.pop().expect("carol");
        let bob = members.pop().expect("bob");
        let ada = members.pop().expect("ada");

        let mut posts = Vec::new();
        for cell in [
            "landed", "pending", "both", "walked", "severed", "empty", "inert", "unsigned", "none",
        ] {
            let id = landed_content(&rig, &carol, PREPARE_POST, "preparePost", post_input()).await;
            posts.push((cell, id));
        }
        let comment = landed_content(
            &rig,
            &carol,
            PREPARE_COMMENT,
            "prepareComment",
            json!({
                "target": posts[0].1,
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
            ada,
            bob,
            carol,
            posts,
            comment,
        };

        let ada = &world.ada;
        let bob = &world.bob;
        world
            .stance(
                ada,
                json!({ "target": world.post("landed") }),
                0.6,
                0.4,
                true,
            )
            .await;
        world
            .stance(ada, json!({ "target": world.post("both") }), 0.3, 0.3, true)
            .await;
        world
            .stance(
                ada,
                json!({ "target": world.post("walked") }),
                0.8,
                -0.4,
                true,
            )
            .await;
        world.sever(ada, &world.post("walked")).await;
        world
            .stance(
                ada,
                json!({ "target": world.post("severed") }),
                0.5,
                0.5,
                true,
            )
            .await;
        world
            .stance(
                ada,
                json!({ "target": world.post("severed") }),
                -0.5,
                -0.5,
                true,
            )
            .await;
        world
            .stance(
                ada,
                json!({ "target": world.post("empty") }),
                0.0,
                0.0,
                true,
            )
            .await;
        world
            .stance(
                ada,
                json!({ "target": world.post("inert") }),
                0.4,
                0.0,
                true,
            )
            .await;
        world
            .stance(ada, json!({ "target": world.comment }), 0.3, -0.2, true)
            .await;
        world
            .stance(ada, json!({ "target": world.carol.id }), 0.5, 0.5, true)
            .await;
        world
            .stance(ada, json!({ "topicName": "rust" }), 0.2, 0.8, true)
            .await;
        world
            .stance(
                bob,
                json!({ "target": world.post("landed") }),
                -0.3,
                0.9,
                true,
            )
            .await;
        world
            .stance(bob, json!({ "target": world.carol.id }), -0.7, 0.1, true)
            .await;

        world
            .stance(
                ada,
                json!({ "target": world.post("pending") }),
                0.7,
                0.7,
                false,
            )
            .await;
        world
            .stance(
                ada,
                json!({ "target": world.post("both") }),
                0.2,
                -0.1,
                false,
            )
            .await;
        world
            .stance(
                bob,
                json!({ "target": world.post("pending") }),
                -0.2,
                -0.2,
                false,
            )
            .await;
        world
            .prepare_only(ada, &world.post("unsigned"), 0.9, 0.9)
            .await;
        world
    }

    fn post(&self, cell: &str) -> String {
        self.posts
            .iter()
            .find(|(c, _)| *c == cell)
            .map(|(_, id)| id.clone())
            .expect("cell")
    }

    /// One stance signed by `who`; landed only when `land`.
    async fn stance(&self, who: &Member, target: Value, p_d: f64, p_i: f64, land: bool) {
        let mut input = json!({ "pDirected": p_d, "pInterest": p_i });
        for (k, v) in target.as_object().expect("target").clone() {
            input[k.as_str()] = v;
        }
        let prepared = self
            .rig
            .gql(Some(&who.token), PREPARE_STANCE, json!({ "input": input }))
            .await;
        assert_eq!(
            prepared["prepareStance"]["userErrors"],
            json!([]),
            "{prepared}"
        );
        self.rig
            .sign_prepared(&who.token, &who.key, &prepared["prepareStance"]["writes"])
            .await;
        if land {
            self.rig.close_and_ingest().await;
        }
    }

    /// The walk-back gesture, signed and landed.
    async fn sever(&self, who: &Member, target: &str) {
        let prepared = self
            .rig
            .gql(
                Some(&who.token),
                PREPARE_SEVERANCE,
                json!({ "input": { "target": target } }),
            )
            .await;
        assert_eq!(
            prepared["prepareSeverance"]["userErrors"],
            json!([]),
            "{prepared}"
        );
        self.rig
            .sign_prepared(
                &who.token,
                &who.key,
                &prepared["prepareSeverance"]["writes"],
            )
            .await;
        self.rig.close_and_ingest().await;
    }

    /// A stance staged and never signed: no pre-commitment, so no view
    /// counts it.
    async fn prepare_only(&self, who: &Member, target: &str, p_d: f64, p_i: f64) {
        let prepared = self
            .rig
            .gql(
                Some(&who.token),
                PREPARE_STANCE,
                json!({ "input": { "target": target, "pDirected": p_d, "pInterest": p_i } }),
            )
            .await;
        assert_eq!(
            prepared["prepareStance"]["userErrors"],
            json!([]),
            "{prepared}"
        );
    }

    /// Every UUID-addressed target of the matrix: the posts, the comment,
    /// carol's profile, and an id nothing answers to.
    fn node_targets(&self) -> Vec<String> {
        let mut out: Vec<String> = self.posts.iter().map(|(_, id)| id.clone()).collect();
        out.push(self.comment.clone());
        out.push(self.carol.id.to_string());
        out.push(Uuid::new_v4().to_string());
        out
    }

    /// Every face of the matrix for `token`, in ONE request: each target
    /// in both views, with and without each pick, at one depth.
    async fn faces(&self, token: Option<&str>) -> Value {
        let selection = VARIANTS
            .iter()
            .map(|(alias, args)| format!("{alias}: viewerStance{args} {{ {FACE} }}"))
            .collect::<Vec<_>>()
            .join(" ");
        let query = format!(
            r#"query($ids: [UUID!]!) {{
                 nodes(ids: $ids) {{
                   ... on Post {{ id {selection} }}
                   ... on Comment {{ id {selection} }}
                   ... on User {{ id {selection} }}
                 }}
                 topic: hashtag(name: "rust") {{ {selection} }}
                 rust: hashtag(name: "Rust") {{ {selection} }}
               }}"#
        );
        self.rig
            .gql(token, &query, json!({ "ids": self.node_targets() }))
            .await
    }
}

/// The argument variants every target is read under: both views, no pick,
/// an ordinary pick, a severing pick.
const VARIANTS: [(&str, &str); 6] = [
    ("l2", ""),
    ("l1", "(includePending: false)"),
    ("l2pick", "(pick: { pDirected: 0.3, pInterest: -0.2 })"),
    (
        "l1pick",
        "(includePending: false, pick: { pDirected: 0.3, pInterest: -0.2 })",
    ),
    ("l2zero", "(pick: { pDirected: 0.0, pInterest: 0.0 })"),
    (
        "l1zero",
        "(includePending: false, pick: { pDirected: 0.0, pInterest: 0.0 })",
    ),
];

/// The pick and view each variant carries, matching [`VARIANTS`].
const VARIANT_ARGS: [(bool, Option<(f64, f64)>); 6] = [
    (true, None),
    (false, None),
    (true, Some((0.3, -0.2))),
    (false, Some((0.3, -0.2))),
    (true, Some((0.0, 0.0))),
    (false, Some((0.0, 0.0))),
];

fn post_input() -> Value {
    json!({
        "title": "a post",
        "content": "a body",
        "license": { "attribution": 1.0, "provenance": 0.0 },
        "pDirected": 0.1,
        "tags": [{ "name": "rust", "pDirected": 0.1, "pInterest": 1.0 }],
    })
}

/// A content batch prepared, signed and landed by `who`; the node's id.
async fn landed_content(
    rig: &WireRig,
    who: &Member,
    mutation: &str,
    field: &str,
    input: Value,
) -> String {
    let prepared = rig
        .gql(Some(&who.token), mutation, json!({ "input": input }))
        .await;
    assert_eq!(prepared[field]["userErrors"], json!([]), "{prepared}");
    rig.sign_prepared(&who.token, &who.key, &prepared[field]["writes"])
        .await;
    rig.close_and_ingest().await;
    prepared[field]["node"].as_str().expect("node").to_string()
}

/// A face as the single bundle read answers it — the read every face
/// went through, one at a time, before the batch — rendered the way
/// `StanceBundle` renders it. Null exactly where the single read refuses
/// the face as bad input or internal.
fn rendered(
    read: Result<api::stance::TargetBundle, api::stance::StanceError>,
    pick: Option<(f64, f64)>,
) -> Value {
    let read = match read {
        Ok(read) => read,
        Err(api::stance::StanceError::BadInput { .. } | api::stance::StanceError::Internal(_)) => {
            return Value::Null;
        }
        Err(e) => panic!("the single read faulted: {e}"),
    };
    let standing: Standing = read.standing;
    let folded = standing.sum.fold();
    json!({
        "targetGraphId": read.node.to_string(),
        "pDirected": folded.p_d,
        "pInterest": folded.p_i,
        "rawPDirected": standing.sum.p_d,
        "rawPInterest": standing.sum.p_i,
        "recordCount": standing.sum.records,
        "inert": folded.is_inert(),
        "severed": standing.is_severed(),
        "severanceCost": standing.severance_cost(),
        "projected": pick.map(|(p_d, p_i)| {
            let net = standing.sum.project(p_d, p_i);
            json!({
                "pDirected": net.p_d,
                "pInterest": net.p_i,
                "inert": net.is_inert(),
                "severed": net.is_severed(),
            })
        }),
    })
}

/// Every face the single read answers for `viewer`, keyed as
/// [`World::faces`] returns them: `(slot, alias) -> face`, the slot being
/// the target's index in `nodes`, or `topic` / `rust`.
async fn expected(world: &World, viewer: Uuid) -> Vec<(String, &'static str, Value)> {
    let pool = &world.rig.pool;
    let mut out = Vec::new();
    for (slot, id) in world.node_targets().iter().enumerate() {
        let id: Uuid = id.parse().expect("uuid");
        for ((alias, _), (include_pending, pick)) in VARIANTS.iter().zip(VARIANT_ARGS) {
            let read = api::stance::bundle(pool, viewer, id, include_pending).await;
            out.push((slot.to_string(), *alias, rendered(read, pick)));
        }
    }
    for (slot, name) in [("topic", "rust"), ("rust", "Rust")] {
        for ((alias, _), (include_pending, pick)) in VARIANTS.iter().zip(VARIANT_ARGS) {
            let canonical = common::hashtag::canonicalize(name).expect("a well-formed name");
            let read = api::stance::topic_bundle(pool, viewer, &canonical, include_pending).await;
            out.push((slot.to_string(), *alias, rendered(read, pick)));
        }
    }
    out
}

/// The face at `(slot, alias)` of one [`World::faces`] answer.
fn face<'a>(data: &'a Value, slot: &str, alias: &str) -> &'a Value {
    match slot.parse::<usize>() {
        Ok(index) => &data["nodes"][index][alias],
        Err(_) => &data[slot][alias],
    }
}

/// Every cell of the matrix — each target, both views, every pick — read
/// as one batch in one request, equals the single read of the same face,
/// for each of two viewers.
///
/// A batched member face equals the single bundle read in every cell: both views, every pick, a walk-back, an empty sign, an inert bundle, an act in flight, an unsigned act, no stance and an unknown id.
/// ´claim:stance:a-batched-face-equals-the-single-read´
#[sqlx::test(migrations = "../../migrations")]
async fn a_batched_face_equals_the_single_read(pool: PgPool) {
    let _serial = serial().await;
    let world = World::new(pool).await;
    for viewer in [&world.ada, &world.bob] {
        let data = world.faces(Some(&viewer.token)).await;
        let want = expected(&world, viewer.id).await;
        for (slot, alias, wanted) in &want {
            assert_eq!(
                face(&data, slot, alias),
                wanted,
                "slot {slot} {alias}: {}",
                data
            );
        }
    }

    let ada = world.faces(Some(&world.ada.token)).await;
    let slot = |cell: &str| {
        world
            .posts
            .iter()
            .position(|(c, _)| *c == cell)
            .expect("cell")
    };
    let read = |cell: &str, alias: &str| ada["nodes"][slot(cell)][alias].clone();
    assert_eq!(read("landed", "l2")["pDirected"], 0.6);
    assert_eq!(read("pending", "l2")["recordCount"], 1, "in flight, L2");
    assert_eq!(read("pending", "l1")["recordCount"], 0, "in flight, L1");
    assert_eq!(read("both", "l2")["recordCount"], 2);
    assert_eq!(read("both", "l1")["recordCount"], 1);
    assert_eq!(read("walked", "l1")["severed"], true, "the walk-back");
    assert_eq!(read("severed", "l1")["severed"], true);
    assert_eq!(read("empty", "l1")["severanceCost"], 1, "an empty sign");
    assert_eq!(read("inert", "l1")["inert"], true);
    assert_eq!(read("unsigned", "l2")["recordCount"], 0, "never signed");
    assert_eq!(read("none", "l2")["recordCount"], 0);
    assert_eq!(read("none", "l2pick")["projected"]["pDirected"], 0.3);
    let unknown = world.node_targets().len() - 1;
    assert!(ada["nodes"][unknown].is_null(), "an id nothing answers to");
    assert_eq!(ada["topic"]["l1"]["pInterest"], 0.8, "the follow");
    assert_eq!(ada["topic"]["l1"], ada["rust"]["l1"], "one canonical name");
}

/// Two viewers reading the same nodes — interleaved, and concurrently so
/// their faces can meet in one batch window — each read their own bundle
/// on every face, and a guest reads null on every face.
///
/// Interleaved and concurrent requests of two viewers each read their own stance on every face, and a guest reads null.
/// ´claim:stance:a-face-never-reads-another-viewers-bundle´
#[sqlx::test(migrations = "../../migrations")]
async fn a_face_never_reads_another_viewers_bundle(pool: PgPool) {
    let _serial = serial().await;
    let world = World::new(pool).await;
    let own_ada = world.faces(Some(&world.ada.token)).await;
    let own_bob = world.faces(Some(&world.bob.token)).await;
    assert_ne!(
        own_ada["nodes"][0]["l2"], own_bob["nodes"][0]["l2"],
        "the fixture tells the two viewers apart"
    );

    for _ in 0..3 {
        assert_eq!(world.faces(Some(&world.ada.token)).await, own_ada);
        assert_eq!(world.faces(Some(&world.bob.token)).await, own_bob);
    }
    for _ in 0..5 {
        let (ada, bob, guest) = tokio::join!(
            world.faces(Some(&world.ada.token)),
            world.faces(Some(&world.bob.token)),
            world.faces(None),
        );
        assert_eq!(ada, own_ada, "ada read beside bob");
        assert_eq!(bob, own_bob, "bob read beside ada");
        for (slot, alias, _) in expected(&world, world.ada.id).await {
            assert!(
                face(&guest, &slot, alias).is_null(),
                "guest {slot} {alias}: {guest}"
            );
        }
    }
}

/// A page of member faces at one depth shares one batch: the statements
/// the faces add to a request are the same for one card and for a page,
/// and one of them is the grouped bundle read.
///
/// A page of member faces at one depth costs the same constant number of statements as one face.
/// ´claim:stance:a-page-of-member-faces-is-one-batch´
#[sqlx::test(migrations = "../../migrations")]
async fn a_page_of_member_faces_is_one_batch(pool: PgPool) {
    let _serial = serial().await;
    let world = World::new(pool).await;
    let posts: Vec<String> = world.posts.iter().map(|(_, id)| id.clone()).collect();
    let page = |ids: &[String], faces: bool| {
        let selection = if faces {
            format!("viewerStance {{ {FACE} }}")
        } else {
            "__typename".to_string()
        };
        let query = format!(
            "query($ids: [UUID!]!) {{ nodes(ids: $ids) {{ id ... on Post {{ {selection} }} }} }}"
        );
        let rig = &world.rig;
        let token = world.ada.token.clone();
        let ids = ids.to_vec();
        async move { rig.gql(Some(&token), &query, json!({ "ids": ids })).await }
    };

    let mut added = Vec::new();
    for n in [1, posts.len()] {
        let (_, bare) = statements_of(page(&posts[..n], false)).await;
        let (data, reads) = statements_of(page(&posts[..n], true)).await;
        assert_eq!(data["nodes"].as_array().expect("cards").len(), n);
        println!(
            "{n} member faces: {} statements bare, {} with every face",
            bare.len(),
            reads.len()
        );
        for statement in &reads {
            let line: String = statement.split_whitespace().collect::<Vec<_>>().join(" ");
            println!("  {n}: {}", line.chars().take(110).collect::<String>());
        }
        added.push((n, reads.len().saturating_sub(bare.len()), reads));
    }
    let (_, one, _) = &added[0];
    let (n, page_cost, reads) = &added[1];
    assert_eq!(
        page_cost, one,
        "{n} faces add what one face adds: {page_cost} against {one}"
    );
    assert!(*one <= 8, "a constant of at most eight reads: {one}");
    let batches = reads.iter().filter(|s| s.contains(BATCH_READ)).count();
    assert_eq!(batches, 1, "{reads:#?}");
}
