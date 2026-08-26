//! ´mod:module:inclusion´
//!
//! Minor inclusion, key by key.
//!
//! The invariant: every content key of the earlier theory appears in the
//! later one with its type and its requiredness verbatim, and every key new
//! at the later minor is optional. A breach is a *verdict* and not an
//! error — the `Result` wrapper carries only the case where the two
//! theories are not comparable at all
//! (´alg:xchg:inclusion-check´).
//!
//! # Identity of type is literal
//!
//! "The expression together with every rule it references" is read
//! literally: the comparison is over expression trees, with rule references
//! matched by name and same-named rules required to be identical
//! (´dec:xchg:type-identity´). The comparison runs over the
//! normalized print of the type expression together with the printed body
//! of every rule it reaches, transitively — never over the source text and
//! never over [`KeySlot::type_source`](crate::KeySlot::type_source), which
//! carries the author's whitespace and would call two spellings of one type
//! different.
//!
//! Rules of the standard prelude are left out of the comparison, because
//! every theory resolves against the same prelude and a prelude rule cannot
//! differ between two of them. A theory that *shadows* a prelude name
//! defines a rule of its own, which is in the comparison like any other —
//! so shadowing at one minor and not at the next is a difference, as it
//! should be.

use std::collections::BTreeSet;

use super::ast::{
    GenericArgs, Group, GroupEntry, GroupEntryKind, MemberKey, MemberKeyKind, RuleBody, Type,
    Type1, Type2, Type2Kind,
};
use super::resolve::RuleTable;
use super::{Theory, fragment, print};
use crate::ContentKey;
use crate::error::TheoryError;

/// The outcome of the additive-minor check between two assigned theories.
///
/// ```
/// use cogra_interchange::{Inclusion, Theory, check_inclusion};
///
/// let earlier = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let later = Theory::parse(
///     r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, ? 3 => uint}"#,
/// )
/// .expect("an assignable theory");
/// assert_eq!(
///     check_inclusion(&earlier, &later).expect("comparable"),
///     Inclusion::Holds
/// );
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Inclusion {
    /// The later theory extends the earlier one additively.
    Holds,
    /// It does not, in these ways, in ascending key order.
    Violated(Vec<InclusionBreach>),
}

impl Inclusion {
    /// Whether the inclusion holds.
    ///
    /// ```
    /// use cogra_interchange::{Theory, check_inclusion};
    ///
    /// let earlier = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint]}"#)
    ///     .expect("an assignable theory");
    /// let later = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 3, uint], 2 => tstr}"#)
    ///     .expect("an assignable theory");
    /// // Key 2 is new at the later minor and is not optional.
    /// assert!(!check_inclusion(&earlier, &later).expect("comparable").holds());
    /// ```
    pub fn holds(&self) -> bool {
        matches!(self, Inclusion::Holds)
    }
}

/// One way a later minor fails to extend an earlier one additively.
///
/// Every breach carries the content key it concerns, which is what makes it
/// a located verdict rather than a bare negative.
///
/// ```
/// use cogra_interchange::{Inclusion, InclusionBreach, Theory, check_inclusion};
///
/// let earlier = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let later = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 1, uint]}"#)
///     .expect("an assignable theory");
/// match check_inclusion(&earlier, &later).expect("comparable") {
///     Inclusion::Violated(breaches) => assert!(matches!(
///         breaches.as_slice(),
///         [InclusionBreach::KeyDropped { key }] if key.get() == 2
///     )),
///     Inclusion::Holds => panic!("dropping a content key is a breach"),
/// }
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum InclusionBreach {
    /// A content key of the earlier theory is absent from the later one.
    KeyDropped {
        /// The key the later theory does not carry.
        key: ContentKey,
    },
    /// A shared key's type is not identical.
    ///
    /// The two strings are the compared forms: the normalized print of the
    /// type expression, followed by the printed body of every rule it
    /// reaches. They are diagnostics, not a promised format.
    TypeChanged {
        /// The key whose type moved.
        key: ContentKey,
        /// What the earlier theory writes there.
        earlier: String,
        /// What the later theory writes there.
        later: String,
    },
    /// A shared key's requiredness is not identical.
    RequirednessChanged {
        /// The key whose requiredness moved.
        key: ContentKey,
        /// Whether the earlier theory required it.
        earlier: bool,
        /// Whether the later theory requires it.
        later: bool,
    },
    /// A key new at the later minor is not optional.
    NewKeyRequired {
        /// The key the later theory added as required.
        key: ContentKey,
    },
}

