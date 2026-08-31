//! The migration writer (´dec:lint:fix-subcommand´).
//!
//! The sweep edits sources, so nothing here runs over this repository: every
//! test builds a corpus root of its own under the temporary directory, writes
//! into that, and removes it. The corpus's own module migration landed long
//! ago, which is exactly why it cannot hold this mechanism under test — a
//! corpus with nothing left to place proves only that a sweep does nothing.
//!
//! Four shapes are held here because four are what the corpus carries: a
//! file-backed definition whose file already opens with an inner documentation
//! comment, one whose file opens with code, an inline definition whose body
//! already opens with such a comment, and one whose body opens with code. The
//! bytes each produces are pinned, because "the form the migration produced by
//! hand" is a claim about bytes and nothing weaker holds it.
//!
//! The dirty-tree tests run `git` over a repository they create. A machine
//! with no `git` cannot run them, which is the same machine that cannot check
//! this repository out.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use cogra_linter::{Adoption, ProfileId, Sweep, fix};

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

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::from_str(adoption_text(), Path::new("corpus-adoption.toml"))
            .expect("the ruled adoption loads")
    })
}

/// The ruled adoption with the module profile put back where it entered from.
///
/// The sweep is how such a migration lands, so the staged reading is the
/// normal one and is held beside the effective one
/// (´dec:lint:staged-profiles´). The module profile is the last one
/// `[profiles]` registers, so the last effective status in the file is its own.
fn module_staged() -> Adoption {
    let text = adoption_text().replace("effective = 2", "effective = 1");
    let mark = "status = \"effective\"";
    let at = text.rfind(mark).expect("the module profile is effective");
    let text = format!(
        "{}status = \"staged\"{}",
        &text[..at],
        &text[at + mark.len()..]
    );
    Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
        .expect("the condition the module profile entered on is recorded beside it")
}

fn module() -> ProfileId {
    ProfileId::new("rust-module")
}

/// The four shapes, in one owner's tree.
///
/// `alpha` is backed by a file that opens with an inner documentation comment,
/// `beta` by one that opens with code, `inline` is written inside a body that
/// opens with code, and `documented` inside one that opens with a comment.
const SOURCES: [(&str, &str); 3] = [
    (
        "src/lib.rs",
        "mod alpha;\nmod beta;\n\nmod inline {\n    pub fn three() {}\n}\n\nmod documented {\n    //! Written by hand.\n\n    pub fn four() {}\n}\n",
    ),
    ("src/alpha.rs", "//! The first module.\n\npub fn one() {}\n"),
    ("src/beta.rs", "pub fn two() {}\n"),
];

/// A corpus root of its own, carrying the four shapes and no label at all.
fn temporary(name: &str) -> PathBuf {
    let at = std::env::temp_dir().join(format!("cogra-lint-{name}"));
    let _ = std::fs::remove_dir_all(&at);
    let src = at.join("crates").join("l1-standin").join("src");
    std::fs::create_dir_all(&src).expect("a temporary corpus root");
    std::fs::write(at.join("corpus-adoption.toml"), adoption_text()).expect("the adoption data");
    for (path, body) in SOURCES {
        let leaf = path.rsplit('/').next().unwrap_or(path);
        std::fs::write(src.join(leaf), body).expect("a fixture source");
    }
    at
}

fn held(at: &Path, leaf: &str) -> String {
    std::fs::read_to_string(at.join("crates/l1-standin/src").join(leaf))
        .expect("the fixture source is readable")
}

fn swept(a: &Adoption, at: &Path) -> Sweep {
    fix::sweep(a, at, &module()).expect("the temporary root is a directory")
}

