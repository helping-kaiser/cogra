//! The adoption loader over the corpus's own `corpus-adoption.toml`.
//!
//! Two bodies. The first reads the real file — the one this repository is
//! checked against — and asserts that every one of its thirteen sections
//! arrives with the values it states; a section that stopped round-tripping
//! would otherwise be discovered by a judgment that silently had nothing to
//! judge. The second builds a minimal adoption around one deliberate
//! defect and asserts the variant it raises *and the row it names*, because
//! an unlocated complaint about a thousand-line configuration file is a
//! worse diagnostic than the linter would accept from anything else.

use std::path::{Path, PathBuf};

use cogra_linter::{
    Activation, Adoption, AdoptionError, Enforcement, HeadMatching, Kind, Language, OwnerId,
    PathPrefix, Prefix, ProfileId, ProfileStatus,
};

fn corpus_adoption_path() -> PathBuf {
    PathBuf::from(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../corpus-adoption.toml"
    ))
}

fn ruled() -> Adoption {
    Adoption::load(&corpus_adoption_path()).expect("the corpus's own adoption data is ruled")
}

/// A minimal adoption around the four sections a defect is planted in.
fn document(signature: &str, partition: &str, profiles: &str, reserved: &str) -> String {
    format!(
        "[meta]
drafted = \"2026-08-20\"
ruled = \"2026-08-21\"
status = \"ruled\"
rationale = \"notes.md\"
corpus_root = \".\"
discipline_docs = []
schema_version = [1, 0, 0]

[carrier]
exclude_trees = []
generated_files = []
vendored_trees = []
vendored_files = []

{signature}
{partition}
{profiles}
{reserved}
[typed-data]
classes = []

[citation-indexes]
designations = []

[scanned-regions]

[banned-tokens]

[kinds]
acceptee = \"the repository owner\"
registry = \"docs/environment-kinds.md\"

[kinds.extensions]
rows = []
hybrids = []

[kinds.evidence]
adopted = \"the edition evidence base\"
recorded_in = \"the adoption data\"
owned = []

[kinds.statuses]
strengthenings = []
daggered = []
candidates = []

[kinds.generator]
generator = \"the linter's explicit regeneration mode\"
covers = []

[kinds.register]
standard_place = \"attestation-register.md\"
ordering = \"name\"
presents = []
state = \"staged\"

[head-recognition]
separator = \"·\"
match = \"case-exact\"

[enforcement]
default = \"advisory\"
failing = []
"
    )
}

const ONE_PREFIX: &str = "[signature]

[[signature.prefix]]
prefix = \"DOC\"
owner = \"doc.one\"
";

/// A signature registering the package family, so R-PKG′ can derive a
/// prefix for the roster check to quote back.
const ONE_PREFIX_WITH_PACKAGE_FAMILY: &str = "[signature]

[signature.families.package]
rule = \"uppercase(basename(package_dir)), hyphens deleted, then a leading COGRA deleted when the remainder is nonempty and unique among registered prefixes\"
rule_id = \"R-PKG'\"
applies_to = \"every unit the build system names as a package\"

[[signature.prefix]]
prefix = \"DOC\"
owner = \"doc.one\"
";

const TOTAL_PARTITION: &str = "
[partition]

[[partition.rule]]
order = 1
path = \"\"
owner = \"doc.one\"
";

const NO_PROFILES: &str = "
[profiles]
count = 0
effective = 0
";

const EMPTY_K: &str = "
[reserved-kinds]
source = \"the assets family\"
count = 0
governed = []
reserved_ungoverned = []
";

fn load(source: &str) -> Result<Adoption, AdoptionError> {
    Adoption::from_str(source, Path::new("corpus-adoption.toml"))
}

/// A registered prefix, through the grammar that owns the production.
fn prefix(text: &str) -> Prefix {
    Prefix::parse(text).unwrap_or_else(|| panic!("{text} is prefix-shaped"))
}

/// The row a located defect names, so that a test asserts the location by
/// the line's own content rather than by a brittle count.
fn row(source: &str, error: &AdoptionError) -> String {
    let at = error.at().expect("a located defect");
    source
        .lines()
        .nth(at.line as usize - 1)
        .expect("the row the defect names")
        .to_owned()
}

/// A tree of files at `paths`, under a root of its own, for the spelling
/// check to resolve configured paths against.
fn tree(name: &str, paths: &[&str]) -> PathBuf {
    let root = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join(name);
    let _ = std::fs::remove_dir_all(&root);
    for path in paths {
        let file = root.join(path);
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent).expect("a directory for the fixture");
        }
        std::fs::write(&file, "fixture\n").expect("a fixture file");
    }
    root
}

/// A fixture root carrying a `Cargo.toml` naming `members` as its workspace,
/// each with a `Cargo.toml` of its own, for [`Adoption::verify_package_roster`]
/// to read.
fn workspace_tree(name: &str, members: &[&str]) -> PathBuf {
    let root = tree(name, &[]);
    std::fs::create_dir_all(&root).expect("the fixture root");
    let listed = members
        .iter()
        .map(|member| format!("\"{member}\""))
        .collect::<Vec<_>>()
        .join(", ");
    std::fs::write(
        root.join("Cargo.toml"),
        format!("[workspace]\nmembers = [{listed}]\n"),
    )
    .expect("a fixture root Cargo.toml");
    for member in members {
        let dir = root.join(member);
        std::fs::create_dir_all(&dir).expect("a fixture member directory");
        std::fs::write(dir.join("Cargo.toml"), "[package]\n").expect("a fixture member manifest");
    }
    root
}

/// A minimal adoption whose partition configures one path beside the
/// catch-all, so a spelling can be planted in a row the test can name.
fn configuring(path: &str) -> String {
    let partition = format!(
        "
[partition]

[[partition.rule]]
order = 1
path = \"{path}\"
owner = \"doc.one\"

[[partition.rule]]
order = 2
path = \"\"
owner = \"doc.one\"
"
    );
    document(ONE_PREFIX, &partition, NO_PROFILES, EMPTY_K)
}

/// Matching is byte-exact, so a prefix the tree spells differently matches
/// nothing at all — and on a case-insensitive filesystem the author sees the
/// tree exactly where the prefix says it is. The check is what makes the
/// byte-exactness say so.
///
/// A configured path the tree spells otherwise is located, matching being byte-exact.
/// ´claim:adoption:a-misspelled-path-is-located´
#[test]
fn a_configured_path_the_tree_spells_otherwise_is_located() {
    let root = tree("spelling-case", &["docs/README.md"]);
    let source = configuring("Docs/");
    let adoption = load(&source).expect("the fixture loads");
    let error = adoption
        .verify_spellings(&root)
        .expect_err("the tree spells it docs/");
    let AdoptionError::PathSpelling {
        ref configured,
        ref found,
        ..
    } = error
    else {
        panic!("expected PathSpelling, got {error:?}");
    };
    assert!(configured.contains("Docs/"), "{configured}");
    assert_eq!(found, "docs/");
    assert!(row(&source, &error).contains("Docs/"));
}

/// The mismatch may sit at any component, and the finding names the whole
/// path as the tree spells it rather than the one component that differs.
///
/// A misspelling at any component names the whole path as the tree spells it.
/// ´claim:adoption:a-misspelling-names-the-whole-path´
#[test]
fn a_misspelling_deeper_in_a_path_names_the_whole_spelling() {
    let root = tree("spelling-deep", &["docs/primitive/layers.md"]);
    let source = configuring("docs/Primitive/");
    let adoption = load(&source).expect("the fixture loads");
    let error = adoption
        .verify_spellings(&root)
        .expect_err("the tree spells it primitive/");
    let AdoptionError::PathSpelling { ref found, .. } = error else {
        panic!("expected PathSpelling, got {error:?}");
    };
    assert_eq!(found, "docs/primitive/");
}

