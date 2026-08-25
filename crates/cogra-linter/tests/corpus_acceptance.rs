//! The corpus acceptance suite: the linter over the real tree
//! (´rep:lint:first-corpus´).
//!
//! *The linter lints its own four discipline documents* is the first honest
//! milestone, followed by the architecture and the interchange and linter
//! phase artifacts — the material already written under the discipline. This
//! suite is that milestone, and it runs over the repository rather than over
//! a fixture: a fixture would be evidence about a fixture.
//!
//! Acceptance is scoped by (´dec:lint:enforcement-partition´). The failing
//! set is the two documentation trees written under the discipline; the
//! advisory remainder is reported and counted and does not fail the lane.
//! The advisory assertions below are therefore about *classes and rough
//! magnitudes*, never exact counts: those drift with every commit to main,
//! and a suite that pinned them would fail for the wrong reason.
//!
//! # One run, shared
//!
//! Every test reads one run, taken once. The pipeline is the subject and
//! running it per test would multiply the slowest thing in the lane by the
//! number of assertions made about it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Instant;

use cogra_linter::graph::NodeKind;
use cogra_linter::{Adoption, Diagnostic, Enforcement, Run, Walk, nodes_of};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::load(&root().join("corpus-adoption.toml")).expect("the adoption data load")
    })
}

/// The whole corpus, checked once.
fn run() -> &'static Run {
    static CHECKED: OnceLock<Run> = OnceLock::new();
    CHECKED.get_or_init(|| {
        cogra_linter::check(adoption(), &root()).expect("the repository root is a directory")
    })
}

/// The four discipline documents, as `[meta] discipline_docs` names them.
fn disciplines() -> Vec<PathBuf> {
    adoption()
        .meta
        .discipline_docs
        .iter()
        .map(|one| PathBuf::from(&**one))
        .collect()
}

/// The linter's own phase artifacts and the architecture that rules them.
const LINTER_ARTIFACTS: [&str; 5] = [
    "crates/cogra-linter/docs/adoption-notes.md",
    "crates/cogra-linter/docs/architecture.md",
    "crates/cogra-linter/docs/concept.md",
    "crates/cogra-linter/docs/design.md",
    "crates/cogra-linter/docs/kickoff.md",
];

/// The defects the interchange crate's phase artifacts carry today, each a
/// bare occurrence where the author meant a citation, plus one import form
/// that shares its parenthesis with prose.
///
/// Recorded here rather than tolerated: the linter reports them, they are
/// the corpus's to repair, and this list is what says so. Repairing them
/// fails this test, which is the intended coupling — the record moves when
/// the corpus does.
const RECORDED_INTERCHANGE_DEFECTS: [(&str, &str); 5] = [
    (
        "crates/cogra-interchange/docs/audit.md",
        "label-near-miss-bracket",
    ),
    (
        "crates/cogra-interchange/docs/audit.md",
        "label-duplicate-mint",
    ),
    (
        "crates/cogra-interchange/docs/commissioning.md",
        "label-duplicate-mint",
    ),
    (
        "crates/cogra-interchange/docs/design.md",
        "label-duplicate-mint",
    ),
    (
        "crates/cogra-interchange/docs/design.md",
        "label-duplicate-mint",
    ),
];

fn under(prefix: &str) -> Vec<&'static Diagnostic> {
    run()
        .findings
        .iter()
        .filter(|one| one.primary.path.starts_with(prefix))
        .collect()
}

fn spell(one: &Diagnostic) -> String {
    format!(
        "{}:{}:{}: {}: {}",
        one.primary.path.display(),
        one.primary.line,
        one.primary.column,
        one.rule,
        one.message
    )
}

fn counted() -> BTreeMap<&'static str, usize> {
    let mut by_rule = BTreeMap::new();
    for one in &run().findings {
        *by_rule.entry(one.rule.as_str()).or_default() += 1;
    }
    by_rule
}

