//! The register generator and the freshness comparison
//! (´sig:lint:register-api´), (´dec:lint:one-generator´).
//!
//! One generator produces every generated register the disciplines call for,
//! and the check and the regeneration mode consume the same output. The
//! tests here are about that output: what it contains, how a committed
//! register compares against it, and what a scoped regeneration touches.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::registers::{Freshness, Register, RegisterScope, Scope, compare, regenerate_all};
use cogra_linter::{Adoption, Asset, OwnerId, ProfileId, Run, migrate};

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
    assert_eq!(held, text(reg), "the splice is byte-exact against its span");
    assert!(
        held.contains("| Device classes   | 10    |"),
        "the count the first generation run repaired"
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

/// (´[KND-req:kinds:attestation-register]´): the register presents exactly
/// the pairs of the relation, in the recorded ordering, with the status the
/// edition records for each.
#[test]
fn the_attestation_register_orders_its_rows_by_name_then_kind() {
    let reg = one(&RegisterScope::Attestation);
    let rows: Vec<Vec<&str>> = text(reg)
        .lines()
        .skip_while(|line| !line.starts_with("| Name "))
        .skip(2)
        .take_while(|line| line.starts_with('|'))
        .map(|line| line.split('|').map(str::trim).collect())
        .collect();
    let kinds = run().kinds.as_ref().expect("the relation parsed");
    assert_eq!(
        rows.len(),
        kinds.headline_counts().rows,
        "one row per pair of the relation"
    );
    let keyed: Vec<(&str, &str)> = rows.iter().map(|row| (row[1], row[2])).collect();
    let mut sorted = keyed.clone();
    sorted.sort();
    assert_eq!(keyed, sorted, "ordered by name, then kind");
    for (at, row) in rows.iter().enumerate() {
        assert_eq!(row[6], (at + 1).to_string(), "the record sequence number");
        assert!(matches!(row[3], "firm" | "borderline"), "{row:?}");
    }
}

/// (´[KND-inv:kinds:attestation-coverage]´): the daggered rows of the
/// edition are exactly the borderline rows of the register, and the corpus's
/// own record of them agrees.
#[test]
fn the_borderline_rows_are_the_editions_daggered_ones() {
    let reg = one(&RegisterScope::Attestation);
    let mut borderline: Vec<String> = text(reg)
        .lines()
        .filter(|line| line.contains("| borderline |"))
        .filter_map(|line| line.split('|').nth(1).map(|cell| cell.trim().to_owned()))
        .collect();
    borderline.sort();
    let mut recorded: Vec<String> = adoption()
        .kinds
        .statuses
        .daggered
        .iter()
        .map(|one| one.to_string())
        .collect();
    recorded.sort();
    assert_eq!(borderline, recorded);
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

/// The test profile, which `[profiles]` registers and stages.
fn staged() -> ProfileId {
    ProfileId::new("rust-test")
}

/// That profile's census over the whole corpus, walked once.
fn census() -> &'static BTreeMap<OwnerId, Vec<Asset>> {
    static MEASURED: OnceLock<BTreeMap<OwnerId, Vec<Asset>>> = OnceLock::new();
    MEASURED.get_or_init(|| {
        migrate::census(adoption(), &root(), &staged()).expect("the repository root is a directory")
    })
}

/// The registers the named regeneration emits for it.
fn named() -> &'static Vec<Register> {
    static EMITTED: OnceLock<Vec<Register>> = OnceLock::new();
    EMITTED.get_or_init(|| {
        let profile = adoption()
            .profiles
            .profiles
            .iter()
            .find(|one| one.id == staged())
            .expect("the test profile is registered");
        cogra_linter::label_registers_of(adoption(), profile, census())
    })
}

