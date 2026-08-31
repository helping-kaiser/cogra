//! Label vectors over the ABNF of the label grammar.
//!
//! Accepts and refusals in one table each, the refusals naming the variant
//! and the message, so that a change of classification fails here and not
//! silently downstream.

use cogra_interchange::{LabelError, NamespaceLabel};

/// The variant, for a table that asserts which refusal without repeating
/// the message's field values twice.
fn variant(error: &LabelError) -> &'static str {
    match error {
        LabelError::TooFewAtoms => "TooFewAtoms",
        LabelError::EmptyAtom { .. } => "EmptyAtom",
        LabelError::BadCharacter { .. } => "BadCharacter",
        LabelError::HyphenAtEdge { .. } => "HyphenAtEdge",
        LabelError::TooLong { .. } => "TooLong",
        other => panic!("a variant this test has not met: {other:?}"),
    }
}

/// An atom of `n` characters, for the length edges.
fn atom(n: usize) -> String {
    "a".repeat(n)
}

/// A label the ABNF admits parses and reads back as the string it was given.
/// ´claim:labels:the-grammar-admits-what-the-abnf-admits´
#[test]
fn the_grammar_accepts() {
    let accepted = [
        "a.b",
        "a.b.c",
        "com.example",
        "com.example.thing",
        "org.cogra.feed.rank",
        "a-b.c",
        "a--b.c",
        "x.y-z",
        "a1.b2",
        "0.1",
        "1.2.3",
        "9a-8b.c0",
        "a.b.c.d.e.f.g",
        "zzz.999",
        "a0-1-2b.cd",
    ];

    for input in accepted {
        let label = NamespaceLabel::parse(input)
            .unwrap_or_else(|e| panic!("the ABNF admits {input:?}, refused as {e}"));
        assert_eq!(label.as_str(), input);
        assert_eq!(label.to_string(), input);
    }
}

/// A label outside the ABNF is refused with the variant and the message its defect calls for.
/// ´claim:labels:a-refused-label-names-its-defect´
#[test]
fn the_grammar_refuses() {
    let refused: [(&str, &str, &str); 24] = [
        ("", "EmptyAtom", "empty atom at character 0"),
        (".", "EmptyAtom", "empty atom at character 0"),
        ("..", "EmptyAtom", "empty atom at character 0"),
        (".a", "EmptyAtom", "empty atom at character 0"),
        ("a.", "EmptyAtom", "empty atom at character 2"),
        ("a..b", "EmptyAtom", "empty atom at character 2"),
        ("a...b", "EmptyAtom", "empty atom at character 2"),
        ("com.example.", "EmptyAtom", "empty atom at character 12"),
        (
            "a",
            "TooFewAtoms",
            "namespace label needs at least two atoms",
        ),
        (
            "solo",
            "TooFewAtoms",
            "namespace label needs at least two atoms",
        ),
        (
            "a-b",
            "TooFewAtoms",
            "namespace label needs at least two atoms",
        ),
        (
            "-",
            "HyphenAtEdge",
            "atom at position 0 begins or ends with a hyphen",
        ),
        (
            "-a.b",
            "HyphenAtEdge",
            "atom at position 0 begins or ends with a hyphen",
        ),
        (
            "a-.b",
            "HyphenAtEdge",
            "atom at position 0 begins or ends with a hyphen",
        ),
        (
            "a.-b",
            "HyphenAtEdge",
            "atom at position 2 begins or ends with a hyphen",
        ),
        (
            "a.b-",
            "HyphenAtEdge",
            "atom at position 2 begins or ends with a hyphen",
        ),
        (
            "A.b",
            "BadCharacter",
            "character 'A' at position 0 is outside the label alphabet",
        ),
        (
            "a.B",
            "BadCharacter",
            "character 'B' at position 2 is outside the label alphabet",
        ),
        (
            "COM.EXAMPLE",
            "BadCharacter",
            "character 'C' at position 0 is outside the label alphabet",
        ),
        (
            "a_b.c",
            "BadCharacter",
            "character '_' at position 1 is outside the label alphabet",
        ),
        (
            "a b.c",
            "BadCharacter",
            "character ' ' at position 1 is outside the label alphabet",
        ),
        (
            "a.b/c",
            "BadCharacter",
            "character '/' at position 3 is outside the label alphabet",
        ),
        (
            "ä.b",
            "BadCharacter",
            "character 'ä' at position 0 is outside the label alphabet",
        ),
        (
            "com.exämple",
            "BadCharacter",
            "character 'ä' at position 6 is outside the label alphabet",
        ),
    ];

    for (input, expected_variant, expected_message) in refused {
        let error = NamespaceLabel::parse(input).expect_err(&format!("the ABNF refuses {input:?}"));
        assert_eq!(variant(&error), expected_variant, "over {input:?}");
        assert_eq!(error.to_string(), expected_message, "over {input:?}");
    }
}

