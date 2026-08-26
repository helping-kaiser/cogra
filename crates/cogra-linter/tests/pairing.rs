//! The declaration–definition pairing (´dec:lint:cross-source-pairing´).
//!
//! One implementation serves two runs, so the obligation under test is an
//! agreement: the census a check judges and the census the measurement
//! reports are the same census over the same corpus. The fixtures state a
//! corpus small enough to count by hand; the last two tests state it over
//! this repository, where the number is the one `[profiles]` records.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::graph::{EdgeW, NodeKind, NodeW, nodes_of, out_along};
use cogra_linter::{Adoption, Language, OwnerId, ProfileId, Run, SourceFile, check_sources};

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

/// The ruled adoption, which carries the module profile in Π.
fn ruled() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::from_str(adoption_text(), Path::new("corpus-adoption.toml"))
            .expect("the ruled adoption loads")
    })
}

const MODULE: &str = "rust-module";

/// The owner every fixture source belongs to.
const OWNER: &str = "pkg.l1-standin";

fn rust(path: &str, body: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from(path),
        owner: OwnerId::new(OWNER),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from(body),
    }
}

/// Every identifier the module profile covers in one run, sorted.
///
/// Read off the `Covers` edges rather than off the sources, because that is
/// the asset set the inventory judgment quantifies over
/// (´[LBL-inv:labels:inventory]´).
fn covered(run: &Run) -> Vec<String> {
    let profile = nodes_of(&run.graph, NodeKind::Profile)
        .find(|node| {
            matches!(
                run.graph.node_weight(*node),
                Some(NodeW::Profile(weight)) if weight.id == ProfileId::new(MODULE)
            )
        })
        .expect("the module profile is registered");
    let mut out: Vec<String> = out_along(&run.graph, profile, EdgeW::Covers)
        .filter_map(|node| match run.graph.node_weight(node) {
            Some(NodeW::Asset(weight)) => Some(weight.identifier.to_string()),
            _ => None,
        })
        .collect();
    out.sort();
    out
}

/// What a check with the module profile in Π covers over these sources.
fn census_of(sources: Vec<SourceFile>) -> Vec<String> {
    covered(&check_sources(ruled(), sources))
}

/// (´dec:lint:cross-source-pairing´): an inline definition is settled by the
/// source that holds it, and needs no pairing at all.
#[test]
fn an_inline_definition_is_the_source_s_own() {
    let held = vec![rust("crates/l1-standin/src/lib.rs", "mod inline { }\n")];
    assert_eq!(census_of(held), vec![String::from("inline")]);
}

/// (´dec:lint:cross-source-pairing´): a nested inline definition is a
/// definition too — the census counts modules, not top-level items.
#[test]
fn a_nested_inline_definition_is_an_asset_of_its_own() {
    let held = vec![rust(
        "crates/l1-standin/src/lib.rs",
        "mod outer { mod inner { } }\n",
    )];
    assert_eq!(
        census_of(held),
        vec![String::from("inner"), String::from("outer")]
    );
}

/// (´dec:lint:cross-source-pairing´): the file named after a declaration
/// backs it, and the asset sits at that file.
#[test]
fn a_file_backs_the_declaration_that_names_it() {
    let held = vec![
        rust("crates/l1-standin/src/lib.rs", "mod alpha;\n"),
        rust("crates/l1-standin/src/alpha.rs", "pub fn one() {}\n"),
    ];
    assert_eq!(census_of(held), vec![String::from("alpha")]);
}

/// (´dec:lint:cross-source-pairing´): a directory backs a declaration
/// through its `mod.rs`, which is Cargo's second layout.
#[test]
fn a_directory_backs_a_declaration_through_its_mod_file() {
    let held = vec![
        rust("crates/l1-standin/src/lib.rs", "mod beta;\n"),
        rust("crates/l1-standin/src/beta/mod.rs", "pub fn one() {}\n"),
    ];
    assert_eq!(census_of(held), vec![String::from("beta")]);
}

