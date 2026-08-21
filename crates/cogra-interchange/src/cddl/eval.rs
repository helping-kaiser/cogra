//! Satisfaction: the judgment `d ⊨ S`, and the matching of one [`Value`]
//! against one resolved type.
//!
//! The rules implemented here are RFC 8610 Appendix C, which that document
//! marks normative, together with the cut semantics of its §3.5.4 and the
//! PEG semantics of its Appendix A. Three readings of those documents are
//! load-bearing enough to record where the code is:
//!
//! - **Matching is PEG, and PEG does not backtrack.** Appendix A is
//!   explicit: a choice locks in its first successful alternative, and the
//!   occurrence indicators are greedy, "as a consequence, `a* a` in PEG
//!   notation or `*a a` in CDDL syntax never can match anything". So the
//!   matcher commits as it goes and never revisits a decision, which is
//!   what keeps it linear in the size of the document.
//! - **A map is matched by picking, not by permuting.** §3.5.3: "For each
//!   candidate name/value pair that the PEG algorithm would try, a matching
//!   member is picked out of the entire map." The pick runs over the map in
//!   canonical order, so it is deterministic. §3.5.4's cut makes a key
//!   match lock in the pick, whereupon a value that does not match fails
//!   the whole map rather than leaving the member to a later entry.
//! - **The fragment is what makes the top level deterministic.** Every
//!   content key of an assigned theory is a literal unsigned integer, so
//!   each member of a document has at most one entry that can pick it and
//!   the pick order cannot matter (`design.md`,
//!   `judg:xchg:satisfaction-total`). The general matcher is implemented
//!   nonetheless, because the *type* at a content key is arbitrary CDDL.
//!
//! # Totality, and the one refusal
//!
//! Nothing here returns a `Result`. Every way satisfaction could fail to
//! compute was caught at `Theory::parse`, and the judgment itself is a
//! verdict (`conv:xchg:rejection-is-a-verdict`). The single runtime
//! refusal the seam can raise — a `.regexp` match that exhausts the
//! operation budget — is rendered as a [`Mismatch`] of its own kind,
//! naming the budget and the pattern: never a panic, and never a silent
//! `false` (`dec:xchg:regexp-engine`).
//!
//! An exhausted budget under a content key makes that key a mismatch
//! whether or not some later alternative matched. PEG locks in the first
//! alternative that succeeds, so an alternative whose answer is unknown
//! makes the whole choice unknown, and an unknown is reported rather than
//! guessed.
//!
//! # Two bounds the reader should know
//!
//! A rule that references itself without consuming anything — `a = b`,
//! `b = a` — denotes no value, and is answered `false` on the visited set
//! this module keeps rather than by recursing forever. A rule that
//! references itself *through* a value — `a = [* a]` — recurses to the
//! nesting depth of the document, exactly as the derived `Clone`,
//! `PartialEq`, and `Hash` of [`Value`] already do
//! (`impl:xchg:iterative-teardown`), and shares their audit-phase
//! attention.

use std::collections::BTreeMap;

use super::ast::{
    Cddl, GenericArgs, Group, GroupEntry, GroupEntryKind, MemberKey, MemberKeyKind, Name,
    OccurKind, Operator, RuleBody, Type, Type1, Type2, Type2Kind, Uint, Value as Literal,
    ValueKind, unescape_text,
};
use super::lex::ByteQual;
use super::resolve::RuleTable;
use super::{OpenTheory, Theory, control, fragment, print};
use crate::regexp::XsdPattern;
use crate::value::{Float, FloatWidth, Value};
use crate::{ContentKey, Document};

/// The outcome of `d ⊨ S`. Structural only: it inspects the shape and the
/// values of `d` against `S` and nothing else.
///
/// A negative outcome is a verdict and not an error — the document was
/// exactly the kind of thing the judgment takes, and the answer is no
/// (`design.md`, `crit:xchg:error-or-verdict`).
///
/// ```
/// use cogra_interchange::{satisfies_global, Content, Document, Envelope, NamespaceLabel, Version};
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
/// assert!(satisfies_global(&document).holds());
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Satisfaction {
    /// The document satisfies the theory.
    Holds,
    /// It does not, and here is every way it failed, in ascending key
    /// order.
    Fails(Vec<Mismatch>),
}

impl Satisfaction {
    /// Whether the judgment is positive.
    ///
    /// ```
    /// use cogra_interchange::Satisfaction;
    ///
    /// assert!(Satisfaction::Holds.holds());
    /// assert!(!Satisfaction::Fails(Vec::new()).holds());
    /// ```
    pub fn holds(&self) -> bool {
        matches!(self, Satisfaction::Holds)
    }
}

/// Which kind of failure a [`Mismatch`] reports.
///
/// ```
/// use cogra_interchange::MismatchKind;
///
/// assert_eq!(MismatchKind::Unsatisfied, MismatchKind::Unsatisfied);
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum MismatchKind {
    /// The document does not answer to the theory at this position: a value
    /// outside its type, a required key absent, a key the theory does not
    /// enumerate.
    Unsatisfied,
    /// A `.regexp` match ran out of the seam's operation budget, so what
    /// the pattern would have answered is unknown.
    ///
    /// The budget counts matching operations and never time, so this
    /// outcome is the same on every machine (`dec:xchg:regexp-engine`).
    BudgetExhausted {
        /// The budget that was in force.
        budget: usize,
    },
}

