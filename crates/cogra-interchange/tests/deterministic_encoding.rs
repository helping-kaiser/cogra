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

/// Two families over every argument-bearing major type. An argument of zero
/// belongs in the initial byte, so every wide class spelling it is
/// non-preferred; and the boundary below each class is the greatest argument
/// the next narrower class holds, spelled one class too wide.
///
/// A head spelled wider than its argument needs is refused in every argument-bearing major type and every width class.
/// ´claim:encoding:a-head-wider-than-its-argument-is-refused´
#[test]
fn non_preferred_heads_are_refused_across_major_types_and_classes() {
    let mut cases = 0;

    for major in ARGUMENT_MAJORS {
        for (additional, width) in WIDE_CLASSES {
            let mut bytes = vec![(major << 5) | additional];
            bytes.extend(std::iter::repeat_n(0u8, width));
            assert_refused(&bytes, "NonPreferredHead", 0);
            cases += 1;
        }
    }

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

/// Array lengths either side of the immediate-byte boundary and over the uint8
/// boundary, then the same boundaries for map entry counts, keys `0..n`
/// ascending.
///
/// The preferred head on either side of each argument-class boundary is accepted and re-encodes to itself.
/// ´claim:encoding:the-preferred-head-at-each-boundary-is-accepted´
#[test]
fn preferred_heads_at_the_class_boundaries_are_accepted() {
    let mut cases = 0;

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

/// Each head at the top level and again one level down, where the offset must
/// follow the item rather than the input.
///
/// An indefinite-length head is refused for every container type, at the top level and one level down, where it stands.
/// ´claim:encoding:an-indefinite-length-is-refused-where-it-stands´
#[test]
fn indefinite_lengths_are_refused_for_every_container_type() {
    let mut cases = 0;
    for head in [0x5fu8, 0x7f, 0x9f, 0xbf] {
        assert_refused(&[head], "IndefiniteLength", 0);
        assert_refused(&[0x81, head], "IndefiniteLength", 1);
        cases += 2;
    }
    assert_eq!(cases, 8);
}

/// The rows, in order: integer keys descending; byte strings, where the head
/// sorts first so the shorter key must precede the longer one however their
/// payloads compare; keys of different major types, text (0x61..) outranking
/// the unsigned integer 10 (0x0a); same length and different major type, true
/// (0xf5) before false; the RFC's own worked example reversed, [100] before
/// [-1]; duplicate integer keys; duplicate compound keys; and a failure inside
/// a nested map, located inside it.
///
/// Map keys ascend bytewise over their encodings and are pairwise distinct, the refusal located at the offending key.
/// ´claim:encoding:map-keys-are-sorted-bytewise-and-distinct´
#[test]
fn map_keys_must_be_sorted_bytewise_and_be_pairwise_distinct() {
    let mut cases = 0;
    for (hex, variant, offset) in [
        ("a201010000", "UnsortedMapKeys", 3),
        ("a24100004000", "UnsortedMapKeys", 4),
        ("a2617a020a01", "UnsortedMapKeys", 4),
        ("a2f500f400", "UnsortedMapKeys", 3),
        ("a281200281186401", "UnsortedMapKeys", 4),
        ("a200000001", "DuplicateMapKey", 3),
        ("a2810000810001", "DuplicateMapKey", 4),
        ("a100a201010000", "UnsortedMapKeys", 5),
    ] {
        assert_refused(&hex_to_bytes(hex), variant, offset);
        cases += 1;
    }
    assert_eq!(cases, 8);
}

/// Refused, in order: 1.5 and 1.0 written wider than binary16 holds them; the
/// zeroes written wider; the greatest binary32 value written as binary64;
/// 2^-24, the least binary16 subnormal, written as binary32; and three NaNs
/// that are not the canonical one — one carrying a payload, one with the sign
/// bit set, one binary64 with a payload.
///
/// Accepted, in order: 2^-25, below every binary16 subnormal; the least
/// binary32 value; the least normal binary64 value and its negation; and the
/// two zeroes at binary16, negative zero being a structure of its own.
///
/// A float written wider than its value needs is refused, and the values that genuinely need their width are accepted.
/// ´claim:encoding:a-float-stands-in-its-shortest-form´
#[test]
fn floating_point_values_must_stand_in_their_shortest_form() {
    let mut refused = 0;
    for hex in [
        "fb3ff8000000000000",
        "fa3f800000",
        "fb3ff0000000000000",
        "fa00000000",
        "fb0000000000000000",
        "fa80000000",
        "fb47efffffe0000000",
        "fa33800000",
        "f97e01",
        "f9fe00",
        "fb7ff8000000000001",
    ] {
        assert_refused(&hex_to_bytes(hex), "NonShortestFloat", 0);
        refused += 1;
    }
    assert_eq!(refused, 11);

    let mut accepted = 0;
    for hex in [
        "fa33000000",
        "faff7fffff",
        "fb0010000000000000",
        "fb8010000000000000",
        "f90000",
        "f98000",
    ] {
        assert_roundtrips(&hex_to_bytes(hex));
        accepted += 1;
    }
    assert_eq!(accepted, 6);
}

/// The same bytes are one item and a remainder to the prefix decoder, which is
/// the routing surface's whole point.
///
/// Bytes after a complete item are refused, where the prefix read takes that item and reports what it consumed.
/// ´claim:encoding:trailing-bytes-are-refused-not-ignored´
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
        let (_, consumed) =
            Value::from_canonical_prefix(&bytes).expect("the head of the input is one item");
        assert_eq!(consumed, offset);
        cases += 1;
    }
    assert_eq!(cases, 5);
}

