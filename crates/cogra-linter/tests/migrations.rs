//! The migrations measurement (´dec:lint:migrations-subcommand´).
//!
//! It computes the censuses of the staged profiles and reports how far each
//! entry condition still has to travel. It judges nothing, emits no
//! diagnostic and no verdict, and it is never part of a check — a census
//! computed inside the judging run would be the half-computed pass
//! (´[LBL-inv:labels:two-pass]´) exists to forbid.
//!
//! Both profiles of `[profiles]` are in force, so the ruled data stages
//! nothing and the run has nothing to report over it. What holds the
//! mechanism under test is an inverted fixture — the ruled adoption with the
//! module profile put back where it entered from — and a temporary root
//! whose definitions carry no label, which is the only corpus left that has
//! a distance to travel.
//!
//! The counts here are asserted as classes and magnitudes, never as exact
//! numbers: they move with every commit that adds a test or a module, and a
//! suite that pinned them would fail for the wrong reason.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::{Adoption, Migration, OwnerId, ProfileId, ProfileStatus, migrate};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption_text() -> &'static str {
    static LOADED: OnceLock<String> = OnceLock::new();
    LOADED.get_or_init(|| {
        std::fs::read_to_string(root().join("corpus-adoption.toml"))
            .expect("the adoption data is readable")
    })
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::load(&root().join("corpus-adoption.toml")).expect("the adoption data load")
    })
}

/// The ruled adoption with the module profile alone put back where it
/// entered from (´dec:lint:staged-profiles´).
///
/// The module profile is the last one `[profiles]` registers, so the last
/// effective status in the file is its own.
fn staging() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        let text = adoption_text().replace("effective = 2", "effective = 1");
        let mark = "status = \"effective\"";
        let at = text.rfind(mark).expect("the module profile is effective");
        let text = format!(
            "{}status = \"staged\"{}",
            &text[..at],
            &text[at + mark.len()..]
        );
        Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
            .expect("the condition the module profile entered on is recorded beside it")
    })
}

/// The whole measurement over this corpus, taken once against the fixture.
fn measured() -> &'static Vec<Migration> {
    static FOUND: OnceLock<Vec<Migration>> = OnceLock::new();
    FOUND.get_or_init(|| {
        migrate::distances(staging(), &root(), None).expect("the repository root is a directory")
    })
}

fn one(id: &str) -> &'static Migration {
    let wanted = ProfileId::new(id);
    measured()
        .iter()
        .find(|migration| migration.profile == wanted)
        .unwrap_or_else(|| panic!("{id} is measured"))
}

/// A corpus root of its own, whose modules carry no label at all.
///
/// The measurement's remaining lines need a corpus that still owes them, and
/// this repository owes none: the migration landed with the profile's entry
/// (´dec:lint:staged-profiles´).
fn temporary(name: &str) -> PathBuf {
    let at = std::env::temp_dir().join(format!("cogra-lint-{name}"));
    let _ = std::fs::remove_dir_all(&at);
    let src = at.join("crates").join("l1-standin").join("src");
    std::fs::create_dir_all(&src).expect("a temporary corpus root");
    std::fs::write(at.join("corpus-adoption.toml"), adoption_text()).expect("the adoption data");
    std::fs::write(src.join("lib.rs"), "mod alpha;\nmod inline { }\n").expect("two definitions");
    std::fs::write(src.join("alpha.rs"), "pub fn one() {}\n").expect("the backing file");
    at
}

/// (´dec:lint:staged-profiles´): a staged profile is exactly what this run
/// measures, and one is what the fixture stages.
#[test]
fn every_staged_profile_is_measured() {
    let staged = staging()
        .profiles
        .profiles
        .iter()
        .filter(|profile| matches!(profile.status, ProfileStatus::Staged { .. }))
        .count();
    assert_eq!(measured().len(), staged);
    assert_eq!(staged, 1, "the module profile, staged by the fixture");
}

/// (´dec:lint:staged-profiles´): a profile in force is not measured at all —
/// its distance is no longer a fact this run has to report, and over the
/// ruled data, where both profiles are in force, the run reports nothing.
#[test]
fn a_profile_in_force_is_not_measured() {
    let in_force = ProfileId::new("rust-test");
    assert!(measured().iter().all(|one| one.profile != in_force));
    let asked = migrate::distances(staging(), &root(), Some(&in_force))
        .expect("the repository root is a directory");
    assert!(asked.is_empty(), "{asked:?}");

    let ruled = migrate::distances(adoption(), &root(), None).expect("the ruled data measures");
    assert!(ruled.is_empty(), "nothing is staged today: {ruled:?}");
}

/// (´dec:lint:migrations-subcommand´): the module profile's distance is its
/// definitions counted against those still lacking the inner documentation
/// comment, each located.
#[test]
fn the_module_profile_waits_on_its_inner_comments() {
    let at = temporary("migrations-remaining");
    let only = ProfileId::new("rust-module");
    let found = migrate::distances(staging(), &at, Some(&only))
        .expect("the temporary root is a directory")
        .pop()
        .expect("the module profile is staged in this fixture");

    assert_eq!(found.covered, 2, "one file-backed and one inline");
    assert!(!found.arrived());
    assert_eq!(found.remaining.len(), 2);
    for step in &found.remaining {
        assert!(step.at.line >= 1, "every line is located");
        assert!(step.note.contains("mod:module:"));
    }
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:migrations-subcommand´): over this corpus the distance is
/// zero, which is the measurement the profile's entry into Π rested on.
#[test]
fn the_module_migration_has_arrived_over_this_corpus() {
    let found = one("rust-module");
    println!(
        "{} definitions, {} without their comment",
        found.covered,
        found.remaining.len()
    );
    assert!(found.covered > 40, "the census is the corpus's modules");
    assert!(found.arrived(), "{:?}", found.remaining);
}

/// (`[profiles]`): the census counts definitions once, never declarations —
/// the many `mod rig;` declarations of one tree are one asset.
///
/// A definition is a file and a name together, not a file: a backing file
/// that itself holds an inline module definition carries two, and both are
/// its own. Which is also the injectivity `[profiles]` records as measured,
/// re-measured here rather than taken from the note.
#[test]
fn a_definition_declared_many_times_is_counted_once() {
    let census = migrate::census(adoption(), &root(), &ProfileId::new("rust-module"))
        .expect("the measurement runs over this root");
    let mut named: Vec<(&OwnerId, &str)> = census
        .iter()
        .flat_map(|(owner, held)| held.iter().map(move |one| (owner, one.identifier.as_str())))
        .collect();
    let before = named.len();
    named.sort_unstable();
    named.dedup();
    assert_eq!(named.len(), before, "no name repeats within one owner");

    let rig = named.iter().filter(|(_, name)| *name == "rig").count();
    assert_eq!(rig, 1, "eleven declarations, one definition");
}

/// (´dec:lint:migrations-subcommand´): the measurement is deterministic, as
/// every other output of the crate is (´[ARCH-req:linter:determinism]´).
#[test]
fn two_measurements_agree() {
    let again = migrate::distances(staging(), &root(), None).expect("a second measurement");
    assert_eq!(&again, measured());
}

/// (´dec:lint:migrations-subcommand´): one profile can be measured alone.
#[test]
fn a_named_profile_is_measured_alone() {
    let only = ProfileId::new("rust-module");
    let found = migrate::distances(staging(), &root(), Some(&only)).expect("one profile measured");
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].profile, only);
}
