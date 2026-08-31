//! The claim discipline (´dec:lint:claim-standing´), its staging
//! (´dec:lint:claim-activation´), and the matrix that presents it.
//!
//! Two kinds of fixture, because the discipline has two kinds of subject. The
//! shape of one test's documentation is settled by calling `standing` on the
//! lines directly, which is what the judgment and the generator both call; the
//! staging is settled by running whole fixture corpora under the corpus's own
//! adoption data, because which owners the activation admits is a declaration
//! and a hand-built graph would be free to disagree with it.
//!
//! Trace convention: every test's doc comment names the clause it traces to,
//! and carries the claim the discipline asks of it.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::judge::claims::{Defect, Form, Standing, census, standing};
use cogra_linter::{Adoption, Kind, Language, OwnerId, Run, SourceFile, check_sources};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::load(&root().join("corpus-adoption.toml")).expect("the adoption data load")
    })
}

/// The kind `[claims]` fixes, read from the adoption data rather than spelled
/// here: a fixture carrying its own copy of a declaration is a fixture free to
/// pass while the corpus fails.
fn claim_kind() -> Kind {
    adoption()
        .claims
        .as_ref()
        .expect("this corpus adopts the claim discipline")
        .kind
        .clone()
}

fn lines(held: &[&str]) -> Vec<Box<str>> {
    held.iter().map(|line| Box::from(*line)).collect()
}

fn rust(path: &str, owner: &str, body: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from(path),
        owner: OwnerId::new(owner),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from(body),
    }
}

/// One test function with the documentation given, in a source of `owner`.
fn covered(path: &str, owner: &str, documentation: &str) -> SourceFile {
    rust(
        path,
        owner,
        &format!("{documentation}#[test]\nfn a_covered_test() {{}}\n"),
    )
}

/// How many findings of one rule a run produced.
fn reported(run: &Run, rule: &str) -> usize {
    run.findings
        .iter()
        .filter(|one| one.rule.as_str() == rule)
        .count()
}

/// (´dec:lint:claim-standing´): a bare occurrence on the final documentation
/// line is the test's own claim, and the line above it is the statement.
///
/// A claim alone on the final documentation line mints, and the line above it
/// is the statement.
/// ´claim:claims:a-final-bare-line-mints´
#[test]
fn a_bare_claim_on_the_final_line_mints_with_its_statement() {
    let held = lines(&[
        "Some longer prose about what this test does.",
        "",
        "The scanner reads what the harvest reads.",
        "´claim:x:one´",
    ]);
    let Standing::Claimed(line) = standing(&held, &claim_kind()) else {
        panic!("the final line is a mint");
    };
    assert_eq!(line.form, Form::Mint);
    assert_eq!(line.label.as_str(), "claim:x:one");
    assert_eq!(line.statement, "The scanner reads what the harvest reads.");
}

/// (´dec:lint:claim-standing´): a parenthesized occurrence cites a sibling's
/// claim, and writes no statement of its own.
///
/// A citing test carries no statement, the statement being written at the mint.
/// ´claim:claims:a-citing-test-writes-no-statement´
#[test]
fn a_cited_claim_carries_no_statement() {
    let held = lines(&["Prose that is not a statement.", "(´claim:x:one´)"]);
    let Standing::Claimed(line) = standing(&held, &claim_kind()) else {
        panic!("the final line is a citation");
    };
    assert_eq!(line.form, Form::Citation);
    assert_eq!(line.label.as_str(), "claim:x:one");
    assert!(
        line.statement.is_empty(),
        "a citation states nothing of its own"
    );
}

/// (´dec:lint:claim-standing´): documentation with no claim-kind occurrence is
/// unclaimed, whatever else it carries.
///
/// Documentation carrying no claim-kind occurrence is unclaimed.
/// ´claim:claims:no-occurrence-is-unclaimed´
#[test]
fn documentation_without_a_claim_is_unclaimed() {
    assert_eq!(
        standing(&lines(&["Prose.", "(´dec:lint:claim-standing´)"]), &claim_kind()),
        Standing::Unclaimed,
        "a citation of another kind is not a claim"
    );
    assert_eq!(standing(&lines(&[]), &claim_kind()), Standing::Unclaimed);
}