/// The fixtures, in order: `{"a": 1, "b": [2, 3]}`, `[1, [2, 3], [4, 5]]`,
/// `1(1363896240)`, and `{[100]: 1, [-1]: 2}`.
///
/// Every proper prefix of a complete name is refused as truncation at the length it was given.
/// ´claim:encoding:every-proper-prefix-is-truncation´
#[test]
fn every_proper_prefix_of_a_fixture_is_truncated() {
    let mut cases = 0;
    for hex in [
        "a26161016162820203",
        "8301820203820405",
        "c11a514b67b0",
        "a281186401812002",
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

/// Four families. Additional information 28, 29, and 30 are reserved in every
/// major type. Additional information 31 is the indefinite-length marker only
/// for major types 2 through 5; elsewhere it is the break stop code or nothing
/// at all, and a break inside a definite-length container is still a break.
/// And the two-byte simple value form does not reach below 32 (RFC 8949 §3.3),
/// those values having a one-byte spelling.
///
/// Reserved additional information, a break outside an indefinite container, and an under-32 two-byte simple value are each ill-formed.
/// ´claim:encoding:a-reserved-or-stray-head-is-ill-formed´
#[test]
fn ill_formed_heads_are_refused() {
    let mut cases = 0;

    for major in 0..=7u8 {
        for additional in 28..=30u8 {
            assert_refused(&[(major << 5) | additional], "IllFormed", 0);
            cases += 1;
        }
    }

    for major in [0u8, 1, 6, 7] {
        assert_refused(&[(major << 5) | 31], "IllFormed", 0);
        cases += 1;
    }

    assert_refused(&[0x81, 0xff], "IllFormed", 1);
    assert_refused(&[0xa1, 0x00, 0xff], "IllFormed", 2);
    cases += 2;

    for second in [0x00u8, 0x13, 0x14, 0x17, 0x1f] {
        assert_refused(&[0xf8, second], "IllFormed", 0);
        cases += 1;
    }

    assert_eq!(cases, 35);
}

/// Each simple-value encoding decodes to the value it names, the booleans, null and undefined among them.
/// ´claim:encoding:a-simple-value-decodes-to-what-it-names´
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

/// The rows, in order: a byte that starts no sequence; a truncated two-byte
/// sequence; a surrogate, which UTF-8 excludes; a sequence valid up to its
/// second byte; and an invalid four-byte sequence. The same bytes inside a
/// byte string are a byte string.
///
/// A text string whose payload is not valid UTF-8 is refused at that payload, where the same bytes as a byte string stand.
/// ´claim:encoding:a-text-string-must-be-valid-utf8´
#[test]
fn text_strings_must_be_valid_utf8() {
    let mut cases = 0;
    for (hex, offset) in [
        ("61ff", 1),
        ("62c328", 1),
        ("63eda080", 1),
        ("6361c328", 2),
        ("64f0288cbc", 1),
    ] {
        assert_refused(&hex_to_bytes(hex), "InvalidUtf8", offset);
        cases += 1;
    }

    assert_eq!(
        assert_roundtrips(&hex_to_bytes("41ff")),
        Value::Bytes(Bytes::from(vec![0xff])),
    );

    assert_eq!(cases, 5);
}

/// A tag carries exactly one enclosed item, nesting and the widest tag number included.
/// ´claim:encoding:a-tag-carries-exactly-one-item´
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

/// Nine bytes of head declare more items than any input could hold, so the
/// decoder must answer from the length it has and not from the count it was
/// handed. The last row is the small case of the same rule: a map of one entry
/// needs two bytes, not one.
///
/// A count larger than the input could hold is answered as truncation rather than believed and allocated for.
/// ´claim:encoding:a-declared-count-is-answered-from-the-input´
#[test]
fn a_declared_count_beyond_the_input_is_truncation_rather_than_an_allocation() {
    assert_refused(&hex_to_bytes("9bffffffffffffffff"), "Truncated", 9);
    assert_refused(&hex_to_bytes("bbffffffffffffffff"), "Truncated", 9);
    assert_refused(&hex_to_bytes("5bffffffffffffffff"), "Truncated", 9);
    assert_refused(&hex_to_bytes("7bffffffffffffffff"), "Truncated", 9);
    assert_refused(&hex_to_bytes("a100"), "Truncated", 2);
}

/// The invariant lives in the constructor: a map built out of order encodes
/// canonically because it was reordered on the way in.
///
/// A map is sorted where it is built, so the encoder writes canonically without sorting anything.
/// ´claim:encoding:construction-sorts-and-the-encoder-does-not´
#[test]
fn construction_sorts_and_the_encoder_does_not() {
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
