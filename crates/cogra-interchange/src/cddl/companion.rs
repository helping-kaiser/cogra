//! The open companion: an assigned theory with two relaxations and a cut.
//!
//! For an assigned theory S, Open(S) is S with the minor position of key 1
//! freed to `uint`, the closure replaced by the base theory's wildcard
//! `* (uint .gt 1) => any`, and each enumerated content key matched with a
//! cut, so a present-but-mistyped known key fails rather than falling
//! through to the wildcard. Nothing else moves: every content key S names
//! keeps its type and its requiredness
//! (´alg:xchg:companion´).
//!
//! # Why the rewrite is a tree rewrite
//!
//! The derivation runs over the already-parsed tree rather than over the
//! source text, which is what makes "nothing else moves" *checkable*: both
//! theories go through the same normalized printer, and the difference
//! between the two printed forms is the whole of what the derivation did.
//! An edit of the source string would be a second, unchecked definition of
//! the same rewrite. The obligation that the difference is exactly the
//! freed minor, the added wildcard, and one cut per enumerated key is
//! discharged in `tests/companion.rs`, which diffs the two printed forms
//! and reads the hunks.
//!
//! # Totality
//!
//! [`Theory::open_companion`] returns an [`OpenTheory`] and never a
//! `Result`: the theory it rewrites is in the assignable fragment, so key 1
//! is pinned to a three-element array and the root is one closed map — the
//! two shapes the rewrite reaches for. The rewrite is nevertheless written
//! to leave the tree as it stands where a shape does not match, because a
//! total function has to have an answer everywhere; a `Theory` cannot take
//! that path.

use std::collections::BTreeMap;

use super::ast::{
    Cddl, GroupEntry, GroupEntryKind, MemberKey, MemberKeyKind, Name, Occur, OccurKind, Operation,
    Operator, RuleBody, Type, Type1, Type2, Type2Kind, Value, ValueKind,
};
use super::lex::{NumberToken, Span};
use super::resolve::RuleTable;
use super::{Theory, fragment, print};
use crate::NamespaceLabel;
use crate::regexp::XsdPattern;

/// The open companion of an assigned theory: the minor position freed to
/// `uint`, the closure replaced by the base theory's wildcard, each
/// enumerated content key cut, nothing else moved.
///
/// Derived, never assigned. That this is a type distinct from
/// [`Theory`] is how the crate carries "Open(S) is derived, never assigned
/// — it enters no registry": the clause is a signature that does not
/// typecheck rather than a runtime check that could be forgotten.
///
/// ```
/// use cogra_interchange::Theory;
///
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 4, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let open = theory.open_companion();
/// assert_eq!(open.floor(), (1, 4));
/// assert!(open.to_cddl().contains("* (uint .gt 1) => any"));
/// ```
#[derive(Clone, Debug)]
pub struct OpenTheory {
    cddl: Cddl,
    table: RuleTable,
    patterns: BTreeMap<usize, XsdPattern>,
    label: NamespaceLabel,
    floor: (u64, u64),
}

impl OpenTheory {
    /// The major and the minor of the theory this was derived from.
    ///
    /// The minor is the *floor*: a companion is the instrument for stamps
    /// above the reader's ceiling, and the theory it was derived from is
    /// the greatest one the reader holds.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [2, 7, uint]}"#)
    ///     .expect("an assignable theory");
    /// assert_eq!(theory.open_companion().floor(), (2, 7));
    /// ```
    pub fn floor(&self) -> (u64, u64) {
        self.floor
    }

    /// The label pinned at key 0, which the relaxation leaves alone.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint]}"#)
    ///     .expect("an assignable theory");
    /// assert_eq!(theory.open_companion().label().as_str(), "com.example");
    /// ```
    pub fn label(&self) -> &NamespaceLabel {
        &self.label
    }

