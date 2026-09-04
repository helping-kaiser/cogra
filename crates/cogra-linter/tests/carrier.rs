//! The carrier walk over a built tree, under the corpus's own adoption.
//!
//! The adoption is the real `corpus-adoption.toml` rather than a fixture:
//! what the walk has to get right is this corpus's own first-match order —
//! the five document rules preceding the package rule that would otherwise
//! take them, the tree rules preceding the docs residual, and the empty
//! prefix that makes Ω total — and a fixture partition would test the test.

use std::fs;
use std::path::{Path, PathBuf};

use cogra_linter::{Adoption, Language, OwnerId, SourceFile, Walk, carrier};

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

/// The walk takes the carrier and leaves every configured exclusion behind.
/// ´claim:walk:the-walk-takes-the-carrier´
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

/// The walked sources are ordered by path and never by the directory's own order.
/// ´claim:walk:sources-are-ordered-by-path´
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

/// A source takes its owner from the first partition rule that matches it.
/// ´claim:walk:the-owner-is-the-first-match´
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

/// Ownership is total by the partition's last rule, so no source is unowned.
/// ´claim:walk:ownership-is-total´
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

/// A source carries a language only where a frontend reads that language.
/// ´claim:walk:a-language-means-a-frontend´
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

/// A committed generated file stays in the carrier and is marked as generated.
/// ´claim:walk:a-generated-file-is-kept-and-marked´
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

/// A walked source carries the bytes the run read, not a promise to read them later.
/// ´claim:walk:a-source-carries-its-bytes´
#[test]
fn a_source_carries_its_bytes() {
    let root = tree("carrier-bytes", &["README.md"]);
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");
    assert_eq!(sources[0].bytes, b"the bytes of README.md\n");
}

/// It stays in the carrier and stays owned, which is the part totality
/// needs; what it does not do is cost what its size costs, and the carrier's
/// only uncurated directories are the working notes a hand-test session
/// leaves recordings and dumps in.
///
/// A source no frontend reads and no generator writes carries no bytes.
/// ´claim:walk:an-unscanned-source-is-not-read´
#[test]
fn a_source_nothing_will_read_is_not_read() {
    let root = tree("carrier-unscanned", &["migrations/1.sql", "docs/README.md"]);
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");

    let unscanned = found(&sources, "migrations/1.sql");
    assert_eq!(unscanned.language, None);
    assert!(unscanned.bytes.is_empty());
    assert_eq!(unscanned.owner, OwnerId::new("tree.repo-root"));
    assert!(
        !found(&sources, "docs/README.md").bytes.is_empty(),
        "a source a frontend does read still carries what it read"
    );
}

/// An absent optional root is silent.
/// ´claim:walk:an-absent-optional-root-is-silent´
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

/// A present optional root is walked like any other.
/// ´claim:walk:a-present-optional-root-is-walked´
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

/// The ruled adoption with one more root configured: absent from every tree
/// and not marked optional — the shape the audit reproduced F8 with.
///
/// The row is inserted before the working-note rules rather than appended,
/// because the last rule's empty prefix is what makes Ω total and the loader
/// checks that it comes last. Inserting shifts every later rule's position,
/// and the loader checks `order` against position too, so the fixture
/// renumbers rather than hand-maintaining twenty integers.
fn with_an_absent_required_root() -> Adoption {
    let at = Path::new(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../corpus-adoption.toml"
    ));
    let text = fs::read_to_string(at).expect("the adoption data is readable");
    let marker = "# --- 18..19: working notes";
    let added = text.replacen(
        marker,
        concat!(
            "[[partition.rule]]\norder = 0\npath  = \"absent-required/\"\n",
            "owner = \"tree.docs-root\"\noptional = false\n\n",
            "# --- 18..19: working notes",
        ),
        1,
    );
    assert_ne!(added, text, "the marker still names the working-note block");
    Adoption::from_str(&renumbered(&added), Path::new("corpus-adoption.toml"))
        .expect("one more rule leaves the partition loadable")
}

/// Every partition rule's `order` set to its 1-based position.
///
/// The loader checks the two agree, so a fixture that inserts a rule has to
/// renumber the rules below it. Only `order` keys inside a
/// `[[partition.rule]]` block are touched, which is what keeps the prose of
/// the other sections — `ordering`, and the notes that use the word — out of
/// it.
fn renumbered(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 64);
    let mut position = 0;
    let mut in_rule = false;
    for line in text.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("[[partition.rule]]") {
            in_rule = true;
            position += 1;
        } else if trimmed.starts_with('[') {
            in_rule = false;
        }
        let key = line.split('=').next().map(str::trim);
        if in_rule && key == Some("order") {
            out.push_str(&format!("order = {position}\n"));
            continue;
        }
        out.push_str(line);
        out.push('\n');
    }
    out
}

