//! ´mod:module:resolve´
//!
//! The rule table and reference resolution.
//!
//! A parsed theory is a tree of names; a resolved theory is one in which
//! every name stands for something. This module builds the table that
//! answers "what does this name mean" and then checks that every reference
//! in the theory has an answer, refusing the first that does not with a
//! located [`TheoryError::UnresolvedRule`].
//!
//! # What a name can resolve to
//!
//! Four sources, consulted in this order.
//!
//! 1. **A generic parameter** of the rule the reference stands in. RFC 8610
//!    §2.2.1 describes generics as "temporary assignments within the
//!    right-hand sides to the parameter names from the arguments given",
//!    so a parameter shadows a rule of the same name for that rule's body.
//! 2. **A rule of the theory**, after augmentations are merged.
//! 3. **A rule of the standard prelude** — RFC 8610 Appendix D, which that
//!    document marks normative. It is parsed rather than transcribed into a
//!    name list: a list would say that `tstr` exists but not that it is
//!    `#3`, and the evaluator needs the second. The prelude is parsed once
//!    for the process and shared by every theory
//!    (´dec:xchg:cddl-coverage´).
//! 4. **A socket with no plugs.** RFC 8610 §3.9 is explicit that a name
//!    beginning with `$` or `$$` need not be defined at all: "it is not an
//!    error if there is no definition for a socket at all; this then means
//!    there is no way to satisfy the rule (i.e., the choice is empty)". So
//!    an undefined socket resolves — to the empty choice — and is absent
//!    from the table rather than missing from it. Every other undefined
//!    name is a refusal.
//!
//! # Merging augmentations
//!
//! `/=` and `//=` are folded into their base rules as the RFC describes:
//! "a number of these could be replaced by collecting all the right-hand
//! sides and creating a single rule with a type choice or a group choice
//! built from the right-hand sides in the order of the rules given". A base
//! that has not been defined is not an error — "this makes the right-hand
//! side the first entry in the choice being created" — which is what makes
//! a plug work without a socket declaration in front of it.
//!
//! # Two refusals the grammar cannot see
//!
//! Both travel as [`TheoryError::Syntax`], which is the crate's channel for
//! "this source is not acceptable CDDL", located by line and column. The
//! parser cannot raise either, because neither is a question about one
//! rule's text.
//!
//! - **A name defined twice with different expressions.** RFC 8610 §3.1:
//!   "it is an error if the name was already defined with a different
//!   expression". Whether two expressions differ is decided by the
//!   normalized printer, which is this crate's one definition of type
//!   identity, so a name defined twice *identically* is admitted exactly as
//!   the RFC's wording admits it.
//! - **A generic instantiated at the wrong arity.** `a<int>` where `a`
//!   takes two parameters names a rule that does not exist at that arity.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use super::ast::{
    Cddl, GenericArgs, Group, GroupEntry, GroupEntryKind, MemberKey, MemberKeyKind, Name, Rule,
    RuleBody, Type, Type1, Type2, Type2Kind,
};
use super::parse::parse;
use super::print;
use crate::error::TheoryError;

/// RFC 8610 Appendix D, the standard prelude, whose own text says "This
/// appendix is normative".
///
/// The same file the parser's acceptance corpus reads, so the prelude the
/// crate resolves against and the prelude the parser is tested on cannot
/// drift apart.
const PRELUDE: &str = include_str!("../../tests/corpus/rfc8610-appendix-d-prelude.cddl");

/// One rule of a theory or of the prelude, augmentations already merged.
#[derive(Clone, Debug)]
pub(crate) struct ResolvedRule {
    params: Vec<String>,
    body: RuleBody,
    from_prelude: bool,
}

impl ResolvedRule {
    /// The generic parameter names, in order. Empty for a plain rule.
    pub(crate) fn params(&self) -> &[String] {
        &self.params
    }

    /// What the rule assigns, with every `/=` and `//=` folded in.
    pub(crate) fn body(&self) -> &RuleBody {
        &self.body
    }

