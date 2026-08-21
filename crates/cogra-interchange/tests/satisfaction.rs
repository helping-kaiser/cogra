//! Satisfaction: the judgment `d ⊨ S` over the base theory, an assigned
//! theory, and an open companion, and the matching rules underneath it.
//!
//! The matching rules are RFC 8610 Appendix C together with the PEG
//! semantics of its Appendix A and the cuts of its §3.5.4; the control
//! operators are the ten of `dec:xchg:evaluable-subset`. Where the RFC's
//! own text fixes an outcome, the test quotes it, so a later reader can see
//! what the assertion is evidence for.

use cogra_interchange::{
    Array, Bytes, Content, ContentKey, Document, Envelope, Float, Map, MismatchKind,
    NamespaceLabel, Satisfaction, Simple, Tag, Text, Theory, Value, Version, satisfies,
    satisfies_global, satisfies_open,
};

// -- fixtures -------------------------------------------------------------

/// A theory of one content key at 2, typed as given, at `com.example` 1.0.
fn theory_of(ty: &str) -> Theory {
    theory(&format!(
        r#"e = {{0 => "com.example", 1 => [1, 0, uint], 2 => {ty}}}"#
    ))
}

/// A theory of one content key at 2, with further rules after it.
fn theory_with(ty: &str, rules: &str) -> Theory {
    theory(&format!(
        "e = {{0 => \"com.example\", 1 => [1, 0, uint], 2 => {ty}}}\n{rules}\n"
    ))
}

