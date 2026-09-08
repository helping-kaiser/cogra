//! ´mod:module:envelope´
//!
//! The Peer Content Envelope and CoGra's guild schema on top of it — two
//! layers with two owners, so two modules with this one as their facade.
//! [`pce`] is the L1 team's format: the magic tag, the deterministic CBOR
//! map, the gates. [`cogra`] is CoGra's own keyspace inside it, and
//! [`media`] the per-asset manifest both content and profile payloads
//! carry. Every name they export is re-exported here, so `common::envelope`
//! stays the one path callers use.

mod cogra;
mod media;
mod pce;

pub use cogra::{COGRA_SCHEMA_V1, CograContent, CograProfile, SensitiveMark};
pub use media::{MEDIA_DIGEST_LEN, MediaAsset};
pub use pce::{COGRA_GUILD_KEY, Envelope, MAGIC_TAG, VERSION_V1, Value};

use crate::l1::encoding::DecodeError;

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

#[cfg(test)]
mod tests {
    //! The numbered `vector_*` tests are PCE §8.2's normative value vectors,
    //! pinned byte-identical. The `rejects_*` tests are §8.4's negative
    //! vectors, less the ones that live inside the §3 text pipeline. The
    //! rest cover CoGra's own guild schema — the content keys and the
    //! profile keys 7–9 alike.

    use std::collections::BTreeMap;

    use uuid::Uuid;

    use super::cogra::*;
    use super::media::*;
    use super::pce::*;
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

    /// Vector 1: a minimal body, and the shortest envelope there is.
    ///
    /// The encoder produces, byte for byte, what the specification's normative value vectors pin.
    /// ´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´
    #[test]
    fn vector_1_minimal_body() {
        let bytes = envelope("hello 🌍", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 6A 68656C6C6F20F09F8C8D")
        );
        assert_eq!(Envelope::decode(&bytes).expect("valid").body, "hello 🌍");
    }

    /// Vector 2: a body beside a link extension.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
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

    /// Vector 3: binary usr bytes.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
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

    /// Vector 4: a guild key, read back and written again.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
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

