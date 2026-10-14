//! Exports `envelope-vectors.json` (repo root) — the cross-language vectors
//! pinning the device's envelope decoder (data-model.md "The payload
//! envelope"), which both clients implement so the intent check can read a
//! payload's fields rather than trusting the server's rendering of them.
//!
//! Three groups, each decoded HERE, by the reference decoder, so a client
//! is judged against exactly what the server reads:
//!
//! - `values` — the PCE's own normative value vectors (PCE v0.1.0 §8.2),
//!   each pinned to the specification's bytes before it is exported, with
//!   the envelope the reference decodes from them;
//! - `content` and `profile` — CoGra's guild schema (guild key 49258): the
//!   bytes a prepare would stage, beside the fields the reference reads
//!   back. Landed history without an upload digest is among them;
//! - `refusals` — bytes the decoder must refuse, at the layer named, with
//!   the reason the reference gives. A refusal from the CBOR layer itself
//!   reads `decode`: the codec's own wording is not part of the contract.
//!
//! The default run asserts the committed file matches this crate;
//! `make envelope-vectors` (UPDATE_ENVELOPE_VECTORS=1) rewrites it.

use std::collections::BTreeMap;
use std::path::Path;

use common::envelope::{
    COGRA_GUILD_KEY, CograContent, CograProfile, Envelope, EnvelopeError, MediaAsset,
    SensitiveMark, VERSION_V1, Value,
};
use serde_json::{Value as Json, json};
use uuid::Uuid;

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(s: &str) -> Vec<u8> {
    let clean: String = s.chars().filter(|c| !c.is_whitespace()).collect();
    (0..clean.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&clean[i..i + 2], 16).expect("hex"))
        .collect()
}

fn opt(s: &Option<String>) -> Json {
    s.as_ref().map_or(Json::Null, |s| json!(s))
}

/// One extension value as the vectors render it: tagged by CBOR type, so
/// a text and a byte string can never read as one another.
fn value_json(v: &Value) -> Json {
    match v {
        Value::Uint(n) => json!({ "uint": n }),
        Value::Text(s) => json!({ "text": s }),
        Value::Bytes(b) => json!({ "bytes": hex(b) }),
        Value::Bool(b) => json!({ "bool": b }),
        Value::Array(items) => json!({ "array": items.iter().map(value_json).collect::<Vec<_>>() }),
        Value::Map(m) => json!({ "map": map_json(m) }),
    }
}

fn map_json(m: &BTreeMap<u64, Value>) -> Json {
    Json::Array(m.iter().map(|(k, v)| json!([k, value_json(v)])).collect())
}

fn envelope_json(e: &Envelope) -> Json {
    json!({
        "version": e.version,
        "body": e.body,
        "extensions": map_json(&e.extensions),
    })
}

fn asset_json(a: &MediaAsset) -> Json {
    json!({
        "digest": hex(&a.digest),
        "mime": a.mime,
        "altText": opt(&a.alt_text),
        "cover": a.cover.map(|c| hex(&c)),
        "coverTaken": a.cover_taken,
        "uploadDigest": a.upload_digest.map(|u| hex(&u)),
    })
}

fn content_json(c: &CograContent) -> Json {
    json!({
        "node": c.node.to_string(),
        "title": opt(&c.title),
        "description": opt(&c.description),
        "body": opt(&c.body),
        "media": c.media.iter().map(asset_json).collect::<Vec<_>>(),
        "sensitive": c.sensitive.as_ref().map(|m| json!({ "reason": opt(&m.reason) })),
    })
}

fn profile_json(p: &CograProfile) -> Json {
    let avatar = match &p.avatar {
        None => json!({ "state": "untouched" }),
        Some(None) => json!({ "state": "cleared" }),
        Some(Some(asset)) => json!({ "state": "set", "asset": asset_json(asset) }),
    };
    json!({
        "node": p.node.to_string(),
        "displayName": opt(&p.display_name),
        "bio": opt(&p.bio),
        "websiteUrl": opt(&p.website_url),
        "avatar": avatar,
    })
}

fn refusal(e: &EnvelopeError) -> String {
    match e {
        EnvelopeError::Decode(_) => "decode".into(),
        other => other.to_string(),
    }
}

