//! The carrier walk over a built tree, under the corpus's own adoption.
//!
//! The adoption is the real `corpus-adoption.toml` rather than a fixture:
//! what the walk has to get right is this corpus's own first-match order —
//! the five document rules preceding the package rule that would otherwise
//! take them, the tree rules preceding the docs residual, and the empty
//! prefix that makes Ω total — and a fixture partition would test the test.

use std::fs;
use std::path::{Path, PathBuf};

use cogra_linter::{Adoption, Language, OwnerId, SourceFile, Walk};

fn ruled() -> Adoption {
    Adoption::load(Path::new(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../corpus-adoption.toml"
    )))
    .expect("the corpus's own adoption data is ruled")
}

/// A tree of empty-ish files at `paths`, under a root of its own.
fn tree(name: &str, paths: &[&str]) -> PathBuf {
    let root = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join(name);
    let _ = fs::remove_dir_all(&root);
    for path in paths {
        let file = root.join(path);
        if let Some(parent) = file.parent() {
            fs::create_dir_all(parent).expect("a directory for the fixture");
        }
        fs::write(&file, format!("the bytes of {path}\n")).expect("a fixture file");
    }
    root
}

const CORPUS: [&str; 10] = [
    "README.md",
    "Cargo.lock",
    "crates/api/src/lib.rs",
    "crates/cogra-linter/docs/design.md",
    "crates/cogra-linter/docs/label-calculus.md",
    "crates/cogra-linter/src/adopt.rs",
    "docs/README.md",
    "docs/primitive/layer1-interface.md",
    "docs/primitive/layers.md",
    "target/debug/junk.txt",
];

fn found(sources: &[SourceFile], path: &str) -> SourceFile {
    sources
        .iter()
        .find(|source| source.path == *Path::new(path))
        .unwrap_or_else(|| panic!("{path} is in the carrier"))
        .clone()
}

#[test]
fn the_walk_takes_the_carrier_and_leaves_the_exclusions() {
    let root = tree("carrier-exclusions", &CORPUS);
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");

    let paths: Vec<String> = sources
        .iter()
        .map(|source| source.path.to_string_lossy().into_owned())
        .collect();
    assert!(!paths.iter().any(|path| path.starts_with("target/")));
    assert!(
        !paths.contains(&String::from("docs/primitive/layer1-interface.md")),
        "the vendored derived reference stands outside the carrier"
    );
    assert!(paths.contains(&String::from("docs/primitive/layers.md")));
    assert_eq!(paths.len(), 8);
}

#[test]
fn the_walk_is_sorted_by_path_and_not_by_directory_order() {
    let root = tree("carrier-order", &CORPUS);
    let adoption = ruled();
    let walk = Walk::new(&adoption, &root);

    let once = walk.sources().expect("a readable tree");
    let twice = walk.sources().expect("a readable tree");
    let paths: Vec<String> = once
        .iter()
        .map(|source| source.path.to_string_lossy().into_owned())
        .collect();
    let again: Vec<String> = twice
        .iter()
        .map(|source| source.path.to_string_lossy().into_owned())
        .collect();

    assert_eq!(paths, again, "two walks of one tree agree");
    let mut sorted = paths.clone();
    sorted.sort();
    assert_eq!(paths, sorted, "the order is the paths' own");
    assert_eq!(
        paths[0], "Cargo.lock",
        "a file at the root sorts before the trees below it"
    );
}