fn theory(source: &str) -> Theory {
    match Theory::parse(source) {
        Ok(theory) => theory,
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

/// The document `{0: "com.example", 1: [1, 0, 0], 2: value}`.
fn document_of(value: Value) -> Document {
    document("com.example", Version::new(1, 0, 0), vec![(2, value)])
}

fn document(label: &str, version: Version, entries: Vec<(u64, Value)>) -> Document {
    let label = NamespaceLabel::parse(label).expect("a namespace label");
    let mut content = Content::new();
    for (key, value) in entries {
        content.insert(ContentKey::new(key).expect("a content key"), value);
    }
    Document::new(Envelope::new(label, version), content)
}

/// Whether a value at key 2 satisfies a theory typing key 2 as `ty`.
fn admits(ty: &str, value: Value) -> bool {
    satisfies(&document_of(value), &theory_of(ty)).holds()
}

fn text(s: &str) -> Value {
    Value::Text(Text::from(s.to_owned()))
}

fn bytes(b: &[u8]) -> Value {
    Value::Bytes(Bytes::from(b.to_vec()))
}

fn array(items: Vec<Value>) -> Value {
    Value::Array(Array::new(items))
}

fn map(entries: Vec<(Value, Value)>) -> Value {
    Value::Map(Map::new(entries).expect("distinct keys"))
}

fn float(v: f64) -> Value {
    Value::Float(Float::from_f64(v).expect("a canonical float"))
}

fn mismatches(verdict: Satisfaction) -> Vec<cogra_interchange::Mismatch> {
    match verdict {
        Satisfaction::Holds => panic!("expected a negative judgment, and it held"),
        Satisfaction::Fails(mismatches) => mismatches,
    }
}

// -- the base theory ------------------------------------------------------

#[test]
fn the_base_theory_admits_a_document_with_no_content() {
    let document = document("com.example", Version::new(1, 0, 0), Vec::new());
    assert!(satisfies_global(&document).holds());
}

#[test]
fn the_base_theory_admits_every_content_key_and_every_value() {
    let document = document(
        "com.example.thing",
        Version::new(7, 8, 9),
        vec![
            (2, text("anything")),
            (3, array(vec![Value::Null, float(1.5)])),
            (u64::MAX, Value::Tag(Tag::new(42, Value::Unsigned(1)))),
        ],
    );
    assert!(satisfies_global(&document).holds());
}

/// The base theory's key 0 is `namespace-label`, which is
/// `namespace-form .size (3..255)` over a `.regexp` — so this judgment runs
/// the conventions' own pattern through the seam on every document.
#[test]
fn the_base_theory_runs_the_conventions_pattern() {
    for label in ["a.b", "com.example", "a-b.c9.d", "0.0"] {
        let document = document(label, Version::new(1, 0, 0), Vec::new());
        assert!(satisfies_global(&document).holds(), "{label}");
    }
}

// -- an assigned theory ---------------------------------------------------

#[test]
fn a_document_of_the_theorys_shape_satisfies_it() {
    let theory = theory(concat!(
        "e = {0 => \"com.company.example\", 1 => [1, 2, uint],\n",
        "  2 => tstr,\n",
        "  ? 7 => bstr}\n",
    ));
    let document = document(
        "com.company.example",
        Version::new(1, 2, 30),
        vec![(2, text("hello")), (7, bytes(&[1, 2, 3]))],
    );
    assert!(satisfies(&document, &theory).holds());
}

#[test]
fn an_optional_key_may_be_absent() {
    let theory = theory(r#"e = {0 => "com.example", 1 => [1, 0, uint], ? 2 => tstr}"#);
    let document = document("com.example", Version::new(1, 0, 0), Vec::new());
    assert!(satisfies(&document, &theory).holds());
}

#[test]
fn a_required_key_may_not_be_absent() {
    let theory = theory_of("tstr");
    let document = document("com.example", Version::new(1, 0, 0), Vec::new());
    let mismatches = mismatches(satisfies(&document, &theory));
    assert_eq!(mismatches.len(), 1);
    assert_eq!(mismatches[0].key().map(|key| key.get()), Some(2));
    assert_eq!(mismatches[0].found(), "nothing: the key is absent");
}

/// The assignable fragment closes the map, so a key the theory does not
/// enumerate is a mismatch and not an extension.
#[test]
fn a_key_the_theory_does_not_enumerate_is_refused() {
    let theory = theory_of("tstr");
    let document = document(
        "com.example",
        Version::new(1, 0, 0),
        vec![(2, text("hello")), (5, Value::Null)],
    );
    let mismatches = mismatches(satisfies(&document, &theory));
    assert_eq!(mismatches.len(), 1);
    assert_eq!(mismatches[0].key().map(|key| key.get()), Some(5));
    assert!(mismatches[0].expected().contains("does not enumerate"));
}

#[test]
fn the_pinned_label_is_matched() {
    let theory = theory_of("tstr");
    let document = document("com.other", Version::new(1, 0, 0), vec![(2, text("hello"))]);
    let mismatches = mismatches(satisfies(&document, &theory));
    assert_eq!(mismatches[0].at(), "key 0");
    assert_eq!(mismatches[0].key(), None);
}

#[test]
fn the_pinned_major_and_minor_are_matched_and_the_patch_is_free() {
    let theory = theory(r#"e = {0 => "com.example", 1 => [1, 2, uint]}"#);
    for patch in [0, 1, u64::MAX] {
        let document = document("com.example", Version::new(1, 2, patch), Vec::new());
        assert!(satisfies(&document, &theory).holds(), "patch {patch}");
    }
    for (major, minor) in [(1, 3), (2, 2), (0, 2)] {
        let document = document("com.example", Version::new(major, minor, 0), Vec::new());
        let mismatches = mismatches(satisfies(&document, &theory));
        assert_eq!(mismatches[0].at(), "key 1", "{major}.{minor}");
    }
}

#[test]
fn every_failing_key_is_reported_in_ascending_order() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [1, 0, uint],\n",
        "  2 => tstr, 3 => uint, 4 => bstr}\n",
    ));
    let document = document(
        "com.example",
        Version::new(1, 0, 0),
        vec![(2, Value::Null), (3, Value::Unsigned(1)), (4, Value::Null)],
    );
    let mismatches = mismatches(satisfies(&document, &theory));
    let keys: Vec<Option<u64>> = mismatches
        .iter()
        .map(|mismatch| mismatch.key().map(|key| key.get()))
        .collect();
    assert_eq!(keys, [Some(2), Some(4)]);
}

// -- the open companion ---------------------------------------------------

#[test]
fn the_companion_frees_the_minor_and_admits_unknown_keys() {
    let theory = theory(r#"e = {0 => "com.example", 1 => [1, 2, uint], 2 => tstr}"#);
    let open = theory.open_companion();
    let document = document(
        "com.example",
        Version::new(1, 9, 0),
        vec![(2, text("hello")), (11, array(vec![Value::Null]))],
    );
    assert!(!satisfies(&document, &theory).holds());
    assert!(satisfies_open(&document, &open).holds());
}

#[test]
fn the_companion_keeps_every_type_it_was_derived_from() {
    let theory = theory(r#"e = {0 => "com.example", 1 => [1, 2, uint], 2 => tstr}"#);
    let open = theory.open_companion();
    let document = document(
        "com.example",
        Version::new(1, 9, 0),
        vec![(2, Value::Unsigned(1))],
    );
    let mismatches = mismatches(satisfies_open(&document, &open));
    assert_eq!(mismatches[0].key().map(|key| key.get()), Some(2));
    assert_eq!(mismatches[0].expected(), "tstr");
}

#[test]
fn the_companion_keeps_the_major_and_the_label_pinned() {
    let theory = theory(r#"e = {0 => "com.example", 1 => [1, 2, uint]}"#);
    let open = theory.open_companion();

    let other_major = document("com.example", Version::new(2, 2, 0), Vec::new());
    assert!(!satisfies_open(&other_major, &open).holds());

    let other_label = document("com.other", Version::new(1, 2, 0), Vec::new());
    assert!(!satisfies_open(&other_label, &open).holds());
}

/// The companion carries the theory's compiled patterns rather than
/// recompiling them, and the tolerant judgment runs them.
#[test]
fn the_companion_runs_the_theorys_patterns() {
    let theory = theory_of(r#"tstr .regexp "[a-z]+""#);
    let open = theory.open_companion();
    assert!(satisfies_open(&document_of(text("abc")), &open).holds());
    assert!(!satisfies_open(&document_of(text("ABC")), &open).holds());
}

// -- literals and the prelude ---------------------------------------------

#[test]
fn a_literal_matches_only_that_value() {
    assert!(admits("5", Value::Unsigned(5)));
    assert!(!admits("5", Value::Unsigned(6)));
    assert!(admits("-3", Value::integer(-3).expect("in range")));
    assert!(admits(r#""abc""#, text("abc")));
    assert!(!admits(r#""abc""#, text("abcd")));
    assert!(admits("1.5", float(1.5)));
}

/// "no conversions defined": an integer literal is no float and a float
/// literal is no integer.
#[test]
fn a_literal_converts_nothing() {
    assert!(!admits("1", float(1.0)));
    assert!(!admits("1.0", Value::Unsigned(1)));
}

#[test]
fn a_byte_literal_is_read_in_every_notation() {
    assert!(admits("h'0815'", bytes(&[0x08, 0x15])));
    assert!(!admits("h'0815'", bytes(&[0x08, 0x16])));
    assert!(admits("'abc'", bytes(b"abc")));
    assert!(admits("b64'aGVsbG8='", bytes(b"hello")));
}

#[test]
fn the_prelude_types_match_their_major_types() {
    assert!(admits("uint", Value::Unsigned(0)));
    assert!(!admits("uint", Value::integer(-1).expect("in range")));
    assert!(admits("nint", Value::integer(-1).expect("in range")));
    assert!(admits("int", Value::integer(-1).expect("in range")));
    assert!(admits("int", Value::Unsigned(1)));
    assert!(admits("bstr", bytes(&[1])));
    assert!(admits("tstr", text("a")));
    assert!(!admits("tstr", bytes(b"a")));
    assert!(admits("bool", Value::Bool(true)));
    assert!(admits("nil", Value::Null));
    assert!(admits("undefined", Value::Simple(Simple::UNDEFINED)));
    assert!(admits("any", Value::Null));
    assert!(admits("any", array(vec![Value::Null])));
}

#[test]
fn the_prelude_number_types_admit_both_kinds() {
    assert!(admits("number", Value::Unsigned(1)));
    assert!(admits("number", float(1.5)));
    assert!(!admits("number", text("1")));
    assert!(admits("float", float(1.5)));
    assert!(!admits("float", Value::Unsigned(1)));
}

/// §2.2.3: "`#7.25` specifies the set of values that can be represented as
/// half-precision floats; it does not mandate that these values also do
/// have to be serialized as half-precision floats". A value representable
/// in binary16 is representable in binary32 and binary64 too.
#[test]
fn the_float_widths_are_sets_of_values_and_not_serializations() {
    assert!(admits("float16", float(1.5)));
    assert!(admits("float32", float(1.5)));
    assert!(admits("float64", float(1.5)));

    // 1.1 needs binary64.
    assert!(!admits("float16", float(1.1)));
    assert!(!admits("float32", float(1.1)));
    assert!(admits("float64", float(1.1)));
}

#[test]
fn a_tagged_prelude_type_matches_its_tag() {
    assert!(admits("uri", Value::Tag(Tag::new(32, text("a:b")))));
    assert!(!admits("uri", Value::Tag(Tag::new(33, text("a:b")))));
    assert!(!admits("uri", text("a:b")));
    assert!(admits("time", Value::Tag(Tag::new(1, Value::Unsigned(0)))));
}

// -- representation types -------------------------------------------------

#[test]
fn a_major_type_matches_by_major_type() {
    assert!(admits("#0", Value::Unsigned(1)));
    assert!(admits("#1", Value::integer(-1).expect("in range")));
    assert!(admits("#2", bytes(&[])));
    assert!(admits("#3", text("")));
    assert!(admits("#4", array(Vec::new())));
    assert!(admits("#5", map(Vec::new())));
    assert!(admits("#6", Value::Tag(Tag::new(0, Value::Null))));
    assert!(admits("#7", Value::Bool(false)));
    assert!(!admits("#7", Value::Unsigned(1)));
    assert!(admits("#", Value::Unsigned(1)));
}

#[test]
fn an_additional_information_narrows_a_major_type() {
    // 0 through 23 stand in the head; 24 and above take an argument byte.
    assert!(admits("#0.5", Value::Unsigned(5)));
    assert!(!admits("#0.5", Value::Unsigned(6)));
    assert!(admits("#0.24", Value::Unsigned(200)));
    assert!(!admits("#0.24", Value::Unsigned(5)));
    assert!(admits("#7.20", Value::Bool(false)));
    assert!(admits("#7.21", Value::Bool(true)));
    assert!(admits("#7.22", Value::Null));
    assert!(admits("#7.23", Value::Simple(Simple::UNDEFINED)));
    assert!(!admits("#7.23", Value::Null));
}

#[test]
fn a_tagged_type_matches_its_number_and_its_content() {
    assert!(admits("#6.42(tstr)", Value::Tag(Tag::new(42, text("a")))));
    assert!(!admits(
        "#6.42(tstr)",
        Value::Tag(Tag::new(42, Value::Null))
    ));
    assert!(!admits("#6.42(tstr)", Value::Tag(Tag::new(43, text("a")))));
    // `#6(...)` tags with any number.
    assert!(admits("#6(tstr)", Value::Tag(Tag::new(9, text("a")))));
}

// -- choices, arrays, maps ------------------------------------------------

#[test]
fn a_type_choice_matches_any_alternative() {
    assert!(admits("uint / tstr", Value::Unsigned(1)));
    assert!(admits("uint / tstr", text("a")));
    assert!(!admits("uint / tstr", Value::Null));
}

#[test]
fn an_array_matches_its_group_in_order() {
    assert!(admits(
        "[uint, tstr]",
        array(vec![Value::Unsigned(1), text("a")])
    ));
    assert!(!admits(
        "[uint, tstr]",
        array(vec![text("a"), Value::Unsigned(1)])
    ));
    assert!(!admits("[uint, tstr]", array(vec![Value::Unsigned(1)])));
    assert!(!admits(
        "[uint, tstr]",
        array(vec![Value::Unsigned(1), text("a"), Value::Null])
    ));
}

#[test]
fn arrays_nest() {
    assert!(admits(
        "[[uint], [tstr, tstr]]",
        array(vec![
            array(vec![Value::Unsigned(1)]),
            array(vec![text("a"), text("b")]),
        ])
    ));
    assert!(!admits(
        "[[uint], [tstr, tstr]]",
        array(vec![
            array(vec![Value::Unsigned(1)]),
            array(vec![text("a")])
        ])
    ));
}

/// A rule that recurses through a value descends one call frame per level of
/// the document it matches. A document nested past the matcher's depth bound
/// is answered as a mismatch rather than overflowing the stack: a theory and
/// a document a hostile party controls must not crash the judge.
#[test]
fn a_recursive_theory_against_a_deep_document_is_bounded() {
    let theory = theory_with("nest", "nest = [nest] / 0");

    let deep = |levels: usize| {
        let mut bytes = vec![0x81u8; levels];
        bytes.push(0x00);
        Value::from_canonical_bytes(&bytes).expect("nesting is bounded by the input")
    };

    // Shallow enough to match within the bound.
    assert!(satisfies(&document_of(deep(64)), &theory).holds());
    // Far past the bound: a verdict, not a crash.
    assert!(!satisfies(&document_of(deep(500_000)), &theory).holds());
}

#[test]
fn an_array_member_key_is_documentary() {
    assert!(admits(
        "[name: tstr, age: uint]",
        array(vec![text("a"), Value::Unsigned(3)])
    ));
}

#[test]
fn a_map_matches_by_picking_members() {
    assert!(admits(
        "{a: uint, b: tstr}",
        map(vec![
            (text("a"), Value::Unsigned(1)),
            (text("b"), text("x")),
        ])
    ));
    // Order in the map is no part of the question.
    assert!(admits(
        "{b: tstr, a: uint}",
        map(vec![
            (text("a"), Value::Unsigned(1)),
            (text("b"), text("x")),
        ])
    ));
    assert!(!admits(
        "{a: uint, b: tstr}",
        map(vec![(text("a"), Value::Unsigned(1))])
    ));
}

#[test]
fn a_map_must_be_consumed_whole() {
    assert!(!admits(
        "{a: uint}",
        map(vec![
            (text("a"), Value::Unsigned(1)),
            (text("b"), Value::Unsigned(2)),
        ])
    ));
    assert!(admits(
        "{a: uint, * tstr => any}",
        map(vec![
            (text("a"), Value::Unsigned(1)),
            (text("b"), Value::Unsigned(2)),
        ])
    ));
}

/// The RFC's own example of a cut, §3.5.4: with the cut, the data item
/// `{"optional-key": "nonsense"}` no longer matches, because the key alone
/// locks in the pick.
#[test]
fn a_cut_locks_in_a_pick_by_key_alone() {
    let without = r#"{? "optional-key" => int, * tstr => any}"#;
    let with = r#"{? "optional-key" ^ => int, * tstr => any}"#;
    let colon = r#"{? "optional-key": int, * tstr => any}"#;
    let document = map(vec![(text("optional-key"), text("nonsense"))]);

    assert!(admits(without, document.clone()));
    assert!(!admits(with, document.clone()));
    // "the ':' shortcut is actually defined to include the cut semantics".
    assert!(!admits(colon, document));
}

/// A prioritized choice picks *between* alternatives, so an alternative
/// that fails half way must give back the members it had already taken.
#[test]
fn a_failed_group_choice_in_a_map_gives_its_members_back() {
    let both = map(vec![
        (text("a"), Value::Unsigned(1)),
        (text("c"), Value::Unsigned(2)),
    ]);
    // The first alternative takes `a` and then wants a `b` that is not
    // there; the second wants the `a` the first had taken.
    assert!(admits("{(a: uint, b: uint // a: uint, c: uint)}", both));
    assert!(!admits(
        "{(a: uint, b: uint // a: uint, c: uint)}",
        map(vec![(text("a"), Value::Unsigned(1))])
    ));
}

// -- occurrence -----------------------------------------------------------

#[test]
fn the_occurrence_indicators_bound_repetition() {
    assert!(admits("[* uint]", array(Vec::new())));
    assert!(admits(
        "[* uint]",
        array(vec![Value::Unsigned(1), Value::Unsigned(2)])
    ));
    assert!(!admits("[+ uint]", array(Vec::new())));
    assert!(admits("[+ uint]", array(vec![Value::Unsigned(1)])));
    assert!(admits("[? uint]", array(Vec::new())));
    assert!(admits("[? uint]", array(vec![Value::Unsigned(1)])));
    assert!(!admits(
        "[? uint]",
        array(vec![Value::Unsigned(1), Value::Unsigned(2)])
    ));
}

#[test]
fn a_bounded_occurrence_bounds_both_ends() {
    let three = array(vec![
        Value::Unsigned(1),
        Value::Unsigned(2),
        Value::Unsigned(3),
    ]);
    assert!(!admits("[2*3 uint]", array(vec![Value::Unsigned(1)])));
    assert!(admits(
        "[2*3 uint]",
        array(vec![Value::Unsigned(1), Value::Unsigned(2)])
    ));
    assert!(admits("[2*3 uint]", three.clone()));
    assert!(!admits(
        "[2*3 uint]",
        array(vec![
            Value::Unsigned(1),
            Value::Unsigned(2),
            Value::Unsigned(3),
            Value::Unsigned(4),
        ])
    ));
    assert!(admits("[2* uint]", three.clone()));
    assert!(admits("[*3 uint]", three));
}

#[test]
fn a_group_repeats_as_a_unit() {
    assert!(admits(
        "[* (tstr, uint)]",
        array(vec![
            text("a"),
            Value::Unsigned(1),
            text("b"),
            Value::Unsigned(2)
        ])
    ));
    assert!(!admits(
        "[* (tstr, uint)]",
        array(vec![text("a"), Value::Unsigned(1), text("b")])
    ));
}

/// Appendix A, which the RFC marks normative: the occurrence indicators are
/// greedy and PEG does not backtrack, so "`*a a` in CDDL syntax never can
/// match anything".
#[test]
fn a_greedy_occurrence_leaves_nothing_for_what_follows() {
    assert!(!admits("[* uint, uint]", array(vec![Value::Unsigned(1)])));
    assert!(!admits(
        "[* uint, uint]",
        array(vec![Value::Unsigned(1), Value::Unsigned(2)])
    ));
    // The same shape with the repetition bounded away from the last element
    // matches, which is what says the failure above is the greed and not a
    // defect of the matcher.
    assert!(admits(
        "[* tstr, uint]",
        array(vec![text("a"), Value::Unsigned(1)])
    ));
}

#[test]
fn a_group_choice_takes_the_first_alternative_that_matches() {
    assert!(admits(
        "[uint, uint // tstr]",
        array(vec![Value::Unsigned(1), Value::Unsigned(2)])
    ));
    assert!(admits("[uint, uint // tstr]", array(vec![text("a")])));
    assert!(!admits("[uint, uint // tstr]", array(vec![Value::Null])));
}

// -- ranges ---------------------------------------------------------------

#[test]
fn an_inclusive_range_includes_its_upper_bound() {
    assert!(!admits("1..3", Value::Unsigned(0)));
    assert!(admits("1..3", Value::Unsigned(1)));
    assert!(admits("1..3", Value::Unsigned(3)));
    assert!(!admits("1..3", Value::Unsigned(4)));
}

#[test]
fn an_exclusive_range_excludes_it() {
    assert!(admits("1...3", Value::Unsigned(2)));
    assert!(!admits("1...3", Value::Unsigned(3)));
}

#[test]
fn a_range_reaches_its_bounds_through_rule_references() {
    let theory = theory_with("byte", "byte = 0..max-byte\nmax-byte = 255");
    assert!(satisfies(&document_of(Value::Unsigned(255)), &theory).holds());
    assert!(!satisfies(&document_of(Value::Unsigned(256)), &theory).holds());
}

#[test]
fn a_range_spans_the_negative_integers() {
    assert!(admits("-3..3", Value::integer(-3).expect("in range")));
    assert!(!admits("-3..3", Value::integer(-4).expect("in range")));
}

/// "CDDL currently only allows ranges between integers (matching integer
/// values) or between floating-point values (matching floating-point
/// values)."
#[test]
fn integer_and_floating_point_ranges_do_not_mix() {
    assert!(admits("0.0..1.0", float(0.5)));
    assert!(!admits("0.0..1.0", Value::Unsigned(0)));
    assert!(!admits("0..10", float(1.0)));
    // `BAD-range1 = 0..10.0 ; NOT DEFINED`
    assert!(!admits("0..10.0", Value::Unsigned(1)));
    assert!(!admits("0..10.0", float(1.0)));
}

// -- .size ----------------------------------------------------------------

/// "A `.size` control controls the size of the target in bytes ... where it
/// directly controls the number of bytes in the string." Bytes, not
/// characters: three two-byte characters are six.
#[test]
fn size_on_a_text_string_counts_bytes() {
    assert!(admits("tstr .size 3", text("abc")));
    assert!(!admits("tstr .size 3", text("ab")));
    assert!(!admits("tstr .size 3", text("äöü")));
    assert!(admits("tstr .size 6", text("äöü")));
    // "a€" is two characters and four bytes.
    assert!(admits("tstr .size 4", text("a€")));
    assert!(!admits("tstr .size 2", text("a€")));
}

#[test]
fn size_on_a_byte_string_counts_bytes() {
    assert!(admits("bstr .size 4", bytes(&[0, 1, 2, 3])));
    assert!(!admits("bstr .size 4", bytes(&[0, 1, 2])));
}

#[test]
fn size_takes_a_control_type_and_not_only_a_literal() {
    assert!(admits("bstr .size (1..63)", bytes(&[0])));
    assert!(admits("bstr .size (1..63)", bytes(&[0; 63])));
    assert!(!admits("bstr .size (1..63)", bytes(&[])));
    assert!(!admits("bstr .size (1..63)", bytes(&[0; 64])));
}

/// "`uint .size N` is equivalent to `0...BYTES_N`, where
/// BYTES_N == 256**N" — a range, and not a count of the bytes the value
/// happens to need.
#[test]
fn size_on_an_unsigned_integer_is_a_range() {
    assert!(admits("uint .size 3", Value::Unsigned(0)));
    assert!(admits("uint .size 3", Value::Unsigned(16_777_215)));
    assert!(!admits("uint .size 3", Value::Unsigned(16_777_216)));
    assert!(admits("uint .size 1", Value::Unsigned(255)));
    assert!(!admits("uint .size 1", Value::Unsigned(256)));
    assert!(admits("uint .size 8", Value::Unsigned(u64::MAX)));
}

#[test]
fn size_refuses_a_target_it_is_not_defined_for() {
    assert!(!admits("any .size 1", Value::Null));
    assert!(!admits("any .size 1", array(vec![Value::Unsigned(1)])));
}

// -- .regexp --------------------------------------------------------------

#[test]
fn regexp_matches_the_whole_string() {
    assert!(admits(r#"tstr .regexp "[a-z]+""#, text("abc")));
    assert!(!admits(r#"tstr .regexp "[a-z]+""#, text("abc1")));
    assert!(!admits(r#"tstr .regexp "[a-z]+""#, text("1abc")));
    assert!(!admits(r#"tstr .regexp "[a-z]+""#, text("")));
}

#[test]
fn regexp_refuses_a_target_that_is_no_text_string() {
    assert!(!admits(r#"any .regexp "[a-z]+""#, bytes(b"abc")));
}

/// The conventions' own pattern, reached through a rule reference — the
/// shape `namespace-form` has in the base theory.
#[test]
fn regexp_reaches_its_pattern_through_a_rule_reference() {
    let theory = theory_with(
        "tstr .regexp shape",
        r#"shape = "[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+""#,
    );
    assert!(satisfies(&document_of(text("com.example")), &theory).holds());
    assert!(!satisfies(&document_of(text("Com.Example")), &theory).holds());
    assert!(!satisfies(&document_of(text("com")), &theory).holds());
}

/// The one runtime refusal: a pattern that exhausts the seam's operation
/// budget is a mismatch of its own kind, naming the budget and the pattern
/// — never a panic, and never a silent `false`
/// (`design.md`, `dec:xchg:regexp-engine`).
#[test]
fn an_exhausted_regexp_budget_is_a_located_mismatch() {
    let theory = theory_of(r#"tstr .regexp "(a+)+b""#);
    let subject = "a".repeat(30);
    let verdict = satisfies(&document_of(text(&subject)), &theory);

    let mismatches = mismatches(verdict);
    assert_eq!(mismatches.len(), 1);
    assert_eq!(mismatches[0].key().map(|key| key.get()), Some(2));
    assert!(matches!(
        mismatches[0].kind(),
        MismatchKind::BudgetExhausted { budget } if budget > 0
    ));
    assert!(
        mismatches[0].found().contains("(a+)+b"),
        "the refusal names the pattern: {}",
        mismatches[0].found()
    );
}

/// A subject the same pattern answers about within the budget gets an
/// ordinary answer, which is what says the refusal above is about the
/// budget and not about the pattern.
#[test]
fn the_same_pattern_answers_a_short_subject() {
    let theory = theory_of(r#"tstr .regexp "(a+)+b""#);
    assert!(satisfies(&document_of(text("aaab")), &theory).holds());
    assert!(!satisfies(&document_of(text("aaa")), &theory).holds());
}

// -- .bits ----------------------------------------------------------------

/// "a `.bits` control on an unsigned integer `i` indicates that for all
/// unsigned integers `n` where `(i & (1 << n)) != 0`, `n` must be in the
/// control type."
#[test]
fn bits_on_an_unsigned_integer_numbers_its_set_bits() {
    let theory = theory_with("uint .bits rwx", "rwx = &(r: 2, w: 1, x: 0)");
    for admitted in [0u64, 1, 2, 4, 7] {
        assert!(
            satisfies(&document_of(Value::Unsigned(admitted)), &theory).holds(),
            "{admitted}"
        );
    }
    for refused in [8u64, 9, 255] {
        assert!(
            !satisfies(&document_of(Value::Unsigned(refused)), &theory).holds(),
            "{refused}"
        );
    }
}

/// "Bits are counted the usual way, bit number `n` being set in `str`
/// meaning that `(str[n >> 3] & (1 << (n & 7))) != 0`."
#[test]
fn bits_on_a_byte_string_counts_across_the_bytes() {
    let theory = theory_with("bstr .bits flags", "flags = &(low: 0, high: 8)");
    assert!(satisfies(&document_of(bytes(&[0x01, 0x01])), &theory).holds());
    assert!(satisfies(&document_of(bytes(&[])), &theory).holds());
    assert!(!satisfies(&document_of(bytes(&[0x02])), &theory).holds());
}

#[test]
fn bits_takes_a_range_as_a_control_type() {
    assert!(admits("uint .bits (0..3)", Value::Unsigned(0b1111)));
    assert!(!admits("uint .bits (0..3)", Value::Unsigned(0b1_0000)));
}

// -- the comparisons ------------------------------------------------------

#[test]
fn the_orderings_compare_numerically() {
    assert!(admits("uint .gt 3", Value::Unsigned(4)));
    assert!(!admits("uint .gt 3", Value::Unsigned(3)));
    assert!(admits("uint .ge 3", Value::Unsigned(3)));
    assert!(admits("uint .lt 3", Value::Unsigned(2)));
    assert!(!admits("uint .lt 3", Value::Unsigned(3)));
    assert!(admits("uint .le 3", Value::Unsigned(3)));
    assert!(admits("number .ge 0", float(0.0)));
    assert!(!admits("number .ge 0", float(-0.5)));
    assert!(admits("int .gt -3", Value::integer(-2).expect("in range")));
}

#[test]
fn the_orderings_are_defined_only_for_numeric_types() {
    assert!(!admits(r#"tstr .gt "a""#, text("b")));
    assert!(!admits("any .lt 3", Value::Null));
}

/// §3.8.6: numbers compare numerically across the integer/floating-point
/// line, and everything else compares as the structure it is — "text
/// strings are equal ... if they are bytewise identical".
#[test]
fn equality_is_numeric_for_numbers_and_structural_otherwise() {
    assert!(admits("uint .eq 3", Value::Unsigned(3)));
    assert!(!admits("uint .eq 3", Value::Unsigned(4)));
    assert!(admits("number .eq 1", float(1.0)));
    assert!(admits(r#"tstr .eq "a""#, text("a")));
    assert!(!admits(r#"tstr .eq "a""#, text("b")));
    assert!(admits("bstr .eq h'01'", bytes(&[1])));
    assert!(admits(
        "[* uint] .eq [1, 2]",
        array(vec![Value::Unsigned(1), Value::Unsigned(2)])
    ));
    // "All other cases are not equal (e.g., comparing a text string with a
    // byte string)."
    assert!(!admits(r#"any .eq "a""#, bytes(b"a")));
}

#[test]
fn ne_is_the_negation_of_eq() {
    assert!(admits("uint .ne 3", Value::Unsigned(4)));
    assert!(!admits("uint .ne 3", Value::Unsigned(3)));
    assert!(admits(r#"tstr .ne "a""#, text("b")));
}

/// §3.8.6 makes `.default` "a variant of the `.ne` control", whose named
/// value "the implied .ne control is there to prevent ... from being sent
/// over the wire". So a present value equal to the default fails, and an
/// absent optional member stays absent — nothing materializes a default.
#[test]
fn default_is_the_ne_it_implies() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [1, 0, uint],\n",
        "  ? 2 => (number .gt 0) .default 1}\n",
    ));

    let absent = document("com.example", Version::new(1, 0, 0), Vec::new());
    assert!(satisfies(&absent, &theory).holds());
    assert!(satisfies(&document_of(Value::Unsigned(2)), &theory).holds());

    let defaulted = satisfies(&document_of(Value::Unsigned(1)), &theory);
    assert!(!defaulted.holds(), "the default value is not sent");

    // The target still has to match: zero fails `.gt 0` and not the default.
    assert!(!satisfies(&document_of(Value::Unsigned(0)), &theory).holds());
}

#[test]
fn an_absent_optional_member_stays_absent_under_a_default() {
    let theory = theory(concat!(
        "e = {0 => \"com.example\", 1 => [1, 0, uint],\n",
        "  ? 2 => uint .default 7, 3 => tstr}\n",
    ));
    let absent = document("com.example", Version::new(1, 0, 0), vec![(3, text("a"))]);
    assert!(satisfies(&absent, &theory).holds());
    // Nothing put a 7 at key 2: the document is unchanged by the judgment,
    // and a 7 arriving on the wire is refused.
    let sent = document(
        "com.example",
        Version::new(1, 0, 0),
        vec![(2, Value::Unsigned(7)), (3, text("a"))],
    );
    assert!(!satisfies(&sent, &theory).holds());
}

// -- names, groups, generics ----------------------------------------------

#[test]
fn a_rule_reference_stands_for_its_definition() {
    let theory = theory_with("inner", "inner = [* uint]");
    assert!(satisfies(&document_of(array(vec![Value::Unsigned(1)])), &theory).holds());
    assert!(!satisfies(&document_of(text("a")), &theory).holds());
}

#[test]
fn a_group_rule_splices_into_an_array() {
    let theory = theory_with("[header, uint]", "header = (tstr, tstr)");
    assert!(
        satisfies(
            &document_of(array(vec![text("a"), text("b"), Value::Unsigned(1)])),
            &theory
        )
        .holds()
    );
    assert!(
        !satisfies(
            &document_of(array(vec![text("a"), Value::Unsigned(1)])),
            &theory
        )
        .holds()
    );
}

/// §3.7: unwrapping "strip[s] the type defined for a name by one layer,
/// exposing the underlying group (for maps and arrays) or type (for tags)".
#[test]
fn unwrapping_strips_one_layer() {
    let theory = theory_with("[~basic, uint]", "basic = [tstr, tstr]");
    assert!(
        satisfies(
            &document_of(array(vec![text("a"), text("b"), Value::Unsigned(1)])),
            &theory
        )
        .holds()
    );

    // `time = #6.1(number)`, so `~time` is `number`.
    assert!(admits("~time", Value::Unsigned(1)));
    assert!(!admits(
        "~time",
        Value::Tag(Tag::new(1, Value::Unsigned(1)))
    ));
}

/// §2.2.2.2: `&` builds a choice out of a group's values.
#[test]
fn an_enumeration_admits_the_values_of_its_group() {
    let theory = theory_with("&basecolors", "basecolors = (black: 0, red: 1, green: 2)");
    for admitted in [0u64, 1, 2] {
        assert!(satisfies(&document_of(Value::Unsigned(admitted)), &theory).holds());
    }
    assert!(!satisfies(&document_of(Value::Unsigned(3)), &theory).holds());
    assert!(admits("&(a: 1, b: 2)", Value::Unsigned(2)));
}

/// §3.9: "it is not an error if there is no definition for a socket at all;
/// this then means there is no way to satisfy the rule (i.e., the choice is
/// empty)."
#[test]
fn an_unplugged_socket_admits_nothing() {
    assert!(!admits("$extension", Value::Null));
    assert!(admits("[* $$extension]", array(Vec::new())));
    assert!(!admits("[+ $$extension]", array(vec![Value::Null])));
}

#[test]
fn a_plugged_socket_admits_its_plugs() {
    let theory = theory_with("$message", "$message /= [1, tstr]\n$message /= [2, uint]");
    assert!(
        satisfies(
            &document_of(array(vec![Value::Unsigned(1), text("a")])),
            &theory
        )
        .holds()
    );
    assert!(
        satisfies(
            &document_of(array(vec![Value::Unsigned(2), Value::Unsigned(9)])),
            &theory
        )
        .holds()
    );
    assert!(!satisfies(&document_of(array(vec![Value::Unsigned(3)])), &theory).holds());
}

#[test]
fn a_generic_rule_is_instantiated_at_its_argument() {
    let theory = theory_with("[list<uint>, list<tstr>]", "list<t> = [* t]");
    assert!(
        satisfies(
            &document_of(array(vec![
                array(vec![Value::Unsigned(1)]),
                array(vec![text("a")]),
            ])),
            &theory
        )
        .holds()
    );
    assert!(
        !satisfies(
            &document_of(array(vec![array(vec![text("a")]), array(vec![text("a")]),])),
            &theory
        )
        .holds()
    );
}

/// A rule that reaches itself without consuming anything denotes no value,
/// and the judgment says so rather than recursing forever.
#[test]
fn a_rule_cycle_that_consumes_nothing_admits_nothing() {
    let theory = theory_with("a", "a = b\nb = a");
    assert!(!satisfies(&document_of(Value::Null), &theory).holds());
}

#[test]
fn a_rule_that_recurses_through_a_value_matches_to_the_depth_of_the_value() {
    let theory = theory_with("tree", "tree = uint / [* tree]");
    let nested = array(vec![
        Value::Unsigned(1),
        array(vec![Value::Unsigned(2), array(vec![Value::Unsigned(3)])]),
    ]);
    assert!(satisfies(&document_of(nested), &theory).holds());
    assert!(!satisfies(&document_of(array(vec![text("a")])), &theory).holds());
}
