//! The property obligation of (´prop:lint:label-order´): `Ord` on a label is
//! the bytewise order of its rendered triple, which is the order every
//! generated register is written in and compared under.
//!
//! Trace convention: the vectors name the disagreement they pin — the
//! counterexample the design carries — and the property is the row of
//! (´tab:lint:metatheorem-tests´) it discharges. The generators are pure
//! combinators over a small alphabet: proptest's string strategies are
//! regular-expression driven, and no regular expression is admissible on this
//! crate's analysis path (´[ARCH-dec:linter:no-regex]´).

use cogra_linter::scan::Label;
use proptest::prelude::*;

/// A small alphabet, chosen so that the digit-below-colon boundary is hit
/// often: the digits are `0x30`–`0x39` and the colon is `0x3A`.
const ALPHABET: [char; 6] = ['a', 'b', 'z', '0', '1', '9'];

fn word() -> impl Strategy<Value = String> {
    proptest::collection::vec(proptest::sample::select(ALPHABET.to_vec()), 1..4)
        .prop_map(|chars| chars.into_iter().collect())
}

fn name() -> impl Strategy<Value = String> {
    proptest::collection::vec(word(), 1..3).prop_map(|words| words.join("-"))
}

fn label() -> impl Strategy<Value = Label> {
    (word(), word(), name())
        .prop_map(|(kind, area, name)| format!("{kind}:{area}:{name}"))
        .prop_map(|text| Label::parse(&text).expect("the generator writes the grammar"))
}

fn parse(text: &str) -> Label {
    Label::parse(text).expect("the grammar generates this text")
}

/// The design's own counterexample: bytewise, a digit sorts below the colon,
/// so `a1:x:y` precedes `a:x:y`.
#[test]
fn the_counterexample_pair() {
    let (first, second) = (parse("a1:x:y"), parse("a:x:y"));
    assert!(first < second);
    assert_eq!(
        first.cmp(&second),
        first.as_str().as_bytes().cmp(second.as_str().as_bytes())
    );
}

/// The same pair field by field: a field-wise order puts them the other way
/// round, which is the disagreement the representation removes rather than
/// tests for.
#[test]
fn field_wise_order_disagrees() {
    let (first, second) = (parse("a1:x:y"), parse("a:x:y"));
    let field_wise = (first.kind(), first.area(), first.name()).cmp(&(
        second.kind(),
        second.area(),
        second.name(),
    ));
    assert_ne!(field_wise, first.cmp(&second));
}

/// A hyphen is `0x2D` and sorts below every word byte, so a hyphenated name
/// precedes the longer single word it shares a prefix with.
#[test]
fn hyphen_sorts_below_word_bytes() {
    let (first, second) = (parse("a:b:c-d"), parse("a:b:cd"));
    assert!(first < second);
}

/// A shorter label precedes the label it is a prefix of.
#[test]
fn prefix_precedes_extension() {
    let (first, second) = (parse("a:b:c"), parse("a:b:cd"));
    assert!(first < second);
}

/// Equal renderings are equal labels, so the order is antisymmetric on them.
#[test]
fn equal_renderings_compare_equal() {
    assert_eq!(
        parse("sec:labels:syntax").cmp(&parse("sec:labels:syntax")),
        core::cmp::Ordering::Equal
    );
}

proptest! {
    /// (´prop:lint:label-order´): on generated pairs, `a.cmp(b)` agrees with
    /// the bytewise comparison of the two renderings.
    #[test]
    fn order_is_bytewise(first in label(), second in label()) {
        prop_assert_eq!(
            first.cmp(&second),
            first.as_str().as_bytes().cmp(second.as_str().as_bytes())
        );
    }

    /// A generated label round-trips through its rendering: the offsets are
    /// functions of the text, so re-parsing the text rebuilds the same label.
    #[test]
    fn rendering_round_trips(label in label()) {
        prop_assert_eq!(&label, &Label::parse(label.as_str()).expect("the rendering is a label"));
    }

    /// The order is total on generated labels: two labels comparing equal
    /// render the same bytes.
    #[test]
    fn equality_is_rendering_equality(first in label(), second in label()) {
        prop_assert_eq!(first == second, first.as_str() == second.as_str());
    }
}
