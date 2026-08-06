// Transport encodings for the handshake objects that cross the API
// (reference: crates/common/src/l1/wire.rs) — the prepared proposal the
// device signs (`canonicalProposal`), the sealed verified act it
// approves (`verifiedAct`), and the pre-commitment blob it submits (the
// opaque `signature` input). The wire form is versioned CBOR over the
// same deterministic subset as the signing bases; the structural body
// travels as its exact canonical bytes, so what the device parses is
// what it signs.

import { CborDecodeError, CborDecoder, CborEncoder } from "./cbor";
import { ActId, IdentifierError, NodeId } from "./identifiers";
import { canonicalDeps, Proposal, StructuralBody, VerifiedAct } from "./handshake";

/** A wire blob that does not parse. */
export class WireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WireError";
  }
}

/** The wire format version every envelope opens with. */
const WIRE_VERSION = 1n;

/** The device's pre-commitment leg: nonce plus pre-commitment signature. */
export class PreCommitment {
  constructor(
    readonly nonce: Uint8Array,
    readonly preSignature: Uint8Array,
  ) {}
}

function wrapMalformed(e: unknown, what: string): never {
  if (e instanceof CborDecodeError || e instanceof IdentifierError) {
    throw new WireError(`malformed ${what}: ${e.message}`);
  }
  throw e;
}

function decodeBody(bytes: Uint8Array): StructuralBody {
  const d = new CborDecoder(bytes);
  try {
    if (d.array() !== 9n) throw new WireError("malformed structural body");
    const actId = ActId.parse(d.text());
    const middleText = d.textOrNull();
    const middle = middleText === null ? null : NodeId.parse(middleText);
    const target = NodeId.parse(d.text());
    const pD = d.float();
    const pI = d.float();
    const settlementText = d.textOrNull();
    const settlementRef = settlementText === null ? null : ActId.parse(settlementText);
    const license = d.textOrNull();
    const n = d.array();
    const assertedParents: ActId[] = [];
    for (let i = 0n; i < n; i++) assertedParents.push(ActId.parse(d.text()));
    if (d.uint() !== 1n) throw new WireError("malformed structural body version");
    d.finish();
    return new StructuralBody({
      author: actId.author,
      seq: actId.seq,
      family: actId.family,
      middle,
      target,
      pD,
      pI,
      settlementRef,
      license,
      assertedParents,
    });
  } catch (e) {
    wrapMalformed(e, "structural body");
  }
}

function encodeDeps(e: CborEncoder, deps: readonly ActId[]): void {
  e.array(BigInt(deps.length));
  for (const dep of deps) e.text(dep.toString());
}

function decodeDeps(d: CborDecoder): ActId[] {
  const n = d.array();
  const deps: ActId[] = [];
  for (let i = 0n; i < n; i++) deps.push(ActId.parse(d.text()));
  return deps;
}

/** The prepared proposal, as `PreparedWrite.canonicalProposal` carries it. */
export function encodeProposal(p: Proposal): Uint8Array<ArrayBuffer> {
  const e = new CborEncoder();
  e.array(4n);
  e.uint(WIRE_VERSION);
  e.bytes(p.body.canonicalBytes());
  e.bytes(p.payload);
  encodeDeps(e, p.deps);
  return e.finish();
}

export function decodeProposal(bytes: Uint8Array): Proposal {
  const d = new CborDecoder(bytes);
  try {
    if (d.array() !== 4n) throw new WireError("malformed proposal");
    const version = d.uint();
    if (version !== WIRE_VERSION) throw new WireError(`unsupported wire version ${version}`);
    const body = decodeBody(d.bytes());
    const payload = d.bytes();
    const deps = decodeDeps(d);
    d.finish();
    return new Proposal(body, payload, deps);
  } catch (e) {
    wrapMalformed(e, "proposal");
  }
}

/**
 * The host-sealed verified act, as `StagedWrite.verifiedAct` carries it
 * — every host-added field visible to the device before approval.
 */
export function encodeVerifiedAct(act: VerifiedAct): Uint8Array<ArrayBuffer> {
  const e = new CborEncoder();
  e.array(12n);
  e.uint(WIRE_VERSION);
  e.bytes(act.proposal.body.canonicalBytes());
  e.bytes(act.proposal.payload);
  encodeDeps(e, act.proposal.deps);
  e.bytes(act.authorPubkey);
  e.bytes(act.nonce);
  e.bytes(act.preSignature);
  e.bytes(act.contentSalt);
  e.bytes(act.depsSalt);
  e.bytes(act.contentCommitment);
  e.bytes(act.depsCommitment);
  e.bytes(act.hostSeal);
  return e.finish();
}

export function decodeVerifiedAct(bytes: Uint8Array): VerifiedAct {
  const d = new CborDecoder(bytes);
  try {
    if (d.array() !== 12n) throw new WireError("malformed verified act");
    const version = d.uint();
    if (version !== WIRE_VERSION) throw new WireError(`unsupported wire version ${version}`);
    const body = decodeBody(d.bytes());
    const payload = d.bytes();
    const deps = decodeDeps(d);
    const act = new VerifiedAct({
      proposal: new Proposal(body, payload, deps),
      authorPubkey: d.bytes(),
      nonce: d.bytes(),
      preSignature: d.bytes(),
      contentSalt: d.bytes(),
      depsSalt: d.bytes(),
      contentCommitment: d.bytes(),
      depsCommitment: d.bytes(),
      hostSeal: d.bytes(),
    });
    d.finish();
    return act;
  } catch (e) {
    wrapMalformed(e, "verified act");
  }
}

/**
 * The device's pre-commitment leg as the opaque `signature` input
 * carries it. The author's public key never rides the wire — the
 * backend binds it from the account's identity association.
 */
export function encodePreCommitment(
  nonce: Uint8Array,
  preSignature: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const e = new CborEncoder();
  e.array(3n);
  e.uint(WIRE_VERSION);
  e.bytes(nonce);
  e.bytes(preSignature);
  return e.finish();
}

/** Convenience for the device side: the pre-signed proposal's wire blob. */
export function encodePreCommitmentOf(pre: {
  nonce: Uint8Array;
  preSignature: Uint8Array;
}): Uint8Array<ArrayBuffer> {
  return encodePreCommitment(pre.nonce, pre.preSignature);
}

export function decodePreCommitment(bytes: Uint8Array): PreCommitment {
  const d = new CborDecoder(bytes);
  try {
    if (d.array() !== 3n) throw new WireError("malformed pre-commitment");
    const version = d.uint();
    if (version !== WIRE_VERSION) throw new WireError(`unsupported wire version ${version}`);
    const nonce = d.bytes();
    const signature = d.bytes();
    d.finish();
    return new PreCommitment(nonce, signature);
  } catch (e) {
    if (e instanceof CborDecodeError) {
      throw new WireError(`malformed pre-commitment: ${e.message}`);
    }
    throw e;
  }
}
