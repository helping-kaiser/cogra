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
use crate::frontend_rust::{self, CargoTarget, Declaration};
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
/// The censuses are computed here and nowhere else in the run, which is what
/// keeps the check's pass honest (´dec:lint:staged-profiles´).
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
    for (src, identifier) in backing_files(profile, sources, &declared) {
        let held = &mut out.entry(&src.path).or_insert((src, Vec::new())).1;
        if held.iter().any(|one| one.identifier == identifier) {
            continue;
        }
        if let Some(asset) = definition(profile, &identifier) {
            held.push(asset);
        }
    }
    out.into_values().collect()
}

/// The sources that back the corpus's `mod name;` declarations, each once.
///
/// This is the pairing no frontend can make: a declaration and its
/// definition sit in different files, and a frontend is handed one source at
/// a time, which is why [`Declaration`] travels out of it unresolved. The
/// measurement is the run that holds every source, so the pairing is made
/// here — once per definition, never per declaration, which is what keeps
/// the nine `mod rig;` declarations of one tree one asset rather than nine
/// (`[profiles]`).
///
/// Cargo's own module layout is the rule: a declaration in a crate root or a
/// `mod.rs` is backed from that file's own directory, and one in any other
/// module file from the directory named after it. A declaration whose
/// backing file is not in the carrier pairs with nothing and contributes no
/// asset, rather than an asset pointing at a file the walk never saw.
fn backing_files<'s>(
    profile: &Profile,
    sources: &'s [SourceFile],
    declared: &[(&Path, Declaration)],
) -> Vec<(&'s SourceFile, String)> {
    if profile.census.definition_rule.is_none() {
        return Vec::new();
    }
    let by_path: BTreeMap<&Path, &SourceFile> = sources
        .iter()
        .map(|one| (one.path.as_path(), one))
        .collect();
    let mut out: BTreeMap<&Path, (&SourceFile, String)> = BTreeMap::new();
    for (declaring, one) in declared {
        for candidate in candidates(declaring, &one.identifier) {
            if let Some(src) = by_path.get(candidate.as_path()) {
                out.entry(&src.path)
                    .or_insert((*src, one.identifier.clone()));
                break;
            }
        }
    }
    out.into_values().collect()
}

/// The two files a declaration in `declaring` could be backed by.
fn candidates(declaring: &Path, name: &str) -> [PathBuf; 2] {
    let parent = declaring.parent().unwrap_or(Path::new(""));
    let root = matches!(
        declaring.file_stem().and_then(std::ffi::OsStr::to_str),
        Some("lib" | "main" | "mod")
    );
    let dir = if root {
        parent.to_path_buf()
    } else {
        match declaring.file_stem().and_then(std::ffi::OsStr::to_str) {
            Some(stem) => parent.join(stem),
            None => parent.to_path_buf(),
        }
    };
    [
        dir.join(format!("{name}.rs")),
        dir.join(name).join("mod.rs"),
    ]
}

/// One file-backed module definition, located at the top of its own file,
/// which is where the inner documentation comment its standard place names
/// would sit.
fn definition(profile: &Profile, identifier: &str) -> Option<Asset> {
    let mut areas = profile.classification.areas.values();
    let (Some(area), None) = (areas.next(), areas.next()) else {
        return None;
    };
    Some(Asset {
        profile: profile.id.clone(),
        identifier: String::from(identifier),
        area: area.clone(),
        place: profile.standard_place.clone(),
        span: ByteSpan::new(0, 0),
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    fn spelled(declaring: &str, name: &str) -> Vec<String> {
        candidates(Path::new(declaring), name)
            .iter()
            .map(|one| one.to_string_lossy().replace('\\', "/"))
            .collect()
    }

    #[test]
    fn a_crate_root_backs_from_its_own_directory() {
        assert_eq!(
            spelled("crates/api/src/lib.rs", "auth"),
            ["crates/api/src/auth.rs", "crates/api/src/auth/mod.rs"]
        );
    }

    #[test]
    fn a_module_file_backs_from_the_directory_named_after_it() {
        assert_eq!(
            spelled("crates/api/src/auth.rs", "tokens"),
            [
                "crates/api/src/auth/tokens.rs",
                "crates/api/src/auth/tokens/mod.rs"
            ]
        );
    }

    #[test]
    fn a_mod_file_backs_from_its_own_directory_like_a_root() {
        assert_eq!(
            spelled("crates/api/tests/rig/mod.rs", "seed"),
            [
                "crates/api/tests/rig/seed.rs",
                "crates/api/tests/rig/seed/mod.rs"
            ]
        );
    }
}
