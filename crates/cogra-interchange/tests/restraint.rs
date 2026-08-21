//! The restraint report: where an assigned theory reaches a float, a tag,
//! or a simple value other than `false`, `true`, and `null` — and whether
//! it named what it reaches.
//!
//! The rows the design sizes: explicit provisions with and without a fixed
//! canonical form, and implicit reach through `any`, through a major-type
//! reference, and through a prelude type (`design.md`,
//! `tab:xchg:test-sizing`).

use cogra_interchange::{Restrained, RestraintReport, Theory};

/// The report on a theory whose one content key carries `at_key`.
fn report(at_key: &str) -> RestraintReport {
    let source = format!(r#"e = {{0 => "com.example", 1 => [0, 0, uint], 2 => {at_key}}}"#);
    match Theory::parse(&source) {
        Ok(theory) => theory.restraint(),
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

fn theory(source: &str) -> Theory {
    match Theory::parse(source) {
        Ok(theory) => theory,
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

/// The provisions as (kind, what was named, whether the form is fixed).
fn provisions(report: &RestraintReport) -> Vec<(Restrained, &str, bool)> {
    report
        .provisions()
        .map(|provision| {
            (
                provision.kind(),
                provision.named(),
                provision.fixes_canonical_form(),
            )
        })
        .collect()
}

/// The reaches as (kind, path).
fn reaches(report: &RestraintReport) -> Vec<(Restrained, Vec<&str>)> {
    report
        .implicit_reaches()
        .map(|reach| (reach.kind(), reach.path().collect()))
        .collect()
}

// -- explicit provisions --------------------------------------------------

#[test]
fn a_named_float_width_is_a_provision_that_fixes_its_form() {
    let report = report("float64");
    assert_eq!(
        provisions(&report),
        [(Restrained::Float, "float64", true)],
        "float64 names a width"
    );
    assert!(reaches(&report).is_empty());
    assert!(report.is_restrained());
}

/// Every float name of the prelude is a provision; only the ones that pin a
/// width fix the form.
#[test]
fn the_unwidened_float_names_are_provisions_that_fix_nothing() {
    for name in ["float", "float16-32", "float32-64"] {
        assert_eq!(
            provisions(&report(name)),
            [(Restrained::Float, name, false)],
            "{name} admits more than one width"
        );
    }
    for name in ["float16", "float32", "float64"] {
        assert_eq!(provisions(&report(name)), [(Restrained::Float, name, true)]);
    }
}

/// The same distinction written inline: `#7.25` is the width the prelude
/// calls `float16`.
#[test]
fn a_major_type_seven_form_that_pins_its_information_is_a_provision() {
    assert_eq!(
        provisions(&report("#7.25")),
        [(Restrained::Float, "#7.25", true)]
    );
    assert_eq!(
        provisions(&report("#7.26")),
        [(Restrained::Float, "#7.26", true)]
    );
    assert_eq!(
        provisions(&report("#7.27")),
        [(Restrained::Float, "#7.27", true)]
    );
}

#[test]
fn a_tagged_type_is_a_provision_and_its_number_is_the_form() {
    assert_eq!(
        provisions(&report("#6.42(bstr)")),
        [(Restrained::Tag, "#6.42(bstr)", true)]
    );
    assert_eq!(
        provisions(&report("#6(bstr)")),
        [(Restrained::Tag, "#6(bstr)", false)],
        "a tag of any number names no one number"
    );
}

/// A prelude tag name is a provision and is not descended into: `time`
/// carries a `number`, and the float inside the tag is not a second
/// finding — the author wrote `time`, and the tag is already named.
#[test]
fn a_prelude_tag_name_is_one_provision_and_nothing_below_it() {
    let report = report("time");
    assert_eq!(provisions(&report), [(Restrained::Tag, "time", true)]);
    assert!(reaches(&report).is_empty());
}

/// A tag the author wrote *inline* is a provision, and what it carries is a
/// position of theirs: the `number` inside is reached, and unnamed.
#[test]
fn the_content_of_an_inline_tag_is_a_position_of_its_own() {
    let report = report("#6.1(number)");
    assert_eq!(
        provisions(&report),
        [(Restrained::Tag, "#6.1(number)", true)]
    );
    assert_eq!(reaches(&report), [(Restrained::Float, vec!["number"])]);
}

#[test]
fn a_named_simple_value_is_a_provision() {
    assert_eq!(
        provisions(&report("undefined")),
        [(Restrained::Simple, "undefined", true)]
    );
    assert_eq!(
        provisions(&report("#7.23")),
        [(Restrained::Simple, "#7.23", true)]
    );
    // Simple value 19, which no name of the prelude carries.
    assert_eq!(
        provisions(&report("#7.19")),
        [(Restrained::Simple, "#7.19", true)]
    );
}

/// A floating-point literal names a value and no width, so it is a
/// provision that fixes no form.
#[test]
fn a_floating_point_literal_is_a_provision() {
    assert_eq!(
        provisions(&report("1.5")),
        [(Restrained::Float, "1.5", false)]
    );
    assert_eq!(
        provisions(&report("0.0 .. 1.0")),
        [
            (Restrained::Float, "0.0", false),
            (Restrained::Float, "1.0", false)
        ],
        "both endpoints of a range are positions"
    );
}

/// The three simple values the invariant admits freely are not restrained,
/// under any of their spellings.
#[test]
fn the_freely_admitted_values_are_not_reported() {
    for name in [
        "bool", "true", "false", "nil", "null", "#7.20", "#7.21", "#7.22",
    ] {
        let report = report(name);
        assert!(
            provisions(&report).is_empty() && reaches(&report).is_empty(),
            "{name} is admitted freely"
        );
    }
}

// -- implicit reaches -----------------------------------------------------

#[test]
fn any_reaches_all_three_kinds_without_naming_one() {
    let report = report("any");
    assert!(provisions(&report).is_empty());
    assert_eq!(
        reaches(&report),
        [
            (Restrained::Float, vec!["any"]),
            (Restrained::Tag, vec!["any"]),
            (Restrained::Simple, vec!["any"]),
        ]
    );
    assert!(!report.is_restrained());
}

/// `#` is `any` written out: the prelude's own definition, and it reaches
/// the same way.
#[test]
fn the_bare_data_item_form_reaches_all_three_kinds() {
    let report = report("#");
    assert_eq!(
        reaches(&report),
        [
            (Restrained::Float, vec!["#"]),
            (Restrained::Tag, vec!["#"]),
            (Restrained::Simple, vec!["#"]),
        ]
    );
}

/// An unrestricted major-type reference admits every value of that major
/// type, restrained ones included, and names none of them.
#[test]
fn an_unrestricted_major_type_reference_reaches_what_it_does_not_name() {
    let seven = report("#7");
    assert!(provisions(&seven).is_empty());
    assert_eq!(
        reaches(&seven),
        [
            (Restrained::Float, vec!["#7"]),
            (Restrained::Simple, vec!["#7"]),
        ],
        "major 7 carries the floats and the simple values, and no tag"
    );

    let six = report("#6");
    assert_eq!(reaches(&six), [(Restrained::Tag, vec!["#6"])]);
}

/// The major types that carry nothing restrained reach nothing.
#[test]
fn the_unrestrained_major_types_reach_nothing() {
    for form in ["#0", "#1", "#2", "#3", "#4", "#5"] {
        let report = report(form);
        assert!(
            provisions(&report).is_empty() && reaches(&report).is_empty(),
            "{form} carries nothing restrained"
        );
    }
}

/// A prelude type that reaches a restrained kind among other things: the
/// author wrote `number`, and nothing they wrote says "float".
#[test]
fn a_prelude_alias_that_reaches_a_float_is_an_implicit_reach() {
    let report = report("number");
    assert!(provisions(&report).is_empty());
    assert_eq!(reaches(&report), [(Restrained::Float, vec!["number"])]);
}

#[test]
fn a_prelude_alias_that_reaches_a_tag_is_an_implicit_reach() {
    assert_eq!(
        reaches(&report("integer")),
        [(Restrained::Tag, vec!["integer"])]
    );
    assert_eq!(
        reaches(&report("unsigned")),
        [(Restrained::Tag, vec!["unsigned"])]
    );
}

/// Through the theory's own rules: the path names each rule entered, so a
/// reader can walk back to the position.
#[test]
fn a_reach_through_a_rule_chain_carries_its_path() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => outer}\n",
        "outer = [* inner]\n",
        "inner = {a: any}\n",
    ));
    let report = theory.restraint();
    assert_eq!(
        reaches(&report),
        [
            (Restrained::Float, vec!["outer", "inner", "any"]),
            (Restrained::Tag, vec!["outer", "inner", "any"]),
            (Restrained::Simple, vec!["outer", "inner", "any"]),
        ]
    );
}

/// A rule the author wrote is descended into, so a float they named inside
/// one of their own rules is a provision and not a reach.
#[test]
fn a_float_named_inside_the_theorys_own_rule_is_a_provision() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => reading}\n",
        "reading = [value: float64, unit: tstr]\n",
    ));
    let report = theory.restraint();
    assert_eq!(provisions(&report), [(Restrained::Float, "float64", true)]);
    assert!(report.is_restrained());
}

