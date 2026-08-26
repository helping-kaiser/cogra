//! The prefix path: what `Envelope::peek` reads, what it refuses, and what
//! it deliberately does not certify.

use cogra_interchange::{
    Content, ContentKey, Document, Envelope, EnvelopeError, LabelError, MAX_ENVELOPE_PREFIX,
    NamespaceLabel, Value, Version,
};

fn label(s: &str) -> NamespaceLabel {
    NamespaceLabel::parse(s).expect("a label")
}

fn document(label_str: &str, version: Version, keys: &[u64]) -> Document {
    let mut content = Content::new();
    for key in keys {
        content.insert(
            ContentKey::new(*key).expect("a content key"),
            Value::Unsigned(*key),
        );
    }
    Document::new(Envelope::new(label(label_str), version), content)
}

/// The envelope a document is decoded to, and the envelope peeked out of
/// its name, are the same envelope — and the peek stays inside the bound.
#[test]
fn peek_agrees_with_a_full_decode() {
    let documents = [
        document("a.b", Version::new(0, 0, 0), &[]),
        document("com.example", Version::new(1, 2, 3), &[2, 3, 4]),
        document(
            "org.cogra.feed.rank",
            Version::new(u64::MAX, u64::MAX, u64::MAX),
            &[2, 1_000_000],
        ),
    ];

    for document in documents {
        let bytes = document.to_canonical_bytes();
        let (envelope, consumed) = Envelope::peek(&bytes).expect("an envelope");

        assert_eq!(&envelope, document.envelope());
        assert!(consumed <= MAX_ENVELOPE_PREFIX, "consumed {consumed}");
        assert!(consumed <= bytes.len());

        let cut = bytes.len().min(MAX_ENVELOPE_PREFIX);
        assert_eq!(
            Envelope::peek(&bytes[..cut]).expect("an envelope").0,
            envelope
        );
    }
}

/// The bound is reached exactly: a maximal map head over a maximal label
/// and a maximal version. The map's entries are never read — there are 2³²
/// of them declared and none present — which is the whole point of the
/// bounded read.
#[test]
fn the_bound_is_tight_and_the_tail_is_never_reached() {
    let text = format!("{}.b", "a".repeat(253));
    assert_eq!(text.len(), 255);

    let mut bytes = vec![0xbb];
    bytes.extend_from_slice(&(1u64 << 32).to_be_bytes());
    bytes.push(0x00);
    bytes.extend_from_slice(&[0x78, 0xff]);
    bytes.extend_from_slice(text.as_bytes());
    bytes.push(0x01);
    bytes.push(0x83);
    for _ in 0..3 {
        bytes.push(0x1b);
        bytes.extend_from_slice(&u64::MAX.to_be_bytes());
    }
    assert_eq!(bytes.len(), MAX_ENVELOPE_PREFIX);

    let (envelope, consumed) = Envelope::peek(&bytes).expect("an envelope");
    assert_eq!(consumed, MAX_ENVELOPE_PREFIX);
    assert_eq!(envelope.label().as_str(), text);
    assert_eq!(
        envelope.version(),
        Version::new(u64::MAX, u64::MAX, u64::MAX)
    );
}

/// Routing is early; acceptance is not. A well-formed envelope over a tail
/// that is not in the data language peeks fine and decodes never.
#[test]
fn peek_certifies_no_membership() {
    let document = document("com.example", Version::new(1, 0, 0), &[2]);
    let mut bytes = document.to_canonical_bytes();
    bytes.push(0xff);

    let (envelope, _) = Envelope::peek(&bytes).expect("an envelope");
    assert_eq!(&envelope, document.envelope());

    let error = Document::from_canonical_bytes(&bytes).expect_err("a tail outside the language");
    assert!(matches!(error, EnvelopeError::NotCanonical(_)));
}

/// However much follows the envelope, the read stops at the bound.
#[test]
fn peek_reads_no_more_than_the_bound() {
    let keys: Vec<u64> = (2..2_000).collect();
    let document = document("com.example.thing", Version::new(1, 0, 0), &keys);
    let bytes = document.to_canonical_bytes();
    assert!(bytes.len() > MAX_ENVELOPE_PREFIX * 4);

    let (envelope, consumed) = Envelope::peek(&bytes).expect("an envelope");
    assert!(consumed <= MAX_ENVELOPE_PREFIX);
    assert_eq!(
        Envelope::peek(&bytes[..MAX_ENVELOPE_PREFIX]).expect("an envelope"),
        (envelope, consumed)
    );
}

/// Every proper prefix of an envelope is a request for more bytes, never a
/// rejection; the first prefix that carries the envelope answers.
#[test]
fn a_short_prefix_asks_for_more_bytes() {
    let document = document("com.example", Version::new(1, 2, 3), &[2]);
    let bytes = document.to_canonical_bytes();
    let (_, consumed) = Envelope::peek(&bytes).expect("an envelope");

    for given in 0..consumed {
        let error = Envelope::peek(&bytes[..given]).expect_err("not enough bytes");
        match error {
            EnvelopeError::Truncated {
                given: reported,
                needed_at_least,
            } => {
                assert_eq!(reported, given);
                assert!(needed_at_least > given, "{needed_at_least} > {given}");
                assert!(needed_at_least <= consumed);
            }
            other => panic!("a prefix of {given} bytes answered {other:?}"),
        }
    }

    assert!(Envelope::peek(&bytes[..consumed]).is_ok());
}

#[test]
fn an_empty_prefix_needs_one_byte() {
    let error = Envelope::peek(&[]).expect_err("nothing at all");
    assert!(matches!(
        error,
        EnvelopeError::Truncated {
            given: 0,
            needed_at_least: 1
        }
    ));
}

