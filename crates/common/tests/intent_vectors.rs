//! Exports `intent-vectors.json` (repo root) — the cross-language vectors
//! pinning the device's intent check (architecture.md "The write path",
//! step 2), which both clients implement and the backend never runs.
//!
//! Each case is a gesture's EXPECTATION — what its form ordered — beside a
//! served batch of canonical proposals and the verdict the device owes. The
//! proposals are encoded here, by the reference wire codec, so both clients
//! are judged over the exact bytes a prepare would hand them; the severance
//! batches are this crate's own `BundleSum::severance_batch`, so the lawful
//! walk-back the clients accept is the one the server stages.
//!
//! Every parameter travels as raw f64 bits, as in `stance-fold-vectors.json`:
//! the check compares with no tolerance, so a document that rounded would
//! pin nothing.
//!
//! A payload-bearing write's expectation names the payload's FIELDS, as the
//! envelope decoder reads them (`envelope-vectors.json`): the served payloads
//! are real envelopes, encoded here by the reference. The `trims` group pins
//! the one server normalization the clients mirror by hand — Rust's
//! `str::trim`, whose whitespace set neither JavaScript's nor Kotlin's
//! `trim` matches.
//!
//! The default run asserts the committed file matches this crate;
//! `make intent-vectors` (UPDATE_INTENT_VECTORS=1) rewrites it.

use std::path::Path;

use common::envelope::{CograContent, CograProfile, MediaAsset, SensitiveMark};
use common::l1::census::Family;
use common::l1::exact::exact_sum;
use common::l1::fold::BundleSum;
use common::l1::identifier::{ActId, NodeId};
use common::l1::wire::encode_proposal;
use common::l1::{Proposal, StructuralBody};
use serde_json::{Value, json};
use uuid::Uuid;

/// This device's address atom in every case.
const ME: &str = "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00";
/// Somebody else's.
const OTHER: &str = "b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0";

const POST: &str = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:3:publish";
const OTHER_POST: &str = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:4:publish";
const MY_POST: &str = "mint:act:c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00:2:publish";
const PERSON: &str = "prof:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0";
const OTHER_PERSON: &str = "prof:a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0";
const LICENSE: &str = "a=0.5;o=1";

fn bits(x: f64) -> String {
    format!("{:016x}", x.to_bits())
}

fn act(author: &str, seq: u64, family: Family) -> ActId {
    ActId::new(author, seq, family).expect("a legal act id")
}

fn own_mint(seq: u64, family: Family) -> String {
    NodeId::Mint(act(ME, seq, family)).to_string()
}

/// One served write, as the fields a prepare could set.
#[derive(Clone)]
struct Served {
    author: &'static str,
    seq: u64,
    family: Family,
    middle: Option<String>,
    target: String,
    p_d: f64,
    p_i: f64,
    settlement_ref: Option<ActId>,
    license: Option<&'static str>,
    parents: Vec<ActId>,
    payload: Vec<u8>,
    deps: Vec<ActId>,
}

impl Served {
    fn new(seq: u64, family: Family, target: &str, p_d: f64, p_i: f64) -> Self {
        Self {
            author: ME,
            seq,
            family,
            middle: None,
            target: target.to_string(),
            p_d,
            p_i,
            settlement_ref: None,
            license: None,
            parents: vec![],
            payload: vec![],
            deps: vec![],
        }
    }

    fn middle(mut self, middle: &str) -> Self {
        self.middle = Some(middle.to_string());
        self
    }

    fn license(mut self, license: &'static str) -> Self {
        self.license = Some(license);
        self
    }

    /// A payload no envelope decoder admits: four bytes past the magic.
    fn payload(mut self) -> Self {
        self.payload = vec![0xd9, 0xd9, 0xf7, 0xa0];
        self
    }

    /// A content payload, encoded by the reference exactly as a prepare
    /// would stage it.
    fn content(mut self, content: CograContent) -> Self {
        self.payload = content.encode_payload();
        self
    }

    fn profile(mut self, profile: CograProfile) -> Self {
        self.payload = profile.encode_payload();
        self
    }

    fn parent(mut self, parent: ActId) -> Self {
        self.parents.push(parent);
        self
    }

    fn dep(mut self, dep: ActId) -> Self {
        self.deps.push(dep);
        self
    }

    fn hex(&self) -> String {
        let proposal = Proposal {
            body: StructuralBody {
                author: self.author.to_string(),
                seq: self.seq,
                family: self.family,
                middle: self
                    .middle
                    .as_deref()
                    .map(|m| NodeId::parse(m).expect("a legal middle")),
                target: NodeId::parse(&self.target).expect("a legal target"),
                p_d: self.p_d,
                p_i: self.p_i,
                settlement_ref: self.settlement_ref.clone(),
                license: self.license.map(str::to_string),
                asserted_parents: self.parents.clone(),
            },
            payload: self.payload.clone(),
            deps: self.deps.clone(),
        };
        hex::encode(encode_proposal(&proposal))
    }
}