/// (´dec:lint:fix-subcommand´): the sweep finds one label to place per covered
/// asset that does not carry one, and locates each at its own definition.
#[test]
fn a_sweep_finds_one_label_for_every_unplaced_asset() {
    let at = temporary("sweep-finds");
    let sweep = swept(adoption(), &at);

    let mut placed: Vec<&str> = sweep.writes.iter().map(|one| one.label.as_str()).collect();
    placed.sort_unstable();
    assert_eq!(
        placed,
        [
            "mod:module:alpha",
            "mod:module:beta",
            "mod:module:documented",
            "mod:module:inline"
        ]
    );
    assert!(!sweep.settled());
    assert_eq!(sweep.touches().len(), 3, "three sources hold the four");
    for one in &sweep.writes {
        assert!(one.at.line >= 1, "every insertion is located: {one:?}");
    }
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:fix-subcommand´): what a write puts in each source is the form
/// the corpus carries, byte for byte, in all four shapes.
#[test]
fn a_write_produces_the_form_the_corpus_carries() {
    let at = temporary("sweep-form");
    let sweep = swept(adoption(), &at);
    let written = fix::apply(&sweep, &at).expect("the sources are writable");
    assert_eq!(written.paths.len(), 3);

    assert_eq!(
        held(&at, "alpha.rs"),
        "//! ´mod:module:alpha´\n//!\n//! The first module.\n\npub fn one() {}\n",
        "a label line joins the comment that already opens the file"
    );
    assert_eq!(
        held(&at, "beta.rs"),
        "//! ´mod:module:beta´\n\npub fn two() {}\n",
        "and opens one of its own above code, separated by a blank line"
    );
    assert_eq!(
        held(&at, "lib.rs"),
        concat!(
            "mod alpha;\nmod beta;\n\n",
            "mod inline {\n    //! ´mod:module:inline´\n\n    pub fn three() {}\n}\n\n",
            "mod documented {\n    //! ´mod:module:documented´\n    //!\n",
            "    //! Written by hand.\n\n    pub fn four() {}\n}\n",
        ),
        "an inline definition takes its body's indentation, and both shapes again"
    );
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:fix-subcommand´): a dry run and a write describe one thing. What
/// the sweep reported is exactly what the bytes on disk became, spliced at the
/// offsets it named.
#[test]
fn a_dry_run_and_a_write_agree_byte_for_byte() {
    let at = temporary("sweep-parity");
    let sweep = swept(adoption(), &at);

    let mut expected: Vec<(PathBuf, String)> = Vec::new();
    for path in sweep.touches() {
        let mut bytes = std::fs::read_to_string(at.join(&path)).expect("a fixture source");
        let mut owed: Vec<_> = sweep.writes.iter().filter(|one| one.path == path).collect();
        owed.sort_by_key(|one| std::cmp::Reverse(one.offset));
        for one in owed {
            bytes.insert_str(one.offset, &one.text);
        }
        expected.push((path, bytes));
    }

    fix::apply(&sweep, &at).expect("the sources are writable");
    for (path, wanted) in expected {
        assert_eq!(
            std::fs::read_to_string(at.join(&path)).expect("the written source"),
            wanted,
            "{} is what the dry run said it would be",
            path.display()
        );
    }
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:fix-subcommand´): the sweep settles. A second one over a corpus
/// the first wrote finds nothing, by the same recognizer that found the work.
#[test]
fn a_second_sweep_writes_nothing() {
    let at = temporary("sweep-settles");
    let first = swept(adoption(), &at);
    fix::apply(&first, &at).expect("the sources are writable");
    let before: Vec<String> = SOURCES
        .iter()
        .map(|(path, _)| held(&at, path.rsplit('/').next().unwrap_or(path)))
        .collect();

    let second = swept(adoption(), &at);
    assert!(second.settled(), "{:?}", second.writes);
    let written = fix::apply(&second, &at).expect("an empty sweep writes nothing");
    assert!(written.paths.is_empty());

    let after: Vec<String> = SOURCES
        .iter()
        .map(|(path, _)| held(&at, path.rsplit('/').next().unwrap_or(path)))
        .collect();
    assert_eq!(before, after, "the second write touched no byte");
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:staged-profiles´): the sweep is how a staged migration lands, so
/// a staged profile and one in force are swept alike — the census is the same
/// census and the standard place is the same place.
#[test]
fn a_staged_profile_is_swept_exactly_as_one_in_force() {
    let at = temporary("sweep-staged");
    let staged = swept(&module_staged(), &at);
    let effective = swept(adoption(), &at);
    assert_eq!(staged.writes, effective.writes);
    assert_eq!(staged.writes.len(), 4);
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:fix-subcommand´): a profile whose standard place is a generated
/// register has nothing at any asset to sweep, so the sweep is empty and the
/// command line refuses the profile by name rather than reporting it.
#[test]
fn a_register_placed_profile_sweeps_nothing() {
    let at = temporary("sweep-register");
    let sweep = fix::sweep(adoption(), &at, &ProfileId::new("rust-test"))
        .expect("the temporary root is a directory");
    assert!(sweep.settled(), "{:?}", sweep.writes);
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:fix-subcommand´): a name `[profiles]` does not register sweeps
/// nothing, which is a fact about the name — the command line refuses it, and
/// the library does not invent a census for it.
#[test]
fn an_unregistered_profile_sweeps_nothing() {
    let at = temporary("sweep-unregistered");
    let sweep = fix::sweep(adoption(), &at, &ProfileId::new("not-a-real-profile"))
        .expect("the temporary root is a directory");
    assert!(sweep.settled());
    let _ = std::fs::remove_dir_all(&at);
}