/// One way a document failed a theory, located by content key where the
/// failure has one.
///
/// Keys 0 and 1 belong to the envelope and are no content keys, so
/// [`Mismatch::key`] is `None` for a failure at either; [`Mismatch::at`]
/// names the position in every case.
///
/// ```
/// use cogra_interchange::{
///     satisfies, Content, ContentKey, Document, Envelope, NamespaceLabel, Satisfaction, Theory,
///     Value, Version,
/// };
///
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let mut content = Content::new();
/// content.insert(ContentKey::new(2).expect("a content key"), Value::Unsigned(7));
/// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), content);
///
/// let Satisfaction::Fails(mismatches) = satisfies(&document, &theory) else {
///     panic!("a uint is no tstr")
/// };
/// assert_eq!(mismatches[0].key().map(|key| key.get()), Some(2));
/// assert_eq!(mismatches[0].expected(), "tstr");
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub struct Mismatch {
    key: Option<ContentKey>,
    at: Box<str>,
    expected: Box<str>,
    found: Box<str>,
    kind: MismatchKind,
}

impl Mismatch {
    /// The content key the failure concerns, where it concerns one.
    ///
    /// ```
    /// use cogra_interchange::{
    ///     satisfies_global, Content, Document, Envelope, NamespaceLabel, Satisfaction, Version,
    /// };
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
    /// assert!(matches!(satisfies_global(&document), Satisfaction::Holds));
    /// ```
    pub fn key(&self) -> Option<ContentKey> {
        self.key
    }

    /// Where the failure stands, as a phrase: `key 3`, or `the document`.
    ///
    /// ```
    /// use cogra_interchange::{satisfies, Content, Document, Envelope, NamespaceLabel, Satisfaction, Theory, Version};
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.other", 1 => [1, 0, uint]}"#)
    ///     .expect("an assignable theory");
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
    ///
    /// let Satisfaction::Fails(mismatches) = satisfies(&document, &theory) else {
    ///     panic!("the label is pinned to another")
    /// };
    /// assert_eq!(mismatches[0].at(), "key 0");
    /// ```
    pub fn at(&self) -> &str {
        &self.at
    }

    /// The type the theory writes at that position, as the normalized
    /// printer renders it.
    ///
    /// Normalized rather than quoted from the source, because a companion's
    /// wildcard was never written in any source
    /// (`design.md`, `dec:xchg:public-printer`).
    ///
    /// ```
    /// use cogra_interchange::{satisfies, Content, ContentKey, Document, Envelope, NamespaceLabel, Satisfaction, Theory, Value, Version};
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => uint / tstr}"#)
    ///     .expect("an assignable theory");
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let mut content = Content::new();
    /// content.insert(ContentKey::new(2).expect("a content key"), Value::Null);
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), content);
    ///
    /// let Satisfaction::Fails(mismatches) = satisfies(&document, &theory) else {
    ///     panic!("null is neither")
    /// };
    /// assert_eq!(mismatches[0].expected(), "uint / tstr");
    /// ```
    pub fn expected(&self) -> &str {
        &self.expected
    }

    /// What stood there, rendered for a diagnostic.
    ///
    /// ```
    /// use cogra_interchange::{satisfies, Content, ContentKey, Document, Envelope, NamespaceLabel, Satisfaction, Theory, Value, Version};
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
    ///     .expect("an assignable theory");
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let mut content = Content::new();
    /// content.insert(ContentKey::new(2).expect("a content key"), Value::Unsigned(7));
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), content);
    ///
    /// let Satisfaction::Fails(mismatches) = satisfies(&document, &theory) else {
    ///     panic!("a uint is no tstr")
    /// };
    /// assert_eq!(mismatches[0].found(), "the unsigned integer 7");
    /// ```
    pub fn found(&self) -> &str {
        &self.found
    }

    /// Which kind of failure this is.
    ///
    /// ```
    /// use cogra_interchange::{satisfies, Content, Document, Envelope, MismatchKind, NamespaceLabel, Satisfaction, Theory, Version};
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.other", 1 => [1, 0, uint]}"#)
    ///     .expect("an assignable theory");
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
    ///
    /// let Satisfaction::Fails(mismatches) = satisfies(&document, &theory) else {
    ///     panic!("the label is pinned to another")
    /// };
    /// assert_eq!(mismatches[0].kind(), MismatchKind::Unsatisfied);
    /// ```
    pub fn kind(&self) -> MismatchKind {
        self.kind
    }

    fn new(key: u64, at: String, expected: String, found: String, kind: MismatchKind) -> Mismatch {
        Mismatch {
            key: ContentKey::new(key).ok(),
            at: at.into(),
            expected: expected.into(),
            found: found.into(),
            kind,
        }
    }

    /// A failure with no key of its own: the theory itself is unusable.
    fn whole(expected: String, found: String) -> Mismatch {
        Mismatch {
            key: None,
            at: "the document".into(),
            expected: expected.into(),
            found: found.into(),
            kind: MismatchKind::Unsatisfied,
        }
    }
}

/// Whether a document satisfies an assigned theory.
///
/// Total: a [`Theory`] exists only downstream of a successful
/// [`Theory::parse`], which compiled every pattern and refused every
/// operator this crate does not evaluate, so there is nothing left for the
/// judgment to fail *to compute* (`design.md`,
/// `judg:xchg:satisfaction-total`).
///
/// ```
/// use cogra_interchange::{
///     satisfies, Content, ContentKey, Document, Envelope, NamespaceLabel, Theory, Value, Version,
/// };
///
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 2, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let mut content = Content::new();
/// content.insert(
///     ContentKey::new(2).expect("a content key"),
///     Value::Text("hello".to_owned().into()),
/// );
///
/// let document = Document::new(Envelope::new(label.clone(), Version::new(1, 2, 9)), content);
/// assert!(satisfies(&document, &theory).holds());
///
/// // The minor is pinned, so a document stamped 1.3 is not this theory's.
/// let other = Document::new(Envelope::new(label, Version::new(1, 3, 0)), Content::new());
/// assert!(!satisfies(&other, &theory).holds());
/// ```
pub fn satisfies(d: &Document, s: &Theory) -> Satisfaction {
    judge(d, &s.cddl, &s.table, &s.patterns)
}