/// (´dec:lint:claim-standing´): a claim away from the final line is a defect,
/// because the statement is read from what stands above the claim.
///
/// A claim above the final documentation line is misplaced.
/// ´claim:claims:a-claim-off-the-final-line-is-misplaced´
#[test]
fn a_claim_above_the_final_line_is_misplaced() {
    assert_eq!(
        standing(&lines(&["´claim:x:one´", "Prose after it."]), &claim_kind()),
        Standing::Defective(Defect::Misplaced)
    );
}

/// (´dec:lint:claim-standing´): the claim line carries the occurrence and
/// nothing else, so that a reader never has to find it.
///
/// A claim sharing its line with other words is not at the standard place.
/// ´claim:claims:a-shared-claim-line-is-a-defect´
#[test]
fn a_claim_sharing_its_line_is_a_defect() {
    assert_eq!(
        standing(&lines(&["Prose.", "and ´claim:x:one´"]), &claim_kind()),
        Standing::Defective(Defect::NotAlone)
    );
    assert_eq!(
        standing(&lines(&["Prose.", "´claim:x:one´ and more"]), &claim_kind()),
        Standing::Defective(Defect::NotAlone)
    );
}

/// (´dec:lint:claim-standing´): one test evidences one statement, so two claim
/// occurrences in one documentation is a defect and not a choice between them.
///
/// Documentation carrying two claims is a defect rather than a choice.
/// ´claim:claims:two-claims-is-a-defect´
#[test]
fn two_claims_in_one_documentation_are_a_defect() {
    assert_eq!(
        standing(
            &lines(&["´claim:x:one´", "Prose.", "´claim:x:two´"]),
            &claim_kind()
        ),
        Standing::Defective(Defect::Repeated)
    );
}

/// (´dec:lint:claim-standing´): a test evidences a statement of its own owner,
/// so an imported citation is a defect rather than a resolution elsewhere.
///
/// A test citing another owner's claim is a defect.
/// ´claim:claims:an-imported-claim-is-foreign´
#[test]
fn an_imported_claim_citation_is_foreign() {
    assert_eq!(
        standing(&lines(&["Prose.", "(´[LBL-claim:x:one]´)"]), &claim_kind()),
        Standing::Defective(Defect::Foreign)
    );
}

/// (´dec:lint:claim-standing´): a mint with nothing above it names nothing,
/// and the statement it lacks is what the matrix would have presented.
///
/// A claim minted with no line above it has an empty statement.
/// ´claim:claims:a-mint-with-nothing-above-states-nothing´
#[test]
fn a_mint_with_nothing_above_it_states_nothing() {
    let Standing::Claimed(line) = standing(&lines(&["´claim:x:one´"]), &claim_kind()) else {
        panic!("a lone claim line still mints");
    };
    assert!(line.statement.is_empty());
}

/// (´dec:lint:claim-activation´): an owner the activation admits owes a claim
/// on every covered test, and an unclaimed one is a finding.
///
/// A covered test of an activated owner with no claim is a finding.
/// ´claim:claims:an-activated-owner-owes-every-claim´
#[test]
fn an_unclaimed_test_of_an_activated_owner_is_reported() {
    let run = check_sources(
        adoption(),
        vec![covered(
            "crates/cogra-linter/tests/fixture.rs",
            "pkg.cogra-linter",
            "/// Prose and no claim.\n",
        )],
    );
    assert_eq!(reported(&run, "claim-missing"), 1);
}

/// (´dec:lint:claim-activation´): an owner outside the activation is counted
/// and reported nowhere, which is the whole of the staging.
///
/// A covered test of an unactivated owner is counted and never reported.
/// ´claim:claims:an-open-wave-is-counted-not-reported´
#[test]
fn an_unclaimed_test_of_an_unactivated_owner_is_only_counted() {
    let run = check_sources(
        adoption(),
        vec![covered(
            "crates/l1-standin/src/fixture.rs",
            "pkg.l1-standin",
            "/// Prose and no claim.\n",
        )],
    );
    assert_eq!(
        reported(&run, "claim-missing"),
        0,
        "an open wave produces no finding"
    );
    let counted = census(&run.graph, adoption());
    let held = counted
        .by_owner
        .get(&OwnerId::new("pkg.l1-standin"))
        .expect("the owner is tallied even though its wave is open");
    assert_eq!((held.covered, held.unclaimed, held.activated), (1, 1, false));
}

