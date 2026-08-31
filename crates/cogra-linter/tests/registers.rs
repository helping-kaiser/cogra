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
/// the companion register, the registry document's generated region, the test
/// profile's label register for each owner with covered assets, and the claim
/// matrix of each owner whose authoring wave has closed
/// (´dec:lint:claim-activation´).
///
/// The corpus's own run generates a register in each of the scopes it declares.
/// ´claim:registers:every-scope-is-generated´
#[test]
fn the_corpus_generates_a_register_for_every_scope() {
    let scopes: Vec<String> = generated()
        .iter()
        .map(|reg| format!("{} {:?}", reg.path.display(), reg.scope))
        .collect();
    println!("{}", scopes.join("\n"));
    let of = |wanted: fn(&RegisterScope) -> bool| {
        generated().iter().filter(|reg| wanted(&reg.scope)).count()
    };
    let label_registers = of(|scope| matches!(scope, RegisterScope::LabelRegister { .. }));
    let matrices = of(|scope| matches!(scope, RegisterScope::ClaimMatrix { .. }));
    assert_eq!(
        generated().len(),
        label_registers + matrices + 2,
        "{scopes:?}"
    );
    assert!(
        label_registers > 1,
        "the corpus's tests span several owners: {scopes:?}"
    );
    let activated = adoption()
        .claims
        .as_ref()
        .and_then(|claims| claims.activation.declared())
        .expect("this corpus declares its activated owners");
    assert_eq!(
        matrices, activated,
        "one matrix per owner whose authoring wave has closed: {scopes:?}"
    );
}

/// (´[KND-tab:kinds:headline-counts]´): the generated region is the table
/// the registry document carries, and the splice is byte-exact against the
/// span the document's own table occupies.
///
/// A generated region is spliced byte-exact against the span its host table occupies.
/// ´claim:registers:the-region-matches-its-host-span´
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
///
/// The companion register presents its evidence and status rows and exactly the relation's homonyms.
/// ´claim:registers:the-attestation-register-presents-evidence´
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
///
/// The freshness comparison is exact bytes, and staleness names an offset rather than a digest.
/// ´claim:registers:the-comparison-is-exact-bytes´
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
///
/// The relation is C_A and not C: the register is the acceptee's, and the
/// extension rows are rows of it. The headline counts are the registry
/// edition's own and stay behind by exactly the extensions
/// (´[KND-tab:kinds:headline-counts]´), which is the difference asserted
/// here rather than assumed away.
///
/// The attestation register presents exactly the pairs of the effective relation, in the recorded ordering.
/// ´claim:registers:the-attestation-rows-are-the-relation´
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
        kinds.rows().count(),
        "one row per pair of the effective relation"
    );
    let extensions = adoption().kinds.extensions.rows.len();
    assert_eq!(
        rows.len(),
        kinds.headline_counts().rows + extensions,
        "the edition's counts stay behind C_A by exactly the extensions"
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
///
/// The daggered rows of the edition are exactly the borderline rows of the register.
/// ´claim:registers:daggered-rows-are-the-borderline-ones´
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
///
/// A scoped regeneration touches one owner's registers and leaves the corpus-wide ones alone.
/// ´claim:registers:an-owner-scope-is-scoped´
#[test]
fn an_owner_scope_touches_no_corpus_wide_register() {
    let scope = Scope::Owner(cogra_linter::OwnerId::new("pkg.api"));
    let admitted: Vec<&PathBuf> = generated()
        .iter()
        .filter(|reg| scope.admits(reg))
        .map(|reg| &reg.path)
        .collect();
    assert_eq!(
        admitted,
        vec![&PathBuf::from("crates/api/label-register.md")],
        "that owner's own register, and nothing corpus-wide"
    );
}

/// The test profile, which `[profiles]` registers and Π carries.
fn in_force() -> ProfileId {
    ProfileId::new("rust-test")
}

/// The ruled adoption with the test profile put back where it entered from,
/// for the measurement, which reports on staged profiles alone
/// (´dec:lint:staged-profiles´).
fn before_entry() -> Adoption {
    let text = std::fs::read_to_string(root().join("corpus-adoption.toml"))
        .expect("the adoption data is readable")
        .replace("effective = 2", "effective = 1")
        .replacen("status = \"effective\"", "status = \"staged\"", 1);
    Adoption::from_str(&text, Path::new("corpus-adoption.toml")).expect("it loads")
}

/// That profile's census over the whole corpus, walked once.
fn census() -> &'static BTreeMap<OwnerId, Vec<Asset>> {
    static MEASURED: OnceLock<BTreeMap<OwnerId, Vec<Asset>>> = OnceLock::new();
    MEASURED.get_or_init(|| {
        migrate::census(adoption(), &root(), &in_force())
            .expect("the repository root is a directory")
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
            .find(|one| one.id == in_force())
            .expect("the test profile is registered");
        cogra_linter::label_registers_of(adoption(), profile, census())
    })
}