/// Whether a document satisfies an open companion — the tolerant judgment.
///
/// The companion frees the minor and admits unknown content keys, so a
/// document stamped above the reader's ceiling can still be judged against
/// the greatest theory the reader holds.
///
/// ```
/// use cogra_interchange::{
///     satisfies, satisfies_open, Content, ContentKey, Document, Envelope, NamespaceLabel, Theory,
///     Value, Version,
/// };
///
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 2, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let open = theory.open_companion();
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let mut content = Content::new();
/// content.insert(
///     ContentKey::new(2).expect("a content key"),
///     Value::Text("hello".to_owned().into()),
/// );
/// content.insert(ContentKey::new(9).expect("a content key"), Value::Bool(true));
/// let later = Document::new(Envelope::new(label, Version::new(1, 5, 0)), content);
///
/// // Stamped above the theory's minor, and carrying a key it never named.
/// assert!(!satisfies(&later, &theory).holds());
/// assert!(satisfies_open(&later, &open).holds());
/// ```
pub fn satisfies_open(d: &Document, s: &OpenTheory) -> Satisfaction {
    let (cddl, table, patterns) = s.parts();
    judge(d, cddl, table, patterns)
}

/// Whether a document satisfies the base theory.
///
/// Constitutionally prior: reached without dispatch, and satisfied by every
/// document before any assignment is consulted.
///
/// ```
/// use cogra_interchange::{
///     satisfies_global, Content, ContentKey, Document, Envelope, NamespaceLabel, Value, Version,
/// };
///
/// let label = NamespaceLabel::parse("com.example.thing").expect("a label");
/// let mut content = Content::new();
/// content.insert(ContentKey::new(4).expect("a content key"), Value::Null);
/// let document = Document::new(Envelope::new(label, Version::new(3, 1, 4)), content);
/// assert!(satisfies_global(&document).holds());
/// ```
pub fn satisfies_global(d: &Document) -> Satisfaction {
    match super::global().prepared.as_ref() {
        Some(prepared) => judge(d, &prepared.cddl, &prepared.table, &prepared.patterns),
        None => Satisfaction::Fails(vec![Mismatch::whole(
            "the base theory of the conventions".to_owned(),
            "a base theory this build could not parse".to_owned(),
        )]),
    }
}

/// The judgment, over any of the three instruments.
fn judge<'a>(
    d: &Document,
    cddl: &'a Cddl,
    table: &'a RuleTable,
    patterns: &'a BTreeMap<usize, XsdPattern>,
) -> Satisfaction {
    let value = d.to_value();
    let Value::Map(map) = &value else {
        // `Document::to_value` builds a map. The arm is written rather than
        // assumed away, because a total function has an answer everywhere.
        return Satisfaction::Fails(vec![Mismatch::whole("a map".to_owned(), render(&value))]);
    };
    let Some(group) = root_map(cddl) else {
        return Satisfaction::Fails(vec![Mismatch::whole(
            "a theory whose root rule is a map".to_owned(),
            "a root rule that is no map".to_owned(),
        )]);
    };

    let mut evaluator = Evaluator::new(table, patterns);
    let faults = evaluator.map_faults(map, group);
    if faults.is_empty() {
        Satisfaction::Holds
    } else {
        Satisfaction::Fails(faults.into_iter().map(Fault::into_mismatch).collect())
    }
}

/// The group of the root rule, where the root rule is one inline map.
fn root_map(cddl: &Cddl) -> Option<&Group> {
    let root = cddl.rules.first()?;
    let RuleBody::Type(ty) = &root.body else {
        return None;
    };
    let [only] = ty.choices.as_slice() else {
        return None;
    };
    if only.operation.is_some() {
        return None;
    }
    match &only.target.kind {
        Type2Kind::Map(group) => Some(group),
        _ => None,
    }
}

/// One failure of a map match, before it is located and worded.
#[derive(Clone, Debug)]
struct Fault {
    key: u64,
    expected: String,
    found: String,
    kind: MismatchKind,
}

impl Fault {
    fn into_mismatch(self) -> Mismatch {
        Mismatch::new(
            self.key,
            format!("key {}", self.key),
            self.expected,
            self.found,
            self.kind,
        )
    }
}

/// A match in progress: the resolved theory, the compiled patterns, and the
/// two pieces of state a match carries.
pub(crate) struct Evaluator<'a> {
    table: &'a RuleTable,
    patterns: &'a BTreeMap<usize, XsdPattern>,
    /// The first budget exhaustion since it was last taken, if any.
    exhausted: Option<Exhaustion>,
    /// The rule names entered since the last descent into a value: the
    /// guard against a rule that references itself without consuming
    /// anything.
    visiting: Vec<&'a str>,
    /// Generic parameter bindings, innermost last.
    scopes: Vec<Vec<(&'a str, &'a Type1)>>,
}

/// A `.regexp` match that ran out of budget: what it was matching against,
/// and how much it was given.
#[derive(Clone, Debug)]
pub(crate) struct Exhaustion {
    pattern: String,
    budget: usize,
}

