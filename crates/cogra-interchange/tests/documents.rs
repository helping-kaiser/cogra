//! Documents: construction, the round trip through bytes, and every way a
//! value fails to be one.

use cogra_interchange::{
    Array, Content, ContentKey, Document, Envelope, EnvelopeError, Map, NamespaceLabel, Negative,
    Text, Value, Version,
};

fn label(s: &str) -> NamespaceLabel {
    NamespaceLabel::parse(s).expect("a label")
}

fn text(s: &str) -> Value {
    Value::Text(Text::from(s.to_owned()))
}

fn content_of(entries: impl IntoIterator<Item = (u64, Value)>) -> Content {
    let mut content = Content::new();
    for (key, value) in entries {
        content.insert(ContentKey::new(key).expect("a content key"), value);
    }
    content
}

fn document(label_str: &str, version: Version, entries: &[(u64, Value)]) -> Document {
    Document::new(
        Envelope::new(label(label_str), version),
        content_of(entries.iter().map(|(k, v)| (*k, v.clone()))),
    )
}

/// Every argument is validated before it arrives, so construction cannot
/// fail and there is no assembly-time check to forget.
///
/// Every part of a document is validated before it arrives, so assembling one cannot fail.
/// ´claim:documents:construction-cannot-fail´
#[test]
fn construction_is_total() {
    let document = document(
        "com.example.thing",
        Version::new(1, 2, 3),
        &[(2, Value::Unsigned(42)), (7, text("hello"))],
    );

    assert_eq!(document.envelope().label().as_str(), "com.example.thing");
    assert_eq!(document.envelope().version(), Version::new(1, 2, 3));
    assert_eq!(document.content().len(), 2);
    assert_eq!(document.content().get(2), Some(&Value::Unsigned(42)));
    assert_eq!(document.content().keys().collect::<Vec<_>>(), [2, 7]);
}

/// A document's name is the canonical map of its envelope keys and its content.
/// ´claim:documents:a-name-is-the-map-of-the-parts´
#[test]
fn the_name_of_a_document_is_the_map_of_its_parts() {
    let document = document("a.b", Version::new(1, 0, 0), &[]);

    assert_eq!(
        document.to_canonical_bytes(),
        [
            0xa2, 0x00, 0x63, 0x61, 0x2e, 0x62, 0x01, 0x83, 0x01, 0x00, 0x00
        ],
    );
}

/// The map view and the byte view agree, which is what lets satisfaction
/// consume the one and transit carry the other.
///
/// A document survives the trip through bytes unchanged, and its map view and byte view agree.
/// ´claim:documents:a-document-round-trips-through-bytes´
#[test]
fn documents_survive_the_round_trip_through_bytes() {
    let documents = [
        document("a.b", Version::new(0, 0, 0), &[]),
        document("com.example", Version::new(1, 0, 0), &[(2, Value::Null)]),
        document(
            "org.cogra.feed",
            Version::new(u64::MAX, 3, 0),
            &[
                (2, Value::Bool(true)),
                (300, text("a value")),
                (u64::MAX, Value::Array(Array::new([Value::Unsigned(1)]))),
            ],
        ),
    ];

    for document in documents {
        let bytes = document.to_canonical_bytes();
        let decoded = Document::from_canonical_bytes(&bytes).expect("a document this crate wrote");
        assert_eq!(decoded, document);
        assert_eq!(decoded.to_canonical_bytes(), bytes);

        assert_eq!(
            Document::try_from_value(&document.to_value()).expect("a document"),
            document
        );
    }
}

/// Content keys are written in ascending order, which for unsigned
/// integers is canonical order — and the decoder, which checks sortedness
/// on the encoded forms, is what says so.
///
/// Content keys are written in the ascending order the decoder requires, whatever order they were inserted in.
/// ´claim:documents:content-keys-are-written-canonically´
#[test]
fn content_keys_are_written_in_canonical_order() {
    let document = document(
        "a.b",
        Version::new(1, 0, 0),
        &[
            (u64::MAX, Value::Null),
            (2, Value::Null),
            (24, Value::Null),
            (256, Value::Null),
            (65_536, Value::Null),
            (4_294_967_296, Value::Null),
        ],
    );

    let bytes = document.to_canonical_bytes();
    let decoded = Document::from_canonical_bytes(&bytes).expect("canonical key order");
    assert_eq!(
        decoded.content().keys().collect::<Vec<_>>(),
        [2, 24, 256, 65_536, 4_294_967_296, u64::MAX]
    );
}

/// A value that is not a map is refused as a document.
/// ´claim:documents:only-a-map-can-be-a-document´
#[test]
fn a_value_that_is_not_a_map_is_not_a_document() {
    for value in [
        Value::Unsigned(1),
        Value::Null,
        text("com.example"),
        Value::Array(Array::new([Value::Unsigned(0)])),
    ] {
        let error = Document::try_from_value(&value).expect_err("not a map");
        assert!(matches!(error, EnvelopeError::NotAMap));
    }
}

