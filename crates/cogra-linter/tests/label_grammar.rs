//! Vector tests for the label grammar of (´[LBL-lang:labels:label-language]´).
//!
//! Trace convention: every test's doc comment names the production it traces
//! to — `label`, `kind`, `area`, `name`, `word`, or `PREFIX` — and says whether
//! it is an accept or a reject. A reject also pins the failure position, since
//! the near-miss warnings of (´sig:lint:near-miss-api´) are derived from it and
//! a position that drifts silently would take the warnings with it.

use cogra_linter::scan::{Expectation, Label, LabelSyntax, Prefix};

/// Parse text the grammar generates.
fn accept(text: &str) -> Label {
    Label::parse(text).expect("the grammar generates this text")
}

/// Parse text the grammar does not generate, returning where the parse stopped.
fn reject(text: &str) -> (usize, Expectation) {
    let LabelSyntax { at, expected } =
        Label::parse(text).expect_err("the grammar does not generate this text");
    (at, expected)
}

/// Accept: `label ::= kind ":" area ":" name` at its shortest, one word each.
///
/// A colon-joined triple of a kind, an area, and a name parses as a label.
/// ´claim:grammar:a-well-formed-triple-parses´
#[test]
fn minimal_triple() {
    let label = accept("a:b:c");
    assert_eq!((label.kind(), label.area(), label.name()), ("a", "b", "c"));
}

/// Accept: `label`, as the calculus's own environments carry it.
///
/// (´claim:grammar:a-well-formed-triple-parses´)
#[test]
fn corpus_label() {
    let label = accept("sec:labels:syntax");
    assert_eq!(
        (label.kind(), label.area(), label.name()),
        ("sec", "labels", "syntax")
    );
}

/// Accept: `kind ::= word`, `word ::= [a-z0-9]+` with a trailing digit.
///
/// A word admits digits anywhere in it, in every field.
/// ´claim:grammar:a-word-admits-digits´
#[test]
fn kind_carries_digits() {
    assert_eq!(accept("a1:b:c").kind(), "a1");
}

/// Accept: `kind ::= word` made only of digits.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn kind_all_digits() {
    assert_eq!(accept("1:b:c").kind(), "1");
}

/// Accept: `kind ::= word` with digits throughout.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn kind_mixed_digits() {
    assert_eq!(accept("a1b2:b:c").kind(), "a1b2");
}

/// Accept: `area ::= word` with a trailing digit.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn area_carries_digits() {
    assert_eq!(accept("a:b2:c").area(), "b2");
}

/// Accept: `area ::= word` made only of digits.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn area_all_digits() {
    assert_eq!(accept("a:2:c").area(), "2");
}

/// Accept: `name ::= word ("-" word)*` with a single word carrying digits.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn name_carries_digits() {
    assert_eq!(accept("a:b:c3").name(), "c3");
}

/// Accept: `name` made only of digits.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn name_all_digits() {
    assert_eq!(accept("a:b:3").name(), "3");
}

/// Accept: `name ::= word ("-" word)*` with one hyphen.
///
/// A name hyphenates words, however many.
/// ´claim:grammar:a-name-hyphenates-words´
#[test]
fn name_hyphenates_two_words() {
    assert_eq!(accept("inv:labels:unique-mint").name(), "unique-mint");
}

/// Accept: `name ::= word ("-" word)*` with several hyphens.
///
/// (´claim:grammar:a-name-hyphenates-words´)
#[test]
fn name_hyphenates_many_words() {
    assert_eq!(accept("a:b:c-d-e-f-g").name(), "c-d-e-f-g");
}

/// Accept: `name` hyphenating words that carry digits.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn name_hyphenates_digit_words() {
    assert_eq!(accept("a:b:c1-d2").name(), "c1-d2");
}

/// Accept: `name` whose word after a hyphen opens with a digit.
///
/// (´claim:grammar:a-word-admits-digits´)
#[test]
fn name_word_opens_with_digit() {
    assert_eq!(accept("a:b:c-1d").name(), "c-1d");
}

/// Accept: `label` with a long kind, as the metatheory's labels carry.
///
/// (´claim:grammar:a-well-formed-triple-parses´)
#[test]
fn long_kind() {
    let label = accept("metathm:labels:presentation-invariance");
    assert_eq!(label.kind(), "metathm");
    assert_eq!(label.name(), "presentation-invariance");
}