fn node(id: &str) -> Value {
    json!({"kind": "node", "id": id})
}

fn own_mint_node() -> Value {
    json!({"kind": "ownMint"})
}

fn minted_by(write: usize) -> Value {
    json!({"kind": "mintedBy", "write": write})
}

fn own_profile() -> Value {
    json!({"kind": "ownProfile"})
}

/// The L2 node ids the payloads bind to.
const POST_NODE: &str = "1c0a0000-0000-4000-8000-000000000001";
const REPLY_NODE: &str = "1c0a0000-0000-4000-8000-000000000002";
const MY_NODE: &str = "1c0a0000-0000-4000-8000-000000000003";
const OTHER_NODE: &str = "1c0a0000-0000-4000-8000-0000000000ff";

fn uuid(s: &str) -> Uuid {
    Uuid::parse_str(s).expect("a node id")
}

fn empty() -> Value {
    json!("empty")
}

fn opt(s: &Option<String>) -> Value {
    s.as_ref().map_or(Value::Null, |s| json!(s))
}

/// One manifest entry as the expectation states it — the fields the
/// envelope decoder reads, digests in lowercase hex.
fn asset_json(a: &MediaAsset) -> Value {
    json!({
        "digest": hex::encode(a.digest),
        "mime": a.mime,
        "altText": opt(&a.alt_text),
        "cover": a.cover.map(hex::encode),
        "coverTaken": a.cover_taken,
        "uploadDigest": a.upload_digest.map(hex::encode),
    })
}

/// What a content payload must decode to.
fn content_expectation(c: &CograContent) -> Value {
    json!({"content": {
        "node": c.node.to_string(),
        "title": opt(&c.title),
        "description": opt(&c.description),
        "body": opt(&c.body),
        "media": c.media.iter().map(asset_json).collect::<Vec<_>>(),
        "sensitive": c.sensitive.as_ref().map(|m| json!({"reason": opt(&m.reason)})),
    }})
}

/// What a profile payload must decode to.
fn profile_expectation(p: &CograProfile) -> Value {
    let avatar = match &p.avatar {
        None => json!({"state": "untouched"}),
        Some(None) => json!({"state": "cleared"}),
        Some(Some(asset)) => json!({"state": "set", "asset": asset_json(asset)}),
    };
    json!({"profile": {
        "node": p.node.to_string(),
        "displayName": opt(&p.display_name),
        "bio": opt(&p.bio),
        "websiteUrl": opt(&p.website_url),
        "avatar": avatar,
    }})
}

/// A still stored as it arrived: its rendition and upload digests are one.
fn still(fill: u8, alt: Option<&str>) -> MediaAsset {
    MediaAsset {
        digest: [fill; 32],
        mime: "image/webp".into(),
        alt_text: alt.map(Into::into),
        cover: None,
        cover_taken: false,
        upload_digest: Some([fill; 32]),
    }
}

/// A gallery post: two pictures, words beside them, a self-mark.
fn post_content() -> CograContent {
    CograContent {
        node: uuid(POST_NODE),
        title: Some("A title".into()),
        description: Some("Beside the pictures".into()),
        body: Some(String::new()),
        media: vec![still(0x11, Some("First")), still(0x12, None)],
        sensitive: Some(SensitiveMark {
            reason: Some("Spoilers ahead".into()),
        }),
    }
}

/// A words post.
fn words_post() -> CograContent {
    CograContent {
        title: Some("A title".into()),
        description: None,
        body: Some("The typed words".into()),
        media: vec![],
        sensitive: None,
        ..post_content()
    }
}

/// A clip the server re-encoded: rendition and upload digests differ, and a
/// taken cover fronts it.
fn clip_post() -> CograContent {
    CograContent {
        title: None,
        description: None,
        media: vec![MediaAsset {
            digest: [0x31; 32],
            mime: "video/mp4".into(),
            alt_text: Some("The river".into()),
            cover: Some([0x32; 32]),
            cover_taken: true,
            upload_digest: Some([0x33; 32]),
        }],
        sensitive: None,
        ..post_content()
    }
}

fn reply_content() -> CograContent {
    CograContent {
        node: uuid(REPLY_NODE),
        title: None,
        description: None,
        body: Some("A reply".into()),
        media: vec![],
        sensitive: None,
    }
}

/// An edit of the post this device authored: the complete new state.
fn edit_content() -> CograContent {
    CograContent {
        node: uuid(POST_NODE),
        title: Some("Edited".into()),
        description: Some("Kept beside the picture".into()),
        body: Some(String::new()),
        media: vec![still(0x21, Some("Kept"))],
        sensitive: None,
    }
}

