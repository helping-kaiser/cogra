//! The metatheorem obligations of the design's property table, one per
//! theorem, named after it so that a failure names what it broke.
//!
//! Five are about the data language and the envelope: unique names,
//! canonical order, iterative teardown, one spelling, and the bounded
//! prefix. Three are stated over a chain of minors: conservativity,
//! forward compatibility, and the composition of inclusion the registry's
//! one-comparison rule rests on. The last are stated over a chain and a
//! growing reader: acceptance monotonicity, the prefix path's agreement
//! with the full envelope, and the stamping search against a linear scan.
//!
//! The registry properties quantify over *states*, not just over inputs:
//! each generated chain is acquired one minor at a time, and the assertion
//! is about how a verdict moves as the reader grows.

use cogra_interchange::{
    Array, Bytes, Content, ContentKey, Coordinate, Document, Envelope, Float, FloatWidth,
    Instrument, LabelError, MAX_ENVELOPE_PREFIX, Map, NamespaceLabel, Negative, Registry,
    Rejection, Simple, Tag, Text, Theory, Value, Verdict, Version, accept, check_inclusion,
    dispatch, dispatch_prefix, satisfies, satisfies_global, satisfies_open,
};
use proptest::prelude::*;

/// A generator over the whole value model.
///
/// Recursion is bounded here because a generator has to terminate, not
/// because the data language bounds it — the depth the language declines
/// to bound is the subject of its own test below.
fn any_value() -> impl Strategy<Value = Value> {
    let leaf = prop_oneof![
        any::<u64>().prop_map(Value::Unsigned),
        any::<u64>().prop_map(|n| Value::Negative(Negative::from_argument(n))),
        prop::collection::vec(any::<u8>(), 0..6).prop_map(|b| Value::Bytes(Bytes::from(b))),
        ".{0,6}".prop_map(|s| Value::Text(Text::from(s))),
        any::<bool>().prop_map(Value::Bool),
        Just(Value::Null),
        any::<u8>().prop_filter_map("a constructible simple value", |v| Simple::new(v)
            .ok()
            .map(Value::Simple)),
        any::<f64>().prop_filter_map("a canonical float", |v| Float::from_f64(v)
            .ok()
            .map(Value::Float)),
    ];
    leaf.prop_recursive(4, 48, 4, |inner| {
        prop_oneof![
            prop::collection::vec(inner.clone(), 0..4)
                .prop_map(|items| Value::Array(Array::new(items))),
            prop::collection::vec((inner.clone(), inner.clone()), 0..4)
                .prop_map(|pairs| Value::Map(map_of(pairs))),
            (any::<u64>(), inner).prop_map(|(number, item)| Value::Tag(Tag::new(number, item))),
        ]
    })
}

/// Pairs that are sometimes equal: independent values almost never are,
/// and half of an "exactly when" would go unexercised.
fn any_value_pair() -> impl Strategy<Value = (Value, Value)> {
    prop_oneof![
        3 => (any_value(), any_value()),
        1 => any_value().prop_map(|v| (v.clone(), v)),
    ]
}

/// Σ of the label grammar: the thirty-six characters of the alphabet.
const ALNUM: &str = "abcdefghijklmnopqrstuvwxyz0123456789";

fn alnum() -> impl Strategy<Value = char> {
    prop::sample::select(ALNUM.chars().collect::<Vec<char>>())
}

fn alnum_or_hyphen() -> impl Strategy<Value = char> {
    prop::sample::select(format!("{ALNUM}-").chars().collect::<Vec<char>>())
}

/// `atom = alnum [ *( alnum / "-" ) alnum ]`, read off the ABNF a second
/// time — the generator and the scanner are two independent readings, and
/// the property is what makes them agree.
fn any_atom() -> impl Strategy<Value = String> {
    (
        alnum(),
        prop::option::of((prop::collection::vec(alnum_or_hyphen(), 0..5), alnum())),
    )
        .prop_map(|(first, rest)| {
            let mut atom = String::new();
            atom.push(first);
            if let Some((middle, last)) = rest {
                atom.extend(middle);
                atom.push(last);
            }
            atom
        })
}

/// `namespace-label = atom 1*( "." atom )`, kept well inside the 255-byte
/// bound, which has its own vectors at both edges.
fn any_label() -> impl Strategy<Value = String> {
    prop::collection::vec(any_atom(), 2..5).prop_map(|atoms| atoms.join("."))
}

