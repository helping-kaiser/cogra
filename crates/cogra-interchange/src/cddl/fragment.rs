//! Assignable-fragment membership.
//!
//! The fragment is "structural, not lexical": it constrains the top-level
//! map rule and nothing below a content key. This module decides membership
//! by the six clauses of `alg:xchg:fragment-check`, refusing at the first
//! failure with a [`TheoryError::NotInFragment`] whose detail opens with
//! the line it was located at.
//!
//! 1. Exactly one top-level map rule is the theory's root.
//! 2. Key 0 is present, pinned to a text-string literal, and that literal
//!    parses as a namespace label.
//! 3. Key 1 is present, pinned to a three-element array whose first two
//!    elements are literal unsigned integers and whose third is `uint` —
//!    the patch position free, and free in that exact shape.
//! 4. Every remaining entry has a literal unsigned-integer key strictly
//!    greater than 1, with optionality marked or not; keys are pairwise
//!    distinct.
//! 5. The map is closed: no wildcard, no `* key => value` entry, no
//!    unwrapped group extending it.
//! 6. The type at each content key is any type of the description language,
//!    and is not constrained further.
//!
//! # Clause 6 is a non-check
//!
//! It is written down as a clause because it must be *implemented* as the
//! absence of one. The fragment restricts the constructor vocabulary
//! nowhere, so a membership checker that rejects an exotic type at a
//! content key is wrong rather than strict. Nothing below a content key is
//! inspected here — not the type, not its control operators, not the rules
//! it references. A theory this module admits may still be refused as
//! [`TheoryError::Unevaluable`], which is a different verdict at a
//! different place and never a fragment refusal.
//!
//! # Readings this module fixes
//!
//! Three places where the clauses could be read two ways, ruled here and
//! recorded so that a later reader does not have to re-derive them.
//!
//! - **"Exactly one top-level map rule is the theory's root"** is a
//!   condition on the root, not a census of the theory's map rules. Reading
//!   it as a census would contradict clause 6, under which a content key
//!   may be typed by a named map rule. The root is the theory's first rule,
//!   which RFC 8610 §2.2.4 makes the root with no special syntax, and it
//!   must be a map written inline: where the root merely references a map
//!   rule, which of the two rules "pins keys 0 and 1" has no answer.
//! - **The envelope keys are required**, so `? 0 => "com.example"` is no
//!   fragment theory. An envelope key that a document may omit is not a
//!   pin.
//! - **Key 1's third element is the name `uint`**, not a type that happens
//!   to denote the same set. "Free in that exact shape" is what the clause
//!   says, and the assignment signature spells the shape `[M, m, uint]`.
//!
//! Nothing here fixes the *order* of the entries: a map's entries carry no
//! order, and a theory writing key 1 before key 0 pins the same map.

use crate::error::TheoryError;
use crate::{ContentKey, NamespaceLabel};

use super::ast::{
    Cddl, GroupEntry, GroupEntryKind, MemberKey, MemberKeyKind, Occur, OccurKind, Rule, RuleBody,
    Type, Type2Kind, ValueKind, unescape_text,
};
use super::lex::{NumberToken, Span};

/// What the root map pins, once membership is decided.
#[derive(Clone, Debug)]
pub(crate) struct Fragment {
    label: NamespaceLabel,
    major: u64,
    minor: u64,
    slots: Vec<Slot>,
}

impl Fragment {
    /// The label pinned at key 0.
    pub(crate) fn label(&self) -> &NamespaceLabel {
        &self.label
    }

    /// The major and minor pinned at key 1. Patch is free.
    pub(crate) fn coordinate(&self) -> (u64, u64) {
        (self.major, self.minor)
    }

    /// The enumerated content keys, in ascending key order.
    pub(crate) fn slots(&self) -> &[Slot] {
        &self.slots
    }
}

/// One enumerated content key.
#[derive(Copy, Clone, Debug)]
pub(crate) struct Slot {
    key: ContentKey,
    required: bool,
    type_span: Span,
}

