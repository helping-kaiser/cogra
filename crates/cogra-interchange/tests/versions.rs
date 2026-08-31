//! Versions and coordinates: the order, the array form, and the refusals.

use cogra_interchange::{
    Array, Coordinate, EnvelopeError, NamespaceLabel, Negative, Text, Value, Version,
};

fn label(s: &str) -> NamespaceLabel {
    NamespaceLabel::parse(s).expect("a label")
}

/// The derived `Ord` compares fields in declaration order, and that order
/// is the lexicographic one the conventions fix. A field reordering breaks
/// this test before it breaks anything downstream: a greater minor outranks
/// any patch, and a greater major any minor.
///
/// A version orders by major, then minor, then patch, so no lesser field outranks a greater one.
/// ´claim:versions:a-version-orders-major-then-minor-then-patch´
#[test]
fn versions_are_ordered_major_then_minor_then_patch() {
    let ascending = [
        Version::new(0, 0, 0),
        Version::new(0, 0, 1),
        Version::new(0, 1, 0),
        Version::new(0, 1, 1),
        Version::new(1, 0, 0),
        Version::new(1, 0, 9),
        Version::new(1, 2, 0),
        Version::new(2, 0, 0),
    ];

    for window in ascending.windows(2) {
        assert!(window[0] < window[1], "{:?} < {:?}", window[0], window[1]);
    }

    assert!(Version::new(1, 1, 0) > Version::new(1, 0, u64::MAX));
    assert!(Version::new(2, 0, 0) > Version::new(1, u64::MAX, u64::MAX));
}

/// A version is carried as the three-element array of its major, minor and patch.
/// ´claim:versions:a-version-is-a-three-element-array´
#[test]
fn a_version_is_the_three_element_array() {
    let version = Version::new(1, 2, 3);
    let value = version.to_value();

    assert_eq!(value.to_canonical_bytes(), [0x83, 0x01, 0x02, 0x03]);
    assert_eq!(Version::from_value(&value).expect("a triple"), version);
}

/// A version survives the trip out to bytes and back, up to the largest triple the type holds.
/// ´claim:versions:a-version-round-trips-through-bytes´
#[test]
fn a_version_survives_the_round_trip_through_bytes() {
    for version in [
        Version::new(0, 0, 0),
        Version::new(1, 0, 0),
        Version::new(u64::MAX, u64::MAX, u64::MAX),
    ] {
        let bytes = version.to_value().to_canonical_bytes();
        let value = Value::from_canonical_bytes(&bytes).expect("a name this crate wrote");
        assert_eq!(Version::from_value(&value).expect("a triple"), version);
    }
}

/// A value that is not three unsigned integers is refused as a version, whatever else it is.
/// ´claim:versions:only-three-unsigned-integers-are-a-version´
#[test]
fn anything_but_three_unsigned_integers_is_refused() {
    let refused = [
        Value::Unsigned(1),
        Value::Null,
        Value::Text(Text::from("1.2.3".to_owned())),
        Value::Array(Array::new([])),
        Value::Array(Array::new([Value::Unsigned(1), Value::Unsigned(2)])),
        Value::Array(Array::new([
            Value::Unsigned(1),
            Value::Unsigned(2),
            Value::Unsigned(3),
            Value::Unsigned(4),
        ])),
        Value::Array(Array::new([
            Value::Unsigned(1),
            Value::Unsigned(2),
            Value::Negative(Negative::from_argument(0)),
        ])),
        Value::Array(Array::new([
            Value::Unsigned(1),
            Value::Unsigned(2),
            Value::Text(Text::from("3".to_owned())),
        ])),
        Value::Array(Array::new([
            Value::Array(Array::new([Value::Unsigned(1)])),
            Value::Unsigned(2),
            Value::Unsigned(3),
        ])),
    ];

    for value in refused {
        let error = Version::from_value(&value).expect_err("not a version triple");
        assert!(matches!(error, EnvelopeError::BadVersion));
        assert_eq!(error.to_string(), "key 1 does not hold a version triple");
    }
}

/// A coordinate carries back the label, major and minor it was built from.
/// ´claim:versions:a-coordinate-carries-a-label-and-two-numbers´
#[test]
fn a_coordinate_carries_a_label_a_major_and_a_minor() {
    let at = Coordinate::new(label("com.example.thing"), 3, 7);

    assert_eq!(at.label().as_str(), "com.example.thing");
    assert_eq!(at.major(), 3);
    assert_eq!(at.minor(), 7);
}

/// A coordinate orders by label first, and only then by major and minor.
/// ´claim:versions:a-coordinate-orders-by-label-first´
#[test]
fn coordinates_order_by_label_then_major_then_minor() {
    let ascending = [
        Coordinate::new(label("com.example"), 1, 0),
        Coordinate::new(label("com.example"), 1, 1),
        Coordinate::new(label("com.example"), 2, 0),
        Coordinate::new(label("com.examples"), 0, 0),
        Coordinate::new(label("org.cogra"), 0, 0),
    ];

    for window in ascending.windows(2) {
        assert!(window[0] < window[1], "{:?} < {:?}", window[0], window[1]);
    }
}