/// (´[ARCH-req:linter:determinism]´): two sweeps of one corpus are one sweep.
#[test]
fn two_sweeps_of_one_corpus_agree() {
    let at = temporary("sweep-determinism");
    assert_eq!(swept(adoption(), &at), swept(adoption(), &at));
    let _ = std::fs::remove_dir_all(&at);
}

fn git(at: &Path, args: &[&str]) {
    let done = Command::new("git")
        .arg("-C")
        .arg(at)
        .args(args)
        .output()
        .expect("git runs");
    assert!(
        done.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&done.stderr)
    );
}

/// (´dec:lint:fix-precondition´): a source the sweep would rewrite is dirty
/// while it is untracked, dirty again once it is modified after a commit, and
/// clean in between — which is the whole of what the precondition asks.
#[test]
fn the_precondition_reads_the_working_tree_of_what_it_would_rewrite() {
    let at = temporary("sweep-precondition");
    let sweep = swept(adoption(), &at);
    let touched = sweep.touches();
    assert_eq!(touched.len(), 3);

    git(&at, &["init", "-q"]);
    let untracked = fix::modified(&at, &touched).expect("git answers over a repository");
    assert_eq!(
        untracked, touched,
        "bytes git is not tracking cannot be recovered, so they are not clean"
    );

    git(&at, &["add", "-A"]);
    git(
        &at,
        &[
            "-c",
            "user.name=fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-q",
            "-m",
            "the fixture corpus",
        ],
    );
    assert!(
        fix::modified(&at, &touched)
            .expect("git answers")
            .is_empty(),
        "a committed tree carries no uncommitted work"
    );

    std::fs::write(
        at.join("crates/l1-standin/src/beta.rs"),
        "pub fn two() {}\npub fn edited() {}\n",
    )
    .expect("the fixture source is writable");
    assert_eq!(
        fix::modified(&at, &touched).expect("git answers"),
        vec![PathBuf::from("crates/l1-standin/src/beta.rs")],
        "and only the source that changed is reported"
    );
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:fix-precondition´): a root that is no repository is a
/// precondition the sweep cannot establish, which is an error and not an
/// answer of "clean".
#[test]
fn a_root_that_is_no_repository_cannot_answer_the_precondition() {
    let at = temporary("sweep-no-repository");
    let touched = swept(adoption(), &at).touches();
    let refused = fix::modified(&at, &touched).expect_err("no repository, so no answer");
    assert!(format!("{refused}").contains("git status"), "{refused}",);
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:fix-precondition´): asking about no source at all runs no
/// command, because there is nothing whose state could refuse a sweep that
/// writes nothing.
#[test]
fn a_settled_sweep_asks_git_nothing() {
    let at = temporary("sweep-nothing-to-ask");
    assert!(
        fix::modified(&at, &[])
            .expect("no question, no failure")
            .is_empty(),
        "a root that is no repository still answers the empty question"
    );
    let _ = std::fs::remove_dir_all(&at);
}
