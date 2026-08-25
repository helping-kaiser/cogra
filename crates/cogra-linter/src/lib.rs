//! The corpus linter: one binary that walks the corpus — Markdown prose and
//! compiled-platform source — and mechanically discharges the checkable
//! obligations of the four discipline documents.
//!
//! The phase artifacts live in this crate's docs folder: concept.md and
//! design.md, both ratified. The module map, the public API of every slice,
//! and the implementation gate are the design's; nothing here deviates from
//! it without being named in review first.

pub mod adopt;
pub mod bans;
pub mod carrier;
pub mod diag;
pub mod error;
pub mod frontend;
pub mod frontend_md;
pub mod frontend_rust;
pub mod graph;
pub mod judge;
pub mod pretokenize;
pub mod scan;
pub mod timing;

pub use adopt::{
    Adoption, Area, BannedToken, BannedTokens, Carrier, Census, CitationIndexes, Classification,
    EnforcementPartition, HeadForm, HeadMatching, HeadRecognition, HeadlessLanguages, Kind,
    KindEvidence, KindExtensions, KindGenerator, KindRegister, KindStatuses, KindsAdoption,
    Language, Meta, NameTransformation, OwnerId, Partition, PartitionRule, PathPrefix, Place,
    PrefixFamily, Profile, ProfileId, ProfileStatus, Profiles, ReservedKinds, ScannedLanguage,
    ScannedRegions, Signature, TypedData, UnscannedLanguages,
};
pub use bans::BanRule;
pub use carrier::{SourceFile, Walk, WalkOutcome};
pub use diag::{ByteSpan, Diagnostic, Enforcement, Location, Related, RuleId, Severity};
pub use error::{AdoptionError, GenerateError, RunError, WalkError};
pub use frontend::{Asset, Head, Parsed, Region, RegionKind, Table};
pub use frontend_rust::{CargoTarget, Censuses, Declaration};
pub use graph::{
    Corpus, EdgeW, NodeKind, NodeW, Registries, degree_along, edge_view, in_along, nodes_of,
    out_along, owner_of, owner_view, source_of,
};
pub use judge::kinds::{
    Device, DeviceFamily, HeadVerdict, HeadlineCounts, KindRegistry, Reduced, Reduction,
};
pub use pretokenize::{CommentForm, LexClass, Lexeme, LiteralForm, PreTokenized, pretokenize};
pub use scan::{
    DelimitedSpan, Delimiter, DelimiterFailure, Expectation, Label, LabelSyntax, NearMiss,
    NearMissKind, Occurrence, Prefix, RegionScan, Syntax, scan_code, scan_prose,
};
pub use timing::{Phase, Timing};
