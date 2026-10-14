// The admission-handshake objects the device signs (reference:
// crates/common/src/l1/handshake.rs; Android mirror: Handshake.kt). The
// structural body's canonical bytes are the signing base of the
// pre-commitment and, with the host additions, of the seal and approval.

import { equalBytes } from "./bytes";
import { CborEncoder } from "./cbor";
import { commitment, preDigest, sha256Tagged, Tags } from "./hashing";
import { ActId, type Family, type NodeId } from "./identifiers";

/**
 * The canonical structural body of a proposal — everything the actor
 * authors: identity fields, incidence, the family parameter tuple,
 * public protocol references, and asserted causal parents. Payload
 * bytes and the dependency list are the two removable projections and
 * ride beside the body, never inside it.
 */
export class StructuralBody {
  /** The author's address atom. */
  readonly author: string;
  /** The author-local sequence value s_q. */
  readonly seq: bigint;
  readonly family: Family;
  /** Middle node for hyper-edge families; null for binary. */
  readonly middle: NodeId | null;
  /** Semantic target: the binary target, or the hyper T-leg terminal. */
  readonly target: NodeId;
  /** The act's family parameter tuple. */
  readonly pD: number;
  readonly pI: number;
  readonly settlementRef: ActId | null;
  readonly license: string | null;
  /** Asserted causal parents. */
  readonly assertedParents: readonly ActId[];

  constructor(fields: {
    author: string;
    seq: bigint;
    family: Family;
    middle: NodeId | null;
    target: NodeId;
    pD: number;
    pI: number;
    settlementRef: ActId | null;
    license: string | null;
    assertedParents: readonly ActId[];
  }) {
    this.author = fields.author;
    this.seq = fields.seq;
    this.family = fields.family;
    this.middle = fields.middle;
    this.target = fields.target;
    this.pD = fields.pD;
    this.pI = fields.pI;
    this.settlementRef = fields.settlementRef;
    this.license = fields.license;
    this.assertedParents = fields.assertedParents;
  }

  actId(): ActId {
    return new ActId(this.author, this.seq, this.family);
  }

  /**
   * Canonical bytes: byte-identical to the Rust reference — the golden
   * vectors pin the layout.
   */
  canonicalBytes(): Uint8Array<ArrayBuffer> {
    const e = new CborEncoder();
    e.array(9n);
    e.text(this.actId().toString());
    if (this.middle !== null) e.text(this.middle.toString());
    else e.nul();
    e.text(this.target.toString());
    e.float(this.pD);
    e.float(this.pI);
    if (this.settlementRef !== null) e.text(this.settlementRef.toString());
    else e.nul();
    if (this.license !== null) e.text(this.license);
    else e.nul();
    e.array(BigInt(this.assertedParents.length));
    for (const p of this.assertedParents) e.text(p.toString());
    // Trailing schema version for forward evolution of the body shape.
    e.uint(1n);
    return e.finish();
  }
}

/** Canonical encoding of the dependency list — the dependency projection's bytes. */
export function canonicalDeps(deps: readonly ActId[]): Uint8Array<ArrayBuffer> {
  const e = new CborEncoder();
  e.array(BigInt(deps.length));
  for (const d of deps) e.text(d.toString());
  return e.finish();
}

/**
 * A proposal before signing: body plus the two removable projections.
 * Equality is by content — compared over the canonical encodings, which
 * reproduces the reference field semantics exactly (floats by raw bits)
 * — because the approve step checks the host returned exactly what was
 * sent.
 */
export class Proposal {
  constructor(
    readonly body: StructuralBody,
    /** Payload bytes — canonical empty is the zero-length string. */
    readonly payload: Uint8Array,
    /** Declared dependencies (each naming a whole act). */
    readonly deps: readonly ActId[],
  ) {}

  equals(other: Proposal): boolean {
    return (
      equalBytes(this.body.canonicalBytes(), other.body.canonicalBytes()) &&
      equalBytes(this.payload, other.payload) &&
      equalBytes(canonicalDeps(this.deps), canonicalDeps(other.deps))
    );
  }
}

/**
 * The actor's signed pre-commitment over the canonical structural body
 * plus both pre-digests.
 */
export class PreSignedProposal {
  readonly proposal: Proposal;
  /** The actor's public key (32 bytes, Ed25519 interim realization). */
  readonly authorPubkey: Uint8Array;
  /** The private nonce under the pre-digests. */
  readonly nonce: Uint8Array;
  readonly preSignature: Uint8Array;

  constructor(fields: {
    proposal: Proposal;
    authorPubkey: Uint8Array;
    nonce: Uint8Array;
    preSignature: Uint8Array;
  }) {
    this.proposal = fields.proposal;
    this.authorPubkey = fields.authorPubkey;
    this.nonce = fields.nonce;
    this.preSignature = fields.preSignature;
  }

  /** The pre-commitment the pre-signature covers, recomputed from the proposal and nonce. */
  preCommitment(): Promise<Uint8Array<ArrayBuffer>> {
    return preCommitment(this.proposal, this.nonce);
  }
}