/// Accept: `label`, the profile illustration of (´[LBL-sig:labels:profiles]´).
///
/// (´claim:grammar:a-well-formed-triple-parses´)
#[test]
fn inventory_label() {
    let label = accept("test:integration:decode-roundtrip");
    assert_eq!(
        (label.kind(), label.area(), label.name()),
        ("test", "integration", "decode-roundtrip")
    );
}

/// Accept: `label`, a rejected-Ansatz label of the calculus.
///
/// (´claim:grammar:a-well-formed-triple-parses´)
#[test]
fn ansatz_label() {
    assert_eq!(accept("ansatz:labels:path-derivation").area(), "labels");
}

/// Accept: `label`, the calculus's gate.
///
/// (´claim:grammar:a-well-formed-triple-parses´)
#[test]
fn gate_label() {
    assert_eq!(accept("gate:labels:implementation").kind(), "gate");
}

/// Accept: `label` renders back to exactly the text it was parsed from.
///
/// A label renders back to exactly the text it was parsed from, by every route.
/// ´claim:grammar:a-label-round-trips´
#[test]
fn rendering_round_trips() {
    let text = "inf:labels:derivation-warrant";
    assert_eq!(accept(text).as_str(), text);
}

/// Accept: `Display` and `as_str` are the same rendering.
///
/// (´claim:grammar:a-label-round-trips´)
#[test]
fn display_is_the_rendering() {
    let label = accept("judg:labels:minting");
    assert_eq!(label.to_string(), label.as_str());
}

/// Accept: `FromStr` is `Label::parse`.
///
/// (´claim:grammar:a-label-round-trips´)
#[test]
fn from_str_agrees_with_parse() {
    let text = "cav:labels:coexistence";
    let parsed: Label = text.parse().expect("the grammar generates this text");
    assert_eq!(parsed, accept(text));
}

/// Accept: two labels of the same text are equal, offsets included.
///
/// (´claim:grammar:a-label-round-trips´)
#[test]
fn equal_text_equal_label() {
    assert_eq!(accept("a:b:c-d"), accept("a:b:c-d"));
}

/// Accept: the three accessors partition the rendering exactly.
///
/// The three accessors partition the rendering exactly.
/// ´claim:grammar:the-accessors-partition-the-rendering´
#[test]
fn accessors_partition_the_rendering() {
    let label = accept("metathm:labels:warrant-lapse");
    let rebuilt = format!("{}:{}:{}", label.kind(), label.area(), label.name());
    assert_eq!(rebuilt, label.as_str());
}

/// Accept: a one-byte word in every field.
///
/// (´claim:grammar:a-well-formed-triple-parses´)
#[test]
fn single_byte_words() {
    let label = accept("z:9:q");
    assert_eq!((label.kind(), label.area(), label.name()), ("z", "9", "q"));
}

/// Reject: `label` needs a `kind`, and `word` admits no empty word.
///
/// No field of a label may be empty, a word admitting no empty text.
/// ´claim:grammar:no-field-may-be-empty´
#[test]
fn empty_text() {
    assert_eq!(reject(""), (0, Expectation::WordChar));
}

/// Reject: `label` needs the first colon.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn kind_only() {
    assert_eq!(reject("a"), (1, Expectation::Colon));
}

/// Reject: `label` needs the first colon, after a longer kind.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn long_kind_only() {
    assert_eq!(reject("abc"), (3, Expectation::Colon));
}

/// Reject: `area ::= word` admits no empty word.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn empty_area_at_end() {
    assert_eq!(reject("a:"), (2, Expectation::WordChar));
}

/// Reject: `label` needs the second colon.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn one_colon_only() {
    assert_eq!(reject("a:b"), (3, Expectation::Colon));
}

/// Reject: `name ::= word ("-" word)*` admits no empty name.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn empty_name() {
    assert_eq!(reject("a:b:"), (4, Expectation::WordChar));
}

/// Reject: `kind ::= word` admits no empty word.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn empty_kind() {
    assert_eq!(reject(":b:c"), (0, Expectation::WordChar));
}

/// Reject: `label` made only of separators.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn colons_only() {
    assert_eq!(reject("::"), (0, Expectation::WordChar));
}

/// Reject: `area ::= word` admits no empty word between the colons.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn empty_area_between_colons() {
    assert_eq!(reject("a::c"), (2, Expectation::WordChar));
}

/// Reject: a `name` opening with the third colon is an empty name.
///
/// (´claim:grammar:no-field-may-be-empty´)
#[test]
fn empty_name_before_a_third_colon() {
    assert_eq!(reject("a:b::"), (4, Expectation::WordChar));
}