fn any_version() -> impl Strategy<Value = Version> {
    (any::<u64>(), any::<u64>(), any::<u64>())
        .prop_map(|(major, minor, patch)| Version::new(major, minor, patch))
}

fn any_document() -> impl Strategy<Value = Document> {
    (
        any_label(),
        any_version(),
        prop::collection::vec((2u64..=u64::MAX, any_value()), 0..4),
    )
        .prop_map(|(label, version, entries)| {
            let label = NamespaceLabel::parse(&label).expect("generated from the ABNF");
            let mut content = Content::new();
            for (key, value) in entries {
                content.insert(ContentKey::new(key).expect("above the envelope"), value);
            }
            Document::new(Envelope::new(label, version), content)
        })
}

/// One mutation per way out of the language, each provably outside it.
#[derive(Debug, Clone, Copy)]
enum Mutation {
    Uppercase,
    Underscore,
    NonAscii,
    LeadingDot,
    TrailingDot,
    DoubledDot,
    HyphenAtEdge,
    OneAtom,
    TooLong,
}

fn any_mutation() -> impl Strategy<Value = Mutation> {
    prop::sample::select(vec![
        Mutation::Uppercase,
        Mutation::Underscore,
        Mutation::NonAscii,
        Mutation::LeadingDot,
        Mutation::TrailingDot,
        Mutation::DoubledDot,
        Mutation::HyphenAtEdge,
        Mutation::OneAtom,
        Mutation::TooLong,
    ])
}

/// Apply a mutation, `index` selecting where among the candidate positions
/// it lands.
fn mutate(label: &str, mutation: Mutation, index: usize) -> String {
    let characters: Vec<char> = label.chars().collect();
    let at = index % characters.len();
    let replace = |replacement: char| {
        let mut mutated = characters.clone();
        mutated[at] = replacement;
        mutated.into_iter().collect::<String>()
    };

    match mutation {
        Mutation::Uppercase => replace('A'),
        Mutation::Underscore => replace('_'),
        Mutation::NonAscii => replace('ä'),
        Mutation::LeadingDot => format!(".{label}"),
        Mutation::TrailingDot => format!("{label}."),
        Mutation::DoubledDot => label.replacen('.', "..", 1),
        Mutation::HyphenAtEdge => label.replacen('.', ".-", 1),
        Mutation::OneAtom => label.replace('.', ""),
        Mutation::TooLong => format!("{label}{}", "a".repeat(256)),
    }
}

// -- chains of minors -----------------------------------------------------

/// The types a generated content key is drawn from. Small on purpose: what
/// the two chain properties measure is how keys move between minors, not
/// how many types the parser reads.
const CHAIN_TYPES: [&str; 4] = ["uint", "tstr", "[* uint]", "{a: 1}"];