/// A map key outside the unsigned integers is refused, and the refusal says which key it was.
/// ´claim:documents:a-document-key-is-an-unsigned-integer´
#[test]
fn a_key_outside_the_unsigned_integers_is_refused() {
    for key in [
        text("zero"),
        Value::Negative(Negative::from_argument(0)),
        Value::Null,
    ] {
        let value = Value::Map(Map::new([(key, Value::Null)]).expect("one key"));
        let error = Document::try_from_value(&value).expect_err("not an unsigned key");
        assert!(matches!(error, EnvelopeError::NonIntegerKey { .. }));
        assert!(error.to_string().ends_with("is not an unsigned integer"));
    }
}

/// A map missing either envelope key is refused, naming the lesser missing key.
/// ´claim:documents:both-envelope-keys-are-required´
#[test]
fn an_absent_envelope_key_is_refused() {
    let no_label = Value::Map(
        Map::new([(Value::Unsigned(1), Version::new(1, 0, 0).to_value())]).expect("one key"),
    );
    let error = Document::try_from_value(&no_label).expect_err("no label");
    assert!(matches!(error, EnvelopeError::MissingKey { key: 0 }));

    let no_version =
        Value::Map(Map::new([(Value::Unsigned(0), text("com.example"))]).expect("one key"));
    let error = Document::try_from_value(&no_version).expect_err("no version");
    assert!(matches!(error, EnvelopeError::MissingKey { key: 1 }));

    let neither = Value::Map(Map::new([(Value::Unsigned(2), Value::Null)]).expect("one key"));
    let error = Document::try_from_value(&neither).expect_err("no envelope at all");
    assert!(matches!(error, EnvelopeError::MissingKey { key: 0 }));
}

/// Key 0 holds a namespace label, a wrong type being told apart from a text that is no label.
/// ´claim:documents:key-0-holds-a-namespace-label´
#[test]
fn key_0_holds_a_namespace_label_or_nothing() {
    for (value, expects_label_error) in [
        (text("com"), true),
        (text("com.Example"), true),
        (text(""), true),
        (Value::Unsigned(0), false),
        (Value::Null, false),
        (Value::Array(Array::new([text("com.example")])), false),
    ] {
        let map = Map::new([
            (Value::Unsigned(0), value),
            (Value::Unsigned(1), Version::new(1, 0, 0).to_value()),
        ])
        .expect("distinct keys");
        let error = Document::try_from_value(&Value::Map(map)).expect_err("no label at key 0");

        if expects_label_error {
            assert!(matches!(error, EnvelopeError::BadLabel(_)));
            assert_eq!(error.to_string(), "key 0 does not hold a namespace label");
        } else {
            assert!(matches!(error, EnvelopeError::BadLabelType));
        }
    }
}

/// Key 1 holds a version triple and admits nothing else in its place.
/// ´claim:documents:key-1-holds-a-version-triple´
#[test]
fn key_1_holds_a_version_triple_or_nothing() {
    for value in [
        Value::Unsigned(1),
        text("1.0.0"),
        Value::Array(Array::new([Value::Unsigned(1), Value::Unsigned(0)])),
        Value::Array(Array::new([
            Value::Unsigned(1),
            Value::Unsigned(0),
            Value::Null,
        ])),
    ] {
        let map = Map::new([
            (Value::Unsigned(0), text("com.example")),
            (Value::Unsigned(1), value),
        ])
        .expect("distinct keys");
        let error = Document::try_from_value(&Value::Map(map)).expect_err("no version at key 1");
        assert!(matches!(error, EnvelopeError::BadVersion));
    }
}

/// The envelope's two keys are not the content's to hold, which is the
/// invariant `ContentKey` carries and the reason content cannot be built
/// over them.
///
/// The two envelope keys cannot be built as content keys, so content can never claim them.
/// ´claim:documents:the-envelope-keys-are-not-content´
#[test]
fn the_envelope_keys_are_refused_as_content_keys() {
    for key in [0, 1] {
        let error = ContentKey::new(key).expect_err("the envelope owns it");
        assert!(matches!(error, EnvelopeError::ReservedContentKey { key: k } if k == key));
    }
    assert!(ContentKey::new(2).is_ok());
}

/// The unsorted case is a map with its keys out of canonical order: it is
/// well-formed CBOR, and no name of the data language.
///
/// Bytes outside the data language are refused as a document before their shape is read.
/// ´claim:documents:bytes-outside-the-language-are-refused´
#[test]
fn bytes_outside_the_data_language_are_not_documents() {
    let unsorted = [0xa2, 0x01, 0x00, 0x00, 0x00];
    let error = Document::from_canonical_bytes(&unsorted).expect_err("unsorted keys");
    assert!(matches!(error, EnvelopeError::NotCanonical(_)));

    let truncated = [0xa2, 0x00];
    let error = Document::from_canonical_bytes(&truncated).expect_err("truncated");
    assert!(matches!(error, EnvelopeError::NotCanonical(_)));
}
