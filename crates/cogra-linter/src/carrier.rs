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

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 2] = [UNREADABLE_TREE, UNREADABLE_SOURCE];

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
    /// Its bytes.
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
                Ok((kind, linked)) if kind.is_dir() => {
                    self.descend(&path, linked, sources, failures, entered);
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
