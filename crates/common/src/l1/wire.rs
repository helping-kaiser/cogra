// Transport encodings for the handshake objects that cross the API —
// the prepared proposal the device signs, the sealed verified act it
// approves, and the pre-commitment blob it submits (api-spec.md "The
// write flow": `canonicalProposal`, `verifiedAct`, and the opaque
// `signature` input). The wire form is versioned CBOR over the same
// deterministic subset as the signing bases; the structural body travels
// as its exact canonical bytes, so what the device parses is what it
// signs.

use super::encoding::{DecodeError, Decoder, Encoder};
use super::handshake::{PreSignedProposal, Proposal, StructuralBody, VerifiedAct};
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

fn decode_body(bytes: &[u8]) -> Result<StructuralBody, WireError> {
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
    let mut asserted_parents = Vec::with_capacity(n as usize);
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
    let mut deps = Vec::with_capacity(n as usize);
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

/// The host-sealed verified act, as `StagedWrite.verifiedAct` carries it —
/// every host-added field visible to the device before approval
/// (realization transparency, layer1-interface.md §8.2).
pub fn encode_verified_act(act: &VerifiedAct) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(12);
    e.uint(WIRE_VERSION);
    e.bytes(&act.proposal.body.canonical_bytes());
    e.bytes(&act.proposal.payload);
    encode_deps(&mut e, &act.proposal.deps);
    e.bytes(&act.author_pubkey);
    e.bytes(&act.nonce);
    e.bytes(&act.pre_signature);
    e.bytes(&act.content_salt);
    e.bytes(&act.deps_salt);
    e.bytes(&act.content_commitment);
    e.bytes(&act.deps_commitment);
    e.bytes(&act.host_seal);
    e.finish()
}

pub fn decode_verified_act(bytes: &[u8]) -> Result<VerifiedAct, WireError> {
    let mut d = Decoder::new(bytes);
    if d.array()? != 12 {
        return Err(WireError::Shape("verified act"));
    }
    let version = d.uint()?;
    if version != WIRE_VERSION {
        return Err(WireError::Version(version));
    }
    let body = decode_body(&d.bytes()?)?;
    let payload = d.bytes()?;
    let deps = decode_deps(&mut d)?;
    let act = VerifiedAct {
        proposal: Proposal {
            body,
            payload,
            deps,
        },
        author_pubkey: d.bytes()?,
        nonce: d.bytes()?,
        pre_signature: d.bytes()?,
        content_salt: d.bytes()?,
        deps_salt: d.bytes()?,
        content_commitment: d.bytes()?,
        deps_commitment: d.bytes()?,
        host_seal: d.bytes()?,
    };
    d.finish()?;
    Ok(act)
}

/// The device's pre-commitment leg as the opaque `signature` input
/// carries it: the private nonce under the pre-digests plus the
/// pre-commitment signature. The author's public key never rides the
/// wire — the backend binds it from the account's identity association.
pub fn encode_pre_commitment(nonce: &[u8], pre_signature: &[u8]) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(3);
    e.uint(WIRE_VERSION);
    e.bytes(nonce);
    e.bytes(pre_signature);
    e.finish()
}

pub fn decode_pre_commitment(bytes: &[u8]) -> Result<(Vec<u8>, Vec<u8>), WireError> {
    let mut d = Decoder::new(bytes);
    if d.array()? != 3 {
        return Err(WireError::Shape("pre-commitment"));
    }
    let version = d.uint()?;
    if version != WIRE_VERSION {
        return Err(WireError::Version(version));
    }
    let nonce = d.bytes()?;
    let signature = d.bytes()?;
    d.finish()?;
    Ok((nonce, signature))
}

/// Convenience for the device side: the pre-signed proposal's wire blob.
pub fn encode_pre_commitment_of(pre: &PreSignedProposal) -> Vec<u8> {
    encode_pre_commitment(&pre.nonce, &pre.pre_signature)
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

    #[test]
    fn proposal_round_trips() {
        let p = proposal();
        assert_eq!(decode_proposal(&encode_proposal(&p)).expect("decodes"), p);
        // A minimal body (every optional absent) round-trips too.
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

    #[test]
    fn the_wire_body_is_the_canonical_signing_base() {
        let p = proposal();
        let wire = encode_proposal(&p);
        let mut d = Decoder::new(&wire);
        assert_eq!(d.array().expect("array"), 4);
        assert_eq!(d.uint().expect("version"), WIRE_VERSION);
        assert_eq!(d.bytes().expect("body"), p.body.canonical_bytes());
    }

    #[test]
    fn verified_act_round_trips() {
        let act = VerifiedAct {
            proposal: proposal(),
            author_pubkey: vec![1; 32],
            nonce: vec![2; 32],
            pre_signature: vec![3; 64],
            content_salt: vec![4; 32],
            deps_salt: vec![5; 32],
            content_commitment: vec![6; 32],
            deps_commitment: vec![7; 32],
            host_seal: vec![8; 64],
        };
        assert_eq!(
            decode_verified_act(&encode_verified_act(&act)).expect("decodes"),
            act
        );
    }

    #[test]
    fn pre_commitment_round_trips() {
        let blob = encode_pre_commitment(&[9; 32], &[7; 64]);
        let (nonce, sig) = decode_pre_commitment(&blob).expect("decodes");
        assert_eq!(nonce, vec![9; 32]);
        assert_eq!(sig, vec![7; 64]);
    }

    #[test]
    fn malformed_input_is_refused_not_misread() {
        // Wrong version.
        let mut e = Encoder::new();
        e.array(4).uint(99).bytes(b"x").bytes(b"").array(0);
        assert!(matches!(
            decode_proposal(&e.finish()),
            Err(WireError::Version(99))
        ));
        // Wrong shape.
        let mut e = Encoder::new();
        e.array(2).uint(1).bytes(b"x");
        assert!(matches!(
            decode_proposal(&e.finish()),
            Err(WireError::Shape(_))
        ));
        // Truncated input.
        let good = encode_proposal(&proposal());
        assert!(decode_proposal(&good[..good.len() - 3]).is_err());
        // Trailing garbage.
        let mut padded = good.clone();
        padded.push(0x00);
        assert!(decode_proposal(&padded).is_err());
        // A bad identifier inside an otherwise valid envelope.
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
