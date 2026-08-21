//! The normalized printer: a syntax tree back to CDDL, laid out one way.
//!
//! Two jobs. It renders a theory for a human reading a diagnostic, and it
//! renders a theory for a machine comparing two of them — which is why the
//! output is a *normal form* and not a reproduction. Type identity in this
//! crate is defined by this printer and by nothing else, so that there is
//! one definition of when two types are the same rather than two that can
//! drift apart.
//!
//! # The normal form
//!
//! - **One rule per line**, in source order, each line ending in a line
//!   feed. No blank lines, no indentation, no line wrapping: a rule is one
//!   line however long it is, so that a difference between two theories is
//!   a difference between two lines.
//! - **Comments are dropped.** They are `S` in the grammar, and the source
//!   they were written in is kept elsewhere, byte for byte.
//! - **Group entries are separated by `, `**, always, and never followed by
//!   a trailing comma. `optcom = S ["," S]` gives the comma no meaning, so
//!   normalizing it away is normalizing layout and not content.
//! - **Whitespace is one space where a space is wanted** and nowhere else:
//!   `{a: 1, b: 2}`, `[* text]`, `a<int, text>`.
//! - **Literals keep their spelling.** `0x18` does not become `24`, `1.0`
//!   does not become `1`, and an escape stays the escape that was written.
//!   Rewriting a literal would be rewriting the theory.
//!
//! # Where a space is not cosmetic
//!
//! Three of them are load bearing, because dropping them would change what
//! the text means when it is read back:
//!
//! - A control operator is printed as ` .name `, with the leading space,
//!   because `a.size` is one identifier (`id` admits interior dots).
//! - A range is printed as ` .. `, with both spaces, for the same reason:
//!   `min..max` would be one identifier.
//! - An occurrence indicator is followed by a space, because `*3` printed
//!   against the entry `3` would read back as the bound of a `*`.
//!
//! And two adjacencies are load bearing in the other direction: generic
//! arguments must touch their name (`a<int>`) and a tag must touch its
//! parenthesis (`#6.24(bstr)`), since the ABNF admits no `S` in either
//! place.
//!
//! # The fixed point
//!
//! Printing is idempotent through a reparse: for every document the parser
//! accepts, `print(parse(x))` parses, and printing *that* tree gives the
//! same text. The property is asserted over the RFC's own documents and
//! over a snippet per production; it is what makes the printed form usable
//! as an identity.

use super::ast::{
    Assign, Cddl, GenericArgs, GenericParams, Group, GroupChoice, GroupEntry, GroupEntryKind,
    MemberKey, MemberKeyKind, Occur, OccurKind, Operator, Rule, RuleBody, Type, Type1, Type2,
    Type2Kind, Uint, Value, ValueKind,
};

/// A whole document in normal form, one rule per line.
pub(crate) fn print(cddl: &Cddl) -> String {
    let mut out = String::new();
    for rule in &cddl.rules {
        print_rule(rule, &mut out);
        out.push('\n');
    }
    out
}

/// One rule, without its line feed.
pub(crate) fn print_rule(rule: &Rule, out: &mut String) {
    out.push_str(&rule.name.text);
    if let Some(params) = &rule.params {
        print_generic_params(params, out);
    }
    out.push(' ');
    out.push_str(rule.assign.as_str());
    out.push(' ');
    match &rule.body {
        RuleBody::Type(ty) => print_type(ty, out),
        RuleBody::Group(entry) => print_group_entry(entry, out),
    }
}

/// A type, for a diagnostic that names one.
pub(crate) fn print_type(ty: &Type, out: &mut String) {
    for (index, choice) in ty.choices.iter().enumerate() {
        if index > 0 {
            out.push_str(" / ");
        }
        print_type1(choice, out);
    }
}

fn print_generic_params(params: &GenericParams, out: &mut String) {
    out.push('<');
    for (index, name) in params.names.iter().enumerate() {
        if index > 0 {
            out.push_str(", ");
        }
        out.push_str(&name.text);
    }
    out.push('>');
}

/// Generic arguments, which must touch the name in front of them.
fn print_generic_args(args: &GenericArgs, out: &mut String) {
    out.push('<');
    for (index, arg) in args.args.iter().enumerate() {
        if index > 0 {
            out.push_str(", ");
        }
        print_type1(arg, out);
    }
    out.push('>');
}

