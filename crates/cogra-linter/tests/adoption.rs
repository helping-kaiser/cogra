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
    assert!(carrier.vendored_trees.is_empty());
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
    assert_eq!(profiles.effective_count, 0);
    assert_eq!(profiles.effective().count(), 0);

    let test = &profiles.profiles[0];
    assert_eq!(test.id, ProfileId::new("rust-test"));
    assert_eq!(test.kind, Kind::new("test"));
    assert!(matches!(test.status, ProfileStatus::Staged { .. }));
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
    let profiles = ruled().profiles;
    let ProfileStatus::Staged { enters_when } = &profiles.profiles[0].status else {
        panic!("the test profile is staged");
    };
    assert!(enters_when.contains("label-register.md"));
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
    assert_eq!(&*kinds.register.state, "staged — never generated");
}

#[test]
fn the_enforcement_section_round_trips() {
    let enforcement = ruled().enforcement;
    assert_eq!(enforcement.default, Enforcement::Advisory);
    assert_eq!(
        enforcement.failing,
        vec![
            PathPrefix::new("crates/cogra-linter/docs/"),
            PathPrefix::new("crates/cogra-interchange/docs/"),
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
        Enforcement::Advisory
    );
    assert_eq!(
        enforcement.enforcement_for(Path::new("crates/api/src/lib.rs")),
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