/// Reject: `label` carries exactly two colons; a third ends it.
///
/// A label carries exactly two colons, and a third ends it whatever follows.
/// ´claim:grammar:a-label-carries-two-colons´
#[test]
fn three_colons() {
    assert_eq!(reject("a:b:c:d"), (5, Expectation::EndOfLabel));
}

/// Reject: `label` carries exactly two colons, whatever follows the third.
///
/// (´claim:grammar:a-label-carries-two-colons´)
#[test]
fn four_colons() {
    assert_eq!(reject("a:b:c:d:e"), (5, Expectation::EndOfLabel));
}

/// Reject: a trailing third colon ends the label just the same.
///
/// (´claim:grammar:a-label-carries-two-colons´)
#[test]
fn trailing_third_colon() {
    assert_eq!(reject("a:b:c:"), (5, Expectation::EndOfLabel));
}

/// Reject: `word ::= [a-z0-9]+` excludes uppercase, in the kind.
///
/// A word excludes uppercase, in every field and at every position.
/// ´claim:grammar:a-word-is-lowercase´
#[test]
fn uppercase_kind() {
    assert_eq!(reject("A:b:c"), (0, Expectation::WordChar));
}

/// Reject: `word` excludes uppercase inside the kind, where the colon is owed.
///
/// (´claim:grammar:a-word-is-lowercase´)
#[test]
fn uppercase_inside_kind() {
    assert_eq!(reject("aA:b:c"), (1, Expectation::Colon));
}

/// Reject: `word` excludes uppercase, in the area.
///
/// (´claim:grammar:a-word-is-lowercase´)
#[test]
fn uppercase_area() {
    assert_eq!(reject("a:B:c"), (2, Expectation::WordChar));
}

/// Reject: `word` excludes uppercase inside the area.
///
/// (´claim:grammar:a-word-is-lowercase´)
#[test]
fn uppercase_inside_area() {
    assert_eq!(reject("a:bC:c"), (3, Expectation::Colon));
}

/// Reject: `word` excludes uppercase, at the name's first byte.
///
/// (´claim:grammar:a-word-is-lowercase´)
#[test]
fn uppercase_name() {
    assert_eq!(reject("a:b:C"), (4, Expectation::WordChar));
}

