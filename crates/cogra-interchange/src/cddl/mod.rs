//! CDDL, the description language of the interchange conventions.
//!
//! The conventions adopt "CDDL (RFC 8610) entire", narrowing the operator
//! vocabulary nowhere, and the assignable fragment is structural rather
//! than lexical — so fragment membership and the key-by-key identity
//! comparison are both questions about a *whole parsed theory*. Neither is
//! answerable over a theory the crate could not parse. Parsing is
//! therefore complete even where evaluation is not
//! (´dec:xchg:cddl-coverage´).
//!
//! # The modules
//!
//! | Module | Role |
//! |---|---|
//! | [`lex`] | tokenizer over the ABNF of RFC 8610 Appendix B |
//! | [`ast`] | the CDDL syntax tree |
//! | [`parse`] | recursive-descent parser onto [`ast`] |
//! | [`print`] | the normalized printer |
//! | [`resolve`] | the rule table, the prelude, generics, sockets |
//! | [`fragment`] | assignable-fragment membership |
//! | [`companion`] | open-companion derivation |
//! | [`inclusion`] | minor inclusion, key by key |
//! | [`restraint`] | the restraint report over an assigned theory |
//! | [`eval`] | satisfaction: a `Value` matched against a resolved type |
//! | [`control`] | control-operator evaluation, over the ruled subset |
//!
//! The grammar these implement is checked into the repository beside the
//! code, at `tests/corpus/rfc8610-abnf.txt`, so that a reader auditing the
//! parser against its specification does not have to leave the tree.

pub(crate) mod ast;
pub(crate) mod companion;
pub(crate) mod control;
pub(crate) mod eval;
pub(crate) mod fragment;
pub(crate) mod inclusion;
pub(crate) mod lex;
pub(crate) mod parse;
pub(crate) mod print;
pub(crate) mod resolve;
pub(crate) mod restraint;

pub use companion::OpenTheory;
pub use eval::{Mismatch, MismatchKind, Satisfaction, satisfies, satisfies_global, satisfies_open};
pub use inclusion::{Inclusion, InclusionBreach, check_inclusion};
pub use restraint::{ImplicitReach, Provision, Restrained, RestraintReport};

use std::collections::BTreeMap;
use std::sync::OnceLock;

use ast::{Cddl, GroupEntryKind, MemberKeyKind, Operation, Operator, RuleBody, Type2Kind};
use fragment::Fragment;
use lex::{Span, SyntaxError};
use resolve::RuleTable;

use crate::error::TheoryError;
use crate::regexp::XsdPattern;
use crate::{ContentKey, NamespaceLabel};

/// The ten control operators the version-1 evaluator implements.
///
/// The four of RFC 8610 §3.8 that remain — `.cbor`, `.cborseq`, `.within`,
/// and `.and` — refuse at [`Theory::parse`]. `.cbor` and `.cborseq` are
/// held back for a reason of substance rather than of budget: they nest the
/// data language inside itself, and whether the nested item must itself be
/// canonical is a question the conventions do not answer.
const EVALUABLE: [&str; 10] = [
    "size", "regexp", "gt", "ge", "lt", "le", "eq", "ne", "default", "bits",
];

/// How far a `.regexp` operand is followed through rule references before
/// the search for a text literal gives up.
const PATTERN_DEPTH: usize = 16;

/// An assigned theory: a sentence of the assignable fragment, parsed,
/// resolved, and evaluable. Immutable.
///
/// ```
/// use cogra_interchange::Theory;
///
/// let theory = Theory::parse(
///     r#"example = {0 => "com.company.example", 1 => [1, 2, uint], 2 => tstr}"#,
/// )
/// .expect("an assignable theory");
/// assert_eq!(theory.label().as_str(), "com.company.example");
/// assert_eq!(theory.coordinate(), (1, 2));
/// ```
#[derive(Clone, Debug)]
pub struct Theory {
    source: Box<str>,
    cddl: Cddl,
    table: RuleTable,
    fragment: Fragment,
    patterns: BTreeMap<usize, XsdPattern>,
}