/// A file path is checked the same way, and reported without a trailing
/// separator it never carried.
///
/// A misspelled file path is reported without a separator it never carried.
/// ´claim:adoption:a-file-path-is-reported-as-a-file´
#[test]
fn a_misspelled_file_path_is_reported_as_a_file() {
    let root = tree("spelling-file", &["docs/Layers.md"]);
    let source = configuring("docs/layers.md");
    let adoption = load(&source).expect("the fixture loads");
    let error = adoption
        .verify_spellings(&root)
        .expect_err("the tree spells it Layers.md");
    let AdoptionError::PathSpelling { ref found, .. } = error else {
        panic!("expected PathSpelling, got {error:?}");
    };
    assert_eq!(found, "docs/Layers.md");
}

/// Absence is not a misspelling. A configured root that is simply not in the
/// tree — a build output, a gitignored junction — passes here; whether its
/// absence matters is the walk's question.
///
/// Absence is not a misspelling, and a configured root simply not in the tree passes.
/// ´claim:adoption:absence-is-no-misspelling´
#[test]
fn a_configured_path_that_is_simply_absent_is_no_misspelling() {
    let root = tree("spelling-absent", &["docs/README.md"]);
    for absent in ["android/", "web/out/", "docs/nowhere/", "Cargo.lock"] {
        let source = configuring(absent);
        let adoption = load(&source).expect("the fixture loads");
        assert!(
            adoption.verify_spellings(&root).is_ok(),
            "{absent} is absent, not misspelled"
        );
    }
}

/// The path that is spelled right passes, which is what keeps the check from
/// being vacuous.
///
/// A path spelled the way the tree spells it passes, which keeps the check from being vacuous.
/// ´claim:adoption:a-correct-path-passes´
#[test]
fn a_configured_path_the_tree_spells_the_same_way_passes() {
    let root = tree("spelling-exact", &["docs/primitive/layers.md"]);
    for spelled in ["docs/", "docs/primitive/", "docs/primitive/layers.md"] {
        let source = configuring(spelled);
        let adoption = load(&source).expect("the fixture loads");
        assert!(
            adoption.verify_spellings(&root).is_ok(),
            "{spelled} is the tree's own spelling"
        );
    }
}

/// Every section that configures a path is collected, so none of them can be
/// checked by accident and none forgotten.
///
/// Every section that configures a path contributes it, so none is checked by accident.
/// ´claim:adoption:every-section-contributes-its-paths´
#[test]
fn every_configuring_section_contributes_its_paths() {
    let adoption = ruled();
    let sections: std::collections::BTreeSet<&str> = adoption
        .configured_paths
        .iter()
        .map(|one| one.section)
        .collect();
    for expected in [
        "[partition]",
        "[carrier] exclude_trees",
        "[carrier] generated_files",
        "[carrier] vendored_files",
        "[enforcement] failing",
        "[kinds] registry",
    ] {
        assert!(sections.contains(expected), "{expected} contributes none");
    }
    assert!(
        !adoption
            .configured_paths
            .iter()
            .any(|one| one.path.as_str().is_empty()),
        "the empty prefix configures no path"
    );
}

/// The ruled adoption is spelled the way this repository spells its own
/// trees — the check over the corpus it was written for.
///
/// This corpus's own adoption data is spelled the way its tree is.
/// ´claim:adoption:the-ruled-paths-are-spelled-right´
#[test]
fn the_ruled_adoption_is_spelled_the_way_the_corpus_root_spells_it() {
    let root = corpus_adoption_path()
        .parent()
        .expect("the corpus root")
        .to_path_buf();
    ruled()
        .verify_spellings(&root)
        .expect("every configured path is spelled as the tree spells it");
}

/// This corpus's own adoption data loads.
/// ´claim:adoption:the-ruled-adoption-loads´
#[test]
fn the_ruled_adoption_loads() {
    let adoption = ruled();
    assert_eq!(&*adoption.meta.ruled, "2026-08-21");
}

/// The meta section arrives with the values it states.
/// ´claim:adoption:the-meta-section-round-trips´
#[test]
fn the_meta_section_round_trips() {
    let meta = ruled().meta;
    assert_eq!(&*meta.drafted, "2026-08-20");
    assert_eq!(&*meta.corpus_root, ".");
    assert_eq!(
        &*meta.rationale,
        "crates/cogra-linter/docs/adoption-notes.md"
    );
    assert_eq!(meta.discipline_docs.len(), 4);
    assert!(
        meta.discipline_docs
            .iter()
            .any(|doc| &**doc == "crates/cogra-linter/docs/label-calculus.md")
    );
    assert_eq!(meta.schema_version, [1, 0, 0]);
}

/// Major is enforced; minor and patch are carried, advisory only.
///
/// The schema major is enforced while its minor and patch are carried as advisory.
/// ´claim:adoption:the-schema-major-is-enforced´
#[test]
fn a_schema_major_this_build_reads_loads() {
    let source = document(ONE_PREFIX, TOTAL_PARTITION, NO_PROFILES, EMPTY_K)
        .replace("schema_version = [1, 0, 0]", "schema_version = [1, 9, 9]");
    let adoption = load(&source).expect("major 1 loads whatever minor and patch say");
    assert_eq!(adoption.meta.schema_version, [1, 9, 9]);
}

/// A major this build does not read is refused with a located error naming
/// both majors — never silently misinterpreted as the shape this build
/// expects.
///
/// A schema major this build does not read is refused with both majors named.
/// ´claim:adoption:a-foreign-schema-major-is-refused´
#[test]
fn a_schema_major_below_this_build_is_refused() {
    let source = document(ONE_PREFIX, TOTAL_PARTITION, NO_PROFILES, EMPTY_K)
        .replace("schema_version = [1, 0, 0]", "schema_version = [0, 9, 0]");
    let error = load(&source).expect_err("major 0 predates this build's reader");
    let AdoptionError::UnsupportedSchemaVersion {
        found, expected, ..
    } = error
    else {
        panic!("expected UnsupportedSchemaVersion, got {error:?}");
    };
    assert_eq!((found, expected), (0, 1));
    assert!(row(&source, &error).contains("schema_version"));
}

/// The same refusal for a major ahead of this build — the reader has no
/// obligation to guess forward compatibility it was never built for.
///
/// (´claim:adoption:a-foreign-schema-major-is-refused´)
#[test]
fn a_schema_major_above_this_build_is_refused() {
    let source = document(ONE_PREFIX, TOTAL_PARTITION, NO_PROFILES, EMPTY_K)
        .replace("schema_version = [1, 0, 0]", "schema_version = [2, 0, 0]");
    let error = load(&source).expect_err("major 2 postdates this build's reader");
    let AdoptionError::UnsupportedSchemaVersion { found, .. } = error else {
        panic!("expected UnsupportedSchemaVersion, got {error:?}");
    };
    assert_eq!(found, 2);
}

/// The carrier section arrives with the values it states.
/// ´claim:adoption:the-carrier-section-round-trips´
#[test]
fn the_carrier_section_round_trips() {
    let carrier = ruled().carrier;
    assert!(carrier.exclude_trees.contains(&PathPrefix::new(".git/")));
    assert!(carrier.exclude_trees.contains(&PathPrefix::new("target/")));
    assert!(
        carrier
            .generated_files
            .contains(&PathPrefix::new("schema.graphql"))
    );
    assert_eq!(
        carrier.vendored_trees,
        vec![PathPrefix::new(
            "crates/cogra-linter/vendor/tree-sitter-kotlin/"
        )]
    );
    assert_eq!(
        carrier.vendored_files,
        vec![PathPrefix::new("docs/primitive/layer1-interface.md")]
    );
}

