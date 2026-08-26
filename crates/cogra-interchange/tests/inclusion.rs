//! Minor inclusion: the additive-minor check, key by key.
//!
//! The rows the design sizes: legal additions, illegal widening, relaxed
//! and tightened requiredness, a changed type, a dropped key, a required
//! new key, and the rule-rename case that the ruled literal reading of type
//! identity makes a major boundary (´tab:xchg:test-sizing´).

use cogra_interchange::{Inclusion, InclusionBreach, Theory, TheoryError, check_inclusion};

fn parse(source: &str) -> Theory {
    match Theory::parse(source) {
        Ok(theory) => theory,
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

/// The verdict between two theories that are comparable.
fn between(earlier: &str, later: &str) -> Inclusion {
    match check_inclusion(&parse(earlier), &parse(later)) {
        Ok(verdict) => verdict,
        Err(error) => panic!("expected the two theories to be comparable, but: {error}"),
    }
}

fn breaches(earlier: &str, later: &str) -> Vec<InclusionBreach> {
    match between(earlier, later) {
        Inclusion::Violated(breaches) => breaches,
        Inclusion::Holds => panic!("expected a breach, but the inclusion holds"),
    }
}

fn holds(earlier: &str, later: &str) {
    assert_eq!(
        between(earlier, later),
        Inclusion::Holds,
        "expected the inclusion to hold"
    );
}

const BASE: &str = r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr, ? 7 => bstr}"#;

// -- legal additions ------------------------------------------------------

#[test]
fn a_minor_that_changes_nothing_but_its_own_number_includes_its_predecessor() {
    holds(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, ? 7 => bstr}"#,
    );
}

#[test]
fn adding_an_optional_key_is_additive() {
    holds(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, ? 7 => bstr, ? 9 => uint}"#,
    );
}

#[test]
fn adding_several_optional_keys_at_once_is_additive() {
    holds(
        BASE,
        concat!(
            r#"e = {0 => "com.example", 1 => [1, 4, uint], 2 => tstr, ? 7 => bstr, "#,
            r#"? 9 => uint, ? 11 => [* tstr], ? 12 => {a: 1}}"#,
        ),
    );
}

/// Minors need not be consecutive: the check is between two theories, and
/// the registry's own choice of which pair to compare is its business.
#[test]
fn the_two_minors_need_not_be_consecutive() {
    holds(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 9, uint], 2 => tstr, ? 7 => bstr}"#,
    );
}

/// A rule the compared types do not reach is not part of any type's
/// identity, so a later minor may carry vocabulary of its own.
#[test]
fn an_unreached_rule_added_at_the_later_minor_is_not_a_difference() {
    holds(
        BASE,
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 1, uint], 2 => tstr, ? 7 => bstr, ? 8 => later}\n",
            "later = [* uint]\n",
        ),
    );
}

/// Identity of type is the normalized printer's question, never the
/// source's: two spellings of one type are one type.
#[test]
fn a_respelled_type_is_the_same_type() {
    holds(
        r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => uint  /  tstr}"#,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => uint/tstr}"#,
    );
}

/// The rules a type reaches are compared by their printed definitions, so a
/// chain that is written differently and means the same is the same.
#[test]
fn a_reached_rule_chain_respelled_is_the_same_type() {
    holds(
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 0, uint], 2 => outer}\n",
            "outer = [ * inner ]\n",
            "inner   =   tstr\n",
        ),
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 1, uint], 2 => outer}\n",
            "outer = [* inner]\n",
            "inner = tstr\n",
        ),
    );
}

// -- illegal moves --------------------------------------------------------

#[test]
fn dropping_a_content_key_is_a_breach() {
    let found = breaches(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], ? 7 => bstr}"#,
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::KeyDropped { key }] if key.get() == 2
    ));
}

#[test]
fn changing_a_shared_keys_type_is_a_breach() {
    let found = breaches(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => uint, ? 7 => bstr}"#,
    );
    match found.as_slice() {
        [
            InclusionBreach::TypeChanged {
                key,
                earlier,
                later,
            },
        ] => {
            assert_eq!(key.get(), 2);
            assert_eq!(earlier, "tstr");
            assert_eq!(later, "uint");
        }
        other => panic!("expected one changed type, got {other:?}"),
    }
}

/// Widening is a change like any other: the invariant asks for the type
/// *verbatim*, not for a larger one, so a widened key is a major boundary
/// however compatible it looks.
#[test]
fn widening_a_shared_keys_type_is_a_breach() {
    let found = breaches(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr / uint, ? 7 => bstr}"#,
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::TypeChanged { key, .. }] if key.get() == 2
    ));
}