/// Whether some finding is about exactly this configured root, the message
/// naming it between "the root" and the comma after it.
fn about(found: &[cogra_linter::Diagnostic], root: &str) -> bool {
    let named = format!("the root {root},");
    found.iter().any(|one| one.message.contains(&named))
}

/// A source list as the walk would hand it over.
fn walked(paths: &[&str]) -> Vec<SourceFile> {
    paths
        .iter()
        .map(|path| SourceFile {
            path: PathBuf::from(*path),
            owner: OwnerId::new("tree.repo-root"),
            language: None,
            generated: false,
            bytes: Vec::new(),
        })
        .collect()
}

/// A configured root the walk found nothing under is reported: `optional` is
/// the adoption data's own way of saying an absence is legal, and a row
/// without it promises a tree the corpus has.
///
/// A configured root the walk found nothing under is reported unless it is optional.
/// ´claim:walk:an-unmatched-root-is-reported´
#[test]
fn f8_a_non_optional_root_matching_no_source_is_reported() {
    let adoption = with_an_absent_required_root();
    let found = carrier::unmatched_roots(&adoption, &walked(&CORPUS));
    assert!(
        about(&found, "absent-required/"),
        "the absent required root went unreported: {:?}",
        found.iter().map(|one| &one.message).collect::<Vec<_>>()
    );
    assert!(found.iter().all(|one| one.rule == carrier::UNMATCHED_ROOT));
    assert!(
        found
            .iter()
            .all(|one| one.enforcement == cogra_linter::Enforcement::Advisory)
    );
}

/// An optional root matching no source stays silent: both of this corpus's
/// working-note roots are gitignored junctions that are simply absent on
/// some machines.
///
/// An optional root matching no source stays silent.
/// ´claim:walk:an-optional-unmatched-root-is-silent´
#[test]
fn f8_an_optional_root_matching_no_source_stays_silent() {
    let adoption = with_an_absent_required_root();
    let found = carrier::unmatched_roots(&adoption, &walked(&CORPUS));
    for silent in ["tmp_dev/", "tmp_research_files/"] {
        assert!(
            !about(&found, silent),
            "{silent} is optional and stays silent"
        );
    }
}

/// A root the walk did reach is silent, and an empty carrier leaves every
/// configured root unmatched.
///
/// A root the walk reached is silent.
/// ´claim:walk:a-reached-root-is-silent´
#[test]
fn f8_a_root_the_walk_reached_is_silent() {
    let adoption = with_an_absent_required_root();
    let found = carrier::unmatched_roots(&adoption, &walked(&CORPUS));
    for reached in [
        "docs/primitive/",
        "crates/api/",
        "crates/cogra-linter/",
        "crates/cogra-linter/docs/label-calculus.md",
        "",
    ] {
        assert!(
            !about(&found, reached),
            "{reached:?} carries a source and stays silent"
        );
    }
    assert!(
        carrier::unmatched_roots(&adoption, &[]).len() > found.len(),
        "an empty carrier leaves more roots unmatched, never fewer"
    );
}

/// A directory link at `link` pointing at `target`, or `None` where the
/// platform refused to make one.
///
/// Windows needs `SeCreateSymbolicLinkPrivilege` — Developer Mode or an
/// elevated shell — to create a link at all, so a machine without it skips
/// these cases instead of failing them. `#[cfg(unix)]` was the alternative
/// and it is what left the crossing branch untested on the one platform
/// whose junctions raised the question: a junction is a reparse point with
/// a name-surrogate tag, so it takes the same `is_symlink` branch as a
/// POSIX link and needs the same assertions.
#[cfg(any(unix, windows))]
fn link_dir(target: &Path, link: &Path) -> Option<()> {
    #[cfg(unix)]
    let made = std::os::unix::fs::symlink(target, link);
    #[cfg(windows)]
    let made = std::os::windows::fs::symlink_dir(target, link);
    made.ok()
}

/// A file link, under the same platform rule as [`link_dir`].
#[cfg(any(unix, windows))]
fn link_file(target: &Path, link: &Path) -> Option<()> {
    #[cfg(unix)]
    let made = std::os::unix::fs::symlink(target, link);
    #[cfg(windows)]
    let made = std::os::windows::fs::symlink_file(target, link);
    made.ok()
}

/// Says a case was skipped rather than passing silently.
#[cfg(any(unix, windows))]
fn unprivileged(case: &str) {
    eprintln!("{case}: skipped, this platform would not create a link");
}

/// A tree outside the corpus root, for a link to point at.
#[cfg(any(unix, windows))]
fn outside(name: &str) -> PathBuf {
    tree(name, &["notes.md", "deeper/more.md"])
}