/// (´rep:lint:first-corpus´): the milestone. The four discipline documents
/// practice the disciplines they define, and the linter finds nothing
/// against them.
#[test]
fn the_four_discipline_documents_lint_clean() {
    let mut against = Vec::new();
    for document in disciplines() {
        for one in &run().findings {
            if one.primary.path == document {
                against.push(spell(one));
            }
        }
    }
    assert!(
        against.is_empty(),
        "the four discipline documents carry {} findings:\n{}",
        against.len(),
        against.join("\n")
    );
    assert_eq!(disciplines().len(), 4, "four documents, as adopted");
}

/// (´rep:lint:first-corpus´): the architecture and the linter's own phase
/// artifacts, which is the second half of the milestone.
#[test]
fn the_linters_own_phase_artifacts_lint_clean() {
    let mut against = Vec::new();
    for document in LINTER_ARTIFACTS {
        for one in &run().findings {
            if one.primary.path == Path::new(document) {
                against.push(spell(one));
            }
        }
    }
    assert!(
        against.is_empty(),
        "the linter's own artifacts carry {} findings:\n{}",
        against.len(),
        against.join("\n")
    );
}

/// (´dec:lint:enforcement-partition´): the failing set is exactly the two
/// documentation trees, and every finding in it is either clean or one of
/// the recorded interchange defects.
#[test]
fn the_failing_set_carries_only_the_recorded_defects() {
    let mut failing: Vec<(String, &str)> = run()
        .failing()
        .map(|one| (one.primary.path.display().to_string(), one.rule.as_str()))
        .collect();
    failing.sort();
    let mut recorded: Vec<(String, &str)> = RECORDED_INTERCHANGE_DEFECTS
        .iter()
        .map(|(path, rule)| ((*path).to_owned(), *rule))
        .collect();
    recorded.sort();
    assert_eq!(
        failing,
        recorded,
        "the failing set moved:\n{}",
        run().failing().map(spell).collect::<Vec<_>>().join("\n")
    );
}

/// (´rep:lint:first-corpus´): the advisory remainder produces the classes
/// the concept predicted — the docs trees' stray spans, the Rust backtick
/// near-misses, and the plain-comment sweep — at the magnitudes it named.
///
/// The concept's own figures were a raw-text sweep of 2026-08-25, which can
/// only over-count on the citation side and under-counts the comment sweep,
/// participation being an AST fact no sweep sees. The bounds here are wide
/// enough to be about classes rather than about a commit.
#[test]
fn the_advisory_remainder_carries_the_expected_classes() {
    let by_rule = counted();
    println!("findings by rule, over {} sources:", run().sources.len());
    for (rule, count) in &by_rule {
        println!("  {rule}: {count}");
    }
    let unresolved = by_rule
        .get("label-unresolved-citation")
        .copied()
        .unwrap_or_default();
    assert!(
        (10..100).contains(&unresolved),
        "the docs trees' unresolved same-owner citations: {unresolved}"
    );
    let backticks = by_rule
        .get("label-backtick-in-code")
        .copied()
        .unwrap_or_default();
    assert!(
        (40..200).contains(&backticks),
        "the Rust backtick near-misses the concept counted at 88: {backticks}"
    );
    let comments = by_rule
        .get("rust-plain-line-comment")
        .copied()
        .unwrap_or_default();
    assert!(
        comments > 800,
        "the plain-comment sweep the concept counted at ~1210: {comments}"
    );
    for expected in [
        "label-unresolved-citation",
        "label-backtick-in-code",
        "rust-plain-line-comment",
    ] {
        assert!(by_rule.contains_key(expected), "{expected} is not reported");
    }
}

/// (´[LBL-cav:labels:coexistence]´): an advisory tree's defects are visible
/// in full rather than demoted, and enforcement is orthogonal to severity —
/// an error is an error wherever it is found.
#[test]
fn advisory_findings_keep_their_severity() {
    let advisory = under("docs/");
    assert!(!advisory.is_empty(), "the docs trees report something");
    assert!(
        advisory
            .iter()
            .all(|one| one.enforcement == Enforcement::Advisory),
        "nothing under docs/ is in the failing set today"
    );
    assert!(
        advisory
            .iter()
            .any(|one| one.severity == cogra_linter::Severity::Error),
        "an error outside the failing set is still an error"
    );
}

