//! The `.regexp` seam: the only module in the crate that names the
//! regular-expression library.
//!
//! The signed exception that admits a regex engine at all is scoped to
//! this operator, not to the crate, so every other recognizer here is a
//! hand-written scanner (`design.md`, `dec:xchg:regexp-seam`). The seam is
//! three methods wide — compile, match, and the pattern as given — and it
//! stays one file, so replacing the engine behind it is a one-file change.
//!
//! Two properties are required of whatever stands behind it: that it
//! implement the XSD flavor itself, so this crate holds a wrapper and never
//! a translator; and that compiling a pattern not execute it, so a pattern
//! this crate cannot use is refused at `Theory::parse` rather than at match
//! time. The engine is `regexml` (`dec:xchg:regexp-engine`), entered
//! through `Regex::xsd` and never through `Regex::xpath`, whose XPath
//! `fn:matches` semantics are a substring search that would accept subjects
//! `.regexp` rejects.
//!
//! # XSD divergences
//!
//! RFC 8610 §3.8.3 defines `.regexp` against the XSD flavor, which differs
//! from the Perl-descended dialect every mainstream engine implements in
//! ways that are not stylistic. The design records the divergences
//! (`rep:xchg:xsd-divergences`); each is asserted against this engine's
//! actual behavior in the tests below, so the list is checked rather than
//! recited.
//!
//! - **Anchoring is implicit** at head and tail. There is no partial-match
//!   method here and never will be, and no anchoring is done to the
//!   engine's answer: running an engine unanchored and comparing the match
//!   span against the subject's length is wrong, because a leftmost-first
//!   engine returns the first alternative that matches at the leftmost
//!   position — `a|ab` against `ab` yields a match of span 0 to 1, and a
//!   span check would reject a subject XSD accepts
//!   (`conv:xchg:regexp-anchoring`).
//!
//! # Open: the engine's public matcher is unanchored
//!
//! The first of those divergences is not met by the engine as its public
//! API stands, and the shortfall is recorded here rather than papered over.
//! `Regex::is_match` searches: it reports a match wherever one begins, so
//! `a` answers true against `ab`, which XSD rejects. That is the XPath
//! `fn:matches` reading, and it holds under `Regex::xsd` as much as under
//! `Regex::xpath`, because the language argument selects the pattern
//! dialect and not the matching discipline.
//!
//! The anchored discipline is implemented in the port — `ReMatcher::
//! match_at(0, true)` makes end-of-program succeed only at the end of the
//! subject, which is exactly whole-string matching — but both the method
//! and the matcher are `pub(crate)`, so no caller can reach it. The remedy
//! is upstream (an anchored entry point on `Regex`) or a pinned fork, and
//! it is a decision above this file: the two workarounds available here are
//! a span check, which the design rejects by name, and a translation into
//! another dialect, which the seam exists to prevent. Until it is settled,
//! [`XsdPattern::is_match`] carries the engine's search semantics, the
//! contract it owes stands as an ignored test, and nothing in the crate
//! evaluates a `.regexp` against a document.
//! - **`^` and `$` are ordinary characters**, matching themselves. Because
//!   anchoring is implicit, XSD makes them metacharacters nowhere.
//! - **Character-class subtraction** `[a-z-[aeiou]]` exists.
//! - **The multi-character escapes** `\i`, `\I`, `\c`, and `\C` name the
//!   XML name-start and name characters.
//! - **Backreferences, lookaround, and lazy quantifiers are absent.** The
//!   third runs in the dangerous direction: `a*?` is not a lazy quantifier
//!   in XSD, so an engine reading it as one would accept a pattern XSD
//!   rejects. This engine refuses it.
//!
//! # One level of string escaping
//!
//! A pattern arrives inside a CDDL text literal, and RFC 8610 §3.8.3.1 is
//! explicit that "there is one level of string escaping before the XSD
//! escaping rules are applied". What reaches [`XsdPattern::compile`] is
//! therefore the *denotation* of the literal, not its spelling: the
//! conventions' own pattern is written `\\.` in CDDL and compiled as `\.`.
//! Undoing the CDDL level belongs to the syntax tree that holds the
//! literal, not to this module.
//!
//! # Runtime characterization
//!
//! A Saxon-derived engine backtracks, so no linear-time bound in the length
//! of the subject is available by construction, and the guard duty
//! (`req:xchg:regexp-guard`) is discharged by measurement rather than
//! assumption. The measurements stand in [`tests::pathological_patterns`]:
//! on the classic exponential shapes — nested quantifiers over an
//! alternation, `(a+)+b` and its relatives — against subjects sized to
//! expose blowup, every pattern completed in single-digit milliseconds,
//! three orders of magnitude inside the two-second bound the test asserts.
//! No match budget stands at the seam, because the measurement did not
//! demand one; the exposure it bounds is narrow either way, since patterns
//! execute only out of theories a reader deliberately acquired.

