//! The metatheorem obligations of the design's property table, one per
//! theorem, named after it so that a failure names what it broke.
//!
//! Slice 1 owes three: unique names, canonical order, and iterative
//! teardown. The rest arrive with the slices whose subjects they are.

use cogra_interchange::{Array, Bytes, Float, Map, Negative, Simple, Tag, Text, Value};
use proptest::prelude::*;

/// A generator over the whole value model.
///
/// Recursion is bounded here because a generator has to terminate, not
/// because the data language bounds it — the depth the language declines
/// to bound is the subject of its own test below.
fn any_value() -> impl Strategy<Value = Value> {
    let leaf = prop_oneof![
        any::<u64>().prop_map(Value::Unsigned),
        any::<u64>().prop_map(|n| Value::Negative(Negative::from_argument(n))),
        prop::collection::vec(any::<u8>(), 0..6).prop_map(|b| Value::Bytes(Bytes::from(b))),
        ".{0,6}".prop_map(|s| Value::Text(Text::from(s))),
        any::<bool>().prop_map(Value::Bool),
        Just(Value::Null),
        any::<u8>().prop_filter_map("a constructible simple value", |v| Simple::new(v)
            .ok()
            .map(Value::Simple)),
        any::<f64>().prop_filter_map("a canonical float", |v| Float::from_f64(v)
            .ok()
            .map(Value::Float)),
    ];
    leaf.prop_recursive(4, 48, 4, |inner| {
        prop_oneof![
            prop::collection::vec(inner.clone(), 0..4)
                .prop_map(|items| Value::Array(Array::new(items))),
            prop::collection::vec((inner.clone(), inner.clone()), 0..4)
                .prop_map(|pairs| Value::Map(map_of(pairs))),
            (any::<u64>(), inner).prop_map(|(number, item)| Value::Tag(Tag::new(number, item))),
        ]
    })
}

/// Pairs that are sometimes equal: independent values almost never are,
/// and half of an "exactly when" would go unexercised.
fn any_value_pair() -> impl Strategy<Value = (Value, Value)> {
    prop_oneof![
        3 => (any_value(), any_value()),
        1 => any_value().prop_map(|v| (v.clone(), v)),
    ]
}

/// Drop the repeated keys a generator has no way to avoid, so that the
/// constructor's duplicate refusal is not what the property measures.
fn map_of(pairs: Vec<(Value, Value)>) -> Map {
    let mut kept: Vec<(Value, Value)> = Vec::new();
    for (key, value) in pairs {
        if !kept.iter().any(|(seen, _)| seen == &key) {
            kept.push((key, value));
        }
    }
    Map::new(kept).expect("the keys were made distinct above")
}

proptest! {
    /// Every structure has exactly one name, and byte equality of names
    /// decides equality of structures.
    #[test]
    fn unique_names_decoding_inverts_encoding(v in any_value()) {
        let bytes = v.to_canonical_bytes();
        let decoded = Value::from_canonical_bytes(&bytes).expect("a name this crate wrote");
        prop_assert_eq!(decoded, v);
    }

    #[test]
    fn unique_names_encoding_is_stable_through_decoding(v in any_value()) {
        let bytes = v.to_canonical_bytes();
        let decoded = Value::from_canonical_bytes(&bytes).expect("a name this crate wrote");
        prop_assert_eq!(decoded.to_canonical_bytes(), bytes);
    }

    #[test]
    fn unique_names_byte_equality_decides_structure_equality((a, b) in any_value_pair()) {
        prop_assert_eq!(a == b, a.to_canonical_bytes() == b.to_canonical_bytes());
    }

    /// The order implemented directly is the order the names have.
    #[test]
    fn canonical_order_agrees_with_the_order_of_names((a, b) in any_value_pair()) {
        prop_assert_eq!(
            a.cmp(&b),
            a.to_canonical_bytes().cmp(&b.to_canonical_bytes()),
        );
    }

    /// A map holds its entries in that same order, which is what makes the
    /// decoder's check over adjacent byte ranges the right check.
    #[test]
    fn map_entries_stand_in_ascending_key_order(pairs in prop::collection::vec((any_value(), any_value()), 0..8)) {
        let map = map_of(pairs);
        let keys: Vec<Vec<u8>> = map.iter().map(|(k, _)| k.to_canonical_bytes()).collect();
        prop_assert!(keys.windows(2).all(|w| w[0] < w[1]));
    }

    /// The length reported without producing the name is the length of the
    /// name.
    #[test]
    fn canonical_len_agrees_with_the_name(v in any_value()) {
        prop_assert_eq!(v.canonical_len(), v.to_canonical_bytes().len());
    }

    /// A float holds the shortest form that preserves its value, so
    /// reducing an already-reduced float changes nothing.
    #[test]
    fn float_reduction_is_idempotent(v in any::<f64>()) {
        if let Ok(float) = Float::from_f64(v) {
            prop_assert_eq!(Float::from_f64(float.to_f64()).ok(), Some(float));
        }
    }

    /// Bytes outside the language are refused, never repaired — and never
    /// by panicking.
    #[test]
    fn arbitrary_bytes_are_answered_rather_than_survived(bytes in prop::collection::vec(any::<u8>(), 0..24)) {
        if let Ok(value) = Value::from_canonical_bytes(&bytes) {
            prop_assert_eq!(value.to_canonical_bytes(), bytes);
        }
    }
}

/// One million levels deep, which the data language admits because it
/// bounds nesting nowhere. Decoding, encoding, and dropping are each
/// iterative, and this is what says so.
///
/// The value is never cloned, hashed, or compared here: those walks are
/// the compiler's derived ones, and they still recurse.
#[test]
fn a_value_nested_one_million_deep_decodes_encodes_and_drops() {
    const DEPTH: usize = 1_000_000;

    let mut bytes = vec![0x81u8; DEPTH];
    bytes.push(0x00);

    let value = Value::from_canonical_bytes(&bytes).expect("nesting is bounded by the input alone");
    assert_eq!(value.canonical_len(), bytes.len());
    assert_eq!(value.to_canonical_bytes(), bytes);
    drop(value);
}

/// The same depth reached through all three recursive constructors, so
/// that no teardown path is left to the compiler's glue.
#[test]
fn a_deep_chain_of_arrays_maps_and_tags_drops() {
    const UNITS: usize = 200_000;

    let mut bytes = Vec::with_capacity(UNITS * 4 + 1);
    for _ in 0..UNITS {
        bytes.extend_from_slice(&[0x81, 0xa1, 0x00, 0xc1]);
    }
    bytes.push(0x00);

    let value = Value::from_canonical_bytes(&bytes).expect("a canonical chain");
    assert_eq!(value.to_canonical_bytes(), bytes);
    drop(value);
}

/// A chain of tags alone: the recursion the value model carries without
/// an array or a map anywhere to intercept it.
#[test]
fn a_deep_chain_of_tags_alone_drops() {
    const DEPTH: usize = 500_000;

    let mut bytes = vec![0xc1u8; DEPTH];
    bytes.push(0x00);

    let value = Value::from_canonical_bytes(&bytes).expect("a canonical chain");
    assert_eq!(value.canonical_len(), bytes.len());
    drop(value);
}