    /// Whether the rule came from the standard prelude rather than from the
    /// theory.
    pub(crate) fn is_from_prelude(&self) -> bool {
        self.from_prelude
    }
}

/// Every name a theory's references may reach.
///
/// The theory's own rules are owned; the prelude's are borrowed from the
/// one copy the process parses, so a theory costs the prelude nothing.
#[derive(Clone, Debug)]
pub(crate) struct RuleTable {
    own: BTreeMap<String, ResolvedRule>,
    prelude: Option<&'static BTreeMap<String, ResolvedRule>>,
}

impl RuleTable {
    /// Build the table for `cddl` and check that every reference in it
    /// resolves.
    ///
    /// The two passes are one call because neither is useful alone: a table
    /// nothing checked may name rules that reference nothing, and a check
    /// needs the table to check against.
    pub(crate) fn build(cddl: &Cddl) -> Result<RuleTable, TheoryError> {
        let table = RuleTable {
            own: merge(&cddl.rules, prelude_table())?,
            prelude: prelude_table(),
        };
        table.check()?;
        Ok(table)
    }

    /// What a name means, or `None` where nothing defines it.
    ///
    /// `None` for a socket name is not a failure: an undefined socket is
    /// the empty choice (RFC 8610 §3.9), which the table represents by
    /// absence.
    pub(crate) fn get(&self, name: &str) -> Option<&ResolvedRule> {
        self.own
            .get(name)
            .or_else(|| self.prelude.and_then(|prelude| prelude.get(name)))
    }

