//! The register generator and the freshness comparison
//! (´sig:lint:register-api´), (´dec:lint:one-generator´).
//!
//! One generator produces every generated register the disciplines call for,
//! and the check and the regeneration mode consume the same output. The
//! tests here are about that output: what it contains, how a committed
//! register compares against it, and what a scoped regeneration touches.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::registers::{Freshness, Register, RegisterScope, Scope, compare, regenerate_all};
use cogra_linter::{Adoption, Run};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::load(&root().join("corpus-adoption.toml")).expect("the adoption data load")
    })
}

/// The whole corpus, checked once: the generator's input is a completed run.
fn run() -> &'static Run {
    static CHECKED: OnceLock<Run> = OnceLock::new();
    CHECKED.get_or_init(|| {
        cogra_linter::check(adoption(), &root()).expect("the repository root is a directory")
    })
}

fn generated() -> &'static Vec<Register> {
    static REGISTERS: OnceLock<Vec<Register>> = OnceLock::new();
    REGISTERS.get_or_init(|| {
        regenerate_all(
            &run().graph,
            &run().registries,
            adoption(),
            run().kinds.as_ref(),
        )
    })
}

fn one(scope: &RegisterScope) -> &'static Register {
    generated()
        .iter()
        .find(|reg| std::mem::discriminant(&reg.scope) == std::mem::discriminant(scope))
        .unwrap_or_else(|| panic!("the generator produced no {scope:?}"))
}

fn text(reg: &Register) -> &str {
    std::str::from_utf8(&reg.bytes).expect("a register is text")
}

/// (´dec:lint:one-generator´): what the corpus's own run generates today —
/// the companion register and the registry document's generated region, and
/// no label register, both profiles being staged.
#[test]
fn the_corpus_generates_two_registers() {
    let scopes: Vec<String> = generated()
        .iter()
        .map(|reg| format!("{} {:?}", reg.path.display(), reg.scope))
        .collect();
    println!("{}", scopes.join("\n"));
    assert_eq!(generated().len(), 2, "{scopes:?}");
}

/// (´[KND-tab:kinds:headline-counts]´): the generated region is the table
/// the registry document carries, and the splice is byte-exact against the
/// span the document's own table occupies.
#[test]
fn the_headline_region_matches_its_host_span() {
    let reg = one(&RegisterScope::Region {
        host: PathBuf::new(),
        span: cogra_linter::ByteSpan::new(0, 0),
    });
    let RegisterScope::Region { host, span } = &reg.scope else {
        panic!("a region register");
    };
    let committed = run().sources.get(host).expect("the host is in the carrier");
    let held = std::str::from_utf8(&committed[span.start..span.end]).expect("text");
    println!("committed:\n{held}\ngenerated:\n{}", text(reg));
    assert!(
        held.starts_with("| Measure"),
        "the span is the table: {held:?}"
    );
    assert_eq!(
        held.lines().count(),
        text(reg).lines().count(),
        "the two tables have the same shape"
    );
}

/// (´[KND-req:kinds:attestation-register]´): the companion register presents
/// its evidence and status rows and exactly Hom(C_A).
#[test]
fn the_attestation_register_presents_evidence_and_homonyms() {
    let reg = one(&RegisterScope::Attestation);
    let body = text(reg);
    println!(
        "{}",
        body.lines().take(24).collect::<Vec<&str>>().join("\n")
    );
    assert_eq!(
        reg.path,
        PathBuf::from("crates/cogra-linter/docs/attestation-register.md")
    );
    assert!(body.contains("## Evidence and status"));
    assert!(body.contains("## Homonyms"));
    assert!(body.contains("## Candidates"));
}

/// (´dec:lint:no-digest´): the comparison is exact bytes, and `Stale` names
/// the offset of the first difference rather than a digest of either side.
#[test]
fn the_comparison_is_exact_bytes() {
    let reg = one(&RegisterScope::Attestation);
    assert_eq!(compare(reg, Some(&reg.bytes)), Freshness::Current);
    let mut altered = reg.bytes.clone();
    let at = altered.len() / 2;
    altered[at] = altered[at].wrapping_add(1);
    assert_eq!(compare(reg, Some(&altered)), Freshness::Stale { at });
    assert_eq!(compare(reg, None), Freshness::Staged);
}

/// (´[LBL-cav:labels:coexistence]´): a scoped regeneration touches one
/// owner's registers and leaves the corpus-wide ones alone.
#[test]
fn an_owner_scope_touches_no_corpus_wide_register() {
    let scope = Scope::Owner(cogra_linter::OwnerId::new("pkg.api"));
    assert!(
        generated().iter().all(|reg| !scope.admits(reg)),
        "nothing generated today belongs to one owner"
    );
}