#[test]
fn every_source_takes_its_owner_by_first_match() {
    let root = tree("carrier-owners", &CORPUS);
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");

    assert_eq!(
        found(&sources, "crates/cogra-linter/docs/label-calculus.md").owner,
        OwnerId::new("doc.label-calculus"),
        "rule 1 precedes the package rule that would otherwise take it"
    );
    assert_eq!(
        found(&sources, "crates/cogra-linter/docs/design.md").owner,
        OwnerId::new("pkg.cogra-linter")
    );
    assert_eq!(
        found(&sources, "crates/cogra-linter/src/adopt.rs").owner,
        OwnerId::new("pkg.cogra-linter")
    );
    assert_eq!(
        found(&sources, "crates/api/src/lib.rs").owner,
        OwnerId::new("pkg.api")
    );
    assert_eq!(
        found(&sources, "docs/primitive/layers.md").owner,
        OwnerId::new("tree.docs-primitive")
    );
    assert_eq!(
        found(&sources, "docs/README.md").owner,
        OwnerId::new("tree.docs-root")
    );
    assert_eq!(
        found(&sources, "README.md").owner,
        OwnerId::new("tree.repo-root")
    );
}

#[test]
fn ownership_is_total_and_needs_no_diagnostic() {
    let root = tree(
        "carrier-totality",
        &["a/tree/nobody/foresaw.txt", "Makefile"],
    );
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");
    assert_eq!(sources.len(), 2);
    for source in &sources {
        assert_eq!(source.owner, OwnerId::new("tree.repo-root"));
    }
}

#[test]
fn a_source_carries_its_language_only_where_a_frontend_reads_it() {
    let root = tree(
        "carrier-languages",
        &[
            "docs/README.md",
            "crates/api/src/lib.rs",
            "migrations/1.sql",
        ],
    );
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");

    assert_eq!(
        found(&sources, "docs/README.md").language,
        Some(Language::new("markdown"))
    );
    assert_eq!(
        found(&sources, "crates/api/src/lib.rs").language,
        Some(Language::new("rust"))
    );
    assert_eq!(
        found(&sources, "migrations/1.sql").language,
        None,
        "a file no frontend reads stays in the carrier and stays owned"
    );
}

#[test]
fn a_committed_generated_file_is_marked_and_kept() {
    let root = tree("carrier-generated", &CORPUS);
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");
    assert!(found(&sources, "Cargo.lock").generated);
    assert!(!found(&sources, "README.md").generated);
}

#[test]
fn a_source_carries_its_bytes() {
    let root = tree("carrier-bytes", &["README.md"]);
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");
    assert_eq!(sources[0].bytes, b"the bytes of README.md\n");
}

#[test]
fn an_absent_optional_root_is_silent() {
    let root = tree("carrier-absent-optional", &["README.md"]);
    let adoption = ruled();
    assert!(!root.join("tmp_dev").exists());
    assert!(
        Walk::new(&adoption, &root).sources().is_ok(),
        "a configured root that is absent contributes neither a source nor a diagnostic"
    );
}

#[test]
fn a_present_optional_root_is_walked_like_any_other() {
    let root = tree(
        "carrier-present-optional",
        &["README.md", "tmp_dev/notes.md"],
    );
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");
    assert_eq!(
        found(&sources, "tmp_dev/notes.md").owner,
        OwnerId::new("tree.working-notes"),
        "the working notes are checked when they are there"
    );
}

#[cfg(unix)]
#[test]
fn an_unreadable_entry_is_a_diagnostic_beside_a_shorter_list() {
    let root = tree("carrier-unreadable", &["README.md", "docs/README.md"]);
    std::os::unix::fs::symlink(root.join("nowhere.md"), root.join("dangling.md"))
        .expect("a link to nothing");
    let adoption = ruled();

    let outcome = Walk::new(&adoption, &root)
        .sources()
        .expect_err("one entry the walk cannot read");
    assert_eq!(
        outcome.sources.len(),
        2,
        "the sources it did reach, never an empty carrier"
    );
    assert_eq!(outcome.failures.len(), 1);
    let failure = &outcome.failures[0];
    assert_eq!(failure.rule, cogra_linter::carrier::UNREADABLE_SOURCE);
    assert_eq!(failure.severity, cogra_linter::Severity::Error);
    assert_eq!(failure.primary.path, PathBuf::from("dangling.md"));
    assert_eq!(
        failure.enforcement,
        cogra_linter::Enforcement::Advisory,
        "enforcement is the finding's path against the failing set, never its severity"
    );
}