fn profile_update() -> CograProfile {
    CograProfile {
        node: uuid(MY_NODE),
        display_name: Some("Ada".into()),
        bio: Some("Curious.".into()),
        website_url: None,
        avatar: Some(Some(still(0x51, None))),
    }
}

#[expect(
    clippy::too_many_arguments,
    reason = "one argument per field of the expectation the vector states; a builder would hide which field a case varies"
)]
fn expected(
    family: &str,
    middle: Value,
    target: Value,
    p_d: f64,
    p_i: f64,
    license: Option<&str>,
    parents: &str,
    payload: Value,
) -> Value {
    json!({
        "family": family,
        "middle": middle,
        "target": target,
        "pDirectedBits": bits(p_d),
        "pInterestBits": bits(p_i),
        "license": license,
        "parents": parents,
        "payload": payload,
    })
}

fn netting(family: &str, middle: Option<&str>, target: &str, sum: BundleSum) -> Value {
    json!({
        "family": family,
        "middle": middle,
        "target": target,
        "rawPDirectedBits": bits(sum.p_d),
        "rawPInterestBits": bits(sum.p_i),
        "cost": sum.severance_cost(),
    })
}

fn case(name: &str, writes: Vec<Value>, nets: Vec<Value>, batch: &[Served], accept: bool) -> Value {
    json!({
        "case": name,
        "expectation": {"writes": writes, "netting": nets},
        "batch": batch.iter().map(Served::hex).collect::<Vec<_>>(),
        "verdict": if accept { "accept" } else { "refuse" },
    })
}

/// A post with one topic and one citation: what the composer ordered.
fn post_expectation() -> Vec<Value> {
    vec![
        expected(
            "publish",
            Value::Null,
            own_mint_node(),
            0.1,
            1.0,
            Some(LICENSE),
            "none",
            content_expectation(&post_content()),
        ),
        expected(
            "tag",
            minted_by(0),
            node("name:rust"),
            0.3,
            1.0,
            None,
            "none",
            empty(),
        ),
        expected(
            "reference",
            minted_by(0),
            node(POST),
            0.5,
            0.2,
            None,
            "none",
            empty(),
        ),
    ]
}

/// The batch a faithful prepare stages for it.
fn post_batch() -> Vec<Served> {
    let mint = own_mint(7, Family::Publish);
    let minting = act(ME, 7, Family::Publish);
    vec![
        Served::new(7, Family::Publish, &mint, 0.1, 1.0)
            .license(LICENSE)
            .content(post_content()),
        Served::new(8, Family::Tag, "name:rust", 0.3, 1.0)
            .middle(&mint)
            .dep(minting.clone()),
        Served::new(9, Family::Reference, POST, 0.5, 0.2)
            .middle(&mint)
            .dep(minting),
    ]
}

fn stance_expectation(target: &str, p_d: f64, p_i: f64) -> Vec<Value> {
    let family = if target.starts_with("name:") {
        "affinity"
    } else {
        "opinion"
    };
    vec![expected(
        family,
        Value::Null,
        node(target),
        p_d,
        p_i,
        None,
        "none",
        empty(),
    )]
}

fn stance(target: &str, p_d: f64, p_i: f64) -> Served {
    let family = if target.starts_with("name:") {
        Family::Affinity
    } else {
        Family::Opinion
    };
    Served::new(12, family, target, p_d, p_i)
}

fn post_edit_expectation() -> Value {
    expected(
        "publish",
        Value::Null,
        node(MY_POST),
        0.0,
        1.0,
        None,
        "ownChainHead",
        content_expectation(&edit_content()),
    )
}

fn post_edit() -> Served {
    Served::new(20, Family::Publish, MY_POST, 0.0, 1.0)
        .content(edit_content())
        .parent(act(ME, 15, Family::Publish))
}

fn severance_batch(target: &str, sum: BundleSum, first_seq: u64) -> Vec<Served> {
    sum.severance_batch()
        .into_iter()
        .zip(first_seq..)
        .map(|((p_d, p_i), seq)| stance(target, p_d, p_i).with_seq(seq))
        .collect()
}

impl Served {
    fn with_seq(mut self, seq: u64) -> Self {
        self.seq = seq;
        self
    }
}