fn envelope(body: &str, extensions: BTreeMap<u64, Value>) -> Envelope {
    Envelope {
        version: VERSION_V1,
        body: body.into(),
        extensions,
    }
}

/// One PCE value vector: encoded from its inputs, pinned to the
/// specification's bytes, exported with what the reference decodes.
fn value(name: &str, body: &str, ext: Vec<(u64, Value)>, spec_hex: &str) -> Json {
    let bytes = envelope(body, ext.into_iter().collect()).encode();
    assert_eq!(hex(&bytes), hex(&unhex(spec_hex)), "{name} is the spec's bytes");
    let decoded = Envelope::decode(&bytes).expect("a value vector decodes");
    json!({ "name": name, "hex": hex(&bytes), "envelope": envelope_json(&decoded) })
}

fn values() -> Json {
    let link = |s: &str| Value::Text(s.into());
    Json::Array(vec![
        value(
            "vector 1: minimal body",
            "hello 🌍",
            vec![],
            "D9D9F7 A2 00 84 01010101 01 6A 68656C6C6F20F09F8C8D",
        ),
        value(
            "vector 2: body and link",
            "sunset over Berlin",
            vec![(0, link("https://example.com/img/sunset.jpg"))],
            "D9D9F7 A3 00 84 01010101 01 72 73756E736574206F766572204265726C696E
             02 A1 00 78 22 68747470733A2F2F6578616D706C652E636F6D2F696D672F73756E7365742E6A7067",
        ),
        value(
            "vector 3: usr binary",
            "tagged",
            vec![(3, Value::Bytes(vec![0xDE, 0xAD, 0xBE, 0xEF]))],
            "D9D9F7 A3 00 84 01010101 01 66 746167676564 02 A1 03 44 DEADBEEF",
        ),
        value(
            "vector 4: guild key",
            "test",
            vec![(100, link("guild-data"))],
            "D9D9F7 A3 00 84 01010101 01 64 74657374 02 A1 18 64 6A 6775696C642D64617461",
        ),
        value(
            "vector 5: NFC form",
            "café",
            vec![],
            "D9D9F7 A2 00 84 01010101 01 65 636166C3A9",
        ),
        value(
            "vector 6: max body",
            &"a".repeat(140),
            vec![],
            &format!("D9D9F7 A2 00 84 01010101 01 78 8C {}", "61".repeat(140)),
        ),
        value(
            "vector 7: multiple extensions",
            "sunset",
            vec![
                (0, link("https://example.com/img.jpg")),
                (2, link("de")),
                (3, Value::Bytes(vec![0xC0, 0xFF, 0xEE])),
            ],
            "D9D9F7 A3 00 84 01010101 01 66 73756E736574
             02 A3 00 78 1B 68747470733A2F2F6578616D706C652E636F6D2F696D672E6A7067
             02 62 6465 03 43 C0FFEE",
        ),
        value(
            "vector 8: multi-byte cluster",
            "photographer 🇩🇪",
            vec![],
            "D9D9F7 A2 00 84 01010101 01 75 70686F746F67726170686572 20 F09F87A9F09F87AA",
        ),
        value(
            "vector 9: whitespace preservation",
            "a  b\n\nc",
            vec![],
            "D9D9F7 A2 00 84 01010101 01 67 61 20 20 62 0A 0A 63",
        ),
        value(
            "vector 10: empty body",
            "",
            vec![],
            "D9D9F7 A2 00 84 01010101 01 60",
        ),
        value(
            "vector 16: per-line trim output",
            "a\n\nb",
            vec![],
            "D9D9F7 A2 00 84 01010101 01 64 61 0A 0A 62",
        ),
        value(
            "vector 17: mixed-direction body",
            "السلام عليكم world",
            vec![],
            "D9D9F7 A2 00 84 01010101 01 78 1D
             D8A7 D984 D8B3 D984 D8A7 D985 20
             D8B9 D984 D98A D983 D985 20 77 6F 72 6C 64",
        ),
    ])
}

const NODE: [u8; 16] = [
    0x0c, 0x06, 0xa0, 0x01, 0x23, 0x45, 0x46, 0x78, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67,
];

fn digest(fill: u8) -> [u8; 32] {
    [fill; 32]
}

fn still(fill: u8, alt: Option<&str>) -> MediaAsset {
    MediaAsset {
        digest: digest(fill),
        mime: "image/webp".into(),
        alt_text: alt.map(Into::into),
        cover: None,
        cover_taken: false,
        upload_digest: Some(digest(fill)),
    }
}

