//! The held state: what acquisition refuses, what refusal truncates, and
//! what an emitter targets and stamps.
//!
//! The subject is the acceptance definition's first half — holding is
//! downward-closed within a major, a reader's copy is complete below its
//! ceiling, and a minor absent below the ceiling was never assigned. The
//! tests below are written against that reading: a gap is not a hole in
//! the copy, and nothing here ever fills one.

use cogra_interchange::{
    AcquireError, Content, ContentKey, Coordinate, NamespaceLabel, Registry, Theory, Value,
};

const LABEL: &str = "com.example";

fn label() -> NamespaceLabel {
    NamespaceLabel::parse(LABEL).expect("two atoms over the alphabet")
}

fn coord(major: u64, minor: u64) -> Coordinate {
    Coordinate::new(label(), major, minor)
}

/// A theory of `com.example` at one coordinate, with `keys` appended to
/// the envelope entries verbatim.
fn theory(major: u64, minor: u64, keys: &str) -> Theory {
    let source = format!("e = {{0 => \"{LABEL}\", 1 => [{major}, {minor}, uint]{keys}}}");
    match Theory::parse(&source) {
        Ok(theory) => theory,
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

/// The chain every ordering test walks: one required key at minor 0, an
/// optional key added at each step.
fn chain_source(minor: u64) -> String {
    let mut keys = String::from(", 2 => tstr");
    for added in 1..=minor {
        keys.push_str(&format!(", ? {} => uint", added + 2));
    }
    keys
}

fn chain(minor: u64) -> Theory {
    theory(1, minor, &chain_source(minor))
}

fn holding(minors: impl IntoIterator<Item = u64>) -> Registry {
    let mut registry = Registry::new();
    for minor in minors {
        registry
            .acquire(coord(1, minor), chain(minor))
            .expect("an ascending chain of additive minors");
    }
    registry
}

fn content(keys: impl IntoIterator<Item = (u64, Value)>) -> Content {
    let mut content = Content::new();
    for (key, value) in keys {
        content.insert(
            ContentKey::new(key).expect("a key above the envelope"),
            value,
        );
    }
    content
}

fn text(s: &str) -> Value {
    Value::Text(s.to_owned().into())
}

#[test]
fn a_fresh_registry_holds_nothing_and_says_so() {
    let registry = Registry::new();

    assert_eq!(registry.ceiling(&label(), 1), None);
    assert!(!registry.holds_major(&label(), 1));
    assert!(!registry.holds(&coord(1, 0)));
    assert_eq!(registry.theory(&coord(1, 0)).map(Theory::source), None);
    assert_eq!(registry.target(&label()), None);
    assert_eq!(registry.minors(&label(), 1).count(), 0);
    assert_eq!(registry.stamp(&label(), 1, &Content::new()), None);
}

/// A reader that comes to a major late holds what was assigned, and the
/// registry cannot know which minors below its first were ever assigned — that
/// is the owner's ledger, not this copy.
#[test]
fn the_first_minor_of_a_major_may_be_any_minor() {
    let mut registry = Registry::new();
    registry
        .acquire(coord(1, 7), theory(1, 7, ", 2 => tstr"))
        .expect("a first acquisition faces no ceiling");

    assert_eq!(registry.ceiling(&label(), 1), Some(7));
    assert!(registry.holds(&coord(1, 7)));
    assert!(!registry.holds(&coord(1, 6)));
}

#[test]
fn acquisition_ascends_and_the_ceiling_rises() {
    let registry = holding(0..4);

    assert_eq!(registry.ceiling(&label(), 1), Some(3));
    assert_eq!(
        registry.minors(&label(), 1).collect::<Vec<u64>>(),
        vec![0, 1, 2, 3]
    );
}

/// A held minor is answered by permanence rather than by order: the question
/// is whether the object changed, not where the ceiling is. A minor never
/// held is refused too, because a gap below an assigned minor is never filled.
#[test]
fn a_minor_at_or_below_the_ceiling_is_out_of_order() {
    let mut registry = holding(0..3);

    let err = registry
        .acquire(coord(1, 1), theory(1, 1, ", 2 => tstr"))
        .expect_err("minor 1 is held under another theory");
    assert!(matches!(err, AcquireError::Immutable));

    let mut gapped = Registry::new();
    gapped
        .acquire(coord(1, 5), theory(1, 5, ", 2 => tstr"))
        .expect("a first acquisition");
    let err = gapped
        .acquire(coord(1, 2), theory(1, 2, ", 2 => tstr"))
        .expect_err("2 lies below the ceiling 5");
    assert!(matches!(
        err,
        AcquireError::OutOfOrder {
            minor: 2,
            ceiling: 5
        }
    ));
}

#[test]
fn a_gap_below_the_ceiling_is_knowledge_and_stays_one() {
    let mut registry = Registry::new();
    registry
        .acquire(coord(1, 0), chain(0))
        .expect("the first minor");
    registry
        .acquire(coord(1, 3), theory(1, 3, ", 2 => tstr"))
        .expect("minors 1 and 2 were never assigned");

    assert_eq!(
        registry.minors(&label(), 1).collect::<Vec<u64>>(),
        vec![0, 3]
    );
    assert!(!registry.holds(&coord(1, 1)));
    assert_eq!(registry.ceiling(&label(), 1), Some(3));
    assert!(
        registry
            .acquire(coord(1, 1), theory(1, 1, ", 2 => tstr"))
            .is_err(),
        "the gap is permanent"
    );
}

/// Minor 4 is the ceiling, so it is what minor 6 is compared against.
#[test]
fn inclusion_is_checked_against_the_greatest_held_below_the_gap() {
    let mut registry = Registry::new();
    registry
        .acquire(coord(1, 0), chain(0))
        .expect("the first minor");
    registry
        .acquire(coord(1, 4), theory(1, 4, ", 2 => tstr, ? 9 => uint"))
        .expect("additive over minor 0");

    let err = registry
        .acquire(coord(1, 6), theory(1, 6, ", 2 => tstr"))
        .expect_err("key 9 was dropped");
    match err {
        AcquireError::InclusionViolated { against, breaches } => {
            assert_eq!(against, 4);
            assert_eq!(breaches.len(), 1);
        }
        other => panic!("expected an inclusion breach, got {other:?}"),
    }
}

#[test]
fn a_new_key_that_is_required_is_no_additive_minor() {
    let mut registry = holding(0..1);

    let err = registry
        .acquire(coord(1, 1), theory(1, 1, ", 2 => tstr, 3 => uint"))
        .expect_err("a key new at a later minor must be optional");
    assert!(matches!(
        err,
        AcquireError::InclusionViolated { against: 0, .. }
    ));
    assert_eq!(registry.ceiling(&label(), 1), Some(0));
}

#[test]
fn re_acquiring_the_held_theory_changes_nothing() {
    let mut registry = holding(0..2);

    registry
        .acquire(coord(1, 1), chain(1))
        .expect("the same theory object at the same coordinate");
    assert_eq!(
        registry.minors(&label(), 1).collect::<Vec<u64>>(),
        vec![0, 1]
    );
}

/// And the held object is the one that stays.
#[test]
fn re_acquiring_a_changed_theory_is_refused() {
    let mut registry = holding(0..2);

    let err = registry
        .acquire(coord(1, 1), theory(1, 1, ", 2 => tstr, ? 3 => tstr"))
        .expect_err("key 3 is typed differently from the held object");
    assert!(matches!(err, AcquireError::Immutable));

    let held = registry
        .theory(&coord(1, 1))
        .expect("the coordinate is still held");
    assert!(held.source().contains("? 3 => uint"));
}

#[test]
fn exposition_does_not_make_a_second_theory_object() {
    let mut registry = holding(0..1);

    let respelled = Theory::parse(&format!(
        "; the same theory, laid out differently\ne = {{\n  0 => \"{LABEL}\",\n  1 => [1, 0, uint],\n  2 => tstr,\n}}"
    ))
    .expect("an assignable theory");
    registry
        .acquire(coord(1, 0), respelled)
        .expect("comments and layout are exposition, which patches may move");
}

#[test]
fn pins_disagreeing_with_the_coordinate_are_refused() {
    let mut registry = Registry::new();

    let err = registry
        .acquire(coord(1, 0), theory(1, 2, ", 2 => tstr"))
        .expect_err("the theory pins minor 2");
    match err {
        AcquireError::PinMismatch { found } => assert_eq!(found, format!("{LABEL} 1.2")),
        other => panic!("expected a pin mismatch, got {other:?}"),
    }

    let other_label = NamespaceLabel::parse("com.other").expect("a label");
    let err = registry
        .acquire(
            Coordinate::new(other_label, 1, 0),
            theory(1, 0, ", 2 => tstr"),
        )
        .expect_err("the theory pins another label");
    assert!(matches!(err, AcquireError::PinMismatch { .. }));
    assert!(!registry.holds_major(&label(), 1));
}

#[test]
fn a_theory_reaching_a_restrained_value_implicitly_is_refused() {
    let mut registry = Registry::new();

    let err = registry
        .acquire(coord(1, 0), theory(1, 0, ", 2 => any"))
        .expect_err("`any` reaches a float without naming one");
    match err {
        AcquireError::ImplicitReach { reaches } => {
            assert!(!reaches.is_empty());
            assert!(reaches.iter().all(|reach| reach.key().get() == 2));
        }
        other => panic!("expected an implicit reach, got {other:?}"),
    }
}

#[test]
fn a_lenient_registry_admits_the_reach_and_keeps_the_report() {
    let mut registry = Registry::lenient();
    registry
        .acquire(coord(1, 0), theory(1, 0, ", 2 => any"))
        .expect("a reader consuming a registry it does not own");

    let held = registry
        .theory(&coord(1, 0))
        .expect("the coordinate is held");
    assert!(held.restraint().implicit_reaches().next().is_some());
}

#[test]
fn a_lenient_registry_still_refuses_every_other_way() {
    let mut registry = Registry::lenient();
    registry
        .acquire(coord(1, 0), chain(0))
        .expect("the first minor");

    assert!(matches!(
        registry
            .acquire(coord(1, 1), theory(1, 1, ", 2 => uint"))
            .expect_err("the type at key 2 changed"),
        AcquireError::InclusionViolated { .. }
    ));
    assert!(matches!(
        registry
            .acquire(coord(1, 5), theory(1, 4, ", 2 => tstr"))
            .expect_err("the pins name another minor"),
        AcquireError::PinMismatch { .. }
    ));
}

#[test]
fn refusal_truncates_from_the_minor_upward_and_the_ceiling_falls() {
    let mut registry = holding(0..4);

    registry.refuse(&label(), 1, 2);

    assert_eq!(registry.ceiling(&label(), 1), Some(1));
    assert_eq!(
        registry.minors(&label(), 1).collect::<Vec<u64>>(),
        vec![0, 1]
    );
    assert!(!registry.holds(&coord(1, 2)));
    assert!(registry.holds_major(&label(), 1));
}

/// Refusing a major nothing is held of does nothing.
#[test]
fn refusing_from_the_first_minor_leaves_the_major_unheld() {
    let mut registry = holding(0..3);

    registry.refuse(&label(), 1, 0);

    assert!(!registry.holds_major(&label(), 1));
    assert_eq!(registry.ceiling(&label(), 1), None);
    assert_eq!(registry.target(&label()), None);
    registry.refuse(&label(), 1, 0);
    registry.refuse(&label(), 9, 3);
    assert!(!registry.holds_major(&label(), 9));
}

#[test]
fn target_is_the_greatest_held_coordinate_of_the_label() {
    let mut registry = holding(0..3);
    assert_eq!(registry.target(&label()), Some(coord(1, 2)));

    registry
        .acquire(coord(2, 0), theory(2, 0, ", 2 => uint"))
        .expect("a major of its own");
    assert_eq!(registry.target(&label()), Some(coord(2, 0)));

    let unheld = NamespaceLabel::parse("com.other").expect("a label");
    assert_eq!(registry.target(&unheld), None);
}

/// Content needing nothing the later minors added stamps the least minor and
/// not the target, while a key first named at minor 2 pulls the stamp up to
/// it.
#[test]
fn stamp_is_the_least_held_minor_the_content_satisfies() {
    let registry = holding(0..4);

    let plain = content([(2, text("hello"))]);
    assert_eq!(registry.stamp(&label(), 1, &plain), Some(0));
    assert_eq!(registry.target(&label()), Some(coord(1, 3)));

    let later = content([(2, text("hello")), (4, Value::Unsigned(9))]);
    assert_eq!(registry.stamp(&label(), 1, &later), Some(2));
}

/// Key 2 is required and typed `tstr` at every held minor, so content without
/// it, content mistyping it, and content of an unheld major all stamp nothing.
#[test]
fn content_no_held_theory_admits_has_no_stamp() {
    let registry = holding(0..3);

    assert_eq!(registry.stamp(&label(), 1, &Content::new()), None);
    assert_eq!(
        registry.stamp(&label(), 1, &content([(2, Value::Unsigned(1))])),
        None
    );
    assert_eq!(
        registry.stamp(&label(), 9, &content([(2, text("x"))])),
        None
    );
}

/// The L₂ point: the content class is asked, never the whole document, because
/// a document's key 1 pins the very minor being sought. Content an emitter
/// targeting minor 3 assembled still stamps 0 when nothing in it needs a later
/// vocabulary.
#[test]
fn stamping_reads_the_content_and_not_the_stamp_it_would_carry() {
    let registry = holding(0..4);
    let plain = content([(2, text("hello"))]);

    assert_eq!(registry.stamp(&label(), 1, &plain), Some(0));
    for minor in registry.minors(&label(), 1) {
        let held = registry
            .theory(&coord(1, minor))
            .expect("every listed minor is held");
        assert_eq!(held.coordinate().1, minor);
    }
}

/// The third pair widens the shared key, which is no minor whatever it claims.
/// What was taken before the refusal stays held; nothing after it was.
#[test]
fn acquire_all_takes_the_sequence_and_stops_at_the_first_refusal() {
    let mut registry = Registry::new();
    let published = vec![
        (coord(1, 0), chain(0)),
        (coord(1, 1), chain(1)),
        (coord(1, 2), theory(1, 2, ", 2 => tstr / uint, ? 3 => uint")),
        (coord(1, 3), chain(3)),
    ];

    let err = registry
        .acquire_all(published)
        .expect_err("the third pair breaks the additive regime");
    assert!(matches!(
        err,
        AcquireError::InclusionViolated { against: 1, .. }
    ));

    assert_eq!(
        registry.minors(&label(), 1).collect::<Vec<u64>>(),
        vec![0, 1]
    );
}

#[test]
fn acquire_all_over_an_ascending_chain_holds_all_of_it() {
    let mut registry = Registry::new();
    registry
        .acquire_all((0..5).map(|minor| (coord(1, minor), chain(minor))))
        .expect("an ascending chain of additive minors");

    assert_eq!(registry.ceiling(&label(), 1), Some(4));
    assert_eq!(registry.minors(&label(), 1).count(), 5);
}

#[test]
fn majors_and_labels_do_not_share_a_line() {
    let mut registry = holding(0..2);
    registry
        .acquire(coord(2, 0), theory(2, 0, ", 2 => uint"))
        .expect("a major of its own faces no ceiling and no inclusion check");

    let other = NamespaceLabel::parse("com.other").expect("a label");
    let source = "e = {0 => \"com.other\", 1 => [1, 0, uint], 2 => bstr}";
    registry
        .acquire(
            Coordinate::new(other.clone(), 1, 0),
            Theory::parse(source).expect("an assignable theory"),
        )
        .expect("another label is another line");

    assert_eq!(registry.ceiling(&label(), 1), Some(1));
    assert_eq!(registry.ceiling(&label(), 2), Some(0));
    assert_eq!(registry.ceiling(&other, 1), Some(0));
    assert_eq!(registry.target(&other), Some(Coordinate::new(other, 1, 0)));
}
