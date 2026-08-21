//! Hand-built cases for the four core requirements of RFC 8949 §4.2.1,
//! swept where the corpus samples.
//!
//! The corpus carries the standard's own chosen examples; these carry the
//! cross product the standard implies — every major type against every
//! argument class, every container against the indefinite form, every
//! offset of a fixture against truncation. The positives interleaved with
//! them are the boundary cases whose acceptance is the other half of each
//! rule: a sweep that only refuses would pass with a decoder that refuses
//! everything.

mod support;

use cogra_interchange::{Array, Bytes, Map, Simple, Tag, Text, Value};
use support::{hex_to_bytes, offset_of, variant_name};

fn refusal(bytes: &[u8]) -> (&'static str, usize) {
    match Value::from_canonical_bytes(bytes) {
        Ok(value) => panic!("{bytes:02x?} was accepted as {value:?}"),
        Err(error) => (variant_name(&error), offset_of(&error)),
    }
}

#[track_caller]
fn assert_refused(bytes: &[u8], variant: &str, offset: usize) {
    assert_eq!(refusal(bytes), (variant, offset), "for {bytes:02x?}");
}

/// Decode, then assert the name the value produces is the name it came
/// from — the one invariant that says the decoder accepts nothing it
/// cannot reproduce.
#[track_caller]
fn assert_roundtrips(bytes: &[u8]) -> Value {
    let value = match Value::from_canonical_bytes(bytes) {
        Ok(value) => value,
        Err(error) => panic!("{bytes:02x?} was refused: {error}"),
    };
    assert_eq!(value.to_canonical_bytes(), bytes, "for {bytes:02x?}");
    assert_eq!(value.canonical_len(), bytes.len(), "for {bytes:02x?}");
    value
}

/// The argument classes above the immediate byte: additional information,
/// and the width of the argument it introduces.
const WIDE_CLASSES: [(u8, usize); 4] = [(24, 1), (25, 2), (26, 4), (27, 8)];

/// Major types 0 through 6 — the ones whose additional information is an
/// argument magnitude, and so the ones preferred serialization governs.
const ARGUMENT_MAJORS: [u8; 7] = [0, 1, 2, 3, 4, 5, 6];

#[test]
fn non_preferred_heads_are_refused_across_major_types_and_classes() {
    let mut cases = 0;

    // An argument of zero belongs in the initial byte, so every wide class
    // spelling it is non-preferred.
    for major in ARGUMENT_MAJORS {
        for (additional, width) in WIDE_CLASSES {
            let mut bytes = vec![(major << 5) | additional];
            bytes.extend(std::iter::repeat_n(0u8, width));
            assert_refused(&bytes, "NonPreferredHead", 0);
            cases += 1;
        }
    }

    // The boundary below each class: the greatest argument the next
    // narrower class holds, spelled one class too wide.
    for major in ARGUMENT_MAJORS {
        for (additional, width) in WIDE_CLASSES.into_iter().skip(1) {
            let mut bytes = vec![(major << 5) | additional];
            bytes.extend(std::iter::repeat_n(0u8, width / 2));
            bytes.extend(std::iter::repeat_n(0xffu8, width / 2));
            assert_refused(&bytes, "NonPreferredHead", 0);
            cases += 1;
        }
    }

    assert_eq!(cases, 49);
}

#[test]
fn preferred_heads_at_the_class_boundaries_are_accepted() {
    let mut cases = 0;

    // Array lengths either side of the immediate-byte boundary, and over
    // the uint8 boundary.
    for (head, count) in [
        (vec![0x97u8], 23usize),
        (vec![0x98, 0x18], 24),
        (vec![0x98, 0xff], 255),
        (vec![0x99, 0x01, 0x00], 256),
    ] {
        let mut bytes = head;
        bytes.extend(std::iter::repeat_n(0u8, count));
        let value = assert_roundtrips(&bytes);
        assert_eq!(
            value,
            Value::Array(Array::new(vec![Value::Unsigned(0); count]))
        );
        cases += 1;
    }

    // The same boundary for map entry counts, keys 0..n ascending.
    for (head, count) in [(vec![0xb7u8], 23u8), (vec![0xb8, 0x18], 24)] {
        let mut bytes = head;
        for key in 0..count {
            bytes.push(key);
            bytes.push(0x00);
        }
        let value = assert_roundtrips(&bytes);
        let Value::Map(map) = &value else {
            panic!("a map decoded as {value:?}")
        };
        assert_eq!(map.len(), usize::from(count));
        cases += 1;
    }

    assert_eq!(cases, 6);
}

#[test]
fn indefinite_lengths_are_refused_for_every_container_type() {
    let mut cases = 0;
    for head in [0x5fu8, 0x7f, 0x9f, 0xbf] {
        assert_refused(&[head], "IndefiniteLength", 0);
        // Nested one level down: the offset must follow the item, not the
        // input.
        assert_refused(&[0x81, head], "IndefiniteLength", 1);
        cases += 2;
    }
    assert_eq!(cases, 8);
}