impl<'a> Evaluator<'a> {
    fn new(table: &'a RuleTable, patterns: &'a BTreeMap<usize, XsdPattern>) -> Evaluator<'a> {
        Evaluator {
            table,
            patterns,
            exhausted: None,
            visiting: Vec::new(),
            scopes: Vec::new(),
        }
    }

    /// The compiled pattern of a `.regexp` operand, keyed by where the
    /// operand stands.
    ///
    /// Compiled at `Theory::parse` and looked up here; nothing in the
    /// evaluator compiles a pattern.
    pub(crate) fn pattern(&self, at: usize) -> Option<&'a XsdPattern> {
        self.patterns.get(&at)
    }

    /// Record a budget exhaustion. The first is kept: it is the one that
    /// happened, and the ones after it are consequences of continuing.
    pub(crate) fn exhaust(&mut self, pattern: &str, budget: usize) {
        if self.exhausted.is_none() {
            self.exhausted = Some(Exhaustion {
                pattern: pattern.to_owned(),
                budget,
            });
        }
    }

    // -- maps ------------------------------------------------------------

    /// Match a map against a group, reporting every way it failed.
    ///
    /// The group choices are tried in order and the first that consumes the
    /// whole map wins (PEG); where none does, the faults reported are the
    /// first choice's, which for a theory of the assignable fragment is the
    /// only choice there is.
    fn map_faults(&mut self, map: &crate::value::Map, group: &'a Group) -> Vec<Fault> {
        let mut first: Option<Vec<Fault>> = None;
        for choice in &group.choices {
            let mut consumed = vec![false; map.len()];
            let mut faults = Vec::new();
            self.map_entries(&choice.entries, map, &mut consumed, &mut faults);
            self.report_leftovers(map, &consumed, &choice.entries, &mut faults);
            if faults.is_empty() {
                return Vec::new();
            }
            if first.is_none() {
                faults.sort_by_key(|fault| fault.key);
                first = Some(faults);
            }
        }
        first.unwrap_or_default()
    }

    /// Whether a map matches a group at all — the nested question, which
    /// wants no diagnostics.
    fn map_matches(&mut self, map: &crate::value::Map, group: &'a Group) -> bool {
        self.map_faults(map, group).is_empty()
    }

    /// Every entry of one group choice, in order.
    fn map_entries(
        &mut self,
        entries: &'a [GroupEntry],
        map: &crate::value::Map,
        consumed: &mut [bool],
        faults: &mut Vec<Fault>,
    ) {
        for entry in entries {
            let (min, max) = bounds(entry);
            let mut count = 0u64;
            while count < max {
                match self.map_once(entry, map, consumed, faults) {
                    Some(0) => {
                        // A repetition that consumed nothing can be
                        // repeated any number of times, so the lower bound
                        // is met vacuously.
                        count = count.max(min);
                        break;
                    }
                    Some(_) => count += 1,
                    None => break,
                }
            }
            if count < min {
                // An entry that must occur and did not is a failure of the
                // whole group, whatever entries follow it — a later
                // wildcard picking the member up does not rescue it. That
                // is why the extensibility idiom of §3.5.4 writes its
                // enumerated key optional.
                let fault = match self.unconsumed_under(entry, map, consumed) {
                    Some(index) => {
                        let (member_key, member_value) = &map.entries()[index];
                        // The member is marked taken so the leftover pass
                        // does not report the same failure twice. The
                        // verdict is settled either way: a fault stands.
                        consumed[index] = true;
                        Fault {
                            key: key_number(member_key),
                            expected: self.entry_description(entry).1,
                            found: render(member_value),
                            kind: MismatchKind::Unsatisfied,
                        }
                    }
                    None => {
                        let (key, expected) = self.entry_description(entry);
                        Fault {
                            key,
                            expected,
                            found: "nothing: the key is absent".to_owned(),
                            kind: MismatchKind::Unsatisfied,
                        }
                    }
                };
                faults.push(fault);
            }
        }
    }

    /// A member the entry did not take whose *key* the entry would have
    /// taken: the key is there and its value is not in the type.
    fn unconsumed_under(
        &mut self,
        entry: &'a GroupEntry,
        map: &crate::value::Map,
        consumed: &[bool],
    ) -> Option<usize> {
        let GroupEntryKind::Member { key: Some(key), .. } = &entry.kind else {
            return None;
        };
        for (index, (member_key, _)) in map.entries().iter().enumerate() {
            if !consumed[index] && self.match_member_key(member_key, key) {
                return Some(index);
            }
        }
        None
    }

    /// One repetition of one entry against the map.
    ///
    /// `None` where the entry did not match, `Some(n)` where it matched and
    /// consumed `n` members.
    fn map_once(
        &mut self,
        entry: &'a GroupEntry,
        map: &crate::value::Map,
        consumed: &mut [bool],
        faults: &mut Vec<Fault>,
    ) -> Option<usize> {
        match &entry.kind {
            GroupEntryKind::Member {
                key: Some(key),
                value,
            } => self.map_member(key, value, map, consumed, faults),
            // "If the memberkey is not given, the entry can only be used for
            // matching arrays, not for maps" — except where the type is a
            // group, which is the socket idiom `* $$extension`.
            GroupEntryKind::Member { key: None, value } => {
                let group = self.spliced(value)?;
                self.map_group(group, map, consumed)
            }
            GroupEntryKind::Inline(group) => self.map_group(group, map, consumed),
        }
    }

    /// One repetition of a group spliced into a map: the first choice that
    /// takes its members whole, and how many it took.
    ///
    /// A choice that fails leaves the map as it found it. Members it had
    /// already taken are given back, so the next choice sees the state the
    /// first one started from — a prioritized choice picks *between*
    /// alternatives, and a half-applied one is neither.
    fn map_group(
        &mut self,
        group: &'a Group,
        map: &crate::value::Map,
        consumed: &mut [bool],
    ) -> Option<usize> {
        for choice in &group.choices {
            let before: Vec<bool> = consumed.to_vec();
            let taken = count(consumed);
            let mut faults = Vec::new();
            self.map_entries(&choice.entries, map, consumed, &mut faults);
            if faults.is_empty() {
                return Some(count(consumed) - taken);
            }
            consumed.copy_from_slice(&before);
        }
        None
    }

    /// One keyed member: pick the first unconsumed member of the map whose
    /// key matches, and whose value matches unless a cut locked the pick in.
    fn map_member(
        &mut self,
        key: &'a MemberKey,
        value: &'a Type,
        map: &crate::value::Map,
        consumed: &mut [bool],
        faults: &mut Vec<Fault>,
    ) -> Option<usize> {
        for (index, (member_key, member_value)) in map.entries().iter().enumerate() {
            if consumed[index] || !self.match_member_key(member_key, key) {
                continue;
            }
            self.exhausted = None;
            let matched = self.match_inner(member_value, value);
            let exhausted = self.exhausted.take();
            if let Some(exhaustion) = exhausted {
                consumed[index] = true;
                faults.push(budget_fault(member_key, member_value, &exhaustion));
                return Some(1);
            }
            if matched {
                consumed[index] = true;
                return Some(1);
            }
            if cut_of(key) {
                // §3.5.4: the pick is locked in by the key alone, so a
                // value that does not match fails the whole map.
                consumed[index] = true;
                faults.push(Fault {
                    key: key_number(member_key),
                    expected: printed_type(value),
                    found: render(member_value),
                    kind: MismatchKind::Unsatisfied,
                });
                return Some(1);
            }
        }
        None
    }

    /// Every member no entry picked: the map is not closed over them.
    ///
    /// The verdict is already settled when this runs; what it adds is the
    /// wording. A member whose *key* an entry would have taken is reported
    /// against that entry's type, which is the diagnostic a reader wants —
    /// the alternative, "no entry admits key 2", says nothing about the
    /// `tstr` that was expected there.
    fn report_leftovers(
        &mut self,
        map: &crate::value::Map,
        consumed: &[bool],
        entries: &'a [GroupEntry],
        faults: &mut Vec<Fault>,
    ) {
        for (index, (member_key, member_value)) in map.entries().iter().enumerate() {
            if consumed[index] {
                continue;
            }
            match self.entry_for_key(entries, member_key) {
                Some(value) => faults.push(Fault {
                    key: key_number(member_key),
                    expected: printed_type(value),
                    found: render(member_value),
                    kind: MismatchKind::Unsatisfied,
                }),
                None => faults.push(Fault {
                    key: key_number(member_key),
                    expected: "no key: the theory does not enumerate it".to_owned(),
                    found: render(member_value),
                    kind: MismatchKind::Unsatisfied,
                }),
            }
        }
    }

    /// The value type of the first entry whose member key admits this key.
    fn entry_for_key(&mut self, entries: &'a [GroupEntry], member_key: &Value) -> Option<&'a Type> {
        for entry in entries {
            if let GroupEntryKind::Member {
                key: Some(key),
                value,
            } = &entry.kind
                && self.match_member_key(member_key, key)
            {
                return Some(value);
            }
        }
        None
    }

    /// Whether a map key matches a member key.
    fn match_member_key(&mut self, key: &Value, member: &'a MemberKey) -> bool {
        match &member.kind {
            MemberKeyKind::Type { key: typed, .. } => self.match_type1(key, typed),
            MemberKeyKind::Bareword(name) => match key {
                Value::Text(text) => text.as_str() == name.text,
                _ => false,
            },
            MemberKeyKind::Value(literal) => self.match_literal(key, literal),
        }
    }

    /// The key an entry pins and the type it writes, for the "absent"
    /// diagnostic.
    fn entry_description(&self, entry: &'a GroupEntry) -> (u64, String) {
        match &entry.kind {
            GroupEntryKind::Member {
                key: Some(key),
                value,
            } => (
                fragment::entry_key(entry).unwrap_or_default(),
                match &key.kind {
                    MemberKeyKind::Bareword(name) => {
                        format!("{}: {}", name.text, printed_type(value))
                    }
                    _ => printed_type(value),
                },
            ),
            _ => (0, printed_entry(entry)),
        }
    }

    // -- arrays ----------------------------------------------------------

    /// Whether an array matches a group: the group must consume it whole.
    fn match_array(&mut self, values: &[Value], group: &'a Group) -> bool {
        self.array_group(values, 0, group) == Some(values.len())
    }

    /// PEG prioritized choice: the first alternative that matches locks in.
    fn array_group(&mut self, values: &[Value], pos: usize, group: &'a Group) -> Option<usize> {
        for choice in &group.choices {
            if let Some(end) = self.array_entries(values, pos, &choice.entries) {
                return Some(end);
            }
        }
        None
    }

    /// The entries of one choice, left to right, each greedy.
    fn array_entries(
        &mut self,
        values: &[Value],
        mut pos: usize,
        entries: &'a [GroupEntry],
    ) -> Option<usize> {
        for entry in entries {
            let (min, max) = bounds(entry);
            let mut count = 0u64;
            while count < max {
                match self.array_once(values, pos, entry) {
                    Some(end) if end > pos => {
                        pos = end;
                        count += 1;
                    }
                    Some(_) => {
                        count = count.max(min);
                        break;
                    }
                    None => break,
                }
            }
            if count < min {
                return None;
            }
        }
        Some(pos)
    }

    /// One repetition of one entry against the array from `pos`.
    fn array_once(&mut self, values: &[Value], pos: usize, entry: &'a GroupEntry) -> Option<usize> {
        match &entry.kind {
            GroupEntryKind::Member { value, .. } => {
                // "the elements of which -- when taken as values and
                // complemented by a wildcard key each -- match the group":
                // a member key in an array is documentary.
                if let Some(group) = self.spliced(value) {
                    return self.array_group(values, pos, group);
                }
                let item = values.get(pos)?;
                self.match_inner(item, value).then_some(pos + 1)
            }
            GroupEntryKind::Inline(group) => self.array_group(values, pos, group),
        }
    }

    /// The group a bare entry splices in: a group rule, or an unwrapped map
    /// or array.
    fn spliced(&self, ty: &'a Type) -> Option<&'a Group> {
        let target = single(ty)?;
        let (name, args) = match &target.kind {
            Type2Kind::Typename { name, args } => (name, args),
            Type2Kind::Unwrap { name, args } => (name, args),
            _ => return None,
        };
        if args.is_some() {
            return None;
        }
        let rule = self.table.get(&name.text)?;
        match (&target.kind, rule.body()) {
            (Type2Kind::Typename { .. }, RuleBody::Group(entry)) => match &entry.kind {
                GroupEntryKind::Inline(group) if entry.occur.is_none() => Some(group),
                _ => None,
            },
            (Type2Kind::Unwrap { .. }, RuleBody::Type(ty)) => match &single(ty)?.kind {
                Type2Kind::Map(group) | Type2Kind::Array(group) => Some(group),
                _ => None,
            },
            _ => None,
        }
    }

    // -- types -----------------------------------------------------------

    /// Descend into a value strictly smaller than the one in hand, with the
    /// visited set cleared: a rule may legitimately re-enter itself under a
    /// value it consumed.
    fn match_inner(&mut self, value: &Value, ty: &'a Type) -> bool {
        let saved = std::mem::take(&mut self.visiting);
        let matched = self.match_type(value, ty);
        self.visiting = saved;
        matched
    }

    /// A type choice matches where any alternative does.
    ///
    /// PEG's prioritized choice and this agree here, and only here: a type
    /// consumes exactly one data item, so no alternative can commit the
    /// match to a shorter consumption that a later entry then fails on.
    pub(crate) fn match_type(&mut self, value: &Value, ty: &'a Type) -> bool {
        let mut matched = false;
        for choice in &ty.choices {
            if self.match_type1(value, choice) {
                matched = true;
                break;
            }
        }
        matched
    }

    /// One alternative, with its range or control operator where it has one.
    fn match_type1(&mut self, value: &Value, ty: &'a Type1) -> bool {
        let Some(operation) = &ty.operation else {
            return self.match_type2(value, &ty.target);
        };
        match &operation.operator {
            Operator::RangeInclusive => {
                self.match_range(value, &ty.target, &operation.operand, true)
            }
            Operator::RangeExclusive => {
                self.match_range(value, &ty.target, &operation.operand, false)
            }
            Operator::Control(name) => control::apply(self, value, &ty.target, name, operation),
        }
    }

    /// One `type2`: the ten alternatives of the grammar.
    pub(crate) fn match_type2(&mut self, value: &Value, ty: &'a Type2) -> bool {
        match &ty.kind {
            Type2Kind::Value(literal) => self.match_literal(value, literal),
            Type2Kind::Typename { name, args } => self.match_name(value, name, args.as_ref()),
            Type2Kind::Parenthesized(inner) => self.match_type(value, inner),
            Type2Kind::Map(group) => match value {
                Value::Map(map) => self.map_matches(map, group),
                _ => false,
            },
            Type2Kind::Array(group) => match value {
                Value::Array(array) => self.match_array(array.as_slice(), group),
                _ => false,
            },
            Type2Kind::Unwrap { name, args } => self.match_unwrap(value, name, args.as_ref()),
            Type2Kind::EnumInline(group) => self.match_enumeration(value, group),
            Type2Kind::EnumGroup { name, args } => {
                if args.is_some() {
                    return false;
                }
                let Some(rule) = self.table.get(&name.text) else {
                    return false;
                };
                match rule.body() {
                    RuleBody::Group(entry) => match &entry.kind {
                        GroupEntryKind::Inline(group) => self.match_enumeration(value, group),
                        GroupEntryKind::Member { value: inner, .. } => {
                            self.match_type(value, inner)
                        }
                    },
                    RuleBody::Type(_) => false,
                }
            }
            Type2Kind::Tagged { number, inner } => match value {
                Value::Tag(tag) => {
                    let admitted = match number {
                        Some(uint) => fragment::uint_text(&uint.text) == Some(tag.number()),
                        None => true,
                    };
                    admitted && self.match_inner(tag.item(), inner)
                }
                _ => false,
            },
            Type2Kind::Representation { major, ai } => representation(value, *major, ai.as_ref()),
            Type2Kind::Any => true,
        }
    }

    /// A reference to a rule, a generic parameter, or a socket.
    fn match_name(&mut self, value: &Value, name: &'a Name, args: Option<&'a GenericArgs>) -> bool {
        if let Some(bound) = self.binding(&name.text) {
            // The argument was written at the call site, so it is evaluated
            // in the scope the call site stood in and not in this rule's.
            let Some(frame) = self.scopes.pop() else {
                return false;
            };
            let matched = self.match_type1(value, bound);
            self.scopes.push(frame);
            return matched;
        }

        // An undefined socket is the empty choice (RFC 8610 §3.9): nothing
        // matches it, and that is an answer rather than a failure.
        let Some(rule) = self.table.get(&name.text) else {
            return false;
        };
        if self.visiting.contains(&name.text.as_str()) {
            // A rule that reaches itself without consuming anything denotes
            // no value.
            return false;
        }

        let given = args.map(|args| args.args.len()).unwrap_or(0);
        if rule.params().len() != given {
            return false;
        }
        let frame: Vec<(&'a str, &'a Type1)> = match args {
            Some(args) => rule
                .params()
                .iter()
                .map(String::as_str)
                .zip(args.args.iter())
                .collect(),
            None => Vec::new(),
        };

        self.visiting.push(&name.text);
        self.scopes.push(frame);
        let matched = match rule.body() {
            RuleBody::Type(ty) => self.match_type(value, ty),
            // A group is not a type, so nothing of the data language
            // answers to it in this position.
            RuleBody::Group(_) => false,
        };
        self.scopes.pop();
        self.visiting.pop();
        matched
    }

    /// What a generic parameter is bound to in the innermost scope.
    fn binding(&self, name: &str) -> Option<&'a Type1> {
        self.scopes
            .last()?
            .iter()
            .rev()
            .find(|(bound, _)| *bound == name)
            .map(|(_, ty)| *ty)
    }

    /// `~name` in a type position: the type inside a tag.
    ///
    /// Unwrapping a map or an array yields a *group*, which is no type; it
    /// reaches the matcher as a spliced entry instead.
    fn match_unwrap(
        &mut self,
        value: &Value,
        name: &'a Name,
        args: Option<&'a GenericArgs>,
    ) -> bool {
        if args.is_some() {
            return false;
        }
        let Some(rule) = self.table.get(&name.text) else {
            return false;
        };
        let RuleBody::Type(ty) = rule.body() else {
            return false;
        };
        let Some(target) = single(ty) else {
            return false;
        };
        match &target.kind {
            Type2Kind::Tagged { inner, .. } => self.match_type(value, inner),
            _ => false,
        }
    }

    /// `&(group)`: "any value that is within the set of values that the
    /// values of the group given can take".
    fn match_enumeration(&mut self, value: &Value, group: &'a Group) -> bool {
        for choice in &group.choices {
            for entry in &choice.entries {
                let admitted = match &entry.kind {
                    GroupEntryKind::Member { value: ty, .. } => match self.spliced(ty) {
                        Some(inner) => self.match_enumeration(value, inner),
                        None => self.match_type(value, ty),
                    },
                    GroupEntryKind::Inline(inner) => self.match_enumeration(value, inner),
                };
                if admitted {
                    return true;
                }
            }
        }
        false
    }

    /// A literal: "matches only a data item with that specific value (no
    /// conversions defined)".
    fn match_literal(&mut self, value: &Value, literal: &'a Literal) -> bool {
        match &literal.kind {
            ValueKind::Text(raw) => match value {
                Value::Text(text) => {
                    unescape_text(raw, literal.span).is_ok_and(|denoted| denoted == text.as_str())
                }
                _ => false,
            },
            ValueKind::Bytes { qual, raw } => match value {
                Value::Bytes(bytes) => byte_literal(*qual, raw, literal)
                    .is_some_and(|denoted| denoted == bytes.as_slice()),
                _ => false,
            },
            ValueKind::Number(number) => match control::number_literal(number) {
                Some(control::Num::Int(n)) => match value {
                    Value::Unsigned(u) => i128::from(*u) == n,
                    Value::Negative(negative) => negative.get() == n,
                    _ => false,
                },
                Some(control::Num::Float(f)) => match value {
                    Value::Float(float) => Float::from_f64(f).ok() == Some(*float),
                    _ => false,
                },
                None => false,
            },
        }
    }

    /// A range: "matches any value that is between the two values", the
    /// upper bound included for `..` and excluded for `...`.
    fn match_range(
        &mut self,
        value: &Value,
        low: &'a Type2,
        high: &'a Type2,
        inclusive: bool,
    ) -> bool {
        let (Some(low), Some(high)) = (self.bound(low), self.bound(high)) else {
            return false;
        };
        match (low, high) {
            (control::Num::Int(low), control::Num::Int(high)) => {
                let Some(here) = control::integer_of(value) else {
                    return false;
                };
                low <= here && (here < high || (inclusive && here == high))
            }
            (control::Num::Float(low), control::Num::Float(high)) => {
                let Value::Float(float) = value else {
                    return false;
                };
                let here = float.to_f64();
                low <= here && (here < high || (inclusive && here == high))
            }
            // "CDDL currently only allows ranges between integers ... or
            // between floating-point values"; `0..10.0` is NOT DEFINED, and
            // an undefined range admits nothing.
            _ => false,
        }
    }

    /// The number an endpoint stands for, through rule references and
    /// parentheses.
    pub(crate) fn bound(&self, ty: &'a Type2) -> Option<control::Num> {
        self.bound_within(ty, REFERENCE_DEPTH)
    }

    fn bound_within(&self, ty: &'a Type2, depth: usize) -> Option<control::Num> {
        if depth == 0 {
            return None;
        }
        match &ty.kind {
            Type2Kind::Value(literal) => match &literal.kind {
                ValueKind::Number(number) => control::number_literal(number),
                _ => None,
            },
            Type2Kind::Parenthesized(inner) => self.bound_within(single(inner)?, depth - 1),
            Type2Kind::Typename { name, args: None } => match self.table.get(&name.text)?.body() {
                RuleBody::Type(inner) => self.bound_within(single(inner)?, depth - 1),
                RuleBody::Group(_) => None,
            },
            _ => None,
        }
    }
}