fn content(
    title: Option<&str>,
    description: Option<&str>,
    body: Option<&str>,
    media: Vec<MediaAsset>,
    sensitive: Option<SensitiveMark>,
) -> CograContent {
    CograContent {
        node: Uuid::from_bytes(NODE),
        title: title.map(Into::into),
        description: description.map(Into::into),
        body: body.map(Into::into),
        media,
        sensitive,
    }
}

/// A content payload as a prepare would stage it, with what the reference
/// reads back. Landed-history cases bypass the prepare-side admission on
/// purpose: they are what a reader meets, not what a prepare may stage.
fn content_case(name: &str, c: CograContent, staged_by_prepare: bool) -> Json {
    let bytes = if staged_by_prepare {
        c.clone().encode_for_prepare().expect("admitted at prepare")
    } else {
        c.clone().encode_payload()
    };
    let decoded = CograContent::decode_payload(&bytes).expect("a content case decodes");
    assert_eq!(decoded, c, "{name} round-trips");
    json!({
        "name": name,
        "hex": hex(&bytes),
        "admittedAtPrepare": staged_by_prepare,
        "content": content_json(&decoded),
    })
}

fn content_cases() -> Json {
    let clip = MediaAsset {
        digest: digest(0x31),
        mime: "video/mp4".into(),
        alt_text: Some("A clip of the river".into()),
        cover: Some(digest(0x32)),
        cover_taken: true,
        upload_digest: Some(digest(0x33)),
    };
    let landed = MediaAsset {
        upload_digest: None,
        ..still(0x41, Some("Landed before the upload digest"))
    };
    Json::Array(vec![
        content_case(
            "a words post",
            content(Some("A title"), None, Some("The body, in words."), vec![], None),
            true,
        ),
        content_case(
            "a gallery post: order, alt text present and absent, both digests",
            content(
                Some("Look"),
                Some("Words beside it"),
                Some(""),
                vec![still(0x11, Some("First")), still(0x12, None), still(0x13, Some("Third"))],
                None,
            ),
            true,
        ),
        content_case(
            "a re-encoded clip: rendition and upload digests differ, a taken cover",
            content(None, None, Some(""), vec![clip], None),
            true,
        ),
        content_case(
            "a self-marked post with a reason",
            content(
                Some("Marked"),
                None,
                Some("Behind the veil"),
                vec![],
                Some(SensitiveMark {
                    reason: Some("Depicts an injury".into()),
                }),
            ),
            true,
        ),
        content_case(
            "a self-marked comment without a reason",
            content(None, None, Some("a reply"), vec![], Some(SensitiveMark { reason: None })),
            true,
        ),
        content_case(
            "a comment: body only",
            content(None, None, Some("a reply with \u{00A0}spaces\u{2028}kept"), vec![], None),
            true,
        ),
        content_case(
            "landed history: a manifest entry without an upload digest",
            content(None, None, Some(""), vec![landed], None),
            false,
        ),
    ])
}

fn profile_case(name: &str, p: CograProfile) -> Json {
    let bytes = p.clone().encode_for_prepare().expect("admitted at prepare");
    let decoded = CograProfile::decode_payload(&bytes).expect("a profile case decodes");
    assert_eq!(decoded, p, "{name} round-trips");
    json!({ "name": name, "hex": hex(&bytes), "profile": profile_json(&decoded) })
}

fn profile_cases() -> Json {
    let profile = |name: Option<&str>,
                   bio: Option<&str>,
                   site: Option<&str>,
                   avatar: Option<Option<MediaAsset>>| CograProfile {
        node: Uuid::from_bytes(NODE),
        display_name: name.map(Into::into),
        bio: bio.map(Into::into),
        website_url: site.map(Into::into),
        avatar,
    };
    Json::Array(vec![
        profile_case(
            "every text field, the avatar untouched",
            profile(Some("Ada"), Some("Curious."), Some("https://ada.example"), None),
        ),
        profile_case(
            "the avatar set, both digests",
            profile(None, None, None, Some(Some(still(0x51, None)))),
        ),
        profile_case(
            "the avatar cleared",
            profile(None, None, None, Some(None)),
        ),
        profile_case(
            "bio and website cleared by present-and-empty",
            profile(None, Some(""), Some(""), None),
        ),
    ])
}