/// The carrier section decides what is excluded and what is generated.
/// ´claim:adoption:the-carrier-decides-exclusion-and-generation´
#[test]
fn the_carrier_decides_what_is_excluded_and_what_is_generated() {
    let carrier = ruled().carrier;
    assert!(carrier.excludes(Path::new("target/debug/build.rs")));
    assert!(carrier.excludes(Path::new("docs/primitive/layer1-interface.md")));
    assert!(!carrier.excludes(Path::new("docs/primitive/layers.md")));
    assert!(carrier.is_generated(Path::new("Cargo.lock")));
    assert!(!carrier.is_generated(Path::new("Cargo.toml")));
}

/// The signature section arrives with the values it states.
/// ´claim:adoption:the-signature-section-round-trips´
#[test]
fn the_signature_section_round_trips() {
    let signature = ruled().signature;
    assert_eq!(
        signature.prefixes.get(&prefix("LBL")),
        Some(&OwnerId::new("doc.label-calculus"))
    );
    assert_eq!(
        signature.prefixes.get(&prefix("ARCH")),
        Some(&OwnerId::new("doc.linter-architecture"))
    );
    assert_eq!(signature.prefixes.len(), 11);
    let package = signature
        .families
        .iter()
        .find(|family| &*family.name == "package")
        .expect("the package family");
    assert!(package.registered);
    assert_eq!(package.rule_id.as_deref(), Some("R-PKG'"));
    let records = signature
        .families
        .iter()
        .find(|family| &*family.name == "numbered_records")
        .expect("the numbered-record family");
    assert!(!records.registered);
}

/// The package family derives a prefix for every package name by its own rule.
/// ´claim:adoption:the-package-family-derives-prefixes´
#[test]
fn the_package_family_derives_its_prefixes() {
    let signature = ruled().signature;
    assert_eq!(
        signature.derived_prefix(&OwnerId::new("pkg.api")),
        Some(prefix("API"))
    );
    assert_eq!(
        signature.derived_prefix(&OwnerId::new("pkg.postgres-store")),
        Some(prefix("POSTGRESSTORE"))
    );
    assert_eq!(
        signature.derived_prefix(&OwnerId::new("pkg.cogra-linter")),
        Some(prefix("LINTER")),
        "the leading COGRA goes when what remains is nonempty and unique"
    );
    assert_eq!(
        signature.derived_prefix(&OwnerId::new("tree.docs-root")),
        None
    );
    assert!(signature.registers(&OwnerId::new("tree.docs-root")));
    assert!(signature.registers(&OwnerId::new("pkg.web")));
    assert!(!signature.registers(&OwnerId::new("doc.nowhere")));
}

/// The partition section arrives with the values it states.
/// ´claim:adoption:the-partition-section-round-trips´
#[test]
fn the_partition_section_round_trips() {
    let partition = ruled().partition;
    assert_eq!(partition.rules.len(), 20);
    let first = &partition.rules[0];
    assert_eq!(first.order, 1);
    assert_eq!(
        first.path,
        PathPrefix::new("crates/cogra-linter/docs/label-calculus.md")
    );
    assert_eq!(first.owner, OwnerId::new("doc.label-calculus"));
    let last = partition.rules.last().expect("a last rule");
    assert_eq!(last.path, PathPrefix::new(""));
    assert_eq!(last.owner, OwnerId::new("tree.repo-root"));
}

/// The partition assigns an owner by first match.
/// ´claim:adoption:the-partition-assigns-by-first-match´
#[test]
fn the_partition_assigns_by_first_match() {
    let partition = ruled().partition;
    assert_eq!(
        partition.owner_for(Path::new("crates/cogra-linter/docs/label-calculus.md")),
        OwnerId::new("doc.label-calculus"),
        "the document rules precede the package rule that would otherwise take it"
    );
    assert_eq!(
        partition.owner_for(Path::new("crates/cogra-linter/docs/design.md")),
        OwnerId::new("pkg.cogra-linter")
    );
    assert_eq!(
        partition.owner_for(Path::new("crates/cogra-linter/src/adopt.rs")),
        OwnerId::new("pkg.cogra-linter")
    );
    assert_eq!(
        partition.owner_for(Path::new("docs/primitive/layers.md")),
        OwnerId::new("tree.docs-primitive"),
        "the tree rules precede the docs/ residual"
    );
    assert_eq!(
        partition.owner_for(Path::new("docs/README.md")),
        OwnerId::new("tree.docs-root")
    );
}

/// The partition is total by its last rule's empty prefix.
/// ´claim:adoption:the-partition-is-total´
#[test]
fn the_partition_is_total_by_its_last_rule() {
    let partition = ruled().partition;
    assert_eq!(
        partition.owner_for(Path::new("README.md")),
        OwnerId::new("tree.repo-root")
    );
    assert_eq!(
        partition.owner_for(Path::new("a/tree/nobody/foresaw.txt")),
        OwnerId::new("tree.repo-root")
    );
}

/// The two optional roots of this corpus are its working-note trees.
/// ´claim:adoption:the-optional-roots-are-the-working-notes´
#[test]
fn the_two_optional_roots_are_the_working_notes() {
    let partition = ruled().partition;
    let optional: Vec<&PathPrefix> = partition
        .rules
        .iter()
        .filter(|rule| rule.optional)
        .map(|rule| &rule.path)
        .collect();
    assert_eq!(
        optional,
        vec![
            &PathPrefix::new("tmp_dev/"),
            &PathPrefix::new("tmp_research_files/")
        ]
    );
}

/// The profiles section arrives with the values it states.
/// ´claim:adoption:the-profiles-section-round-trips´
#[test]
fn the_profiles_section_round_trips() {
    let profiles = ruled().profiles;
    assert_eq!(profiles.profiles.len(), 2);
    assert_eq!(profiles.effective_count, 2);
    assert_eq!(profiles.effective().count(), 2);

    let test = &profiles.profiles[0];
    assert_eq!(test.id, ProfileId::new("rust-test"));
    assert_eq!(test.kind, Kind::new("test"));
    assert_eq!(test.status, ProfileStatus::Effective);
    assert_eq!(test.census.language, Language::new("rust"));
    assert_eq!(test.census.attributes.len(), 3);
    assert_eq!(
        test.census.attribute_rule.as_deref(),
        Some("any attribute path whose final segment is 'test'")
    );
    assert_eq!(
        test.classification
            .areas
            .get(&Box::from("lib_or_bin_target")),
        Some(&cogra_linter::Area::new("unit"))
    );
    assert!(test.name_transformation.example.is_some());
    assert_eq!(
        &*test.standard_place.place,
        "a generated register of the owner"
    );

    let module = &profiles.profiles[1];
    assert_eq!(module.id, ProfileId::new("rust-module"));
    assert_eq!(module.kind, Kind::new("mod"));
    assert_eq!(module.status, ProfileStatus::Effective);
    assert_eq!(module.census.exclude.len(), 1);
    assert!(module.census.definition_rule.is_some());
    assert_eq!(
        module.classification.areas.get(&Box::from("all")),
        Some(&cogra_linter::Area::new("module"))
    );
    assert_eq!(
        &*module.standard_place.place,
        "the module's INNER documentation comment"
    );
}

