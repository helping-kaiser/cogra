//! ´mod:module:migrate´
//!
//! How far each staged profile's migration still has to travel.
//!
//! A profile is registered and staged until the migration that makes it
//! satisfiable lands, because the inventory clause admits nothing partial:
//! every covered asset carries its label at the standard place or the run
//! fails (´dec:lint:staged-profiles´). What the migration's distance wants
//! is a *measurement*, and a measurement is not a lint — it has its own run
//! and its own subcommand (´dec:lint:migrations-subcommand´).
//!
//! # Why this is its own run, and its own module
//!
//! [`distances`] judges nothing, emits no diagnostic and no verdict, and
//! computes the censuses a check deliberately does not: a census computed
//! inside the judging run would be the half-computed pass
//! (´[LBL-inv:labels:two-pass]´) exists to forbid. So it belongs to neither
//! `judge`, which judges, nor `registers`, which generates — it is the third
//! run, and it gets the module the module map has no name for
//! (´model:lint:module-map´). The addition is named here rather than slipped
//! in, on the design's own practice with the seven it added
//! (´rem:lint:module-additions´).
//!
//! # What is measured, exactly
//!
//! For the test profile: the covered assets, counted against the registers
//! not yet generated — one line per owner whose assets have no committed
//! register. For the module profile: the definitions, counted against those
//! still lacking the inner documentation comment their standard place is,
//! each located. The module measurement reads the definition's own source
//! for a mint of the derived label inside an inner documentation comment,
//! which is the standard place's form; that the comment opens the module's
//! own body is not checked, and the measurement says as much rather than
//! claiming more than it looked at.
//!
//! # What the sweep borrows
//!
//! [`unplaced`] is that second measurement named and made public: the covered
//! assets of one registered profile whose standard place is the asset itself
//! and which do not carry their label there, each with the byte a label line
//! goes before. [`distances`] renders them as lines and [`crate::fix`] writes
//! at them, off one walk and one recognizer, so a migration's measurement and
//! the sweep that discharges it cannot come to disagree
//! (´dec:lint:fix-subcommand´).

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::adopt::{Adoption, Kind, OwnerId, Profile, ProfileId, ProfileStatus};
use crate::carrier::{SourceFile, Walk};
use crate::diag::{ByteSpan, Location};
use crate::error::{RunError, WalkError};
use crate::frontend::{Asset, Declaration, backing_definitions};
use crate::frontend_rust::{self, CargoTarget};
use crate::pretokenize::rust::RUST;
use crate::pretokenize::{CommentForm, pretokenize};
use crate::registers::{derived_label, owner_root, register_path};
use crate::scan::{Label, Occurrence, scan_code};

/// One staged profile's distance from its entry condition.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Migration {
    /// The profile, as `[profiles]` registers it.
    pub profile: ProfileId,
    /// The kind it governs once it enters Π.
    pub kind: Kind,
    /// What `[profiles]` records it as waiting on.
    pub enters_when: Box<str>,
    /// The assets its census covers today.
    pub covered: usize,
    /// What its entry condition still wants, one located line each.
    pub remaining: Vec<Remaining>,
}

impl Migration {
    /// Whether the entry condition holds as measured.
    #[must_use]
    pub fn arrived(&self) -> bool {
        self.remaining.is_empty()
    }
}

/// One thing a migration still has to do, where it has to be done.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Remaining {
    /// Where the work sits: an asset, or the register that is absent.
    pub at: Location,
    /// One line saying what is missing there.
    pub note: String,
}

/// One covered asset of a comment-placed profile that does not carry its
/// derived label at its standard place.
///
/// The measurement's own finding, given a name and a byte offset so that a
/// writer can act on it. [`distances`] renders these as [`Remaining`] lines
/// and [`crate::fix`] writes at them, off one walk and one recognizer: what a
/// measurement calls a step still owed is exactly what a sweep fills in, and
/// two answers to that question would be two migrations
/// (´dec:lint:fix-subcommand´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Unplaced {
    /// The source the definition sits in.
    pub source: PathBuf,
    /// The label its profile's transformation derives from it.
    pub label: Label,
    /// Where the definition sits.
    pub at: Location,
    /// The byte a label line goes before: the asset's documentation opening
    /// ([`Asset::opens`]).
    pub opens: usize,
    /// Whether an inner documentation comment already opens there, which is
    /// what decides whether a label line joins a comment or starts one.
    pub documented: bool,
}

