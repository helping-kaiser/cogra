//! The crate's error taxonomy.
//!
//! One test decides which surface a failure belongs to: if the input is
//! exactly the kind of thing the operation takes and the answer is
//! negative, it is a finding and travels as a [`crate::diag::Diagnostic`];
//! if the linter
//! cannot do its job at all, it is an error and travels in `Err`
//! (´crit:lint:error-or-finding´). The criterion cuts far toward findings,
//! which is why the taxonomy is this small.
//!
//! Three leaf enums and one aggregate, each `#[non_exhaustive]`, each
//! `Send + Sync + 'static`, each `Display` message lowercase and
//! unpunctuated (´sig:lint:error-taxonomy´). Every variant that can be
//! located carries the row it sits in: an unlocated complaint about a
//! thousand-line configuration file is a worse diagnostic than the linter
//! would accept from anything else.

use std::io;
use std::path::PathBuf;

use crate::diag::Location;

/// The adoption data will not load.
///
/// The one operation of the crate whose failure is an error and not a
/// finding (´sig:lint:adoption-api´).
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum AdoptionError {
    /// The file could not be read.
    #[error("cannot read the adoption data at {path}")]
    Unreadable {
        /// The path that was offered.
        path: PathBuf,
        /// What the filesystem said.
        #[source]
        source: io::Error,
    },
    /// The bytes are not well-formed TOML.
    #[error("adoption data is not well-formed TOML")]
    Syntax(#[source] toml::de::Error),
    /// A partition rule names an owner no prefix registers.
    #[error("partition rule {order} names owner {owner}, which no prefix registers")]
    UnknownOwner {
        /// The row the offending owner sits in.
        at: Location,
        /// The rule's own order.
        order: u32,
        /// The owner it names.
        owner: String,
    },
    /// One prefix is registered twice.
    #[error("prefix {prefix} is registered twice")]
    DuplicatePrefix {
        /// The row of the second registration.
        at: Location,
        /// The prefix.
        prefix: String,
    },
    /// The last partition rule does not carry the empty prefix.
    #[error("the last partition rule does not carry the empty prefix, so Ω is not total")]
    PartitionNotTotal {
        /// The row of the last rule.
        at: Location,
    },
    /// A profile is missing one of the five data a profile fixes.
    #[error("profile {id} is missing its {datum}")]
    ProfileIncomplete {
        /// The row the profile opens at.
        at: Location,
        /// The profile.
        id: String,
        /// The datum it lacks.
        datum: &'static str,
    },
    /// A profile governs a kind that is not reserved in K.
    #[error("profile {id} governs kind {kind}, which is not reserved in K")]
    UngovernedKindNotReserved {
        /// The row the kind sits in.
        at: Location,
        /// The profile.
        id: String,
        /// The kind it governs.
        kind: String,
    },
    /// The stated effective-profile count disagrees with the file.
    #[error("the effective profile count {stated} disagrees with the {found} profiles not staged")]
    EffectiveCountMismatch {
        /// The row the count sits in.
        at: Location,
        /// What the file states.
        stated: usize,
        /// What the file's own profiles say.
        found: usize,
    },
}

impl AdoptionError {
    /// The row this defect sits in, where the defect has one.
    ///
    /// A malformed file and an unreadable one have no row: the first is
    /// located by its own parser's message, the second nowhere.
    #[must_use]
    pub fn at(&self) -> Option<&Location> {
        match self {
            AdoptionError::Unreadable { .. } | AdoptionError::Syntax(_) => None,
            AdoptionError::UnknownOwner { at, .. }
            | AdoptionError::DuplicatePrefix { at, .. }
            | AdoptionError::PartitionNotTotal { at }
            | AdoptionError::ProfileIncomplete { at, .. }
            | AdoptionError::UngovernedKindNotReserved { at, .. }
            | AdoptionError::EffectiveCountMismatch { at, .. } => Some(at),
        }
    }
}

/// The corpus root is unusable.
///
/// An unreadable *tree* is a finding, reported beside a shorter source list
/// (´conv:lint:owner-assignment´); only a root that is no directory at all
/// stops the run.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum WalkError {
    /// The root names something that is not a directory.
    #[error("corpus root {path} is not a directory")]
    NotADirectory {
        /// The root that was offered.
        path: PathBuf,
    },
}

/// A write in the regeneration mode failed.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum GenerateError {
    /// The register could not be written.
    #[error("cannot write the register at {path}")]
    Write {
        /// The register's path.
        path: PathBuf,
        /// What the filesystem said.
        #[source]
        source: io::Error,
    },
    /// A generated region has no host span to splice into.
    #[error("the generated region at {path} has no host span to splice into")]
    MissingHostRegion {
        /// The host file.
        path: PathBuf,
    },
}

/// One error type for a consumer that wants one.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum RunError {
    /// The adoption data will not load.
    #[error(transparent)]
    Adoption(#[from] AdoptionError),
    /// The corpus root is unusable.
    #[error(transparent)]
    Walk(#[from] WalkError),
    /// A register could not be written.
    #[error(transparent)]
    Generate(#[from] GenerateError),
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diag::ByteSpan;

    fn row() -> Location {
        Location::new(
            PathBuf::from("corpus-adoption.toml"),
            ByteSpan::new(0, 1),
            7,
            3,
        )
    }

    #[test]
    fn every_message_is_lowercase_and_unpunctuated() {
        let errors: Vec<AdoptionError> = vec![
            AdoptionError::UnknownOwner {
                at: row(),
                order: 3,
                owner: String::from("pkg.nowhere"),
            },
            AdoptionError::DuplicatePrefix {
                at: row(),
                prefix: String::from("LBL"),
            },
            AdoptionError::PartitionNotTotal { at: row() },
            AdoptionError::ProfileIncomplete {
                at: row(),
                id: String::from("rust-test"),
                datum: "census",
            },
            AdoptionError::UngovernedKindNotReserved {
                at: row(),
                id: String::from("rust-test"),
                kind: String::from("test"),
            },
            AdoptionError::EffectiveCountMismatch {
                at: row(),
                stated: 1,
                found: 0,
            },
        ];
        for error in &errors {
            let message = error.to_string();
            assert!(!message.ends_with('.'), "punctuated: {message}");
            let first = message.chars().next().unwrap_or(' ');
            assert!(!first.is_uppercase(), "capitalized: {message}");
        }
    }

    #[test]
    fn every_locatable_variant_carries_its_row() {
        let error = AdoptionError::PartitionNotTotal { at: row() };
        assert_eq!(error.at().map(|at| at.line), Some(7));
    }

    #[test]
    fn an_unlocatable_variant_says_so() {
        let error = AdoptionError::Unreadable {
            path: PathBuf::from("nowhere.toml"),
            source: io::Error::from(io::ErrorKind::NotFound),
        };
        assert!(error.at().is_none());
    }

    #[test]
    fn the_aggregate_takes_every_leaf() {
        let run: RunError = WalkError::NotADirectory {
            path: PathBuf::from("README.md"),
        }
        .into();
        assert_eq!(run.to_string(), "corpus root README.md is not a directory");
    }
}