    /// The theory's own rules, prelude excluded, in name order.
    pub(crate) fn own_rules(&self) -> impl Iterator<Item = (&str, &ResolvedRule)> + '_ {
        self.own.iter().map(|(name, rule)| (name.as_str(), rule))
    }

    /// This table with one rule's body replaced.
    ///
    /// The open companion's derivation edits the root rule of a theory whose
    /// every reference already resolved, and the evaluator needs a table
    /// that answers for the edited tree. Rebuilding the table from that tree
    /// would be a second resolution with a failure mode; replacing one body
    /// has none, because the derivation introduces only `uint` and `any`,
    /// which every table already answers for.
    pub(crate) fn with_rule_body(&self, name: &str, body: RuleBody) -> RuleTable {
        let mut table = self.clone();
        match table.own.get_mut(name) {
            Some(rule) => rule.body = body,
            None => {
                table.own.insert(
                    name.to_owned(),
                    ResolvedRule {
                        params: Vec::new(),
                        body,
                        from_prelude: false,
                    },
                );
            }
        }
        table
    }

    fn check(&self) -> Result<(), TheoryError> {
        for rule in self.own.values() {
            self.walk_body(&rule.body, &rule.params)?;
        }
        Ok(())
    }

    fn walk_body(&self, body: &RuleBody, scope: &[String]) -> Result<(), TheoryError> {
        match body {
            RuleBody::Type(ty) => self.walk_type(ty, scope),
            RuleBody::Group(entry) => self.walk_entry(entry, scope),
        }
    }

    fn walk_type(&self, ty: &Type, scope: &[String]) -> Result<(), TheoryError> {
        for choice in &ty.choices {
            self.walk_type1(choice, scope)?;
        }
        Ok(())
    }

    /// Only the operand of an operation is walked: a control operator's name
    /// is an operator, never a rule reference, so nothing resolves it.
    fn walk_type1(&self, ty: &Type1, scope: &[String]) -> Result<(), TheoryError> {
        self.walk_type2(&ty.target, scope)?;
        match &ty.operation {
            Some(operation) => self.walk_type2(&operation.operand, scope),
            None => Ok(()),
        }
    }

    fn walk_type2(&self, ty: &Type2, scope: &[String]) -> Result<(), TheoryError> {
        match &ty.kind {
            Type2Kind::Value(_) | Type2Kind::Representation { .. } | Type2Kind::Any => Ok(()),
            Type2Kind::Typename { name, args }
            | Type2Kind::Unwrap { name, args }
            | Type2Kind::EnumGroup { name, args } => self.reference(name, args.as_ref(), scope),
            Type2Kind::Parenthesized(inner) => self.walk_type(inner, scope),
            Type2Kind::Map(group) | Type2Kind::Array(group) => self.walk_group(group, scope),
            Type2Kind::EnumInline(group) => self.walk_group(group, scope),
            Type2Kind::Tagged { inner, .. } => self.walk_type(inner, scope),
        }
    }

    fn walk_group(&self, group: &Group, scope: &[String]) -> Result<(), TheoryError> {
        for choice in &group.choices {
            for entry in &choice.entries {
                self.walk_entry(entry, scope)?;
            }
        }
        Ok(())
    }

    fn walk_entry(&self, entry: &GroupEntry, scope: &[String]) -> Result<(), TheoryError> {
        match &entry.kind {
            GroupEntryKind::Member { key, value } => {
                if let Some(key) = key {
                    self.walk_member_key(key, scope)?;
                }
                self.walk_type(value, scope)
            }
            GroupEntryKind::Inline(group) => self.walk_group(group, scope),
        }
    }

    /// Only a type key can reference a rule: a bareword key denotes the text
    /// string of its spelling, and a literal key denotes itself.
    fn walk_member_key(&self, key: &MemberKey, scope: &[String]) -> Result<(), TheoryError> {
        match &key.kind {
            MemberKeyKind::Bareword(_) | MemberKeyKind::Value(_) => Ok(()),
            MemberKeyKind::Type { key, .. } => self.walk_type1(key, scope),
        }
    }

    fn reference(
        &self,
        name: &Name,
        args: Option<&GenericArgs>,
        scope: &[String],
    ) -> Result<(), TheoryError> {
        if let Some(args) = args {
            for arg in &args.args {
                self.walk_type1(arg, scope)?;
            }
        }

        if scope.iter().any(|param| param == &name.text) {
            return Ok(());
        }

        let given = args.map(|args| args.args.len()).unwrap_or(0);
        match self.get(&name.text) {
            Some(rule) if rule.params.len() == given => Ok(()),
            Some(rule) => Err(TheoryError::Syntax {
                line: name.span.line,
                column: name.span.column,
                detail: format!(
                    "rule {:?} takes {} generic parameters, {given} given",
                    name.text,
                    rule.params.len()
                ),
            }),
            None if name.is_type_socket() || name.is_group_socket() => Ok(()),
            None => Err(TheoryError::UnresolvedRule {
                name: name.text.clone(),
                line: name.span.line,
            }),
        }
    }
}

/// The prelude's rules, parsed once for the process.
///
/// `None` where the shipped prelude did not parse, which would mean the
/// crate's own parser had broken against a normative document it is tested
/// against. The failure is carried rather than hidden and it fails closed:
/// with no prelude, `tstr` resolves to nothing and every theory using it is
/// refused with a located `UnresolvedRule` — a refusal, never a silent
/// pass. A unit test below keeps the case theoretical.
fn prelude_table() -> Option<&'static BTreeMap<String, ResolvedRule>> {
    static TABLE: OnceLock<Option<BTreeMap<String, ResolvedRule>>> = OnceLock::new();
    TABLE
        .get_or_init(|| {
            let cddl = parse(PRELUDE).ok()?;
            merge(&cddl.rules, None).ok().map(|mut rules| {
                for rule in rules.values_mut() {
                    rule.from_prelude = true;
                }
                rules
            })
        })
        .as_ref()
}

