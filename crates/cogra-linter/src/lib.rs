//! The corpus linter: one binary that walks the corpus — Markdown prose and
//! compiled-platform source — and mechanically discharges the checkable
//! obligations of the four discipline documents.
//!
//! The phase artifacts live in this crate's docs folder: concept.md and
//! design.md, both ratified. The module map, the public API of every slice,
//! and the implementation gate are the design's; nothing here deviates from
//! it without being named in review first.