/// A character position counts characters, so a non-ASCII character costs
/// one however many bytes it occupies.
///
/// A refusal locates its character by characters, so a multi-byte character costs one position.
/// ´claim:labels:a-position-counts-characters´
#[test]
fn a_bad_character_is_located_in_characters_not_bytes() {
    let error = NamespaceLabel::parse("aä.b").expect_err("non-ASCII");
    assert!(matches!(
        error,
        LabelError::BadCharacter {
            position: 1,
            found: 'ä'
        }
    ));
}

/// A label of 255 bytes is admitted and one of 256 is refused as too long.
/// ´claim:labels:the-length-bound-is-255-bytes´
#[test]
fn the_length_bound_admits_255_bytes_and_refuses_256() {
    let edge = format!("{}.b", atom(253));
    assert_eq!(edge.len(), 255);
    assert!(NamespaceLabel::parse(&edge).is_ok());

    let over = format!("{}.b", atom(254));
    assert_eq!(over.len(), 256);
    let error = NamespaceLabel::parse(&over).expect_err("one byte over");
    assert!(matches!(error, LabelError::TooLong { length: 256 }));
}

/// The length bound is checked before the characters are, which is what
/// makes the refusal of an over-long string independent of what else is
/// wrong with it.
///
/// An over-long string is refused for its length whatever else is wrong with it.
/// ´claim:labels:length-is-judged-first´
#[test]
fn length_is_judged_before_the_alphabet() {
    let over = format!("{}.B", atom(254));
    let error = NamespaceLabel::parse(&over).expect_err("one byte over");
    assert!(matches!(error, LabelError::TooLong { length: 256 }));
}

/// A hyphen may not stand at either edge of an atom, but any number of
/// them may stand in its interior: the ABNF's inner repetition admits
/// `alnum / "-"` without further condition.
///
/// A hyphen stands anywhere inside an atom and at neither of its edges.
/// ´claim:labels:a-hyphen-is-interior-only´
#[test]
fn hyphens_are_interior_only_and_unlimited_there() {
    assert!(NamespaceLabel::parse("a-b-c.d").is_ok());
    assert!(NamespaceLabel::parse("a---b.c").is_ok());
    assert!(NamespaceLabel::parse("-ab.c").is_err());
    assert!(NamespaceLabel::parse("ab-.c").is_err());
}

/// A label gives back its atoms in the order they descend the namespace tree.
/// ´claim:labels:atoms-read-out-in-order´
#[test]
fn atoms_descend_the_tree() {
    let label = NamespaceLabel::parse("org.cogra.feed.rank").expect("a label");
    assert_eq!(
        label.atoms().collect::<Vec<_>>(),
        ["org", "cogra", "feed", "rank"]
    );
}

/// A label has a parent while more than two atoms remain, and none at the two-atom root.
/// ´claim:labels:a-parent-stops-at-two-atoms´
#[test]
fn a_parent_exists_while_two_atoms_remain() {
    let label = NamespaceLabel::parse("org.cogra.feed.rank").expect("a label");
    let parent = label.parent().expect("three atoms remain");
    assert_eq!(parent.as_str(), "org.cogra.feed");
    let grandparent = parent.parent().expect("two atoms remain");
    assert_eq!(grandparent.as_str(), "org.cogra");
    assert_eq!(grandparent.parent(), None);
}

/// The relation is atom-wise: the byte-wise reading would make `com.exa`
/// an authority over `com.example`, which it is not.
///
/// Prefix authority runs atom by atom, so a shared run of bytes is no authority.
/// ´claim:labels:prefix-authority-is-atom-wise´
#[test]
fn prefix_authority_is_atom_wise() {
    let parent = NamespaceLabel::parse("com.example").expect("a label");
    let child = NamespaceLabel::parse("com.example.thing").expect("a label");
    let neighbour = NamespaceLabel::parse("com.exa").expect("a label");
    let elsewhere = NamespaceLabel::parse("org.example").expect("a label");

    assert!(parent.is_prefix_of(&child));
    assert!(parent.is_prefix_of(&parent));
    assert!(!child.is_prefix_of(&parent));
    assert!(!neighbour.is_prefix_of(&child));
    assert!(!parent.is_prefix_of(&elsewhere));
}

/// Every route into the type runs the one scanner and refuses the same strings.
/// ´claim:labels:every-route-runs-one-scanner´
#[test]
fn every_route_into_the_type_is_the_same_scanner() {
    let parsed = NamespaceLabel::parse("com.example").expect("a label");
    let from_str: NamespaceLabel = "com.example".parse().expect("a label");
    let try_from = NamespaceLabel::try_from("com.example").expect("a label");

    assert_eq!(parsed, from_str);
    assert_eq!(parsed, try_from);
    assert_eq!(parsed.as_ref() as &str, "com.example");

    assert!("com.Example".parse::<NamespaceLabel>().is_err());
    assert!(NamespaceLabel::try_from("com").is_err());
}