impl Theory {
    /// Parse, check fragment membership, resolve every reference, compile
    /// every `.regexp` pattern, and verify every control operator is one
    /// this crate evaluates. Every failure mode is a [`TheoryError`].
    ///
    /// The order is the pipeline's, and it is visible in the refusals: a
    /// theory that is not in the fragment is refused as such even where it
    /// also references an undefined rule, because membership is a question
    /// about the root map alone and answering it first gives the more
    /// useful diagnostic.
    ///
    /// Patterns are compiled here and executed nowhere, which is what makes
    /// satisfaction total once a `Theory` exists.
    ///
    /// ```
    /// use cogra_interchange::{Theory, TheoryError};
    ///
    /// let err = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => bstr .cbor any}"#)
    ///     .expect_err("`.cbor` is outside the evaluable subset");
    /// assert!(matches!(err, TheoryError::Unevaluable { ref operator } if operator == ".cbor"));
    /// ```
    pub fn parse(source: &str) -> Result<Theory, TheoryError> {
        let cddl = parse::parse(source).map_err(syntax)?;
        let fragment = fragment::check(&cddl)?;
        let table = RuleTable::build(&cddl)?;
        let patterns = compile_patterns(&table)?;
        check_operators(&table)?;

        Ok(Theory {
            source: source.into(),
            cddl,
            table,
            fragment,
            patterns,
        })
    }

    /// The source as given, byte for byte.
    ///
    /// This, and not [`Theory::to_cddl`], is what a consumer stores and
    /// compares: the printed form is normalized and its exact shape is not
    /// promised across versions.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let source = r#"e = {0 => "com.example",  1 => [0, 0, uint]}"#;
    /// let theory = Theory::parse(source).expect("an assignable theory");
    /// assert_eq!(theory.source(), source);
    /// ```
    pub fn source(&self) -> &str {
        &self.source
    }

    /// The label pinned at key 0.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint]}"#)
    ///     .expect("an assignable theory");
    /// assert_eq!(theory.label().as_str(), "com.example");
    /// ```
    pub fn label(&self) -> &NamespaceLabel {
        self.fragment.label()
    }

    /// The major and minor pinned at key 1; patch is free.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [3, 4, uint]}"#)
    ///     .expect("an assignable theory");
    /// assert_eq!(theory.coordinate(), (3, 4));
    /// ```
    pub fn coordinate(&self) -> (u64, u64) {
        self.fragment.coordinate()
    }

    /// The content keys the theory enumerates, in ascending key order.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(
    ///     r#"e = {0 => "com.example", 1 => [0, 0, uint], 7 => bstr, ? 2 => tstr}"#,
    /// )
    /// .expect("an assignable theory");
    /// let keys: Vec<u64> = theory.slots().map(|slot| slot.key().get()).collect();
    /// assert_eq!(keys, [2, 7]);
    /// ```
    pub fn slots(&self) -> impl Iterator<Item = KeySlot<'_>> + '_ {
        self.fragment.slots().iter().map(|slot| KeySlot {
            key: slot.key(),
            required: slot.required(),
            type_source: self.slice(slot.type_span()),
        })
    }

    /// The slot at one content key, where the theory enumerates it.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr}"#)
    ///     .expect("an assignable theory");
    /// assert!(theory.slot(2).is_some());
    /// assert!(theory.slot(3).is_none());
    /// ```
    pub fn slot(&self, key: u64) -> Option<KeySlot<'_>> {
        self.slots().find(|slot| slot.key.get() == key)
    }

    /// Normalized CDDL, for diagnostics and for structural comparison.
    ///
    /// What this prints is a normal form and not the source: comments are
    /// gone, layout is fixed, and the exact shape is not stable across
    /// versions of this crate. A consumer diffing it against a stored
    /// string relies on something the crate does not promise, and wants
    /// [`Theory::source`] instead.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse("e = {0 => \"com.example\", ; a comment\n 1 => [0, 0, uint]}")
    ///     .expect("an assignable theory");
    /// assert_eq!(theory.to_cddl(), "e = {0 => \"com.example\", 1 => [0, 0, uint]}\n");
    /// ```
    pub fn to_cddl(&self) -> String {
        print::print(&self.cddl)
    }

    /// The open companion: this theory with the minor position of key 1
    /// freed to `uint` and the base theory's wildcard joining the map.
    ///
    /// Derived, total, and of a different type — no registry takes an
    /// [`OpenTheory`]. Every content key keeps its type and its
    /// requiredness: the derivation makes exactly two edits and no third.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 2, uint]}"#)
    ///     .expect("an assignable theory");
    /// let open = theory.open_companion();
    /// assert!(open.to_cddl().contains("1 => [1, uint, uint]"));
    /// assert!(open.to_cddl().ends_with("* (uint .gt 1) => any}\n"));
    /// ```
    pub fn open_companion(&self) -> OpenTheory {
        companion::derive(self)
    }

    /// Which positions of this theory reach a restrained value, and how.
    ///
    /// The report is computed, never enforced: a theory reaching a float
    /// through `any` is refused where it is acquired, and the report is
    /// what such a refusal carries. Nothing here changes what a document
    /// satisfies (´dec:xchg:restraint-enforcement´).
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let named = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => float64}"#)
    ///     .expect("an assignable theory");
    /// assert!(named.restraint().is_restrained());
    ///
    /// let reaching = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => any}"#)
    ///     .expect("an assignable theory");
    /// assert_eq!(reaching.restraint().implicit_reaches().count(), 3);
    /// ```
    pub fn restraint(&self) -> RestraintReport {
        restraint::report(self)
    }

    fn slice(&self, span: Span) -> &str {
        self.source.get(span.start..span.end).unwrap_or_default()
    }
}

