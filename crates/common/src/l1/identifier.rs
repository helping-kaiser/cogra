//! ´mod:module:identifier´
//!
//! Identifier algebra (layer1-interface.md §8.1): node identifiers form the
//! inductive term algebra
//!
//! ```text
//! I ::= addr(a) | prof(a) | name(s) | mint(α)
//! ```
//!
//! with α an authored-act identifier act(author, s_q, family). Class is
//! decidable syntactically.
//!
//! The canonical text encoding below is this deployment's verbatim
//! record-identifier form — the mirror stores it unchanged (data-model.md
//! "The record mirror": the mirror never re-mints identity).

use std::fmt;

use super::census::Family;

/// The atom length bound from §8.1. Public so the L2 naming service can
/// classify an over-long name without restating the number.
pub const MAX_ATOM_BYTES: usize = 128;

/// Charset for L0 addresses and Type names inside identifiers: ASCII
/// alphanumerics plus `-`, `_`, `.`. Keeps the `:`-separated canonical text
/// encoding unambiguous and byte-equality trivial (Types are a commons
/// compared by exact byte equality — §8.1).
fn valid_atom(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= MAX_ATOM_BYTES
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.')
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum IdentifierError {
    #[error("invalid atom `{0}`: must be 1-128 chars of [A-Za-z0-9._-]")]
    InvalidAtom(String),
    #[error("unparseable identifier `{0}`")]
    Unparseable(String),
    #[error("unknown family `{0}`")]
    UnknownFamily(String),
    #[error("invalid sequence value `{0}`")]
    InvalidSequence(String),
}

/// An authored-act identifier: `act(author, s_q, family)` — chosen by the
/// actor before submission, no host-assigned component
/// (layer1-interface.md §8.1).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ActId {
    /// The author's L0 address atom (the `a` of `addr(a)`).
    pub author: String,
    /// The author-local sequence value `s_q`.
    pub seq: u64,
    pub family: Family,
}

impl ActId {
    pub fn new(author: &str, seq: u64, family: Family) -> Result<Self, IdentifierError> {
        if !valid_atom(author) {
            return Err(IdentifierError::InvalidAtom(author.to_string()));
        }
        Ok(Self {
            author: author.to_string(),
            seq,
            family,
        })
    }

    pub fn parse(s: &str) -> Result<Self, IdentifierError> {
        let rest = s
            .strip_prefix("act:")
            .ok_or_else(|| IdentifierError::Unparseable(s.to_string()))?;
        let mut parts = rest.splitn(3, ':');
        let (author, seq, family) = match (parts.next(), parts.next(), parts.next()) {
            (Some(a), Some(q), Some(f)) => (a, q, f),
            _ => return Err(IdentifierError::Unparseable(s.to_string())),
        };
        let seq: u64 = seq
            .parse()
            .map_err(|_| IdentifierError::InvalidSequence(seq.to_string()))?;
        let family =
            Family::parse(family).ok_or_else(|| IdentifierError::UnknownFamily(family.into()))?;
        Self::new(author, seq, family)
    }
}

impl fmt::Display for ActId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "act:{}:{}:{}", self.author, self.seq, self.family)
    }
}

/// A node identifier, classed by outermost constructor: grounded
/// (`addr`, `prof`), named (`name`), minted (`mint`).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum NodeId {
    /// Actor — grounded in an L0 address.
    Addr(String),
    /// Profile — the unique non-atomic grounded constructor: one atom, two
    /// identifiers (an Actor and its Profile are one anchoring).
    Prof(String),
    /// Type — a commons compared by exact byte equality; anchored vacuously.
    Name(String),
    /// Minted node — names its genesis act, never itself.
    Mint(ActId),
}

impl NodeId {
    pub fn addr(a: &str) -> Result<Self, IdentifierError> {
        if !valid_atom(a) {
            return Err(IdentifierError::InvalidAtom(a.to_string()));
        }
        Ok(NodeId::Addr(a.to_string()))
    }

    pub fn prof(a: &str) -> Result<Self, IdentifierError> {
        if !valid_atom(a) {
            return Err(IdentifierError::InvalidAtom(a.to_string()));
        }
        Ok(NodeId::Prof(a.to_string()))
    }

    pub fn name(s: &str) -> Result<Self, IdentifierError> {
        if !valid_atom(s) {
            return Err(IdentifierError::InvalidAtom(s.to_string()));
        }
        Ok(NodeId::Name(s.to_string()))
    }

    /// Active (Actor) vs passive (artifact) — layer1-interface.md §8.1.
    pub fn is_active(&self) -> bool {
        matches!(self, NodeId::Addr(_))
    }

    pub fn is_passive(&self) -> bool {
        !self.is_active()
    }

    pub fn parse(s: &str) -> Result<Self, IdentifierError> {
        if let Some(a) = s.strip_prefix("addr:") {
            return Self::addr(a);
        }
        if let Some(a) = s.strip_prefix("prof:") {
            return Self::prof(a);
        }
        if let Some(n) = s.strip_prefix("name:") {
            return Self::name(n);
        }
        if let Some(act) = s.strip_prefix("mint:") {
            return Ok(NodeId::Mint(ActId::parse(act)?));
        }
        Err(IdentifierError::Unparseable(s.to_string()))
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NodeId::Addr(a) => write!(f, "addr:{a}"),
            NodeId::Prof(a) => write!(f, "prof:{a}"),
            NodeId::Name(n) => write!(f, "name:{n}"),
            NodeId::Mint(act) => write!(f, "mint:{act}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn act_id_round_trips() {
        let id = ActId::new("alice-addr", 7, Family::Opinion).expect("valid");
        let text = id.to_string();
        assert_eq!(text, "act:alice-addr:7:opinion");
        assert_eq!(ActId::parse(&text).expect("parses"), id);
    }

    #[test]
    fn node_ids_round_trip() {
        for text in [
            "addr:alice",
            "prof:alice",
            "name:bot-defense",
            "mint:act:alice:0:publish",
        ] {
            let id = NodeId::parse(text).expect("parses");
            assert_eq!(id.to_string(), text);
        }
    }

    #[test]
    fn classes_are_syntactic() {
        assert!(NodeId::parse("addr:a").expect("ok").is_active());
        for passive in ["prof:a", "name:t", "mint:act:a:1:publish"] {
            assert!(NodeId::parse(passive).expect("ok").is_passive());
        }
    }

    #[test]
    fn invalid_atoms_rejected() {
        assert!(NodeId::addr("has space").is_err());
        assert!(NodeId::name("colon:inside").is_err());
        assert!(NodeId::addr("").is_err());
        assert!(ActId::new("ok", 1, Family::Opinion).is_ok());
    }

    #[test]
    fn unparseable_forms_rejected() {
        for bad in [
            "",
            "addr",
            "mint:notanact",
            "act:a:x:opinion",
            "act:a:1:nope",
        ] {
            assert!(NodeId::parse(bad).is_err() || ActId::parse(bad).is_err());
        }
    }
}
