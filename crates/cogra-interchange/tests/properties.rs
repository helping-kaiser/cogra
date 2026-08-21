//! The metatheorem obligations of the design's property table, one per
//! theorem, named after it so that a failure names what it broke.
//!
//! Slices 1 and 2 owe five: unique names, canonical order, iterative
//! teardown, one spelling, and bounded determination. The description
//! language adds two whose subject is a chain of minors: conservativity,
//! and the composition of inclusion the registry's one-comparison rule
//! rests on. The rest arrive with the slices whose subjects they are.

use cogra_interchange::{
    Array, Bytes, Content, ContentKey, Document, Envelope, Float, LabelError, MAX_ENVELOPE_PREFIX,
    Map, NamespaceLabel, Negative, Simple, Tag, Text, Theory, Value, Version, check_inclusion,
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

    /// A float holds the shortest form that preserves its value, so
    /// reducing an already-reduced float changes nothing.
    #[test]
    fn float_reduction_is_idempotent(v in any::<f64>()) {
        if let Ok(float) = Float::from_f64(v) {
            prop_assert_eq!(Float::from_f64(float.to_f64()).ok(), Some(float));
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