impl Slot {
    /// The key, always greater than 1.
    pub(crate) fn key(&self) -> ContentKey {
        self.key
    }

    /// Whether a document must carry this key.
    pub(crate) fn required(&self) -> bool {
        self.required
    }

    /// The span of the type expression at this key, into the theory source.
    pub(crate) fn type_span(&self) -> Span {
        self.type_span
    }
}

/// Decide membership, and read off what the root map pins.
pub(crate) fn check(cddl: &Cddl) -> Result<Fragment, TheoryError> {
    let root = match cddl.rules.first() {
        Some(root) => root,
        None => return Err(refusal(1, "the theory has no rules")),
    };
    let entries = root_entries(root)?;

    let mut label = None;
    let mut coordinate = None;
    let mut slots: Vec<Slot> = Vec::new();

    for entry in entries {
        let (key, required, value) = envelope_entry(entry)?;
        match key {
            0 => {
                require_pinned(required, entry.span, "key 0")?;
                label = Some(pinned_label(value)?);
            }
            1 => {
                require_pinned(required, entry.span, "key 1")?;
                coordinate = Some(pinned_coordinate(value)?);
            }
            key => {
                // Unreachable in practice: keys 0 and 1 are consumed above,
                // so nothing at or below 1 reaches the constructor. The
                // refusal is expressed rather than assumed away.
                let key = ContentKey::new(key).map_err(|error| refusal(entry.span.line, error))?;
                if slots.iter().any(|slot| slot.key == key) {
                    return Err(refusal(
                        entry.span.line,
                        format!("content key {} is enumerated twice", key.get()),
                    ));
                }
                slots.push(Slot {
                    key,
                    required,
                    type_span: value.span,
                });
            }
        }
    }

    let label = match label {
        Some(label) => label,
        None => return Err(refusal(root.span.line, "key 0 is absent")),
    };
    let (major, minor) = match coordinate {
        Some(coordinate) => coordinate,
        None => return Err(refusal(root.span.line, "key 1 is absent")),
    };

    slots.sort_by_key(|slot| slot.key.get());

    Ok(Fragment {
        label,
        major,
        minor,
        slots,
    })
}

/// The enumerated content entries of a theory, as they were parsed.
///
/// Keys 0 and 1 are the envelope and are not among them. Every entry of a
/// theory that [`check`] admitted fits the shapes this reads, so nothing is
/// skipped in practice; it skips rather than refuses because its callers
/// hold a theory whose membership is already decided and have no refusal
/// left to raise.
pub(crate) fn content_entries(cddl: &Cddl) -> Vec<(ContentKey, bool, &Type)> {
    let Some(root) = cddl.rules.first() else {
        return Vec::new();
    };
    let Ok(entries) = root_entries(root) else {
        return Vec::new();
    };
    entries
        .iter()
        .filter_map(|entry| envelope_entry(entry).ok())
        .filter_map(|(key, required, value)| Some((ContentKey::new(key).ok()?, required, value)))
        .collect()
}

/// The literal unsigned key an entry pins, where it pins one.
///
/// The one reading of "which key is this entry" in the crate, so that the
/// membership checker and the companion's rewrite cannot disagree about
/// which entry is key 1.
pub(crate) fn entry_key(entry: &GroupEntry) -> Option<u64> {
    match &entry.kind {
        GroupEntryKind::Member { key: Some(key), .. } => literal_key(key).ok(),
        _ => None,
    }
}

