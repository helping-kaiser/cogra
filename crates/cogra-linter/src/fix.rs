//! ´mod:module:fix´
//!
//! The migration writer: one registered profile's derived labels, written at
//! the standard place the covered assets themselves are.
//!
//! A profile whose standard place is a generated register enters Π by
//! generating that register, and [`crate::registers`] does it
//! (´dec:lint:staged-profiles´). A profile whose standard place is the asset
//! itself has no such file: its migration is an edit to every covered source,
//! and until now that edit was made by hand. This module is that edit,
//! mechanized (´dec:lint:fix-subcommand´).
//!
//! # It measures nothing of its own
//!
//! What is missing, and where, is [`crate::migrate::unplaced`]'s answer, and
//! this module takes it whole. That is the point of the seam: the sweep fills
//! in exactly what the measurement reports still owed, so a corpus the
//! measurement calls arrived is one the sweep writes nothing into, and a
//! second sweep over a corpus the first one wrote is a no-op by the same
//! recognizer that judged the first (´dec:lint:fix-subcommand´).
//!
//! # Insertion, never replacement
//!
//! [`apply`] splices bytes in and removes none. The label line is written
//! before the first line of the asset's own documentation, so an authored
//! comment keeps every byte its author gave it and gains a line above it —
//! which is the one shape that cannot lose prose, and the shape the corpus's
//! own module migration produced by hand.
//!
//! # The one place this crate runs another program
//!
//! [`modified`] asks `git status --porcelain`, because whether a file carries
//! uncommitted work is a fact about the repository and not about the corpus,
//! and no walk of the tree can answer it. The porcelain format is git's own
//! documented script interface and is stable across versions, which is why it
//! is the one that is parsed (´dec:lint:fix-precondition´).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::adopt::{Adoption, ProfileId};
use crate::diag::Location;
use crate::error::{GenerateError, RunError};
use crate::migrate::{self, Unplaced};
use crate::registers::Written;
use crate::scan::Label;

/// What one sweep of a profile came to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sweep {
    /// The profile swept.
    pub profile: ProfileId,
    /// One insertion per covered asset that does not carry its label at its
    /// own standard place, by source path and then by position in it.
    pub writes: Vec<Insertion>,
}

impl Sweep {
    /// Whether the profile's standard place already carries every label, in
    /// which case a write and a dry run are the same thing.
    #[must_use]
    pub fn settled(&self) -> bool {
        self.writes.is_empty()
    }

    /// The sources a write would touch, in path order, each once.
    #[must_use]
    pub fn touches(&self) -> Vec<PathBuf> {
        let mut out: Vec<PathBuf> = self.writes.iter().map(|one| one.path.clone()).collect();
        out.sort();
        out.dedup();
        out
    }
}

/// One label line, and the byte of one source it is written before.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Insertion {
    /// The source written into.
    pub path: PathBuf,
    /// Where the definition sits, so that a dry run reads like a diagnostic.
    pub at: Location,
    /// The label placed.
    pub label: Label,
    /// The byte the text is written before.
    pub offset: usize,
    /// Exactly the bytes written, newline included.
    pub text: String,
}

/// Every label one registered profile's covered assets still owe their own
/// standard place, as insertions.
///
/// Writes nothing. The result is a description a caller reports, applies with
/// [`apply`], or both, and the two paths read the same description — which is
/// what makes a dry run and a write agree by construction rather than by two
/// implementations that happen to match (´dec:lint:fix-subcommand´).
///
/// A profile whose standard place is a generated register sweeps nothing:
/// there is no position in any source for a label of it to occupy. The caller
/// refuses such a profile by name rather than reporting an empty sweep, so
/// that an operator who asked for the wrong mode is told which one to use.
///
/// The sources it will write into are read again here rather than taken from
/// the measurement's walk. That is the writer's own reading of what it is
/// about to change, which is the reading a splice has to be built on: a check
/// answers about bytes it linted, and a write answers about bytes on disk.
///
/// ```no_run
/// use cogra_linter::{ProfileId, fix};
/// use std::path::Path;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let root = Path::new(".");
/// let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
///
/// let sweep = fix::sweep(&adoption, root, &ProfileId::new("rust-module"))?;
/// assert!(sweep.settled(), "the module migration landed with the profile");
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// [`RunError::Walk`] when `root` is not a directory, exactly as every other
/// run over a corpus root reports it.
pub fn sweep(a: &Adoption, root: &Path, profile: &ProfileId) -> Result<Sweep, RunError> {
    let owed = migrate::unplaced(a, root, profile)?;
    let mut held: BTreeMap<PathBuf, Vec<&Unplaced>> = BTreeMap::new();
    for one in &owed {
        held.entry(one.source.clone()).or_default().push(one);
    }

    let mut writes = Vec::new();
    for (path, owed) in held {
        let Ok(source) = fs::read_to_string(root.join(&path)) else {
            continue;
        };
        let mut placed: Vec<Insertion> = owed
            .into_iter()
            .map(|one| {
                let (offset, line) = written(&source, one);
                Insertion {
                    path: path.clone(),
                    at: one.at.clone(),
                    label: one.label.clone(),
                    offset,
                    text: line,
                }
            })
            .collect();
        placed.sort_by_key(|one| one.offset);
        writes.extend(placed);
    }
    Ok(Sweep {
        profile: profile.clone(),
        writes,
    })
}