/// Fold a rule list into a table, merging `/=` and `//=` into their bases.
fn merge(
    rules: &[Rule],
    prelude: Option<&BTreeMap<String, ResolvedRule>>,
) -> Result<BTreeMap<String, ResolvedRule>, TheoryError> {
    let mut table: BTreeMap<String, ResolvedRule> = BTreeMap::new();

    for rule in rules {
        let name = rule.name.text.clone();
        let params: Vec<String> = rule
            .params
            .iter()
            .flat_map(|params| params.names.iter())
            .map(|param| param.text.clone())
            .collect();

        match rule.assign {
            super::ast::Assign::Plain => match table.get(&name) {
                Some(existing) if same_expression(&existing.body, &rule.body) => {}
                Some(_) => {
                    return Err(TheoryError::Syntax {
                        line: rule.name.span.line,
                        column: rule.name.span.column,
                        detail: format!(
                            "rule {name:?} is defined twice with different expressions"
                        ),
                    });
                }
                None => {
                    table.insert(
                        name,
                        ResolvedRule {
                            params,
                            body: rule.body.clone(),
                            from_prelude: false,
                        },
                    );
                }
            },
            super::ast::Assign::TypeChoice => {
                let base = table.remove(&name).or_else(|| {
                    prelude
                        .and_then(|prelude| prelude.get(&name))
                        .cloned()
                        .map(|mut rule| {
                            rule.from_prelude = false;
                            rule
                        })
                });
                let merged = extend_type(base, rule)?;
                table.insert(name, merged);
            }
            super::ast::Assign::GroupChoice => {
                let base = table.remove(&name).or_else(|| {
                    prelude
                        .and_then(|prelude| prelude.get(&name))
                        .cloned()
                        .map(|mut rule| {
                            rule.from_prelude = false;
                            rule
                        })
                });
                let merged = extend_group(base, rule)?;
                table.insert(name, merged);
            }
        }
    }

    Ok(table)
}

/// Whether two rule bodies are the same expression, in the crate's one
/// sense of sameness: the normalized printer's text.
fn same_expression(left: &RuleBody, right: &RuleBody) -> bool {
    fn render(body: &RuleBody) -> String {
        let mut out = String::new();
        match body {
            RuleBody::Type(ty) => print::print_type(ty, &mut out),
            RuleBody::Group(entry) => print::print_group_entry(entry, &mut out),
        }
        out
    }
    render(left) == render(right)
}

fn extend_type(base: Option<ResolvedRule>, rule: &Rule) -> Result<ResolvedRule, TheoryError> {
    let addition = match &rule.body {
        RuleBody::Type(ty) => ty.clone(),
        RuleBody::Group(_) => {
            return Err(TheoryError::Syntax {
                line: rule.name.span.line,
                column: rule.name.span.column,
                detail: format!(
                    "{:?} extends a type choice with a group entry",
                    rule.name.text
                ),
            });
        }
    };

    let params = base
        .as_ref()
        .map(|base| base.params.clone())
        .unwrap_or_default();

    let mut choices = match base {
        Some(ResolvedRule {
            body: RuleBody::Type(ty),
            ..
        }) => ty.choices,
        Some(_) => {
            return Err(TheoryError::Syntax {
                line: rule.name.span.line,
                column: rule.name.span.column,
                detail: format!("{:?} is a group rule and takes no `/=`", rule.name.text),
            });
        }
        None => Vec::new(),
    };
    choices.extend(addition.choices);

    Ok(ResolvedRule {
        params,
        body: RuleBody::Type(Type {
            choices,
            span: rule.span,
        }),
        from_prelude: false,
    })
}

fn extend_group(base: Option<ResolvedRule>, rule: &Rule) -> Result<ResolvedRule, TheoryError> {
    let addition = match &rule.body {
        RuleBody::Group(entry) => entry.as_ref().clone(),
        RuleBody::Type(ty) => GroupEntry {
            occur: None,
            kind: GroupEntryKind::Member {
                key: None,
                value: ty.clone(),
            },
            span: ty.span,
        },
    };

    let params = base
        .as_ref()
        .map(|base| base.params.clone())
        .unwrap_or_default();

    let mut choices = match base {
        Some(base) => match base.body {
            RuleBody::Group(entry) => group_choices(&entry),
            RuleBody::Type(ty) => group_choices(&GroupEntry {
                occur: None,
                kind: GroupEntryKind::Member {
                    key: None,
                    value: ty,
                },
                span: rule.span,
            }),
        },
        None => Vec::new(),
    };
    choices.extend(group_choices(&addition));

    Ok(ResolvedRule {
        params,
        body: RuleBody::Group(Box::new(GroupEntry {
            occur: None,
            kind: GroupEntryKind::Inline(Group {
                choices,
                span: rule.span,
            }),
            span: rule.span,
        })),
        from_prelude: false,
    })
}