/// (´dec:lint:staged-profiles´): the named regeneration emits a staged
/// profile's per-owner registers, one for each owner with covered assets,
/// while the profile is still staged — which is what its entry condition
/// asks for and what a run computing nothing for it could never supply.
#[test]
fn a_named_regeneration_emits_a_staged_profiles_registers() {
    let spelled: Vec<String> = named()
        .iter()
        .map(|reg| format!("{} · {} bytes", reg.path.display(), reg.bytes.len()))
        .collect();
    println!("{}", spelled.join("\n"));

    assert_eq!(named().len(), census().len(), "one per owner: {spelled:?}");
    assert!(named().len() > 1, "the corpus's tests span several owners");
    for reg in named() {
        let RegisterScope::LabelRegister { owner, profile } = &reg.scope else {
            panic!("a label register, not {:?}", reg.scope);
        };
        assert_eq!(*profile, staged());
        assert!(
            reg.path.starts_with("crates/"),
            "a register lies in the tree of the owner it presents: {}",
            reg.path.display()
        );
        assert!(census().contains_key(owner));
        assert_eq!(
            compare(reg, run().sources.get(&reg.path).map(Vec::as_slice)),
            Freshness::Staged,
            "no register is committed yet, and this lane commits none"
        );
    }
}

/// (´[ARCH-req:linter:determinism]´): a second census over the same corpus
/// produces the same bytes, which is the property the exact comparison rests
/// on the day the registers are committed.
#[test]
fn a_named_regeneration_is_byte_identical_on_a_second_walk() {
    let profile = adoption()
        .profiles
        .profiles
        .iter()
        .find(|one| one.id == staged())
        .expect("the test profile is registered");
    let again = migrate::census(adoption(), &root(), &staged()).expect("a second census");
    assert_eq!(&again, census(), "the census itself is deterministic");
    assert_eq!(
        cogra_linter::label_registers_of(adoption(), profile, &again),
        *named()
    );
}

/// (´dec:lint:one-generator´): the measurement and the named regeneration
/// read one census — the same machinery, so the registers a migration
/// generates are the ones the measurement counted its distance against.
#[test]
fn the_measurement_and_the_named_regeneration_agree_on_the_census() {
    let measured = migrate::distances(adoption(), &root(), Some(&staged()))
        .expect("one profile measured")
        .pop()
        .expect("the test profile is staged");
    let covered: usize = census().values().map(Vec::len).sum();
    println!("{covered} covered, {} remaining", measured.remaining.len());
    assert_eq!(measured.covered, covered);

    let mut waiting: Vec<PathBuf> = measured
        .remaining
        .iter()
        .map(|step| step.at.path.clone())
        .collect();
    waiting.sort();
    let mut emitted: Vec<PathBuf> = named().iter().map(|reg| reg.path.clone()).collect();
    emitted.sort();
    assert_eq!(
        waiting, emitted,
        "every register the measurement waits on is one the regeneration emits"
    );
}

/// (´dec:lint:staged-profiles´): a whole-corpus regeneration does not sweep a
/// staged profile up. Generating its registers is a step in a migration, and
/// the profile has to be named.
#[test]
fn a_whole_corpus_regeneration_sweeps_no_staged_profile_up() {
    assert!(
        generated()
            .iter()
            .all(|reg| !matches!(reg.scope, RegisterScope::LabelRegister { .. })),
        "the check's own generation emits a register only for a profile in force"
    );
    assert!(!named().is_empty(), "and the named one emits them");
}

/// (`[profiles]`): the register's rows are ordered bytewise by label, which
/// is the form the profile's standard place fixes.
#[test]
fn every_register_orders_its_rows_bytewise_by_label() {
    for reg in named() {
        let labels: Vec<&str> = text(reg)
            .lines()
            .filter_map(|line| line.split('`').nth(1))
            .collect();
        let mut sorted = labels.clone();
        sorted.sort_unstable();
        assert_eq!(labels, sorted, "{}", reg.path.display());
        assert!(!labels.is_empty(), "{}", reg.path.display());
    }
}