fn print_generic_args_opt(args: &Option<GenericArgs>, out: &mut String) {
    if let Some(args) = args {
        print_generic_args(args, out);
    }
}

fn print_type1(type1: &Type1, out: &mut String) {
    print_type2(&type1.target, out);
    if let Some(operation) = &type1.operation {
        match &operation.operator {
            Operator::RangeInclusive => out.push_str(" .. "),
            Operator::RangeExclusive => out.push_str(" ... "),
            Operator::Control(name) => {
                // The leading space keeps the dot out of the name before
                // it; the trailing one keeps the operand off the name.
                out.push_str(" .");
                out.push_str(&name.text);
                out.push(' ');
            }
        }
        print_type2(&operation.operand, out);
    }
}

fn print_type2(type2: &Type2, out: &mut String) {
    match &type2.kind {
        Type2Kind::Value(value) => print_value(value, out),
        Type2Kind::Typename { name, args } => {
            out.push_str(&name.text);
            print_generic_args_opt(args, out);
        }
        Type2Kind::Parenthesized(inner) => {
            out.push('(');
            print_type(inner, out);
            out.push(')');
        }
        Type2Kind::Map(group) => {
            out.push('{');
            print_group(group, out);
            out.push('}');
        }
        Type2Kind::Array(group) => {
            out.push('[');
            print_group(group, out);
            out.push(']');
        }
        Type2Kind::Unwrap { name, args } => {
            out.push('~');
            out.push_str(&name.text);
            print_generic_args_opt(args, out);
        }
        Type2Kind::EnumInline(group) => {
            out.push_str("&(");
            print_group(group, out);
            out.push(')');
        }
        Type2Kind::EnumGroup { name, args } => {
            out.push('&');
            out.push_str(&name.text);
            print_generic_args_opt(args, out);
        }
        Type2Kind::Tagged { number, inner } => {
            out.push_str("#6");
            print_ai(number, out);
            // No `S` stands between the head and its parenthesis.
            out.push('(');
            print_type(inner, out);
            out.push(')');
        }
        Type2Kind::Representation { major, ai } => {
            out.push('#');
            out.push_str(&major.to_string());
            print_ai(ai, out);
        }
        Type2Kind::Any => out.push('#'),
    }
}

fn print_ai(ai: &Option<Uint>, out: &mut String) {
    if let Some(ai) = ai {
        out.push('.');
        out.push_str(&ai.text);
    }
}

fn print_group(group: &Group, out: &mut String) {
    for (index, choice) in group.choices.iter().enumerate() {
        if index > 0 {
            out.push_str(" // ");
        }
        print_group_choice(choice, out);
    }
}

fn print_group_choice(choice: &GroupChoice, out: &mut String) {
    for (index, entry) in choice.entries.iter().enumerate() {
        if index > 0 {
            out.push_str(", ");
        }
        print_group_entry(entry, out);
    }
}

/// One group entry, for the companion display and for diagnostics.
pub(crate) fn print_group_entry(entry: &GroupEntry, out: &mut String) {
    if let Some(occur) = &entry.occur {
        print_occur(occur, out);
        // The space is required: `*3` against the entry `3` would read
        // back as the upper bound of the indicator.
        out.push(' ');
    }
    match &entry.kind {
        GroupEntryKind::Member { key, value } => {
            if let Some(key) = key {
                print_member_key(key, out);
            }
            print_type(value, out);
        }
        GroupEntryKind::Inline(group) => {
            out.push('(');
            print_group(group, out);
            out.push(')');
        }
    }
}

fn print_occur(occur: &Occur, out: &mut String) {
    match &occur.kind {
        OccurKind::Bounded { min, max } => {
            // No `S` anywhere inside `occur`, so the bounds touch the star.
            if let Some(min) = min {
                out.push_str(&min.text);
            }
            out.push('*');
            if let Some(max) = max {
                out.push_str(&max.text);
            }
        }
        OccurKind::OneOrMore => out.push('+'),
        OccurKind::Optional => out.push('?'),
    }
}

fn print_member_key(key: &MemberKey, out: &mut String) {
    match &key.kind {
        MemberKeyKind::Type { key, cut } => {
            print_type1(key, out);
            if *cut {
                out.push_str(" ^");
            }
            out.push_str(" => ");
        }
        MemberKeyKind::Bareword(name) => {
            out.push_str(&name.text);
            out.push_str(": ");
        }
        MemberKeyKind::Value(value) => {
            print_value(value, out);
            out.push_str(": ");
        }
    }
}