/// How far a range endpoint or a control value is followed through rule
/// references before the search for a literal gives up.
const REFERENCE_DEPTH: usize = 16;

/// The occurrence bounds of an entry: `1*1` where none was written.
fn bounds(entry: &GroupEntry) -> (u64, u64) {
    match entry.occur.as_ref().map(|occur| &occur.kind) {
        None => (1, 1),
        Some(OccurKind::Optional) => (0, 1),
        Some(OccurKind::OneOrMore) => (1, u64::MAX),
        Some(OccurKind::Bounded { min, max }) => (
            min.as_ref()
                .and_then(|uint| fragment::uint_text(&uint.text))
                .unwrap_or(0),
            max.as_ref()
                .and_then(|uint| fragment::uint_text(&uint.text))
                .unwrap_or(u64::MAX),
        ),
    }
}

/// Whether a member key carries a cut, written or implied by the colon.
fn cut_of(key: &MemberKey) -> bool {
    match &key.kind {
        MemberKeyKind::Type { cut, .. } => *cut,
        // "the ':' shortcut is actually defined to include the cut
        // semantics".
        MemberKeyKind::Bareword(_) | MemberKeyKind::Value(_) => true,
    }
}

/// The one `type2` a type carries, where it is neither a choice nor an
/// operation.
fn single(ty: &Type) -> Option<&Type2> {
    match ty.choices.as_slice() {
        [only] if only.operation.is_none() => Some(&only.target),
        _ => None,
    }
}

