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
//! The default run asserts the committed file matches this crate;
//! `make intent-vectors` (UPDATE_INTENT_VECTORS=1) rewrites it.

use std::path::Path;

use common::l1::census::Family;
use common::l1::fold::BundleSum;
use common::l1::identifier::{ActId, NodeId};
use common::l1::wire::encode_proposal;
use common::l1::{Proposal, StructuralBody};
use serde_json::{Value, json};

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

    /// A payload opaque to this check: only presence is compared until the
    /// envelope decoder lands on the clients.
    fn payload(mut self) -> Self {
        self.payload = vec![0xd9, 0xd9, 0xf7, 0xa0];
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
    payload: &str,
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
            "present",
        ),
        expected(
            "tag",
            minted_by(0),
            node("name:rust"),
            0.3,
            1.0,
            None,
            "none",
            "empty",
        ),
        expected(
            "reference",
            minted_by(0),
            node(POST),
            0.5,
            0.2,
            None,
            "none",
            "empty",
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
            .payload(),
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
        "empty",
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
        "present",
    )
}

fn post_edit() -> Served {
    Served::new(20, Family::Publish, MY_POST, 0.0, 1.0)
        .payload()
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
        "present",
    )];
    let served_reply = Served::new(30, Family::Review, &own_mint(30, Family::Review), 0.2, 0.6)
        .middle(POST)
        .license(LICENSE)
        .payload();
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
            "empty",
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
        "present",
    )];
    let my_profile = format!("prof:{ME}");
    let update = Served::new(50, Family::Registration, &my_profile, 1.0, 1.0)
        .payload()
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
            "empty",
        ),
        expected(
            "opinion",
            Value::Null,
            node(OTHER_PERSON),
            0.1,
            0.1,
            None,
            "none",
            "empty",
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

fn build_vectors() -> Value {
    let mut cases = body_cases();
    cases.extend(edit_cases());
    cases.extend(severance_cases());
    cases.extend(other_cases());
    json!({
        "version": 1,
        "author": ME,
        "cases": cases,
    })
}

/// The lawful severance the vectors accept is the batch the server stages,
/// and it nets the shown sums to exactly zero in the order it is served —
/// the property both clients check, recomputed here against the reference.
///
/// The exported severance batch nets its bundle to exactly zero in served order.
/// ´claim:intent:the-exported-severance-nets-exactly´
#[test]
fn the_exported_severance_nets_its_bundle_exactly() {
    for (p_d, p_i) in [(2.3, -0.7), (1.4, 0.25), (0.1, 0.1), (-3.0, 0.5)] {
        let sum = BundleSum {
            p_d,
            p_i,
            records: 1,
        };
        let batch = sum.severance_batch();
        assert_eq!(batch.len(), sum.severance_cost());
        let net = batch
            .iter()
            .fold((p_d, p_i), |(d, i), (bd, bi)| (d + bd, i + bi));
        assert_eq!(net, (0.0, 0.0), "({p_d}, {p_i}) walked back to {net:?}");
    }
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