/// Check that `later` extends `earlier` additively.
///
/// Both must be assigned theories of the same label and major, with
/// `earlier`'s minor the lesser; anything else is
/// [`TheoryError::Incomparable`], the one case that is an error rather than
/// a verdict. A breach is a verdict and travels as one.
///
/// # Identity of type is literal, and it costs
///
/// Two keys carry the same type when the normalized print of their type
/// expressions agrees *and* every rule those expressions reach, matched by
/// name, is written identically. A theory writing `2 => colour` where its
/// predecessor wrote `2 => color`, with identical definitions standing
/// behind both names, is therefore no additive minor: **a pure rule rename
/// between minors is a major boundary**. An owner who renames a rule
/// between minors is told to bump major, which is stricter than the
/// invariant's intent — the ruling takes that cost deliberately, because
/// its failure mode is the conservative one, where comparison up to
/// renaming risks admitting as a minor something the invariant meant to
/// exclude.
///
/// ```
/// use cogra_interchange::{Theory, check_inclusion};
///
/// let earlier = Theory::parse(concat!(
///     "e = {0 => \"com.example\", 1 => [1, 0, uint], 2 => color}\n",
///     "color = tstr\n",
/// ))
/// .expect("an assignable theory");
/// let renamed = Theory::parse(concat!(
///     "e = {0 => \"com.example\", 1 => [1, 1, uint], 2 => colour}\n",
///     "colour = tstr\n",
/// ))
/// .expect("an assignable theory");
///
/// // The definitions behind the two names are identical, and the rename
/// // is still a breach.
/// assert!(!check_inclusion(&earlier, &renamed).expect("comparable").holds());
/// ```
pub fn check_inclusion(earlier: &Theory, later: &Theory) -> Result<Inclusion, TheoryError> {
    if earlier.label() != later.label() {
        return Err(TheoryError::Incomparable);
    }
    let (earlier_major, earlier_minor) = earlier.coordinate();
    let (later_major, later_minor) = later.coordinate();
    if earlier_major != later_major || earlier_minor >= later_minor {
        return Err(TheoryError::Incomparable);
    }

    Ok(compare(earlier, later))
}

/// The key-by-key comparison, over two theories already known comparable.
///
/// The registry reaches the check this way: it has established the label,
/// the major, and the ascending minors before it asks, so the `Result` of
/// [`check_inclusion`] would carry an arm it cannot reach
/// (´sig:xchg:registry-api´).
pub(crate) fn compare(earlier: &Theory, later: &Theory) -> Inclusion {
    let before = keyed(earlier);
    let after = keyed(later);
    let mut breaches = Vec::new();

    for (key, required, ty) in &before {
        let Some((_, later_required, later_ty)) = after.iter().find(|(other, _, _)| other == key)
        else {
            breaches.push(InclusionBreach::KeyDropped { key: *key });
            continue;
        };

        let earlier_identity = identity(&earlier.table, ty);
        let later_identity = identity(&later.table, later_ty);
        if earlier_identity != later_identity {
            breaches.push(InclusionBreach::TypeChanged {
                key: *key,
                earlier: earlier_identity,
                later: later_identity,
            });
        }
        if required != later_required {
            breaches.push(InclusionBreach::RequirednessChanged {
                key: *key,
                earlier: *required,
                later: *later_required,
            });
        }
    }

    for (key, required, _) in &after {
        let shared = before.iter().any(|(other, _, _)| other == key);
        if !shared && *required {
            breaches.push(InclusionBreach::NewKeyRequired { key: *key });
        }
    }

    if breaches.is_empty() {
        Inclusion::Holds
    } else {
        Inclusion::Violated(breaches)
    }
}

/// A theory's content entries in ascending key order, so that the breaches
/// of two runs stand in the same order.
fn keyed(theory: &Theory) -> Vec<(ContentKey, bool, &Type)> {
    let mut entries = fragment::content_entries(&theory.cddl);
    entries.sort_by_key(|(key, _, _)| key.get());
    entries
}

/// The compared form of a type: its normalized print, followed by the
/// printed definition of every rule it reaches, transitively, in name
/// order.
///
/// Name order rather than traversal order, so that two theories writing the
/// same rules in different places compare equal — the order rules are
/// *written* in is layout, and the printer already normalizes layout away.
fn identity(table: &RuleTable, ty: &Type) -> String {
    let mut reached = BTreeSet::new();
    let mut pending = Vec::new();
    names_of_type(ty, &mut pending);

    while let Some(name) = pending.pop() {
        if !reached.insert(name.clone()) {
            continue;
        }
        if let Some(rule) = own_rule(table, &name) {
            names_of_body(rule.body(), &mut pending);
        }
    }

    let mut out = String::new();
    print::print_type(ty, &mut out);
    for name in &reached {
        let Some(rule) = own_rule(table, name) else {
            continue;
        };
        out.push('\n');
        out.push_str(name);
        if let [first, rest @ ..] = rule.params() {
            out.push('<');
            out.push_str(first);
            for param in rest {
                out.push_str(", ");
                out.push_str(param);
            }
            out.push('>');
        }
        out.push_str(" = ");
        match rule.body() {
            RuleBody::Type(body) => print::print_type(body, &mut out),
            RuleBody::Group(entry) => print::print_group_entry(entry, &mut out),
        }
    }
    out
}