/// Reject: `word` excludes uppercase inside the name.
///
/// (´claim:grammar:a-word-is-lowercase´)
#[test]
fn uppercase_inside_name() {
    assert_eq!(reject("a:b:cD"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: `word` excludes uppercase in a hyphenated name's later word.
///
/// (´claim:grammar:a-word-is-lowercase´)
#[test]
fn uppercase_after_hyphen() {
    assert_eq!(reject("a:b:c-D"), (6, Expectation::WordChar));
}

/// Reject: an all-uppercase label is not a label.
///
/// (´claim:grammar:a-word-is-lowercase´)
#[test]
fn all_uppercase() {
    assert_eq!(reject("SEC:LABELS:SYNTAX"), (0, Expectation::WordChar));
}

/// Reject: `name ::= word ("-" word)*` has no leading hyphen.
///
/// A name hyphenates only between words, never at an end and never twice over.
/// ´claim:grammar:a-name-hyphenates-between-words´
#[test]
fn name_leading_hyphen() {
    assert_eq!(reject("a:b:-c"), (4, Expectation::WordChar));
}

/// Reject: `name ::= word ("-" word)*` has no trailing hyphen.
///
/// (´claim:grammar:a-name-hyphenates-between-words´)
#[test]
fn name_trailing_hyphen() {
    assert_eq!(reject("a:b:c-"), (6, Expectation::WordChar));
}

/// Reject: `name` has no empty word between two hyphens.
///
/// (´claim:grammar:a-name-hyphenates-between-words´)
#[test]
fn name_double_hyphen() {
    assert_eq!(reject("a:b:c--d"), (6, Expectation::WordChar));
}

/// Reject: a name of one hyphen alone.
///
/// (´claim:grammar:a-name-hyphenates-between-words´)
#[test]
fn name_hyphen_only() {
    assert_eq!(reject("a:b:-"), (4, Expectation::WordChar));
}

/// Reject: `kind ::= word` does not hyphenate; only `name` does.
///
/// Only a name hyphenates: a kind and an area are one word each.
/// ´claim:grammar:only-a-name-hyphenates´
#[test]
fn hyphen_in_kind() {
    assert_eq!(reject("a-b:c:d"), (1, Expectation::Colon));
}

/// Reject: `area ::= word` does not hyphenate; only `name` does.
///
/// (´claim:grammar:only-a-name-hyphenates´)
#[test]
fn hyphen_in_area() {
    assert_eq!(reject("a:b-c:d"), (3, Expectation::Colon));
}

/// Reject: `word ::= [a-z0-9]+` excludes the underscore.
///
/// A word admits no byte but a lowercase letter or a digit.
/// ´claim:grammar:a-word-is-letters-and-digits-alone´
#[test]
fn underscore_in_name() {
    assert_eq!(reject("a:b:c_d"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: `word` excludes the underscore in the kind too.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn underscore_in_kind() {
    assert_eq!(reject("a_b:c:d"), (1, Expectation::Colon));
}

/// Reject: `word` excludes the dot.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn dot_in_name() {
    assert_eq!(reject("a:b:c.d"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: `word` excludes the slash, so a path is never a label.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn slash_in_name() {
    assert_eq!(reject("a:b:c/d"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: `word` excludes interior space.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn space_inside_name() {
    assert_eq!(reject("a:b:c d"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: `word` excludes leading space.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn leading_space() {
    assert_eq!(reject(" a:b:c"), (0, Expectation::WordChar));
}

/// Reject: `word` excludes trailing space.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn trailing_space() {
    assert_eq!(reject("a:b:c "), (5, Expectation::HyphenOrWordChar));
}

/// Reject: `word` excludes the tab.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn tab_inside_name() {
    assert_eq!(reject("a:b:c\td"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: `word` excludes the newline, so no label spans a line break.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn newline_inside_name() {
    assert_eq!(reject("a:b:c\nd"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: a space around the colon is not a colon.
///
/// (´claim:grammar:a-word-is-letters-and-digits-alone´)
#[test]
fn space_before_colon() {
    assert_eq!(reject("a:b :c"), (3, Expectation::Colon));
}

/// Reject: `word ::= [a-z0-9]+` is ASCII, so a Latin-1 letter opens no kind.
///
/// A word is ASCII, so no wider character opens or continues one.
/// ´claim:grammar:a-word-is-ascii´
#[test]
fn non_ascii_kind() {
    assert_eq!(reject("ä:b:c"), (0, Expectation::WordChar));
}

/// Reject: a non-ASCII byte inside the area, located at the byte it begins at.
///
/// (´claim:grammar:a-word-is-ascii´)
#[test]
fn non_ascii_area() {
    assert_eq!(reject("a:bé:c"), (3, Expectation::Colon));
}

/// Reject: a non-ASCII byte inside the name, located at the byte it begins at.
///
/// (´claim:grammar:a-word-is-ascii´)
#[test]
fn non_ascii_name() {
    assert_eq!(reject("a:b:cé"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: a four-byte character is no word character either.
///
/// (´claim:grammar:a-word-is-ascii´)
#[test]
fn emoji_name() {
    assert_eq!(reject("a:b:🎯"), (4, Expectation::WordChar));
}

/// Reject: a non-ASCII hyphen — the en dash — does not hyphenate a name.
///
/// (´claim:grammar:a-word-is-ascii´)
#[test]
fn en_dash_in_name() {
    assert_eq!(reject("a:b:c–d"), (5, Expectation::HyphenOrWordChar));
}

/// Reject: the bracket of the imported form is no part of `label`.
///
/// An occurrence's delimiters are no part of the label they carry.
/// ´claim:grammar:delimiters-are-no-part-of-a-label´
#[test]
fn bracketed_text_is_no_label() {
    assert_eq!(reject("[SPEC-a:b:c]"), (0, Expectation::WordChar));
}

/// Reject: the parenthesis of a citation is no part of `label`.
///
/// (´claim:grammar:delimiters-are-no-part-of-a-label´)
#[test]
fn parenthesized_text_is_no_label() {
    assert_eq!(reject("(a:b:c)"), (0, Expectation::WordChar));
}

/// Reject: a delimiter is no part of `label`.
///
/// (´claim:grammar:delimiters-are-no-part-of-a-label´)
#[test]
fn backtick_is_no_label() {
    assert_eq!(reject("`a:b:c`"), (0, Expectation::WordChar));
}

/// Reject: an interior delimiter is no part of `label` either.
///
/// (´claim:grammar:delimiters-are-no-part-of-a-label´)
#[test]
fn interior_backtick() {
    assert_eq!(reject("a:b:`c`"), (4, Expectation::WordChar));
}

/// Reject: a prefix without its brackets is no label, the hyphen falling where
/// the first colon is owed.
///
/// An import prefix is no part of the label it qualifies.
/// ´claim:grammar:a-prefix-is-no-part-of-a-label´
#[test]
fn bare_prefixed_text() {
    assert_eq!(reject("SPEC-a:b:c"), (0, Expectation::WordChar));
}

/// Reject: a lowercased prefix run swallowed into the kind still owes a colon.
///
/// (´claim:grammar:a-prefix-is-no-part-of-a-label´)
#[test]
fn lowercase_prefixed_text() {
    assert_eq!(reject("spec-a:b:c"), (4, Expectation::Colon));
}

/// Reject: an occurrence's whole text is never itself a label.
///
/// (´claim:grammar:delimiters-are-no-part-of-a-label´)
#[test]
fn whole_citation_text() {
    assert_eq!(reject("(`a:b:c`)"), (0, Expectation::WordChar));
}

/// Reject: a fourth field is no `name`, whatever it holds.
///
/// (´claim:grammar:a-label-carries-two-colons´)
#[test]
fn fourth_field_with_hyphens() {
    assert_eq!(reject("a:b:c-d:e-f"), (7, Expectation::EndOfLabel));
}

/// Accept: `PREFIX ::= [A-Z][A-Z0-9]*`, the shortest form.
///
/// A prefix opens with an uppercase letter and continues in uppercase letters and digits.
/// ´claim:grammar:a-prefix-is-uppercase-from-a-letter´
#[test]
fn prefix_one_letter() {
    assert_eq!(
        Prefix::parse("L").map(|p| p.to_string()).as_deref(),
        Some("L")
    );
}

/// Accept: `PREFIX` of several uppercase letters, as the corpus registers.
///
/// (´claim:grammar:a-prefix-is-uppercase-from-a-letter´)
#[test]
fn prefix_letters() {
    assert_eq!(
        Prefix::parse("LBL")
            .map(|p| p.as_str().to_owned())
            .as_deref(),
        Some("LBL")
    );
}

/// Accept: `PREFIX` carrying digits after its first letter — the numbered
/// record family of (´[LBL-sig:labels:owners]´).
///
/// (´claim:grammar:a-prefix-is-uppercase-from-a-letter´)
#[test]
fn prefix_with_digits() {
    assert!(Prefix::parse("REC001").is_some());
}

/// Accept: `PREFIX` of a letter and one digit.
///
/// (´claim:grammar:a-prefix-is-uppercase-from-a-letter´)
#[test]
fn prefix_letter_digit() {
    assert!(Prefix::parse("A1").is_some());
}

/// Reject: `PREFIX` admits no empty text.
///
/// (´claim:grammar:a-prefix-is-uppercase-from-a-letter´)
#[test]
fn prefix_empty() {
    assert!(Prefix::parse("").is_none());
}

/// Reject: `PREFIX ::= [A-Z][A-Z0-9]*` opens with a letter, never a digit.
///
/// (´claim:grammar:a-prefix-is-uppercase-from-a-letter´)
#[test]
fn prefix_opens_with_digit() {
    assert!(Prefix::parse("1BL").is_none());
}

/// Reject: `PREFIX` is uppercase throughout.
///
/// (´claim:grammar:a-prefix-is-uppercase-from-a-letter´)
#[test]
fn prefix_lowercase() {
    assert!(Prefix::parse("lbl").is_none());
}

/// Reject: `PREFIX` admits no lowercase tail.
///
/// (´claim:grammar:a-prefix-is-uppercase-from-a-letter´)
#[test]
fn prefix_mixed_case() {
    assert!(Prefix::parse("Lbl").is_none());
}

/// Reject: `PREFIX` admits no hyphen — which is what makes the imported form's
/// separator unambiguous.
///
/// A prefix carries no separator, which is what makes the import form's own separator unambiguous.
/// ´claim:grammar:a-prefix-carries-no-separator´
#[test]
fn prefix_with_hyphen() {
    assert!(Prefix::parse("L-B").is_none());
}

/// Reject: `PREFIX` admits no underscore.
///
/// (´claim:grammar:a-prefix-carries-no-separator´)
#[test]
fn prefix_with_underscore() {
    assert!(Prefix::parse("L_B").is_none());
}

/// Reject: `PREFIX` is ASCII.
///
/// A prefix is ASCII.
/// ´claim:grammar:a-prefix-is-ascii´
#[test]
fn prefix_non_ascii() {
    assert!(Prefix::parse("LÄ").is_none());
}