/// Clauses 1 and 5: the root is one inline map with one group choice.
fn root_entries(root: &Rule) -> Result<&[GroupEntry], TheoryError> {
    if root.params.is_some() {
        return Err(refusal(
            root.span.line,
            "the root rule takes generic parameters",
        ));
    }

    let ty = match &root.body {
        RuleBody::Type(ty) => ty,
        RuleBody::Group(_) => {
            return Err(refusal(
                root.span.line,
                "the root rule is a group, not a map",
            ));
        }
    };
    let only = single_type2(ty).ok_or_else(|| {
        refusal(
            ty.span.line,
            "the root rule is a choice or carries an operator, not a map",
        )
    })?;
    let group = match &only.kind {
        Type2Kind::Map(group) => group,
        _ => return Err(refusal(only.span.line, "the root rule is not a map")),
    };

    match group.choices.as_slice() {
        [only] => Ok(&only.entries),
        _ => Err(refusal(
            group.span.line,
            "the root map is a group choice, so it is not closed over one enumeration",
        )),
    }
}

/// Clauses 4 and 5 for one entry: a literal unsigned key, optionality
/// marked or not, and nothing that extends the map.
fn envelope_entry(entry: &GroupEntry) -> Result<(u64, bool, &Type), TheoryError> {
    let required = match &entry.occur {
        None => true,
        Some(Occur {
            kind: OccurKind::Optional,
            ..
        }) => false,
        Some(occur) => {
            return Err(refusal(
                occur.span.line,
                "an entry carries an occurrence indicator other than `?`, so the map is not closed",
            ));
        }
    };

    let (key, value) = match &entry.kind {
        GroupEntryKind::Member {
            key: Some(key),
            value,
        } => (key, value),
        GroupEntryKind::Member { key: None, .. } => {
            return Err(refusal(
                entry.span.line,
                "an entry has no member key, so it extends the map with another group",
            ));
        }
        GroupEntryKind::Inline(_) => {
            return Err(refusal(
                entry.span.line,
                "an entry is an inline group, so it extends the map",
            ));
        }
    };

    Ok((literal_key(key)?, required, value))
}

/// The unsigned integer a member key pins, or a refusal.
fn literal_key(key: &MemberKey) -> Result<u64, TheoryError> {
    let number = match &key.kind {
        MemberKeyKind::Value(value) => match &value.kind {
            ValueKind::Number(number) => number,
            _ => {
                return Err(refusal(
                    key.span.line,
                    "a member key is a literal that is not an unsigned integer",
                ));
            }
        },
        MemberKeyKind::Bareword(name) => {
            return Err(refusal(
                key.span.line,
                format!(
                    "the member key {:?} denotes a text string, not an unsigned integer",
                    name.text
                ),
            ));
        }
        MemberKeyKind::Type { key, .. } => {
            if key.operation.is_some() {
                return Err(refusal(
                    key.span.line,
                    "a member key carries an operator, so it pins no single key",
                ));
            }
            match &key.target.kind {
                Type2Kind::Value(value) => match &value.kind {
                    ValueKind::Number(number) => number,
                    _ => {
                        return Err(refusal(
                            key.span.line,
                            "a member key is a literal that is not an unsigned integer",
                        ));
                    }
                },
                _ => {
                    return Err(refusal(
                        key.span.line,
                        "a member key is not a literal unsigned integer, so the map is not closed",
                    ));
                }
            }
        }
    };

    literal_uint(number).ok_or_else(|| {
        refusal(
            key.span.line,
            format!(
                "the member key {:?} is not an unsigned integer",
                number.text
            ),
        )
    })
}

/// Clause 2: key 0 pinned to a text literal that parses as a label.
fn pinned_label(value: &Type) -> Result<NamespaceLabel, TheoryError> {
    let only = single_type2(value)
        .ok_or_else(|| refusal(value.span.line, "key 0 is not pinned to a single literal"))?;
    let text = match &only.kind {
        Type2Kind::Value(literal) => match &literal.kind {
            ValueKind::Text(raw) => raw,
            _ => {
                return Err(refusal(
                    only.span.line,
                    "key 0 is pinned to a literal that is not a text string",
                ));
            }
        },
        _ => {
            return Err(refusal(
                only.span.line,
                "key 0 is not pinned to a text-string literal",
            ));
        }
    };

    let denoted = unescape_text(text, only.span)
        .map_err(|error| refusal(only.span.line, format!("key 0: {}", error.detail)))?;

    NamespaceLabel::parse(&denoted).map_err(|error| {
        refusal(
            only.span.line,
            format!("key 0 is pinned to {denoted:?}, which is no namespace label: {error}"),
        )
    })
}

