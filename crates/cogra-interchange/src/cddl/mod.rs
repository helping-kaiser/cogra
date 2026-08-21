//! CDDL, the description language of the interchange conventions.
//!
//! The conventions adopt "CDDL (RFC 8610) entire", narrowing the operator
//! vocabulary nowhere, and the assignable fragment is structural rather
//! than lexical — so fragment membership and the key-by-key identity
//! comparison are both questions about a *whole parsed theory*. Neither is
//! answerable over a theory the crate could not parse. Parsing is
//! therefore complete even where evaluation is not
//! (`design.md`, `dec:xchg:cddl-coverage`).
//!
//! # What this module is, so far
//!
//! This is the parser front: source text in, syntax tree out, and a
//! normalized rendering of that tree back to text.
//!
//! | Module | Role |
//! |---|---|
//! | [`lex`] | tokenizer over the ABNF of RFC 8610 Appendix B |
//! | [`ast`] | the CDDL syntax tree |
//! | [`parse`] | recursive-descent parser onto [`ast`] |
//! | [`print`] | the normalized printer |
//! | [`resolve`] | the rule table, the prelude, generics, sockets |
//! | [`fragment`] | assignable-fragment membership |
//!
//! The grammar these implement is checked into the repository beside the
//! code, at `tests/corpus/rfc8610-abnf.txt`, so that a reader auditing the
//! parser against its specification does not have to leave the tree.
//!
//! Reference resolution, fragment membership, evaluation, and the public
//! `Theory` surface are the next slice (`design.md`,
//! `model:xchg:module-map`); until they land, nothing here is reachable
//! from outside the crate.

// Slice 3a builds the parser front and stops before its consumer. The
// public `Theory` surface that calls it is slice 3b, and integration
// tests cannot reach crate-private items, so every item below is
// exercised only by the `#[cfg(test)]` modules beside it until then.
// The allow is scoped to this module tree and comes off with 3b.
#![allow(dead_code)]

pub(crate) mod ast;
pub(crate) mod fragment;
pub(crate) mod lex;
pub(crate) mod parse;
pub(crate) mod print;
pub(crate) mod resolve;