/// Measure every staged profile's remaining distance.
///
/// `only` restricts the measurement to one registered profile. A profile
/// that is not staged is not measured: an effective profile's distance is
/// zero by the inventory judgment that already runs over it.
///
/// ```no_run
/// use cogra_linter::migrate::distances;
/// use std::path::Path;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let root = Path::new(".");
/// let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
///
/// for one in distances(&adoption, root, None)? {
///     println!("{} is {} steps away", one.profile.as_str(), one.remaining.len());
/// }
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// [`RunError::Walk`] when `root` is not a directory. A source that will not
/// parse contributes no assets and no line, exactly as it contributes no
/// occurrences to a check: this run reports a measurement, and a file it
/// could not read is not one it guesses about.
pub fn distances(
    a: &Adoption,
    root: &Path,
    only: Option<&ProfileId>,
) -> Result<Vec<Migration>, RunError> {
    if !root.is_dir() {
        return Err(RunError::Walk(WalkError::NotADirectory {
            path: root.to_path_buf(),
        }));
    }
    let sources = match Walk::new(a, root).sources() {
        Ok(sources) => sources,
        Err(outcome) => outcome.sources,
    };
    let committed: Vec<&PathBuf> = sources.iter().map(|one| &one.path).collect();

    let mut out = Vec::new();
    for profile in &a.profiles.profiles {
        if !matches!(profile.status, ProfileStatus::Staged { .. })
            || only.is_some_and(|wanted| *wanted != profile.id)
        {
            continue;
        }
        let census = census_of(a, profile, &sources);
        let covered = census.iter().map(|(_, held)| held.len()).sum();
        let remaining = if profile.standard_place.register.is_some() {
            registers_missing(a, profile, &census, &committed)
        } else {
            comments_missing(a, profile, &census)
        };
        out.push(Migration {
            profile: profile.id.clone(),
            kind: profile.kind.clone(),
            enters_when: enters_when(profile),
            covered,
            remaining,
        });
    }
    Ok(out)
}

/// One registered profile's census, by the owner whose tree each asset sits
/// in.
///
/// The measurement's own machinery, exposed because the named regeneration
/// needs exactly it: a profile whose entry condition names its own registers
/// cannot meet it out of a run that computes nothing for it, so the
/// regeneration mode asks for the profile by name and generates its registers
/// while it is still staged (´dec:lint:staged-profiles´). It judges nothing —
/// it walks, computes, and returns — which is what makes it safe to call from
/// a mode that is not the check.
///
/// Status is not consulted. A profile in force has its census computed by the
/// harvest as well, and the two agree; a staged one has this and nothing
/// else. An unregistered name has an empty census, which is a fact about the
/// name and not about the corpus.
///
/// ```no_run
/// use cogra_linter::{ProfileId, migrate};
/// use std::path::Path;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let root = Path::new(".");
/// let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
///
/// for (owner, held) in migrate::census(&adoption, root, &ProfileId::new("rust-test"))? {
///     println!("{} covers {} assets", owner.as_str(), held.len());
/// }
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// [`RunError::Walk`] when `root` is not a directory, exactly as
/// [`distances`] reports it.
pub fn census(
    a: &Adoption,
    root: &Path,
    profile: &ProfileId,
) -> Result<BTreeMap<OwnerId, Vec<Asset>>, RunError> {
    if !root.is_dir() {
        return Err(RunError::Walk(WalkError::NotADirectory {
            path: root.to_path_buf(),
        }));
    }
    let sources = match Walk::new(a, root).sources() {
        Ok(sources) => sources,
        Err(outcome) => outcome.sources,
    };
    let Some(registered) = a.profiles.profiles.iter().find(|one| one.id == *profile) else {
        return Ok(BTreeMap::new());
    };
    let mut out: BTreeMap<OwnerId, Vec<Asset>> = BTreeMap::new();
    for (src, held) in census_of(a, registered, &sources) {
        out.entry(src.owner.clone()).or_default().extend(held);
    }
    Ok(out)
}