/// A rule the theory itself defines.
///
/// A name resolving to the prelude, to an undefined socket, or to a generic
/// parameter contributes nothing to the comparison: the first is the same
/// for every theory, and the other two define nothing at all.
fn own_rule<'t>(table: &'t RuleTable, name: &str) -> Option<&'t super::resolve::ResolvedRule> {
    table.get(name).filter(|rule| !rule.is_from_prelude())
}

fn names_of_body(body: &RuleBody, into: &mut Vec<String>) {
    match body {
        RuleBody::Type(ty) => names_of_type(ty, into),
        RuleBody::Group(entry) => names_of_entry(entry, into),
    }
}

fn names_of_type(ty: &Type, into: &mut Vec<String>) {
    for choice in &ty.choices {
        names_of_type1(choice, into);
    }
}

fn names_of_type1(ty: &Type1, into: &mut Vec<String>) {
    names_of_type2(&ty.target, into);
    if let Some(operation) = &ty.operation {
        names_of_type2(&operation.operand, into);
    }
}

fn names_of_type2(ty: &Type2, into: &mut Vec<String>) {
    match &ty.kind {
        Type2Kind::Value(_) | Type2Kind::Representation { .. } | Type2Kind::Any => {}
        Type2Kind::Typename { name, args }
        | Type2Kind::Unwrap { name, args }
        | Type2Kind::EnumGroup { name, args } => {
            into.push(name.text.clone());
            names_of_args(args, into);
        }
        Type2Kind::Parenthesized(inner) | Type2Kind::Tagged { inner, .. } => {
            names_of_type(inner, into)
        }
        Type2Kind::Map(group) | Type2Kind::Array(group) => names_of_group(group, into),
        Type2Kind::EnumInline(group) => names_of_group(group, into),
    }
}

fn names_of_args(args: &Option<GenericArgs>, into: &mut Vec<String>) {
    let Some(args) = args else {
        return;
    };
    for arg in &args.args {
        names_of_type1(arg, into);
    }
}

fn names_of_group(group: &Group, into: &mut Vec<String>) {
    for choice in &group.choices {
        for entry in &choice.entries {
            names_of_entry(entry, into);
        }
    }
}

fn names_of_entry(entry: &GroupEntry, into: &mut Vec<String>) {
    match &entry.kind {
        GroupEntryKind::Member { key, value } => {
            if let Some(key) = key {
                names_of_member_key(key, into);
            }
            names_of_type(value, into);
        }
        GroupEntryKind::Inline(group) => names_of_group(group, into),
    }
}

/// The rule names a member key reaches, which only a type key can do: a
/// bareword key denotes the text string of its spelling and a literal key
/// denotes itself.
fn names_of_member_key(key: &MemberKey, into: &mut Vec<String>) {
    match &key.kind {
        MemberKeyKind::Bareword(_) | MemberKeyKind::Value(_) => {}
        MemberKeyKind::Type { key, .. } => names_of_type1(key, into),
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

    /// The identity of a type is the printed expression plus the rules it
    /// reaches — and the prelude is not among them, however deep the type
    /// reaches into it.
    #[test]
    fn the_identity_of_a_type_carries_its_own_rules_and_not_the_prelude() {
        let theory = theory(concat!(
            "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => outer}\n",
            "outer = [* inner]\n",
            "inner = tstr\n",
        ));
        let entries = keyed(&theory);
        let [(_, _, ty)] = entries.as_slice() else {
            panic!("one content key");
        };
        let identity = identity(&theory.table, ty);
        assert_eq!(identity, "outer\ninner = tstr\nouter = [* inner]");
        assert!(!identity.contains("tstr = "));
    }

    /// A cycle among the rules a type reaches terminates: the closure is a
    /// set, and a name already in it is not walked twice.
    #[test]
    fn a_cycle_among_the_reached_rules_terminates() {
        let theory = theory(concat!(
            "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => a}\n",
            "a = [? b]\n",
            "b = [? a]\n",
        ));
        let entries = keyed(&theory);
        let [(_, _, ty)] = entries.as_slice() else {
            panic!("one content key");
        };
        assert_eq!(identity(&theory.table, ty), "a\na = [? b]\nb = [? a]");
    }
}