fn body_cases() -> Vec<Value> {
    let mut cases = vec![];

    cases.push(case(
        "a post with a topic and a citation, as ordered",
        post_expectation(),
        vec![],
        &post_batch(),
        true,
    ));
    let mut reordered = post_batch();
    reordered.reverse();
    cases.push(case(
        "a batch served in another order is still the gesture ordered",
        post_expectation(),
        vec![],
        &reordered,
        true,
    ));

    let mut altered = post_batch();
    altered[1].p_d = 0.4;
    cases.push(case(
        "a batch with one mismatched write signs none of its writes",
        post_expectation(),
        vec![],
        &altered,
        false,
    ));
    let mut extra = post_batch();
    extra.push(
        Served::new(10, Family::Tag, "name:extra", 0.1, 1.0)
            .middle(&own_mint(7, Family::Publish))
            .dep(act(ME, 7, Family::Publish)),
    );
    cases.push(case(
        "a batch carrying a write the form never ordered is refused whole",
        post_expectation(),
        vec![],
        &extra,
        false,
    ));
    let mut missing = post_batch();
    missing.pop();
    cases.push(case(
        "a batch missing a write the form ordered is refused whole",
        post_expectation(),
        vec![],
        &missing,
        false,
    ));
    let mut licensed = post_batch();
    licensed[0].license = Some("a=0;o=0");
    cases.push(case(
        "a post whose license differs from the form is refused",
        post_expectation(),
        vec![],
        &licensed,
        false,
    ));
    let mut unpayloaded = post_batch();
    unpayloaded[0].payload = vec![];
    cases.push(case(
        "a post served without its payload is refused",
        post_expectation(),
        vec![],
        &unpayloaded,
        false,
    ));
    let mut stray_middle = post_batch();
    stray_middle[1].middle = Some(OTHER_POST.to_string());
    cases.push(case(
        "a topic hung off another node than the post being minted is refused",
        post_expectation(),
        vec![],
        &stray_middle,
        false,
    ));
    let mut not_own_mint = post_batch();
    not_own_mint[0].target = own_mint(6, Family::Publish);
    cases.push(case(
        "a genesis record that does not mint its own node is refused",
        post_expectation(),
        vec![],
        &not_own_mint,
        false,
    ));

    cases.push(case(
        "a stance carrying exactly the picked pair",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[stance(POST, 0.4, 0.2)],
        true,
    ));
    cases.push(case(
        "a stance whose values differ from the picked values is refused before pre-signing",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[stance(POST, 0.4, 0.3)],
        false,
    ));
    cases.push(case(
        "a stance value rounded by the server is refused",
        stance_expectation(POST, 0.1 + 0.2, 0.2),
        vec![],
        &[stance(POST, 0.3, 0.2)],
        false,
    ));
    cases.push(case(
        "the two zeros are one value",
        stance_expectation(POST, -0.0, 0.5),
        vec![],
        &[stance(POST, 0.0, 0.5)],
        true,
    ));
    cases.push(case(
        "a stance served as not a number is refused",
        stance_expectation(POST, 0.1, 0.1),
        vec![],
        &[stance(POST, f64::NAN, 0.1)],
        false,
    ));
    let mut foreign = stance(POST, 0.4, 0.2);
    foreign.author = OTHER;
    cases.push(case(
        "a write authored by another address than this device's key is refused",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[foreign],
        false,
    ));
    let mut affinity = stance(POST, 0.4, 0.2);
    affinity.family = Family::Affinity;
    cases.push(case(
        "a write of another family than the gesture is refused",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[affinity],
        false,
    ));
    cases.push(case(
        "a write naming another target than the one on screen is refused",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[stance(OTHER_POST, 0.4, 0.2)],
        false,
    ));
    cases.push(case(
        "a stance with an injected payload is refused",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[stance(POST, 0.4, 0.2).payload()],
        false,
    ));
    let mut settled = stance(POST, 0.4, 0.2);
    settled.settlement_ref = Some(act(OTHER, 1, Family::Send));
    cases.push(case(
        "a stance with an injected settlement reference is refused",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[settled],
        false,
    ));
    cases.push(case(
        "a stance with an injected license is refused",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[stance(POST, 0.4, 0.2).license(LICENSE)],
        false,
    ));
    cases.push(case(
        "a stance with an injected causal parent is refused",
        stance_expectation(POST, 0.4, 0.2),
        vec![],
        &[stance(POST, 0.4, 0.2).parent(act(ME, 1, Family::Opinion))],
        false,
    ));
    cases.push(case(
        "a follow is an Affinity toward the topic's Type",
        stance_expectation("name:rust", 0.5, 0.5),
        vec![],
        &[stance("name:rust", 0.5, 0.5)],
        true,
    ));

    let reply = vec![expected(
        "review",
        node(POST),
        own_mint_node(),
        0.2,
        0.6,
        Some(LICENSE),
        "none",
        content_expectation(&reply_content()),
    )];
    let served_reply = Served::new(30, Family::Review, &own_mint(30, Family::Review), 0.2, 0.6)
        .middle(POST)
        .license(LICENSE)
        .content(reply_content());
    cases.push(case(
        "a reply to the parent on screen, as ordered",
        reply.clone(),
        vec![],
        std::slice::from_ref(&served_reply),
        true,
    ));
    cases.push(case(
        "a reply whose middle is not the parent on screen is refused",
        reply,
        vec![],
        &[served_reply.middle(OTHER_POST)],
        false,
    ));

    cases
}