/// One content key of a generated theory.
type Slot = (u64, bool, &'static str);

/// One move from a minor to its successor.
///
/// Additive moves are weighted up, because a chain that breaks at its first
/// step exercises the implication's premise and nothing beyond it — but
/// every breaking move is here too, so that the properties are quantified
/// over chains that really do break.
#[derive(Debug, Clone, Copy)]
enum Move {
    AddOptional,
    AddRequired,
    Drop(usize),
    Retype(usize),
    Flip(usize),
}

fn any_move() -> impl Strategy<Value = Move> {
    prop_oneof![
        4 => Just(Move::AddOptional),
        1 => Just(Move::AddRequired),
        1 => (0usize..8).prop_map(Move::Drop),
        1 => (0usize..8).prop_map(Move::Retype),
        1 => (0usize..8).prop_map(Move::Flip),
    ]
}

/// A chain of assigned theories of one label and major, at minors 0, 1, 2,
/// … — built by applying the generated moves one after another.
fn any_minor_chain() -> impl Strategy<Value = Vec<Theory>> {
    prop::collection::vec(any_move(), 1..4).prop_map(|moves| {
        let mut slots: Vec<Slot> = vec![(2, true, "uint"), (3, false, "tstr")];
        let mut next_key = 4;
        let mut chain = vec![theory_at(0, &slots)];

        for (step, movement) in moves.iter().enumerate() {
            apply(&mut slots, *movement, &mut next_key);
            chain.push(theory_at(step as u64 + 1, &slots));
        }
        chain
    })
}

fn apply(slots: &mut Vec<Slot>, movement: Move, next_key: &mut u64) {
    let count = slots.len().max(1);
    let at = |index: usize| index % count;
    match movement {
        Move::AddOptional => {
            slots.push((*next_key, false, CHAIN_TYPES[0]));
            *next_key += 1;
        }
        Move::AddRequired => {
            slots.push((*next_key, true, CHAIN_TYPES[0]));
            *next_key += 1;
        }
        Move::Drop(index) => {
            if !slots.is_empty() {
                slots.remove(at(index));
            }
        }
        Move::Retype(index) => {
            if let Some(slot) = slots.get_mut(at(index)) {
                let next = CHAIN_TYPES
                    .iter()
                    .position(|ty| *ty == slot.2)
                    .map_or(0, |current| (current + 1) % CHAIN_TYPES.len());
                slot.2 = CHAIN_TYPES[next];
            }
        }
        Move::Flip(index) => {
            if let Some(slot) = slots.get_mut(at(index)) {
                slot.1 = !slot.1;
            }
        }
    }
}

fn theory_at(minor: u64, slots: &[Slot]) -> Theory {
    let mut source = format!("e = {{0 => \"com.example\", 1 => [1, {minor}, uint]");
    for (key, required, ty) in slots {
        source.push_str(", ");
        if !required {
            source.push_str("? ");
        }
        source.push_str(&format!("{key} => {ty}"));
    }
    source.push('}');
    Theory::parse(&source).expect("a generated theory of the assignable fragment")
}

/// Whether every consecutive pair of the chain stands in inclusion — the
/// premise both chain properties are stated under, and the one the registry
/// actually checks.
fn consecutive_inclusion(chain: &[Theory]) -> bool {
    chain.windows(2).all(|pair| {
        check_inclusion(&pair[0], &pair[1])
            .expect("one label, one major, ascending minors")
            .holds()
    })
}

/// A value of the type a generated slot carries.
///
/// One value per member of `CHAIN_TYPES`, varied by the seed so that the
/// property is quantified over documents and not over one fixture. A type
/// outside that set means the chain generator grew a case this did not, and
/// the panic says so rather than silently generating a document that
/// conforms to nothing.
fn value_of(ty: &str, seed: u8) -> Value {
    match ty {
        "uint" => Value::Unsigned(u64::from(seed)),
        "tstr" => Value::Text(Text::from(format!("v{seed}"))),
        "[* uint]" => Value::Array(Array::new(
            (0..u64::from(seed % 4))
                .map(Value::Unsigned)
                .collect::<Vec<Value>>(),
        )),
        "{a: 1}" => Value::Map(
            Map::new([(Value::Text(Text::from("a".to_owned())), Value::Unsigned(1))])
                .expect("one key"),
        ),
        other => {
            panic!("the chain generator draws a type this generator has no value for: {other}")
        }
    }
}

/// A document that conforms to a generated theory: every required key, and
/// the optional ones the flags select.
fn conforming(theory: &Theory, seeds: &[u8], carried: &[bool]) -> Document {
    let mut content = Content::new();
    for (index, slot) in theory.slots().enumerate() {
        let carry = slot.required() || carried[index % carried.len()];
        if !carry {
            continue;
        }
        content.insert(
            slot.key(),
            value_of(slot.type_source(), seeds[index % seeds.len()]),
        );
    }
    let (major, minor) = theory.coordinate();
    Document::new(
        Envelope::new(theory.label().clone(), Version::new(major, minor, 0)),
        content,
    )
}

// -- growing readers ------------------------------------------------------

/// The label every generated theory pins, and every generated chain
/// document carries.
fn chain_label() -> NamespaceLabel {
    NamespaceLabel::parse("com.example").expect("the label the chain generator writes")
}

/// A reader holding the first `upto` minors of the chain, minus the one at
/// `skipped` — which stands for a minor the owner never assigned, so that
/// its absence below the ceiling is knowledge.
///
/// A refusal here is a failure of the crate and not of the generator: the
/// chain stands in consecutive inclusion by the premise, and inclusion
/// composes, so every acquisition below is one the registry must take.
fn reader(chain: &[Theory], upto: usize, skipped: Option<usize>) -> Registry {
    let mut registry = Registry::new();
    for (minor, theory) in chain.iter().enumerate().take(upto) {
        if Some(minor) == skipped {
            continue;
        }
        let coord = Coordinate::new(chain_label(), 1, minor as u64);
        if let Err(error) = registry.acquire(coord, theory.clone()) {
            panic!(
                "an additive minor of an included chain was refused: {error:?} over {}",
                theory.to_cddl()
            );
        }
    }
    registry
}

/// Where a verdict stands on the way to a strict acceptance: rejected for
/// an unheld major, accepted tolerantly, accepted strictly. `None` is a
/// verdict a conforming document is never supposed to meet.
fn convergence(verdict: &Verdict, stamp: u64) -> Option<u8> {
    match verdict {
        Verdict::Rejected(Rejection::UnheldMajor { major: 1 }) => Some(0),
        Verdict::AcceptedTolerantly { .. } => Some(1),
        Verdict::AcceptedStrictly { minor } if *minor == stamp => Some(2),
        _ => None,
    }
}

/// The instrument as a comparable rendering — which arm, and which
/// theory or companion it names.
fn shape(instrument: &Instrument<'_>) -> String {
    match instrument {
        Instrument::Strict { minor, theory } => format!("strict {minor}: {}", theory.to_cddl()),
        Instrument::Tolerant { floor, companion } => {
            format!("tolerant {floor}: {}", companion.to_cddl())
        }
        other => format!("{other:?}"),
    }
}

/// The least held minor whose theory admits this content, found the way
/// the binary search is not: one probe at a time, in order.
fn scan(registry: &Registry, content: &Content) -> Option<u64> {
    registry.minors(&chain_label(), 1).find(|minor| {
        let coord = Coordinate::new(chain_label(), 1, *minor);
        let theory = registry.theory(&coord).expect("a minor the registry lists");
        let (major, held) = theory.coordinate();
        let envelope = Envelope::new(chain_label(), Version::new(major, held, 0));
        satisfies(&Document::new(envelope, content.clone()), theory).holds()
    })
}

/// Drop the repeated keys a generator has no way to avoid, so that the
/// constructor's duplicate refusal is not what the property measures.
fn map_of(pairs: Vec<(Value, Value)>) -> Map {
    let mut kept: Vec<(Value, Value)> = Vec::new();
    for (key, value) in pairs {
        if !kept.iter().any(|(seen, _)| seen == &key) {
            kept.push((key, value));
        }
    }
    Map::new(kept).expect("the keys were made distinct above")
}

/// Whether `x` is exactly a `binary16` value — the narrowest width. An
/// independent oracle for the float reduction's minimality: it decides
/// representability from the value's own magnitude and granularity, never
/// by asking the crate. Infinities and the one admitted NaN are exactly the
/// `binary16` specials, so they are the narrowest width too.
fn fits_binary16(x: f64) -> bool {
    if x.is_nan() || x.is_infinite() || x == 0.0 {
        return true;
    }
    let a = x.abs();
    // Above the largest finite `binary16` value, or below its smallest
    // positive subnormal, no `binary16` number is equal to `x`.
    if a > 65504.0 || a < 2f64.powi(-24) {
        return false;
    }
    // The binade exponent, read exactly from the (necessarily normal) `f64`
    // bits — `a >= 2^-24` is far above the `f64` subnormal range.
    let binade = ((a.to_bits() >> 52) & 0x7ff) as i32 - 1023;
    // `binary16`'s ULP: `2^(binade-10)` where it is normal, a fixed `2^-24`
    // through its subnormal binades. `x` fits exactly iff it is an integer
    // multiple of that ULP.
    let ulp_exp = if binade >= -14 { binade - 10 } else { -24 };
    (a / 2f64.powi(ulp_exp)).fract() == 0.0
}

/// The narrowest `FloatWidth` whose round-trip preserves `x`, computed
/// without the crate: `Half` where `binary16` holds it exactly, else
/// `Single` where `binary32` does, else `Double`.
fn minimal_width(x: f64) -> FloatWidth {
    if fits_binary16(x) {
        FloatWidth::Half
    } else if (x as f32 as f64) == x {
        FloatWidth::Single
    } else {
        FloatWidth::Double
    }
}

proptest! {
    /// Every structure has exactly one name, and byte equality of names
    /// decides equality of structures.
    #[test]
    fn unique_names_decoding_inverts_encoding(v in any_value()) {
        let bytes = v.to_canonical_bytes();
        let decoded = Value::from_canonical_bytes(&bytes).expect("a name this crate wrote");
        prop_assert_eq!(decoded, v);
    }

    #[test]
    fn unique_names_encoding_is_stable_through_decoding(v in any_value()) {
        let bytes = v.to_canonical_bytes();
        let decoded = Value::from_canonical_bytes(&bytes).expect("a name this crate wrote");
        prop_assert_eq!(decoded.to_canonical_bytes(), bytes);
    }

    #[test]
    fn unique_names_byte_equality_decides_structure_equality((a, b) in any_value_pair()) {
        prop_assert_eq!(a == b, a.to_canonical_bytes() == b.to_canonical_bytes());
    }

    /// The order implemented directly is the order the names have.
    #[test]
    fn canonical_order_agrees_with_the_order_of_names((a, b) in any_value_pair()) {
        prop_assert_eq!(
            a.cmp(&b),
            a.to_canonical_bytes().cmp(&b.to_canonical_bytes()),
        );
    }

    /// A map holds its entries in that same order, which is what makes the
    /// decoder's check over adjacent byte ranges the right check.
    #[test]
    fn map_entries_stand_in_ascending_key_order(pairs in prop::collection::vec((any_value(), any_value()), 0..8)) {
        let map = map_of(pairs);
        let keys: Vec<Vec<u8>> = map.iter().map(|(k, _)| k.to_canonical_bytes()).collect();
        prop_assert!(keys.windows(2).all(|w| w[0] < w[1]));
    }

    /// The length reported without producing the name is the length of the
    /// name.
    #[test]
    fn canonical_len_agrees_with_the_name(v in any_value()) {
        prop_assert_eq!(v.canonical_len(), v.to_canonical_bytes().len());
    }

    /// A float holds the shortest form that preserves its value. Two things
    /// follow, and both are asserted: reducing an already-reduced float
    /// changes nothing (idempotence), and the width is *minimal* — no
    /// narrower `FloatWidth` round-trips to the same `f64`, checked against
    /// an independent width oracle.
    #[test]
    fn float_reduction_is_minimal(v in any::<f64>()) {
        if let Ok(float) = Float::from_f64(v) {
            let x = float.to_f64();
            prop_assert_eq!(Float::from_f64(x).ok(), Some(float));
            prop_assert_eq!(
                float.width(),
                minimal_width(x),
                "the float was stored at {:?}, not its minimal width",
                float.width()
            );
        }
    }

    /// Bytes outside the language are refused, never repaired — and never
    /// by panicking.
    #[test]
    fn arbitrary_bytes_are_answered_rather_than_survived(bytes in prop::collection::vec(any::<u8>(), 0..24)) {
        if let Ok(value) = Value::from_canonical_bytes(&bytes) {
            prop_assert_eq!(value.to_canonical_bytes(), bytes);
        }
    }

    /// One spelling, one encoding: string equality, byte equality, and
    /// encoded-item equality coincide on labels, and parsing is inverse to
    /// printing.
    #[test]
    fn one_spelling_parsing_and_printing_are_inverse(text in any_label()) {
        let label = NamespaceLabel::parse(&text).expect("generated from the ABNF");
        prop_assert_eq!(label.as_str(), &text);
        let printed = label.to_string();
        prop_assert_eq!(&printed, &text);
        prop_assert_eq!(NamespaceLabel::parse(&printed).ok(), Some(label));
    }

    #[test]
    fn one_spelling_string_equality_is_byte_equality((a, b) in (any_label(), any_label())) {
        let first = Value::Text(Text::from(a.clone()));
        let second = Value::Text(Text::from(b.clone()));
        prop_assert_eq!(
            a == b,
            first.to_canonical_bytes() == second.to_canonical_bytes()
        );
    }

    /// Every character of the alphabet is printable ASCII, on which UTF-8
    /// acts as the identity — so every label is a fixed point of NFC and
    /// NFD alike, and no normalization can produce a second byte form.
    /// Checked here without a normalization dependency, exactly as the
    /// demonstration argues it.
    #[test]
    fn one_spelling_every_label_is_ascii(text in any_label()) {
        let label = NamespaceLabel::parse(&text).expect("generated from the ABNF");
        prop_assert!(label.as_str().is_ascii());
        prop_assert!(label.as_str().bytes().all(|b| (0x21..0x7f).contains(&b)));
        prop_assert_eq!(label.as_str().chars().count(), label.as_str().len());
    }

    /// A string outside the language is refused, and refused as the kind of
    /// fault it is.
    #[test]
    fn one_spelling_mutations_leave_the_language(
        text in any_label(),
        mutation in any_mutation(),
        index in 0usize..64,
    ) {
        let mutated = mutate(&text, mutation, index);
        let error = NamespaceLabel::parse(&mutated)
            .expect_err("the mutation leaves the language");
        prop_assert_eq!(label_variant(&error), expected_variant(mutation), "over {:?}", mutated);
    }

    /// Bounded determination: the envelope is settled by at most a
    /// 296-byte prefix, and the bounded read agrees with the full decode.
    #[test]
    fn bounded_determination_peek_agrees_within_the_bound(document in any_document()) {
        let bytes = document.to_canonical_bytes();
        let (envelope, consumed) = Envelope::peek(&bytes).expect("a document this crate wrote");

        prop_assert!(consumed <= MAX_ENVELOPE_PREFIX);
        prop_assert!(consumed <= bytes.len());
        prop_assert_eq!(&envelope, document.envelope());

        let decoded = Document::from_canonical_bytes(&bytes).expect("a name this crate wrote");
        prop_assert_eq!(decoded.envelope(), &envelope);

        // The same answer given nothing beyond the bound.
        let cut = bytes.len().min(MAX_ENVELOPE_PREFIX);
        prop_assert_eq!(
            Envelope::peek(&bytes[..cut]).expect("the envelope lies inside the bound"),
            (envelope, consumed)
        );
    }

    /// Inclusion composes: consecutive-pair inclusion over a chain implies
    /// inclusion between every pair of it.
    ///
    /// This is what makes the registry's one comparison sound. Acquiring a
    /// minor, it checks against the greatest held theory below it and
    /// against no lower one — which is only enough if "verbatim" composes
    /// along the chain. The design asserts that it does; this is the
    /// assertion made executable rather than trusted.
    #[test]
    fn inclusion_composes_along_a_chain(chain in any_minor_chain()) {
        if !consecutive_inclusion(&chain) {
            return Ok(());
        }
        for (index, earlier) in chain.iter().enumerate() {
            for later in &chain[index + 1..] {
                let verdict = check_inclusion(earlier, later)
                    .expect("one label, one major, ascending minors");
                prop_assert!(
                    verdict.holds(),
                    "consecutive inclusion holds along the chain and {} does not include {}: {:?}",
                    earlier.to_cddl(),
                    later.to_cddl(),
                    verdict
                );
            }
        }
    }

    /// The base theory is satisfied by every document, before any
    /// assignment is consulted — which is what "constitutionally prior"
    /// buys, and what makes reaching it without dispatch sound.
    ///
    /// It is also the crosscheck of the two label recognizers at the
    /// document level: key 0 of a `Document` came through the ABNF scanner,
    /// and this judgment runs it through the base theory's `.regexp` and
    /// its `.size (3..255)`.
    #[test]
    fn every_document_satisfies_the_base_theory(document in any_document()) {
        prop_assert!(satisfies_global(&document).holds());
    }

    /// Forward compatibility: a document a later minor's theory admits is
    /// admitted by the open companion of every earlier assigned minor.
    ///
    /// This is what lets a reader below the stamp still read: it judges
    /// against the companion of the greatest theory it holds, and the
    /// metatheorem says the answer agrees with the emitter's. Quantified
    /// over the same generated chains conservativity is, under the same
    /// premise the registry actually checks.
    #[test]
    fn forward_compatibility_a_conforming_document_meets_every_earlier_companion(
        chain in any_minor_chain(),
        seeds in prop::collection::vec(any::<u8>(), 1..6),
        carried in prop::collection::vec(any::<bool>(), 1..6),
    ) {
        if !consecutive_inclusion(&chain) {
            return Ok(());
        }
        for (index, theory) in chain.iter().enumerate() {
            let document = conforming(theory, &seeds, &carried);
            prop_assert!(
                satisfies(&document, theory).holds(),
                "the generated document does not conform to the theory it was built from: {}",
                theory.to_cddl()
            );
            for earlier in &chain[..=index] {
                let open = earlier.open_companion();
                prop_assert!(
                    satisfies_open(&document, &open).holds(),
                    "a document of minor {:?} fails the companion of minor {:?}: {:?}",
                    theory.coordinate(),
                    earlier.coordinate(),
                    satisfies_open(&document, &open)
                );
            }
        }
    }

    /// Conservativity: a content key absent from some earlier assigned
    /// minor is optional in every later minor's theory.
    ///
    /// The reason a reader that holds only an earlier minor can still be
    /// spoken to: nothing a later minor adds is ever demanded of a document
    /// the earlier one describes.
    #[test]
    fn conservativity_a_key_absent_earlier_is_optional_later(chain in any_minor_chain()) {
        if !consecutive_inclusion(&chain) {
            return Ok(());
        }
        for (index, earlier) in chain.iter().enumerate() {
            for later in &chain[index + 1..] {
                for slot in later.slots() {
                    if earlier.slot(slot.key().get()).is_none() {
                        prop_assert!(
                            !slot.required(),
                            "key {} is absent at minor {:?} and required at minor {:?}",
                            slot.key().get(),
                            earlier.coordinate(),
                            later.coordinate()
                        );
                    }
                }
            }
        }
    }

    /// Acceptance monotonicity: reader growth converges every verdict.
    ///
    /// Walked over the states a chain generates, one acquisition at a
    /// time. A conforming document meets exactly three verdicts on the
    /// way — rejected for an unheld major, accepted tolerantly, accepted
    /// strictly — and it meets them in that order and never goes back: a
    /// strict acceptance is final, and a tolerant one is provisional only
    /// upward.
    #[test]
    fn acceptance_monotonicity_a_verdict_moves_only_toward_the_stamp(
        chain in any_minor_chain(),
        seeds in prop::collection::vec(any::<u8>(), 1..6),
        carried in prop::collection::vec(any::<bool>(), 1..6),
        index in 0usize..8,
    ) {
        if !consecutive_inclusion(&chain) {
            return Ok(());
        }
        let stamped = index % chain.len();
        let document = conforming(&chain[stamped], &seeds, &carried);

        let mut ranks = Vec::new();
        for upto in 0..=chain.len() {
            let registry = reader(&chain, upto, None);
            let verdict = accept(&registry, &document);
            let rank = convergence(&verdict, stamped as u64);
            prop_assert!(
                rank.is_some(),
                "a conforming document met {:?} at a reader holding {} minors",
                verdict,
                upto
            );
            ranks.push(rank.unwrap_or(0));
        }

        prop_assert!(
            ranks.windows(2).all(|pair| pair[0] <= pair[1]),
            "a verdict moved away from acceptance over growing states: {ranks:?}"
        );
        prop_assert_eq!(
            ranks.last().copied(),
            Some(2),
            "a reader holding the stamp does not accept strictly"
        );
    }

    /// The other convergence: a stamp the ceiling passes without ever
    /// meeting it turns from tolerant acceptance to rejection, the false
    /// claim becoming checkable the moment knowledge reaches it.
    #[test]
    fn acceptance_monotonicity_a_stamp_never_assigned_turns_to_rejection(
        chain in any_minor_chain(),
        seeds in prop::collection::vec(any::<u8>(), 1..6),
        carried in prop::collection::vec(any::<bool>(), 1..6),
        index in 0usize..8,
    ) {
        if !consecutive_inclusion(&chain) || chain.len() < 2 {
            return Ok(());
        }
        // Never minor 0: the skipped minor must sit above a floor for the
        // tolerant phase to exist at all.
        let skipped = 1 + index % (chain.len() - 1);
        let document = conforming(&chain[skipped], &seeds, &carried);

        for upto in 0..=chain.len() {
            let registry = reader(&chain, upto, Some(skipped));
            let verdict = accept(&registry, &document);
            match registry.ceiling(&chain_label(), 1) {
                None => prop_assert_eq!(
                    verdict,
                    Verdict::Rejected(Rejection::UnheldMajor { major: 1 })
                ),
                Some(ceiling) if ceiling < skipped as u64 => prop_assert_eq!(
                    verdict,
                    Verdict::AcceptedTolerantly { floor: ceiling }
                ),
                Some(ceiling) => prop_assert_eq!(
                    verdict,
                    Verdict::Rejected(Rejection::UnassignedStamp {
                        minor: skipped as u64,
                        ceiling,
                    })
                ),
            }
        }
    }

    /// Bounded determination, at the surface that makes it usable: the
    /// instrument chosen from at most a 296-byte prefix is the instrument
    /// chosen from the whole envelope — the same arm, and the same theory
    /// or companion inside it.
    #[test]
    fn bounded_determination_the_prefix_routes_as_the_envelope_does(
        chain in any_minor_chain(),
        seeds in prop::collection::vec(any::<u8>(), 1..6),
        carried in prop::collection::vec(any::<bool>(), 1..6),
        index in 0usize..8,
        held in 0usize..8,
        stranger in any_document(),
    ) {
        if !consecutive_inclusion(&chain) {
            return Ok(());
        }
        let registry = reader(&chain, held % (chain.len() + 1), None);
        let stamped = conforming(&chain[index % chain.len()], &seeds, &carried);

        // One document of the label the reader knows, and one of whatever
        // the document generator drew — most often a label it does not.
        for document in [stamped, stranger] {
            let bytes = document.to_canonical_bytes();
            let cut = bytes.len().min(MAX_ENVELOPE_PREFIX);
            let early = dispatch_prefix(&registry, &bytes[..cut])
                .expect("the envelope of a document this crate wrote lies inside the bound");
            prop_assert_eq!(
                shape(&early),
                shape(&dispatch(&registry, document.envelope()))
            );
        }
    }

    /// The stamping search rests on an invariant rather than on an
    /// assumption: the satisfying minors are upward closed, so the least
    /// one is a partition point. The check is the cheap way to notice if
    /// it ever stops resting on it.
    #[test]
    fn stamping_the_binary_search_agrees_with_a_linear_scan(
        chain in any_minor_chain(),
        seeds in prop::collection::vec(any::<u8>(), 1..6),
        carried in prop::collection::vec(any::<bool>(), 1..6),
        index in 0usize..8,
        held in 0usize..8,
    ) {
        if !consecutive_inclusion(&chain) {
            return Ok(());
        }
        let registry = reader(&chain, held % (chain.len() + 1), None);
        let content = conforming(&chain[index % chain.len()], &seeds, &carried)
            .content()
            .clone();

        prop_assert_eq!(
            registry.stamp(&chain_label(), 1, &content),
            scan(&registry, &content)
        );
        // And over content no theory of the chain need admit at all.
        prop_assert_eq!(
            registry.stamp(&chain_label(), 1, &Content::new()),
            scan(&registry, &Content::new())
        );
    }
}

fn label_variant(error: &LabelError) -> &'static str {
    match error {
        LabelError::TooFewAtoms => "TooFewAtoms",
        LabelError::EmptyAtom { .. } => "EmptyAtom",
        LabelError::BadCharacter { .. } => "BadCharacter",
        LabelError::HyphenAtEdge { .. } => "HyphenAtEdge",
        LabelError::TooLong { .. } => "TooLong",
        other => panic!("a variant this test has not met: {other:?}"),
    }
}

