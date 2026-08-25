//! The rendered form and the exit codes: the binary's own contract
//! (´dec:lint:diagnostic-format´), (´sig:lint:cli-api´).
//!
//! The form is machine-parseable and stable — it is what a problem matcher
//! consumes with no translator in front of it — and the exit codes are the
//! machine-readable half of the same contract: `0` a clean corpus, `1`
//! findings on the failing set, `2` the linter's own failure. That findings
//! and crashes are different codes is what lets a lane tell "the corpus is
//! wrong" from "the linter is broken".
//!
//! The binary is exercised against a two-file fixture root rather than the
//! repository, because what is under test is the mapping from outcome to
//! code and not the corpus: three full-corpus runs would buy nothing and
//! cost the lane its budget (´tab:lint:budgets´).
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::process::Command;

/// The registry document, relative to the corpus root.
const REGISTRY: &str = "crates/cogra-linter/docs/environment-kinds.md";

/// The companion attestation register, relative to the corpus root.
const COMPANION: &str = "crates/cogra-linter/docs/attestation-register.md";

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// A fixture corpus of three files: the adoption data, the registry
/// document it names, and the companion register the corpus commits.
///
/// All three, because a corpus missing a register it commits is not a clean
/// corpus — freshness reports it staged — and what these tests are about is
/// the mapping from outcome to exit code, not that mapping's inputs.
fn fixture(name: &str) -> PathBuf {
    let at = std::env::temp_dir().join(format!("cogra-lint-{name}"));
    let _ = std::fs::remove_dir_all(&at);
    let docs = at.join("crates").join("cogra-linter").join("docs");
    std::fs::create_dir_all(&docs).expect("a fixture root");
    std::fs::copy(
        root().join("corpus-adoption.toml"),
        at.join("corpus-adoption.toml"),
    )
    .expect("the adoption data");
    for one in [REGISTRY, COMPANION] {
        std::fs::copy(root().join(one), at.join(one)).expect("a committed document");
    }
    at
}

/// The binary, run with `at` as the corpus root.
fn ran(at: &Path, args: &[&str]) -> (i32, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_cogra-lint"))
        .arg("--root")
        .arg(at)
        .args(args)
        .output()
        .expect("the binary runs");
    let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
    text.push_str(&String::from_utf8_lossy(&out.stderr));
    (out.status.code().unwrap_or(-1), text)
}

/// (´sig:lint:cli-api´): a corpus clean on the failing set exits `0`.
///
/// The fixture carries both committed registers as the corpus commits them,
/// so freshness has nothing to report and neither has any other judgment.
#[test]
fn a_clean_failing_set_exits_zero() {
    let at = fixture("exit-clean");
    let (code, text) = ran(&at, &["check"]);
    assert_eq!(code, 0, "{text}");
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:enforcement-partition´), (´sig:lint:cli-api´): findings on the
/// failing set exit `1`, and the finding is rendered in the ruled form.
#[test]
fn findings_on_the_failing_set_exit_one() {
    let at = fixture("exit-findings");
    let doc = at.join(REGISTRY);
    let held = std::fs::read_to_string(&doc).expect("the registry document");
    std::fs::write(
        &doc,
        held.replace(
            "| Device classes   | 10    |",
            "| Device classes   | 4     |",
        ),
    )
    .expect("a stale headline table");

    let (code, text) = ran(&at, &["check"]);
    assert_eq!(code, 1, "{text}");
    let line = text
        .lines()
        .find(|line| line.contains("register-stale"))
        .unwrap_or_else(|| panic!("the stale register is reported:\n{text}"));
    let fields: Vec<&str> = line.splitn(4, ':').collect();
    assert_eq!(fields[0], REGISTRY, "the path comes first");
    assert!(fields[1].parse::<u32>().is_ok(), "then the line: {line}");
    assert!(fields[2].parse::<u32>().is_ok(), "then the column: {line}");
    assert!(
        fields[3].starts_with(" error register-stale: "),
        "then the severity and the rule: {line}"
    );
    let _ = std::fs::remove_dir_all(&at);
}

/// (´sig:lint:cli-api´): the linter's own failure exits `2`, which is what
/// lets a lane tell it from a corpus that is wrong.
#[test]
fn the_linters_own_failure_exits_two() {
    let missing = std::env::temp_dir().join("cogra-lint-absent-root");
    let _ = std::fs::remove_dir_all(&missing);
    let (code, text) = ran(&missing, &["check"]);
    assert_eq!(code, 2, "{text}");
    assert!(text.contains("cogra-lint:"), "the failure is named: {text}");
}

/// (´[ARCH-rule:linter:register-freshness]´): a dry run reports and writes
/// nothing, and exits `0` because it found nothing of its own scope.
#[test]
fn a_dry_run_writes_nothing() {
    let at = fixture("dry-run");
    let doc = at.join(REGISTRY);
    let held = std::fs::read_to_string(&doc).expect("the registry document");
    std::fs::write(
        &doc,
        held.replace(
            "| Device classes   | 10    |",
            "| Device classes   | 4     |",
        ),
    )
    .expect("a stale headline table");
    let stale = std::fs::read(&doc).expect("the stale document");

    let (code, text) = ran(&at, &["regenerate", "--dry-run"]);
    assert_eq!(code, 0, "{text}");
    assert!(text.contains("nothing written"), "{text}");
    assert!(text.contains("stale, first differing at byte"), "{text}");
    assert_eq!(
        std::fs::read(&doc).expect("the document again"),
        stale,
        "a dry run leaves even a stale register alone"
    );
    let _ = std::fs::remove_dir_all(&at);
}

/// (´dec:lint:migrations-subcommand´): the measurement exits `0` on a corpus
/// it could read, because it reports no verdict.
#[test]
fn the_measurement_always_exits_zero() {
    let at = fixture("migrations");
    let (code, text) = ran(&at, &["migrations"]);
    assert_eq!(code, 0, "{text}");
    assert!(text.contains("profile rust-test"), "{text}");
    let _ = std::fs::remove_dir_all(&at);
}