fn print_value(value: &Value, out: &mut String) {
    match &value.kind {
        ValueKind::Number(number) => out.push_str(&number.text),
        ValueKind::Text(text) => {
            out.push('"');
            out.push_str(text);
            out.push('"');
        }
        ValueKind::Bytes { qual, raw } => {
            out.push_str(qual.as_str());
            out.push('\'');
            out.push_str(raw);
            out.push('\'');
        }
    }
}

/// Whether an assignment operator settles which kind of rule it heads.
///
/// Offered here rather than inferred at each call: `=` does not, which is
/// what makes the parser's fallback necessary and the printer's fidelity
/// on that fallback worth asserting.
pub(crate) fn assignment_is_unambiguous(assign: Assign) -> bool {
    assign != Assign::Plain
}

#[cfg(test)]
mod tests {
    use super::super::parse::{CORPUS, parse};
    use super::*;

    /// A snippet per production family, in already-normal form where the
    /// normal form is the obvious one.
    const TOUR: &[&str] = &[
        "a = 1",
        "a = -42",
        "a = 0x2a",
        "a = 0b1010",
        "a = 1.5",
        "a = 1e3",
        "a = 0x1.8p3",
        "a = \"text\"",
        "a = \"a\\\"b\"",
        "a = ''",
        "a = h'0f0f'",
        "a = b64'aGk='",
        "a = int / text / bool",
        "a = 1 .. 10",
        "a = 1 ... 10",
        "a = min .. max",
        "a = text .size 4",
        "a = text .regexp \"a+\"",
        "a = (int)",
        "a = {}",
        "a = []",
        "a = {b: 1}",
        "a = {b: 1, c: 2}",
        "a = {b: 1 // c: 2}",
        "a = {b: 1 // }",
        "a = [1, 2, 3]",
        "a = ~b",
        "a = &(x: 1, y: 2)",
        "a = &b",
        "a = #",
        "a = #2",
        "a = #7.25",
        "a = #6(bstr)",
        "a = #6.24(bstr)",
        "a = #6.0x18(bstr)",
        "a = [* b]",
        "a = [+ b]",
        "a = [? b]",
        "a = [2* b]",
        "a = [*3 b]",
        "a = [2*3 b]",
        "a = {* text => any}",
        "a = {b ^ => 1}",
        "a = {1: 2}",
        "a = {\"b\": 1}",
        "a = {h'ff': 1}",
        "a<b, c> = [b, c]",
        "a = messages<int, text>",
        "a = ~envelope<int>",
        "a = &choices<int>",
        "a /= text",
        "a //= (b: 1)",
        "a = (b: 1, c: 2)",
        "a = * text",
        "a = [#6, (b)]",
        "a = [(b, c)]",
        "$socket /= text",
        "$$plug //= (sack: true)",
        "a = 1\nb = 2",
    ];

    fn normalize(source: &str) -> String {
        match parse(source) {
            Ok(cddl) => print(&cddl),
            Err(error) => panic!("expected {source:?} to parse, but: {error}"),
        }
    }

    /// The property the printed form has to have to be an identity:
    /// normalizing a normalized document changes nothing.
    fn assert_fixed_point(what: &str, source: &str) {
        let once = normalize(source);
        let twice = normalize(&once);
        assert_eq!(once, twice, "{what} is not a fixed point");
    }

    #[test]
    fn every_corpus_document_reaches_a_fixed_point() {
        for (what, source) in CORPUS {
            assert_fixed_point(what, source);
        }
    }

    #[test]
    fn every_production_reaches_a_fixed_point() {
        for source in TOUR {
            assert_fixed_point(source, source);
        }
    }

    #[test]
    fn the_tour_is_already_in_normal_form() {
        // Not required for the fixed point, but it keeps the snippets
        // honest about what the normal form actually is.
        for source in TOUR {
            assert_eq!(normalize(source), format!("{source}\n"), "{source}");
        }
    }

    #[test]
    fn one_rule_to_a_line() {
        assert_eq!(normalize("a = 1 b = 2 c = 3"), "a = 1\nb = 2\nc = 3\n");
    }

    #[test]
    fn comments_do_not_survive_normalization() {
        assert_eq!(normalize("; leading\na = 1 ; trailing\n"), "a = 1\n");
    }

