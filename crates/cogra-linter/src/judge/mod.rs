//! The judgment surface: every invariant as one free function over the
//! graph.
//!
//! A judgment never mutates the graph and never consults a later stage's
//! output (´sig:lint:judgment-api´); its answer is a list of diagnostics and
//! an empty list is the positive answer (´conv:lint:finding-or-error´).
//!
//! The judgments themselves land with slice 5. What stands here now is the
//! kind registry, which the head-validation judgment will consume and which
//! slice 3 delivers because it is read out of the registry document by the
//! Markdown frontend (´[ARCH-dec:linter:registry-as-data]´).

pub mod kinds;