/// An edit's cases, ending on its whole acts card: the record, one revised tag,
/// and a citation withdrawal whose bundle needs two counter-records.
fn edit_cases() -> Vec<Value> {
    let mut cases = vec![];
    cases.push(case(
        "a priced no-op edit still passes the intent check",
        vec![post_edit_expectation()],
        vec![],
        &[post_edit()],
        true,
    ));
    let mut foreign_head = post_edit();
    foreign_head.parents = vec![act(OTHER, 15, Family::Publish)];
    cases.push(case(
        "an edit chained behind another author's record is refused",
        vec![post_edit_expectation()],
        vec![],
        &[foreign_head],
        false,
    ));
    cases.push(case(
        "an edit asserting two parents is refused",
        vec![post_edit_expectation()],
        vec![],
        &[post_edit().parent(act(ME, 16, Family::Publish))],
        false,
    ));
    let mut shifted = post_edit();
    shifted.p_d = 0.5;
    cases.push(case(
        "an edit record carrying a stance is refused",
        vec![post_edit_expectation()],
        vec![],
        &[shifted],
        false,
    ));

    let cited = BundleSum {
        p_d: 1.4,
        p_i: 0.25,
        records: 2,
    };
    let walk_back: Vec<Served> = cited
        .severance_batch()
        .into_iter()
        .zip(22..)
        .map(|((p_d, p_i), seq)| {
            Served::new(seq, Family::Reference, PERSON, p_d, p_i).middle(MY_POST)
        })
        .collect();
    let card = vec![
        post_edit_expectation(),
        expected(
            "tag",
            node(MY_POST),
            node("name:rust"),
            0.0,
            0.7,
            None,
            "none",
            empty(),
        ),
    ];
    let card_netting = vec![netting("reference", Some(MY_POST), PERSON, cited)];
    let mut batch = vec![
        post_edit(),
        Served::new(21, Family::Tag, "name:rust", 0.0, 0.7).middle(MY_POST),
    ];
    batch.extend(walk_back.iter().cloned());
    cases.push(case(
        "an edit batch signs only the acts its acts card listed",
        card.clone(),
        card_netting.clone(),
        &batch,
        true,
    ));
    let mut extra_counter = batch.clone();
    extra_counter.push(Served::new(24, Family::Reference, PERSON, 0.0, 0.0).middle(MY_POST));
    cases.push(case(
        "an edit batch with a record count the card never showed is refused",
        card.clone(),
        card_netting.clone(),
        &extra_counter,
        false,
    ));
    let mut unnetted = batch.clone();
    let last = unnetted.len() - 1;
    unnetted[last].p_i = -0.2;
    cases.push(case(
        "a reference withdrawal that does not net its bundle to zero is refused",
        card,
        card_netting,
        &unnetted,
        false,
    ));
    cases
}

fn severance_cases() -> Vec<Value> {
    let mut cases = vec![];
    let sum = BundleSum {
        p_d: 2.3,
        p_i: -0.7,
        records: 4,
    };
    let lawful = severance_batch(POST, sum, 40);
    let shown = vec![netting("opinion", None, POST, sum)];
    cases.push(case(
        "a severance batch that nets the shown bundle to zero",
        vec![],
        shown.clone(),
        &lawful,
        true,
    ));
    // Netting is exact decimal arithmetic (edges.md §1): the device sums the
    // decimals the doubles denote, never the doubles. Floating addition in
    // served order leaves 1.1 − 1 − 0.1 at 8.3e-17 — a lawful batch a float
    // check would refuse — and nets the float-built 2.3 walk-back that the
    // decimal sum does not.
    let floats_miss = BundleSum {
        p_d: 1.1,
        p_i: 0.3,
        records: 2,
    };
    cases.push(case(
        "a walk-back that nets in exact decimal where floating point misses zero",
        vec![],
        vec![netting("opinion", None, POST, floats_miss)],
        &severance_batch(POST, floats_miss, 40),
        true,
    ));
    let float_built = [
        stance(POST, -1.0, 0.7).with_seq(40),
        stance(POST, -1.0, 0.0).with_seq(41),
        stance(POST, -((2.3 - 1.0) - 1.0), 0.0).with_seq(42),
    ];
    cases.push(case(
        "a walk-back that nets only in floating point is refused",
        vec![],
        shown.clone(),
        &float_built,
        false,
    ));
    let mut short = lawful.clone();
    short[0].p_d = -0.9;
    cases.push(case(
        "a severance batch that does not net the bundle to zero is refused",
        vec![],
        shown.clone(),
        &short,
        false,
    ));
    let mut longer = lawful.clone();
    longer.push(stance(POST, 0.0, 0.0).with_seq(43));
    cases.push(case(
        "a severance batch longer than its shown cost is refused",
        vec![],
        shown.clone(),
        &longer,
        false,
    ));
    let mut epsilon = lawful.clone();
    let last = epsilon.len() - 1;
    epsilon[last].p_d = f64::from_bits(epsilon[last].p_d.to_bits() + 1);
    cases.push(case(
        "a severance batch off by epsilon is refused",
        vec![],
        shown.clone(),
        &epsilon,
        false,
    ));
    let mut stray = lawful.clone();
    stray[1].target = OTHER_POST.to_string();
    cases.push(case(
        "a severance record toward another target is refused",
        vec![],
        shown.clone(),
        &stray,
        false,
    ));
    let mut wide = lawful;
    wide[0].p_d = -1.3;
    wide[1].p_d = -0.7;
    cases.push(case(
        "a severance record outside the census range is refused",
        vec![],
        shown,
        &wide,
        false,
    ));
    cases
}