/// (´dec:lint:cross-source-pairing´): a `mod.rs` roots its own directory,
/// so a declaration inside one is backed from beside it.
#[test]
fn a_mod_file_backs_from_its_own_directory() {
    let held = vec![
        rust("crates/l1-standin/src/deep/mod.rs", "mod leaf;\n"),
        rust("crates/l1-standin/src/deep/leaf.rs", "pub fn one() {}\n"),
    ];
    assert_eq!(census_of(held), vec![String::from("leaf")]);
}

/// (´dec:lint:cross-source-pairing´): a module file backs from the directory
/// named after it, which is the other half of Cargo's rule.
#[test]
fn a_module_file_backs_from_the_directory_named_after_it() {
    let held = vec![
        rust("crates/l1-standin/src/lib.rs", "mod alpha;\n"),
        rust("crates/l1-standin/src/alpha.rs", "mod nested;\n"),
        rust("crates/l1-standin/src/alpha/nested.rs", "pub fn one() {}\n"),
    ];
    assert_eq!(
        census_of(held),
        vec![String::from("alpha"), String::from("nested")]
    );
}

/// (´dec:lint:cross-source-pairing´): many declarations of one module are
/// one asset — the census counts definitions, never declarations, which is
/// what keeps `[profiles]` injective where a tree is declared repeatedly.
#[test]
fn many_declarations_of_one_definition_are_one_asset() {
    let held = vec![
        rust("crates/l1-standin/src/lib.rs", "mod shared;\n"),
        rust(
            "crates/l1-standin/src/main.rs",
            "mod shared;\nfn main() {}\n",
        ),
        rust("crates/l1-standin/src/shared.rs", "pub fn one() {}\n"),
    ];
    assert_eq!(census_of(held), vec![String::from("shared")]);
}

/// (´dec:lint:cross-source-pairing´): every file directly under a package's
/// `tests` directory is a crate root, so the shared rig many suites declare
/// is backed from beside them and counts once — the corpus's own eleven
/// `mod rig;` in miniature.
#[test]
fn many_test_roots_declaring_one_tree_are_one_asset() {
    let held = vec![
        rust("crates/l1-standin/tests/one.rs", "mod rig;\n"),
        rust("crates/l1-standin/tests/two.rs", "mod rig;\n"),
        rust("crates/l1-standin/tests/three.rs", "mod rig;\n"),
        rust("crates/l1-standin/tests/rig/mod.rs", "pub fn one() {}\n"),
    ];
    assert_eq!(census_of(held), vec![String::from("rig")]);
}

/// (´dec:lint:cross-source-pairing´): the same rule reaches a support tree
/// backed by a file rather than a directory, which is the other half of
/// Cargo's layout under a test root.
#[test]
fn a_test_root_backs_a_support_file_beside_it() {
    let held = vec![
        rust("crates/l1-standin/tests/one.rs", "mod support;\n"),
        rust("crates/l1-standin/tests/support.rs", "pub fn one() {}\n"),
    ];
    assert_eq!(census_of(held), vec![String::from("support")]);
}

/// (´dec:lint:cross-source-pairing´): a `tests` directory inside a `src` tree
/// is a module of the lib target and roots nothing, so a declaration in one
/// is backed from the directory named after it like any module file.
#[test]
fn a_tests_module_inside_a_lib_target_is_not_a_root() {
    let held = vec![
        rust("crates/l1-standin/src/tests/helper.rs", "mod inner;\n"),
        rust(
            "crates/l1-standin/src/tests/helper/inner.rs",
            "pub fn one() {}\n",
        ),
    ];
    assert_eq!(census_of(held), vec![String::from("inner")]);
}

