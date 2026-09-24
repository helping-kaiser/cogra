//! Shared test-support helpers for cogra-linter's integration tests.
//!
//! Every fixture builds a throwaway repository under a temp or target
//! directory; the git process that builds it must be immune to whatever
//! `GIT_DIR`/`GIT_WORK_TREE` the invoking shell happens to carry — those
//! variables override `-C` entirely, so an inherited one silently redirects
//! `init`/`add`/`commit` onto the repository it names instead of the
//! fixture. Clearing them here is the one place that needs to happen.
//!
//! Each test binary that pulls in this module uses only one or the other
//! of `git`/`track`, never both directly, so each binary's own dead-code
//! pass sees the other as unreachable — `#[allow(dead_code)]` on both is
//! that, not slack.

use std::path::Path;
use std::process::Command;

/// Runs `git` against the fixture repository at `at`, scrubbed of any
/// git environment inherited from the caller.
#[allow(dead_code)]
pub fn git(at: &Path, args: &[&str]) {
    let done = Command::new("git")
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_INDEX_FILE")
        .env_remove("GIT_COMMON_DIR")
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

/// Makes `root` a repository and tracks everything now standing in it: the
/// carrier is what git lists (´dec:lint:tracked-carrier´).
#[allow(dead_code)]
pub fn track(root: &Path) {
    for args in [&["init", "-q"][..], &["add", "-A"][..]] {
        git(root, args);
    }
}