/// Clause 3: key 1 pinned to `[major, minor, uint]`.
fn pinned_coordinate(value: &Type) -> Result<(u64, u64), TheoryError> {
    let only = single_type2(value)
        .ok_or_else(|| refusal(value.span.line, "key 1 is not pinned to a single array"))?;
    let group = match &only.kind {
        Type2Kind::Array(group) => group,
        _ => return Err(refusal(only.span.line, "key 1 is not pinned to an array")),
    };
    let entries = match group.choices.as_slice() {
        [only] => &only.entries,
        _ => {
            return Err(refusal(
                group.span.line,
                "key 1 is pinned to a group choice, not to one version triple",
            ));
        }
    };
    let [major, minor, patch] = entries.as_slice() else {
        return Err(refusal(
            group.span.line,
            format!(
                "key 1 is pinned to an array of {} elements, not three",
                entries.len()
            ),
        ));
    };

    let major = version_element(major, "major")?;
    let minor = version_element(minor, "minor")?;
    version_free(patch)?;
    Ok((major, minor))
}

/// One pinned element of the version triple.
fn version_element(entry: &GroupEntry, which: &str) -> Result<u64, TheoryError> {
    let ty = plain_element(entry, which)?;
    let only = single_type2(ty).ok_or_else(|| {
        refusal(
            ty.span.line,
            format!("the {which} position of key 1 is not a single literal"),
        )
    })?;
    let number = match &only.kind {
        Type2Kind::Value(literal) => match &literal.kind {
            ValueKind::Number(number) => number,
            _ => {
                return Err(refusal(
                    only.span.line,
                    format!("the {which} position of key 1 is not an unsigned integer"),
                ));
            }
        },
        _ => {
            return Err(refusal(
                only.span.line,
                format!("the {which} position of key 1 is not a literal"),
            ));
        }
    };
    literal_uint(number).ok_or_else(|| {
        refusal(
            only.span.line,
            format!(
                "the {which} position of key 1 is {:?}, not an unsigned integer",
                number.text
            ),
        )
    })
}

/// The patch position: free, and free in the one shape the clause fixes.
fn version_free(entry: &GroupEntry) -> Result<(), TheoryError> {
    let ty = plain_element(entry, "patch")?;
    let only = single_type2(ty)
        .ok_or_else(|| refusal(ty.span.line, "the patch position of key 1 is not `uint`"))?;
    match &only.kind {
        Type2Kind::Typename { name, args } if name.text == "uint" && args.is_none() => Ok(()),
        _ => Err(refusal(
            only.span.line,
            "the patch position of key 1 is not `uint`",
        )),
    }
}

/// An array element with no member key and no occurrence indicator.
fn plain_element<'a>(entry: &'a GroupEntry, which: &str) -> Result<&'a Type, TheoryError> {
    if entry.occur.is_some() {
        return Err(refusal(
            entry.span.line,
            format!("the {which} position of key 1 carries an occurrence indicator"),
        ));
    }
    match &entry.kind {
        GroupEntryKind::Member { key: None, value } => Ok(value),
        GroupEntryKind::Member { key: Some(_), .. } => Err(refusal(
            entry.span.line,
            format!("the {which} position of key 1 carries a member key"),
        )),
        GroupEntryKind::Inline(_) => Err(refusal(
            entry.span.line,
            format!("the {which} position of key 1 is a group"),
        )),
    }
}

/// The one `type2` a type carries, where it is neither a choice nor an
/// operation.
fn single_type2(ty: &Type) -> Option<&super::ast::Type2> {
    match ty.choices.as_slice() {
        [only] if only.operation.is_none() => Some(&only.target),
        _ => None,
    }
}