#[test]
fn map_keys_must_be_sorted_bytewise_and_be_pairwise_distinct() {
    let mut cases = 0;
    for (hex, variant, offset) in [
        // Integer keys in descending order.
        ("a201010000", "UnsortedMapKeys", 3),
        // Byte strings: the head sorts first, so the shorter key must
        // precede the longer one however their payloads compare.
        ("a24100004000", "UnsortedMapKeys", 4),
        // Keys of different major types: text (0x61..) outranks the
        // unsigned integer 10 (0x0a).
        ("a2617a020a01", "UnsortedMapKeys", 4),
        // Same length, different major type: true (0xf5) before false.
        ("a2f500f400", "UnsortedMapKeys", 3),
        // The RFC's own worked example, reversed: [100] before [-1].
        ("a281200281186401", "UnsortedMapKeys", 4),
        // Duplicate integer keys.
        ("a200000001", "DuplicateMapKey", 3),
        // Duplicate compound keys.
        ("a2810000810001", "DuplicateMapKey", 4),
        // The failure inside a nested map is located inside it.
        ("a100a201010000", "UnsortedMapKeys", 5),
    ] {
        assert_refused(&hex_to_bytes(hex), variant, offset);
        cases += 1;
    }
    assert_eq!(cases, 8);
}

#[test]
fn floating_point_values_must_stand_in_their_shortest_form() {
    let mut refused = 0;
    for hex in [
        "fb3ff8000000000000", // 1.5, which binary16 holds exactly
        "fa3f800000",         // 1.0 as binary32
        "fb3ff0000000000000", // 1.0 as binary64
        "fa00000000",         // +0.0 as binary32
        "fb0000000000000000", // +0.0 as binary64
        "fa80000000",         // -0.0 as binary32
        "fb47efffffe0000000", // the greatest binary32 value, as binary64
        "fa33800000",         // 2^-24, the least binary16 subnormal
        "f97e01",             // a NaN carrying a payload
        "f9fe00",             // a NaN with the sign bit set
        "fb7ff8000000000001", // a binary64 NaN carrying a payload
    ] {
        assert_refused(&hex_to_bytes(hex), "NonShortestFloat", 0);
        refused += 1;
    }
    assert_eq!(refused, 11);

    let mut accepted = 0;
    for hex in [
        "fa33000000",         // 2^-25, below every binary16 subnormal
        "faff7fffff",         // the least binary32 value
        "fb0010000000000000", // the least normal binary64 value
        "fb8010000000000000", // and its negation
        "f90000",             // +0.0 stays binary16
        "f98000",             // -0.0 is a structure of its own
    ] {
        assert_roundtrips(&hex_to_bytes(hex));
        accepted += 1;
    }
    assert_eq!(accepted, 6);
}

#[test]
fn trailing_bytes_after_the_item_are_refused() {
    let mut cases = 0;
    for (hex, offset) in [
        ("0000", 1),
        ("8101ff", 2),
        ("a0a0", 1),
        ("f97e00f97e00", 3),
        ("c10000", 2),
    ] {
        let bytes = hex_to_bytes(hex);
        assert_refused(&bytes, "TrailingBytes", offset);
        // The same bytes are one item and a remainder to the prefix
        // decoder, which is the routing surface's whole point.
        let (_, consumed) =
            Value::from_canonical_prefix(&bytes).expect("the head of the input is one item");
        assert_eq!(consumed, offset);
        cases += 1;
    }
    assert_eq!(cases, 5);
}

#[test]
fn every_proper_prefix_of_a_fixture_is_truncated() {
    let mut cases = 0;
    for hex in [
        "a26161016162820203", // {"a": 1, "b": [2, 3]}
        "8301820203820405",   // [1, [2, 3], [4, 5]]
        "c11a514b67b0",       // 1(1363896240)
        "a281186401812002",   // {[100]: 1, [-1]: 2}
    ] {
        let bytes = hex_to_bytes(hex);
        assert_roundtrips(&bytes);
        for len in 0..bytes.len() {
            assert_refused(&bytes[..len], "Truncated", len);
            cases += 1;
        }
    }
    assert_eq!(cases, 31);
}

#[test]
fn ill_formed_heads_are_refused() {
    let mut cases = 0;

    // Additional information 28, 29, and 30 are reserved in every major
    // type.
    for major in 0..=7u8 {
        for additional in 28..=30u8 {
            assert_refused(&[(major << 5) | additional], "IllFormed", 0);
            cases += 1;
        }
    }

    // Additional information 31 is the indefinite-length marker only for
    // major types 2 through 5; elsewhere it is the break stop code or
    // nothing at all.
    for major in [0u8, 1, 6, 7] {
        assert_refused(&[(major << 5) | 31], "IllFormed", 0);
        cases += 1;
    }

    // A break inside a definite-length container is still a break.
    assert_refused(&[0x81, 0xff], "IllFormed", 1);
    assert_refused(&[0xa1, 0x00, 0xff], "IllFormed", 2);
    cases += 2;

    // RFC 8949 §3.3: the two-byte simple value form does not reach below
    // 32, those values having a one-byte spelling.
    for second in [0x00u8, 0x13, 0x14, 0x17, 0x1f] {
        assert_refused(&[0xf8, second], "IllFormed", 0);
        cases += 1;
    }

    assert_eq!(cases, 35);
}

