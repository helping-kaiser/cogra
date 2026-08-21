//! The RFC 8949 vector corpus, driven row by row.
//!
//! The corpus was assembled from RFC 8949's own text during the design
//! phase and mechanically re-verified; each row carries the sentence of
//! the standard it stands for. A canonical row must decode, re-encode
//! byte-identically, and round-trip; a refusal row must be refused with a
//! located error, and with the named variant wherever the row's reason
//! fixes one.

mod support;

use cogra_interchange::{DecodeError, Value};
use support::{hex_to_bytes, offset_of, variant_name};

const CORPUS: &str = include_str!("corpus/rfc8949-vectors.json");

/// The seeded set of the design's test plan: 67 canonical rows and 26
/// refusals. The counts are asserted so that a corpus silently losing rows
/// is a failure rather than a smaller test run.
const CANONICAL_ROWS: usize = 67;
const REFUSAL_ROWS: usize = 26;

struct Row {
    hex: String,
    diagnostic: String,
    valid_canonical: bool,
    reason: String,
}

fn corpus() -> Vec<Row> {
    let parsed: serde_json::Value = serde_json::from_str(CORPUS).expect("the corpus is JSON");
    let rows = parsed.as_array().expect("the corpus is an array");
    rows.iter()
        .map(|row| {
            let field = |name: &str| {
                row.get(name)
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_else(|| panic!("row {row} has no string field {name}"))
                    .to_owned()
            };
            Row {
                hex: field("hex"),
                diagnostic: field("diagnostic"),
                valid_canonical: row
                    .get("valid_canonical")
                    .and_then(serde_json::Value::as_bool)
                    .expect("every row states whether it is canonical"),
                reason: field("reason"),
            }
        })
        .collect()
}

#[test]
fn corpus_has_the_seeded_shape() {
    let rows = corpus();
    let canonical = rows.iter().filter(|row| row.valid_canonical).count();
    assert_eq!(canonical, CANONICAL_ROWS);
    assert_eq!(rows.len() - canonical, REFUSAL_ROWS);
}

#[test]
fn canonical_rows_decode_reencode_identically_and_roundtrip() {
    let rows = corpus();
    let mut driven = 0;
    for row in rows.iter().filter(|row| row.valid_canonical) {
        let bytes = hex_to_bytes(&row.hex);
        let context = &row.diagnostic;

        let value = Value::from_canonical_bytes(&bytes)
            .unwrap_or_else(|e| panic!("{context} ({}) was refused: {e}", row.hex));

        let reencoded = value.to_canonical_bytes();
        assert_eq!(reencoded, bytes, "{context} did not re-encode identically");
        assert_eq!(
            value.canonical_len(),
            bytes.len(),
            "{context} mismeasured its own name"
        );

        let again = Value::from_canonical_bytes(&reencoded)
            .unwrap_or_else(|e| panic!("{context} did not round-trip: {e}"));
        assert_eq!(again, value, "{context} decoded to a different structure");

        let (prefix_value, consumed) = Value::from_canonical_prefix(&bytes)
            .unwrap_or_else(|e| panic!("{context} was refused as a prefix: {e}"));
        assert_eq!((prefix_value, consumed), (value, bytes.len()));

        driven += 1;
    }
    assert_eq!(driven, CANONICAL_ROWS);
}

#[test]
fn refusal_rows_are_refused_with_a_located_error() {
    let rows = corpus();
    let mut driven = 0;
    for row in rows.iter().filter(|row| !row.valid_canonical) {
        let bytes = hex_to_bytes(&row.hex);
        let context = &row.diagnostic;

        let error = match Value::from_canonical_bytes(&bytes) {
            Ok(value) => panic!("{context} ({}) was accepted as {value:?}", row.hex),
            Err(error) => error,
        };

        assert!(
            offset_of(&error) <= bytes.len(),
            "{context} was refused at an offset outside the input: {error}"
        );

        match expected_refusal(&bytes, &row.reason) {
            Expected::Exactly(variant) => assert_eq!(
                variant_name(&error),
                variant,
                "{context} was refused as {error}, not as {variant}"
            ),
            Expected::WellFormedness => assert!(
                matches!(
                    error,
                    DecodeError::IllFormed { .. } | DecodeError::Truncated { .. }
                ),
                "{context} claims to be ill-formed but was refused as {error}"
            ),
        }

        driven += 1;
    }
    assert_eq!(driven, REFUSAL_ROWS);
}

enum Expected {
    /// The row's reason fixes one variant.
    Exactly(&'static str),
    /// The row's reason says only that the bytes are not well-formed,
    /// which the crate reports as an ill-formed head or as truncation
    /// depending on which the input ran into first.
    WellFormedness,
}

/// Which refusal a row's own reason calls for.
///
/// The reasons are prose written against the standard, so the clauses are
/// ordered: a reason may name more than one property, and the most
/// specific naming wins.
fn expected_refusal(bytes: &[u8], reason: &str) -> Expected {
    if reason.contains("map keys not in bytewise-lexicographic order") {
        return Expected::Exactly("UnsortedMapKeys");
    }
    if reason.contains("duplicate map key") {
        return Expected::Exactly("DuplicateMapKey");
    }
    if reason.contains("not the shortest form") {
        return Expected::Exactly("NonShortestFloat");
    }
    if reason.contains("but not canonical") {
        return Expected::Exactly("NonPreferredHead");
    }
    // An indefinite-length head is refused where it stands, so the row is
    // classified by the byte the decoder meets rather than by the deeper
    // defect its reason goes on to describe.
    if matches!(bytes.first(), Some(0x5f | 0x7f | 0x9f | 0xbf)) {
        return Expected::Exactly("IndefiniteLength");
    }
    assert!(
        reason.contains("well-formed"),
        "a refusal reason naming no property this test knows: {reason}"
    );
    Expected::WellFormedness
}
