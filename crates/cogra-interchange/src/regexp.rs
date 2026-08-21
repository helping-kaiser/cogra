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
//! # The anchored matcher and the budget, by pinned fork
//!
//! The engine's own `Regex::is_match` searches — the XPath `fn:matches`
//! reading, under `Regex::xsd` as much as under `Regex::xpath`, because
//! the language argument selects the pattern dialect and not the matching
//! discipline. The anchored discipline this seam requires is
//! `Regex::is_full_match_bounded`, exposed by the pinned fork this crate
//! depends on (the anchored exposure is filed upstream as
//! Paligo/regexml#15; when the fork's surface merges and releases, the
//! dependency repoints at crates.io and the fork retires).
//! [`XsdPattern::is_match`] goes through it and through nothing else, so a
//! pattern matches exactly when it accounts for the whole subject, within
//! [`OPS_BUDGET`] operations.
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
//! A Saxon-derived engine backtracks, so no linear-time bound in the
//! length of the subject is available by construction, and the guard duty
//! (`req:xchg:regexp-guard`) is discharged by measurement. Under the
//! correct anchored matching the classic exponential shapes are real —
//! `(a+)+b` against thirty characters measured **761 seconds** unbounded
//! (2026-08-21), where the unanchored search's early-exit optimizations
//! had masked the blowup at microseconds. The remedy the guard requirement
//! pre-authorized therefore stands: every match runs under the
//! deterministic operation budget [`OPS_BUDGET`], exhaustion is a loud
//! refusal and never an answer, and [`tests::pathological_patterns`]
//! asserts both the speed and the honesty of the refusal. The exposure is
//! narrow either way, since patterns execute only out of theories a
//! reader deliberately acquired.

use std::sync::Arc;

use regexml::Regex;

use crate::error::RegexpError;