/// The guild map with the given extra keys, wrapped in a v1 envelope.
fn guild(extra: Vec<(u64, Value)>) -> Vec<u8> {
    let mut inner = BTreeMap::new();
    inner.insert(0, Value::Uint(1));
    inner.insert(1, Value::Bytes(NODE.to_vec()));
    inner.extend(extra);
    let mut ext = BTreeMap::new();
    ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
    envelope("", ext).encode()
}

fn entry(pairs: Vec<(u64, Value)>) -> Value {
    Value::Map(pairs.into_iter().collect())
}

fn ok_entry(extra: Vec<(u64, Value)>) -> Value {
    let mut pairs = vec![
        (0, Value::Bytes(digest(1).to_vec())),
        (1, Value::Text("image/webp".into())),
    ];
    pairs.extend(extra);
    entry(pairs)
}

#[derive(Clone, Copy)]
enum Layer {
    Envelope,
    Content,
    Profile,
}

fn refused(name: &str, layer: Layer, bytes: Vec<u8>) -> Json {
    let (label, result) = match layer {
        Layer::Envelope => ("envelope", Envelope::decode(&bytes).map(|_| ())),
        Layer::Content => ("content", CograContent::decode_payload(&bytes).map(|_| ())),
        Layer::Profile => ("profile", CograProfile::decode_payload(&bytes).map(|_| ())),
    };
    let error = result.expect_err(name);
    json!({ "name": name, "layer": label, "hex": hex(&bytes), "refusal": refusal(&error) })
}

