//! The declared owner reach (´dec:lint:reach-declared´).
//!
//! Σ says which prefixes name an owner, Ω says which owner holds a source, and
//! between them an import either resolves or does not. Neither has an opinion
//! about whether the citing owner had any business importing from the cited
//! one, and this is the section that supplies the opinion as data.
//!
//! The bodies come in three groups. The first drives the judgment over a
//! corpus of two sources built here rather than walked, because a corpus small
//! enough to state exactly is what lets a test say which import was refused
//! and where. The second plants one defect per body in the section itself and
//! asserts the variant it raises *and the row it names*. The third runs the
//! comparison against the workspace's real manifests, which is the one check
//! that has to read something other than the adoption data.
//!
//! Every body but the manifest group filters the run to this rule alone. The
//! fixture sources carry modules and no module labels, so a run over them
//! reports an inventory the corpus's own profiles are entitled to report; what
//! is under test is which imports were refused, and that is what is asserted.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::{Adoption, AdoptionError, Language, OwnerId, Run, SourceFile, check_sources};

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

/// The ruled adoption, which declares the corpus's own reach graph.
fn ruled() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::from_str(adoption_text(), Path::new("corpus-adoption.toml"))
            .expect("the ruled adoption loads")
    })
}

/// The ruled adoption text with its own `[reach]` section cut away.
///
/// The section is the file's last, so the cut is a truncation at the header
/// line rather than a splice: a fixture that rewrites the middle of a
/// thousand-line file is one that fails for a reason of its own. The line is
/// matched exactly, so the section's own commentary about `[reach]` is not a
/// second candidate.
fn reachless_text() -> &'static str {
    static CUT: OnceLock<String> = OnceLock::new();
    CUT.get_or_init(|| {
        let text = adoption_text();
        let at = text
            .lines()
            .position(|line| line == "[reach]")
            .expect("the ruled adoption declares a reach section");
        text.lines().take(at).collect::<Vec<_>>().join("\n")
    })
}

/// The ruled adoption with the graph under test in place of its own.
fn reachless() -> Adoption {
    Adoption::from_str(reachless_text(), Path::new("corpus-adoption.toml"))
        .expect("the adoption loads without its reach section")
}

/// The ruled adoption with the section under test in place of its own.
fn with_reach(section: &str) -> Adoption {
    let text = format!("{}\n{section}", reachless_text());
    Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
        .expect("the section under test loads")
}

/// The same, where the section is the one being refused.
fn refused(section: &str) -> AdoptionError {
    let text = format!("{}\n{section}", reachless_text());
    Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
        .expect_err("the planted defect is refused")
}

/// The two owners the judgment fixtures run between, chosen because neither
/// is a Cargo package: the manifest comparison has nothing to say about them,
/// so what these bodies assert is the declaration alone.
const CITING: &str = "tree.docs-primitive";
const CITED: &str = "pkg.web";

/// A permitting graph: the citing owner names the cited one.
const PERMITTING: &str = "\
[reach]