/// A staged profile carries the condition it waits on.
/// ´claim:adoption:a-staged-profile-carries-its-condition´
#[test]
fn a_staged_profile_carries_the_condition_it_waits_on() {
    let profiles = "
[profiles]
count = 1
effective = 0

[[profiles.profile]]
id = \"rust-module\"
kind = \"mod\"
status = \"staged\"
enters_when = \"every module definition carries its inner doc comment\"

  [profiles.profile.census]
  language = \"rust\"
  recognizer = \"module definitions\"
  definition_rule = \"an inline mod item, or the file backing a declaration\"

  [profiles.profile.classification]
  rule = \"one constant area\"
  areas = { all = \"module\" }

  [profiles.profile.name_transformation]
  rule = \"the bare identifier, hyphenated\"

  [profiles.profile.standard_place]
  place = \"the module's INNER documentation comment\"

  [profiles.profile.collision]
  equivalence = \"the derived label, within one owner\"
  reports = \"every contributing asset\"

  [profiles.profile.activation]
  scope = \"every-owner\"
";
    let reserved = "
[reserved-kinds]
source = \"the assets family\"
count = 1
governed = [\"mod\"]
reserved_ungoverned = []
";
    let source = document(ONE_PREFIX, TOTAL_PARTITION, profiles, reserved);
    let adoption = load(&source).expect("a consistent staged profile");
    let ProfileStatus::Staged { enters_when } = &adoption.profiles.profiles[0].status else {
        panic!("the profile is staged");
    };
    assert!(enters_when.contains("inner doc comment"));
    assert_eq!(adoption.profiles.effective().count(), 0);
}

/// The reserved-kinds section arrives with the values it states.
/// ´claim:adoption:the-reserved-kinds-section-round-trips´
#[test]
fn the_reserved_kinds_section_round_trips() {
    let reserved = ruled().reserved_kinds;
    assert_eq!(reserved.count, 36);
    assert_eq!(reserved.governed, vec![Kind::new("test"), Kind::new("mod")]);
    assert_eq!(reserved.kinds().count(), 36);
    assert!(reserved.contains(&Kind::new("test")));
    assert!(reserved.contains(&Kind::new("endpoint")));
    assert!(
        !reserved.contains(&Kind::new("sig")),
        "the authored kinds stay outside K"
    );
}

/// The typed-data section arrives with the values it states.
/// ´claim:adoption:the-typed-data-section-round-trips´
#[test]
fn the_typed_data_section_round_trips() {
    let typed = ruled().typed_data;
    assert!(typed.classes.is_empty());
    assert!(typed.empty_in_v1);
    assert!(typed.status.is_some());
    assert!(typed.revisit_when.is_some());
}

/// The citation-index section arrives with the values it states.
/// ´claim:adoption:the-citation-index-section-round-trips´
#[test]
fn the_citation_index_section_round_trips() {
    let indexes = ruled().citation_indexes;
    assert!(indexes.designations.is_empty());
    assert!(indexes.empty_in_v1);
    assert!(indexes.reason.is_some());
}

/// The scanned-region section arrives with the values it states.
/// ´claim:adoption:the-scanned-region-section-round-trips´
#[test]
fn the_scanned_region_section_round_trips() {
    let scanned = ruled().scanned_regions;
    assert_eq!(scanned.languages.len(), 4);
    let markdown = &scanned.languages[0];
    assert_eq!(markdown.language, Language::new("markdown"));
    assert_eq!(markdown.extensions, vec![Box::from(".md")]);
    assert_eq!(&*markdown.frontend, "pulldown-cmark");
    assert_eq!(markdown.slice, 1);
    assert_eq!(markdown.not_scanned.len(), 2);
    let kotlin = &scanned.languages[3];
    assert!(kotlin.precondition.is_some());
    assert_eq!(
        kotlin.extensions,
        vec![Box::from(".kt"), Box::from(".kts")],
        "both file shapes are Kotlin, and one grammar root reads them"
    );
    assert_eq!(scanned.none.len(), 1);
    assert_eq!(scanned.none[0].languages.len(), 8);
}

/// A language is named in the scanned regions only where a frontend reads it.
/// ´claim:adoption:a-language-is-named-where-it-is-read´
#[test]
fn a_language_is_named_only_where_a_frontend_reads_it() {
    let scanned = ruled().scanned_regions;
    assert_eq!(
        scanned.language_of(Path::new("docs/README.md")),
        Some(Language::new("markdown"))
    );
    assert_eq!(
        scanned.language_of(Path::new("crates/api/src/lib.rs")),
        Some(Language::new("rust"))
    );
    assert_eq!(
        scanned.language_of(Path::new("android/settings.gradle.kts")),
        Some(Language::new("kotlin")),
        "a script is Kotlin, read by the same grammar as a source"
    );
    assert_eq!(
        scanned.language_of(Path::new("migrations/0001_up.sql")),
        None,
        "a language with no frontend has no scanned regions"
    );
    assert_eq!(scanned.language_of(Path::new("Makefile")), None);
    assert_eq!(
        scanned.language_of(Path::new(".md")),
        None,
        "an extension is not a whole file name"
    );
}

/// The head-recognition section arrives with the values it states.
/// ´claim:adoption:the-head-recognition-section-round-trips´
#[test]
fn the_head_recognition_section_round_trips() {
    let heads = ruled().head_recognition;
    assert_eq!(&*heads.separator, "·");
    assert_eq!(heads.matching, HeadMatching::CaseExact);
    assert_eq!(heads.forms.len(), 3);
    assert_eq!(&*heads.forms[0].id, "environment-head");
    assert_eq!(heads.forms[0].language, Language::new("markdown"));
    assert_eq!(&*heads.forms[1].id, "heading");
    assert_eq!(&*heads.forms[2].id, "title");
    assert_eq!(heads.forms[2].language, Language::new("markdown"));
    assert_eq!(heads.none.len(), 1);
    assert_eq!(heads.none[0].languages.len(), 3);
}

/// The banned-token section arrives with the values it states.
/// ´claim:adoption:the-banned-token-section-round-trips´
#[test]
fn the_banned_token_section_round_trips() {
    let banned = ruled().banned_tokens;
    assert_eq!(banned.rules.len(), 2);
    assert_eq!(&*banned.rules[0].id, "rust-plain-line-comment");
    assert_eq!(banned.rules[0].language, Language::new("rust"));
    assert_eq!(banned.rules[0].severity, cogra_linter::Severity::Error);
    assert_eq!(&*banned.rules[1].id, "rust-plain-block-comment");
}

/// Each row's `class` is the lexer's own vocabulary token, and it arrives
/// as written — the key the rule is read from, beside the `token` prose
/// that no code reads.
///
/// Every banned-token row names its class in the lexer's own vocabulary, as written.
/// ´claim:adoption:every-ban-row-names-a-lexer-class´
#[test]
fn every_banned_token_row_names_its_class_in_the_lexers_vocabulary() {
    let banned = ruled().banned_tokens;
    assert_eq!(&*banned.rules[0].class, "plain line comment");
    assert_eq!(&*banned.rules[1].class, "plain block comment");
    for row in &banned.rules {
        assert!(
            row.token.starts_with(&*row.class),
            "the prose {:?} spells a different class than {:?}",
            row.token,
            row.class
        );
    }
}

/// The registry document is named by its own key, and `registry_document`
/// reads that key and nothing else — no prose, no compiled-in path, and no
/// positional read of `[meta] discipline_docs`.
///
/// The registry document is read from its own key and from nothing else.
/// ´claim:adoption:the-registry-document-is-read-from-its-key´
#[test]
fn the_registry_document_is_read_from_its_key() {
    let adoption = ruled();
    assert_eq!(
        &*adoption.kinds.registry,
        "crates/cogra-linter/docs/environment-kinds.md"
    );
    assert_eq!(
        adoption.registry_document(),
        PathBuf::from("crates/cogra-linter/docs/environment-kinds.md")
    );
    assert!(
        corpus_adoption_path()
            .parent()
            .expect("the corpus root")
            .join(adoption.registry_document())
            .is_file(),
        "the key names a document the corpus carries"
    );
}

/// A fixture naming a different registry gets that one: the key is the
/// datum, so the reading follows the file rather than this corpus.
///
/// (´claim:adoption:the-registry-document-is-read-from-its-key´)
#[test]
fn the_registry_document_follows_the_key() {
    let source = document(ONE_PREFIX, TOTAL_PARTITION, NO_PROFILES, EMPTY_K);
    let adoption = load(&source).expect("the fixture loads");
    assert_eq!(
        adoption.registry_document(),
        PathBuf::from("docs/environment-kinds.md")
    );
}

/// `[kinds]` without its registry key names no document, so the data will
/// not load at all rather than leaving the bootstrap to guess one.
///
/// A kinds section without its registry key will not load at all.
/// ´claim:adoption:a-registryless-kinds-section-is-refused´
#[test]
fn a_kinds_section_with_no_registry_key_is_refused() {
    let source = document(ONE_PREFIX, TOTAL_PARTITION, NO_PROFILES, EMPTY_K)
        .replace("registry = \"docs/environment-kinds.md\"\n", "");
    let error = load(&source).expect_err("no registry key");
    assert!(matches!(error, AdoptionError::Syntax(_)), "{error:?}");
    assert!(
        error.to_string().contains("TOML"),
        "the message names the parse: {error}"
    );
}

/// The kinds section arrives with the values it states.
/// ´claim:adoption:the-kinds-section-round-trips´
#[test]
fn the_kinds_section_round_trips() {
    let kinds = ruled().kinds;
    assert_eq!(kinds.extensions.rows.len(), 7);
    assert!(
        kinds
            .extensions
            .rows
            .iter()
            .all(|row| &*row.name == "Document" && &*row.status == "firm")
    );
    assert!(kinds.extensions.hybrids.is_empty());
    assert!(!kinds.extensions.empty_in_v1);
    assert_eq!(kinds.evidence.owned.len(), kinds.extensions.rows.len());
    assert!(kinds.statuses.strengthenings.is_empty());
    assert_eq!(kinds.statuses.daggered.len(), 3);
    assert_eq!(kinds.statuses.candidates.len(), 1);
    assert_eq!(kinds.generator.covers.len(), 3);
    assert_eq!(
        &*kinds.register.standard_place,
        "crates/cogra-linter/docs/attestation-register.md"
    );
    assert_eq!(
        &*kinds.register.state,
        "generated — compared byte-exact every run"
    );
}

/// The enforcement section arrives with the values it states.
/// ´claim:adoption:the-enforcement-section-round-trips´
#[test]
fn the_enforcement_section_round_trips() {
    let enforcement = ruled().enforcement;
    assert_eq!(enforcement.default, Enforcement::Advisory);
    assert_eq!(
        enforcement.failing,
        vec![
            PathPrefix::new("crates/cogra-linter/"),
            PathPrefix::new("crates/cogra-interchange/"),
            PathPrefix::new("crates/postgres-store/"),
            PathPrefix::new("crates/l1-standin/"),
            PathPrefix::new("crates/common/"),
            PathPrefix::new("crates/api/"),
            PathPrefix::new("docs/"),
            PathPrefix::new("web/"),
            PathPrefix::new("android/"),
        ]
    );
}

/// Every tree of the carrier is failing, so the advisory half is now only
/// what is never committed: the working notes, whose roots are gitignored
/// junctions. They are owned so a note resolves rather than falling outside
/// the partition, and advisory because no build should fail on one.
///
/// A finding's enforcement is decided by its path.
/// ´claim:adoption:enforcement-follows-the-path´
#[test]
fn enforcement_is_decided_by_the_finding_s_path() {
    let enforcement = ruled().enforcement;
    assert_eq!(
        enforcement.enforcement_for(Path::new("crates/cogra-linter/docs/design.md")),
        Enforcement::Failing
    );
    assert_eq!(
        enforcement.enforcement_for(Path::new("docs/primitive/layers.md")),
        Enforcement::Failing
    );
    assert_eq!(
        enforcement.enforcement_for(Path::new("crates/api/src/lib.rs")),
        Enforcement::Failing
    );
    assert_eq!(
        enforcement.enforcement_for(Path::new("android/app/src/main/kotlin/A.kt")),
        Enforcement::Failing
    );
    assert_eq!(
        enforcement.enforcement_for(Path::new("tmp_dev/2026-08-26-hand-test.md")),
        Enforcement::Advisory
    );
}

/// A minimal adoption naming every required section loads.
/// ´claim:adoption:a-minimal-adoption-loads´
#[test]
fn a_minimal_adoption_loads() {
    let source = document(ONE_PREFIX, TOTAL_PARTITION, NO_PROFILES, EMPTY_K);
    assert!(load(&source).is_ok(), "the fixtures' own base must load");
}

/// An unreadable adoption file is an error and not a finding.
/// ´claim:adoption:an-unreadable-file-is-an-error´
#[test]
fn an_unreadable_file_is_an_error_and_not_a_finding() {
    let error = Adoption::load(Path::new("no-such-corpus-adoption.toml"))
        .expect_err("a file that is not there");
    assert!(matches!(error, AdoptionError::Unreadable { .. }));
    assert!(error.at().is_none());
}

/// Malformed adoption data is a syntax error.
/// ´claim:adoption:malformed-data-is-a-syntax-error´
#[test]
fn malformed_toml_is_a_syntax_error() {
    let error = load("[meta\n").expect_err("an unclosed table header");
    assert!(matches!(error, AdoptionError::Syntax(_)));
}

/// A partition rule naming an unregistered owner is located at its row.
/// ´claim:adoption:an-unregistered-rule-owner-is-located´
#[test]
fn a_partition_rule_naming_an_unregistered_owner_is_located() {
    let partition = "
[partition]

[[partition.rule]]
order = 1
path = \"docs/\"
owner = \"doc.nobody-registers-this\"

[[partition.rule]]
order = 2
path = \"\"
owner = \"doc.one\"
";
    let source = document(ONE_PREFIX, partition, NO_PROFILES, EMPTY_K);
    let error = load(&source).expect_err("an owner no prefix registers");
    let AdoptionError::UnknownOwner {
        order, ref owner, ..
    } = error
    else {
        panic!("expected UnknownOwner, got {error:?}");
    };
    assert_eq!(order, 1);
    assert_eq!(owner, "doc.nobody-registers-this");
    assert!(row(&source, &error).contains("doc.nobody-registers-this"));
}

/// A registration the prefix grammar refuses is located at its row.
/// ´claim:adoption:a-malformed-prefix-is-located´
#[test]
fn a_registration_the_prefix_grammar_refuses_is_located() {
    let signature = "[signature]

[[signature.prefix]]
prefix = \"Lbl\"
owner = \"doc.one\"
";
    let source = document(signature, TOTAL_PARTITION, NO_PROFILES, EMPTY_K);
    let error = load(&source).expect_err("a prefix no imported citation could name");
    let AdoptionError::MalformedPrefix {
        prefix: ref written,
        ..
    } = error
    else {
        panic!("expected MalformedPrefix, got {error:?}");
    };
    assert_eq!(written, "Lbl");
    assert!(row(&source, &error).contains("Lbl"));
}

/// A prefix registered twice is located at the second registration.
/// ´claim:adoption:a-duplicate-prefix-is-located´
#[test]
fn a_prefix_registered_twice_is_located_at_the_second_registration() {
    let signature = "[signature]

[[signature.prefix]]
prefix = \"DOC\"
owner = \"doc.one\"

[[signature.prefix]]
prefix = \"DOC\"
owner = \"doc.two\"
";
    let source = document(signature, TOTAL_PARTITION, NO_PROFILES, EMPTY_K);
    let error = load(&source).expect_err("one prefix, two registrations");
    let AdoptionError::DuplicatePrefix { ref prefix, .. } = error else {
        panic!("expected DuplicatePrefix, got {error:?}");
    };
    assert_eq!(prefix, "DOC");
    let at = error.at().expect("a located defect");
    assert!(row(&source, &error).contains("DOC"));
    assert!(
        at.line > 12,
        "the second registration, not the first: line {}",
        at.line
    );
}

/// A partition whose last rule carries a prefix is not total.
/// ´claim:adoption:a-prefixed-last-rule-is-not-total´
#[test]
fn a_partition_whose_last_rule_carries_a_prefix_is_not_total() {
    let partition = "
[partition]

[[partition.rule]]
order = 1
path = \"docs/\"
owner = \"doc.one\"
";
    let source = document(ONE_PREFIX, partition, NO_PROFILES, EMPTY_K);
    let error = load(&source).expect_err("Ω is not total");
    assert!(matches!(error, AdoptionError::PartitionNotTotal { .. }));
    assert!(row(&source, &error).contains("docs/"));
}

/// `order` is the document's claim about the matching order, and matching
/// walks the stored array — so a rule whose order is not its position would
/// match in an order its own row contradicts. The campaign that found this
/// flipped `order = 4` to `order = 8`; the loader now refuses it.
///
/// A rule whose stated order is not its position is refused at that row.
/// ´claim:adoption:an-order-must-be-its-position´
#[test]
fn a_rule_whose_order_is_not_its_position_is_located() {
    let partition = "
[partition]

[[partition.rule]]
order = 1
path = \"docs/\"
owner = \"doc.one\"

[[partition.rule]]
order = 8
path = \"crates/\"
owner = \"doc.one\"

[[partition.rule]]
order = 3
path = \"\"
owner = \"doc.one\"
";
    let source = document(ONE_PREFIX, partition, NO_PROFILES, EMPTY_K);
    let error = load(&source).expect_err("an order that is not its position");
    let AdoptionError::RuleOrderMismatch {
        order, position, ..
    } = error
    else {
        panic!("expected RuleOrderMismatch, got {error:?}");
    };
    assert_eq!(order, 8);
    assert_eq!(position, 2);
    assert!(row(&source, &error).contains("order = 8"));
}

/// A repeated order is the same defect: two rules claiming one position, and
/// the row named is the one that is wrong.
///
/// (´claim:adoption:an-order-must-be-its-position´)
#[test]
fn a_repeated_order_is_refused_at_the_second_rule() {
    let partition = "
[partition]

[[partition.rule]]
order = 1
path = \"docs/\"
owner = \"doc.one\"

[[partition.rule]]
order = 1
path = \"\"
owner = \"doc.one\"
";
    let source = document(ONE_PREFIX, partition, NO_PROFILES, EMPTY_K);
    let error = load(&source).expect_err("two rules claiming one position");
    let AdoptionError::RuleOrderMismatch { position, .. } = error else {
        panic!("expected RuleOrderMismatch, got {error:?}");
    };
    assert_eq!(position, 2);
}

/// The ruled adoption's own orders are its positions, which is what the
/// check asserts of every file it loads.
///
/// This corpus's own partition states each rule's position.
/// ´claim:adoption:the-ruled-orders-are-positions´
#[test]
fn the_ruled_partition_states_each_rules_position() {
    for (index, rule) in ruled().partition.rules.iter().enumerate() {
        assert_eq!(
            rule.order as usize,
            index + 1,
            "the rule at position {} states order {}",
            index + 1,
            rule.order
        );
    }
}

/// A profile stating fewer than its seven data is refused at its own row.
/// ´claim:adoption:an-incomplete-profile-is-located´
#[test]
fn a_profile_missing_one_of_its_seven_data_is_located() {
    let profiles = "
[profiles]
count = 1
effective = 0

[[profiles.profile]]
id = \"rust-test\"
kind = \"test\"
status = \"staged\"
enters_when = \"the register generation lands\"
";
    let reserved = "
[reserved-kinds]
source = \"the assets family\"
count = 1
governed = [\"test\"]
reserved_ungoverned = []
";
    let source = document(ONE_PREFIX, TOTAL_PARTITION, profiles, reserved);
    let error = load(&source).expect_err("a profile with no census");
    let AdoptionError::ProfileIncomplete { ref id, datum, .. } = error else {
        panic!("expected ProfileIncomplete, got {error:?}");
    };
    assert_eq!(id, "rust-test");
    assert_eq!(datum, "census");
    assert!(row(&source, &error).contains("rust-test"));
}

/// A staged profile waiting on nothing stated is incomplete.
/// ´claim:adoption:a-conditionless-staged-profile-is-incomplete´
#[test]
fn a_staged_profile_with_no_entry_condition_is_incomplete() {
    let profiles = "
[profiles]
count = 1
effective = 0

[[profiles.profile]]
id = \"rust-test\"
kind = \"test\"
status = \"staged\"
";
    let reserved = "
[reserved-kinds]
source = \"the assets family\"
count = 1
governed = [\"test\"]
reserved_ungoverned = []
";
    let source = document(ONE_PREFIX, TOTAL_PARTITION, profiles, reserved);
    let error = load(&source).expect_err("a staged profile waiting on nothing stated");
    let AdoptionError::ProfileIncomplete { datum, .. } = error else {
        panic!("expected ProfileIncomplete, got {error:?}");
    };
    assert_eq!(datum, "entry condition");
}

/// A profile governing a kind the reserved set does not hold is located.
/// ´claim:adoption:an-unreserved-governed-kind-is-located´
#[test]
fn a_profile_governing_a_kind_outside_k_is_located() {
    let profiles = "
[profiles]
count = 1
effective = 0

[[profiles.profile]]
id = \"rust-test\"
kind = \"test\"
status = \"staged\"
enters_when = \"the register generation lands\"

  [profiles.profile.census]
  language = \"rust\"
  recognizer = \"a test-attributed fn\"

  [profiles.profile.classification]
  rule = \"the Cargo target\"
  areas = { lib_or_bin_target = \"unit\" }

  [profiles.profile.name_transformation]
  rule = \"the bare identifier, hyphenated\"

  [profiles.profile.standard_place]
  place = \"a generated register of the owner\"

  [profiles.profile.collision]
  equivalence = \"the derived label, within one owner\"
  reports = \"every contributing asset\"

  [profiles.profile.activation]
  scope = \"every-owner\"
";
    let source = document(ONE_PREFIX, TOTAL_PARTITION, profiles, EMPTY_K);
    let error = load(&source).expect_err("a governed kind that K does not reserve");
    let AdoptionError::UngovernedKindNotReserved {
        ref id, ref kind, ..
    } = error
    else {
        panic!("expected UngovernedKindNotReserved, got {error:?}");
    };
    assert_eq!(id, "rust-test");
    assert_eq!(kind, "test");
    assert!(row(&source, &error).contains("test"));
}

/// A stated effective count no profile supports is located at that row.
/// ´claim:adoption:a-wrong-effective-count-is-located´
#[test]
fn a_stated_effective_count_that_no_profile_supports_is_located() {
    let profiles = "
[profiles]
count = 0
effective = 1
";
    let source = document(ONE_PREFIX, TOTAL_PARTITION, profiles, EMPTY_K);
    let error = load(&source).expect_err("one effective profile stated, none registered");
    let AdoptionError::EffectiveCountMismatch { stated, found, .. } = error else {
        panic!("expected EffectiveCountMismatch, got {error:?}");
    };
    assert_eq!((stated, found), (1, 0));
    assert!(row(&source, &error).contains("effective = 1"));
}

/// An effective profile is counted among those in force.
/// ´claim:adoption:an-effective-profile-is-counted´
#[test]
fn an_effective_profile_is_counted() {
    let profiles = "
[profiles]
count = 1
effective = 1

[[profiles.profile]]
id = \"rust-test\"
kind = \"test\"
status = \"effective\"

  [profiles.profile.census]
  language = \"rust\"
  recognizer = \"a test-attributed fn\"

  [profiles.profile.classification]
  rule = \"the Cargo target\"
  areas = { lib_or_bin_target = \"unit\" }

  [profiles.profile.name_transformation]
  rule = \"the bare identifier, hyphenated\"

  [profiles.profile.standard_place]
  place = \"a generated register of the owner\"

  [profiles.profile.collision]
  equivalence = \"the derived label, within one owner\"
  reports = \"every contributing asset\"

  [profiles.profile.activation]
  scope = \"every-owner\"
";
    let reserved = "
[reserved-kinds]
source = \"the assets family\"
count = 1
governed = [\"test\"]
reserved_ungoverned = []
";
    let source = document(ONE_PREFIX, TOTAL_PARTITION, profiles, reserved);
    let adoption = load(&source).expect("a consistent effective profile");
    assert_eq!(adoption.profiles.effective_count, 1);
    assert_eq!(adoption.profiles.effective().count(), 1);
}

/// A Cargo workspace member with no partition rule of its own falls to the
/// residual owner unnoticed until this check — R-PKG′ would have derived
/// WIDGETS for it, and the located error names both.
///
/// A workspace member with no partition rule of its own is located, with its derived prefix named.
/// ´claim:adoption:an-unregistered-member-is-located´
#[test]
fn an_unregistered_cargo_member_is_located() {
    let root = workspace_tree("roster-unregistered-cargo", &["crates/widgets"]);
    let source = document(
        ONE_PREFIX_WITH_PACKAGE_FAMILY,
        TOTAL_PARTITION,
        NO_PROFILES,
        EMPTY_K,
    );
    let adoption = load(&source).expect("the fixture loads");
    let error = adoption
        .verify_package_roster(&root)
        .expect_err("crates/widgets has no partition rule of its own");
    let AdoptionError::UnregisteredPackage {
        ref package,
        ref derived_prefix,
        ..
    } = error
    else {
        panic!("expected UnregisteredPackage, got {error:?}");
    };
    assert_eq!(package, "widgets");
    assert_eq!(derived_prefix, "WIDGETS");
    assert!(
        row(&source, &error).contains("path"),
        "{}",
        row(&source, &error)
    );
}

/// A Cargo workspace member with a partition rule of its own passes: the
/// check is about the roster's completeness, not a judgment on the rule.
///
/// A workspace member with a partition rule of its own passes.
/// ´claim:adoption:a-registered-member-passes´
#[test]
fn a_registered_cargo_member_passes() {
    let root = workspace_tree("roster-registered-cargo", &["crates/widgets"]);
    let partition = "
[partition]

[[partition.rule]]
order = 1
path = \"crates/widgets/\"
owner = \"doc.one\"

[[partition.rule]]
order = 2
path = \"\"
owner = \"doc.one\"
";
    let source = document(
        ONE_PREFIX_WITH_PACKAGE_FAMILY,
        partition,
        NO_PROFILES,
        EMPTY_K,
    );
    let adoption = load(&source).expect("the fixture loads");
    assert!(
        adoption.verify_package_roster(&root).is_ok(),
        "crates/widgets/ has a partition rule of its own"
    );
}

/// The Gradle build is named by `android/build.gradle.kts`, the one anchor
/// a 15-module build carries exactly once — an unlisted build is located the
/// same way an unlisted crate is.
///
/// An unlisted Gradle build is located the way an unlisted crate is.
/// ´claim:adoption:an-unregistered-android-build-is-located´
#[test]
fn an_unregistered_android_build_is_located() {
    let root = tree("roster-unregistered-android", &["android/build.gradle.kts"]);
    let source = document(
        ONE_PREFIX_WITH_PACKAGE_FAMILY,
        TOTAL_PARTITION,
        NO_PROFILES,
        EMPTY_K,
    );
    let adoption = load(&source).expect("the fixture loads");
    let error = adoption
        .verify_package_roster(&root)
        .expect_err("android/ has no partition rule of its own");
    let AdoptionError::UnregisteredPackage {
        ref package,
        ref derived_prefix,
        ..
    } = error
    else {
        panic!("expected UnregisteredPackage, got {error:?}");
    };
    assert_eq!(package, "android");
    assert_eq!(derived_prefix, "ANDROID");
}

/// The npm package is named by `web/package.json` existing, read for
/// existence alone — this check parses no JSON.
///
/// An unlisted npm package is located by its manifest's existence alone.
/// ´claim:adoption:an-unregistered-web-package-is-located´
#[test]
fn an_unregistered_web_package_is_located() {
    let root = tree("roster-unregistered-web", &["web/package.json"]);
    let source = document(
        ONE_PREFIX_WITH_PACKAGE_FAMILY,
        TOTAL_PARTITION,
        NO_PROFILES,
        EMPTY_K,
    );
    let adoption = load(&source).expect("the fixture loads");
    let error = adoption
        .verify_package_roster(&root)
        .expect_err("web/ has no partition rule of its own");
    let AdoptionError::UnregisteredPackage { ref package, .. } = error else {
        panic!("expected UnregisteredPackage, got {error:?}");
    };
    assert_eq!(package, "web");
}

/// A root with no readable workspace manifest and no android or web build
/// has nothing to reconcile: Cargo well-formedness is not this check's
/// question, so it passes with an empty roster.
///
/// A root with no build manifest at all has nothing to reconcile and passes.
/// ´claim:adoption:no-manifests-means-nothing-to-reconcile´
#[test]
fn a_root_with_no_build_manifests_has_nothing_to_reconcile() {
    let root = tree("roster-no-manifests", &["README.md"]);
    let source = document(
        ONE_PREFIX_WITH_PACKAGE_FAMILY,
        TOTAL_PARTITION,
        NO_PROFILES,
        EMPTY_K,
    );
    let adoption = load(&source).expect("the fixture loads");
    assert!(
        adoption.verify_package_roster(&root).is_ok(),
        "no Cargo.toml, no android/, no web/ — nothing to reconcile"
    );
}

/// The check over this repository's own adoption data and its own root: the
/// six Cargo crates, android, and web every one has a partition rule of its
/// own.
///
/// This repository registers every package it names.
/// ´claim:adoption:the-ruled-roster-is-complete´
#[test]
fn the_ruled_corpus_registers_every_package_it_names() {
    let root = corpus_adoption_path()
        .parent()
        .expect("the corpus root")
        .to_path_buf();
    ruled()
        .verify_package_roster(&root)
        .expect("every real package has a partition rule of its own");
}

/// An effective test profile with every one of its seven data, for the
/// `[claims]` fixtures to ride.
const RIDDEN_PROFILE: &str = "
[profiles]
count = 1
effective = 1

[[profiles.profile]]
id = \"rust-test\"
kind = \"test\"
status = \"effective\"

  [profiles.profile.census]
  language = \"rust\"
  recognizer = \"a test-attributed fn\"

  [profiles.profile.classification]
  rule = \"the Cargo target\"
  areas = { lib_or_bin_target = \"unit\" }

  [profiles.profile.name_transformation]
  rule = \"the bare identifier, hyphenated\"

  [profiles.profile.standard_place]
  place = \"a generated register of the owner\"

  [profiles.profile.collision]
  equivalence = \"the derived label, within one owner\"
  reports = \"every contributing asset\"

  [profiles.profile.activation]
  scope = \"every-owner\"
";

/// K reserving the one kind `RIDDEN_PROFILE` governs.
const TEST_K: &str = "
[reserved-kinds]
source = \"the assets family\"
count = 1
governed = [\"test\"]
reserved_ungoverned = []
";

/// A `[claims]` section around whatever activation is being planted.
fn claims_section(activation: &str) -> String {
    format!(
        "
[claims]
kind = \"claim\"
rides = \"rust-test\"
source = \"the results family\"

  [claims.standard_place]
  place = \"the covered test's own documentation comment\"
  form = \"the final documentation line\"

  [claims.statement]
  rule = \"the last non-empty line above the claim line\"

  [claims.collision]
  equivalence = \"the claim label, within one owner\"
  reports = \"both locations\"

  [claims.matrix]
  register = \"one per activated owner\"
  form = \"one row per claim\"
{activation}"
    )
}

/// A whole document carrying the ridden profile and a `[claims]` section.
fn claims_document(activation: &str) -> String {
    document(
        ONE_PREFIX,
        TOTAL_PARTITION,
        RIDDEN_PROFILE,
        &format!("{TEST_K}{}", claims_section(activation)),
    )
}

/// The permissive activation shape, spelled once.
const EVERY_OWNER: &str = "
  [claims.activation]
  scope = \"every-owner\"
";

/// (´[LBL-sig:labels:profiles]´): the permissive shape is in force over every
/// owner, so an owner added tomorrow is judged the day it appears.
///
/// An every-owner activation admits every owner, named or not.
/// ´claim:adoption:every-owner-admits-anyone´
#[test]
fn an_every_owner_activation_admits_an_owner_it_never_names() {
    let source = claims_document(EVERY_OWNER);
    let adoption = load(&source).expect("an every-owner activation");
    let declared = adoption.claims.expect("the claim discipline is adopted");
    assert_eq!(declared.activation, Activation::EveryOwner);
    assert!(declared.activation.admits(&OwnerId::new("doc.one")));
    assert!(declared.activation.admits(&OwnerId::new("never.registered")));
    assert_eq!(declared.activation.declared(), None);
}

/// (´dec:lint:claim-activation´): a declared activation admits the owners it
/// names and no others, which is what closes one wave at a time.
///
/// A declared activation admits exactly the owners it names.
/// ´claim:adoption:a-declared-activation-admits-what-it-names´
#[test]
fn a_declared_activation_admits_only_the_owners_it_names() {
    let source = claims_document(
        "
  [claims.activation]
  scope = \"declared\"
  owners = [\"doc.one\"]
",
    );
    let adoption = load(&source).expect("a declared activation");
    let declared = adoption.claims.expect("the claim discipline is adopted");
    assert!(declared.activation.admits(&OwnerId::new("doc.one")));
    assert!(!declared.activation.admits(&OwnerId::new("doc.two")));
    assert_eq!(declared.activation.declared(), Some(1));
}

/// (´dec:lint:claim-activation´): an activation naming an owner Σ registers
/// nothing for closes a wave over no assets while reading like a closed one.
///
/// An activation naming an unregistered owner is refused at its own row.
/// ´claim:adoption:an-unregistered-activation-owner-is-located´
#[test]
fn an_activation_naming_an_unregistered_owner_is_located() {
    let source = claims_document(
        "
  [claims.activation]
  scope = \"declared\"
  owners = [\"pkg.nowhere\"]
",
    );
    let error = load(&source).expect_err("an owner no prefix registers");
    let AdoptionError::ActivationUnknownOwner { ref owner, .. } = error else {
        panic!("expected ActivationUnknownOwner, got {error:?}");
    };
    assert_eq!(owner, "pkg.nowhere");
    assert!(row(&source, &error).contains("pkg.nowhere"));
}

/// (´dec:lint:claim-activation´): one owner named twice is one permission
/// written twice, and two spellings of it are a place to drift apart.
///
/// An activation naming one owner twice is refused.
/// ´claim:adoption:a-repeated-activation-owner-is-refused´
#[test]
fn an_activation_naming_one_owner_twice_is_refused() {
    let source = claims_document(
        "
  [claims.activation]
  scope = \"declared\"
  owners = [\"doc.one\", \"doc.one\"]
",
    );
    let error = load(&source).expect_err("one owner named twice");
    assert!(
        matches!(error, AdoptionError::ActivationRepeatedOwner { .. }),
        "expected ActivationRepeatedOwner, got {error:?}"
    );
}

/// (´dec:lint:claim-activation´): a discipline holding nobody to anything is
/// registered by not being written, so an empty declared list is refused.
///
/// A declared activation over no owner is refused.
/// ´claim:adoption:an-empty-activation-is-refused´
#[test]
fn a_declared_activation_over_no_owner_is_refused() {
    let source = claims_document(
        "
  [claims.activation]
  scope = \"declared\"
  owners = []
",
    );
    let error = load(&source).expect_err("a declared activation naming nobody");
    assert!(
        matches!(error, AdoptionError::ActivationEmpty { .. }),
        "expected ActivationEmpty, got {error:?}"
    );
}

/// (´dec:lint:claim-activation´): the scope is refused rather than defaulted,
/// because a misspelling that quietly became the permissive shape would close
/// every wave at once.
///
/// An activation scope outside the two shapes is refused rather than defaulted.
/// ´claim:adoption:an-unknown-activation-scope-is-refused´
#[test]
fn an_unknown_activation_scope_is_refused() {
    let source = claims_document(
        "
  [claims.activation]
  scope = \"sometimes\"
",
    );
    let error = load(&source).expect_err("a scope that is neither shape");
    let AdoptionError::ActivationScopeUnknown { ref scope, .. } = error else {
        panic!("expected ActivationScopeUnknown, got {error:?}");
    };
    assert_eq!(scope, "sometimes");
}

/// (´[LBL-inv:labels:warrant-totality]´): a kind in K admits derivation only,
/// so a claim of such a kind could stand on no warrant at all.
///
/// A claim discipline naming a kind reserved in K is refused.
/// ´claim:adoption:a-reserved-claim-kind-is-refused´
#[test]
fn a_claim_discipline_naming_a_reserved_kind_is_refused() {
    let reserved = "
[reserved-kinds]
source = \"the assets family\"
count = 2
governed = [\"test\"]
reserved_ungoverned = [\"claim\"]
";
    let source = document(
        ONE_PREFIX,
        TOTAL_PARTITION,
        RIDDEN_PROFILE,
        &format!("{reserved}{}", claims_section(EVERY_OWNER)),
    );
    let error = load(&source).expect_err("a claim kind reserved in K");
    let AdoptionError::ClaimKindReserved { ref kind, .. } = error else {
        panic!("expected ClaimKindReserved, got {error:?}");
    };
    assert_eq!(kind, "claim");
}

/// (´dec:lint:claim-standing´): the discipline's census is the ridden
/// profile's, so a name Π does not know would cover nothing while reading like
/// a subscription.
///
/// A claim discipline riding an unregistered profile is refused.
/// ´claim:adoption:an-unridden-profile-is-refused´
#[test]
fn a_claim_discipline_riding_an_unregistered_profile_is_refused() {
    let source = claims_document(EVERY_OWNER).replace("\"rust-test\"\nsource", "\"rust-none\"\nsource");
    let error = load(&source).expect_err("a profile Pi does not register");
    let AdoptionError::ClaimProfileUnknown { ref id, .. } = error else {
        panic!("expected ClaimProfileUnknown, got {error:?}");
    };
    assert_eq!(id, "rust-none");
}

/// (´dec:lint:claim-standing´): the corpus's own `[claims]` states the pilot
/// wave, and the roster is read rather than recited.
///
/// The ruled corpus activates the claim discipline for one owner alone.
/// ´claim:adoption:the-ruled-claims-name-one-owner´
#[test]
fn the_ruled_claim_discipline_activates_one_owner() {
    let adoption = ruled();
    let declared = adoption
        .claims
        .as_ref()
        .expect("this corpus adopts the discipline");
    assert_eq!(declared.kind, Kind::new("claim"));
    assert_eq!(declared.rides, ProfileId::new("rust-test"));
    assert!(
        !adoption.reserved_kinds.contains(&declared.kind),
        "a claim stands on an authorship warrant"
    );
    assert_eq!(declared.activation.declared(), Some(1));
    assert!(declared.activation.admits(&OwnerId::new("pkg.cogra-linter")));
    assert!(!declared.activation.admits(&OwnerId::new("pkg.api")));
}

/// (´[LBL-sig:labels:profiles]´): both v1 profiles are in force corpus-wide,
/// so a crate added tomorrow cannot escape the inventory judgment in silence.
///
/// Every registered profile of this corpus is in force over every owner.
/// ´claim:adoption:the-ruled-profiles-are-in-force-everywhere´
#[test]
fn every_ruled_profile_is_activated_over_every_owner() {
    for profile in &ruled().profiles.profiles {
        assert_eq!(
            profile.activation,
            Activation::EveryOwner,
            "profile {} is enumerated rather than corpus-wide",
            profile.id.as_str()
        );
        assert!(profile.collision.equivalence.contains("derived label"));
    }
}