fn expected_variant(mutation: Mutation) -> &'static str {
    match mutation {
        Mutation::Uppercase | Mutation::Underscore | Mutation::NonAscii => "BadCharacter",
        Mutation::LeadingDot | Mutation::TrailingDot | Mutation::DoubledDot => "EmptyAtom",
        Mutation::HyphenAtEdge => "HyphenAtEdge",
        Mutation::OneAtom => "TooFewAtoms",
        Mutation::TooLong => "TooLong",
    }
}

/// One million levels deep, which the data language admits because it
/// bounds nesting nowhere. Decoding, encoding, and dropping are each
/// iterative, and this is what says so.
///
/// The value is never cloned, hashed, or compared here: those walks are
/// the compiler's derived ones, and they still recurse.
#[test]
fn a_value_nested_one_million_deep_decodes_encodes_and_drops() {
    const DEPTH: usize = 1_000_000;

    let mut bytes = vec![0x81u8; DEPTH];
    bytes.push(0x00);

    let value = Value::from_canonical_bytes(&bytes).expect("nesting is bounded by the input alone");
    assert_eq!(value.canonical_len(), bytes.len());
    assert_eq!(value.to_canonical_bytes(), bytes);
    drop(value);
}

/// The same depth reached through all three recursive constructors, so
/// that no teardown path is left to the compiler's glue.
#[test]
fn a_deep_chain_of_arrays_maps_and_tags_drops() {
    const UNITS: usize = 200_000;

    let mut bytes = Vec::with_capacity(UNITS * 4 + 1);
    for _ in 0..UNITS {
        bytes.extend_from_slice(&[0x81, 0xa1, 0x00, 0xc1]);
    }
    bytes.push(0x00);

    let value = Value::from_canonical_bytes(&bytes).expect("a canonical chain");
    assert_eq!(value.to_canonical_bytes(), bytes);
    drop(value);
}

/// A chain of tags alone: the recursion the value model carries without
/// an array or a map anywhere to intercept it.
#[test]
fn a_deep_chain_of_tags_alone_drops() {
    const DEPTH: usize = 500_000;

    let mut bytes = vec![0xc1u8; DEPTH];
    bytes.push(0x00);

    let value = Value::from_canonical_bytes(&bytes).expect("a canonical chain");
    assert_eq!(value.canonical_len(), bytes.len());
    drop(value);
}
