//! ´mod:module:carrier´
//!
//! The walk: which files are in the carrier, and who owns each.
//!
//! Every carrier source and every covered asset takes its owner from the
//! ordered rules of Ω by first match (´conv:lint:owner-assignment´). Two
//! consequences are structural rather than checked: totality is a property
//! of the last rule's empty prefix, so there is no unowned-source state to
//! represent and no diagnostic for one; and an asset's owner is its
//! package and never its module, so refactoring inside a package moves
//! nothing.
//!
//! # The corpus is what version control tracks
//!
//! The base set is `git ls-files`: the files the repository's index holds,
//! minus the carrier's literal exclusions (´dec:lint:tracked-carrier´). An
//! untracked file — build output, a local report, a draft nobody added —
//! is not a member of the carrier rather than a member some exclusion row
//! had to excuse, so the verdict is a property of the commit and not of
//! whoever ran the check. A root whose tracked set cannot be taken is an
//! [`UNREADABLE_TREE`] diagnostic carrying git's own account of why, never
//! an empty carrier.
//!
//! The one exception is the roots the adoption data marks `optional`: the
//! working-note trees are gitignored by design and checked all the same,
//! so each is walked on disk, a recursive [`std::fs::read_dir`] with sorted
//! entries. A directory-walking crate was refused by the design: a walker
//! would bring glob semantics, ignore-file resolution, and an ordering and
//! symlink policy this walk has to fix for itself anyway
//! (´dec:lint:refused-dependencies´).
//!
//! # The link policy
//!
//! A link — POSIX symbolic link or Windows junction, the same reparse point
//! to `file_type` — is crossed only where it stands exactly at a root the
//! adoption data marks `optional`. This corpus configures two, the
//! working-note trees, and they are links on every machine that has them.
//! A link anywhere else contributes neither a source nor a descent: a
//! tracked one is recognized by the index's own mode rather than by the
//! filesystem, so a checkout that materialized it as a plain file changes
//! nothing, and one met inside an optional tree is not followed.
//!
//! The rule is stated rather than emergent because the alternative is not
//! a policy at all: following whatever a name resolves to means the corpus
//! is a property of the checkout, not of the repository. The two roots are
//! the case the adoption data deliberately admits, and `optional` already
//! carries exactly the fact that makes them safe to name — that they are
//! links whose absence is legal.
//!
//! A crossed root is walked under its LINK path, so a source found through
//! `tmp_dev` is reported at `tmp_dev/...` and takes the owner that root's
//! partition rule assigns. The bytes come from the target; the name — the
//! only thing an owner, an exclusion, or a finding is ever matched against
//! — is the corpus's own.
//!
//! A broken link on disk is still resolved far enough to report it: a
//! dangling entry of a walked tree is an [`UNREADABLE_SOURCE`] diagnostic,
//! because refusing to follow a link is a decision and failing to read one
//! is a defect, and the two must not look alike.

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::adopt::{Adoption, Language, OwnerId, relative_str};
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};

/// A tree that could not be read, or a root whose tracked set git would not
/// list. The tree is skipped and the walk goes on: an unreadable tree is a
/// shorter source list beside a diagnostic, never an empty carrier.
pub const UNREADABLE_TREE: RuleId = RuleId::new("carrier-unreadable-tree");

/// A file inside the carrier that could not be read.
pub const UNREADABLE_SOURCE: RuleId = RuleId::new("carrier-unreadable-source");

/// A configured root the walk found nothing under, where the adoption data
/// does not say its absence is legal (´conv:lint:owner-assignment´).
pub const UNMATCHED_ROOT: RuleId = RuleId::new("carrier-unmatched-root");

/// A file type the carrier holds that no frontend reads and no
/// `[[scanned-regions.none]]` row declares (´dec:lint:catalogue-totality´).
pub const UNCATALOGUED_TYPE: RuleId = RuleId::new("carrier-uncatalogued-type");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 4] = [
    UNREADABLE_TREE,
    UNREADABLE_SOURCE,
    UNMATCHED_ROOT,
    UNCATALOGUED_TYPE,
];