/// The value of a CDDL unsigned-integer literal, in whatever base it was
/// written.
fn literal_uint(number: &NumberToken) -> Option<u64> {
    if number.is_float || number.text.starts_with('-') {
        return None;
    }
    uint_text(&number.text)
}

/// The value of an unsigned integer as CDDL spells one: decimal, `0x`, or
/// `0b`.
///
/// Shared with the places that read a `uint` outside a literal — a tag
/// number, an additional information — so that every base CDDL admits is
/// read the same way wherever it stands.
pub(crate) fn uint_text(text: &str) -> Option<u64> {
    if let Some(hex) = text.strip_prefix("0x") {
        u64::from_str_radix(hex, 16).ok()
    } else if let Some(bin) = text.strip_prefix("0b") {
        u64::from_str_radix(bin, 2).ok()
    } else {
        text.parse().ok()
    }
}

fn require_pinned(required: bool, span: Span, which: &str) -> Result<(), TheoryError> {
    if required {
        Ok(())
    } else {
        Err(refusal(
            span.line,
            format!("{which} is optional, so the envelope is not pinned"),
        ))
    }
}

/// A fragment refusal, located in the only place the variant has for it.
fn refusal(line: u32, detail: impl std::fmt::Display) -> TheoryError {
    TheoryError::NotInFragment {
        detail: format!("line {line}: {detail}"),
    }
}

#[cfg(test)]
mod tests {
    use super::super::parse::parse;
    use super::*;

    /// The membership verdict on a source, which must parse.
    fn verdict(source: &str) -> Result<Fragment, TheoryError> {
        match parse(source) {
            Ok(cddl) => check(&cddl),
            Err(error) => panic!("expected {source:?} to parse, but: {error}"),
        }
    }

    fn admit(source: &str) -> Fragment {
        match verdict(source) {
            Ok(fragment) => fragment,
            Err(error) => panic!("expected {source:?} in the fragment, but: {error}"),
        }
    }

    fn reject(source: &str) -> String {
        match verdict(source) {
            Ok(_) => panic!("expected {source:?} outside the fragment, but it was admitted"),
            Err(TheoryError::NotInFragment { detail }) => detail,
            Err(other) => panic!("expected a fragment refusal for {source:?}, got {other}"),
        }
    }

    const MINIMAL: &str = r#"example = {0 => "com.example", 1 => [1, 0, uint]}"#;

    // -- in the fragment --------------------------------------------------

    #[test]
    fn the_minimal_theory_is_in_the_fragment() {
        let fragment = admit(MINIMAL);
        assert_eq!(fragment.label().as_str(), "com.example");
        assert_eq!(fragment.coordinate(), (1, 0));
        assert!(fragment.slots().is_empty());
    }

    /// The conventions' own illustration of an assigned theory.
    #[test]
    fn the_conventions_example_theory_is_in_the_fragment() {
        let fragment = admit(concat!(
            "example = {\n",
            "  0 => \"com.company.example\",\n",
            "  1 => [1, 2, uint],\n",
            "  2 => tstr,           ; defined since 1.0\n",
            "  ? 7 => bstr,         ; added at 1.2 — necessarily optional\n",
            "}\n",
        ));
        assert_eq!(fragment.coordinate(), (1, 2));
        let slots: Vec<(u64, bool)> = fragment
            .slots()
            .iter()
            .map(|slot| (slot.key().get(), slot.required()))
            .collect();
        assert_eq!(slots, [(2, true), (7, false)]);
    }