/// One profile's census, by the source each asset sits in.
///
/// A *staged* profile's census is computed here and nowhere else, which is
/// what keeps the check's pass honest (´dec:lint:staged-profiles´). The
/// cross-source half is not this run's own: the pairing that turns the
/// corpus's declarations into definitions is one implementation, shared with
/// the judging run, and this is one of its two callers
/// (´dec:lint:cross-source-pairing´).
fn census_of<'s>(
    a: &Adoption,
    profile: &Profile,
    sources: &'s [SourceFile],
) -> Vec<(&'s SourceFile, Vec<Asset>)> {
    let mut out: BTreeMap<&'s Path, (&'s SourceFile, Vec<Asset>)> = BTreeMap::new();
    let mut declared: Vec<(&'s Path, Declaration)> = Vec::new();
    for src in sources {
        if src.language.as_ref().map(crate::adopt::Language::as_str) != Some(RUST) {
            continue;
        }
        let Ok(censuses) = frontend_rust::censuses(src, a, CargoTarget::of(&src.path)) else {
            continue;
        };
        let held: Vec<Asset> = censuses
            .tests
            .into_iter()
            .chain(censuses.modules)
            .filter(|asset| asset.profile == profile.id)
            .collect();
        if !held.is_empty() {
            out.entry(&src.path)
                .or_insert((src, Vec::new()))
                .1
                .extend(held);
        }
        declared.extend(
            censuses
                .declarations
                .into_iter()
                .map(|one| (&*src.path, one)),
        );
    }
    let paired = {
        let declaring: Vec<(&Path, &str)> = declared
            .iter()
            .map(|(path, one)| (*path, one.identifier.as_str()))
            .collect();
        let defined: Vec<(&Path, &str)> = out
            .iter()
            .flat_map(|(path, (_, held))| {
                held.iter().map(move |one| (*path, one.identifier.as_str()))
            })
            .collect();
        backing_definitions(profile, sources, &declaring, &defined)
    };
    for (src, asset) in paired {
        out.entry(&src.path)
            .or_insert((src, Vec::new()))
            .1
            .push(asset);
    }
    out.into_values().collect()
}

/// The registers a register-placed profile still waits on, one per owner
/// with covered assets and no committed register.
fn registers_missing(
    a: &Adoption,
    profile: &Profile,
    census: &[(&SourceFile, Vec<Asset>)],
    committed: &[&PathBuf],
) -> Vec<Remaining> {
    let mut by_owner: BTreeMap<OwnerId, usize> = BTreeMap::new();
    for (src, held) in census {
        *by_owner.entry(src.owner.clone()).or_default() += held.len();
    }
    let mut out = Vec::new();
    for (owner, count) in by_owner {
        let path = register_path(&owner_root(a, &owner));
        if committed.iter().any(|one| **one == path) {
            continue;
        }
        out.push(Remaining {
            at: Location::new(path, ByteSpan::new(0, 0), 0, 0),
            note: format!(
                "the register of {} presents {count} covered assets of {} and is not committed",
                owner.as_str(),
                profile.id.as_str()
            ),
        });
    }
    out
}

/// Every covered asset of one registered profile that does not carry its
/// derived label at the asset itself.
///
/// Status is not consulted, exactly as [`census`] does not consult it: a
/// migration lands while its profile is still staged, and the same question
/// asked of a profile in force answers with what the inventory clause would
/// report. A profile whose standard place is a generated register has none of
/// these, because its labels are not carried at an asset at all.
///
/// The order is the census's own — by source path, then by the position each
/// definition occupies in it (´[ARCH-req:linter:determinism]´).
///
/// ```no_run
/// use cogra_linter::{ProfileId, migrate};
/// use std::path::Path;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let root = Path::new(".");
/// let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
///
/// for one in migrate::unplaced(&adoption, root, &ProfileId::new("rust-module"))? {
///     println!("{} owes {}", one.source.display(), one.label.as_str());
/// }
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// [`RunError::Walk`] when `root` is not a directory, exactly as [`census`]
/// and [`distances`] report it.
pub fn unplaced(a: &Adoption, root: &Path, profile: &ProfileId) -> Result<Vec<Unplaced>, RunError> {
    if !root.is_dir() {
        return Err(RunError::Walk(WalkError::NotADirectory {
            path: root.to_path_buf(),
        }));
    }
    let sources = match Walk::new(a, root).sources() {
        Ok(sources) => sources,
        Err(outcome) => outcome.sources,
    };
    let Some(registered) = a.profiles.profiles.iter().find(|one| one.id == *profile) else {
        return Ok(Vec::new());
    };
    if registered.standard_place.register.is_some() {
        return Ok(Vec::new());
    }
    let census = census_of(a, registered, &sources);
    let mut out: Vec<Unplaced> = census
        .iter()
        .flat_map(|(src, held)| unplaced_in(a, registered, src, held))
        .collect();
    out.sort_by(|one, other| {
        one.source
            .cmp(&other.source)
            .then(one.opens.cmp(&other.opens))
    });
    Ok(out)
}