/// One carrier source, with everything the harvest needs about it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceFile {
    /// The path, relative to the corpus root and spelled as the adoption
    /// data spells paths.
    pub path: PathBuf,
    /// Its owner, by Ω's first match.
    pub owner: OwnerId,
    /// The language a frontend reads it as, where one does. `None` covers
    /// the types a `[[scanned-regions.none]]` row declares and whatever
    /// else the working notes hold: those files are in the carrier and
    /// owned, and carry no occurrences.
    pub language: Option<Language>,
    /// Whether it is a committed generated file.
    pub generated: bool,
    /// Its bytes, where the run has a reader for them.
    ///
    /// Empty for a source that carries no language and is not generated:
    /// no frontend scans it, so it holds no occurrence to locate and no
    /// register row to compare, and nothing downstream asks. The walk
    /// therefore does not read it — which is what keeps an uncurated
    /// directory in the carrier from costing what its largest file costs.
    pub bytes: Vec<u8>,
}

/// What a walk produces beside its sources: never an empty carrier.
#[derive(Clone, Debug)]
pub struct WalkOutcome {
    /// The sources the walk did reach.
    pub sources: Vec<SourceFile>,
    /// What it could not read, each located.
    pub failures: Vec<Diagnostic>,
}

/// The configured roots the walk reached nothing under.
///
/// `optional` is a promise the adoption data makes in both directions: a row
/// carrying it says an absent root is legal and silent — the two working-note
/// roots of this corpus are gitignored junctions that simply do not exist on
/// some machines — and a row not carrying it says the tree is one the corpus
/// has. A rule matching no source is that second promise broken, and saying
/// nothing about it is what made `optional = false` a key with no check
/// behind it.
///
/// Prefix matching decides this and precedence does not: the question is
/// whether the root is *there*, not which rule would win a file inside it, so
/// a rule shadowed by a more specific one before it stays silent. The last
/// rule's empty prefix matches everything, so a corpus with any source at all
/// never reports its own root.
///
/// The finding carries no path, [`Adoption`] not retaining the file it was
/// read from (´sig:lint:adoption-api´); the rule's own order names the row.
///
/// [`crate::check`] is the one caller, and deliberately: this answers "did
/// the traversal find the trees the adoption data configures", which only a
/// traversal can be asked. A source list handed over from elsewhere made no
/// such claim.
#[must_use]
pub fn unmatched_roots(a: &Adoption, sources: &[SourceFile]) -> Vec<Diagnostic> {
    a.partition
        .rules
        .iter()
        .filter(|rule| !rule.optional)
        .filter(|rule| !sources.iter().any(|src| rule.path.matches(&src.path)))
        .map(|rule| Diagnostic {
            rule: UNMATCHED_ROOT,
            severity: Severity::Error,
            enforcement: a.enforcement.enforcement_for(Path::new("")),
            primary: Location::new(PathBuf::new(), ByteSpan::new(0, 0), 0, 0),
            related: Vec::new(),
            message: format!(
                "the partition rule at order {} configures the root {}, which the walk found nothing under, and the row does not mark it optional",
                rule.order, rule.path
            ),
        })
        .collect()
}