/// One enumerated content key of an assigned theory.
///
/// ```
/// use cogra_interchange::Theory;
///
/// let theory = Theory::parse(
///     r#"e = {0 => "com.example", 1 => [0, 0, uint], ? 2 => tstr .size 3}"#,
/// )
/// .expect("an assignable theory");
/// let slot = theory.slot(2).expect("key 2 is enumerated");
/// assert_eq!(slot.key().get(), 2);
/// assert!(!slot.required());
/// assert_eq!(slot.type_source(), "tstr .size 3");
/// ```
#[derive(Copy, Clone, Debug)]
pub struct KeySlot<'a> {
    key: ContentKey,
    required: bool,
    type_source: &'a str,
}

impl<'a> KeySlot<'a> {
    /// The key, always greater than 1.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 4 => tstr}"#)
    ///     .expect("an assignable theory");
    /// assert_eq!(theory.slot(4).expect("key 4").key().get(), 4);
    /// ```
    pub fn key(&self) -> ContentKey {
        self.key
    }

    /// Whether a document must carry this key: false exactly where the
    /// theory marked the entry optional.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(
    ///     r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr, ? 3 => tstr}"#,
    /// )
    /// .expect("an assignable theory");
    /// assert!(theory.slot(2).expect("key 2").required());
    /// assert!(!theory.slot(3).expect("key 3").required());
    /// ```
    pub fn required(&self) -> bool {
        self.required
    }

    /// The type expression at this key, **as written in the source**.
    ///
    /// This is a slice of [`Theory::source`], for display: it carries the
    /// theory author's spelling, whitespace and all, and two theories
    /// writing the same type differently produce different strings here.
    /// It is therefore not an identity: whether two keys carry the same
    /// type is decided by the normalized printer and never by comparing
    /// these slices.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(
    ///     r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => uint  /  tstr}"#,
    /// )
    /// .expect("an assignable theory");
    /// assert_eq!(theory.slot(2).expect("key 2").type_source(), "uint  /  tstr");
    /// ```
    pub fn type_source(&self) -> &'a str {
        self.type_source
    }
}

/// The base theory, satisfied by every document before any assignment is
/// consulted. Constitutionally prior: reached without dispatch.
///
/// ```
/// use cogra_interchange::global;
///
/// assert!(global().source().contains("namespace-form"));
/// ```
pub fn global() -> &'static BaseTheory {
    static GLOBAL: OnceLock<BaseTheory> = OnceLock::new();
    GLOBAL.get_or_init(BaseTheory::build)
}

/// The conventions' base theory, verbatim.
///
/// Constructed from its own CDDL text rather than from a hand-built tree,
/// so that the theory the crate applies and the theory the conventions
/// publish are the same string.
const GLOBAL_SOURCE: &str = r#"global = {
  0 => namespace-label,
  1 => version,
  * (uint .gt 1) => any
}

version = [major: uint, minor: uint, patch: uint]

namespace-label = namespace-form .size (3..255)

namespace-form = tstr .regexp "[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+"
"#;

/// The base theory: a theory of the description language that is not in the
/// assignable fragment and never could be.
///
/// It is a distinct type from [`Theory`] for that reason. Its wildcard is
/// what an assigned theory replaces by enumeration, and its key 0 is a type
/// rather than a pin, so every clause of fragment membership it fails, it
/// fails by design.
#[derive(Debug)]
pub struct BaseTheory {
    prepared: Option<Prepared>,
}

/// A parsed, resolved theory with its patterns compiled — the part
/// [`Theory`] and [`BaseTheory`] share.
#[derive(Clone, Debug)]
struct Prepared {
    cddl: Cddl,
    table: RuleTable,
    patterns: BTreeMap<usize, XsdPattern>,
}