#[test]
fn simple_values_stand_where_their_encodings_put_them() {
    let mut cases = 0;
    for (bytes, expected) in [
        (
            vec![0xe0u8],
            Value::Simple(Simple::new(0).expect("0 is admitted")),
        ),
        (
            vec![0xf3],
            Value::Simple(Simple::new(19).expect("19 is admitted")),
        ),
        (vec![0xf4], Value::Bool(false)),
        (vec![0xf5], Value::Bool(true)),
        (vec![0xf6], Value::Null),
        (vec![0xf7], Value::Simple(Simple::UNDEFINED)),
        (
            vec![0xf8, 0x20],
            Value::Simple(Simple::new(32).expect("32 is admitted")),
        ),
        (
            vec![0xf8, 0xff],
            Value::Simple(Simple::new(255).expect("255 is admitted")),
        ),
    ] {
        assert_eq!(assert_roundtrips(&bytes), expected);
        cases += 1;
    }
    assert_eq!(cases, 8);
}

#[test]
fn text_strings_must_be_valid_utf8() {
    let mut cases = 0;
    for (hex, offset) in [
        ("61ff", 1),       // a byte that starts no sequence
        ("62c328", 1),     // a truncated two-byte sequence
        ("63eda080", 1),   // a surrogate, which UTF-8 excludes
        ("6361c328", 2),   // valid up to the second byte
        ("64f0288cbc", 1), // an invalid four-byte sequence
    ] {
        assert_refused(&hex_to_bytes(hex), "InvalidUtf8", offset);
        cases += 1;
    }

    // The same bytes inside a byte string are a byte string.
    assert_eq!(
        assert_roundtrips(&hex_to_bytes("41ff")),
        Value::Bytes(Bytes::from(vec![0xff])),
    );

    assert_eq!(cases, 5);
}

#[test]
fn tagged_items_carry_exactly_one_enclosed_item() {
    let mut cases = 0;
    for (hex, expected) in [
        (
            "c074323031332d30332d32315432303a30343a30305a",
            Value::Tag(Tag::new(
                0,
                Value::Text(Text::from("2013-03-21T20:04:00Z".to_owned())),
            )),
        ),
        (
            "c11a514b67b0",
            Value::Tag(Tag::new(1, Value::Unsigned(1_363_896_240))),
        ),
        (
            "c249010000000000000000",
            Value::Tag(Tag::new(
                2,
                Value::Bytes(Bytes::from(vec![0x01, 0, 0, 0, 0, 0, 0, 0, 0])),
            )),
        ),
        (
            "d8184100",
            Value::Tag(Tag::new(24, Value::Bytes(Bytes::from(vec![0x00])))),
        ),
        (
            "dbffffffffffffffff00",
            Value::Tag(Tag::new(u64::MAX, Value::Unsigned(0))),
        ),
        (
            "c1c100",
            Value::Tag(Tag::new(1, Value::Tag(Tag::new(1, Value::Unsigned(0))))),
        ),
    ] {
        assert_eq!(assert_roundtrips(&hex_to_bytes(hex)), expected);
        cases += 1;
    }
    assert_eq!(cases, 6);
}

#[test]
fn a_declared_count_beyond_the_input_is_truncation_rather_than_an_allocation() {
    // Nine bytes of head declare more items than any input could hold; the
    // decoder must answer from the length it has, not from the count it
    // was handed.
    assert_refused(&hex_to_bytes("9bffffffffffffffff"), "Truncated", 9);
    assert_refused(&hex_to_bytes("bbffffffffffffffff"), "Truncated", 9);
    assert_refused(&hex_to_bytes("5bffffffffffffffff"), "Truncated", 9);
    assert_refused(&hex_to_bytes("7bffffffffffffffff"), "Truncated", 9);
    // A map of one entry needs two bytes, not one.
    assert_refused(&hex_to_bytes("a100"), "Truncated", 2);
}

#[test]
fn construction_sorts_and_the_encoder_does_not() {
    // The invariant lives in the constructor: a map built out of order
    // encodes canonically because it was reordered on the way in.
    let map = Map::new([
        (Value::Text(Text::from("b".to_owned())), Value::Unsigned(1)),
        (Value::Unsigned(10), Value::Unsigned(2)),
        (Value::Bool(false), Value::Unsigned(3)),
    ])
    .expect("distinct keys");
    assert_eq!(
        Value::Map(map).to_canonical_bytes(),
        hex_to_bytes("a30a02616201f403"),
    );
}