/// The file types the catalogue does not answer for, one finding each.
///
/// `[scanned-regions]` is total over the tracked carrier: every file type in
/// it is either read by a frontend or declared in a `[[scanned-regions.none]]`
/// row, so a new kind of file arrives as a decision and never as a file
/// nobody scans without anybody having said so. The finding is located at
/// the type's first file by path and counts the rest, because the repair is
/// one row of the adoption data and not an edit per file.
///
/// It fails the lane wherever the file sits. The defect is the catalogue's,
/// and a type first seen in an advisory tree is uncatalogued for the failing
/// trees just the same.
///
/// The optional roots are outside the question: the working notes are no
/// commit's content, and the catalogue is a claim about what the repository
/// carries.
///
/// ```
/// use cogra_linter::{Adoption, OwnerId, SourceFile, carrier};
/// use std::path::{Path, PathBuf};
///
/// # let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../corpus-adoption.toml");
/// # let adoption = Adoption::load(Path::new(path)).expect("ruled adoption data");
/// let held = |path: &str| SourceFile {
///     path: PathBuf::from(path),
///     owner: OwnerId::new("tree.repo-root"),
///     language: None,
///     generated: false,
///     bytes: Vec::new(),
/// };
/// let found = carrier::uncatalogued(
///     &adoption,
///     &[held("tools/a.py"), held("tools/b.py"), held("Makefile"), held("tmp_dev/x.py")],
/// );
/// assert_eq!(found.len(), 1, "one finding per type, and the working notes are exempt");
/// assert_eq!(found[0].primary.path, PathBuf::from("tools/a.py"));
/// ```
#[must_use]
pub fn uncatalogued(a: &Adoption, sources: &[SourceFile]) -> Vec<Diagnostic> {
    let mut first: BTreeMap<String, (&Path, usize)> = BTreeMap::new();
    for src in sources {
        let walked = a
            .partition
            .rules
            .iter()
            .any(|rule| rule.optional && rule.path.matches(&src.path));
        if walked || a.scanned_regions.catalogues(&src.path) {
            continue;
        }
        first
            .entry(type_of(&src.path))
            .and_modify(|(at, count)| {
                *count += 1;
                if src.path.as_path() < *at {
                    *at = &src.path;
                }
            })
            .or_insert((&src.path, 1));
    }
    first
        .into_iter()
        .map(|(kind, (at, count))| Diagnostic {
            rule: UNCATALOGUED_TYPE,
            severity: Severity::Error,
            enforcement: Enforcement::Failing,
            primary: Location::new(at.to_path_buf(), ByteSpan::new(0, 0), 1, 1),
            related: Vec::new(),
            message: format!(
                "the file type {kind} ({count} in the carrier, this the first) is neither read by a frontend nor declared by a [[scanned-regions.none]] row, and the catalogue must answer for every tracked type"
            ),
        })
        .collect()
}

/// A file's type as a finding names it: the extension from the last dot of
/// its name, or the whole name where no dot follows the first character —
/// `Makefile`, `.gitignore`.
fn type_of(path: &Path) -> String {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    match name.rfind('.') {
        Some(dot) if dot > 0 => String::from(&name[dot..]),
        _ => name,
    }
}

/// The carrier walk, over one corpus root under one adoption.
pub struct Walk<'a> {
    adoption: &'a Adoption,
    root: PathBuf,
}