/// The operation budget of one [`XsdPattern::is_match`] call.
///
/// Calibrated 2026-08-21 against the pinned engine (debug build): the
/// conventions' namespace-form pattern costs 253 operations to accept a
/// 56-character label and 1017 to reject one — rejection is the expensive
/// direction — while `(a+)+b` against thirty characters exhausts any
/// budget (761 s unbounded; ×16 more operations per four characters of
/// subject). 100 000 leaves two orders of magnitude of headroom over the
/// measured legitimate cases and refuses the exponential shapes in
/// single-digit milliseconds. Raising it is a recorded decision, not a
/// tweak: the budget is part of what a verdict means.
pub(crate) const OPS_BUDGET: usize = 100_000;

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

    /// Whether the pattern matches the whole of `text`, within the
    /// operation budget.
    ///
    /// XSD regular expressions are implicitly anchored at head and tail, so
    /// there is no partial-match method here and never will be, and no
    /// anchoring is applied to the engine's answer — the engine's own
    /// anchored matcher delivers it.
    ///
    /// A backtracking engine offers no time bound, so the walk is metered:
    /// a match that does not complete within [`OPS_BUDGET`] operations is
    /// [`RegexpError::BudgetExhausted`], never a bool — refusal is loud,
    /// deterministic, and machine-independent, because the budget counts
    /// operations and not time.
    pub(crate) fn is_match(&self, text: &str) -> Result<bool, RegexpError> {
        self.regex
            .is_full_match_bounded(text, OPS_BUDGET)
            .map_err(|_| RegexpError::BudgetExhausted { budget: OPS_BUDGET })
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

    fn xsd_whole_string_matching() {
        let p = compile("a");
        assert!(p.is_match("a").expect("within budget"));
        assert!(!p.is_match("ab").expect("within budget"));
        assert!(!p.is_match("ba").expect("within budget"));
        assert!(!p.is_match("bab").expect("within budget"));

        // The counterexample that rules out a span check: a leftmost-first
        // engine matches `a` here and reports span 0..1, so a span check
        // rejects a subject XSD accepts through the second alternative.
        let alternation = compile("a|ab");
        assert!(alternation.is_match("ab").expect("within budget"));
        assert!(!alternation.is_match("abc").expect("within budget"));

        let bounded = compile("a{2,3}");
        assert!(!bounded.is_match("aaaa").expect("within budget"));

        let three = compile(".{3}");
        assert!(!three.is_match("äöüx").expect("within budget"));

        let label = compile(r"[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+");
        assert!(!label.is_match("Com.example").expect("within budget"));
        assert!(!label.is_match("com.example ").expect("within budget"));
    }

    /// Both alternatives are reachable, which is what a span check would
    /// break even against an anchored engine.
    #[test]
    fn alternation_reaches_its_second_branch() {
        let p = compile("a|ab");
        assert!(p.is_match("ab").expect("within budget"));
        assert!(p.is_match("a").expect("within budget"));
    }

    #[test]
    fn caret_is_an_ordinary_character() {
        let p = compile("^a");
        assert!(p.is_match("^a").expect("within budget"));
        assert!(!p.is_match("a").expect("within budget"));
    }

    #[test]
    fn dollar_is_an_ordinary_character() {
        let p = compile("a$");
        assert!(p.is_match("a$").expect("within budget"));
        assert!(!p.is_match("a").expect("within budget"));
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
        assert!(p.is_match("b").expect("within budget"));
        assert!(p.is_match("z").expect("within budget"));
        assert!(!p.is_match("a").expect("within budget"));
        assert!(!p.is_match("u").expect("within budget"));
    }

    #[test]
    fn the_xml_name_start_escape_is_understood() {
        let p = compile(r"\i");
        assert!(p.is_match("a").expect("within budget"));
        assert!(p.is_match("_").expect("within budget"));
        assert!(p.is_match(":").expect("within budget"));
        assert!(!p.is_match("1").expect("within budget"));
        assert!(!p.is_match("-").expect("within budget"));
    }

    #[test]
    fn the_xml_name_escape_is_understood() {
        let p = compile(r"\c");
        assert!(p.is_match("a").expect("within budget"));
        assert!(p.is_match("-").expect("within budget"));
        assert!(p.is_match(".").expect("within budget"));
        assert!(p.is_match("1").expect("within budget"));
        assert!(!p.is_match(" ").expect("within budget"));
    }

    #[test]
    fn the_name_escapes_have_complements() {
        let start = compile(r"\I");
        assert!(start.is_match("1").expect("within budget"));
        assert!(!start.is_match("a").expect("within budget"));

        let name = compile(r"\C");
        assert!(name.is_match(" ").expect("within budget"));
        assert!(!name.is_match("a").expect("within budget"));
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
        assert!(!p.is_match("a").expect("within budget"));
        assert!(p.is_match("aa").expect("within budget"));
        assert!(p.is_match("aaa").expect("within budget"));
    }

    #[test]
    fn the_empty_subject_matches_a_nullable_pattern() {
        let p = compile("a*");
        assert!(p.is_match("").expect("within budget"));
        assert!(p.is_match("aaa").expect("within budget"));
    }

    #[test]
    fn unicode_categories_are_understood() {
        let p = compile(r"\p{Lu}+");
        assert!(p.is_match("AB").expect("within budget"));
        assert!(!p.is_match("ab").expect("within budget"));
    }

    /// The engine counts characters, not bytes: three non-ASCII characters
    /// are three units to `.{3}`.
    #[test]
    fn non_ascii_subjects_match_by_character() {
        let p = compile(".{3}");
        assert!(p.is_match("äöü").expect("within budget"));
        assert!(!p.is_match("ä").expect("within budget"));
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
        assert!(q.is_match("aaa").expect("within budget"));
        assert_eq!(q.source(), p.source());
    }

    /// The conventions' own pattern, as it is denoted after the CDDL level
    /// of string escaping is undone.
    #[test]
    fn the_namespace_form_pattern_recognizes_labels() {
        let p = compile(r"[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+");
        assert!(p.is_match("com.example").expect("within budget"));
        assert!(p.is_match("com.example.thing").expect("within budget"));
        assert!(p.is_match("a.b").expect("within budget"));
        assert!(p.is_match("a-b.c").expect("within budget"));
        assert!(!p.is_match("com").expect("within budget"));
        assert!(!p.is_match("com.").expect("within budget"));
        assert!(!p.is_match(".com").expect("within budget"));
        assert!(!p.is_match("com.-example").expect("within budget"));
        assert!(!p.is_match("com..example").expect("within budget"));
    }

    /// The guard duty (`req:xchg:regexp-guard`): a backtracking engine
    /// offers no linear-time bound, so the budget bounds the walk instead,
    /// and this measures that it does. Under anchored matching the
    /// exponential shapes are real — `(a+)+b` against thirty characters
    /// ran 761 seconds unbounded when first measured — so every case must
    /// now finish fast, either with an answer or with the budget refusal,
    /// and a refusal is never disguised as "no match".
    #[test]
    fn pathological_patterns() {
        let bound = Duration::from_secs(2);
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
            let outcome = compiled.is_match(subject);
            let elapsed = started.elapsed();
            println!(
                "regexp guard: {pattern:?} against {} chars -> {outcome:?} in {elapsed:?}",
                subject.chars().count()
            );
            assert!(
                elapsed < bound,
                "{pattern:?} took {elapsed:?}, over the {bound:?} bound"
            );
            assert!(
                matches!(
                    outcome,
                    Ok(false) | Err(RegexpError::BudgetExhausted { .. })
                ),
                "{pattern:?} answered {outcome:?}; these subjects never match"
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
