// The Peer Content Envelope (PCE v0.1.0) — the payload format every
// content-bearing act carries through the seam. The normative spec is the
// L1 team's draft (Peer Content Envelope v0.1.0; adopted for slice 2,
// recorded in data-model.md "The payload envelope"): one deterministic
// CBOR map in CDE form wrapped in self-describe tag 55799, an integer
// keyspace, a four-axis version vector at key 0, a validated text body at
// key 1, and an extension map at key 2 whose keys ≥ 100 belong to guilds.
//
// CoGra's fields ride guild key 49258 (0xC06A) as a nested integer-keyed
// map (data-model.md "CoGra's guild schema"). CoGra currently produces
// only empty-body envelopes, so the spec's §3 text pipeline (Unicode
// normalization and counting for non-empty bodies) is deliberately not
// implemented — it arrives if CoGra ever emits a non-empty key-1 body.
// Everything else is enforced: the magic, Gate P's key-set rule, CDE
// canonicality (decode re-encodes and compares), the §4.4 empty-value
// rules, and the reserved-range rejection.

use std::collections::BTreeMap;

use uuid::Uuid;

use crate::l1::encoding::{DecodeError, Decoder, Encoder};

/// The self-describe tag every envelope is wrapped in (PCE §1.1).
pub const MAGIC_TAG: u64 = 55799;
/// CoGra's guild key (data-model.md "CoGra's guild schema"): 0xC06A —
/// hexspeak "COGA", chosen away from the low numbers other guilds reach
/// for first. Any integer ≥ 100 would be equally valid.
pub const COGRA_GUILD_KEY: u64 = 49258;
/// The version vector CoGra produces (PCE §2.1): package, body,
/// extension-floor, and extension-ceiling axes, all at 1.
pub const VERSION_V1: [u64; 4] = [1, 1, 1, 1];
/// CoGra's guild-map schema version (key 0 of the nested map).
pub const COGRA_SCHEMA_V1: u64 = 1;

const KEY_VERSION: u64 = 0;
const KEY_BODY: u64 = 1;
const KEY_EXTENSIONS: u64 = 2;