fn other_cases() -> Vec<Value> {
    let mut cases = vec![];
    let profile = vec![expected(
        "registration",
        Value::Null,
        own_profile(),
        1.0,
        1.0,
        None,
        "ownChainHead",
        profile_expectation(&profile_update()),
    )];
    let my_profile = format!("prof:{ME}");
    let update = Served::new(50, Family::Registration, &my_profile, 1.0, 1.0)
        .profile(profile_update())
        .parent(act(ME, 0, Family::Registration));
    cases.push(case(
        "a profile update on this device's own profile",
        profile.clone(),
        vec![],
        std::slice::from_ref(&update),
        true,
    ));
    cases.push(case(
        "a profile update aimed at another profile is refused",
        profile,
        vec![],
        &[update.with_target(PERSON)],
        false,
    ));

    let vouch = vec![
        expected(
            "opinion",
            Value::Null,
            node(PERSON),
            0.6,
            0.4,
            None,
            "none",
            empty(),
        ),
        expected(
            "opinion",
            Value::Null,
            node(OTHER_PERSON),
            0.1,
            0.1,
            None,
            "none",
            empty(),
        ),
    ];
    let served = [
        stance(PERSON, 0.6, 0.4).with_seq(60),
        stance(OTHER_PERSON, 0.1, 0.1).with_seq(61),
    ];
    cases.push(case(
        "two vouches, each toward the applicant it was picked for",
        vouch.clone(),
        vec![],
        &served,
        true,
    ));
    cases.push(case(
        "vouches whose picks were swapped between applicants are refused",
        vouch,
        vec![],
        &[
            stance(PERSON, 0.1, 0.1).with_seq(60),
            stance(OTHER_PERSON, 0.6, 0.4).with_seq(61),
        ],
        false,
    ));
    cases
}

impl Served {
    fn with_target(mut self, target: &str) -> Self {
        self.target = target.to_string();
        self
    }
}

/// One genesis Publish carrying `ordered`, served carrying `served`.
fn post_case(name: &str, ordered: &CograContent, served: CograContent, accept: bool) -> Value {
    let expectation = vec![expected(
        "publish",
        Value::Null,
        own_mint_node(),
        0.1,
        1.0,
        Some(LICENSE),
        "none",
        content_expectation(ordered),
    )];
    let batch = [
        Served::new(7, Family::Publish, &own_mint(7, Family::Publish), 0.1, 1.0)
            .license(LICENSE)
            .content(served),
    ];
    case(name, expectation, vec![], &batch, accept)
}

fn edit_case(name: &str, served: CograContent, accept: bool) -> Value {
    case(
        name,
        vec![post_edit_expectation()],
        vec![],
        &[Served::new(20, Family::Publish, MY_POST, 0.0, 1.0)
            .content(served)
            .parent(act(ME, 15, Family::Publish))],
        accept,
    )
}

fn profile_case(name: &str, served: CograProfile, accept: bool) -> Value {
    let my_profile = format!("prof:{ME}");
    case(
        name,
        vec![expected(
            "registration",
            Value::Null,
            own_profile(),
            1.0,
            1.0,
            None,
            "ownChainHead",
            profile_expectation(&profile_update()),
        )],
        vec![],
        &[Served::new(50, Family::Registration, &my_profile, 1.0, 1.0)
            .profile(served)
            .parent(act(ME, 0, Family::Registration))],
        accept,
    )
}