// The seam lands before its consumer: the `Theory::parse` pipeline that
// compiles a theory's patterns is the next commit, and until it arrives
// the match and source accessors are exercised only by the tests below.
// The allow is scoped to this module and comes off with that pipeline.
#![allow(dead_code)]

use std::sync::Arc;

use regexml::Regex;

use crate::error::RegexpError;

/// A compiled XSD regular expression, as `.regexp` means it.
///
/// Held behind an [`Arc`] because the engine's `Regex` is not [`Clone`] and
/// a `Theory` is: a theory carries every pattern it compiled, and cloning
/// one must not recompile them.
#[derive(Clone, Debug)]
pub(crate) struct XsdPattern {
    source: Box<str>,
    regex: Arc<Regex>,
}

impl XsdPattern {
    /// Compile a pattern under XML Schema rules.
    ///
    /// A pattern this crate cannot use is refused here rather than at match
    /// time, which is what makes satisfaction total once a `Theory` exists.
    ///
    /// The flags argument the engine takes is always empty: XSD flags are
    /// an XPath-level notion that `.regexp` gives no syntax for, so there
    /// is nothing for a caller to pass and no parameter to pass it through.
    pub(crate) fn compile(pattern: &str) -> Result<XsdPattern, RegexpError> {
        match Regex::xsd(pattern, "") {
            Ok(regex) => Ok(XsdPattern {
                source: pattern.into(),
                regex: Arc::new(regex),
            }),
            Err(regexml::Error::Syntax(detail)) => Err(RegexpError::Malformed { detail }),
            Err(other) => Err(RegexpError::EngineRefused {
                detail: format!("{other:?}"),
            }),
        }
    }

    /// Whether the pattern matches the whole of `text`.
    ///
    /// XSD regular expressions are implicitly anchored at head and tail, so
    /// there is no partial-match method here and never will be, and no
    /// anchoring is applied to the engine's answer.
    ///
    /// **The engine does not yet deliver that contract.** `regexml` 0.2.2
    /// exposes only an unanchored search, so what this returns today is
    /// "the pattern matches somewhere in `text`" — which accepts subjects
    /// XSD rejects. The module documentation carries the finding and the
    /// two workarounds it rules out. No caller in this crate evaluates a
    /// `.regexp` against a document, so no wrong answer is reachable
    /// through the public API; the method exists because the seam is
    /// three methods wide and compiling a pattern is the half that works.
    pub(crate) fn is_match(&self, text: &str) -> bool {
        self.regex.is_match(text)
    }

