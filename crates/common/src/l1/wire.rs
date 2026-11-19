//! ´mod:module:wire´
//!
//! The transport encoding of the prepared proposal the device signs
//! (api-spec.md "The write flow": `canonicalProposal`), and the wire error
//! every handshake envelope shares; the sealed verified act and the
//! pre-commitment blob are in [`crate::l1::proposal`].
//!
//! The wire form is versioned CBOR over the same deterministic subset as the
//! signing bases; the structural body travels as its exact canonical bytes,
//! so what the device parses is what it signs.
//!
//! No container here pre-allocates from its declared length: a CBOR array
//! head is attacker-controlled and the elements behind it are not, so the
//! allocation is grown on real items and bounded by the bytes actually
//! present — the same rule [`crate::envelope`] states for the envelope
//! decoder.

use super::encoding::{DecodeError, Decoder, Encoder};
use super::handshake::{Proposal, StructuralBody};
use super::identifier::{ActId, IdentifierError, NodeId};

/// The wire format version every envelope opens with.
const WIRE_VERSION: u64 = 1;

#[derive(Debug, thiserror::Error)]
pub enum WireError {
    #[error(transparent)]
    Decode(#[from] DecodeError),
    #[error(transparent)]
    Identifier(#[from] IdentifierError),
    #[error("unsupported wire version {0}")]
    Version(u64),
    #[error("malformed {0}")]
    Shape(&'static str),
}

pub(super) fn decode_body(bytes: &[u8]) -> Result<StructuralBody, WireError> {
    let mut d = Decoder::new(bytes);
    if d.array()? != 9 {
        return Err(WireError::Shape("structural body"));
    }
    let act_id = ActId::parse(&d.text()?)?;
    let middle = d.text_or_null()?.map(|s| NodeId::parse(&s)).transpose()?;
    let target = NodeId::parse(&d.text()?)?;
    let p_d = d.float()?;
    let p_i = d.float()?;
    let settlement_ref = d.text_or_null()?.map(|s| ActId::parse(&s)).transpose()?;
    let license = d.text_or_null()?;
    let n = d.array()?;
    let mut asserted_parents = Vec::new();
    for _ in 0..n {
        asserted_parents.push(ActId::parse(&d.text()?)?);
    }
    if d.uint()? != 1 {
        return Err(WireError::Shape("structural body version"));
    }
    d.finish()?;
    Ok(StructuralBody {
        author: act_id.author,
        seq: act_id.seq,
        family: act_id.family,
        middle,
        target,
        p_d,
        p_i,
        settlement_ref,
        license,
        asserted_parents,
    })
}

fn encode_deps(e: &mut Encoder, deps: &[ActId]) {
    e.array(deps.len() as u64);
    for dep in deps {
        e.text(&dep.to_string());
    }
}

fn decode_deps(d: &mut Decoder) -> Result<Vec<ActId>, WireError> {
    let n = d.array()?;
    let mut deps = Vec::new();
    for _ in 0..n {
        deps.push(ActId::parse(&d.text()?)?);
    }
    Ok(deps)
}

/// The prepared proposal, as `PreparedWrite.canonicalProposal` carries it.
pub fn encode_proposal(p: &Proposal) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(4);
    e.uint(WIRE_VERSION);
    e.bytes(&p.body.canonical_bytes());
    e.bytes(&p.payload);
    encode_deps(&mut e, &p.deps);
    e.finish()
}

pub fn decode_proposal(bytes: &[u8]) -> Result<Proposal, WireError> {
    let mut d = Decoder::new(bytes);
    if d.array()? != 4 {
        return Err(WireError::Shape("proposal"));
    }
    let version = d.uint()?;
    if version != WIRE_VERSION {
        return Err(WireError::Version(version));
    }
    let body = decode_body(&d.bytes()?)?;
    let payload = d.bytes()?;
    let deps = decode_deps(&mut d)?;
    d.finish()?;
    Ok(Proposal {
        body,
        payload,
        deps,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::l1::census::Family;

    fn proposal() -> Proposal {
        Proposal {
            body: StructuralBody {
                author: "alice".into(),
                seq: 7,
                family: Family::Review,
                middle: Some(NodeId::parse("mint:act:bob:1:publish").expect("ok")),
                target: NodeId::parse("prof:bob").expect("ok"),
                p_d: 0.25,
                p_i: -0.5,
                settlement_ref: Some(ActId::parse("act:bob:2:accept").expect("ok")),
                license: Some("CC-BY-4.0".into()),
                asserted_parents: vec![ActId::parse("act:bob:1:publish").expect("ok")],
            },
            payload: b"body bytes".to_vec(),
            deps: vec![ActId::parse("act:bob:1:publish").expect("ok")],
        }
    }

    /// A fully populated body and a minimal one — every optional absent —
    /// both survive the round trip.
    ///
    /// A proposal round-trips whether every optional is present or every one absent.
    /// ´claim:wire:a-proposal-round-trips-full-or-minimal´
    #[test]
    fn proposal_round_trips() {
        let p = proposal();
        assert_eq!(decode_proposal(&encode_proposal(&p)).expect("decodes"), p);
        let minimal = Proposal {
            body: StructuralBody {
                author: "a".into(),
                seq: 0,
                family: Family::Registration,
                middle: None,
                target: NodeId::parse("prof:a").expect("ok"),
                p_d: 1.0,
                p_i: 1.0,
                settlement_ref: None,
                license: None,
                asserted_parents: vec![],
            },
            payload: vec![],
            deps: vec![],
        };
        assert_eq!(
            decode_proposal(&encode_proposal(&minimal)).expect("decodes"),
            minimal
        );
    }

    /// The wire form carries the body's canonical bytes verbatim, so what travels is what was signed.
    /// ´claim:wire:the-wire-carries-the-canonical-signing-base-verbatim´
    #[test]
    fn the_wire_body_is_the_canonical_signing_base() {
        let p = proposal();
        let wire = encode_proposal(&p);
        let mut d = Decoder::new(&wire);
        assert_eq!(d.array().expect("array"), 4);
        assert_eq!(d.uint().expect("version"), WIRE_VERSION);
        assert_eq!(d.bytes().expect("body"), p.body.canonical_bytes());
    }

    /// An unsupported version, a wrong array shape, truncated input,
    /// trailing garbage, and a bad identifier inside an otherwise valid
    /// envelope each surface as their own error rather than decoding into a
    /// plausible-looking proposal.
    ///
    /// Malformed input surfaces as its own error rather than decoding into a plausible-looking proposal.
    /// ´claim:wire:malformed-input-is-refused-rather-than-misread´
    #[test]
    fn malformed_input_is_refused_not_misread() {
        let mut e = Encoder::new();
        e.array(4).uint(99).bytes(b"x").bytes(b"").array(0);
        assert!(matches!(
            decode_proposal(&e.finish()),
            Err(WireError::Version(99))
        ));
        let mut e = Encoder::new();
        e.array(2).uint(1).bytes(b"x");
        assert!(matches!(
            decode_proposal(&e.finish()),
            Err(WireError::Shape(_))
        ));
        let good = encode_proposal(&proposal());
        assert!(decode_proposal(&good[..good.len() - 3]).is_err());
        let mut padded = good.clone();
        padded.push(0x00);
        assert!(decode_proposal(&padded).is_err());
        let mut body = Encoder::new();
        body.array(9);
        body.text("not-an-act-id");
        body.null();
        body.text("prof:a");
        body.float(1.0);
        body.float(1.0);
        body.null();
        body.null();
        body.array(0);
        body.uint(1);
        let mut e = Encoder::new();
        e.array(4).uint(1).bytes(&body.finish()).bytes(b"").array(0);
        assert!(matches!(
            decode_proposal(&e.finish()),
            Err(WireError::Identifier(_))
        ));
    }
}