/// Write one sweep into the corpus.
///
/// Each source is read once, spliced from its last insertion to its first —
/// so that no splice moves an offset not yet applied, which is the ordering
/// [`crate::registers::write_all`] takes for the same reason — and written
/// once.
///
/// # Errors
///
/// [`GenerateError::Write`] when a source cannot be read or written, and
/// [`GenerateError::MissingHostRegion`] when an insertion's offset lies past
/// the source it names, which is a source that has moved since the sweep was
/// taken.
pub fn apply(sweep: &Sweep, root: &Path) -> Result<Written, GenerateError> {
    let mut held: BTreeMap<&Path, Vec<&Insertion>> = BTreeMap::new();
    for one in &sweep.writes {
        held.entry(&one.path).or_default().push(one);
    }

    let mut touched = Vec::new();
    for (path, mut owed) in held {
        let at = root.join(path);
        let mut bytes = fs::read(&at).map_err(|source| GenerateError::Write {
            path: path.to_path_buf(),
            source,
        })?;
        owed.sort_by_key(|one| std::cmp::Reverse(one.offset));
        for one in owed {
            if one.offset > bytes.len() {
                return Err(GenerateError::MissingHostRegion {
                    path: path.to_path_buf(),
                });
            }
            bytes.splice(one.offset..one.offset, one.text.bytes());
        }
        fs::write(&at, &bytes).map_err(|source| GenerateError::Write {
            path: path.to_path_buf(),
            source,
        })?;
        touched.push(path.to_path_buf());
    }
    touched.sort();
    Ok(Written { paths: touched })
}

/// Which of `paths` the working tree carries uncommitted work in, in the
/// order they were given.
///
/// The sweep's precondition. It edits sources it was not asked for by name,
/// which is what no other mode of this binary does, so the one thing that
/// makes such an edit reviewable — a diff against a committed state — has to
/// exist before it runs (´dec:lint:fix-precondition´). Staged and unstaged
/// changes both count, and so does a source git is not tracking at all: what
/// matters is whether the bytes about to be rewritten can be recovered, and
/// an untracked file's cannot.
///
/// # Errors
///
/// An [`std::io::Error`] when `git` cannot be run, when `root` is no
/// repository, or when the command fails — each a reason the precondition
/// cannot be established, which is not the same as establishing that it holds.
pub fn modified(root: &Path, paths: &[PathBuf]) -> std::io::Result<Vec<PathBuf>> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    let spelled: Vec<String> = paths.iter().map(|one| slashed(one)).collect();
    let answer = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["status", "--porcelain", "--"])
        .args(&spelled)
        .output()?;
    if !answer.status.success() {
        return Err(std::io::Error::other(format!(
            "git status over {} failed: {}",
            root.display(),
            String::from_utf8_lossy(&answer.stderr).trim()
        )));
    }
    let listed = String::from_utf8_lossy(&answer.stdout);
    let reported: Vec<&str> = listed.lines().filter_map(status_path).collect();
    Ok(paths
        .iter()
        .filter(|one| reported.contains(&slashed(one).as_str()))
        .cloned()
        .collect())
}

/// The path one porcelain line names.
///
/// The format is two status columns, a space, and the path — and for a rename
/// the path is `from -> to`, whose second half is the one that exists now.
/// Nothing here unquotes a path holding a byte git escapes: such a path is
/// reported as itself, matches no corpus path, and so is not silently taken
/// for clean, because a source that could carry one is refused by the walk
/// long before this runs.
fn status_path(line: &str) -> Option<&str> {
    let named = line.get(3..)?;
    Some(match named.rsplit_once(" -> ") {
        Some((_, to)) => to,
        None => named,
    })
}