    /// Normalized CDDL, on the same terms as [`Theory::to_cddl`]: a normal
    /// form for diagnostics and comparison, not a source text a consumer
    /// should store.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 2, uint]}"#)
    ///     .expect("an assignable theory");
    /// assert_eq!(
    ///     theory.open_companion().to_cddl(),
    ///     "e = {0 => \"com.example\", 1 => [1, uint, uint], * (uint .gt 1) => any}\n"
    /// );
    /// ```
    pub fn to_cddl(&self) -> String {
        print::print(&self.cddl)
    }

    /// The rewritten tree, its rule table, and the theory's compiled
    /// patterns — what satisfaction reads.
    pub(crate) fn parts(&self) -> (&Cddl, &RuleTable, &BTreeMap<usize, XsdPattern>) {
        (&self.cddl, &self.table, &self.patterns)
    }
}

/// Derive the companion: clone the parsed tree and apply the rewrite.
///
/// The patterns come across by clone rather than by recompilation: the tree
/// is a clone, so every `.regexp` operand stands where it stood, and the
/// keys of the pattern map still find it.
pub(crate) fn derive(theory: &Theory) -> OpenTheory {
    let mut cddl = theory.cddl.clone();
    relax(&mut cddl);
    let table = match cddl.rules.first() {
        Some(root) => theory
            .table
            .with_rule_body(&root.name.text, root.body.clone()),
        None => theory.table.clone(),
    };
    OpenTheory {
        cddl,
        table,
        patterns: theory.patterns.clone(),
        label: theory.label().clone(),
        floor: theory.coordinate(),
    }
}

/// The two relaxations and the cut, and nothing more.
fn relax(cddl: &mut Cddl) -> Option<()> {
    let root = cddl.rules.first_mut()?;
    let span = root.name.span;
    let RuleBody::Type(ty) = &mut root.body else {
        return None;
    };
    let [only] = ty.choices.as_mut_slice() else {
        return None;
    };
    let Type2Kind::Map(group) = &mut only.target.kind else {
        return None;
    };
    let [choice] = group.choices.as_mut_slice() else {
        return None;
    };

    free_the_minor(&mut choice.entries)?;
    cut_content_keys(&mut choice.entries);
    choice.entries.push(wildcard(span));
    Some(())
}

/// The first relaxation: the minor position of key 1 becomes the name `uint`.
fn free_the_minor(entries: &mut [GroupEntry]) -> Option<()> {
    let entry = entries
        .iter_mut()
        .find(|entry| fragment::entry_key(entry) == Some(1))?;
    let GroupEntryKind::Member { value, .. } = &mut entry.kind else {
        return None;
    };
    let [only] = value.choices.as_mut_slice() else {
        return None;
    };
    let Type2Kind::Array(group) = &mut only.target.kind else {
        return None;
    };
    let [choice] = group.choices.as_mut_slice() else {
        return None;
    };
    let [_, minor, _] = choice.entries.as_mut_slice() else {
        return None;
    };
    let GroupEntryKind::Member { key: None, value } = &mut minor.kind else {
        return None;
    };

    *value = named(UINT, value.span);
    Some(())
}

/// The cut: each enumerated content key is pinned with a cut `^`, so a
/// member present under a key S enumerates is held to S's type there rather
/// than falling through to the wildcard added below.
///
/// Keys 0 and 1 are the envelope, not enumerated content, and the wildcard
/// cannot reach them anyway — its key is `(uint .gt 1)` — so they are left
/// as they stand. A content key written in the colon form already carries
/// an implicit cut (RFC 8610 §3.5.4), so only the `=>` form is touched
/// here; the `_` arm is the total function's answer where an entry is
/// neither.
fn cut_content_keys(entries: &mut [GroupEntry]) {
    for entry in entries.iter_mut() {
        if !matches!(fragment::entry_key(entry), Some(key) if key > 1) {
            continue;
        }
        if let GroupEntryKind::Member {
            key: Some(member_key),
            ..
        } = &mut entry.kind
            && let MemberKeyKind::Type { cut, .. } = &mut member_key.kind
        {
            *cut = true;
        }
    }
}

