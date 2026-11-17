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
import { Proposal, SealedAct, StructuralBody, VerifiedAct } from "./handshake";

/** A wire blob that does not parse. */
export class WireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WireError";
  }
}

/** The wire format version of the prepared-proposal envelope. */
const WIRE_VERSION = 1n;

/**
 * The wire format version of the two handshake envelopes — the
 * pre-commitment blob and the sealed act (reference:
 * crates/common/src/l1/proposal/transport.rs).
 */
const HANDSHAKE_WIRE_VERSION = 2n;

/**
 * Opens a handshake envelope: the version is judged before the arity, so a
 * frame of another version is refused as that version rather than as a
 * malformed frame — the reference's order.
 */
function openHandshake(d: CborDecoder, arity: bigint, what: string): void {
  const n = d.array();
  const version = d.uint();
  if (version !== HANDSHAKE_WIRE_VERSION) throw new WireError(`unsupported wire version ${version}`);
  if (n !== arity) throw new WireError(`malformed ${what}`);
}

/** The device's pre-commitment leg: both nonces plus the pre-commitment signature. */
export class PreCommitment {
  constructor(
    readonly contentNonce: Uint8Array,
    readonly dependencyNonce: Uint8Array,
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
 * The sealed act, as `StagedWrite.verifiedAct` carries it — every
 * host-added field visible to the device before approval: `[2, body, P,
 * pre-signature, C_c, C_d, content edition, dependency edition, content
 * salt, dependency salt, seal]`. It carries no payload, no nonce and no
 * dependency list: the device holds those itself.
 */
export function encodeVerifiedAct(sealed: SealedAct): Uint8Array<ArrayBuffer> {
  const act = sealed.act;
  const e = new CborEncoder();
  e.array(11n);
  e.uint(HANDSHAKE_WIRE_VERSION);
  e.bytes(act.body.canonicalBytes());
  e.bytes(act.preCommitment);
  e.bytes(act.preSignature);
  e.bytes(act.contentCommitment);
  e.bytes(act.depsCommitment);
  e.uint(act.contentEdition);
  e.uint(act.depsEdition);
  e.bytes(sealed.contentSalt);
  e.bytes(sealed.depsSalt);
  e.bytes(sealed.hostSeal);
  return e.finish();
}

export function decodeVerifiedAct(bytes: Uint8Array): SealedAct {
  const d = new CborDecoder(bytes);
  try {
    openHandshake(d, 11n, "verified act");
    const act = new VerifiedAct({
      body: decodeBody(d.bytes()),
      preCommitment: d.bytes(),
      preSignature: d.bytes(),
      contentCommitment: d.bytes(),
      depsCommitment: d.bytes(),
      contentEdition: d.uint(),
      depsEdition: d.uint(),
    });
    const sealed = new SealedAct({
      act,
      contentSalt: d.bytes(),
      depsSalt: d.bytes(),
      hostSeal: d.bytes(),
    });
    d.finish();
    return sealed;
  } catch (e) {
    wrapMalformed(e, "verified act");
  }
}

/**
 * The device's pre-commitment leg as the opaque `signature` input
 * carries it: `[2, content nonce, dependency nonce, pre-signature]`. The
 * author's public key never rides the wire — the backend binds it from
 * the account's identity association.
 */
export function encodePreCommitment(
  contentNonce: Uint8Array,
  dependencyNonce: Uint8Array,
  preSignature: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const e = new CborEncoder();
  e.array(4n);
  e.uint(HANDSHAKE_WIRE_VERSION);
  e.bytes(contentNonce);
  e.bytes(dependencyNonce);
  e.bytes(preSignature);
  return e.finish();
}

/** Convenience for the device side: the pre-signed proposal's wire blob. */
export function encodePreCommitmentOf(pre: {
  contentNonce: Uint8Array;
  dependencyNonce: Uint8Array;
  preSignature: Uint8Array;
}): Uint8Array<ArrayBuffer> {
  return encodePreCommitment(pre.contentNonce, pre.dependencyNonce, pre.preSignature);
}

export function decodePreCommitment(bytes: Uint8Array): PreCommitment {
  const d = new CborDecoder(bytes);
  try {
    openHandshake(d, 4n, "pre-commitment");
    const contentNonce = d.bytes();
    const dependencyNonce = d.bytes();
    const signature = d.bytes();
    d.finish();
    return new PreCommitment(contentNonce, dependencyNonce, signature);
  } catch (e) {
    wrapMalformed(e, "pre-commitment");
  }
}