/** The message the pre-commitment hashes: the canonical body and both pre-digests. */
export function preCommitmentMsg(
  body: StructuralBody,
  digestContent: Uint8Array,
  digestDeps: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const e = new CborEncoder();
  e.array(3n);
  e.bytes(body.canonicalBytes());
  e.bytes(digestContent);
  e.bytes(digestDeps);
  return e.finish();
}

const utf8 = new TextEncoder();

/** The act identifier's bytes as every pre-digest and commitment binds them. */
function actIdBytes(actId: ActId): Uint8Array<ArrayBuffer> {
  return utf8.encode(actId.toString());
}

/**
 * The proposal pre-commitment: the tagged hash of the canonical body and
 * both pre-digests, each pre-digest over the act identifier, the private
 * nonce and the projection's bytes. The pre-signature signs exactly these
 * 32 bytes, and both commitments bind them.
 */
export async function preCommitment(
  proposal: Proposal,
  nonce: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const actId = actIdBytes(proposal.body.actId());
  const digestContent = await preDigest(Tags.PRE_DIGEST_CONTENT, actId, nonce, proposal.payload);
  const digestDeps = await preDigest(Tags.PRE_DIGEST_DEPS, actId, nonce, canonicalDeps(proposal.deps));
  return sha256Tagged(Tags.PRE_COMMITMENT, [preCommitmentMsg(proposal.body, digestContent, digestDeps)]);
}

/** The content commitment of an act — the payload witness. */
export function contentCommitment(
  actId: ActId,
  preCommitmentBytes: Uint8Array,
  salt: Uint8Array,
  payload: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return commitment(Tags.COMMIT_CONTENT, actIdBytes(actId), preCommitmentBytes, salt, payload);
}

/** The dependency commitment of an act, over its canonical dependency list. */
export function depsCommitment(
  actId: ActId,
  preCommitmentBytes: Uint8Array,
  salt: Uint8Array,
  deps: readonly ActId[],
): Promise<Uint8Array<ArrayBuffer>> {
  return commitment(Tags.COMMIT_DEPS, actIdBytes(actId), preCommitmentBytes, salt, canonicalDeps(deps));
}

/**
 * The edition tags the stand-in seals under, for the content and the
 * dependency projection alike. The device refuses any other edition.
 */
export const EDITION = 1n;

/**
 * The host-sealed verified act: the exact proposal plus the named
 * pre-commitment, host salts, the binding commitments and the edition
 * tags, sealed by the host signature. No host order fields.
 */
export class VerifiedAct {
  readonly proposal: Proposal;
  readonly authorPubkey: Uint8Array;
  readonly nonce: Uint8Array;
  readonly preSignature: Uint8Array;
  readonly preCommitment: Uint8Array;
  readonly contentSalt: Uint8Array;
  readonly depsSalt: Uint8Array;
  readonly contentCommitment: Uint8Array;
  readonly depsCommitment: Uint8Array;
  readonly contentEdition: bigint;
  readonly depsEdition: bigint;
  readonly hostSeal: Uint8Array;

  constructor(fields: {
    proposal: Proposal;
    authorPubkey: Uint8Array;
    nonce: Uint8Array;
    preSignature: Uint8Array;
    preCommitment: Uint8Array;
    contentSalt: Uint8Array;
    depsSalt: Uint8Array;
    contentCommitment: Uint8Array;
    depsCommitment: Uint8Array;
    contentEdition: bigint;
    depsEdition: bigint;
    hostSeal: Uint8Array;
  }) {
    this.proposal = fields.proposal;
    this.authorPubkey = fields.authorPubkey;
    this.nonce = fields.nonce;
    this.preSignature = fields.preSignature;
    this.preCommitment = fields.preCommitment;
    this.contentSalt = fields.contentSalt;
    this.depsSalt = fields.depsSalt;
    this.contentCommitment = fields.contentCommitment;
    this.depsCommitment = fields.depsCommitment;
    this.contentEdition = fields.contentEdition;
    this.depsEdition = fields.depsEdition;
    this.hostSeal = fields.hostSeal;
  }

  /**
   * The encoded verified act — the message the host seal covers, and with
   * the seal the message the approval witness covers. No epoch index,
   * position, or logical time.
   */
  sealMsg(): Uint8Array<ArrayBuffer> {
    const e = new CborEncoder();
    e.array(8n);
    e.bytes(this.proposal.body.canonicalBytes());
    e.bytes(this.preCommitment);
    e.bytes(this.preSignature);
    e.bytes(this.contentCommitment);
    e.bytes(this.depsCommitment);
    e.uint(this.contentEdition);
    e.uint(this.depsEdition);
    // Trailing schema version for forward evolution of the frame shape.
    e.uint(1n);
    return e.finish();
  }

  /**
   * The digest the author's approval witness signs: the encoded verified
   * act and its host seal, together.
   */
  approvalDigest(): Promise<Uint8Array<ArrayBuffer>> {
    return sha256Tagged(Tags.APPROVAL, [this.sealMsg(), this.hostSeal]);
  }
}

/**
 * The client's approval: the act identifier plus the approval-witness
 * signature over the exact verified act.
 */
export class ApprovalWitness {
  constructor(
    readonly actId: ActId,
    readonly approvalSignature: Uint8Array,
  ) {}
}