impl<'a> Walk<'a> {
    /// A walk of `root` under `adoption`.
    #[must_use]
    pub fn new(adoption: &'a Adoption, root: &Path) -> Walk<'a> {
        Walk {
            adoption,
            root: root.to_path_buf(),
        }
    }

    /// Every carrier source, in a deterministic order: sorted by path,
    /// never by directory-iteration order.
    ///
    /// ```no_run
    /// use cogra_linter::{Adoption, Walk};
    /// use std::path::Path;
    ///
    /// let adoption = Adoption::load(Path::new("corpus-adoption.toml"))?;
    /// let walk = Walk::new(&adoption, Path::new("."));
    ///
    /// match walk.sources() {
    ///     Ok(sources) => println!("{} sources, every one owned", sources.len()),
    ///     Err(outcome) => println!(
    ///         "{} sources beside {} traversal failures",
    ///         outcome.sources.len(),
    ///         outcome.failures.len(),
    ///     ),
    /// }
    /// # Ok::<(), cogra_linter::AdoptionError>(())
    /// ```
    ///
    /// # Errors
    ///
    /// A [`WalkOutcome`] whenever the traversal failed anywhere. It carries
    /// the sources *and* the failures, and never trades one for the other:
    /// an unreadable tree is a reported diagnostic beside a shorter source
    /// list, which is the case the disciplines forbid collapsing into an
    /// empty carrier. A root git will not list is such a tree, and so is
    /// a tracked file that is no longer on disk. An absent optional root
    /// contributes neither a source nor a diagnostic.
    pub fn sources(&self) -> Result<Vec<SourceFile>, WalkOutcome> {
        let mut sources = Vec::new();
        let mut failures = Vec::new();
        self.tracked(&mut sources, &mut failures);
        let mut entered = HashSet::new();
        for rule in self
            .adoption
            .partition
            .rules
            .iter()
            .filter(|rule| rule.optional)
        {
            let path = self.root.join(rule.path.as_str().trim_end_matches('/'));
            match fs::symlink_metadata(&path) {
                Err(absent) if absent.kind() == io::ErrorKind::NotFound => {}
                found => self.visit(
                    &path,
                    found.map(|metadata| metadata.file_type()),
                    &mut sources,
                    &mut failures,
                    &mut entered,
                ),
            }
        }
        sources.sort_by_key(|one| relative_str(&one.path));
        sources.dedup_by(|one, other| one.path == other.path);
        failures.sort();
        if failures.is_empty() {
            Ok(sources)
        } else {
            Err(WalkOutcome { sources, failures })
        }
    }

    /// Every tracked file of the root that the carrier keeps.
    ///
    /// A tracked link or submodule is recognized by its index mode and
    /// contributes nothing (the link policy in the module header). Only a
    /// source some reader consumes is opened, exactly as in a walked tree,
    /// so a tracked file that is gone from disk is reported where it is
    /// read and carried empty where nothing would have read it.
    fn tracked(&self, sources: &mut Vec<SourceFile>, failures: &mut Vec<Diagnostic>) {
        let listed = match tracked_entries(&self.root) {
            Ok(listed) => listed,
            Err(problem) => {
                failures.push(self.failure(UNREADABLE_TREE, Path::new(""), &problem));
                return;
            }
        };
        for entry in listed {
            let relative = match entry {
                Tracked::Link => continue,
                Tracked::File(relative) => relative,
                Tracked::NotText(lossy) => {
                    failures.push(self.failure(
                        UNREADABLE_SOURCE,
                        Path::new(&lossy),
                        "the tracked path is not UTF-8, so no path rule can decide it",
                    ));
                    continue;
                }
            };
            if self.adoption.carrier.excludes(&relative) {
                continue;
            }
            self.file(&self.root.join(&relative), &relative, sources, failures);
        }
    }

    /// One entry of a walked tree, whose kind the caller has already asked.
    ///
    /// `kind` is the entry's own `file_type`, which decides what it is, and
    /// only a link is resolved further — measured on this corpus, an extra
    /// `metadata` per entry more than doubled the walk.
    ///
    /// The policy of the module header is one arm of the match below — a
    /// resolved link that does not stand at a configured optional root ends
    /// its entry there — and it sits ahead of the directory arm so that
    /// refusing to cross reads as the decision it is. A link that does not
    /// resolve at all takes the `Err` arm instead and is reported, because a
    /// broken link is a defect and an uncrossed one is not.
    fn visit(
        &self,
        path: &Path,
        kind: io::Result<fs::FileType>,
        sources: &mut Vec<SourceFile>,
        failures: &mut Vec<Diagnostic>,
        entered: &mut HashSet<PathBuf>,
    ) {
        let Ok(relative) = path.strip_prefix(&self.root) else {
            return;
        };
        if self.adoption.carrier.excludes(relative) {
            return;
        }
        let kind = kind.and_then(|kind| {
            if kind.is_symlink() {
                fs::metadata(path).map(|resolved| (resolved.file_type(), true))
            } else {
                Ok((kind, false))
            }
        });
        match kind {
            Ok((_, true)) if !self.adoption.partition.is_optional_root(relative) => {}
            Ok((kind, linked)) if kind.is_dir() => {
                self.descend(path, linked, sources, failures, entered);
            }
            Ok(_) => self.file(path, relative, sources, failures),
            Err(problem) => failures.push(self.failure(
                UNREADABLE_SOURCE,
                relative,
                &format!("cannot read the entry: {problem}"),
            )),
        }
    }

    /// One directory of a walked tree, its entries in path order.
    ///
    /// `linked` says the walk arrived here through a symbolic link, and it
    /// is the only case that pays for a canonical path: a plain tree
    /// reaches every directory once, and the two configured roots of this
    /// corpus are links, so the guard against a link cycle costs one
    /// resolution per link rather than one per directory.
    ///
    /// With the link policy in the module header, the only links the walk
    /// crosses are the configured roots themselves, so the cycle the guard
    /// answers is the narrow one that survives it: two roots resolving to
    /// one tree, which is walked under the first of their names and not
    /// again under the second.
    fn descend(
        &self,
        directory: &Path,
        linked: bool,
        sources: &mut Vec<SourceFile>,
        failures: &mut Vec<Diagnostic>,
        entered: &mut HashSet<PathBuf>,
    ) {
        if linked {
            let mark = fs::canonicalize(directory).unwrap_or_else(|_| directory.to_path_buf());
            if !entered.insert(mark) {
                return;
            }
        }
        let mut entries = match fs::read_dir(directory) {
            Ok(entries) => entries
                .filter_map(Result::ok)
                .collect::<Vec<fs::DirEntry>>(),
            Err(problem) => {
                let at = directory.strip_prefix(&self.root).unwrap_or(directory);
                failures.push(self.failure(
                    UNREADABLE_TREE,
                    at,
                    &format!("cannot read the tree: {problem}"),
                ));
                return;
            }
        };
        entries.sort_by_key(fs::DirEntry::path);
        for entry in entries {
            self.visit(&entry.path(), entry.file_type(), sources, failures, entered);
        }
    }

    /// One file the carrier keeps, read only where some reader consumes it.
    fn file(
        &self,
        path: &Path,
        relative: &Path,
        sources: &mut Vec<SourceFile>,
        failures: &mut Vec<Diagnostic>,
    ) {
        if !self.is_read(relative) {
            sources.push(self.source(relative, Vec::new()));
            return;
        }
        match fs::read(path) {
            Ok(bytes) => sources.push(self.source(relative, bytes)),
            Err(problem) => failures.push(self.failure(
                UNREADABLE_SOURCE,
                relative,
                &format!("cannot read the source: {problem}"),
            )),
        }
    }

    /// Whether the run has a reader for this source's bytes.
    ///
    /// A frontend reads it, or the register freshness check compares it
    /// byte-exact against what a generator would write. Nothing else
    /// consumes bytes, so nothing else has to pay for them: an unreadable
    /// SOURCE here would be an unread file either way, which is why this
    /// skips the read rather than reporting one.
    fn is_read(&self, relative: &Path) -> bool {
        self.adoption
            .scanned_regions
            .language_of(relative)
            .is_some()
            || self.adoption.carrier.is_generated(relative)
    }

    fn source(&self, relative: &Path, bytes: Vec<u8>) -> SourceFile {
        SourceFile {
            path: PathBuf::from(relative_str(relative)),
            owner: self.adoption.partition.owner_for(relative),
            language: self.adoption.scanned_regions.language_of(relative),
            generated: self.adoption.carrier.is_generated(relative),
            bytes,
        }
    }

    fn failure(&self, rule: RuleId, path: &Path, message: &str) -> Diagnostic {
        let at = PathBuf::from(relative_str(path));
        Diagnostic {
            rule,
            severity: Severity::Error,
            enforcement: self.adoption.enforcement.enforcement_for(&at),
            primary: Location::new(at, ByteSpan::new(0, 0), 1, 1),
            related: Vec::new(),
            message: String::from(message),
        }
    }
}

/// One entry of the index, as the carrier needs it.
#[derive(Debug, PartialEq, Eq)]
enum Tracked {
    /// A regular file, its path relative to the root and `/`-separated.
    File(PathBuf),
    /// A symbolic link or a submodule, which the link policy leaves out.
    Link,
    /// A path whose bytes are not UTF-8, spelled lossily for the report.
    NotText(String),
}

/// The index mode of a symbolic link.
const MODE_LINK: &[u8] = b"120000";

/// The index mode of a submodule, a commit rather than a file.
const MODE_GITLINK: &[u8] = b"160000";

/// The index entries of the repository at `root`, in git's order.
///
/// Provenance: transplanted from the L1 author's orchestration-linter 0.1.0
/// (source archive `orchestration-linter-0.1.0-416b136`, commit 416b136,
/// `packages/linter/src/plan.rs`, `git_tracked`), AGPL-3.0-only like this
/// crate. Kept: `git -C <root> ls-files -z`, a NUL-split of stdout, and a
/// failed or unstartable listing reported as `git ls-files: <git's own
/// account>` rather than paraphrased. Adapted: `--stage` is added so the
/// index mode says which entries are links and submodules without a
/// filesystem query per file, and the error is a message for the caller's
/// located diagnostic instead of the author's finding type.
///
/// `ls-files` is one of git's interrogation (plumbing) commands, and `-z`
/// is its documented script form: NUL-terminated records with no quoting,
/// each `<mode> SP <object> SP <stage> TAB <path>` under `--stage`. An
/// unmerged path is listed once per stage, and the caller's sort-and-dedup
/// by path takes it once.
fn tracked_entries(root: &Path) -> Result<Vec<Tracked>, String> {
    let output = match Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["ls-files", "-z", "--stage"])
        .output()
    {
        Ok(output) if output.status.success() => output.stdout,
        Ok(output) => {
            return Err(format!(
                "git ls-files: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Err(error) => return Err(format!("git ls-files: {error}")),
    };
    Ok(output
        .split(|&byte| byte == 0)
        .filter(|record| !record.is_empty())
        .filter_map(tracked_entry)
        .collect())
}

/// One `--stage` record, or `None` for a record that is not one.
fn tracked_entry(record: &[u8]) -> Option<Tracked> {
    let tab = record.iter().position(|&byte| byte == b'\t')?;
    let (info, path) = (&record[..tab], &record[tab + 1..]);
    let mode = info.split(|&byte| byte == b' ').next()?;
    if mode == MODE_LINK || mode == MODE_GITLINK {
        return Some(Tracked::Link);
    }
    Some(match std::str::from_utf8(path) {
        Ok(text) => Tracked::File(PathBuf::from(text)),
        Err(_) => Tracked::NotText(String::from_utf8_lossy(path).into_owned()),
    })
}

#[cfg(test)]
mod tests {
    use super::{Tracked, tracked_entry};
    use std::path::PathBuf;

    /// The mode alone says a link or a submodule, and the path after the tab
    /// may hold the spaces the mode's own fields are separated by.
    ///
    /// An index record is read by its mode and by the whole path after its tab.
    /// ´claim:walk:an-index-record-is-read-by-mode-and-path´
    #[test]
    fn a_stage_record_reads_as_its_mode_and_path() {
        assert_eq!(
            tracked_entry(b"100644 0123abcd 0\tdocs/a note.md"),
            Some(Tracked::File(PathBuf::from("docs/a note.md")))
        );
        assert_eq!(
            tracked_entry(b"100755 0123abcd 0\tandroid/gradlew"),
            Some(Tracked::File(PathBuf::from("android/gradlew")))
        );
        assert_eq!(
            tracked_entry(b"120000 0123abcd 0\tlinked"),
            Some(Tracked::Link)
        );
        assert_eq!(
            tracked_entry(b"160000 0123abcd 0\tvendor/sub"),
            Some(Tracked::Link)
        );
        assert_eq!(
            tracked_entry(b"100644 0123abcd 0\tod\xffd"),
            Some(Tracked::NotText(String::from("od\u{fffd}d")))
        );
        assert_eq!(tracked_entry(b"no tab here"), None);
    }
}