    /// The vector pins the serialized form of the already-normalized body
    /// "café"; the §3 normalize transform that produces it is out of scope.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
    #[test]
    fn vector_5_nfc_form() {
        let bytes = envelope("café", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 65 636166C3A9"));
    }

    /// Vector 6: a body at the maximum length.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
    #[test]
    fn vector_6_max_body() {
        let bytes = envelope(&"a".repeat(140), BTreeMap::new()).encode();
        let mut expected = hex("D9D9F7 A2 00 84 01010101 01 78 8C");
        expected.extend(std::iter::repeat_n(b'a', 140));
        assert_eq!(bytes, expected);
    }

    /// Vector 7: several extensions at once.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
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

    /// Vector 8: a multi-byte grapheme cluster.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
    #[test]
    fn vector_8_multi_byte_cluster() {
        let bytes = envelope("photographer 🇩🇪", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 75 70686F746F67726170686572 20 F09F87A9F09F87AA")
        );
        assert_eq!(bytes.len(), 33);
    }

    /// Vector 9: whitespace kept exactly as written.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
    #[test]
    fn vector_9_whitespace_preservation() {
        let bytes = envelope("a  b\n\nc", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 67 61 20 20 62 0A 0A 63")
        );
        assert_eq!(bytes.len(), 19);
    }

    /// Vector 10: an empty body, which is a value and not an absence.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
    #[test]
    fn vector_10_empty_body() {
        let bytes = envelope("", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 60"));
        assert_eq!(bytes.len(), 12);
        assert_eq!(Envelope::decode(&bytes).expect("valid").body, "");
    }

    /// The canonical bytes of the already-trimmed output "a\n\nb"; the §3
    /// transform that produces it is out of scope, its result is what is
    /// pinned.
    ///
    /// (´claim:envelope:every-value-vector-encodes-to-its-pinned-bytes´)
    #[test]
    fn vector_16_per_line_trim_output() {
        let bytes = envelope("a\n\nb", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 64 61 0A 0A 62"));
        assert_eq!(bytes.len(), 16);
    }

    /// A payload that does not open with the self-describe tag is no envelope at all.
    /// ´claim:envelope:a-payload-without-the-magic-is-no-envelope´
    #[test]
    fn rejects_missing_magic() {
        let mut bytes = envelope("", BTreeMap::new()).encode();
        bytes.drain(0..3);
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::Magic));
    }

    /// The bytes carry `{0: 1, 1: ""}`: the version must be an array of four
    /// uints, never a scalar.
    ///
    /// The package version is four uints and nothing else.
    /// ´claim:envelope:the-version-is-four-uints-and-nothing-else´
    #[test]
    fn rejects_scalar_version() {
        let bytes = hex("D9D9F7 A2 00 01 01 60");
        assert!(matches!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Decode(_))
        ));
    }

    /// The other way to get the shape wrong: three axes where four are owed.
    ///
    /// (´claim:envelope:the-version-is-four-uints-and-nothing-else´)
    #[test]
    fn rejects_three_axis_vector() {
        let bytes = hex("D9D9F7 A2 00 83 010101 01 60");
        assert_eq!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Shape("version vector must have 4 axes"))
        );
    }

    /// The bytes carry `{0: [1,1,1,1], 1: "x", 7: 42}` — key 7 is outside
    /// the package's allowed top-level set.
    ///
    /// A top-level key outside the package's own set refuses the envelope.
    /// ´claim:envelope:an-unknown-top-level-key-refuses-the-envelope´
    #[test]
    fn rejects_unknown_top_level_key() {
        let bytes = hex("D9D9F7 A3 00 84 01010101 01 61 78 07 18 2A");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::TopLevelKey(7)));
    }

    /// The bytes carry `{0: [1,1,1,1], 1: "x", 2: {5: h'00'}}` — extension
    /// key 5 falls in the reserved range with nothing allocated to it.
    ///
    /// An extension key in the reserved range with nothing allocated to it refuses the envelope.
    /// ´claim:envelope:an-unallocated-reserved-key-refuses-the-envelope´
    #[test]
    fn rejects_unallocated_reserved_key() {
        let bytes = hex("D9D9F7 A3 00 84 01010101 01 61 78 02 A1 05 41 00");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::ReservedKey(5)));
    }

    /// Three in-band empties, each of which must have been an omission
    /// instead: an empty link at key 0, empty usr bytes at key 3, and the
    /// empty extension map, which must drop key 2 altogether.
    ///
    /// An in-band empty is an omission that was not taken, and is refused rather than folded into absence.
    /// ´claim:envelope:an-in-band-empty-is-refused-rather-than-folded´
    #[test]
    fn rejects_empty_registered_values_and_empty_map() {
        let empty_link = hex("D9D9F7 A3 00 84 01010101 01 60 02 A1 00 60");
        assert_eq!(
            Envelope::decode(&empty_link),
            Err(EnvelopeError::ForbiddenEmpty(0))
        );
        let empty_usr = hex("D9D9F7 A3 00 84 01010101 01 60 02 A1 03 40");
        assert_eq!(
            Envelope::decode(&empty_usr),
            Err(EnvelopeError::ForbiddenEmpty(3))
        );
        let empty_map = hex("D9D9F7 A3 00 84 01010101 01 60 02 A0");
        assert_eq!(
            Envelope::decode(&empty_map),
            Err(EnvelopeError::ForbiddenEmpty(2))
        );
    }

    /// Vector 15: a package axis of 2 denies the whole envelope, not merely
    /// the parts this reader does not understand.
    ///
    /// An unknown package axis denies the whole envelope, never only the parts this reader cannot read.
    /// ´claim:envelope:an-unknown-package-version-denies-the-whole-envelope´
    #[test]
    fn rejects_unknown_package_version() {
        let bytes = hex("D9D9F7 A2 00 84 02010101 01 62 6869");
        assert_eq!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::UnknownPackage(2))
        );
    }

    /// Vector 10's content with the body length in the two-byte form
    /// (`78 00` for text(0)): the decoder is lenient about head widths, so
    /// this parses and then fails Gate C2 on re-encoding.
    ///
    /// Re-encoding is what refuses a non-canonical form, so a lenient parse never admits a second encoding.
    /// ´claim:envelope:re-encoding-is-what-refuses-a-non-canonical-form´
    #[test]
    fn rejects_non_canonical_encoding() {
        let bytes = hex("D9D9F7 A2 00 84 01010101 01 78 00");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::NonCanonical));
    }

    /// The extension map carries `{2: "de", 0: "https://e.com/"}` — keys in
    /// descending order, which no canonical encoding produces.
    ///
    /// Extension keys ride in ascending order, whatever an unsorted map would decode to.
    /// ´claim:envelope:extension-keys-ride-in-ascending-order´
    #[test]
    fn rejects_unsorted_extension_keys() {
        let bytes = hex(
            "D9D9F7 A3 00 84 01010101 01 60 02 A2 02 62 6465 00 6E 68747470733A2F2F652E636F6D2F",
        );
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::NonCanonical));
    }

    /// A byte after the envelope is trailing input, and refuses the whole decode.
    /// ´claim:envelope:a-trailing-byte-refuses-the-decode´
    #[test]
    fn rejects_trailing_bytes() {
        let mut bytes = envelope("", BTreeMap::new()).encode();
        bytes.push(0x00);
        assert!(matches!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Decode(DecodeError::Trailing(1)))
        ));
    }

    fn cogra(title: Option<&str>, description: Option<&str>, body: Option<&str>) -> CograContent {
        CograContent {
            node: Uuid::from_bytes([7; 16]),
            title: title.map(Into::into),
            description: description.map(Into::into),
            body: body.map(Into::into),
            media: Vec::new(),
            sensitive: None,
        }
    }

    fn asset(fill: u8, mime: &str, alt_text: Option<&str>) -> MediaAsset {
        MediaAsset {
            digest: [fill; MEDIA_DIGEST_LEN],
            mime: mime.into(),
            alt_text: alt_text.map(Into::into),
        }
    }

    /// An envelope whose guild map carries the given key-5 value verbatim,
    /// for the shapes `MediaAsset` itself would never construct.
    fn with_media_value(media: Value) -> Vec<u8> {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        inner.insert(COGRA_KEY_MEDIA, media);
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        envelope("", ext).encode()
    }

    fn media_entry(pairs: Vec<(u64, Value)>) -> Value {
        Value::Map(pairs.into_iter().collect())
    }

    fn refuses_media(media: Value, message: &'static str) {
        assert_eq!(
            CograContent::decode_payload(&with_media_value(media)),
            Err(EnvelopeError::Guild(message))
        );
    }

    /// Presence survives the round trip in every shape it carries meaning:
    /// a full create, a create with only a body, an edit carrying one
    /// changed field, an edit clearing a field by present-and-empty, and a
    /// create whose empty body is itself a value (api-spec.md).
    ///
    /// Presence survives the round trip in every shape it carries meaning, absence and present-and-empty apart.
    /// ´claim:envelope:presence-survives-every-shape-that-means-something´
    #[test]
    fn cogra_round_trips_create_and_edit_shapes() {
        for content in [
            cogra(Some("Title"), Some("A description"), Some("The body")),
            cogra(None, None, Some("comment body")),
            cogra(Some("New title"), None, None),
            cogra(Some(""), None, None),
            cogra(None, None, Some("")),
        ] {
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograContent::decode_payload(&bytes).expect("valid"),
                content
            );
        }
    }

    /// The self-mark's three states: unmarked, marked bare, marked with a
    /// reason. Each round-trips, and the unmarked one leaves both keys out
    /// — so an edit that drops the mark encodes exactly like a post that
    /// never carried one.
    ///
    /// The self-mark's three states each round-trip, and the unmarked state leaves its keys out entirely, so dropping the mark encodes like never having carried it.
    /// ´claim:envelope:the-self-mark-round-trips-in-three-states´
    #[test]
    fn cogra_round_trips_the_sensitive_mark() {
        for mark in [
            None,
            Some(SensitiveMark { reason: None }),
            Some(SensitiveMark {
                reason: Some("Depicts an injury".into()),
            }),
        ] {
            let content = CograContent {
                sensitive: mark.clone(),
                ..cogra(Some("Title"), None, Some("body"))
            };
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograContent::decode_payload(&bytes).expect("valid"),
                content
            );
            let keys_present = Envelope::decode(&bytes).ok().and_then(|e| {
                match e.extensions.get(&COGRA_GUILD_KEY) {
                    Some(Value::Map(m)) => Some(m.contains_key(&COGRA_KEY_SENSITIVE)),
                    _ => None,
                }
            });
            assert_eq!(keys_present, Some(mark.is_some()));
        }
    }

    /// A sensitive reason without the mark is refused at decode, so the guild schema never carries a warning with no switch behind it.
    /// ´claim:envelope:a-reason-without-the-mark-is-no-document´
    #[test]
    fn cogra_rejects_a_sensitive_reason_without_the_mark() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        inner.insert(COGRA_KEY_SENSITIVE_REASON, Value::Text("why".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("sensitive reason without the mark"))
        );
    }

    /// The mark is presence, so any encoding other than `1` is a payload
    /// claiming a state the guild schema does not have.
    ///
    /// The mark is presence alone, so any encoded value other than one is refused as a state the guild schema does not have.
    /// ´claim:envelope:the-mark-is-presence-alone´
    #[test]
    fn cogra_rejects_a_sensitive_mark_with_an_unexpected_value() {
        for value in [Value::Uint(0), Value::Uint(2), Value::Text("yes".into())] {
            let mut inner = BTreeMap::new();
            inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
            inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
            inner.insert(COGRA_KEY_SENSITIVE, value);
            let mut ext = BTreeMap::new();
            ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
            assert_eq!(
                CograContent::decode_payload(&envelope("", ext).encode()),
                Err(EnvelopeError::Guild(
                    "sensitive mark with an unexpected value"
                ))
            );
        }
    }

    /// Guild key 49258 is 0xC06A, which rides as the two-byte uint
    /// `19 C0 6A` — the needle searched for below.
    ///
    /// The guild envelope is canonical and magic-prefixed, and its guild key rides where the package puts it.
    /// ´claim:envelope:the-guild-envelope-is-canonical-and-magic-prefixed´
    #[test]
    fn cogra_envelope_is_canonical_and_magic_prefixed() {
        let bytes = cogra(Some("t"), None, Some("b")).encode_payload();
        assert_eq!(&bytes[0..3], &[0xD9, 0xD9, 0xF7]);
        let needle = [0x19, 0xC0, 0x6A];
        assert!(bytes.windows(3).any(|w| w == needle));
        assert_eq!(Envelope::decode(&bytes).expect("valid").encode(), bytes);
    }

    /// A guild payload of an unsupported schema version is refused rather than read as far as it goes.
    /// ´claim:envelope:an-unsupported-guild-schema-version-is-refused´
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

    /// The node id is required and is sixteen bytes, and a payload missing either is refused.
    /// ´claim:envelope:the-node-id-is-required-and-sixteen-bytes´
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

    /// A guild payload leaves the package body empty and carries exactly one guild key.
    /// ´claim:envelope:a-guild-payload-is-one-key-and-an-empty-body´
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

    /// Key 6 (provenance) is still declared and unbuilt, so it is still
    /// refused on read — allocating key 5 lifted the rejection for the
    /// manifest alone.
    ///
    /// A key that is declared and unbuilt is still refused on read, and an allocation lifts the refusal for that key alone.
    /// ´claim:envelope:a-declared-but-unbuilt-key-is-still-refused´
    #[test]
    fn cogra_rejects_the_unbuilt_provenance_key() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        inner.insert(6, Value::Text("provenance".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("unknown cogra field"))
        );
    }

    /// Every manifest shape that carries meaning: a lone asset, a gallery
    /// whose order is its array position, alt text present and absent on
    /// the same manifest, and a media post — an empty body beside a
    /// manifest, which is what the body XOR produces.
    ///
    /// Every media manifest shape that carries meaning survives the round trip.
    /// ´claim:envelope:every-manifest-shape-that-means-something-round-trips´
    #[test]
    fn manifest_round_trips_gallery_shapes() {
        let galleries = [
            vec![asset(1, "image/webp", Some("A sunset"))],
            vec![
                asset(1, "image/webp", Some("First")),
                asset(2, "image/webp", None),
                asset(3, "image/webp", Some("Third")),
            ],
        ];
        for media in galleries {
            let mut content = cogra(Some("Title"), Some("Words beside it"), None);
            content.media = media.clone();
            let bytes = content.clone().encode_payload();
            let decoded = CograContent::decode_payload(&bytes).expect("valid");
            assert_eq!(decoded, content);
            assert_eq!(decoded.media, media, "array position carries order");
        }
    }

    /// An absent manifest and an empty gallery are one state, and the
    /// encoder produces only the absent form — so key 5 never rides an
    /// envelope that has nothing to say with it.
    ///
    /// An absent manifest and an empty gallery are one state, and only the absent form is ever written or read.
    /// ´claim:envelope:an-empty-gallery-and-an-absent-manifest-are-one-state´
    #[test]
    fn an_empty_gallery_omits_the_manifest_key() {
        let bytes = cogra(None, None, Some("text only")).encode_payload();
        let decoded = Envelope::decode(&bytes).expect("valid");
        let Some(Value::Map(guild)) = decoded.extensions.get(&COGRA_GUILD_KEY) else {
            panic!("the guild map");
        };
        assert!(!guild.contains_key(&COGRA_KEY_MEDIA));
        assert!(
            CograContent::decode_payload(&bytes)
                .expect("valid")
                .media
                .is_empty()
        );
    }

    /// The read side of the same state: the in-band empty is refused, not folded.
    ///
    /// (´claim:envelope:an-empty-gallery-and-an-absent-manifest-are-one-state´)
    #[test]
    fn manifest_rejects_an_in_band_empty_gallery() {
        refuses_media(
            Value::Array(Vec::new()),
            "empty media manifest must be omitted",
        );
    }

    /// A manifest is an array of maps, and any other shape is refused rather than coerced.
    /// ´claim:envelope:a-manifest-is-an-array-of-maps´
    #[test]
    fn manifest_rejects_a_non_array_value() {
        refuses_media(
            Value::Text("media".into()),
            "media manifest must be an array",
        );
        refuses_media(Value::Uint(5), "media manifest must be an array");
    }

    /// The same rule one level down, at the entry.
    ///
    /// (´claim:envelope:a-manifest-is-an-array-of-maps´)
    #[test]
    fn manifest_rejects_an_entry_that_is_not_a_map() {
        refuses_media(
            Value::Array(vec![Value::Bytes(vec![1; MEDIA_DIGEST_LEN])]),
            "media entry must be a map",
        );
    }

    /// The nested map runs the outer envelope's reserved-key discipline:
    /// a key a v1 reader does not know refuses the envelope rather than
    /// being dropped, so no reader renders an asset it half-understood.
    ///
    /// A manifest entry runs the envelope's own reserved-key discipline, so no reader renders an asset it half-understood.
    /// ´claim:envelope:a-manifest-entry-keeps-the-reserved-key-discipline´
    #[test]
    fn manifest_rejects_an_unallocated_entry_key() {
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (3, Value::Uint(1080)),
            ])]),
            "unknown media entry field",
        );
    }

    /// An asset carries a well-sized digest or it is refused, nothing else identifying it.
    /// ´claim:envelope:an-asset-carries-a-well-sized-digest´
    #[test]
    fn manifest_rejects_a_missing_or_mis_sized_digest() {
        refuses_media(
            Value::Array(vec![media_entry(vec![(
                ASSET_KEY_MIME,
                Value::Text("image/webp".into()),
            )])]),
            "missing media digest",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Text("not bytes".into())),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
            ])]),
            "missing media digest",
        );
        for length in [0, 16, 31, 33, 64] {
            refuses_media(
                Value::Array(vec![media_entry(vec![
                    (ASSET_KEY_DIGEST, Value::Bytes(vec![1; length])),
                    (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                ])]),
                "media digest must be 32 bytes",
            );
        }
    }

    /// An asset carries a usable mime type or it is refused, nothing else saying how to render it.
    /// ´claim:envelope:an-asset-carries-a-usable-mime-type´
    #[test]
    fn manifest_rejects_a_missing_or_empty_mime() {
        refuses_media(
            Value::Array(vec![media_entry(vec![(
                ASSET_KEY_DIGEST,
                Value::Bytes(vec![1; MEDIA_DIGEST_LEN]),
            )])]),
            "missing media mime",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Uint(1)),
            ])]),
            "missing media mime",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text(String::new())),
            ])]),
            "media mime must not be empty",
        );
    }

    /// Absent alt text is the decorative case; a present-and-empty one
    /// would be a second encoding of it, so it is refused rather than
    /// folded — the same rule PCE §4.4 applies to its own optionals.
    ///
    /// Absent alt text is the decorative case, so a present-and-empty one is refused rather than folded into it.
    /// ´claim:envelope:absent-alt-text-is-the-decorative-case´
    #[test]
    fn manifest_rejects_alt_text_that_is_empty_or_not_text() {
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (ASSET_KEY_ALT_TEXT, Value::Text(String::new())),
            ])]),
            "empty media alt text must be omitted",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (ASSET_KEY_ALT_TEXT, Value::Uint(7)),
            ])]),
            "media alt text must be text",
        );
    }

    /// A manifest is content-family only: the profile reader refuses it
    /// exactly as it refuses every other content key.
    ///
    /// Each guild family refuses the other family's keys rather than passing over them.
    /// ´claim:envelope:each-guild-family-refuses-the-others-keys´
    #[test]
    fn profile_rejects_a_media_manifest() {
        assert_eq!(
            CograProfile::decode_payload(&with_media_value(Value::Array(vec![
                asset(1, "image/webp", None).encode()
            ]))),
            Err(EnvelopeError::Guild("unknown cogra profile field"))
        );
    }

    /// Two galleries differing only in order encode to different bytes,
    /// which is what makes position load-bearing rather than incidental.
    ///
    /// Two galleries differing only in order encode differently, which is what makes position load-bearing.
    /// ´claim:envelope:gallery-order-is-witnessed-by-the-bytes´
    #[test]
    fn manifest_order_is_witnessed() {
        let mut forward = cogra(None, None, None);
        forward.media = vec![asset(1, "image/webp", None), asset(2, "image/webp", None)];
        let mut reversed = cogra(None, None, None);
        reversed.media = vec![asset(2, "image/webp", None), asset(1, "image/webp", None)];
        assert_ne!(forward.encode_payload(), reversed.encode_payload());
    }

    fn profile(
        display_name: Option<&str>,
        bio: Option<&str>,
        website_url: Option<&str>,
    ) -> CograProfile {
        CograProfile {
            node: Uuid::from_bytes([9; 16]),
            display_name: display_name.map(Into::into),
            bio: bio.map(Into::into),
            website_url: website_url.map(Into::into),
            avatar: None,
        }
    }

    /// The three states the image slot carries: untouched, replaced, and
    /// cleared.
    ///
    /// An image slot round-trips in all three states it carries.
    /// ´claim:envelope:an-image-slot-round-trips-in-all-three-states´
    #[test]
    fn profile_round_trips_every_image_slot_state() {
        let cases = [
            None,
            Some(Some(asset(4, "image/webp", Some("Ada, smiling")))),
            Some(Some(asset(5, "image/webp", None))),
            Some(None),
        ];
        for avatar in cases {
            let mut content = profile(None, None, None);
            content.avatar = avatar;
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograProfile::decode_payload(&bytes).expect("valid"),
                content
            );
        }
    }

    /// Key 12 held the profile cover and is retired rather than returned
    /// to the unallocated pool, so a payload carrying it is refused with
    /// the retirement named — never read as whatever 12 might mean next.
    ///
    /// A retired guild key is refused with its retirement named rather than returned to the unallocated pool, so a number that once meant something never gets a second meaning.
    /// ´claim:envelope:a-retired-guild-key-stays-refused´
    #[test]
    fn profile_refuses_the_retired_cover_key() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![9; 16]));
        inner.insert(
            COGRA_KEY_RETIRED_COVER,
            Value::Array(vec![asset(1, "image/webp", None).encode()]),
        );
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("retired cogra profile field"))
        );
    }

    /// An untouched slot rides no key at all, so "leave the avatar alone"
    /// and "clear the avatar" cannot collide on the wire.
    ///
    /// An untouched slot rides no key, so leaving an image alone and clearing it cannot collide on the wire.
    /// ´claim:envelope:an-untouched-slot-rides-no-key´
    #[test]
    fn an_untouched_image_slot_omits_its_key() {
        let bytes = profile(Some("Ada"), None, None).encode_payload();
        let decoded = Envelope::decode(&bytes).expect("valid");
        let Some(Value::Map(guild)) = decoded.extensions.get(&COGRA_GUILD_KEY) else {
            panic!("the guild map");
        };
        assert!(!guild.contains_key(&COGRA_KEY_AVATAR));
    }

    fn refuses_profile_image(slot: Value, message: &'static str) {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![9; 16]));
        inner.insert(COGRA_KEY_AVATAR, slot);
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild(message))
        );
    }

    /// A slot holds one picture. Two would make "the avatar" ambiguous,
    /// and a bare map would be a second encoding of the one-asset case.
    ///
    /// An image slot holds exactly one asset, so neither two of them nor a bare map is admitted.
    /// ´claim:envelope:an-image-slot-holds-exactly-one-asset´
    #[test]
    fn profile_rejects_an_image_slot_that_is_not_one_asset() {
        refuses_profile_image(
            Value::Array(vec![
                asset(1, "image/webp", None).encode(),
                asset(2, "image/webp", None).encode(),
            ]),
            "a profile image is a single asset",
        );
        refuses_profile_image(
            asset(1, "image/webp", None).encode(),
            "a profile image must be an array",
        );
        refuses_profile_image(
            Value::Bytes(vec![1; MEDIA_DIGEST_LEN]),
            "a profile image must be an array",
        );
    }

    /// The entry inside a slot is the same admission a gallery entry gets:
    /// one reader, one rule, whichever key the asset arrived under.
    ///
    /// One asset admission serves every key an asset can arrive under.
    /// ´claim:envelope:one-asset-admission-serves-every-key´
    #[test]
    fn profile_image_entries_run_the_manifest_admission() {
        refuses_profile_image(
            Value::Array(vec![media_entry(vec![(
                ASSET_KEY_MIME,
                Value::Text("image/webp".into()),
            )])]),
            "missing media digest",
        );
        refuses_profile_image(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (3, Value::Uint(1)),
            ])]),
            "unknown media entry field",
        );
    }

    /// The content family refuses the profile's image key the way the
    /// profile family refuses the content family's manifest, and refuses
    /// the retired cover key with it — a number this family never had.
    ///
    /// (´claim:envelope:each-guild-family-refuses-the-others-keys´)
    #[test]
    fn content_rejects_the_profile_image_keys() {
        for key in [COGRA_KEY_AVATAR, COGRA_KEY_RETIRED_COVER] {
            let mut inner = BTreeMap::new();
            inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
            inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
            inner.insert(
                key,
                Value::Array(vec![asset(1, "image/webp", None).encode()]),
            );
            let mut ext = BTreeMap::new();
            ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
            assert_eq!(
                CograContent::decode_payload(&envelope("", ext).encode()),
                Err(EnvelopeError::Guild("unknown cogra field"))
            );
        }
    }

    /// The same presence semantics as content: a full payload, an edit
    /// carrying one changed field, and an edit clearing bio and website by
    /// present-and-empty.
    ///
    /// The profile family carries the presence semantics content does, clearing by present-and-empty included.
    /// ´claim:envelope:the-profile-family-shares-the-presence-semantics´
    #[test]
    fn profile_round_trips_edit_shapes() {
        for content in [
            profile(Some("Ada"), Some("Curious."), Some("https://ada.example")),
            profile(None, Some("New bio"), None),
            profile(None, Some(""), Some("")),
        ] {
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograProfile::decode_payload(&bytes).expect("valid"),
                content
            );
        }
    }

    /// And at the payload, where each reader refuses the other's whole document.
    ///
    /// (´claim:envelope:each-guild-family-refuses-the-others-keys´)
    #[test]
    fn profile_and_content_readers_reject_each_other() {
        let profile_bytes = profile(Some("Ada"), None, None).encode_payload();
        assert_eq!(
            CograContent::decode_payload(&profile_bytes),
            Err(EnvelopeError::Guild("unknown cogra field"))
        );
        let content_bytes = cogra(Some("Title"), None, Some("Body")).encode_payload();
        assert_eq!(
            CograProfile::decode_payload(&content_bytes),
            Err(EnvelopeError::Guild("unknown cogra profile field"))
        );
    }

    /// The profile family's own assigned-and-unbuilt key, refused the same way.
    ///
    /// (´claim:envelope:a-declared-but-unbuilt-key-is-still-refused´)
    #[test]
    fn profile_rejects_assigned_but_unbuilt_payout_key() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![9; 16]));
        inner.insert(10, Value::Text("lq1qq…".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("unknown cogra profile field"))
        );
    }

    /// A profile payload needs its node id, and a field that is not text is refused rather than coerced.
    /// ´claim:envelope:a-profile-field-is-text-and-its-node-id-is-required´
    #[test]
    fn profile_rejects_missing_node_and_non_text_field() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_BIO, Value::Text("bio".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner.clone()));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("missing node id"))
        );
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![9; 16]));
        inner.insert(COGRA_KEY_BIO, Value::Uint(3));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("text field with non-text value"))
        );
    }
}