/// (´dec:lint:cross-source-pairing´): a file that is backed under a name it
/// also defines inline yields one asset, not two.
#[test]
fn a_file_defining_the_name_it_is_backed_under_yields_one_asset() {
    let held = vec![
        rust("crates/l1-standin/src/lib.rs", "mod alpha;\n"),
        rust("crates/l1-standin/src/alpha.rs", "mod alpha { }\n"),
    ];
    assert_eq!(census_of(held), vec![String::from("alpha")]);
}

/// (´dec:lint:cross-source-pairing´): `[profiles]` excludes modules
/// attributed `#[cfg(test)]`, and a declaration is a module — the exclusion
/// reaches the file-backed half exactly as it reaches the inline one.
#[test]
fn a_test_attributed_declaration_is_excluded_with_its_definition() {
    let held = vec![
        rust(
            "crates/l1-standin/src/lib.rs",
            "#[cfg(test)]\nmod helper;\n#[cfg(test)]\nmod tests { }\n",
        ),
        rust("crates/l1-standin/src/helper.rs", "pub fn one() {}\n"),
    ];
    assert!(census_of(held).is_empty());
}

/// (´dec:lint:cross-source-pairing´): a declaration whose backing file is
/// not in the carrier pairs with nothing, rather than producing an asset
/// pointing at a file no run saw.
#[test]
fn a_declaration_with_no_backing_source_pairs_with_nothing() {
    let held = vec![rust("crates/l1-standin/src/lib.rs", "mod absent;\n")];
    assert!(census_of(held).is_empty());
}

/// Every identifier the measurement's census covers, sorted like
/// [`covered`], so that the two are comparable as multisets and not merely
/// as sets: an identifier may repeat across owners, and a census that lost
/// the repetition would compare equal while covering less.
fn measured(a: &Adoption, at: &Path) -> Vec<String> {
    let mut out: Vec<String> = cogra_linter::migrate::census(a, at, &ProfileId::new(MODULE))
        .expect("the measurement runs over this root")
        .into_values()
        .flatten()
        .map(|asset| asset.identifier)
        .collect();
    out.sort();
    out
}

/// (´dec:lint:cross-source-pairing´): the pairing is one implementation, so
/// the census a check judges is the census the measurement reports — here
/// over a fixture corpus in a root of its own, walked once and handed to
/// both runs.
#[test]
fn the_check_and_the_measurement_agree_over_a_fixture() {
    let at = std::env::temp_dir().join("cogra-lint-pairing-fixture");
    let _ = std::fs::remove_dir_all(&at);
    let src = at.join("crates").join("l1-standin").join("src");
    std::fs::create_dir_all(src.join("beta")).expect("a temporary corpus root");
    std::fs::write(at.join("corpus-adoption.toml"), adoption_text()).expect("the adoption data");
    std::fs::write(
        src.join("lib.rs"),
        "mod alpha;\nmod beta;\nmod inline { }\n",
    )
    .expect("the declaring root");
    std::fs::write(src.join("alpha.rs"), "pub fn one() {}\n").expect("a file-backed module");
    std::fs::write(src.join("beta").join("mod.rs"), "pub fn two() {}\n")
        .expect("a directory-backed module");

    let walked = cogra_linter::Walk::new(ruled(), &at)
        .sources()
        .expect("the fixture root walks cleanly");
    let judged = covered(&check_sources(ruled(), walked));

    assert_eq!(
        judged,
        vec![
            String::from("alpha"),
            String::from("beta"),
            String::from("inline")
        ]
    );
    assert_eq!(measured(ruled(), &at), judged, "one pairing, one census");
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:cross-source-pairing´): the agreement holds over this
/// repository, at the size `[profiles]` records as the module migration's.
#[test]
fn the_check_and_the_measurement_agree_over_this_corpus() {
    let reported = measured(ruled(), &root());
    assert_eq!(reported.len(), 91, "the size `[profiles]` records");

    let run = cogra_linter::check(ruled(), &root()).expect("the check runs over the corpus");
    assert_eq!(covered(&run), reported, "one pairing, one census");
}