/// The same, one level down: the expression at the key is untouched and a
/// rule it reaches was widened.
#[test]
fn widening_a_reached_rule_is_a_breach() {
    let found = breaches(
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 0, uint], 2 => payload}\n",
            "payload = tstr\n",
        ),
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 1, uint], 2 => payload}\n",
            "payload = tstr / uint\n",
        ),
    );
    match found.as_slice() {
        [
            InclusionBreach::TypeChanged {
                key,
                earlier,
                later,
            },
        ] => {
            assert_eq!(key.get(), 2);
            assert_eq!(earlier, "payload\npayload = tstr");
            assert_eq!(later, "payload\npayload = tstr / uint");
        }
        other => panic!("expected one changed type, got {other:?}"),
    }
}

#[test]
fn relaxing_a_keys_requiredness_is_a_breach() {
    let found = breaches(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], ? 2 => tstr, ? 7 => bstr}"#,
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::RequirednessChanged {
            key,
            earlier: true,
            later: false,
        }] if key.get() == 2
    ));
}

#[test]
fn tightening_a_keys_requiredness_is_a_breach() {
    let found = breaches(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, 7 => bstr}"#,
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::RequirednessChanged {
            key,
            earlier: false,
            later: true,
        }] if key.get() == 7
    ));
}

#[test]
fn a_new_key_that_is_required_is_a_breach() {
    let found = breaches(
        BASE,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, ? 7 => bstr, 9 => uint}"#,
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::NewKeyRequired { key }] if key.get() == 9
    ));
}

/// Every breach the two theories carry is reported, not just the first, and
/// the shared keys come in ascending order with the new keys after them.
#[test]
fn every_breach_is_reported_in_key_order() {
    let found = breaches(
        r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr, 3 => uint, ? 7 => bstr}"#,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], ? 2 => uint, ? 7 => bstr, 9 => uint}"#,
    );
    assert_eq!(found.len(), 4);
    assert!(matches!(
        found[0],
        InclusionBreach::TypeChanged { ref key, .. } if key.get() == 2
    ));
    assert!(matches!(
        found[1],
        InclusionBreach::RequirednessChanged { ref key, .. } if key.get() == 2
    ));
    assert!(matches!(
        found[2],
        InclusionBreach::KeyDropped { ref key } if key.get() == 3
    ));
    assert!(matches!(
        found[3],
        InclusionBreach::NewKeyRequired { ref key } if key.get() == 9
    ));
}

// -- identity of type is literal ------------------------------------------

/// The ruled reading: a pure rule rename between minors, with identical
/// definitions standing behind both names, is no additive minor. The cost
/// is deliberate — it calls a rename a major boundary, which is stricter
/// than the invariant's intent and conservative in the safe direction
/// (´dec:xchg:type-identity´).
#[test]
fn a_pure_rule_rename_is_a_breach() {
    let found = breaches(
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 0, uint], 2 => color}\n",
            "color = tstr .size 6\n",
        ),
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 1, uint], 2 => colour}\n",
            "colour = tstr .size 6\n",
        ),
    );
    match found.as_slice() {
        [
            InclusionBreach::TypeChanged {
                key,
                earlier,
                later,
            },
        ] => {
            assert_eq!(key.get(), 2);
            assert_eq!(earlier, "color\ncolor = tstr .size 6");
            assert_eq!(later, "colour\ncolour = tstr .size 6");
        }
        other => panic!("expected the rename to be a changed type, got {other:?}"),
    }
}

/// The rename is a breach one level down too: the key's own expression is
/// identical and the rule *it* reaches was renamed.
#[test]
fn a_rename_below_the_key_is_a_breach() {
    let found = breaches(
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 0, uint], 2 => outer}\n",
            "outer = [* color]\n",
            "color = tstr\n",
        ),
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 1, uint], 2 => outer}\n",
            "outer = [* colour]\n",
            "colour = tstr\n",
        ),
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::TypeChanged { key, .. }] if key.get() == 2
    ));
}

/// Same name, different definition: the other half of "rule references
/// matched by name, same-named rules required to be identical".
#[test]
fn a_same_named_rule_with_a_different_definition_is_a_breach() {
    let found = breaches(
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 0, uint], 2 => color}\n",
            "color = tstr\n",
        ),
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 1, uint], 2 => color}\n",
            "color = uint\n",
        ),
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::TypeChanged { key, .. }] if key.get() == 2
    ));
}

