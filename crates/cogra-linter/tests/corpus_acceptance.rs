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
//! set is the two documentation trees written under the discipline and the
//! `docs/` trees their R20 sweep cleared; the advisory remainder is
//! reported and counted and does not fail the lane.
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

/// (´dec:lint:enforcement-partition´), (´rep:lint:first-corpus´): the
/// failing set is clean.
///
/// This is what version 1 is accepted on — a clean run over the material
/// written under the discipline — and it is now the plain assertion rather
/// than a list of tolerated defects. The trees listed under
/// `[enforcement]` `failing` are the whole scope, and the lane's exit code
/// reads exactly this predicate.
///
/// Each completed migration adds a prefix to that list, and this test grows
/// with it by construction: it names no path, so widening the failing set
/// widens what it asserts.
#[test]
fn the_failing_set_is_clean() {
    let against: Vec<String> = run().failing().map(spell).collect();
    assert!(
        against.is_empty(),
        "the failing set carries {} findings:\n{}",
        against.len(),
        against.join("\n")
    );
    assert!(run().is_clean(), "the lane exits zero on this corpus");
}

/// (´rep:lint:first-corpus´): the advisory remainder is empty. Every Rust
/// crate carries documentation comments only, so the two classes the
/// concept predicted — the backtick near-misses and the plain-comment
/// sweep — are gone with the sweep that produced them, and the
/// unresolved-citation class is empty too, every span that fed it being a
/// displayed one (R20).
///
/// `android/` and `web/` remain outside the failing set, there being no
/// frontend before slices 7 and 8, but they carry nothing for the linter
/// to report. What is left is a corpus clean at both enforcements, which
/// the failing half asserts separately.
#[test]
fn the_advisory_remainder_is_empty() {
    let by_rule = counted();
    println!("findings by rule, over {} sources:", run().sources.len());
    for (rule, count) in &by_rule {
        println!("  {rule}: {count}");
    }
    let advisory: Vec<String> = run()
        .findings
        .iter()
        .filter(|one| one.enforcement == Enforcement::Advisory)
        .map(spell)
        .collect();
    assert!(
        advisory.is_empty(),
        "the advisory remainder carries {} finding(s):\n{}",
        advisory.len(),
        advisory.join("\n")
    );
    let unresolved = by_rule
        .get("label-unresolved-citation")
        .copied()
        .unwrap_or_default();
    assert_eq!(
        unresolved, 0,
        "no citation in the corpus resolves nowhere: {unresolved}"
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

/// (´dec:lint:one-generator´), (´[ARCH-rule:linter:register-freshness]´):
/// every register the generator produces is byte-identical to what is
/// committed — the check-after-write property, over the real corpus rather
/// than a fixture.
///
/// This is what the first generation run armed: before it, the companion
/// register had never been generated and the headline table carried a count
/// no derivation produced. From it on, an edit to either is a finding, and
/// regeneration is its only repair.
#[test]
fn every_committed_register_is_current() {
    let registers = cogra_linter::registers::regenerate_all(
        &run().graph,
        &run().registries,
        adoption(),
        run().kinds.as_ref(),
    );
    assert_eq!(
        registers.len(),
        8,
        "the companion register, the headline region, and the test profile's \
         label register for each of the six owners with covered assets"
    );
    for reg in &registers {
        let (held, _) = cogra_linter::registers::committed(reg, &run().sources);
        assert_eq!(
            cogra_linter::registers::compare(reg, held),
            cogra_linter::Freshness::Current,
            "{} is not current",
            reg.path.display()
        );
    }
    let reported: Vec<String> = run()
        .findings
        .iter()
        .filter(|one| one.rule.as_str().starts_with("register-"))
        .map(spell)
        .collect();
    assert!(reported.is_empty(), "{}", reported.join("\n"));
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
        "a run that only collects its findings performs no render phase, and the report says so rather than reporting zero"
    );
}