/// The bytes come from the target and the name comes from the corpus, which
/// is what lets a rule, an exclusion and a finding all keep meaning what
/// they say while the tree they describe lives somewhere else.
///
/// A link at a configured optional root is crossed under its own name.
/// ´claim:walk:a-linked-optional-root-is-crossed´
#[cfg(any(unix, windows))]
#[test]
fn a_link_at_a_configured_optional_root_is_crossed_under_its_own_name() {
    let target = outside("carrier-link-target");
    let root = tree("carrier-link-crossed", &["README.md"]);
    let Some(()) = link_dir(&target, &root.join("tmp_dev")) else {
        return unprivileged("a_link_at_a_configured_optional_root_is_crossed");
    };
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");

    let notes = found(&sources, "tmp_dev/notes.md");
    assert_eq!(
        notes.owner,
        OwnerId::new("tree.working-notes"),
        "the owner is the one the link path's rule assigns, not the target's"
    );
    assert_eq!(
        notes.bytes, b"the bytes of notes.md\n",
        "the bytes come from the target the link resolves to"
    );
    found(&sources, "tmp_dev/deeper/more.md");
}

/// This is the case that made the corpus a property of the checkout: a
/// worktree where a lane wrote its own scratch directory, and a machine
/// where the same name is a junction into another repository, walked
/// identically because the walk never asked which it was.
///
/// A link that is not a configured optional root is not followed.
/// ´claim:walk:an-unconfigured-link-is-not-followed´
#[cfg(any(unix, windows))]
#[test]
fn a_directory_link_outside_the_configured_roots_is_not_followed() {
    let target = outside("carrier-link-stray-target");
    let root = tree("carrier-link-stray", &["README.md"]);
    let Some(()) = link_dir(&target, &root.join("elsewhere")) else {
        return unprivileged("a_directory_link_outside_the_configured_roots_is_not_followed");
    };
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("an unfollowed link is a decision, not a failure");

    let paths: Vec<String> = sources
        .iter()
        .map(|source| source.path.to_string_lossy().into_owned())
        .collect();
    assert_eq!(
        paths,
        vec![String::from("README.md")],
        "the corpus is what the repository holds, not what its names resolve to"
    );
}

/// A file link outside the configured roots is not read.
/// ´claim:walk:an-unconfigured-file-link-is-not-read´
#[cfg(any(unix, windows))]
#[test]
fn a_file_link_outside_the_configured_roots_is_not_read() {
    let target = outside("carrier-link-file-target");
    let root = tree("carrier-link-file", &["README.md"]);
    let Some(()) = link_file(&target.join("notes.md"), &root.join("borrowed.md")) else {
        return unprivileged("a_file_link_outside_the_configured_roots_is_not_read");
    };
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("an unfollowed link is a decision, not a failure");
    assert!(
        !sources
            .iter()
            .any(|source| source.path == *Path::new("borrowed.md")),
        "one file is as much of an escape as a whole tree"
    );
}

/// The narrow cycle that survives the link policy: crossing happens only at
/// the configured roots, so the only way to arrive twice is for two of them
/// to resolve to one place.
///
/// Two configured roots resolving to one tree are walked once.
/// ´claim:walk:a-link-cycle-is-entered-once´
#[cfg(any(unix, windows))]
#[test]
fn two_configured_roots_resolving_to_one_tree_are_walked_once() {
    let target = outside("carrier-link-cycle-target");
    let root = tree("carrier-link-cycle", &["README.md"]);
    let Some(()) = link_dir(&target, &root.join("tmp_dev")) else {
        return unprivileged("two_configured_roots_resolving_to_one_tree_are_walked_once");
    };
    link_dir(&target, &root.join("tmp_research_files")).expect("the second link, privilege held");
    let adoption = ruled();
    let sources = Walk::new(&adoption, &root)
        .sources()
        .expect("a readable tree");

    let paths: Vec<String> = sources
        .iter()
        .map(|source| source.path.to_string_lossy().into_owned())
        .collect();
    assert_eq!(
        paths,
        vec![
            String::from("README.md"),
            String::from("tmp_dev/deeper/more.md"),
            String::from("tmp_dev/notes.md"),
        ],
        "the entries are walked in path order, so the first name wins and the second is skipped"
    );
}

/// An unreadable entry is a diagnostic beside a shorter list, never an empty carrier.
/// ´claim:walk:an-unreadable-entry-is-a-diagnostic´
#[cfg(any(unix, windows))]
#[test]
fn an_unreadable_entry_is_a_diagnostic_beside_a_shorter_list() {
    let root = tree("carrier-unreadable", &["README.md", "docs/README.md"]);
    let Some(()) = link_file(&root.join("nowhere.md"), &root.join("dangling.md")) else {
        return unprivileged("an_unreadable_entry_is_a_diagnostic_beside_a_shorter_list");
    };
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