    #[test]
    fn optional_commas_become_commas() {
        assert_eq!(normalize("a = {b: 1 c: 2}"), "a = {b: 1, c: 2}\n");
        assert_eq!(normalize("a = {b: 1, c: 2,}"), "a = {b: 1, c: 2}\n");
        assert_eq!(normalize("a = [1 2]"), "a = [1, 2]\n");
    }

    #[test]
    fn whitespace_collapses_to_the_normal_form() {
        assert_eq!(normalize("a   =   {   b   :   1   }"), "a = {b: 1}\n");
        assert_eq!(normalize("a\n=\n1"), "a = 1\n");
    }

    #[test]
    fn literals_keep_the_spelling_they_were_given() {
        assert_eq!(normalize("a = 0x18"), "a = 0x18\n");
        assert_eq!(normalize("a = 1.0"), "a = 1.0\n");
        assert_eq!(normalize("a = 1E5"), "a = 1E5\n");
        assert_eq!(normalize("a = \"\\q\""), "a = \"\\q\"\n");
    }

    #[test]
    fn a_control_operator_keeps_the_space_that_makes_it_one() {
        // Printed without the leading space this would read back as the
        // single name `text.size`.
        let printed = normalize("a = text .size 4");
        assert_eq!(printed, "a = text .size 4\n");
        let reparsed = normalize(&printed);
        assert_eq!(reparsed, printed);
    }

    #[test]
    fn a_range_over_names_keeps_its_spaces() {
        let printed = normalize("a = min..max");
        // `min..max` is one name, so this was never a range at all.
        assert_eq!(printed, "a = min..max\n");
        // Written with the spaces, it is one, and it stays one.
        assert_eq!(normalize("a = min .. max"), "a = min .. max\n");
    }

    #[test]
    fn an_occurrence_indicator_keeps_its_bounds_against_the_star() {
        assert_eq!(normalize("a = [2*3 b]"), "a = [2*3 b]\n");
        // And keeps the space that stops the entry joining the bound.
        assert_eq!(normalize("a = [* 3]"), "a = [* 3]\n");
    }

    #[test]
    fn generic_arguments_stay_against_their_name() {
        assert_eq!(normalize("a = m<int, text>"), "a = m<int, text>\n");
        assert_eq!(normalize("m<x> = [x]"), "m<x> = [x]\n");
    }

    #[test]
    fn a_tag_stays_against_its_parenthesis() {
        assert_eq!(normalize("a = #6.24(bstr)"), "a = #6.24(bstr)\n");
        // The one held off by a space is not a tag but two group entries,
        // and printing must not let them join into one.
        assert_eq!(normalize("a = [#6 (b)]"), "a = [#6, (b)]\n");
    }

    #[test]
    fn the_two_readings_of_an_equals_rule_both_survive_a_round_trip() {
        assert_eq!(normalize("a = (1)"), "a = (1)\n");
        assert_eq!(normalize("a = (1, 2)"), "a = (1, 2)\n");
        assert_eq!(normalize("a = ( rater: text )"), "a = (rater: text)\n");
    }

    #[test]
    fn the_verbose_and_compact_reputon_definitions_normalize_as_written() {
        let (_, verbose) = CORPUS[0];
        let printed = normalize(verbose);
        assert!(printed.starts_with("reputation-object = {reputation-context, reputon-list}\n"));
        assert!(printed.contains("ext-value = (text => any)\n"));

        let (_, compact) = CORPUS[1];
        let printed = normalize(compact);
        assert!(
            printed.starts_with("reputation-object = {application: text, reputons: [* reputon]}\n")
        );
        assert!(printed.contains("* text => any"));
    }

    #[test]
    fn the_prelude_normalizes_to_forty_lines() {
        let (_, prelude) = CORPUS[2];
        let printed = normalize(prelude);
        assert_eq!(printed.lines().count(), 40);
        assert!(printed.starts_with("any = #\n"));
        assert!(printed.contains("decfrac = #6.4([e10: int, m: integer])\n"));
        assert!(printed.ends_with("undefined = #7.23\n"));
    }

    #[test]
    fn only_the_augmenting_assignments_settle_a_rules_kind() {
        assert!(!assignment_is_unambiguous(Assign::Plain));
        assert!(assignment_is_unambiguous(Assign::TypeChoice));
        assert!(assignment_is_unambiguous(Assign::GroupChoice));
    }
}
