//! The migrations measurement (´dec:lint:migrations-subcommand´).
//!
//! It computes the censuses of the staged profiles and reports how far each
//! entry condition still has to travel. It judges nothing, emits no
//! diagnostic and no verdict, and it is never part of a check — a census
//! computed inside the judging run would be the half-computed pass
//! (´[LBL-inv:labels:two-pass]´) exists to forbid.
//!
//! The counts here are asserted as classes and magnitudes, never as exact
//! numbers: they move with every commit that adds a test or a module, and a
//! suite that pinned them would fail for the wrong reason.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::{Adoption, Migration, ProfileId, ProfileStatus, migrate};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::load(&root().join("corpus-adoption.toml")).expect("the adoption data load")
    })
}

/// The whole measurement, taken once.
fn measured() -> &'static Vec<Migration> {
    static FOUND: OnceLock<Vec<Migration>> = OnceLock::new();
    FOUND.get_or_init(|| {
        migrate::distances(adoption(), &root(), None).expect("the repository root is a directory")
    })
}

fn one(id: &str) -> &'static Migration {
    let wanted = ProfileId::new(id);
    measured()
        .iter()
        .find(|migration| migration.profile == wanted)
        .unwrap_or_else(|| panic!("{id} is measured"))
}

/// (´dec:lint:staged-profiles´): a staged profile is exactly what this run
/// measures, and the module profile is the one this corpus still stages.
#[test]
fn every_staged_profile_is_measured() {
    let staged = adoption()
        .profiles
        .profiles
        .iter()
        .filter(|profile| matches!(profile.status, ProfileStatus::Staged { .. }))
        .count();
    assert_eq!(measured().len(), staged);
    assert_eq!(staged, 1, "the module profile, whose migration is pending");
}

/// (´dec:lint:staged-profiles´): a profile in force is not measured at all —
/// the test profile's registers are committed and its distance is no longer a
/// fact this run has to report.
#[test]
fn a_profile_in_force_is_not_measured() {
    let in_force = ProfileId::new("rust-test");
    assert!(measured().iter().all(|one| one.profile != in_force));
    let asked = migrate::distances(adoption(), &root(), Some(&in_force))
        .expect("the repository root is a directory");
    assert!(asked.is_empty(), "{asked:?}");
}

/// (´dec:lint:migrations-subcommand´): the module profile's distance is its
/// definitions counted against those still lacking the inner documentation
/// comment, each located.
#[test]
fn the_module_profile_waits_on_its_inner_comments() {
    let found = one("rust-module");
    println!(
        "{} definitions, {} without their comment",
        found.covered,
        found.remaining.len()
    );
    assert!(found.covered > 40, "the census is the corpus's modules");
    assert!(!found.arrived());
    for step in &found.remaining {
        assert!(step.at.line >= 1, "every line is located");
        assert!(step.note.contains("mod:module:"));
    }
}

/// (`[profiles]`): the census counts definitions once, never declarations —
/// the many `mod rig;` declarations of one tree are one asset.
///
/// A definition is a file and a name together, not a file: a backing file
/// that itself holds an inline module definition carries two, and both are
/// its own.
#[test]
fn a_definition_declared_many_times_is_counted_once() {
    let found = one("rust-module");
    let mut named: Vec<(&PathBuf, &String)> = found
        .remaining
        .iter()
        .map(|step| (&step.at.path, &step.note))
        .collect();
    let before = named.len();
    named.sort();
    named.dedup();
    assert_eq!(named.len(), before, "no definition is counted twice");
    let rig: Vec<&PathBuf> = found
        .remaining
        .iter()
        .map(|step| &step.at.path)
        .filter(|path| path.ends_with("rig/mod.rs"))
        .collect();
    assert_eq!(
        rig.len(),
        rig.iter().collect::<std::collections::BTreeSet<_>>().len(),
        "each declared-many-times definition is one line: {rig:?}"
    );
}

/// (´dec:lint:migrations-subcommand´): the measurement is deterministic, as
/// every other output of the crate is (´[ARCH-req:linter:determinism]´).
#[test]
fn two_measurements_agree() {
    let again = migrate::distances(adoption(), &root(), None).expect("a second measurement");
    assert_eq!(&again, measured());
}

/// (´dec:lint:migrations-subcommand´): one profile can be measured alone.
#[test]
fn a_named_profile_is_measured_alone() {
    let only = ProfileId::new("rust-module");
    let found = migrate::distances(adoption(), &root(), Some(&only)).expect("one profile measured");
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].profile, only);
}