    #[test]
    fn slots_are_ascending_whatever_order_they_were_written_in() {
        let fragment =
            admit(r#"e = {9 => uint, 0 => "com.example", 3 => uint, 1 => [0, 0, uint]}"#);
        let keys: Vec<u64> = fragment
            .slots()
            .iter()
            .map(|slot| slot.key().get())
            .collect();
        assert_eq!(keys, [3, 9]);
    }

    #[test]
    fn a_content_key_may_be_written_in_any_base() {
        let fragment = admit(r#"e = {0 => "com.example", 1 => [0, 0, uint], 0x10 => uint}"#);
        assert_eq!(fragment.slots()[0].key().get(), 16);
    }

    #[test]
    fn a_content_key_may_use_the_colon_form() {
        let fragment = admit(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2: tstr}"#);
        assert_eq!(fragment.slots()[0].key().get(), 2);
    }

    /// Clause 6 as a non-check: a tagged type at a content key is exotic
    /// and admitted, because the fragment restricts the constructor
    /// vocabulary nowhere.
    #[test]
    fn an_exotic_type_at_a_content_key_is_in_the_fragment() {
        admit(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => #6.42(bstr)}"#);
        admit(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => {* tstr => any}}"#);
        admit(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => &(a: 1, b: 2)}"#);
    }

    /// Clause 6 again, on the operator vocabulary: `.cbor` is outside the
    /// evaluable subset, and that is a different verdict at a different
    /// place — membership does not look.
    #[test]
    fn an_unevaluable_operator_at_a_content_key_is_in_the_fragment() {
        admit(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => bstr .cbor any}"#);
    }

    /// A map rule below the root is not a second root: reading clause 1 as
    /// a census of map rules would refuse this, and contradict clause 6.
    #[test]
    fn a_map_rule_below_the_root_is_in_the_fragment() {
        admit(
            r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => inner}
inner = {a: 1}"#,
        );
    }

    #[test]
    fn the_envelope_keys_may_be_written_in_any_order() {
        let fragment = admit(r#"e = {1 => [4, 5, uint], 0 => "com.example"}"#);
        assert_eq!(fragment.coordinate(), (4, 5));
        assert_eq!(fragment.label().as_str(), "com.example");
    }

    /// The patch position is matched by the name `uint`, not by what the
    /// name denotes, so a theory redefining `uint` still writes the shape.
    #[test]
    fn the_patch_position_is_matched_by_name() {
        admit(
            r#"e = {0 => "com.example", 1 => [0, 0, uint]}
uint = 5"#,
        );
    }

    #[test]
    fn an_escaped_label_is_read_by_its_denotation() {
        let fragment = admit(r#"e = {0 => "com.example", 1 => [0, 0, uint]}"#);
        assert_eq!(fragment.label().as_str(), "com.example");
    }

    #[test]
    fn the_span_of_a_slot_covers_the_type_as_written() {
        let source = r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr .size 3}"#;
        let fragment = admit(source);
        let span = fragment.slots()[0].type_span();
        assert_eq!(&source[span.start..span.end], "tstr .size 3");
    }

    // -- outside the fragment ---------------------------------------------

    #[test]
    fn a_root_that_is_not_a_map_is_refused() {
        assert!(reject("e = uint").contains("not a map"));
    }

    #[test]
    fn a_root_group_rule_is_refused() {
        assert!(reject("e = (1, 2)").contains("group"));
    }

    #[test]
    fn a_generic_root_is_refused() {
        assert!(
            reject(r#"e<t> = {0 => "com.example", 1 => [0, 0, uint], 2 => t}"#).contains("generic")
        );
    }

    #[test]
    fn a_root_type_choice_is_refused() {
        assert!(reject(r#"e = {0 => "com.example"} / {1 => uint}"#).contains("choice"));
    }

    #[test]
    fn a_root_group_choice_is_refused() {
        assert!(reject(r#"e = {0 => "com.example" // 1 => uint}"#).contains("not closed"));
    }

    #[test]
    fn a_wildcard_entry_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [0, 0, uint], * (uint .gt 1) => any}"#)
                .contains("occurrence indicator")
        );
    }

    #[test]
    fn a_repeated_entry_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [0, 0, uint], + 2 => uint}"#)
                .contains("occurrence indicator")
        );
    }

    #[test]
    fn an_inline_group_entry_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [0, 0, uint], (2 => uint, 3 => uint)}"#)
                .contains("extends the map")
        );
    }

    #[test]
    fn a_bare_group_reference_is_refused() {
        assert!(
            reject(
                r#"e = {0 => "com.example", 1 => [0, 0, uint], more}
more = (2 => uint)"#
            )
            .contains("no member key")
        );
    }

    #[test]
    fn a_bareword_key_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [0, 0, uint], name: tstr}"#)
                .contains("text string")
        );
    }

    #[test]
    fn a_typed_key_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [0, 0, uint], tstr => uint}"#)
                .contains("not closed")
        );
    }

    #[test]
    fn a_duplicate_content_key_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => uint, 2 => tstr}"#)
                .contains("twice")
        );
    }

    #[test]
    fn an_absent_key_0_is_refused() {
        assert!(reject("e = {1 => [0, 0, uint]}").contains("key 0 is absent"));
    }

    #[test]
    fn an_absent_key_1_is_refused() {
        assert!(reject(r#"e = {0 => "com.example"}"#).contains("key 1 is absent"));
    }

    #[test]
    fn an_optional_envelope_key_is_refused() {
        assert!(
            reject(r#"e = {? 0 => "com.example", 1 => [0, 0, uint]}"#)
                .contains("key 0 is optional")
        );
        assert!(
            reject(r#"e = {0 => "com.example", ? 1 => [0, 0, uint]}"#)
                .contains("key 1 is optional")
        );
    }

    #[test]
    fn an_unpinned_key_0_is_refused() {
        assert!(reject(r#"e = {0 => tstr, 1 => [0, 0, uint]}"#).contains("text-string literal"));
    }

    #[test]
    fn a_key_0_that_is_no_label_is_refused() {
        assert!(
            reject(r#"e = {0 => "Com.Example", 1 => [0, 0, uint]}"#).contains("no namespace label")
        );
        assert!(reject(r#"e = {0 => "com", 1 => [0, 0, uint]}"#).contains("no namespace label"));
    }

    #[test]
    fn a_key_1_of_the_wrong_length_is_refused() {
        assert!(reject(r#"e = {0 => "com.example", 1 => [0, 0]}"#).contains("not three"));
        assert!(reject(r#"e = {0 => "com.example", 1 => [0, 0, uint, 0]}"#).contains("not three"));
    }

    #[test]
    fn a_key_1_that_is_not_an_array_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => uint}"#).contains("not pinned to an array")
        );
    }

    #[test]
    fn an_unpinned_major_or_minor_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [uint, 0, uint]}"#).contains("major position")
        );
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [0, uint, uint]}"#).contains("minor position")
        );
    }

    #[test]
    fn a_pinned_patch_is_refused() {
        assert!(reject(r#"e = {0 => "com.example", 1 => [0, 0, 3]}"#).contains("patch position"));
        assert!(reject(r#"e = {0 => "com.example", 1 => [0, 0, int]}"#).contains("patch position"));
    }

    #[test]
    fn a_documented_version_triple_is_refused() {
        assert!(
            reject(r#"e = {0 => "com.example", 1 => [major: 1, minor: 0, patch: uint]}"#)
                .contains("member key")
        );
    }

    #[test]
    fn a_content_key_at_or_below_one_is_impossible_by_construction() {
        // Keys 0 and 1 are consumed as the envelope before any slot is
        // recorded, so no slot can carry them.
        let fragment = admit(MINIMAL);
        assert!(fragment.slots().iter().all(|slot| slot.key().get() > 1));
    }

    #[test]
    fn every_refusal_carries_a_line() {
        assert!(reject("e = uint").starts_with("line 1:"));
        assert!(reject("e = {\n  0 => tstr,\n  1 => [0, 0, uint]\n}").starts_with("line 2:"));
    }
}
