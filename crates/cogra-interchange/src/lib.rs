//! First-party CBOR + CDDL library implementing the interchange
//! conventions: the deterministic data language, the envelope,
//! namespace labels, versions, theories, and acceptance.
//!
//! Governing documents: [`docs/concept.md`](../docs/concept.md)
//! (requirements, traced to the conventions) and
//! [`docs/design.md`](../docs/design.md) (ratified design, including
//! the implementation gate and slice sequencing). The normative spec
//! is the interchange-conventions document adopted with the corpus
//! disciplines.
//!
//! Slices land in design order: the CBOR core (`value`, `encode`,
//! `decode`), the envelope, the description language, then registry
//! and acceptance.