/// The payload's fields against the form: every field the envelope carries,
/// one way to get each wrong.
fn payload_cases() -> Vec<Value> {
    let mut cases = vec![];
    let words = words_post();
    cases.push(post_case(
        "a words post, as typed",
        &words,
        words.clone(),
        true,
    ));
    cases.push(post_case(
        "a post whose envelope body differs from the typed words is refused on device",
        &words,
        CograContent {
            body: Some("The typed word".into()),
            ..words.clone()
        },
        false,
    ));
    let post = post_content();
    cases.push(post_case(
        "a post whose title differs from the form is refused on device",
        &post,
        CograContent {
            title: Some("A tit1e".into()),
            ..post.clone()
        },
        false,
    ));
    cases.push(post_case(
        "a post whose description differs from the form is refused on device",
        &post,
        CograContent {
            description: None,
            ..post.clone()
        },
        false,
    ));
    let mut swapped = post.clone();
    swapped.media.reverse();
    cases.push(post_case(
        "a post whose manifest order differs from the form is refused on device",
        &post,
        swapped,
        false,
    ));
    let mut described = post.clone();
    described.media[1].alt_text = Some("A description nobody wrote".into());
    cases.push(post_case(
        "a post whose alt text differs from the form is refused on device",
        &post,
        described,
        false,
    ));
    let mut other_bytes = post.clone();
    other_bytes.media[0].digest = [0x99; 32];
    cases.push(post_case(
        "an entry whose rendition differs from the asset read at READY is refused on device",
        &post,
        other_bytes,
        false,
    ));
    let mut other_upload = post.clone();
    other_upload.media[0].upload_digest = Some([0x98; 32]);
    cases.push(post_case(
        "an entry whose upload digest is not the device's own is refused on device",
        &post,
        other_upload,
        false,
    ));
    let mut no_upload = post.clone();
    no_upload.media[0].upload_digest = None;
    cases.push(post_case(
        "a served entry without an upload digest is refused on device",
        &post,
        no_upload,
        false,
    ));
    cases.push(post_case(
        "a post whose sensitive mark differs from the form is refused on device",
        &post,
        CograContent {
            sensitive: None,
            ..post.clone()
        },
        false,
    ));
    cases.push(post_case(
        "a post whose sensitive reason differs from the form is refused on device",
        &post,
        CograContent {
            sensitive: Some(SensitiveMark { reason: None }),
            ..post.clone()
        },
        false,
    ));
    cases.push(post_case(
        "an envelope naming another node than the prepared content is refused",
        &post,
        CograContent {
            node: uuid(OTHER_NODE),
            ..post.clone()
        },
        false,
    ));
    let clip = clip_post();
    cases.push(post_case(
        "a transcoded clip carries its rendition digest beside the upload digest of the bytes sent",
        &clip,
        clip.clone(),
        true,
    ));
    let mut other_cover = clip.clone();
    other_cover.media[0].cover = Some([0x34; 32]);
    cases.push(post_case(
        "a post whose cover differs from the form is refused on device",
        &clip,
        other_cover,
        false,
    ));
    let mut chosen = clip.clone();
    chosen.media[0].cover_taken = false;
    cases.push(post_case(
        "a post whose cover-taken mark differs from the form is refused on device",
        &clip,
        chosen,
        false,
    ));
    let ordered = vec![expected(
        "publish",
        Value::Null,
        own_mint_node(),
        0.1,
        1.0,
        Some(LICENSE),
        "none",
        content_expectation(&post),
    )];
    let opaque = Served::new(7, Family::Publish, &own_mint(7, Family::Publish), 0.1, 1.0)
        .license(LICENSE)
        .payload();
    cases.push(case(
        "a payload no envelope decoder admits is refused",
        ordered.clone(),
        vec![],
        std::slice::from_ref(&opaque),
        false,
    ));
    cases.push(case(
        "a profile payload where a post was ordered is refused",
        ordered,
        vec![],
        &[opaque.profile(profile_update())],
        false,
    ));

    let edit = edit_content();
    cases.push(edit_case(
        "an edit keeps unchanged manifest entries byte-identical to the prior version",
        edit.clone(),
        true,
    ));
    cases.push(edit_case(
        "an edit whose unchanged field was altered is refused on device",
        CograContent {
            description: Some("Altered beside the picture".into()),
            ..edit.clone()
        },
        false,
    ));
    let mut extra = edit;
    extra.media.push(still(0x22, None));
    cases.push(edit_case(
        "a new placement this device never uploaded is refused",
        extra,
        false,
    ));

    let ordered = profile_update();
    cases.push(profile_case(
        "a profile update whose name differs from the form is refused on device",
        CograProfile {
            display_name: Some("Eve".into()),
            ..ordered.clone()
        },
        false,
    ));
    cases.push(profile_case(
        "a profile update whose bio differs from the form is refused on device",
        CograProfile {
            bio: Some(String::new()),
            ..ordered.clone()
        },
        false,
    ));
    cases.push(profile_case(
        "a profile update whose website differs from the form is refused on device",
        CograProfile {
            website_url: Some("https://elsewhere.example".into()),
            ..ordered.clone()
        },
        false,
    ));
    cases.push(profile_case(
        "a profile update whose avatar differs from the form is refused on device",
        CograProfile {
            avatar: Some(None),
            ..ordered.clone()
        },
        false,
    ));
    cases.push(profile_case(
        "an avatar whose upload digest is not the device's own is refused on device",
        CograProfile {
            avatar: Some(Some(MediaAsset {
                upload_digest: Some([0x52; 32]),
                ..still(0x51, None)
            })),
            ..ordered
        },
        false,
    ));
    cases
}