impl BaseTheory {
    /// The base theory's CDDL, byte for byte as the conventions write it.
    ///
    /// ```
    /// use cogra_interchange::global;
    ///
    /// assert!(global().source().starts_with("global = {"));
    /// ```
    pub fn source(&self) -> &'static str {
        GLOBAL_SOURCE
    }

    /// Normalized CDDL, on the same terms as [`Theory::to_cddl`].
    ///
    /// ```
    /// use cogra_interchange::global;
    ///
    /// assert!(global().to_cddl().starts_with("global = {0 => namespace-label"));
    /// ```
    pub fn to_cddl(&self) -> String {
        match &self.prepared {
            Some(prepared) => print::print(&prepared.cddl),
            None => GLOBAL_SOURCE.to_owned(),
        }
    }

    /// The compiled pattern of a rule that carries one `.regexp`.
    ///
    /// Read out of the parsed theory rather than from a copy of the pattern
    /// text, which is what lets the cross-check of the two label
    /// recognizers be a check and not a restatement
    /// (´verif:xchg:label-pattern-crosscheck´).
    #[cfg(test)]
    pub(crate) fn pattern_of(&self, rule: &str) -> Option<&XsdPattern> {
        let prepared = self.prepared.as_ref()?;
        let body = prepared.table.get(rule)?.body();
        let mut found = None;
        let _ = for_each_operation::<()>(body, &mut |operation| {
            if found.is_none() && is_control(operation, "regexp") {
                found = prepared.patterns.get(&operation.operand.span.start);
            }
            Ok(())
        });
        found
    }

    /// `None` where the shipped base theory did not go through the
    /// pipeline, which would mean this crate cannot read the conventions'
    /// own schema. It fails closed — no pattern, no normalized form — and a
    /// unit test keeps the case theoretical.
    fn build() -> BaseTheory {
        BaseTheory {
            prepared: prepare(GLOBAL_SOURCE).ok(),
        }
    }
}

/// Parse, resolve, and compile: everything `Theory::parse` does except
/// decide fragment membership, which the base theory does not satisfy.
fn prepare(source: &str) -> Result<Prepared, TheoryError> {
    let cddl = parse::parse(source).map_err(syntax)?;
    let table = RuleTable::build(&cddl)?;
    let patterns = compile_patterns(&table)?;
    check_operators(&table)?;
    Ok(Prepared {
        cddl,
        table,
        patterns,
    })
}

/// Compile every `.regexp` pattern in the theory, keyed by where its
/// operand stands.
///
/// A pattern is a text literal, directly or through rule references — the
/// conventions' own `namespace-form` writes it directly, and a theory
/// naming its pattern in a rule of its own means the same thing. An operand
/// that is no text literal at all compiles to nothing here and is the
/// evaluator's to refuse: RFC 8610 §3.8.3 gives `.regexp` a text-string
/// control value, and a theory offering something else has a type error
/// rather than a bad pattern.
fn compile_patterns(table: &RuleTable) -> Result<BTreeMap<usize, XsdPattern>, TheoryError> {
    let mut patterns = BTreeMap::new();

    for (_, rule) in table.own_rules() {
        for_each_operation(rule.body(), &mut |operation| -> Result<(), TheoryError> {
            if !is_control(operation, "regexp") {
                return Ok(());
            }
            let Some((raw, span)) = text_literal(table, &operation.operand, PATTERN_DEPTH) else {
                return Ok(());
            };
            let denoted = ast::unescape_text(&raw, span).map_err(syntax)?;
            let compiled = XsdPattern::compile(&denoted)?;
            patterns.insert(operation.operand.span.start, compiled);
            Ok(())
        })?;
    }

    Ok(patterns)
}

/// Refuse the first control operator outside the evaluable subset.
fn check_operators(table: &RuleTable) -> Result<(), TheoryError> {
    for (_, rule) in table.own_rules() {
        for_each_operation(rule.body(), &mut |operation| {
            let Operator::Control(name) = &operation.operator else {
                return Ok(());
            };
            if EVALUABLE.contains(&name.text.as_str()) {
                Ok(())
            } else {
                Err(TheoryError::Unevaluable {
                    operator: format!(".{}", name.text),
                })
            }
        })?;
    }
    Ok(())
}

fn is_control(operation: &Operation, name: &str) -> bool {
    matches!(&operation.operator, Operator::Control(control) if control.text == name)
}

