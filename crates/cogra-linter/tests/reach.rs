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

use cogra_linter::{
    Adoption, AdoptionError, Language, OwnerId, Run, SourceFile, check_sources,
};

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

/// The ruled adoption, which declares no reach graph.
fn ruled() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::from_str(adoption_text(), Path::new("corpus-adoption.toml"))
            .expect("the ruled adoption loads")
    })
}

/// The ruled adoption with a `[reach]` section appended.
///
/// Appended rather than spliced: the section is the file's last, it names no
/// value any earlier section reads, and a fixture that rewrites the middle of
/// a thousand-line file is one that fails for a reason of its own.
fn with_reach(section: &str) -> Adoption {
    let text = format!("{}\n{section}", adoption_text());
    Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
        .expect("the section under test loads")
}

/// The same, where the section is the one being refused.
fn refused(section: &str) -> AdoptionError {
    let text = format!("{}\n{section}", adoption_text());
    Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
        .err()
        .expect("the planted defect is refused")
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

/// The ruled corpus declares no graph, so the clause has no subject
/// (´dec:lint:reach-declared´).
#[test]
fn the_ruled_adoption_declares_no_reach_graph() {
    assert!(
        ruled().reach.is_none(),
        "the graph is jakob's to rule, and until he does the section is absent",
    );
}

/// With no section the import is permitted, which is the corpus's behavior
/// before this mechanism existed (´dec:lint:reach-declared´).
#[test]
fn an_absent_section_permits_every_import() {
    let run = check_sources(ruled(), corpus());
    assert!(
        refusals(&run).is_empty(),
        "an absent section is vacuously permissive: {:?}",
        refusals(&run),
    );
}

/// A graph naming the cited owner permits the import
/// (´dec:lint:reach-declared´).
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
    assert_eq!(one.primary.line, 3, "and on the line that writes the import");
    assert!(
        one.message.contains(CITING) && one.message.contains(CITED),
        "the message names both ends: {}",
        one.message,
    );
}

/// An owner the section does not name is constrained by nothing
/// (´dec:lint:reach-declared´).
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
#[test]
fn an_owner_reaches_itself_without_a_row() {
    let adoption = with_reach(FORBIDDING);
    let reach = adoption.reach.as_ref().expect("the section is present");
    let citing = OwnerId::new(CITING);
    assert!(reach.permits(&citing, &citing));
}

/// Reach is the declared edge and not its closure (´dec:lint:reach-declared´).
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
        .err()
        .expect("the omitted dependency is a contradiction");
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
#[test]
fn an_absent_section_contradicts_no_manifest() {
    assert!(ruled().verify_reach_against_manifests(&root()).is_ok());
}