#[test]
fn a_value_that_is_not_a_map_is_refused() {
    for bytes in [
        vec![0x01],
        vec![0x83, 0x01, 0x02, 0x03],
        vec![0x63, 0x61, 0x2e, 0x62],
        vec![0xf6],
    ] {
        let error = Envelope::peek(&bytes).expect_err("not a map");
        assert!(matches!(error, EnvelopeError::NotAMap));
    }
}

/// Preferred serialization is checked on every head the prefix path reads,
/// which is what makes its answer agree with a full decode's.
///
/// The cases, in order: a map count spelled with a uint8 argument, an
/// indefinite-length map, a key spelled with a uint8 argument, and a label
/// length spelled with one. Each names the offset it is refused at.
#[test]
fn a_head_outside_preferred_serialization_is_refused() {
    let cases: [(Vec<u8>, usize); 4] = [
        (vec![0xb8, 0x02, 0x00], 0),
        (vec![0xbf, 0x00], 0),
        (vec![0xa2, 0x18, 0x00], 1),
        (vec![0xa2, 0x00, 0x78, 0x03, 0x61, 0x2e, 0x62], 2),
    ];

    for (bytes, offset) in cases {
        let error = Envelope::peek(&bytes).expect_err("not canonical");
        assert!(
            matches!(error, EnvelopeError::NonCanonicalPrefix { offset: at } if at == offset),
            "over {bytes:02x?}: {error:?}"
        );
    }
}

/// Sortedness puts the least key first, so a first key greater than 0 means 0
/// is absent altogether rather than merely later. The cases run from an empty
/// map through one entry and two, and end at a key outside the unsigned
/// integers.
#[test]
fn the_first_two_keys_must_be_0_and_1_in_that_order() {
    let error = Envelope::peek(&[0xa0]).expect_err("no keys at all");
    assert!(matches!(error, EnvelopeError::MissingKey { key: 0 }));

    let error = Envelope::peek(&[0xa1, 0x05, 0x00]).expect_err("key 0 absent");
    assert!(matches!(error, EnvelopeError::MissingKey { key: 0 }));

    let error = Envelope::peek(&[0xa1, 0x00, 0x63, 0x61, 0x2e, 0x62]).expect_err("key 1 absent");
    assert!(matches!(error, EnvelopeError::MissingKey { key: 1 }));

    let error = Envelope::peek(&[0xa2, 0x00, 0x63, 0x61, 0x2e, 0x62, 0x02, 0x00])
        .expect_err("key 1 absent");
    assert!(matches!(error, EnvelopeError::MissingKey { key: 1 }));

    let error = Envelope::peek(&[0xa1, 0x61, 0x61, 0x00]).expect_err("a text key");
    assert!(matches!(error, EnvelopeError::NonIntegerKey { .. }));
}

/// Key 0 is refused for holding an integer and for holding a text string that
/// is no label; key 1 for holding anything other than a version triple.
#[test]
fn key_0_holds_a_label_and_key_1_a_version() {
    let error = Envelope::peek(&[0xa2, 0x00, 0x01]).expect_err("no text at key 0");
    assert!(matches!(error, EnvelopeError::BadLabelType));

    let error = Envelope::peek(&[0xa2, 0x00, 0x63, 0x63, 0x6f, 0x6d]).expect_err("one atom");
    assert!(matches!(
        error,
        EnvelopeError::BadLabel(LabelError::TooFewAtoms)
    ));

    for tail in [
        vec![0x01, 0x01],
        vec![0x01, 0x82, 0x01, 0x00],
        vec![0x01, 0x84, 0x01, 0x00, 0x00, 0x00],
        vec![0x01, 0x83, 0x01, 0x00, 0xf6],
    ] {
        let mut bytes = vec![0xa2, 0x00, 0x63, 0x61, 0x2e, 0x62];
        bytes.extend_from_slice(&tail);
        let error = Envelope::peek(&bytes).expect_err("no version at key 1");
        assert!(matches!(error, EnvelopeError::BadVersion), "{error:?}");
    }
}

/// An over-long label is refused from its declared length alone: the
/// payload is never reached for, which is what keeps the read inside the
/// bound however long the label claims to be — an eight-byte declared length
/// far beyond any prefix included.
#[test]
fn an_over_long_label_is_refused_without_reading_it() {
    let mut bytes = vec![0xa2, 0x00, 0x79, 0x01, 0x00];
    assert_eq!(bytes.len(), 5);
    let error = Envelope::peek(&bytes).expect_err("256 bytes of label");
    assert!(matches!(
        error,
        EnvelopeError::BadLabel(LabelError::TooLong { length: 256 })
    ));

    bytes = vec![0xa2, 0x00, 0x7b];
    bytes.extend_from_slice(&u64::MAX.to_be_bytes());
    let error = Envelope::peek(&bytes).expect_err("an impossible label");
    assert!(matches!(
        error,
        EnvelopeError::BadLabel(LabelError::TooLong { .. })
    ));
}

/// A label whose bytes are not valid UTF-8 is outside the data language,
/// and the prefix path locates it where the decoder would.
#[test]
fn a_label_that_is_not_valid_utf8_is_refused() {
    let bytes = [0xa2, 0x00, 0x63, 0x61, 0xff, 0x62];
    let error = Envelope::peek(&bytes).expect_err("not UTF-8");
    assert!(matches!(
        error,
        EnvelopeError::NonCanonicalPrefix { offset: 4 }
    ));
}