fn count(consumed: &[bool]) -> usize {
    consumed.iter().filter(|taken| **taken).count()
}

/// A map key as a number, for locating a fault. Every key of a document is
/// an unsigned integer, so the fallback is unreachable there.
fn key_number(key: &Value) -> u64 {
    match key {
        Value::Unsigned(key) => *key,
        _ => 0,
    }
}

fn budget_fault(key: &Value, value: &Value, exhaustion: &Exhaustion) -> Fault {
    Fault {
        key: key_number(key),
        expected: format!("a text string matching {:?}", exhaustion.pattern),
        found: format!(
            "{}, which the pattern {:?} could not be matched against within the budget",
            render(value),
            exhaustion.pattern
        ),
        kind: MismatchKind::BudgetExhausted {
            budget: exhaustion.budget,
        },
    }
}

/// A representation type: a major type, optionally with its additional
/// information.
///
/// Major type 7 is read at the data-model level, as §2.2.3 requires:
/// "`#7.25` specifies the set of values that can be represented as
/// half-precision floats; it does not mandate that these values also do
/// have to be serialized as half-precision floats". A value representable
/// in binary16 is representable in binary32 and binary64 too, so `#7.26`
/// admits it and so does `#7.27`. Every other major type fixes its
/// additional information from the value's canonical name, where the two
/// readings coincide.
fn representation(value: &Value, major: u8, ai: Option<&Uint>) -> bool {
    let (initial, _) = value.canonical_head();
    if initial >> 5 != major {
        return false;
    }
    let Some(ai) = ai else {
        return true;
    };
    let Some(want) = fragment::uint_text(&ai.text) else {
        return false;
    };
    if major != 7 {
        return u64::from(initial & 0x1f) == want;
    }
    match (value, want) {
        (Value::Bool(false), 20) => true,
        (Value::Bool(true), 21) => true,
        (Value::Null, 22) => true,
        (Value::Simple(simple), 23) => simple.get() == 23,
        (Value::Simple(simple), want) if want < 20 => u64::from(simple.get()) == want,
        // Simple values 32 through 255 are the ones spelled with the
        // additional information 24.
        (Value::Simple(simple), 24) => simple.get() >= 32,
        (Value::Float(float), 25) => float.width() == FloatWidth::Half,
        (Value::Float(float), 26) => float.width() <= FloatWidth::Single,
        (Value::Float(_), 27) => true,
        _ => false,
    }
}