fn refusals() -> Json {
    use Layer::{Content, Envelope as Pce, Profile};
    let mut no_magic = envelope("", BTreeMap::new()).encode();
    no_magic.drain(0..3);
    let mut trailing = envelope("", BTreeMap::new()).encode();
    trailing.push(0);
    let media = |items: Vec<Value>| guild(vec![(5, Value::Array(items))]);
    Json::Array(vec![
        refused("missing magic", Pce, no_magic),
        refused("scalar version", Pce, unhex("D9D9F7 A2 00 01 01 60")),
        refused("three-axis version", Pce, unhex("D9D9F7 A2 00 83 010101 01 60")),
        refused(
            "top-level key 7",
            Pce,
            unhex("D9D9F7 A3 00 84 01010101 01 61 78 07 18 2A"),
        ),
        refused(
            "unallocated reserved key 5",
            Pce,
            unhex("D9D9F7 A3 00 84 01010101 01 61 78 02 A1 05 41 00"),
        ),
        refused(
            "empty link",
            Pce,
            unhex("D9D9F7 A3 00 84 01010101 01 60 02 A1 00 60"),
        ),
        refused(
            "empty alt text",
            Pce,
            unhex("D9D9F7 A3 00 84 01010101 01 60 02 A1 01 60"),
        ),
        refused(
            "empty usr",
            Pce,
            unhex("D9D9F7 A3 00 84 01010101 01 60 02 A1 03 40"),
        ),
        refused(
            "empty extension map",
            Pce,
            unhex("D9D9F7 A3 00 84 01010101 01 60 02 A0"),
        ),
        refused(
            "unknown package version",
            Pce,
            unhex("D9D9F7 A2 00 84 02010101 01 62 6869"),
        ),
        refused(
            "non-canonical length",
            Pce,
            unhex("D9D9F7 A2 00 84 01010101 01 78 00"),
        ),
        refused(
            "unsorted extension keys",
            Pce,
            unhex("D9D9F7 A3 00 84 01010101 01 60 02 A2 02 62 6465 00 6E 68747470733A2F2F652E636F6D2F"),
        ),
        refused("a trailing byte", Pce, trailing),
        refused(
            "a non-empty package body beside the guild map",
            Content,
            {
                let mut inner = BTreeMap::new();
                inner.insert(0, Value::Uint(1));
                inner.insert(1, Value::Bytes(NODE.to_vec()));
                let mut ext = BTreeMap::new();
                ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
                envelope("hi", ext).encode()
            },
        ),
        refused(
            "a second guild key",
            Content,
            {
                let mut inner = BTreeMap::new();
                inner.insert(0, Value::Uint(1));
                inner.insert(1, Value::Bytes(NODE.to_vec()));
                let mut ext = BTreeMap::new();
                ext.insert(100, Value::Text("other".into()));
                ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
                envelope("", ext).encode()
            },
        ),
        refused(
            "guild schema version 2",
            Content,
            {
                let mut inner = BTreeMap::new();
                inner.insert(0, Value::Uint(2));
                inner.insert(1, Value::Bytes(NODE.to_vec()));
                let mut ext = BTreeMap::new();
                ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
                envelope("", ext).encode()
            },
        ),
        refused(
            "a short node id",
            Content,
            {
                let mut inner = BTreeMap::new();
                inner.insert(0, Value::Uint(1));
                inner.insert(1, Value::Bytes(vec![7; 4]));
                let mut ext = BTreeMap::new();
                ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
                envelope("", ext).encode()
            },
        ),
        refused(
            "the unbuilt provenance key",
            Content,
            guild(vec![(6, Value::Text("provenance".into()))]),
        ),
        refused(
            "a profile key on content",
            Content,
            guild(vec![(7, Value::Text("Ada".into()))]),
        ),
        refused(
            "a reason without the mark",
            Content,
            guild(vec![(14, Value::Text("why".into()))]),
        ),
        refused(
            "a mark that is not 1",
            Content,
            guild(vec![(13, Value::Uint(2))]),
        ),
        refused("an in-band empty manifest", Content, media(vec![])),
        refused(
            "a manifest entry with an unknown key",
            Content,
            media(vec![ok_entry(vec![(6, Value::Uint(1080))])]),
        ),
        refused(
            "a mis-sized rendition digest",
            Content,
            media(vec![entry(vec![
                (0, Value::Bytes(vec![1; 31])),
                (1, Value::Text("image/webp".into())),
            ])]),
        ),
        refused(
            "a mis-sized upload digest",
            Content,
            media(vec![ok_entry(vec![(5, Value::Bytes(vec![2; 33]))])]),
        ),
        refused(
            "an upload digest that is text",
            Content,
            media(vec![ok_entry(vec![(5, Value::Text("u".into()))])]),
        ),
        refused(
            "empty alt text in an entry",
            Content,
            media(vec![ok_entry(vec![(2, Value::Text(String::new()))])]),
        ),
        refused(
            "a taken mark without a cover",
            Content,
            media(vec![ok_entry(vec![(4, Value::Bool(true))])]),
        ),
        refused(
            "a taken mark that is false",
            Content,
            media(vec![ok_entry(vec![
                (3, Value::Bytes(digest(9).to_vec())),
                (4, Value::Bool(false)),
            ])]),
        ),
        refused(
            "the retired cover key",
            Profile,
            guild(vec![(12, Value::Array(vec![ok_entry(vec![])]))]),
        ),
        refused(
            "a content key on a profile",
            Profile,
            guild(vec![(2, Value::Text("Title".into()))]),
        ),
        refused(
            "two avatars",
            Profile,
            guild(vec![(11, Value::Array(vec![ok_entry(vec![]), ok_entry(vec![])]))]),
        ),
        refused(
            "an avatar that is a bare map",
            Profile,
            guild(vec![(11, ok_entry(vec![]))]),
        ),
    ])
}

/// The vectors themselves.
///
/// `version` moves only when an existing case changes meaning, the rule
/// every vector file here keeps.
fn build_vectors() -> Json {
    json!({
        "version": 1,
        "values": values(),
        "content": content_cases(),
        "profile": profile_cases(),
        "refusals": refusals(),
    })
}

/// The committed envelope vectors match what this crate decodes, so drift fails the build rather than reaching a client.
/// ´claim:vectors:the-committed-envelope-vectors-match-the-reference´
#[test]
fn exported_envelope_vectors_match_the_committed_file() {
    let rendered = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_vectors()).expect("vectors serialize")
    );
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../envelope-vectors.json");
    if std::env::var_os("UPDATE_ENVELOPE_VECTORS").is_some() {
        std::fs::write(&path, rendered).expect("write envelope-vectors.json");
        return;
    }
    let committed = std::fs::read_to_string(&path)
        .expect("envelope-vectors.json is missing — run `make envelope-vectors`");
    assert_eq!(
        committed, rendered,
        "envelope-vectors.json is stale — run `make envelope-vectors`"
    );
}