/// The text literal an operand denotes, following rule references while a
/// budget lasts.
fn text_literal(table: &RuleTable, ty: &ast::Type2, depth: usize) -> Option<(String, Span)> {
    if depth == 0 {
        return None;
    }
    match &ty.kind {
        Type2Kind::Value(value) => match &value.kind {
            ast::ValueKind::Text(raw) => Some((raw.clone(), value.span)),
            _ => None,
        },
        Type2Kind::Parenthesized(inner) => text_literal(table, single(inner)?, depth - 1),
        Type2Kind::Typename { name, args: None } => match table.get(&name.text)?.body() {
            RuleBody::Type(inner) => text_literal(table, single(inner)?, depth - 1),
            RuleBody::Group(_) => None,
        },
        _ => None,
    }
}

/// The one `type2` a type carries, where it is neither a choice nor an
/// operation.
fn single(ty: &ast::Type) -> Option<&ast::Type2> {
    match ty.choices.as_slice() {
        [only] if only.operation.is_none() => Some(&only.target),
        _ => None,
    }
}

/// Visit every operation of a rule body, innermost last.
fn for_each_operation<E>(
    body: &RuleBody,
    visit: &mut impl FnMut(&Operation) -> Result<(), E>,
) -> Result<(), E> {
    match body {
        RuleBody::Type(ty) => walk_type(ty, visit),
        RuleBody::Group(entry) => walk_entry(entry, visit),
    }
}

fn walk_type<E>(
    ty: &ast::Type,
    visit: &mut impl FnMut(&Operation) -> Result<(), E>,
) -> Result<(), E> {
    for choice in &ty.choices {
        walk_type2(&choice.target, visit)?;
        if let Some(operation) = &choice.operation {
            visit(operation)?;
            walk_type2(&operation.operand, visit)?;
        }
    }
    Ok(())
}

fn walk_type2<E>(
    ty: &ast::Type2,
    visit: &mut impl FnMut(&Operation) -> Result<(), E>,
) -> Result<(), E> {
    match &ty.kind {
        Type2Kind::Value(_)
        | Type2Kind::Representation { .. }
        | Type2Kind::Any
        | Type2Kind::Typename { .. }
        | Type2Kind::Unwrap { .. }
        | Type2Kind::EnumGroup { .. } => Ok(()),
        Type2Kind::Parenthesized(inner) | Type2Kind::Tagged { inner, .. } => {
            walk_type(inner, visit)
        }
        Type2Kind::Map(group) | Type2Kind::Array(group) => walk_group(group, visit),
        Type2Kind::EnumInline(group) => walk_group(group, visit),
    }
}

fn walk_group<E>(
    group: &ast::Group,
    visit: &mut impl FnMut(&Operation) -> Result<(), E>,
) -> Result<(), E> {
    for choice in &group.choices {
        for entry in &choice.entries {
            walk_entry(entry, visit)?;
        }
    }
    Ok(())
}

fn walk_entry<E>(
    entry: &ast::GroupEntry,
    visit: &mut impl FnMut(&Operation) -> Result<(), E>,
) -> Result<(), E> {
    match &entry.kind {
        GroupEntryKind::Member { key, value } => {
            if let Some(key) = key
                && let MemberKeyKind::Type { key, .. } = &key.kind
            {
                walk_type2(&key.target, visit)?;
                if let Some(operation) = &key.operation {
                    visit(operation)?;
                    walk_type2(&operation.operand, visit)?;
                }
            }
            walk_type(value, visit)
        }
        GroupEntryKind::Inline(group) => walk_group(group, visit),
    }
}

fn syntax(error: SyntaxError) -> TheoryError {
    TheoryError::Syntax {
        line: error.line,
        column: error.column,
        detail: error.detail,
    }
}

#[cfg(test)]
mod tests {
    use proptest::prelude::*;

    use super::*;

    /// The label alphabet, the separator, and a selection of near misses.
    const ALPHABET: [char; 10] = ['a', 'b', '0', '9', '-', '.', 'A', '_', ' ', 'ä'];

    fn near_label() -> impl Strategy<Value = String> {
        proptest::collection::vec(proptest::sample::select(ALPHABET.as_slice()), 0..12)
            .prop_map(|chars| chars.into_iter().collect())
    }