/// The assets a comment-placed profile still waits on, each located at its
/// own definition.
fn comments_missing(
    a: &Adoption,
    profile: &Profile,
    census: &[(&SourceFile, Vec<Asset>)],
) -> Vec<Remaining> {
    census
        .iter()
        .flat_map(|(src, held)| unplaced_in(a, profile, src, held))
        .map(|one| Remaining {
            note: format!(
                "this definition carries no inner documentation comment minting {}",
                one.label.as_str()
            ),
            at: one.at,
        })
        .collect()
}

/// One source's share of them, off one parse of it.
///
/// The recognizer is the standard place's own form: a mint of the derived
/// label inside an inner documentation comment of this source. That the
/// comment opens the definition's own body is not checked, which is what the
/// measurement says of itself and what the harvest's warrant says of the same
/// place (´dec:lint:migrations-subcommand´).
fn unplaced_in(a: &Adoption, profile: &Profile, src: &SourceFile, held: &[Asset]) -> Vec<Unplaced> {
    let Ok(text) = std::str::from_utf8(&src.bytes) else {
        return Vec::new();
    };
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    let Ok(parsed) = frontend_rust::parse(src, &pre, a) else {
        return Vec::new();
    };
    let carried: Vec<String> = parsed
        .regions
        .iter()
        .filter(|region| {
            matches!(
                region.kind,
                crate::frontend::RegionKind::Comment(
                    CommentForm::LineInnerDoc | CommentForm::BlockInnerDoc
                )
            )
        })
        .flat_map(|region| scan_code(&region.text, 0).occurrences)
        .filter_map(|occurrence| match occurrence {
            Occurrence::Mint { label, .. } => Some(label.as_str().to_owned()),
            _ => None,
        })
        .collect();
    let opens: Vec<usize> = pre
        .comments()
        .filter(|(_, form)| matches!(form, CommentForm::LineInnerDoc | CommentForm::BlockInnerDoc))
        .map(|(span, _)| span.start)
        .collect();

    let mut out = Vec::new();
    for asset in held {
        let Some(label) = derived_label(profile, &asset.identifier, &asset.area) else {
            continue;
        };
        if carried.iter().any(|one| *one == label.as_str()) {
            continue;
        }
        out.push(Unplaced {
            source: src.path.clone(),
            at: Location::in_source(src.path.clone(), asset.span, text),
            opens: asset.opens,
            documented: opens
                .iter()
                .any(|start| blank_between(text, asset.opens, *start)),
            label,
        });
    }
    out
}

/// Whether nothing but whitespace separates two offsets of one source.
///
/// What decides that a comment opens *at* a position rather than somewhere
/// after it, and so whether a label line joins that comment or starts one of
/// its own. The comment's own start is the lexer's answer and not the parsed
/// region's: a region begins at the comment's interior, past a leader the
/// frontend resolved away, and a writer that took the interior for the comment
/// would find `//! ` between them and call the two apart.
fn blank_between(text: &str, from: usize, to: usize) -> bool {
    to >= from && text.get(from..to).is_some_and(|gap| gap.trim().is_empty())
}

/// What a staged profile records itself as waiting on.
fn enters_when(profile: &Profile) -> Box<str> {
    match &profile.status {
        ProfileStatus::Staged { enters_when } => enters_when.clone(),
        ProfileStatus::Effective => Box::from(""),
    }
}
