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
    Adoption, AdoptionError, Enforcement, HeadMatching, Kind, Language, OwnerId, PathPrefix,
    Prefix, ProfileId, ProfileStatus,
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

#[test]
fn the_ruled_adoption_loads() {
    let adoption = ruled();
    assert_eq!(&*adoption.meta.ruled, "2026-08-21");
}

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
}

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

#[test]
fn the_carrier_decides_what_is_excluded_and_what_is_generated() {
    let carrier = ruled().carrier;
    assert!(carrier.excludes(Path::new("target/debug/build.rs")));
    assert!(carrier.excludes(Path::new("docs/primitive/layer1-interface.md")));
    assert!(!carrier.excludes(Path::new("docs/primitive/layers.md")));
    assert!(carrier.is_generated(Path::new("Cargo.lock")));
    assert!(!carrier.is_generated(Path::new("Cargo.toml")));
}

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

#[test]
fn the_typed_data_section_round_trips() {
    let typed = ruled().typed_data;
    assert!(typed.classes.is_empty());
    assert!(typed.empty_in_v1);
    assert!(typed.status.is_some());
    assert!(typed.revisit_when.is_some());
}

#[test]
fn the_citation_index_section_round_trips() {
    let indexes = ruled().citation_indexes;
    assert!(indexes.designations.is_empty());
    assert!(indexes.empty_in_v1);
    assert!(indexes.reason.is_some());
}

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
    assert_eq!(scanned.none.len(), 1);
    assert_eq!(scanned.none[0].languages.len(), 9);
}

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

#[test]
fn the_head_recognition_section_round_trips() {
    let heads = ruled().head_recognition;
    assert_eq!(&*heads.separator, "·");
    assert_eq!(heads.matching, HeadMatching::CaseExact);
    assert_eq!(heads.forms.len(), 2);
    assert_eq!(&*heads.forms[0].id, "environment-head");
    assert_eq!(heads.forms[0].language, Language::new("markdown"));
    assert_eq!(&*heads.forms[1].id, "heading");
    assert_eq!(heads.none.len(), 1);
    assert_eq!(heads.none[0].languages.len(), 3);
}

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

#[test]
fn the_kinds_section_round_trips() {
    let kinds = ruled().kinds;
    assert!(kinds.extensions.rows.is_empty());
    assert!(kinds.extensions.hybrids.is_empty());
    assert!(kinds.extensions.empty_in_v1);
    assert!(kinds.evidence.owned.is_empty());
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
        ]
    );
}

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
        enforcement.enforcement_for(Path::new("android/app/src/main/AndroidManifest.xml")),
        Enforcement::Advisory
    );
}

#[test]
fn a_minimal_adoption_loads() {
    let source = document(ONE_PREFIX, TOTAL_PARTITION, NO_PROFILES, EMPTY_K);
    assert!(load(&source).is_ok(), "the fixtures' own base must load");
}

#[test]
fn an_unreadable_file_is_an_error_and_not_a_finding() {
    let error = Adoption::load(Path::new("no-such-corpus-adoption.toml"))
        .expect_err("a file that is not there");
    assert!(matches!(error, AdoptionError::Unreadable { .. }));
    assert!(error.at().is_none());
}

#[test]
fn malformed_toml_is_a_syntax_error() {
    let error = load("[meta\n").expect_err("an unclosed table header");
    assert!(matches!(error, AdoptionError::Syntax(_)));
}

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

#[test]
fn a_profile_missing_one_of_its_five_data_is_located() {
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
