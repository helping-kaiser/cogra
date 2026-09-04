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
//! The traversal is a recursive [`std::fs::read_dir`] with sorted entries.
//! A directory-walking crate was refused by the design: the carrier is
//! defined by literal path prefixes, and a walker would bring glob
//! semantics, ignore-file resolution, and an ordering and symlink policy
//! this walk has to fix for itself anyway (´dec:lint:refused-dependencies´).
//!
//! # The link policy
//!
//! The walk crosses a link — POSIX symbolic link or Windows junction, the
//! same reparse point to `file_type` — only where it stands exactly at a
//! root the adoption data marks `optional`. This corpus configures two,
//! the working-note trees, and they are links on every machine that has
//! them; a link anywhere else contributes neither a source nor a descent.
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
//! A broken link is still resolved far enough to report it: a dangling
//! entry is an [`UNREADABLE_SOURCE`] diagnostic wherever it sits, because
//! refusing to follow a link is a decision and failing to read one is a
//! defect, and the two must not look alike.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::adopt::{Adoption, Language, OwnerId, relative_str};
use crate::diag::{ByteSpan, Diagnostic, Location, RuleId, Severity};

/// A tree that could not be read. The subtree is skipped and the walk goes
/// on: an unreadable tree is a shorter source list beside a diagnostic,
/// never an empty carrier.
pub const UNREADABLE_TREE: RuleId = RuleId::new("carrier-unreadable-tree");

/// A file inside the carrier that could not be read.
pub const UNREADABLE_SOURCE: RuleId = RuleId::new("carrier-unreadable-source");

/// A configured root the walk found nothing under, where the adoption data
/// does not say its absence is legal (´conv:lint:owner-assignment´).
pub const UNMATCHED_ROOT: RuleId = RuleId::new("carrier-unmatched-root");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 3] = [UNREADABLE_TREE, UNREADABLE_SOURCE, UNMATCHED_ROOT];

/// One carrier source, with everything the harvest needs about it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceFile {
    /// The path, relative to the corpus root and spelled as the adoption
    /// data spells paths.
    pub path: PathBuf,
    /// Its owner, by Ω's first match.
    pub owner: OwnerId,
    /// The language a frontend reads it as, where one does. `None` covers
    /// the languages listed with no frontend and everything else: those
    /// files are in the carrier and owned, and carry no occurrences.
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
    /// empty carrier. An absent optional root contributes neither a source
    /// nor a diagnostic.
    pub fn sources(&self) -> Result<Vec<SourceFile>, WalkOutcome> {
        let mut sources = Vec::new();
        let mut failures = Vec::new();
        let mut entered = HashSet::new();
        self.descend(&self.root, false, &mut sources, &mut failures, &mut entered);
        sources.sort_by_key(|one| relative_str(&one.path));
        failures.sort();
        if failures.is_empty() {
            Ok(sources)
        } else {
            Err(WalkOutcome { sources, failures })
        }
    }

    /// One directory, its entries in path order.
    ///
    /// `linked` says the walk arrived here through a symbolic link, and it
    /// is the only case that pays for a canonical path: a plain tree
    /// reaches every directory once, and the two configured roots of this
    /// corpus are links, so the guard against a link cycle costs one
    /// resolution per link rather than one per directory. The entry's own
    /// `file_type` decides what it is, and only a link is resolved further
    /// — measured on this corpus, an extra `metadata` per entry more than
    /// doubled the walk.
    ///
    /// With the link policy in the module header, the only links the walk
    /// crosses are the configured roots themselves, so the cycle the guard
    /// answers is the narrow one that survives it: two roots resolving to
    /// one tree, which is walked under the first of their names and not
    /// again under the second.
    ///
    /// The policy is one arm of the match below — a resolved link that does
    /// not stand at a configured optional root ends its entry there — and
    /// it sits ahead of the directory arm so that refusing to cross reads
    /// as the decision it is. A link that does not resolve at all takes the
    /// `Err` arm instead and is reported, because a broken link is a defect
    /// and an uncrossed one is not.
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
                failures.push(self.failure(
                    UNREADABLE_TREE,
                    directory,
                    &format!("cannot read the tree: {problem}"),
                ));
                return;
            }
        };
        entries.sort_by_key(fs::DirEntry::path);
        for entry in entries {
            let path = entry.path();
            let Ok(relative) = path.strip_prefix(&self.root) else {
                continue;
            };
            if self.adoption.carrier.excludes(relative) {
                continue;
            }
            let kind = entry.file_type().and_then(|kind| {
                if kind.is_symlink() {
                    fs::metadata(&path).map(|resolved| (resolved.file_type(), true))
                } else {
                    Ok((kind, false))
                }
            });
            match kind {
                Ok((_, true)) if !self.adoption.partition.is_optional_root(relative) => continue,
                Ok((kind, linked)) if kind.is_dir() => {
                    self.descend(&path, linked, sources, failures, entered);
                }
                Ok(_) if !self.is_read(relative) => {
                    sources.push(self.source(relative, Vec::new()));
                }
                Ok(_) => match fs::read(&path) {
                    Ok(bytes) => sources.push(self.source(relative, bytes)),
                    Err(problem) => failures.push(self.failure(
                        UNREADABLE_SOURCE,
                        relative,
                        &format!("cannot read the source: {problem}"),
                    )),
                },
                Err(problem) => failures.push(self.failure(
                    UNREADABLE_SOURCE,
                    relative,
                    &format!("cannot read the entry: {problem}"),
                )),
            }
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