/// A path as git spells a pathspec, whatever walked it.
fn slashed(path: &Path) -> String {
    path.components()
        .map(|one| one.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<String>>()
        .join("/")
}

/// Where one label line goes in a source, and exactly what goes there.
///
/// Two shapes, and what separates them is whether the asset's documentation
/// opening is already the start of a line. A definition a whole file backs
/// opens at byte 0, which is one, so the label occupies the file's first line.
/// An inline definition opens just after its brace, which is not, so the label
/// occupies the line after it — unless the brace's own line already holds
/// something else, in which case the line is made.
///
/// The trailing line is what keeps the result the form the corpus carries: a
/// label line that opens an existing inner documentation comment is followed
/// by that comment's own blank continuation, and one that opens a comment of
/// its own is followed by a blank line, so code never abuts a documentation
/// comment it does not belong to.
fn written(text: &str, one: &Unplaced) -> (usize, String) {
    let opens = ceiling(text, one.opens);
    let (offset, made) = line_of(text, opens);
    let indent = if opens == 0 {
        String::new()
    } else {
        " ".repeat(one.at.column as usize + 3)
    };

    let mut out = String::new();
    if made {
        out.push('\n');
    }
    out.push_str(&indent);
    out.push_str("//! ´");
    out.push_str(one.label.as_str());
    out.push_str("´\n");
    if one.documented {
        out.push_str(&indent);
        out.push_str("//!\n");
    } else if !rest(text, offset).trim().is_empty() {
        out.push('\n');
    }
    (offset, out)
}

/// The line start an insertion at `opens` writes at, and whether a line break
/// has to be written to make one.
fn line_of(text: &str, opens: usize) -> (usize, bool) {
    if opens == 0 || text[..opens].ends_with('\n') {
        return (opens, false);
    }
    match text[opens..].find('\n') {
        Some(gap) if text[opens..opens + gap].trim().is_empty() => (opens + gap + 1, false),
        _ => (opens, true),
    }
}

/// The line beginning at one offset, or what is left of the source.
fn rest(text: &str, offset: usize) -> &str {
    let tail = text.get(offset..).unwrap_or("");
    tail.split('\n').next().unwrap_or(tail)
}

/// One offset clamped into a source and onto a character boundary, so that a
/// span from a parser this run did not take cannot panic a slice.
fn ceiling(text: &str, offset: usize) -> usize {
    let mut at = offset.min(text.len());
    while at > 0 && !text.is_char_boundary(at) {
        at -= 1;
    }
    at
}

/// Every rule this module can report.
///
/// None: a writer produces bytes and never a finding, exactly as a generator
/// does (´conv:lint:finding-or-error´). What a covered asset missing its label
/// means is the inventory judgment's to say, and this module only writes what
/// that judgment would then find in place.
pub const RULES: [crate::diag::RuleId; 0] = [];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diag::ByteSpan;

    fn owed(opens: usize, column: u32, documented: bool) -> Unplaced {
        Unplaced {
            source: PathBuf::from("x.rs"),
            label: Label::parse("mod:module:alpha").expect("a well-formed label"),
            at: Location::new(PathBuf::from("x.rs"), ByteSpan::new(0, 0), 1, column),
            opens,
            documented,
        }
    }

    #[test]
    fn a_file_backed_definition_joins_the_comment_that_opens_its_file() {
        let text = "//! One.\n";
        assert_eq!(
            written(text, &owed(0, 1, true)),
            (0, String::from("//! ´mod:module:alpha´\n//!\n"))
        );
    }

    #[test]
    fn a_file_backed_definition_with_no_comment_opens_one_above_the_code() {
        let text = "use std::fmt;\n";
        assert_eq!(
            written(text, &owed(0, 1, false)),
            (0, String::from("//! ´mod:module:alpha´\n\n"))
        );
    }

    #[test]
    fn an_empty_source_takes_the_label_line_alone() {
        assert_eq!(
            written("", &owed(0, 1, false)),
            (0, String::from("//! ´mod:module:alpha´\n"))
        );
    }

    #[test]
    fn an_inline_definition_writes_on_the_line_after_its_brace() {
        let text = "mod alpha {\n    //! One.\n}\n";
        let (offset, written) = written(text, &owed(11, 1, true));
        assert_eq!(offset, 12, "the line the body's first comment opens");
        assert_eq!(written, "    //! ´mod:module:alpha´\n    //!\n");
    }

    #[test]
    fn an_inline_definition_indents_to_its_own_column() {
        let text = "mod outer {\n    mod alpha {\n        use super::*;\n    }\n}\n";
        let (offset, written) = written(text, &owed(27, 5, false));
        assert_eq!(offset, 28);
        assert_eq!(written, "        //! ´mod:module:alpha´\n\n");
    }

    #[test]
    fn a_one_line_definition_gets_the_line_it_needs() {
        let text = "mod alpha { }\n";
        assert_eq!(
            written(text, &owed(11, 1, false)),
            (11, String::from("\n    //! ´mod:module:alpha´\n\n"))
        );
    }

    #[test]
    fn a_porcelain_rename_names_the_path_that_exists_now() {
        assert_eq!(status_path("R  old.rs -> new.rs"), Some("new.rs"));
        assert_eq!(
            status_path(" M crates/api/src/x.rs"),
            Some("crates/api/src/x.rs")
        );
        assert_eq!(status_path("?? new.rs"), Some("new.rs"));
        assert_eq!(status_path("R "), None);
    }
}