/// A prelude name is the same rule in every theory, so it is left out of
/// the comparison — but a theory that *shadows* one defines a rule of its
/// own, and dropping the shadow is a difference.
#[test]
fn shadowing_a_prelude_name_at_one_minor_and_not_the_next_is_a_breach() {
    let found = breaches(
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 0, uint], 2 => tstr}\n",
            "tstr = uint\n",
        ),
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr}"#,
    );
    assert!(matches!(
        found.as_slice(),
        [InclusionBreach::TypeChanged { key, .. }] if key.get() == 2
    ));
}

/// Two theories reaching the same prelude type compare equal without the
/// prelude entering the comparison at all.
#[test]
fn a_prelude_type_is_not_part_of_the_compared_form() {
    let found = breaches(
        r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#,
        r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => text}"#,
    );
    match found.as_slice() {
        [InclusionBreach::TypeChanged { earlier, later, .. }] => {
            // `text = tstr` in the prelude, and the two are still
            // different: the comparison is over the expression as written.
            assert_eq!(earlier, "tstr");
            assert_eq!(later, "text");
        }
        other => panic!("expected one changed type, got {other:?}"),
    }
}

// -- composition ----------------------------------------------------------

/// The worked instance of the property in `tests/properties.rs`: the
/// registry compares an acquired minor against the greatest held theory
/// below it and against no lower one, which is sound because "verbatim"
/// composes. Here it composes over three named minors, with the endpoint
/// pair checked as well as the two consecutive ones.
#[test]
fn inclusion_composes_over_three_minors() {
    let first = r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#;
    let second = r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, ? 3 => uint}"#;
    let third =
        r#"e = {0 => "com.example", 1 => [1, 2, uint], 2 => tstr, ? 3 => uint, ? 4 => bstr}"#;

    holds(first, second);
    holds(second, third);
    holds(first, third);
}

/// And it fails to compose only where a consecutive pair already failed: a
/// chain whose middle step drops a key is broken at that step, and the
/// endpoint pair reports the same key.
#[test]
fn a_break_in_the_middle_is_visible_at_the_endpoints() {
    let first = r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#;
    let second = r#"e = {0 => "com.example", 1 => [1, 1, uint]}"#;
    let third = r#"e = {0 => "com.example", 1 => [1, 2, uint], ? 3 => uint}"#;

    holds(second, third);
    for (earlier, later) in [(first, second), (first, third)] {
        assert!(matches!(
            breaches(earlier, later).as_slice(),
            [InclusionBreach::KeyDropped { key }] if key.get() == 2
        ));
    }
}

// -- comparability --------------------------------------------------------

fn incomparable(earlier: &str, later: &str) {
    match check_inclusion(&parse(earlier), &parse(later)) {
        Err(TheoryError::Incomparable) => {}
        Err(other) => panic!("expected Incomparable, got {other}"),
        Ok(verdict) => panic!("expected Incomparable, got the verdict {verdict:?}"),
    }
}

#[test]
fn two_labels_are_not_comparable() {
    incomparable(
        BASE,
        r#"e = {0 => "com.other", 1 => [1, 1, uint], 2 => tstr, ? 7 => bstr}"#,
    );
}

#[test]
fn two_majors_are_not_comparable() {
    incomparable(
        BASE,
        r#"e = {0 => "com.example", 1 => [2, 1, uint], 2 => tstr, ? 7 => bstr}"#,
    );
}

#[test]
fn one_minor_is_not_comparable_with_itself() {
    incomparable(BASE, BASE);
}

/// The check has a direction: the earlier theory's minor must be the
/// lesser, and a pair offered the wrong way round is not comparable rather
/// than quietly compared backwards.
#[test]
fn the_later_minor_may_not_be_the_lesser() {
    incomparable(
        r#"e = {0 => "com.example", 1 => [1, 3, uint], 2 => tstr}"#,
        r#"e = {0 => "com.example", 1 => [1, 2, uint], 2 => tstr}"#,
    );
}

/// A breach is a verdict and travels as one; only incomparability is an
/// error. The two answers are told apart by the type, not by inspection.
#[test]
fn a_breach_is_a_verdict_and_incomparability_is_an_error() {
    let dropped = check_inclusion(
        &parse(BASE),
        &parse(r#"e = {0 => "com.example", 1 => [1, 1, uint], ? 7 => bstr}"#),
    );
    assert!(matches!(dropped, Ok(Inclusion::Violated(_))));
    assert!(!matches!(dropped, Ok(Inclusion::Holds)));

    let other_label = check_inclusion(
        &parse(BASE),
        &parse(r#"e = {0 => "com.other", 1 => [1, 1, uint]}"#),
    );
    assert!(other_label.is_err());
}
