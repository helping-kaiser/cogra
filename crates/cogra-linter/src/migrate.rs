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

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::adopt::{Adoption, Kind, OwnerId, Profile, ProfileId, ProfileStatus};
use crate::carrier::{SourceFile, Walk};
use crate::diag::{ByteSpan, Location};
use crate::error::{RunError, WalkError};
use crate::frontend::Asset;
use crate::frontend_rust::{self, CargoTarget};
use crate::pretokenize::rust::RUST;
use crate::pretokenize::{CommentForm, pretokenize};
use crate::registers::{derived_label, owner_root, register_path};
use crate::scan::{Occurrence, scan_code};

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

/// Measure every staged profile's remaining distance.
///
/// `only` restricts the measurement to one registered profile. A profile
/// that is not staged is not measured: an effective profile's distance is
/// zero by the inventory judgment that already runs over it.
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

/// One profile's census, by the source each asset sits in.
///
/// The censuses are computed here and nowhere else in the run, which is what
/// keeps the check's pass honest (´dec:lint:staged-profiles´).
fn census_of<'s>(
    a: &Adoption,
    profile: &Profile,
    sources: &'s [SourceFile],
) -> Vec<(&'s SourceFile, Vec<Asset>)> {
    let mut out = Vec::new();
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
            out.push((src, held));
        }
    }
    out
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

/// The assets a comment-placed profile still waits on, each located at its
/// own definition.
fn comments_missing(
    a: &Adoption,
    profile: &Profile,
    census: &[(&SourceFile, Vec<Asset>)],
) -> Vec<Remaining> {
    let mut out = Vec::new();
    for (src, held) in census {
        let carried = carried_by(src, a);
        let Ok(text) = std::str::from_utf8(&src.bytes) else {
            continue;
        };
        for asset in held {
            let Some(label) = derived_label(profile, &asset.identifier, &asset.area) else {
                continue;
            };
            if carried.iter().any(|one| *one == label.as_str()) {
                continue;
            }
            out.push(Remaining {
                at: Location::in_source(src.path.clone(), asset.span, text),
                note: format!(
                    "this definition carries no inner documentation comment minting {}",
                    label.as_str()
                ),
            });
        }
    }
    out
}

/// Every label one source mints inside an inner documentation comment.
fn carried_by(src: &SourceFile, a: &Adoption) -> Vec<String> {
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    let Ok(parsed) = frontend_rust::parse(src, &pre, a) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for region in &parsed.regions {
        if !matches!(
            region.kind,
            crate::frontend::RegionKind::Comment(CommentForm::LineInnerDoc)
                | crate::frontend::RegionKind::Comment(CommentForm::BlockInnerDoc)
        ) {
            continue;
        }
        for occurrence in scan_code(&region.text, 0).occurrences {
            if let Occurrence::Mint { label, .. } = occurrence {
                out.push(label.as_str().to_owned());
            }
        }
    }
    out
}

/// What a staged profile records itself as waiting on.
fn enters_when(profile: &Profile) -> Box<str> {
    match &profile.status {
        ProfileStatus::Staged { enters_when } => enters_when.clone(),
        ProfileStatus::Effective => Box::from(""),
    }
}
