//! Dispatch and the verdict: every arm of the acceptance definition, and
//! the two facts about the prefix path.
//!
//! For a document stamped `(ℓ, [M, m, p])` at a reader with ceiling `m₁`
//! of `(ℓ, M)`: a held `m` is judged strictly; an `m` at or below `m₁`
//! that was never assigned is a checkably false claim and the document is
//! rejected whole; an `m` above `m₁` is judged tolerantly against the
//! companion of the floor; and a major nothing is held of rejects whole.
//! The patch position occurs in none of these conditions, which one test
//! below is entirely about.

use cogra_interchange::{
    Content, ContentKey, Coordinate, Document, Envelope, EnvelopeError, Instrument,
    MAX_ENVELOPE_PREFIX, NamespaceLabel, Registry, Rejection, RejectionCause, Theory, Under, Value,
    Verdict, Version, accept, dispatch, dispatch_prefix,
};

const LABEL: &str = "com.example";

fn label() -> NamespaceLabel {
    NamespaceLabel::parse(LABEL).expect("two atoms over the alphabet")
}

fn theory(minor: u64, keys: &str) -> Theory {
    let source = format!("e = {{0 => \"{LABEL}\", 1 => [1, {minor}, uint]{keys}}}");
    match Theory::parse(&source) {
        Ok(theory) => theory,
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

/// Minor 0 requires a text at key 2; each later minor adds one optional
/// key, as the additive regime requires.
fn chain(minor: u64) -> Theory {
    let mut keys = String::from(", 2 => tstr");
    for added in 1..=minor {
        keys.push_str(&format!(", ? {} => uint", added + 2));
    }
    theory(minor, &keys)
}

fn holding(minors: impl IntoIterator<Item = u64>) -> Registry {
    let mut registry = Registry::new();
    for minor in minors {
        registry
            .acquire(Coordinate::new(label(), 1, minor), chain(minor))
            .expect("an ascending chain of additive minors");
    }
    registry
}

fn document(version: Version, keys: impl IntoIterator<Item = (u64, Value)>) -> Document {
    let mut content = Content::new();
    for (key, value) in keys {
        content.insert(
            ContentKey::new(key).expect("a key above the envelope"),
            value,
        );
    }
    Document::new(Envelope::new(label(), version), content)
}

fn text(s: &str) -> Value {
    Value::Text(s.to_owned().into())
}

#[test]
fn a_held_stamp_is_judged_strictly() {
    let registry = holding(0..3);
    let d = document(Version::new(1, 1, 0), [(2, text("hello"))]);

    assert_eq!(
        accept(&registry, &d),
        Verdict::AcceptedStrictly { minor: 1 }
    );
    assert!(accept(&registry, &d).is_accepted());
}

/// Key 2 is required and typed `tstr` at every held minor, so an integer
/// there fails the theory the stamp names.
#[test]
fn a_held_stamp_the_document_fails_is_rejected_under_that_theory() {
    let registry = holding(0..3);
    let d = document(Version::new(1, 2, 0), [(2, Value::Unsigned(7))]);

    match accept(&registry, &d) {
        Verdict::Rejected(Rejection::Unsatisfied { under, mismatches }) => {
            assert_eq!(under, Under::Strict { minor: 2 });
            assert!(!mismatches.is_empty());
            assert_eq!(mismatches[0].key().map(|key| key.get()), Some(2));
        }
        other => panic!("expected a strict rejection, got {other:?}"),
    }
}

/// Stamped ahead of the reader, and carrying a key no held theory names: the
/// companion's wildcard admits it.
#[test]
fn a_stamp_above_the_ceiling_is_judged_tolerantly() {
    let registry = holding(0..2);
    let d = document(
        Version::new(1, 9, 0),
        [(2, text("hello")), (40, Value::Bool(true))],
    );

    assert_eq!(
        accept(&registry, &d),
        Verdict::AcceptedTolerantly { floor: 1 }
    );
}

/// Tolerance is not indulgence: a key the floor requires still binds.
#[test]
fn a_stamp_above_the_ceiling_still_answers_to_the_floor() {
    let registry = holding(0..2);
    let d = document(Version::new(1, 9, 0), [(2, Value::Unsigned(7))]);

    match accept(&registry, &d) {
        Verdict::Rejected(Rejection::Unsatisfied { under, mismatches }) => {
            assert_eq!(under, Under::Tolerant { floor: 1 });
            assert!(!mismatches.is_empty());
        }
        other => panic!("expected a tolerant rejection, got {other:?}"),
    }
}

/// The content would satisfy the theory at minor 0 — and the claim the stamp
/// makes is still checkably false, so the document is rejected whole.
#[test]
fn a_stamp_below_the_ceiling_that_was_never_assigned_is_rejected_whole() {
    let mut registry = holding(0..1);
    registry
        .acquire(Coordinate::new(label(), 1, 3), theory(3, ", 2 => tstr"))
        .expect("minors 1 and 2 were never assigned");

    let d = document(Version::new(1, 2, 0), [(2, text("hello"))]);
    assert_eq!(
        accept(&registry, &d),
        Verdict::Rejected(Rejection::UnassignedStamp {
            minor: 2,
            ceiling: 3
        })
    );
}

/// And so is every document of a label this reader has never met.
#[test]
fn a_major_nothing_is_held_of_is_rejected_whole() {
    let registry = holding(0..2);
    let d = document(Version::new(7, 0, 0), [(2, text("hello"))]);

    assert_eq!(
        accept(&registry, &d),
        Verdict::Rejected(Rejection::UnheldMajor { major: 7 })
    );

    let stranger = Document::new(
        Envelope::new(
            NamespaceLabel::parse("com.other").expect("a label"),
            Version::new(1, 0, 0),
        ),
        Content::new(),
    );
    assert_eq!(
        accept(&registry, &stranger),
        Verdict::Rejected(Rejection::UnheldMajor { major: 1 })
    );
}

#[test]
fn an_empty_registry_rejects_everything_whole() {
    let registry = Registry::new();
    let d = document(Version::new(1, 0, 0), [(2, text("hello"))]);

    assert_eq!(
        accept(&registry, &d),
        Verdict::Rejected(Rejection::UnheldMajor { major: 1 })
    );
    assert!(!accept(&registry, &d).is_accepted());
}

#[test]
fn the_patch_position_does_not_occur_in_the_condition() {
    let registry = holding(0..2);
    let verdicts: Vec<Verdict> = [0, 1, u64::MAX]
        .into_iter()
        .map(|patch| {
            accept(
                &registry,
                &document(Version::new(1, 1, patch), [(2, text("x"))]),
            )
        })
        .collect();

    assert!(
        verdicts
            .iter()
            .all(|verdict| *verdict == Verdict::AcceptedStrictly { minor: 1 }),
        "the patch moved a verdict: {verdicts:?}"
    );
}

#[test]
fn dispatch_names_the_instrument_for_each_disposition() {
    let mut registry = holding(0..2);
    registry
        .acquire(
            Coordinate::new(label(), 1, 5),
            theory(5, ", 2 => tstr, ? 3 => uint"),
        )
        .expect("minors 2 to 4 were never assigned");

    let strict = dispatch(&registry, &Envelope::new(label(), Version::new(1, 1, 0)));
    match strict {
        Instrument::Strict { minor, theory } => {
            assert_eq!(minor, 1);
            assert_eq!(theory.coordinate(), (1, 1));
        }
        other => panic!("expected the strict instrument, got {other:?}"),
    }

    let tolerant = dispatch(&registry, &Envelope::new(label(), Version::new(1, 40, 0)));
    match tolerant {
        Instrument::Tolerant { floor, companion } => {
            assert_eq!(floor, 5);
            assert_eq!(companion.floor(), (1, 5));
        }
        other => panic!("expected the tolerant instrument, got {other:?}"),
    }

    assert!(matches!(
        dispatch(&registry, &Envelope::new(label(), Version::new(1, 3, 0))),
        Instrument::Refused(RejectionCause::UnassignedStamp { ceiling: 5 })
    ));
    assert!(matches!(
        dispatch(&registry, &Envelope::new(label(), Version::new(2, 0, 0))),
        Instrument::Refused(RejectionCause::UnheldMajor)
    ));
}

#[test]
fn the_companion_follows_the_ceiling_up_and_down() {
    let mut registry = holding(0..3);

    match dispatch(&registry, &Envelope::new(label(), Version::new(1, 9, 0))) {
        Instrument::Tolerant { floor, companion } => {
            assert_eq!(floor, 2);
            assert_eq!(companion.floor(), (1, 2));
        }
        other => panic!("expected the tolerant instrument, got {other:?}"),
    }

    registry.refuse(&label(), 1, 1);
    match dispatch(&registry, &Envelope::new(label(), Version::new(1, 9, 0))) {
        Instrument::Tolerant { floor, companion } => {
            assert_eq!(floor, 0);
            assert_eq!(
                companion.floor(),
                (1, 0),
                "the memo outlived the ceiling that made it"
            );
        }
        other => panic!("expected the tolerant instrument, got {other:?}"),
    }
}

#[test]
fn refusal_turns_a_strict_verdict_tolerant_and_then_unheld() {
    let registry_before = holding(0..3);
    let d = document(Version::new(1, 2, 0), [(2, text("hello"))]);
    assert_eq!(
        accept(&registry_before, &d),
        Verdict::AcceptedStrictly { minor: 2 }
    );

    let mut registry = holding(0..3);
    registry.refuse(&label(), 1, 2);
    assert_eq!(
        accept(&registry, &d),
        Verdict::AcceptedTolerantly { floor: 1 }
    );

    registry.refuse(&label(), 1, 0);
    assert_eq!(
        accept(&registry, &d),
        Verdict::Rejected(Rejection::UnheldMajor { major: 1 })
    );
}

#[test]
fn the_prefix_path_agrees_with_the_full_envelope() {
    let registry = holding(0..2);
    let d = document(Version::new(1, 9, 0), [(2, text("hello"))]);
    let bytes = d.to_canonical_bytes();
    let head = &bytes[..bytes.len().min(MAX_ENVELOPE_PREFIX)];

    let early = dispatch_prefix(&registry, head).expect("the envelope lies inside the bound");
    let full = dispatch(&registry, d.envelope());
    assert_eq!(format!("{early:?}"), format!("{full:?}"));
}

/// A well-formed envelope with a tail outside the data language: the routing
/// answers, and the bytes are still no document at all.
#[test]
fn the_prefix_path_certifies_no_membership() {
    let registry = holding(0..2);
    let mut bytes = document(Version::new(1, 1, 0), [(2, text("hello"))]).to_canonical_bytes();
    bytes.push(0x00);

    assert!(matches!(
        dispatch_prefix(&registry, &bytes).expect("the envelope reads"),
        Instrument::Strict { minor: 1, .. }
    ));
    assert!(matches!(
        Document::from_canonical_bytes(&bytes).expect_err("a trailing byte"),
        EnvelopeError::NotCanonical(_)
    ));
}

#[test]
fn a_prefix_too_short_to_carry_an_envelope_asks_for_more_bytes() {
    let registry = holding(0..2);
    let bytes = document(Version::new(1, 1, 0), [(2, text("hello"))]).to_canonical_bytes();

    let err = dispatch_prefix(&registry, &bytes[..3]).expect_err("three bytes carry no envelope");
    assert!(matches!(err, EnvelopeError::Truncated { given: 3, .. }));
}