/// Rust's `str::trim` over the code points where the three platforms'
/// whitespace sets part: U+FEFF (JavaScript trims it, Rust does not),
/// U+0085 (Rust trims it, JavaScript and Kotlin do not), U+001C–U+001F
/// (Kotlin trims them, Rust does not), and the spaces all three agree on.
/// A title, a description and alt text are trimmed this way and folded to
/// absent when blank; a post's words and a self-mark's reason are only
/// blank-checked.
fn trims() -> Value {
    let inputs = [
        "  plain  ",
        "\u{FEFF}bom\u{FEFF}",
        "\u{00A0}nbsp\u{00A0}",
        "\u{2028}separators\u{2029}",
        "\u{3000}ideographic\u{3000}",
        "\u{0085}next line\u{0085}",
        "\u{001C}info\u{001F}",
        "\u{180E}mongolian\u{180E}",
        "\u{200B}zero width\u{200B}",
        "\u{2007}figure\u{202F}",
        "\t\n\u{000B}\u{000C}\r controls \r\n",
        "inner  \u{00A0} kept",
        "\u{FEFF}",
        "\u{0085}",
        "\u{001C}",
        "\u{00A0}\u{3000}",
        "",
    ];
    Value::Array(
        inputs
            .iter()
            .map(|s| json!({"input": s, "trimmed": s.trim(), "blank": s.trim().is_empty()}))
            .collect(),
    )
}

/// The vectors themselves.
///
/// `version` is 2 since a payload-bearing write's expectation names the
/// payload's fields rather than its presence: a version-1 reader would
/// meet an object where it reads `present`.
fn build_vectors() -> Value {
    let mut cases = body_cases();
    cases.extend(edit_cases());
    cases.extend(severance_cases());
    cases.extend(other_cases());
    cases.extend(payload_cases());
    json!({
        "version": 2,
        "author": ME,
        "cases": cases,
        "trims": trims(),
    })
}

/// The lawful severance the vectors accept is the batch the server stages,
/// and the shown sums plus the batch net to exactly zero in exact decimal
/// arithmetic — the property both clients check, recomputed here against
/// the reference. Floating addition in served order misses zero for some
/// of these, which is why the check is decimal.
///
/// The exported severance batch nets its bundle to exactly zero in exact decimal arithmetic.
/// ´claim:intent:the-exported-severance-nets-exactly´
#[test]
fn the_exported_severance_nets_its_bundle_exactly() {
    for (p_d, p_i) in [(2.3, -0.7), (1.1, 0.3), (1.4, 0.25), (0.1, 0.1), (-3.0, 0.5)] {
        let sum = BundleSum {
            p_d,
            p_i,
            records: 1,
        };
        let batch = sum.severance_batch();
        assert_eq!(batch.len(), sum.severance_cost());
        let net_d = exact_sum(std::iter::once(p_d).chain(batch.iter().map(|(d, _)| *d)));
        let net_i = exact_sum(std::iter::once(p_i).chain(batch.iter().map(|(_, i)| *i)));
        assert!(
            net_d.expect("finite").is_zero() && net_i.expect("finite").is_zero(),
            "({p_d}, {p_i}) walked back by {batch:?}"
        );
    }
    let float_net = [-1.0, -1.0, -0.3].iter().fold(2.3, |s, x| s + x);
    assert_ne!(float_net, 0.0, "served-order floats miss the zero");
}

/// The committed intent vectors match what this crate encodes, so drift fails the build rather than reaching a client.
/// ´claim:intent:the-committed-vectors-match-what-the-crate-encodes´
#[test]
fn exported_intent_vectors_match_the_committed_file() {
    let rendered = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_vectors()).expect("vectors serialize")
    );
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../intent-vectors.json");
    if std::env::var_os("UPDATE_INTENT_VECTORS").is_some() {
        std::fs::write(&path, rendered).expect("write intent-vectors.json");
        return;
    }
    let committed = std::fs::read_to_string(&path)
        .expect("intent-vectors.json is missing — run `make intent-vectors`");
    assert_eq!(
        committed, rendered,
        "intent-vectors.json is stale — run `make intent-vectors`"
    );
}