[[reach.owner]]
owner = \"tree.docs-primitive\"
may_cite = [\"pkg.web\"]
";

/// A forbidding graph: the citing owner is constrained and names another.
const FORBIDDING: &str = "\
[reach]

[[reach.owner]]
owner = \"tree.docs-primitive\"
may_cite = [\"doc.label-calculus\"]
";

/// A graph that constrains an owner other than the citing one.
const ELSEWHERE: &str = "\
[reach]

[[reach.owner]]
owner = \"pkg.api\"
may_cite = [\"pkg.common\", \"pkg.l1-standin\", \"pkg.postgres-store\"]
";

fn markdown(path: &str, owner: &str, body: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from(path),
        owner: OwnerId::new(owner),
        language: Some(Language::new("markdown")),
        generated: false,
        bytes: Vec::from(body),
    }
}

/// The two sources: one owner importing a label the other mints.
///
/// The label resolves, so nothing but reach can be what a finding on this
/// corpus is about.
fn corpus() -> Vec<SourceFile> {
    vec![
        markdown(
            "docs/primitive/reach-lane.md",
            CITING,
            "# A primitive document\n\nIt imports (`[WEB-conv:web:shared]`) from the web package.\n",
        ),
        markdown(
            "web/reach-held.md",
            CITED,
            "# A web document\n\nIt mints `conv:web:shared`.\n",
        ),
    ]
}

/// Every reach finding of a run, rendered.
fn refusals(run: &Run) -> Vec<String> {
    run.findings
        .iter()
        .filter(|one| one.rule.as_str() == "label-citation-outside-reach")
        .map(cogra_linter::render::diagnostic)
        .collect()
}

/// The ruled corpus declares the layered graph its own citations walk
/// (´dec:lint:reach-declared´).
///
/// This corpus declares a row for each of its three citing owners and each of
/// the four disciplines, and none for the twelve owners that cite nothing.
/// ´claim:reach:the-ruled-corpus-declares-its-measured-graph´
#[test]
fn the_ruled_adoption_declares_the_corpus_graph() {
    let reach = ruled().reach.as_ref().expect("the graph is ruled");
    assert_eq!(reach.rows.len(), 7, "seven rows, one per constrained owner");

    let disciplines = [
        "doc.label-calculus",
        "doc.kind-registry",
        "doc.identity-adjudication",
        "doc.interchange-conventions",
    ];
    for name in disciplines {
        let owner = OwnerId::new(name);
        let row = reach.row(&owner).expect("a discipline carries a row");
        assert!(row.may_cite.is_empty(), "{name} stands on nothing here");
    }

    let architecture = OwnerId::new("doc.linter-architecture");
    for name in disciplines {
        assert!(
            reach.permits(&architecture, &OwnerId::new(name)),
            "the architecture stands on {name}",
        );
    }
    for package in ["pkg.cogra-linter", "pkg.cogra-interchange"] {
        let owner = OwnerId::new(package);
        assert!(
            reach.permits(&owner, &architecture),
            "{package} stands on the architecture",
        );
        for name in disciplines {
            assert!(
                reach.permits(&owner, &OwnerId::new(name)),
                "{package} stands on {name}",
            );
        }
    }
    assert!(
        !reach.permits(&architecture, &OwnerId::new("pkg.cogra-linter")),
        "nothing in the graph points downward",
    );
    assert!(
        !reach.permits(
            &OwnerId::new("pkg.cogra-interchange"),
            &OwnerId::new("pkg.cogra-linter")
        ),
        "the two packages are independent and the graph says so",
    );
    assert!(
        reach.row(&OwnerId::new("pkg.api")).is_none(),
        "an owner that cites nothing carries no row",
    );
    assert!(
        ruled().verify_reach_against_manifests(&root()).is_ok(),
        "the declaration omits no path dependency the build carries",
    );
}

/// With no section the import is permitted, which is the corpus's behavior
/// before this mechanism existed (´dec:lint:reach-declared´).
///
/// With no declared graph every import is permitted.
/// ´claim:reach:an-absent-section-permits-everything´
#[test]
fn an_absent_section_permits_every_import() {
    let run = check_sources(&reachless(), corpus());
    assert!(
        refusals(&run).is_empty(),
        "an absent section is vacuously permissive: {:?}",
        refusals(&run),
    );
}

/// A graph naming the cited owner permits the import
/// (´dec:lint:reach-declared´).
///
/// A graph naming the cited owner permits the import.
/// ´claim:reach:a-named-owner-is-permitted´
#[test]
fn a_declared_reach_permits_the_owners_it_names() {
    let run = check_sources(&with_reach(PERMITTING), corpus());
    assert!(
        refusals(&run).is_empty(),
        "the graph names the cited owner: {:?}",
        refusals(&run),
    );
}

/// A graph that omits the cited owner refuses the import, at the occurrence
/// (´dec:lint:reach-declared´).
///
/// A graph omitting the cited owner refuses the import, at the occurrence.
/// ´claim:reach:an-unnamed-owner-is-refused´
#[test]
fn an_import_outside_the_declared_reach_is_located() {
    let run = check_sources(&with_reach(FORBIDDING), corpus());
    let found = refusals(&run);
    assert_eq!(found.len(), 1, "one import, one refusal: {found:?}");
    let one = run
        .findings
        .iter()
        .find(|one| one.rule.as_str() == "label-citation-outside-reach")
        .expect("the refusal was just counted");
    assert_eq!(
        one.primary.path,
        PathBuf::from("docs/primitive/reach-lane.md"),
        "the finding sits on the citing source, which is where the repair is",
    );
    assert_eq!(
        one.primary.line, 3,
        "and on the line that writes the import"
    );
    assert!(
        one.message.contains(CITING) && one.message.contains(CITED),
        "the message names both ends: {}",
        one.message,
    );
}

/// An owner the section does not name is constrained by nothing
/// (´dec:lint:reach-declared´).
///
/// An owner the section does not name is constrained by nothing.
/// ´claim:reach:an-owner-without-a-row-is-unconstrained´
#[test]
fn an_owner_with_no_row_reaches_everything() {
    let run = check_sources(&with_reach(ELSEWHERE), corpus());
    assert!(
        refusals(&run).is_empty(),
        "the section constrains another owner entirely: {:?}",
        refusals(&run),
    );
}

/// An owner reaches itself by being itself, whatever the section says
/// (´dec:lint:reach-declared´).
///
/// An owner reaches itself by being itself, whatever the section says.
/// ´claim:reach:an-owner-reaches-itself´
#[test]
fn an_owner_reaches_itself_without_a_row() {
    let adoption = with_reach(FORBIDDING);
    let reach = adoption.reach.as_ref().expect("the section is present");
    let citing = OwnerId::new(CITING);
    assert!(reach.permits(&citing, &citing));
}

/// Reach is the declared edge and not its closure (´dec:lint:reach-declared´).
///
/// Reach is the declared edge and never its closure.
/// ´claim:reach:reach-is-not-closed´
#[test]
fn reach_is_not_closed_under_composition() {
    let adoption = with_reach(
        "\
[reach]

[[reach.owner]]
owner = \"tree.docs-primitive\"
may_cite = [\"tree.docs-instances\"]

[[reach.owner]]
owner = \"tree.docs-instances\"
may_cite = [\"pkg.web\"]
",
    );
    let reach = adoption.reach.as_ref().expect("the section is present");
    let (first, middle, last) = (
        OwnerId::new("tree.docs-primitive"),
        OwnerId::new("tree.docs-instances"),
        OwnerId::new("pkg.web"),
    );
    assert!(reach.permits(&first, &middle));
    assert!(reach.permits(&middle, &last));
    assert!(
        !reach.permits(&first, &last),
        "the owner in the middle is the one whose declaration would have to say so",
    );
}

/// A row whose owner no prefix registers is refused, at its row
/// (´dec:lint:reach-declared´).
///
/// A row whose owner no prefix registers is refused at its row.
/// ´claim:reach:an-unregistered-row-owner-is-refused´
#[test]
fn a_row_naming_an_unregistered_owner_is_refused() {
    let error = refused(
        "\
[reach]

[[reach.owner]]
owner = \"doc.nowhere\"
may_cite = [\"pkg.web\"]
",
    );
    assert!(
        matches!(&error, AdoptionError::ReachUnknownOwner { owner, .. } if owner == "doc.nowhere"),
        "unexpected refusal: {error}",
    );
    assert!(error.at().is_some(), "the refusal names the row it sits in");
}

/// So is a target no prefix registers (´dec:lint:reach-declared´).
///
/// A target no prefix registers is refused at its row.
/// ´claim:reach:an-unregistered-target-is-refused´
#[test]
fn a_target_naming_an_unregistered_owner_is_refused() {
    let error = refused(
        "\
[reach]

[[reach.owner]]
owner = \"pkg.web\"
may_cite = [\"doc.nowhere\"]
",
    );
    assert!(
        matches!(&error, AdoptionError::ReachUnknownOwner { owner, .. } if owner == "doc.nowhere"),
        "unexpected refusal: {error}",
    );
}

/// The package family registers a prefix for every `pkg.` name, so the
/// registration check cannot catch a misspelled package
/// (´dec:lint:reach-declared´).
///
/// R-PKG′ is a closed derivation rule and not a list, so `pkg.nowhere` derives
/// `NOWHERE` and is registered as surely as `pkg.web` derives `WEB`. This is
/// the same reach the partition's own owner check has, and naming it here is
/// what keeps the limit a recorded fact rather than a gap someone discovers by
/// writing a typo that loads.
///
/// The package family registers a prefix for every package name, so a misspelling still loads.
/// ´claim:reach:the-package-family-registers-any-spelling´
#[test]
fn a_misspelled_package_owner_is_registered_by_the_family() {
    let adoption = with_reach(
        "\
[reach]

[[reach.owner]]
owner = \"pkg.nowhere\"
may_cite = [\"pkg.web\"]
",
    );
    let reach = adoption.reach.as_ref().expect("the section loads");
    assert!(
        reach.row(&OwnerId::new("pkg.nowhere")).is_some(),
        "the family derives a prefix for it, so Σ registers it",
    );
    assert!(
        reach.row(&OwnerId::new("pkg.web")).is_none(),
        "and the row it heads constrains nobody else",
    );
}

/// One owner heads one row (´dec:lint:reach-declared´).
///
/// One owner heads one row.
/// ´claim:reach:one-owner-heads-one-row´
#[test]
fn an_owner_heading_two_rows_is_refused() {
    let error = refused(
        "\
[reach]

[[reach.owner]]
owner = \"pkg.web\"
may_cite = [\"pkg.api\"]

[[reach.owner]]
owner = \"pkg.web\"
may_cite = [\"pkg.common\"]
",
    );
    assert!(
        matches!(&error, AdoptionError::ReachDuplicateOwner { owner, .. } if owner == "pkg.web"),
        "unexpected refusal: {error}",
    );
}

/// A row does not write the edge every owner has by structure
/// (´dec:lint:reach-declared´).
///
/// A row does not write the edge every owner has by structure.
/// ´claim:reach:a-self-edge-is-refused´
#[test]
fn a_row_naming_its_own_owner_is_refused() {
    let error = refused(
        "\
[reach]

[[reach.owner]]
owner = \"pkg.web\"
may_cite = [\"pkg.web\"]
",
    );
    assert!(
        matches!(&error, AdoptionError::ReachSelfEdge { owner, .. } if owner == "pkg.web"),
        "unexpected refusal: {error}",
    );
}

/// One permission is written once (´dec:lint:reach-declared´).
///
/// One permission is written once.
/// ´claim:reach:a-repeated-target-is-refused´
#[test]
fn a_row_repeating_a_target_is_refused() {
    let error = refused(
        "\
[reach]

[[reach.owner]]
owner = \"pkg.web\"
may_cite = [\"pkg.api\", \"pkg.api\"]
",
    );
    assert!(
        matches!(
            &error,
            AdoptionError::ReachRepeatedTarget { owner, target, .. }
                if owner == "pkg.web" && target == "pkg.api"
        ),
        "unexpected refusal: {error}",
    );
}

/// A declaration that omits a path dependency contradicts the build
/// (´dec:lint:reach-declared´).
///
/// `crates/api` path-depends on `common`, `l1-standin`, and `postgres-store`.
/// A row for `pkg.api` naming only one of them forbids two imports the
/// compiler already performs, which is the one direction the comparison runs.
///
/// A declaration omitting a path dependency contradicts the build.
/// ´claim:reach:omitting-a-path-dependency-contradicts´
#[test]
fn a_reach_omitting_a_path_dependency_contradicts_the_manifest() {
    let adoption = with_reach(
        "\
[reach]

[[reach.owner]]
owner = \"pkg.api\"
may_cite = [\"pkg.common\"]
",
    );
    let error = adoption
        .verify_reach_against_manifests(&root())
        .expect_err("the omitted dependency is a contradiction");
    assert!(
        matches!(
            &error,
            AdoptionError::ReachContradictsManifest { owner, .. } if owner == "pkg.api"
        ),
        "unexpected refusal: {error}",
    );
    assert!(error.at().is_some(), "the refusal names the row it sits in");
}

/// A declaration that admits every path dependency agrees with the build
/// (´dec:lint:reach-declared´).
///
/// A declaration admitting every path dependency agrees with the build.
/// ´claim:reach:admitting-the-dependencies-agrees´
#[test]
fn a_reach_admitting_its_path_dependencies_agrees_with_the_manifest() {
    let adoption = with_reach(ELSEWHERE);
    assert!(
        adoption.verify_reach_against_manifests(&root()).is_ok(),
        "the row names every crate the manifest path-depends on",
    );
}

/// A declaration reaching past the manifests is no contradiction, and it is
/// how every document owner reaches anything (´dec:lint:reach-declared´).
///
/// A declaration reaching past the manifests contradicts nothing.
/// ´claim:reach:reaching-past-the-manifests-is-no-contradiction´
#[test]
fn a_reach_beyond_the_manifests_is_no_contradiction() {
    let adoption = with_reach(PERMITTING);
    assert!(
        adoption.verify_reach_against_manifests(&root()).is_ok(),
        "a document owner has no manifest and its declared edges contradict none",
    );
    let adoption = with_reach(
        "\
[reach]

[[reach.owner]]
owner = \"pkg.api\"
may_cite = [
  \"pkg.common\",
  \"pkg.l1-standin\",
  \"pkg.postgres-store\",
  \"doc.label-calculus\",
  \"tree.docs-primitive\",
]
",
    );
    assert!(
        adoption.verify_reach_against_manifests(&root()).is_ok(),
        "edges Cargo does not carry are what the declaration is for",
    );
}

/// The absent section reaches the manifest comparison too
/// (´dec:lint:reach-declared´).
///
/// The absent section contradicts no manifest either.
/// ´claim:reach:an-absent-section-contradicts-nothing´
#[test]
fn an_absent_section_contradicts_no_manifest() {
    assert!(reachless().verify_reach_against_manifests(&root()).is_ok());
}