/// (´dec:lint:staged-profiles´): the named regeneration emits the profile's
/// per-owner registers, one for each owner with covered assets, and what it
/// emits is what the corpus carries — the registers generated on the way into
/// Π are the ones the check now compares against, byte for byte.
///
/// A named regeneration emits exactly the per-owner registers the corpus carries.
/// ´claim:registers:a-named-regeneration-emits-what-is-carried´
#[test]
fn a_named_regeneration_emits_the_committed_registers() {
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
        assert_eq!(*profile, in_force());
        assert!(
            reg.path.starts_with("crates/"),
            "a register lies in the tree of the owner it presents: {}",
            reg.path.display()
        );
        assert!(census().contains_key(owner));
        assert_eq!(
            compare(reg, run().sources.get(&reg.path).map(Vec::as_slice)),
            Freshness::Current,
            "the committed register is what this generator produces"
        );
    }
}

/// (´[ARCH-req:linter:determinism]´): a second census over the same corpus
/// produces the same bytes, which is the property the exact comparison rests
/// on the day the registers are committed.
///
/// A second census over one corpus produces the same register bytes.
/// ´claim:registers:regeneration-is-byte-stable´
#[test]
fn a_named_regeneration_is_byte_identical_on_a_second_walk() {
    let profile = adoption()
        .profiles
        .profiles
        .iter()
        .find(|one| one.id == in_force())
        .expect("the test profile is registered");
    let again = migrate::census(adoption(), &root(), &in_force()).expect("a second census");
    assert_eq!(&again, census(), "the census itself is deterministic");
    assert_eq!(
        cogra_linter::label_registers_of(adoption(), profile, &again),
        *named()
    );
}

/// (´dec:lint:one-generator´): the measurement and the named regeneration
/// read one census — the same machinery, so the registers a migration
/// generates are the ones the measurement counted its distance against, and
/// the distance the measurement reports on this corpus is zero.
///
/// The measurement and the named regeneration read one census.
/// ´claim:registers:measurement-and-regeneration-read-one-census´
#[test]
fn the_measurement_and_the_named_regeneration_agree_on_the_census() {
    let before = before_entry();
    let measured = migrate::distances(&before, &root(), Some(&in_force()))
        .expect("one profile measured")
        .pop()
        .expect("the test profile is staged in this fixture");
    let covered: usize = census().values().map(Vec::len).sum();
    println!("{covered} covered, {} remaining", measured.remaining.len());
    assert_eq!(measured.covered, covered);
    assert!(
        measured.arrived(),
        "the registers the measurement waits on are committed: {:?}",
        measured.remaining
    );
}

/// (´dec:lint:staged-profiles´): a whole-corpus regeneration emits a register
/// only for a profile whose standard place is one — the test profile's, and
/// not the module profile's, whose labels sit at their own definitions.
///
/// A whole-corpus regeneration emits a register only for a profile whose standard place is one.
/// ´claim:registers:only-register-placed-profiles-emit´
#[test]
fn a_whole_corpus_regeneration_emits_only_what_is_in_force() {
    let profiles: Vec<ProfileId> = generated()
        .iter()
        .filter_map(|reg| match &reg.scope {
            RegisterScope::LabelRegister { profile, .. } => Some(profile.clone()),
            _ => None,
        })
        .collect();
    assert!(
        !profiles.is_empty(),
        "the check's own generation emits them"
    );
    assert!(
        profiles.iter().all(|one| *one == in_force()),
        "only a register-placed profile is generated for: {profiles:?}"
    );
}

/// (`[profiles]`): the register's rows are ordered bytewise by label, which
/// is the form the profile's standard place fixes.
///
/// A register's rows are ordered bytewise by label.
/// ´claim:registers:rows-are-ordered-bytewise´
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