/// The bytes a byte-string literal denotes.
fn byte_literal(qual: ByteQual, raw: &str, literal: &Literal) -> Option<Vec<u8>> {
    let denoted = unescape_text(raw, literal.span).ok()?;
    match qual {
        ByteQual::None => Some(denoted.into_bytes()),
        ByteQual::Hex => {
            let digits: Vec<u8> = denoted
                .bytes()
                .filter(|byte| !byte.is_ascii_whitespace())
                .collect();
            if !digits.len().is_multiple_of(2) {
                return None;
            }
            digits
                .chunks(2)
                .map(|pair| {
                    let high = char::from(pair[0]).to_digit(16)?;
                    let low = char::from(pair[1]).to_digit(16)?;
                    Some((high * 16 + low) as u8)
                })
                .collect()
        }
        ByteQual::Base64 => base64(&denoted),
    }
}

/// Base 64, both alphabets, padding optional — RFC 8610's `b64'...'`.
fn base64(text: &str) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut accumulator = 0u32;
    let mut bits = 0u32;
    for character in text.chars() {
        if character == '=' || character.is_ascii_whitespace() {
            continue;
        }
        let sextet = match character {
            'A'..='Z' => character as u32 - 'A' as u32,
            'a'..='z' => character as u32 - 'a' as u32 + 26,
            '0'..='9' => character as u32 - '0' as u32 + 52,
            '+' | '-' => 62,
            '/' | '_' => 63,
            _ => return None,
        };
        accumulator = (accumulator << 6) | sextet;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((accumulator >> bits) as u8);
        }
    }
    Some(out)
}

/// A type as the normalized printer renders it.
fn printed_type(ty: &Type) -> String {
    let mut out = String::new();
    print::print_type(ty, &mut out);
    out
}

fn printed_entry(entry: &GroupEntry) -> String {
    let mut out = String::new();
    print::print_group_entry(entry, &mut out);
    out
}

/// What stood at a position, in a phrase a diagnostic can carry.
fn render(value: &Value) -> String {
    match value {
        Value::Unsigned(n) => format!("the unsigned integer {n}"),
        Value::Negative(n) => format!("the negative integer {}", n.get()),
        Value::Bytes(bytes) => format!("a byte string of {} bytes", bytes.as_slice().len()),
        Value::Text(text) => format!("the text string {:?}", text.as_str()),
        Value::Array(array) => format!("an array of {} elements", array.len()),
        Value::Map(map) => format!("a map of {} entries", map.len()),
        Value::Tag(tag) => format!("a data item tagged {}", tag.number()),
        Value::Bool(boolean) => format!("the boolean {boolean}"),
        Value::Null => "null".to_owned(),
        Value::Simple(simple) => format!("the simple value {}", simple.get()),
        Value::Float(float) => format!("the floating-point value {}", float.to_f64()),
    }
}
