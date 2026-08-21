//! The public description-language surface: `Theory`, `KeySlot`, and the
//! base theory.
//!
//! The clause-by-clause matrix of assignable-fragment membership lives with
//! the checker, which is crate-private; what is asserted here is the
//! pipeline a consumer meets — which refusal arrives for which source, in
//! which order — and the surface it reads its answers off.

use cogra_interchange::{Theory, TheoryError, global};

/// A theory of the fragment, for tests that vary one thing about it.
const ASSIGNED: &str = r#"example = {
  0 => "com.company.example",
  1 => [1, 2, uint],
  2 => tstr,
  ? 7 => bstr
}"#;

fn parse(source: &str) -> Theory {
    match Theory::parse(source) {
        Ok(theory) => theory,
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

fn refuse(source: &str) -> TheoryError {
    match Theory::parse(source) {
        Ok(_) => panic!("expected {source:?} to be refused, but it parsed"),
        Err(error) => error,
    }
}

// -- the pipeline ---------------------------------------------------------

#[test]
fn an_assigned_theory_carries_its_pins() {
    let theory = parse(ASSIGNED);
    assert_eq!(theory.label().as_str(), "com.company.example");
    assert_eq!(theory.coordinate(), (1, 2));
    assert_eq!(theory.source(), ASSIGNED);
}

#[test]
fn a_source_that_is_not_cddl_is_a_located_syntax_refusal() {
    match refuse("example = {") {
        TheoryError::Syntax { line, column, .. } => {
            assert_eq!(line, 1);
            assert!(column > 1);
        }
        other => panic!("expected a syntax refusal, got {other}"),
    }
}

#[test]
fn an_undefined_rule_is_a_located_refusal() {
    let error = refuse(concat!(
        "example = {\n",
        "  0 => \"com.example\",\n",
        "  1 => [0, 0, uint],\n",
        "  2 => missing\n",
        "}",
    ));
    match error {
        TheoryError::UnresolvedRule { name, line } => {
            assert_eq!(name, "missing");
            assert_eq!(line, 4);
        }
        other => panic!("expected an unresolved-rule refusal, got {other}"),
    }
}

#[test]
fn a_theory_outside_the_fragment_is_refused_as_such() {
    let error = refuse(r#"example = {0 => "com.example", 1 => [0, 0, uint], * uint => any}"#);
    assert!(matches!(error, TheoryError::NotInFragment { .. }));
}

/// Membership is a question about the root map alone, and it is asked
/// first: a theory that is both outside the fragment and referencing an
/// undefined rule is refused as the former.
#[test]
fn fragment_membership_is_decided_before_resolution() {
    let error = refuse(r#"example = {0 => tstr, 1 => [0, 0, uint], 2 => missing}"#);
    assert!(matches!(error, TheoryError::NotInFragment { .. }));
}

#[test]
fn every_fragment_refusal_names_a_line() {
    match refuse("example = uint") {
        TheoryError::NotInFragment { detail } => assert!(detail.starts_with("line 1:")),
        other => panic!("expected a fragment refusal, got {other}"),
    }
}

/// A CDDL document that parses is not thereby a theory: the RFC's own
/// examples are well-formed CDDL and none of them is in the fragment.
#[test]
fn the_rfc_examples_parse_as_cddl_and_are_not_assignable() {
    let reputon = include_str!("corpus/rfc8610-appendix-h/reputon-verbose.cddl");
    assert!(matches!(refuse(reputon), TheoryError::NotInFragment { .. }));

    let prelude = include_str!("corpus/rfc8610-appendix-d-prelude.cddl");
    assert!(matches!(refuse(prelude), TheoryError::NotInFragment { .. }));
}

// -- the evaluable subset -------------------------------------------------

#[test]
fn an_operator_outside_the_subset_is_unevaluable() {
    let error = refuse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => bstr .cbor any}"#);
    match error {
        TheoryError::Unevaluable { operator } => assert_eq!(operator, ".cbor"),
        other => panic!("expected an unevaluable refusal, got {other}"),
    }
}

/// The clause-6 non-check and the evaluability check are different
/// verdicts at different places: an exotic type at a content key passes
/// membership, and the same theory is refused only for its operator.
#[test]
fn an_exotic_type_passes_membership_and_fails_only_on_its_operator() {
    parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => #6.42(bstr)}"#);
    parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr .size 3}"#);

    let error =
        refuse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => #6.42(bstr) .within any}"#);
    assert!(matches!(error, TheoryError::Unevaluable { .. }));
}

#[test]
fn a_pattern_that_will_not_compile_is_refused_at_parse() {
    let error = refuse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr .regexp "a**"}"#);
    assert!(matches!(error, TheoryError::Regexp(_)));
}

/// The one level of CDDL string escaping in front of the XSD rules: the
/// pattern is written `\\.` and compiles as `\.`, so a theory carrying the
/// conventions' own pattern parses.
#[test]
fn the_conventions_pattern_compiles_inside_a_theory() {
    parse(concat!(
        "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => shape}\n",
        "shape = tstr .regexp \"[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\"\n",
    ));
}

// -- the slot surface -----------------------------------------------------

#[test]
fn slots_are_in_ascending_key_order_with_their_requiredness() {
    let theory = parse(ASSIGNED);
    let slots: Vec<(u64, bool)> = theory
        .slots()
        .map(|slot| (slot.key().get(), slot.required()))
        .collect();
    assert_eq!(slots, [(2, true), (7, false)]);
}

#[test]
fn a_slot_is_reachable_by_key() {
    let theory = parse(ASSIGNED);
    assert_eq!(theory.slot(7).expect("key 7").type_source(), "bstr");
    assert!(theory.slot(3).is_none());
    assert!(
        theory.slot(0).is_none(),
        "key 0 is the envelope, not a slot"
    );
    assert!(
        theory.slot(1).is_none(),
        "key 1 is the envelope, not a slot"
    );
}

/// `type_source` is the author's spelling, for display. Two theories whose
/// types are the same up to layout produce different strings here, which is
/// why identity of type is the printer's question and not this one.
#[test]
fn type_source_is_the_spelling_and_not_an_identity() {
    let spaced = parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => uint  /  tstr}"#);
    let tight = parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => uint/tstr}"#);

    assert_eq!(
        spaced.slot(2).expect("key 2").type_source(),
        "uint  /  tstr"
    );
    assert_eq!(tight.slot(2).expect("key 2").type_source(), "uint/tstr");
    assert_ne!(
        spaced.slot(2).expect("key 2").type_source(),
        tight.slot(2).expect("key 2").type_source()
    );

    // The printer says what the two spellings share.
    assert_eq!(spaced.to_cddl(), tight.to_cddl());
}