/// The group choices a rule body contributes to a `//=` merge.
///
/// A parenthesized group contributes its own choices, so that two
/// augmentations of a two-choice group make four and not two nested ones;
/// anything else is one choice of one entry.
fn group_choices(entry: &GroupEntry) -> Vec<super::ast::GroupChoice> {
    match (&entry.occur, &entry.kind) {
        (None, GroupEntryKind::Inline(group)) => group.choices.clone(),
        _ => vec![super::ast::GroupChoice {
            entries: vec![entry.clone()],
            span: entry.span,
        }],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table(source: &str) -> RuleTable {
        let cddl = match parse(source) {
            Ok(cddl) => cddl,
            Err(error) => panic!("expected {source:?} to parse, but: {error}"),
        };
        match RuleTable::build(&cddl) {
            Ok(table) => table,
            Err(error) => panic!("expected {source:?} to resolve, but: {error}"),
        }
    }

    fn refuse(source: &str) -> TheoryError {
        let cddl = match parse(source) {
            Ok(cddl) => cddl,
            Err(error) => panic!("expected {source:?} to parse, but: {error}"),
        };
        match RuleTable::build(&cddl) {
            Ok(_) => panic!("expected {source:?} to be refused, but it resolved"),
            Err(error) => error,
        }
    }

    fn printed(table: &RuleTable, name: &str) -> String {
        let rule = match table.get(name) {
            Some(rule) => rule,
            None => panic!("{name:?} is absent from the table"),
        };
        let mut out = String::new();
        match rule.body() {
            RuleBody::Type(ty) => print::print_type(ty, &mut out),
            RuleBody::Group(entry) => print::print_group_entry(entry, &mut out),
        }
        out
    }

    /// The shipped prelude parses into its forty rules, each marked as the prelude's own.
    /// ´claim:resolve:the-prelude-parses-and-is-marked-as-such´
    #[test]
    fn the_prelude_parses_and_defines_its_names() {
        let prelude = match prelude_table() {
            Some(prelude) => prelude,
            None => panic!("the shipped prelude did not parse"),
        };
        assert_eq!(prelude.len(), 40);
        for name in ["any", "uint", "int", "tstr", "bstr", "bool", "float", "nil"] {
            assert!(prelude.contains_key(name), "prelude defines {name}");
        }
        assert!(
            prelude.values().all(|rule| rule.is_from_prelude()),
            "every prelude rule is marked as one"
        );
    }

    /// A prelude name resolves without the source defining it.
    /// ´claim:resolve:a-prelude-name-resolves-undefined´
    #[test]
    fn prelude_names_resolve_without_being_defined() {
        let table = table("a = {0 => tstr, 1 => uint, 2 => any}");
        assert!(table.get("tstr").is_some());
        assert!(table.get("a").is_some());
    }

    /// A rule of the source's own shadows the prelude rule of that name.
    /// ´claim:resolve:a-source-rule-shadows-the-prelude´
    #[test]
    fn a_theory_rule_shadows_a_prelude_rule() {
        let table = table("a = {0 => uint}\nuint = 1..3");
        assert_eq!(printed(&table, "uint"), "1 .. 3");
        assert!(!table.get("uint").is_some_and(|rule| rule.is_from_prelude()));
    }

    /// The source's own rules are listed without the prelude among them.
    /// ´claim:resolve:the-own-rules-exclude-the-prelude´
    #[test]
    fn own_rules_exclude_the_prelude() {
        let table = table("a = {0 => tstr}");
        let names: Vec<&str> = table.own_rules().map(|(name, _)| name).collect();
        assert_eq!(names, ["a"]);
    }

    /// A name nothing defines is refused at the line that names it.
    /// ´claim:resolve:an-undefined-name-is-located´
    #[test]
    fn an_undefined_name_is_a_located_refusal() {
        let error = refuse("a = {0 => missing}");
        assert!(matches!(
            error,
            TheoryError::UnresolvedRule { ref name, line: 1 } if name == "missing"
        ));
    }

    /// (´claim:resolve:an-undefined-name-is-located´)
    #[test]
    fn an_undefined_name_on_a_later_line_carries_that_line() {
        let error = refuse("a = {0 => b}\nb = {1 => missing}");
        assert!(matches!(
            error,
            TheoryError::UnresolvedRule { ref name, line: 2 } if name == "missing"
        ));
    }

    /// A name is resolved wherever one may stand, an unwrap, a generic argument and a member key included.
    /// ´claim:resolve:every-place-a-name-may-stand-is-resolved´
    #[test]
    fn an_undefined_name_inside_an_unwrap_is_refused() {
        assert!(matches!(
            refuse("a = [~missing]"),
            TheoryError::UnresolvedRule { .. }
        ));
    }

    /// (´claim:resolve:every-place-a-name-may-stand-is-resolved´)
    #[test]
    fn an_undefined_name_inside_a_generic_argument_is_refused() {
        assert!(matches!(
            refuse("a<t> = [* t]\nb = a<missing>"),
            TheoryError::UnresolvedRule { .. }
        ));
    }

    /// (´claim:resolve:every-place-a-name-may-stand-is-resolved´)
    #[test]
    fn an_undefined_name_in_a_member_key_is_refused() {
        assert!(matches!(
            refuse("a = {missing => uint}"),
            TheoryError::UnresolvedRule { .. }
        ));
    }

    /// A bareword member key names a key and refers to no rule.
    /// ´claim:resolve:a-bareword-key-is-no-reference´
    #[test]
    fn a_bareword_key_is_not_a_reference() {
        let table = table("a = {missing: uint}");
        assert!(table.get("missing").is_none());
    }

    /// A control operator's name refers to no rule.
    /// ´claim:resolve:a-control-operator-name-is-no-reference´
    #[test]
    fn a_control_operator_name_is_not_a_reference() {
        let table = table("a = tstr .size 3");
        assert!(table.get("size").is_none());
    }

    /// A generic parameter resolves inside its own rule and enters the table nowhere.
    /// ´claim:resolve:a-generic-parameter-is-local-to-its-rule´
    #[test]
    fn a_generic_parameter_resolves_inside_its_rule() {
        let table = table("a<t> = [* t]\nb = a<uint>");
        assert!(table.get("t").is_none());
    }

    /// (´claim:resolve:a-generic-parameter-is-local-to-its-rule´)
    #[test]
    fn a_generic_parameter_does_not_escape_its_rule() {
        assert!(matches!(
            refuse("a<t> = [* t]\nb = [* t]"),
            TheoryError::UnresolvedRule { ref name, .. } if name == "t"
        ));
    }

    /// A generic parameter shadows a prelude name inside the rule that declares it.
    /// ´claim:resolve:a-generic-parameter-shadows-a-prelude-name´
    #[test]
    fn a_generic_parameter_shadows_a_prelude_name() {
        let table = table("a<uint> = [* uint]\nb = a<tstr>");
        assert_eq!(table.get("a").map(|rule| rule.params().len()), Some(1));
    }

    /// A generic rule cited at another arity, or at none, is refused at the citing line.
    /// ´claim:resolve:a-generic-must-be-cited-at-its-arity´
    #[test]
    fn a_generic_at_the_wrong_arity_is_refused() {
        assert!(matches!(
            refuse("a<t, u> = [t, u]\nb = a<uint>"),
            TheoryError::Syntax { line: 2, .. }
        ));
    }

    /// (´claim:resolve:a-generic-must-be-cited-at-its-arity´)
    #[test]
    fn a_generic_cited_without_arguments_is_refused() {
        assert!(matches!(
            refuse("a<t> = [* t]\nb = a"),
            TheoryError::Syntax { .. }
        ));
    }

    /// A socket nothing plugs resolves to nothing, and that is no refusal.
    /// ´claim:resolve:an-unplugged-socket-resolves-to-nothing´
    #[test]
    fn an_undefined_type_socket_resolves_to_nothing() {
        let table = table("a = {0 => $extension}");
        assert!(table.get("$extension").is_none());
    }

    /// (´claim:resolve:an-unplugged-socket-resolves-to-nothing´)
    #[test]
    fn an_undefined_group_socket_resolves_to_nothing() {
        let table = table("a = {0 => uint, * $$extension}");
        assert!(table.get("$$extension").is_none());
    }

    /// A socket collects its plugs into one choice, in the order they were written.
    /// ´claim:resolve:a-socket-collects-its-plugs-in-order´
    #[test]
    fn a_plugged_type_socket_collects_its_plugs_in_order() {
        let table = table("a = $message\n$message /= [1, tstr]\n$message /= [2, uint]");
        assert_eq!(printed(&table, "$message"), "[1, tstr] / [2, uint]");
    }

    /// (´claim:resolve:a-socket-collects-its-plugs-in-order´)
    #[test]
    fn a_plugged_group_socket_collects_its_plugs_in_order() {
        let table = table("a = {0 => uint, * $$opt}\n$$opt //= (1 => tstr)\n$$opt //= (2 => uint)");
        assert_eq!(printed(&table, "$$opt"), "(1 => tstr // 2 => uint)");
    }

    /// An augmenting assignment extends the rule it names into a choice.
    /// ´claim:resolve:an-augmenting-assignment-extends-its-base´
    #[test]
    fn a_type_choice_augments_a_defined_base() {
        let table = table("a = 1\na /= 2\na /= 3");
        assert_eq!(printed(&table, "a"), "1 / 2 / 3");
    }

    /// (´claim:resolve:an-augmenting-assignment-extends-its-base´)
    #[test]
    fn a_type_choice_augments_a_prelude_rule() {
        let table = table("a = {0 => uint}\nuint /= tstr");
        assert_eq!(printed(&table, "uint"), "#0 / tstr");
    }

    /// A name defined twice is admitted where the definitions agree and refused where they differ.
    /// ´claim:resolve:a-name-defined-twice-must-agree´
    #[test]
    fn a_name_defined_twice_identically_is_admitted() {
        let table = table("a = {0 => uint}\nb = 1\nb = 1");
        assert_eq!(printed(&table, "b"), "1");
    }

    /// (´claim:resolve:a-name-defined-twice-must-agree´)
    #[test]
    fn a_name_defined_twice_differently_is_refused() {
        assert!(matches!(
            refuse("a = {0 => uint}\nb = 1\nb = 2"),
            TheoryError::Syntax { line: 3, .. }
        ));
    }

    /// The conventions' base theory resolves, every rule it names being found.
    /// ´claim:resolve:the-conventions-base-theory-resolves´
    #[test]
    fn the_conventions_base_theory_resolves() {
        let source = concat!(
            "global = {\n",
            "  0 => namespace-label,\n",
            "  1 => version,\n",
            "  * (uint .gt 1) => any\n",
            "}\n",
            "version = [major: uint, minor: uint, patch: uint]\n",
            "namespace-label = namespace-form .size (3..255)\n",
            "namespace-form = tstr .regexp \"[a-z0-9]\"\n",
        );
        let table = table(source);
        assert!(table.get("namespace-form").is_some());
        assert!(table.get("version").is_some());
    }

    /// Every document of the standard's own corpus parses and then resolves.
    /// ´claim:resolve:the-standards-examples-resolve´
    #[test]
    fn the_rfc_appendix_h_examples_resolve() {
        for (what, source) in super::super::parse::CORPUS {
            let cddl = match parse(source) {
                Ok(cddl) => cddl,
                Err(error) => panic!("{what} did not parse: {error}"),
            };
            if let Err(error) = RuleTable::build(&cddl) {
                panic!("{what} did not resolve: {error}");
            }
        }
    }
}