/// The second relaxation: the base theory's wildcard, `* (uint .gt 1) => any`.
///
/// Built as a tree rather than parsed from the schema text, so that the
/// companion carries no second parse to keep in step with the first. That
/// it prints as the base theory's own wildcard prints is asserted in
/// `tests/companion.rs`.
fn wildcard(span: Span) -> GroupEntry {
    let one = Type2 {
        kind: Type2Kind::Value(Value {
            kind: ValueKind::Number(NumberToken {
                text: "1".to_owned(),
                is_float: false,
            }),
            span,
        }),
        span,
    };
    let above_one = Type {
        choices: vec![Type1 {
            target: type2(UINT, span),
            operation: Some(Operation {
                operator: Operator::Control(Name {
                    text: "gt".to_owned(),
                    span,
                }),
                operand: one,
                span,
            }),
            span,
        }],
        span,
    };

    GroupEntry {
        occur: Some(Occur {
            kind: OccurKind::Bounded {
                min: None,
                max: None,
            },
            span,
        }),
        kind: GroupEntryKind::Member {
            key: Some(MemberKey {
                kind: MemberKeyKind::Type {
                    key: Box::new(Type1 {
                        target: Type2 {
                            // The parentheses are the schema's own: the
                            // member key of the wildcard is a whole
                            // `type1`, and printing it bare would read back
                            // as a key of `uint` with a stray control.
                            kind: Type2Kind::Parenthesized(Box::new(above_one)),
                            span,
                        },
                        operation: None,
                        span,
                    }),
                    cut: false,
                },
                span,
            }),
            value: named(ANY, span),
        },
        span,
    }
}

/// The name the base theory frees the patch and the minor to.
const UINT: &str = "uint";

/// The type the base theory's wildcard admits at an unknown content key.
const ANY: &str = "any";

fn named(name: &str, span: Span) -> Type {
    Type {
        choices: vec![Type1 {
            target: type2(name, span),
            operation: None,
            span,
        }],
        span,
    }
}

fn type2(name: &str, span: Span) -> Type2 {
    Type2 {
        kind: Type2Kind::Typename {
            name: Name {
                text: name.to_owned(),
                span,
            },
            args: None,
        },
        span,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn theory(source: &str) -> Theory {
        match Theory::parse(source) {
            Ok(theory) => theory,
            Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
        }
    }

    /// The wildcard is built as a tree and the base theory's is parsed from
    /// the conventions' text; the two printing alike is what says the tree
    /// is the schema's own clause and not a lookalike.
    #[test]
    fn the_built_wildcard_prints_as_the_base_theorys() {
        let span = Span {
            start: 0,
            end: 0,
            line: 1,
            column: 1,
        };
        let mut printed = String::new();
        print::print_group_entry(&wildcard(span), &mut printed);
        assert_eq!(printed, "* (uint .gt 1) => any");
        assert!(super::super::global().to_cddl().contains(&printed));
    }

    /// The rewrite is a rewrite of the parsed tree: the companion's printed
    /// form reparses as CDDL, which a text edit could not promise.
    #[test]
    fn the_companion_reparses_as_cddl() {
        let open =
            theory(r#"e = {0 => "com.example", 1 => [1, 2, uint], 2 => tstr}"#).open_companion();
        let printed = open.to_cddl();
        match super::super::parse::parse(&printed) {
            Ok(_) => {}
            Err(error) => panic!("the companion does not reparse: {error}"),
        }
    }

    /// The relaxation is not in the fragment — it is the clause an assigned
    /// theory replaces by enumeration — so the companion is no theory.
    #[test]
    fn the_companion_is_not_an_assignable_theory() {
        let open = theory(r#"e = {0 => "com.example", 1 => [1, 2, uint]}"#).open_companion();
        assert!(Theory::parse(&open.to_cddl()).is_err());
    }
}