const COGRA_KEY_VERSION: u64 = 0;
const COGRA_KEY_NODE: u64 = 1;
const COGRA_KEY_TITLE: u64 = 2;
const COGRA_KEY_DESCRIPTION: u64 = 3;
const COGRA_KEY_BODY: u64 = 4;
// Keys 5 (media manifest) and 6 (provenance chain,
// platform-guidelines.md §5 plank 4) are reserved: never produced yet,
// rejected on read until their slices define them.

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum EnvelopeError {
    /// Gate M: the first three bytes are not the magic `D9 D9F7`.
    #[error("not a content envelope (missing magic tag)")]
    Magic,
    /// Gate M: the tagged item does not decode to the required shape.
    #[error("malformed envelope: {0}")]
    Decode(#[from] DecodeError),
    #[error("malformed envelope: {0}")]
    Shape(&'static str),
    /// Gate P: an unknown package version denies the whole envelope.
    #[error("unknown package version {0}")]
    UnknownPackage(u64),
    /// Gate P: a top-level key outside the package's allowed set.
    #[error("top-level key {0} is not allowed at package version 1")]
    TopLevelKey(u64),
    /// Gate C2: the bytes are not the canonical (CDE) serialization of
    /// their own content.
    #[error("non-canonical envelope encoding")]
    NonCanonical,
    /// §4.4: an optional field carried an in-band empty instead of being
    /// omitted; rejected, never repaired.
    #[error("empty value for optional key {0} must be omitted")]
    ForbiddenEmpty(u64),
    /// §4.2: a reserved key (4–99) with no allocation at (floor 1,
    /// ceiling 1).
    #[error("reserved extension key {0} is not allocated")]
    ReservedKey(u64),
    /// CoGra guild admission (our tightening per PCE §10).
    #[error("cogra guild schema: {0}")]
    Guild(&'static str),
}

/// One extension-map value. The spec types registered keys 0–3 and leaves
/// guild values as `any`; this subset carries what CoGra produces and
/// what the golden vectors exercise.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Uint(u64),
    Text(String),
    Bytes(Vec<u8>),
    Map(BTreeMap<u64, Value>),
}

impl Value {
    fn encode(&self, e: &mut Encoder) {
        match self {
            Value::Uint(v) => {
                e.uint(*v);
            }
            Value::Text(s) => {
                e.text(s);
            }
            Value::Bytes(b) => {
                e.bytes(b);
            }
            Value::Map(m) => {
                e.map(m.len() as u64);
                for (k, v) in m {
                    e.uint(*k);
                    v.encode(e);
                }
            }
        }
    }

    fn decode(d: &mut Decoder) -> Result<Self, EnvelopeError> {
        match d.peek_major() {
            Some(0) => Ok(Value::Uint(d.uint()?)),
            Some(2) => Ok(Value::Bytes(d.bytes()?)),
            Some(3) => Ok(Value::Text(d.text()?)),
            Some(5) => {
                let len = d.map()?;
                let mut m = BTreeMap::new();
                let mut last: Option<u64> = None;
                for _ in 0..len {
                    let k = d.uint()?;
                    if last.is_some_and(|l| k <= l) {
                        return Err(EnvelopeError::NonCanonical);
                    }
                    last = Some(k);
                    m.insert(k, Value::decode(d)?);
                }
                Ok(Value::Map(m))
            }
            _ => Err(EnvelopeError::Shape("unsupported extension value type")),
        }
    }
}

/// A decoded envelope: the version vector, the body, and the extension
/// map (empty when key 2 is absent — §4.4 forbids an in-band empty map).
#[derive(Debug, Clone, PartialEq)]
pub struct Envelope {
    pub version: [u64; 4],
    pub body: String,
    pub extensions: BTreeMap<u64, Value>,
}

impl Envelope {
    /// Serializes canonically (PCE §5): magic tag, definite lengths,
    /// ascending integer keys (the BTreeMap's iteration order).
    pub fn encode(&self) -> Vec<u8> {
        let mut e = Encoder::new();
        e.tag(MAGIC_TAG);
        e.map(if self.extensions.is_empty() { 2 } else { 3 });
        e.uint(KEY_VERSION);
        e.array(4);
        for axis in self.version {
            e.uint(axis);
        }
        e.uint(KEY_BODY);
        e.text(&self.body);
        if !self.extensions.is_empty() {
            e.uint(KEY_EXTENSIONS);
            e.map(self.extensions.len() as u64);
            for (k, v) in &self.extensions {
                e.uint(*k);
                v.encode(&mut e);
            }
        }
        e.finish()
    }

    /// Decodes and admission-checks one envelope: Gate M (magic, shape),
    /// Gate P (package version and key set), Gate C2/C3 (canonical form —
    /// verified by re-encoding), the §4.4 empty rules, and the §4.2
    /// reserved-range rule. The §3 text pipeline is not applied (see the
    /// module comment).
    pub fn decode(bytes: &[u8]) -> Result<Self, EnvelopeError> {
        if bytes.len() < 3 || bytes[0..3] != [0xD9, 0xD9, 0xF7] {
            return Err(EnvelopeError::Magic);
        }
        let mut d = Decoder::new(bytes);
        let tag = d.tag()?;
        if tag != MAGIC_TAG {
            return Err(EnvelopeError::Magic);
        }
        let pairs = d.map()?;
        if !(2..=3).contains(&pairs) {
            return Err(EnvelopeError::Shape("top-level map must have 2–3 keys"));
        }
        if d.uint()? != KEY_VERSION {
            return Err(EnvelopeError::Shape("first key must be 0 (version)"));
        }
        if d.array()? != 4 {
            return Err(EnvelopeError::Shape("version vector must have 4 axes"));
        }
        let mut version = [0u64; 4];
        for axis in &mut version {
            *axis = d.uint()?;
        }
        // Gate P: this reader implements package 1 only; a future package
        // denies the whole envelope (fail-closed).
        if version[0] != 1 {
            return Err(EnvelopeError::UnknownPackage(version[0]));
        }
        if d.uint()? != KEY_BODY {
            return Err(EnvelopeError::Shape("second key must be 1 (body)"));
        }
        let body = d.text()?;
        let mut extensions = BTreeMap::new();
        if pairs == 3 {
            let key = d.uint()?;
            if key != KEY_EXTENSIONS {
                return Err(EnvelopeError::TopLevelKey(key));
            }
            let len = d.map()?;
            if len == 0 {
                // §4.4: the empty extension map must be key omission.
                return Err(EnvelopeError::ForbiddenEmpty(KEY_EXTENSIONS));
            }
            let mut last: Option<u64> = None;
            for _ in 0..len {
                let k = d.uint()?;
                if last.is_some_and(|l| k <= l) {
                    return Err(EnvelopeError::NonCanonical);
                }
                last = Some(k);
                let v = Value::decode(&mut d)?;
                if (4..100).contains(&k) {
                    // §4.2: nothing is allocated at (floor 1, ceiling 1).
                    return Err(EnvelopeError::ReservedKey(k));
                }
                if k < 4 {
                    let empty = match &v {
                        Value::Text(s) => s.is_empty(),
                        Value::Bytes(b) => b.is_empty(),
                        _ => false,
                    };
                    if empty {
                        return Err(EnvelopeError::ForbiddenEmpty(k));
                    }
                }
                extensions.insert(k, v);
            }
        }
        d.finish()?;
        let envelope = Envelope {
            version,
            body,
            extensions,
        };
        // Gate C2/C3 in one move: canonical bytes are the fixed point of
        // decode → encode. Anything non-preferred, unsorted, indefinite,
        // or text-keyed fails to reproduce itself.
        if envelope.encode() != bytes {
            return Err(EnvelopeError::NonCanonical);
        }
        Ok(envelope)
    }
}

/// CoGra's guild fields, as carried under `COGRA_GUILD_KEY`
/// (data-model.md "CoGra's guild schema"). Field presence is meaningful:
/// on a genesis act every supplied field is present; on an edit only the
/// changed fields ride, and a present-but-empty text clears the field
/// (post.md §4 — per-field newest-wins fold). `node` is the L2 UUID the
/// display row shares with the graph; the payload witness covering these
/// bytes is what proves that binding.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CograContent {
    pub node: Uuid,
    pub title: Option<String>,
    pub description: Option<String>,
    pub body: Option<String>,
}

impl CograContent {
    /// Wraps the fields into a full envelope (empty PCE body — CoGra's
    /// key-1 policy this slice; data-model.md "The payload envelope").
    pub fn into_envelope(self) -> Envelope {
        let mut cogra = BTreeMap::new();
        cogra.insert(COGRA_KEY_VERSION, Value::Uint(COGRA_SCHEMA_V1));
        cogra.insert(COGRA_KEY_NODE, Value::Bytes(self.node.as_bytes().to_vec()));
        if let Some(title) = self.title {
            cogra.insert(COGRA_KEY_TITLE, Value::Text(title));
        }
        if let Some(description) = self.description {
            cogra.insert(COGRA_KEY_DESCRIPTION, Value::Text(description));
        }
        if let Some(body) = self.body {
            cogra.insert(COGRA_KEY_BODY, Value::Text(body));
        }
        let mut extensions = BTreeMap::new();
        extensions.insert(COGRA_GUILD_KEY, Value::Map(cogra));
        Envelope {
            version: VERSION_V1,
            body: String::new(),
            extensions,
        }
    }

    /// Serialized payload bytes for the canonical proposal.
    pub fn encode_payload(self) -> Vec<u8> {
        self.into_envelope().encode()
    }

    /// CoGra's guild admission over a decoded envelope (a tightening of
    /// the PCE gates, permitted by PCE §10): version `[1,1,1,1]`, empty
    /// key-1 body, exactly the CoGra guild key, schema version 1, a
    /// 16-byte node id, and no reserved guild fields.
    pub fn from_envelope(envelope: &Envelope) -> Result<Self, EnvelopeError> {
        if envelope.version != VERSION_V1 {
            return Err(EnvelopeError::Guild("unsupported version vector"));
        }
        if !envelope.body.is_empty() {
            return Err(EnvelopeError::Guild("key-1 body must be empty"));
        }
        if envelope.extensions.len() != 1 {
            return Err(EnvelopeError::Guild("exactly one guild key expected"));
        }
        let Some(Value::Map(cogra)) = envelope.extensions.get(&COGRA_GUILD_KEY) else {
            return Err(EnvelopeError::Guild("missing cogra guild map"));
        };
        match cogra.get(&COGRA_KEY_VERSION) {
            Some(Value::Uint(v)) if *v == COGRA_SCHEMA_V1 => {}
            _ => return Err(EnvelopeError::Guild("unsupported cogra schema version")),
        }
        let node = match cogra.get(&COGRA_KEY_NODE) {
            Some(Value::Bytes(b)) => {
                Uuid::from_slice(b).map_err(|_| EnvelopeError::Guild("node id must be 16 bytes"))?
            }
            _ => return Err(EnvelopeError::Guild("missing node id")),
        };
        let text_field = |key: u64| -> Result<Option<String>, EnvelopeError> {
            match cogra.get(&key) {
                None => Ok(None),
                Some(Value::Text(s)) => Ok(Some(s.clone())),
                Some(_) => Err(EnvelopeError::Guild("text field with non-text value")),
            }
        };
        for key in cogra.keys() {
            if *key > COGRA_KEY_BODY {
                return Err(EnvelopeError::Guild("unknown cogra field"));
            }
        }
        Ok(Self {
            node,
            title: text_field(COGRA_KEY_TITLE)?,
            description: text_field(COGRA_KEY_DESCRIPTION)?,
            body: text_field(COGRA_KEY_BODY)?,
        })
    }

    /// Decode + guild admission in one step — the read used at prepare
    /// (self-check of our own construction) and at confirm (promotion
    /// parses the staged payload back out).
    pub fn decode_payload(bytes: &[u8]) -> Result<Self, EnvelopeError> {
        Self::from_envelope(&Envelope::decode(bytes)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(s: &str) -> Vec<u8> {
        let clean: String = s.chars().filter(|c| !c.is_whitespace()).collect();
        (0..clean.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&clean[i..i + 2], 16).expect("hex"))
            .collect()
    }

    fn envelope(body: &str, extensions: BTreeMap<u64, Value>) -> Envelope {
        Envelope {
            version: VERSION_V1,
            body: body.into(),
            extensions,
        }
    }

    // PCE §8.2 value vectors — normative, byte-identical.

    #[test]
    fn vector_1_minimal_body() {
        let bytes = envelope("hello 🌍", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 6A 68656C6C6F20F09F8C8D")
        );
        assert_eq!(Envelope::decode(&bytes).expect("valid").body, "hello 🌍");
    }

    #[test]
    fn vector_2_body_and_link() {
        let mut ext = BTreeMap::new();
        ext.insert(0, Value::Text("https://example.com/img/sunset.jpg".into()));
        let bytes = envelope("sunset over Berlin", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101
                 01 72 73756E736574206F766572204265726C696E
                 02 A1 00 78 22 68747470733A2F2F6578616D706C652E636F6D2F696D672F73756E7365742E6A7067")
        );
        Envelope::decode(&bytes).expect("valid");
    }

    #[test]
    fn vector_3_usr_binary() {
        let mut ext = BTreeMap::new();
        ext.insert(3, Value::Bytes(vec![0xDE, 0xAD, 0xBE, 0xEF]));
        let bytes = envelope("tagged", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101 01 66 746167676564 02 A1 03 44 DEADBEEF")
        );
        Envelope::decode(&bytes).expect("valid");
    }

    #[test]
    fn vector_4_guild_key_round_trip() {
        let mut ext = BTreeMap::new();
        ext.insert(100, Value::Text("guild-data".into()));
        let bytes = envelope("test", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101 01 64 74657374 02 A1 18 64 6A 6775696C642D64617461")
        );
        let decoded = Envelope::decode(&bytes).expect("valid");
        assert_eq!(
            decoded.extensions.get(&100),
            Some(&Value::Text("guild-data".into()))
        );
        assert_eq!(decoded.encode(), bytes);
    }

    #[test]
    fn vector_5_nfc_form() {
        // The vector's serialized form is of the normalized body "café";
        // the §3 normalize transform itself is out of scope (module doc).
        let bytes = envelope("café", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 65 636166C3A9"));
    }

    #[test]
    fn vector_6_max_body() {
        let bytes = envelope(&"a".repeat(140), BTreeMap::new()).encode();
        let mut expected = hex("D9D9F7 A2 00 84 01010101 01 78 8C");
        expected.extend(std::iter::repeat_n(b'a', 140));
        assert_eq!(bytes, expected);
    }

    #[test]
    fn vector_7_multiple_extensions() {
        let mut ext = BTreeMap::new();
        ext.insert(0, Value::Text("https://example.com/img.jpg".into()));
        ext.insert(2, Value::Text("de".into()));
        ext.insert(3, Value::Bytes(vec![0xC0, 0xFF, 0xEE]));
        let bytes = envelope("sunset", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101 01 66 73756E736574
                 02 A3 00 78 1B 68747470733A2F2F6578616D706C652E636F6D2F696D672E6A7067
                 02 62 6465 03 43 C0FFEE")
        );
        Envelope::decode(&bytes).expect("valid");
    }

    #[test]
    fn vector_8_multi_byte_cluster() {
        let bytes = envelope("photographer 🇩🇪", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 75 70686F746F67726170686572 20 F09F87A9F09F87AA")
        );
        assert_eq!(bytes.len(), 33);
    }

    #[test]
    fn vector_9_whitespace_preservation() {
        let bytes = envelope("a  b\n\nc", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 67 61 20 20 62 0A 0A 63")
        );
        assert_eq!(bytes.len(), 19);
    }

    #[test]
    fn vector_10_empty_body() {
        let bytes = envelope("", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 60"));
        assert_eq!(bytes.len(), 12);
        assert_eq!(Envelope::decode(&bytes).expect("valid").body, "");
    }

    #[test]
    fn vector_16_per_line_trim_output() {
        // Serialized form of the normalized output "a\n\nb" (§3 transform
        // out of scope; the canonical bytes are what we pin).
        let bytes = envelope("a\n\nb", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 64 61 0A 0A 62"));
        assert_eq!(bytes.len(), 16);
    }

    // PCE §8.4 negative vectors (the ones outside the §3 pipeline).

    #[test]
    fn rejects_missing_magic() {
        let mut bytes = envelope("", BTreeMap::new()).encode();
        bytes.drain(0..3);
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::Magic));
    }

    #[test]
    fn rejects_scalar_version() {
        // {0: 1, 1: ""} — version must be an array of four uints.
        let bytes = hex("D9D9F7 A2 00 01 01 60");
        assert!(matches!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Decode(_))
        ));
    }

    #[test]
    fn rejects_three_axis_vector() {
        let bytes = hex("D9D9F7 A2 00 83 010101 01 60");
        assert_eq!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Shape("version vector must have 4 axes"))
        );
    }

    #[test]
    fn rejects_unknown_top_level_key() {
        // {0:[1,1,1,1], 1:"x", 7:42}
        let bytes = hex("D9D9F7 A3 00 84 01010101 01 61 78 07 18 2A");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::TopLevelKey(7)));
    }

    #[test]
    fn rejects_unallocated_reserved_key() {
        // {0:[1,1,1,1], 1:"x", 2:{5:h'00'}}
        let bytes = hex("D9D9F7 A3 00 84 01010101 01 61 78 02 A1 05 41 00");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::ReservedKey(5)));
    }

    #[test]
    fn rejects_empty_registered_values_and_empty_map() {
        // {…, 2:{0:""}} — empty link must be omitted.
        let empty_link = hex("D9D9F7 A3 00 84 01010101 01 60 02 A1 00 60");
        assert_eq!(
            Envelope::decode(&empty_link),
            Err(EnvelopeError::ForbiddenEmpty(0))
        );
        // {…, 2:{3:h''}} — empty usr must be omitted.
        let empty_usr = hex("D9D9F7 A3 00 84 01010101 01 60 02 A1 03 40");
        assert_eq!(
            Envelope::decode(&empty_usr),
            Err(EnvelopeError::ForbiddenEmpty(3))
        );
        // {…, 2:{}} — the empty extension map must drop key 2.
        let empty_map = hex("D9D9F7 A3 00 84 01010101 01 60 02 A0");
        assert_eq!(
            Envelope::decode(&empty_map),
            Err(EnvelopeError::ForbiddenEmpty(2))
        );
    }

    #[test]
    fn rejects_unknown_package_version() {
        // Vector 15: [2,1,1,1] — deny the whole envelope.
        let bytes = hex("D9D9F7 A2 00 84 02010101 01 62 6869");
        assert_eq!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::UnknownPackage(2))
        );
    }

    #[test]
    fn rejects_non_canonical_encoding() {
        // Same content as vector 10 but the body length in the two-byte
        // form (78 00 for text(0)) — decodes leniently, fails Gate C2.
        let bytes = hex("D9D9F7 A2 00 84 01010101 01 78 00");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::NonCanonical));
    }

    #[test]
    fn rejects_unsorted_extension_keys() {
        // {…, 2:{2:"de", 0:"https://e.com/"}} — descending keys.
        let bytes = hex(
            "D9D9F7 A3 00 84 01010101 01 60 02 A2 02 62 6465 00 6E 68747470733A2F2F652E636F6D2F",
        );
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::NonCanonical));
    }

    #[test]
    fn rejects_trailing_bytes() {
        let mut bytes = envelope("", BTreeMap::new()).encode();
        bytes.push(0x00);
        assert!(matches!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Decode(DecodeError::Trailing(1)))
        ));
    }

    // CoGra guild schema.

    fn cogra(title: Option<&str>, description: Option<&str>, body: Option<&str>) -> CograContent {
        CograContent {
            node: Uuid::from_bytes([7; 16]),
            title: title.map(Into::into),
            description: description.map(Into::into),
            body: body.map(Into::into),
        }
    }

    #[test]
    fn cogra_round_trips_create_and_edit_shapes() {
        for content in [
            cogra(Some("Title"), Some("A description"), Some("The body")),
            cogra(None, None, Some("comment body")),
            // Edit carrying one changed field.
            cogra(Some("New title"), None, None),
            // Edit clearing a field: present-and-empty.
            cogra(Some(""), None, None),
            // Full-empty create: empty body is a value (api-spec).
            cogra(None, None, Some("")),
        ] {
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograContent::decode_payload(&bytes).expect("valid"),
                content
            );
        }
    }

    #[test]
    fn cogra_envelope_is_canonical_and_magic_prefixed() {
        let bytes = cogra(Some("t"), None, Some("b")).encode_payload();
        assert_eq!(&bytes[0..3], &[0xD9, 0xD9, 0xF7]);
        // Guild key 49258 = 0xC06A rides as a two-byte uint: 19 C0 6A.
        let needle = [0x19, 0xC0, 0x6A];
        assert!(bytes.windows(3).any(|w| w == needle));
        assert_eq!(Envelope::decode(&bytes).expect("valid").encode(), bytes);
    }

    #[test]
    fn cogra_rejects_wrong_schema_version() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(2));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        let bytes = envelope("", ext).encode();
        assert_eq!(
            CograContent::decode_payload(&bytes),
            Err(EnvelopeError::Guild("unsupported cogra schema version"))
        );
    }

    #[test]
    fn cogra_rejects_missing_or_short_node_id() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner.clone()));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("missing node id"))
        );
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 4]));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("node id must be 16 bytes"))
        );
    }

    #[test]
    fn cogra_rejects_nonempty_pce_body_and_foreign_guild_keys() {
        let content = cogra(None, None, Some("x"));
        let mut env = content.clone().into_envelope();
        env.body = "hi".into();
        assert_eq!(
            CograContent::from_envelope(&env),
            Err(EnvelopeError::Guild("key-1 body must be empty"))
        );
        let mut env = content.into_envelope();
        env.extensions.insert(100, Value::Text("other".into()));
        assert_eq!(
            CograContent::from_envelope(&env),
            Err(EnvelopeError::Guild("exactly one guild key expected"))
        );
    }

    #[test]
    fn cogra_rejects_reserved_guild_fields() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        inner.insert(5, Value::Text("media".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("unknown cogra field"))
        );
    }
}