/// A map key is a position: a map keyed by floats reaches floats.
#[test]
fn a_member_key_is_a_position() {
    let report = report("{* float64 => tstr}");
    assert_eq!(provisions(&report), [(Restrained::Float, "float64", true)]);
}

/// A generic argument is walked where it is written, which is how a
/// restrained type reaches the report through a generic rule.
#[test]
fn a_generic_argument_is_walked_where_it_is_written() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => list<float64>}\n",
        "list<t> = [* t]\n",
    ));
    assert_eq!(
        provisions(&theory.restraint()),
        [(Restrained::Float, "float64", true)]
    );
}

/// A recursive rule terminates: the walk enters each of the theory's own
/// rules once per content key.
#[test]
fn a_recursive_rule_terminates() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => tree}\n",
        "tree = [value: any, children: [* tree]]\n",
    ));
    let report = theory.restraint();
    assert_eq!(reaches(&report).len(), 3);
    assert!(!report.is_restrained());
}

// -- the report as a whole ------------------------------------------------

/// The clean case: a theory of integers and text reaches nothing
/// restrained, so it has nothing to report and is restrained vacuously.
#[test]
fn an_integer_only_theory_reports_nothing() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => uint, 3 => int, ",
        "? 4 => [* tstr], ? 5 => {a: uint, b: bool}}",
    ));
    let report = theory.restraint();
    assert_eq!(report.provisions().count(), 0);
    assert_eq!(report.implicit_reaches().count(), 0);
    assert!(report.is_restrained());
}