/// (´dec:lint:claim-activation´): the staging reaches the unwritten claim
/// alone, so a claim out of place fails in an owner whose wave is still open.
///
/// A misplaced claim is a finding in an owner whose wave is still open.
/// ´claim:claims:a-written-claim-binds-before-its-wave-closes´
#[test]
fn a_misplaced_claim_is_reported_in_an_unactivated_owner() {
    let run = check_sources(
        adoption(),
        vec![covered(
            "crates/l1-standin/src/fixture.rs",
            "pkg.l1-standin",
            "/// ´claim:x:one´\n/// Prose after it.\n",
        )],
    );
    assert_eq!(reported(&run, "claim-misplaced"), 1);
    assert_eq!(
        reported(&run, "claim-missing"),
        0,
        "the unwritten claim is what the staging reaches"
    );
}

/// (´dec:lint:claim-standing´): a statement carrying a backtick is refused at
/// the test, because the matrix presents the line as prose.
///
/// A statement carrying a backtick is a finding rather than an escape.
/// ´claim:claims:a-quoted-statement-is-refused´
#[test]
fn a_statement_carrying_a_backtick_is_reported() {
    let run = check_sources(
        adoption(),
        vec![covered(
            "crates/l1-standin/src/fixture.rs",
            "pkg.l1-standin",
            "/// A statement naming `a code span`.\n/// ´claim:x:one´\n",
        )],
    );
    assert_eq!(reported(&run, "claim-statement-quoted"), 1);
}

/// (´dec:lint:claims-ride-the-calculus´): a claim minted twice in one owner is
/// the calculus's own duplicate-mint finding, reported once and not twice.
///
/// A claim minted twice is reported by unique minting and by nothing beside it.
/// ´claim:claims:a-duplicate-claim-is-the-calculus-finding´
#[test]
fn a_claim_minted_twice_is_the_calculus_own_finding() {
    let run = check_sources(
        adoption(),
        vec![rust(
            "crates/l1-standin/src/fixture.rs",
            "pkg.l1-standin",
            concat!(
                "/// A statement.\n/// ´claim:x:one´\n#[test]\nfn one() {}\n",
                "/// Another statement.\n/// ´claim:x:one´\n#[test]\nfn two() {}\n",
            ),
        )],
    );
    assert_eq!(reported(&run, "label-duplicate-mint"), 1);
    for rule in cogra_linter::judge::claims::RULES {
        assert_eq!(
            reported(&run, rule.as_str()),
            0,
            "the claim discipline says nothing a calculus invariant already said"
        );
    }
}

/// (´dec:lint:claims-ride-the-calculus´): a claim citation reaching no mint is
/// the calculus's own unresolved-citation finding.
///
/// A claim citation reaching no mint is reported by total resolution.
/// ´claim:claims:an-unresolved-claim-is-the-calculus-finding´
#[test]
fn a_claim_citing_nothing_is_the_calculus_own_finding() {
    let run = check_sources(
        adoption(),
        vec![covered(
            "crates/l1-standin/src/fixture.rs",
            "pkg.l1-standin",
            "/// Prose.\n/// (´claim:x:nowhere´)\n",
        )],
    );
    assert_eq!(reported(&run, "label-unresolved-citation"), 1);
}

/// (´dec:lint:claim-activation´): the census counts every owner and the
/// activation decides only which of them also produce findings.
///
/// The census counts claimed and unclaimed tests in every owner alike.
/// ´claim:claims:the-census-counts-every-owner´
#[test]
fn the_census_counts_activated_and_open_owners_alike() {
    let run = check_sources(
        adoption(),
        vec![
            covered(
                "crates/cogra-linter/tests/fixture.rs",
                "pkg.cogra-linter",
                "/// A statement.\n/// ´claim:x:one´\n",
            ),
            covered(
                "crates/l1-standin/src/fixture.rs",
                "pkg.l1-standin",
                "/// Prose and no claim.\n",
            ),
        ],
    );
    let counted = census(&run.graph, adoption());
    assert_eq!((counted.covered, counted.claimed, counted.unclaimed), (2, 1, 1));
    assert_eq!((counted.mints, counted.citations), (1, 0));
    assert_eq!(counted.by_area.get("x").copied(), Some(1));
}