    fn namespace_form() -> &'static XsdPattern {
        match global().pattern_of("namespace-form") {
            Some(pattern) => pattern,
            None => panic!("the base theory has no compiled namespace-form pattern"),
        }
    }

    proptest! {
        /// The crate recognizes namespace labels twice by two independent
        /// routes — the ABNF scanner and the base theory's `.regexp` — and
        /// the two agreeing is a checkable fact
        /// (`design.md`, `verif:xchg:label-pattern-crosscheck`). The pattern
        /// is read out of the parsed base theory, so the check holds for
        /// whatever pattern the conventions ship.
        ///
        /// The full biconditional: the scanner accepts a near miss exactly
        /// when the pattern matches it. Anchored matching
        /// (`dec:xchg:regexp-engine`) is what lets it hold in both
        /// directions — an unanchored matcher would answer true for every
        /// near miss that merely *contains* a label, and only the forward
        /// half would survive.
        #[test]
        fn the_two_label_recognizers_agree(text in near_label()) {
            prop_assert_eq!(
                crate::NamespaceLabel::parse(&text).is_ok(),
                namespace_form().is_match(&text).expect("within budget"),
                "the scanner and the pattern disagree about {:?}",
                text
            );
        }

        /// Every label the ABNF scanner accepts, the conventions' pattern
        /// matches — the forward half of the biconditional above, called out
        /// on its own because it is what would catch a pattern that had
        /// drifted from the grammar.
        #[test]
        fn the_pattern_matches_every_label_the_scanner_accepts(text in near_label()) {
            if crate::NamespaceLabel::parse(&text).is_ok() {
                prop_assert!(
                    namespace_form().is_match(&text).expect("within budget"),
                    "the scanner accepted {:?} and the pattern did not match it",
                    text
                );
            }
        }
    }

    #[test]
    fn the_pattern_matches_labels_the_scanner_accepts_by_hand() {
        for label in ["com.example", "a.b", "a-b.c9", "0.0", "com.example.thing"] {
            assert!(crate::NamespaceLabel::parse(label).is_ok(), "{label}");
            assert!(
                namespace_form().is_match(label).expect("within budget"),
                "{label}"
            );
        }
    }

    #[test]
    fn the_base_theory_goes_through_the_pipeline() {
        assert!(
            global().prepared.is_some(),
            "the conventions' own base theory did not parse, resolve, and compile"
        );
    }

    #[test]
    fn the_base_theory_carries_the_conventions_pattern() {
        let pattern = match global().pattern_of("namespace-form") {
            Some(pattern) => pattern,
            None => panic!("the base theory has no compiled namespace-form pattern"),
        };
        // The CDDL literal writes `\\.`; what reaches the engine is `\.`.
        assert_eq!(
            pattern.source(),
            r"[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+"
        );
    }

    #[test]
    fn the_base_theory_is_not_in_the_assignable_fragment() {
        assert!(Theory::parse(GLOBAL_SOURCE).is_err());
    }

    #[test]
    fn a_pattern_reached_through_a_rule_reference_is_compiled() {
        let theory = Theory::parse(concat!(
            "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => tstr .regexp shape}\n",
            "shape = \"a+\"\n",
        ))
        .expect("an assignable theory");
        assert_eq!(theory.patterns.len(), 1);
    }

    #[test]
    fn a_malformed_pattern_is_refused_at_parse() {
        let error = Theory::parse(
            r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr .regexp "[a-"}"#,
        )
        .expect_err("the pattern is malformed");
        assert!(matches!(error, TheoryError::Regexp(_)));
    }

    #[test]
    fn every_operator_of_the_subset_is_admitted() {
        for operator in EVALUABLE {
            let source = format!(
                r#"e = {{0 => "com.example", 1 => [0, 0, uint], 2 => tstr .{operator} "a"}}"#,
            );
            assert!(
                Theory::parse(&source).is_ok(),
                ".{operator} should be admitted"
            );
        }
    }

    #[test]
    fn the_operators_outside_the_subset_are_refused() {
        for operator in ["cbor", "cborseq", "within", "and"] {
            let source = format!(
                r#"e = {{0 => "com.example", 1 => [0, 0, uint], 2 => bstr .{operator} any}}"#,
            );
            match Theory::parse(&source) {
                Err(TheoryError::Unevaluable { operator: named }) => {
                    assert_eq!(named, format!(".{operator}"))
                }
                other => panic!(".{operator} should be unevaluable, got {other:?}"),
            }
        }
    }

    #[test]
    fn an_unevaluable_operator_below_a_content_key_is_still_refused() {
        let error = Theory::parse(concat!(
            "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => inner}\n",
            "inner = [* (bstr .cbor any)]\n",
        ))
        .expect_err("the operator is outside the subset wherever it stands");
        assert!(matches!(error, TheoryError::Unevaluable { .. }));
    }
}