/// (´[ARCH-req:linter:determinism]´): two runs over one tree emit one
/// output, byte for byte.
#[test]
fn two_runs_emit_byte_identical_findings() {
    let again = cogra_linter::check(adoption(), &root()).expect("a second run");
    let spelled = |findings: &[Diagnostic]| -> String {
        findings.iter().map(spell).collect::<Vec<_>>().join("\n")
    };
    assert_eq!(spelled(&run().findings), spelled(&again.findings));
}

/// (´[ARCH-dec:linter:registry-as-data]´), (´[KND-judg:kinds:head-validation]´):
/// the registry document parses out of its own tables, and every
/// participating head in the corpus validates as exactly one catalogued
/// pair — no suppression, no uncatalogued head, no ambiguous reduction.
#[test]
fn every_head_in_the_corpus_validates() {
    assert!(
        run().kinds.is_some(),
        "the registry document parsed, so nothing is suppressed"
    );
    let heads = nodes_of(&run().graph, NodeKind::Head).count();
    assert!(heads > 300, "the corpus carries its heads: {heads}");
    let unvalidated: Vec<String> = run()
        .findings
        .iter()
        .filter(|one| one.rule.as_str().starts_with("kind-"))
        .map(spell)
        .collect();
    assert!(unvalidated.is_empty(), "{}", unvalidated.join("\n"));
}

/// (´sig:lint:index-maps´) over the real run: every key of `mints` is a key
/// of `labels`, and every `ResolvesTo` target is a node `labels` holds.
#[test]
fn the_registries_stay_coherent_over_the_real_corpus() {
    let registries = &run().registries;
    for key in registries.mints.keys() {
        assert!(
            registries.labels.contains_key(key),
            "a mint without its label node: {key:?}"
        );
    }
    let held: std::collections::HashSet<_> = registries.labels.values().copied().collect();
    for node in run().graph.node_indices() {
        for target in cogra_linter::out_along(&run().graph, node, cogra_linter::EdgeW::ResolvesTo) {
            assert!(held.contains(&target), "a resolution into an unheld label");
        }
    }
    assert!(!registries.mints.is_empty(), "the corpus mints something");
}

/// (´req:lint:timing´), (´tab:lint:budgets´): the first measured full-corpus
/// run is what replaces the design's proposed budget, so the measurement is
/// made here and printed with the phases named.
///
/// The walk is measured apart from the analysis because they are budgeted
/// against different things: the walk is file I/O, and on this machine it
/// crosses an operating-system boundary — the checkout is Windows-side and
/// the toolchain runs in a Linux distro — while the analysis is the
/// linter's own cost and crosses nothing.
#[test]
fn the_full_corpus_run_reports_its_wall_time() {
    let walking = Instant::now();
    let sources = match Walk::new(adoption(), &root()).sources() {
        Ok(sources) => sources,
        Err(outcome) => outcome.sources,
    };
    let walked = walking.elapsed();
    let counted = sources.len();

    let analysing = Instant::now();
    let checked = cogra_linter::check_sources(adoption(), sources);
    let analysed = analysing.elapsed();

    println!(
        "corpus: {counted} sources, {} findings",
        checked.findings.len()
    );
    println!("walk:     {walked:?}");
    println!("analysis: {analysed:?}");
    println!("phases:   {}", checked.timing);
    for (phase, took) in checked.timing.phases() {
        println!("  {}: {took:?}", phase.token());
    }
    assert!(counted > 100, "the carrier is the repository");
    assert!(
        checked.timing.of(cogra_linter::Phase::Render).is_none(),
        "there is no renderer yet, and the report says so rather than reporting zero"
    );
}