/// A theory whose every restrained position is named is restrained by
/// provision, which is what the invariant asks for.
#[test]
fn a_theory_of_named_provisions_is_restrained() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => float64, ",
        "3 => #6.1(uint), ? 4 => undefined}",
    ));
    let report = theory.restraint();
    assert_eq!(report.provisions().count(), 3);
    assert!(report.is_restrained());
}

/// Findings are keyed by content key, and the keys come in ascending order
/// however the theory wrote them.
#[test]
fn findings_are_keyed_and_ordered_by_content_key() {
    let theory = theory(r#"e = {9 => any, 0 => "com.example", 3 => float64, 1 => [0, 0, uint]}"#);
    let report = theory.restraint();
    let provision_keys: Vec<u64> = report.provisions().map(|p| p.key().get()).collect();
    let reach_keys: Vec<u64> = report.implicit_reaches().map(|r| r.key().get()).collect();
    assert_eq!(provision_keys, [3]);
    assert_eq!(reach_keys, [9, 9, 9]);
}

/// One position reached twice under one key is one finding: the report is
/// a set of findings, not a count of occurrences.
#[test]
fn a_repeated_position_is_reported_once() {
    let report = report("[float64, float64]");
    assert_eq!(provisions(&report), [(Restrained::Float, "float64", true)]);
}

/// The report is computed and nothing is enforced here: a theory that
/// reaches a float through `any` is a perfectly good `Theory`, and it is
/// acquisition that refuses it.
#[test]
fn a_theory_that_reaches_implicitly_still_parses() {
    let theory = theory(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => any}"#);
    assert_eq!(theory.slot(2).expect("key 2").type_source(), "any");
    assert!(!theory.restraint().is_restrained());
}

/// A control operator's operand is a control value, not a position: a
/// `.size` bound written as a float constrains a string and admits no
/// float.
#[test]
fn a_control_operands_value_is_not_a_position() {
    let report = report("tstr .size 3");
    assert!(provisions(&report).is_empty() && reaches(&report).is_empty());
}