    /// The pattern as given, for diagnostics.
    pub(crate) fn source(&self) -> &str {
        &self.source
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::*;

    /// Compile, or fail the test naming the pattern that would not compile.
    fn compile(pattern: &str) -> XsdPattern {
        match XsdPattern::compile(pattern) {
            Ok(compiled) => compiled,
            Err(error) => panic!("expected {pattern:?} to compile, but: {error}"),
        }
    }

    fn refuse(pattern: &str) -> RegexpError {
        match XsdPattern::compile(pattern) {
            Ok(_) => panic!("expected {pattern:?} to be refused, but it compiled"),
            Err(error) => error,
        }
    }

    /// The contract [`XsdPattern::is_match`] owes, kept as a runnable test
    /// against the day the engine can meet it. Every assertion here is a
    /// negative the current engine answers wrongly, because its public
    /// matcher searches rather than matches; the positives beside them are
    /// asserted in the tests that run.
    #[test]
    #[ignore = "regexml 0.2.2 exposes no anchored matcher — see the module documentation"]
    fn xsd_whole_string_matching() {
        let p = compile("a");
        assert!(p.is_match("a"));
        assert!(!p.is_match("ab"));
        assert!(!p.is_match("ba"));
        assert!(!p.is_match("bab"));

        // The counterexample that rules out a span check: a leftmost-first
        // engine matches `a` here and reports span 0..1, so a span check
        // rejects a subject XSD accepts through the second alternative.
        let alternation = compile("a|ab");
        assert!(alternation.is_match("ab"));
        assert!(!alternation.is_match("abc"));

        let bounded = compile("a{2,3}");
        assert!(!bounded.is_match("aaaa"));

        let three = compile(".{3}");
        assert!(!three.is_match("äöüx"));

        let label = compile(r"[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+");
        assert!(!label.is_match("Com.example"));
        assert!(!label.is_match("com.example "));
    }

    /// What the engine does today, asserted so that the divergence is a
    /// checked fact rather than a remembered one. The day this test fails
    /// is the day the seam's contract is met.
    #[test]
    fn the_engine_searches_where_xsd_matches() {
        let p = compile("a");
        assert!(
            p.is_match("ab"),
            "the engine has gained anchored matching: un-ignore xsd_whole_string_matching \
             and delete this test"
        );
    }

    /// Both alternatives are reachable, which is what a span check would
    /// break even against an anchored engine.
    #[test]
    fn alternation_reaches_its_second_branch() {
        let p = compile("a|ab");
        assert!(p.is_match("ab"));
        assert!(p.is_match("a"));
    }

    #[test]
    fn caret_is_an_ordinary_character() {
        let p = compile("^a");
        assert!(p.is_match("^a"));
        assert!(!p.is_match("a"));
    }

    #[test]
    fn dollar_is_an_ordinary_character() {
        let p = compile("a$");
        assert!(p.is_match("a$"));
        assert!(!p.is_match("a"));
    }

    /// The engine reads an escaped `$` as an error rather than as the
    /// character, which is stricter than treating `$` as ordinary and is
    /// the engine's own reading of the XSD escape table.
    #[test]
    fn an_escaped_dollar_is_refused() {
        assert!(matches!(refuse(r"a\$"), RegexpError::Malformed { .. }));
    }

    #[test]
    fn character_classes_subtract() {
        let p = compile("[a-z-[aeiou]]");
        assert!(p.is_match("b"));
        assert!(p.is_match("z"));
        assert!(!p.is_match("a"));
        assert!(!p.is_match("u"));
    }

    #[test]
    fn the_xml_name_start_escape_is_understood() {
        let p = compile(r"\i");
        assert!(p.is_match("a"));
        assert!(p.is_match("_"));
        assert!(p.is_match(":"));
        assert!(!p.is_match("1"));
        assert!(!p.is_match("-"));
    }

    #[test]
    fn the_xml_name_escape_is_understood() {
        let p = compile(r"\c");
        assert!(p.is_match("a"));
        assert!(p.is_match("-"));
        assert!(p.is_match("."));
        assert!(p.is_match("1"));
        assert!(!p.is_match(" "));
    }

    #[test]
    fn the_name_escapes_have_complements() {
        let start = compile(r"\I");
        assert!(start.is_match("1"));
        assert!(!start.is_match("a"));

        let name = compile(r"\C");
        assert!(name.is_match(" "));
        assert!(!name.is_match("a"));
    }

    /// The divergence in the dangerous direction: an engine reading `a*?`
    /// as a lazy quantifier would accept a pattern XSD rejects and match a
    /// different language. This engine rejects it.
    #[test]
    fn lazy_quantifiers_are_refused() {
        assert!(matches!(refuse("a*?"), RegexpError::Malformed { .. }));
        assert!(matches!(refuse("a+?"), RegexpError::Malformed { .. }));
        assert!(matches!(refuse("a{2,3}?"), RegexpError::Malformed { .. }));
    }

    #[test]
    fn backreferences_are_refused() {
        assert!(matches!(refuse(r"(a)\1"), RegexpError::Malformed { .. }));
    }

    #[test]
    fn lookaround_is_refused() {
        assert!(matches!(refuse("(?=a)b"), RegexpError::Malformed { .. }));
    }

    #[test]
    fn malformed_patterns_carry_the_engines_account() {
        for pattern in ["[a-", "(a", "a{2,1}", "*a"] {
            match XsdPattern::compile(pattern) {
                Ok(_) => panic!("expected {pattern:?} to be refused"),
                Err(RegexpError::Malformed { detail }) => {
                    assert!(!detail.is_empty(), "{pattern:?} refused with no account")
                }
                Err(other) => panic!("expected {pattern:?} malformed, got {other}"),
            }
        }
    }

    #[test]
    fn quantifiers_and_bounds_behave() {
        let p = compile("a{2,3}");
        assert!(!p.is_match("a"));
        assert!(p.is_match("aa"));
        assert!(p.is_match("aaa"));
    }

    #[test]
    fn the_empty_subject_matches_a_nullable_pattern() {
        let p = compile("a*");
        assert!(p.is_match(""));
        assert!(p.is_match("aaa"));
    }

    #[test]
    fn unicode_categories_are_understood() {
        let p = compile(r"\p{Lu}+");
        assert!(p.is_match("AB"));
        assert!(!p.is_match("ab"));
    }

    /// The engine counts characters, not bytes: three non-ASCII characters
    /// are three units to `.{3}`.
    #[test]
    fn non_ascii_subjects_match_by_character() {
        let p = compile(".{3}");
        assert!(p.is_match("äöü"));
        assert!(!p.is_match("ä"));
    }

    #[test]
    fn the_source_is_the_pattern_as_given() {
        let p = compile("[a-z-[aeiou]]");
        assert_eq!(p.source(), "[a-z-[aeiou]]");
    }

    #[test]
    fn a_clone_matches_what_the_original_matched() {
        let p = compile("a+");
        let q = p.clone();
        assert!(q.is_match("aaa"));
        assert_eq!(q.source(), p.source());
    }

    /// The conventions' own pattern, as it is denoted after the CDDL level
    /// of string escaping is undone.
    #[test]
    fn the_namespace_form_pattern_recognizes_labels() {
        let p = compile(r"[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+");
        assert!(p.is_match("com.example"));
        assert!(p.is_match("com.example.thing"));
        assert!(p.is_match("a.b"));
        assert!(p.is_match("a-b.c"));
        assert!(!p.is_match("com"));
        assert!(!p.is_match("com."));
        assert!(!p.is_match(".com"));
        assert!(!p.is_match("com.-example"));
        assert!(!p.is_match("com..example"));
    }

    /// The guard duty (`req:xchg:regexp-guard`): a backtracking engine
    /// offers no linear-time bound, so the pathological shapes are measured
    /// rather than assumed. The bound asserted is generous by design — the
    /// question is blowup or no blowup, not milliseconds — and the measured
    /// times are printed so a run can be compared against the module doc.
    ///
    /// Should this ever run away, the remedy is a match budget at the seam,
    /// which changes `is_match`'s contract and is therefore a design
    /// decision, not a test's to make.
    #[test]
    fn pathological_patterns() {
        let budget = Duration::from_secs(2);
        let cases: &[(&str, String)] = &[
            ("(a+)+b", "a".repeat(30)),
            ("(a*)*b", "a".repeat(30)),
            ("(a|a)*b", "a".repeat(30)),
            ("(x+x+)+y", "x".repeat(30)),
            ("(a|b|ab)*c", "ab".repeat(20)),
            ("(a?){20}a{20}", "a".repeat(20)),
            ("([a-z]+)+$", "a".repeat(40)),
        ];

        for (pattern, subject) in cases {
            let compiled = compile(pattern);
            let started = Instant::now();
            let matched = compiled.is_match(subject);
            let elapsed = started.elapsed();
            println!(
                "regexp guard: {pattern:?} against {} chars -> {matched} in {elapsed:?}",
                subject.chars().count()
            );
            assert!(
                elapsed < budget,
                "{pattern:?} took {elapsed:?}, over the {budget:?} bound"
            );
        }
    }

    /// Compilation runs the pattern once against the empty string, because
    /// the engine computes `matches_empty_string` eagerly. The seam cannot
    /// prevent it, so it is measured here beside the match guard.
    #[test]
    fn compilation_of_a_pathological_pattern_is_fast() {
        let budget = Duration::from_secs(2);
        let started = Instant::now();
        let _ = compile("(a+)+(b+)+(c+)+d");
        let elapsed = started.elapsed();
        println!("regexp guard: compile of a nested-quantifier pattern in {elapsed:?}");
        assert!(elapsed < budget, "compilation took {elapsed:?}");
    }
}