#[test]
fn the_printed_form_is_normalized_and_the_source_is_not() {
    let theory = parse("e = {0 => \"com.example\", ; the label\n 1 => [0, 0, uint]}");
    assert!(theory.source().contains("; the label"));
    assert_eq!(
        theory.to_cddl(),
        "e = {0 => \"com.example\", 1 => [0, 0, uint]}\n"
    );
}

#[test]
fn a_theory_clones_without_recompiling_anything() {
    let theory = parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr .regexp "a+"}"#);
    let copy = theory.clone();
    assert_eq!(copy.source(), theory.source());
    assert_eq!(copy.to_cddl(), theory.to_cddl());
}

// -- the base theory ------------------------------------------------------

/// The base theory's text is the conventions' schema, byte for byte. The
/// expected string is the conventions' own, so this test fails if either
/// side is edited without the other.
#[test]
fn the_base_theory_is_the_conventions_schema() {
    let expected = r#"global = {
  0 => namespace-label,
  1 => version,
  * (uint .gt 1) => any
}

version = [major: uint, minor: uint, patch: uint]

namespace-label = namespace-form .size (3..255)

namespace-form = tstr .regexp "[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+"
"#;
    assert_eq!(global().source(), expected);
}

#[test]
fn the_base_theory_normalizes_to_its_four_rules() {
    let printed = global().to_cddl();
    let rules: Vec<&str> = printed.lines().collect();
    assert_eq!(rules.len(), 4);
    assert_eq!(
        rules[0],
        "global = {0 => namespace-label, 1 => version, * (uint .gt 1) => any}"
    );
    assert_eq!(
        rules[1],
        "version = [major: uint, minor: uint, patch: uint]"
    );
    assert_eq!(
        rules[2],
        "namespace-label = namespace-form .size (3 .. 255)"
    );
    assert!(rules[3].starts_with("namespace-form = tstr .regexp "));
}

/// The base theory pins nothing and closes nothing, which is exactly why an
/// assigned theory is not it: extension is by restriction.
#[test]
fn the_base_theory_is_not_an_assignable_theory() {
    assert!(matches!(
        refuse(global().source()),
        TheoryError::NotInFragment { .. }
    ));
}

/// `global()` is reached without dispatch and is the same object every
/// time.
#[test]
fn the_base_theory_is_one_object() {
    assert!(std::ptr::eq(global(), global()));
}
