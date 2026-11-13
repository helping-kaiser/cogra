// The admission-handshake objects the device signs (reference:
// crates/common/src/l1/handshake.rs for the body, the proposal and the
// sealed frame; crates/common/src/l1/proposal/ for the two-nonce
// pre-commitment and commitments; Android mirror: Handshake.kt). The
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
 * reproduces the reference field semantics exactly (floats by raw bits).
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

/** The length of every pre-digest and of the pre-commitment (SHA-256). */
const DIGEST_LEN = 32;

const utf8 = new TextEncoder();

/** The act identifier's bytes as every pre-digest and commitment binds them. */
function actIdBytes(actId: ActId): Uint8Array<ArrayBuffer> {
  return utf8.encode(actId.toString());
}

/**
 * The content pre-digest h_c: the act identifier, the content nonce and
 * the payload. Without the content nonce it confirms no payload guess.
 */
export function contentPreDigest(
  actId: ActId,
  contentNonce: Uint8Array,
  payload: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return preDigest(Tags.PRE_DIGEST_CONTENT, actIdBytes(actId), contentNonce, payload);
}

/**
 * The dependency pre-digest h_d: the act identifier, the dependency nonce
 * and the canonical dependency encoding.
 */
export function dependencyPreDigest(
  actId: ActId,
  dependencyNonce: Uint8Array,
  deps: readonly ActId[],
): Promise<Uint8Array<ArrayBuffer>> {
  return preDigest(Tags.PRE_DIGEST_DEPS, actIdBytes(actId), dependencyNonce, canonicalDeps(deps));
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

/**
 * The proposal pre-commitment P over the canonical body and both
 * pre-digests. The pre-signature signs exactly these 32 bytes, and both
 * commitments bind them.
 */
export function preCommitment(
  body: StructuralBody,
  digestContent: Uint8Array,
  digestDeps: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return sha256Tagged(Tags.PRE_COMMITMENT, [preCommitmentMsg(body, digestContent, digestDeps)]);
}

/**
 * The content commitment C_c over the act identifier, P, the host's content
 * salt and the content PRE-DIGEST — never the payload bytes. It binds the
 * payload through the pre-digest and inherits its concealment. A value of
 * any other length than a digest is refused, so payload bytes passed in
 * its place fail loudly instead of forming a commitment.
 */
export function contentCommitment(
  actId: ActId,
  preCommitmentBytes: Uint8Array,
  salt: Uint8Array,
  digestContent: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  if (digestContent.length !== DIGEST_LEN) {
    throw new RangeError(`a content pre-digest is ${DIGEST_LEN} bytes`);
  }
  return commitment(Tags.COMMIT_CONTENT, actIdBytes(actId), preCommitmentBytes, salt, digestContent);
}

/** The dependency commitment C_d, over the canonical dependency encoding. */
export function dependencyCommitment(
  actId: ActId,
  preCommitmentBytes: Uint8Array,
  salt: Uint8Array,
  deps: readonly ActId[],
): Promise<Uint8Array<ArrayBuffer>> {
  return commitment(Tags.COMMIT_DEPS, actIdBytes(actId), preCommitmentBytes, salt, canonicalDeps(deps));
}

/**
 * The content edition a verified act is sealed under: the content
 * commitment is formed over the content pre-digest. The device refuses
 * any other.
 */
export const CONTENT_EDITION = 2n;

/** The dependency edition a verified act is sealed under. */
export const DEPENDENCY_EDITION = 1n;

/**
 * The actor's pre-signed proposal: the proposal it signed, both nonces it
 * drew, and its signature over P. The device holds all of it until
 * approval — the sealed act it gets back carries neither the payload, nor
 * a nonce, nor the dependency list.
 */
export class PreSignedProposal {
  readonly proposal: Proposal;
  /** The actor's public key (32 bytes, Ed25519 interim realization). */
  readonly authorPubkey: Uint8Array;
  /** The private nonce under the content pre-digest. */
  readonly contentNonce: Uint8Array;
  /** The private nonce under the dependency pre-digest, drawn independently. */
  readonly dependencyNonce: Uint8Array;
  readonly preSignature: Uint8Array;

  constructor(fields: {
    proposal: Proposal;
    authorPubkey: Uint8Array;
    contentNonce: Uint8Array;
    dependencyNonce: Uint8Array;
    preSignature: Uint8Array;
  }) {
    this.proposal = fields.proposal;
    this.authorPubkey = fields.authorPubkey;
    this.contentNonce = fields.contentNonce;
    this.dependencyNonce = fields.dependencyNonce;
    this.preSignature = fields.preSignature;
  }

  actId(): ActId {
    return this.proposal.body.actId();
  }

  /** h_c, recomputed from this device's own payload and content nonce. */
  contentPreDigest(): Promise<Uint8Array<ArrayBuffer>> {
    return contentPreDigest(this.actId(), this.contentNonce, this.proposal.payload);
  }

  /** h_d, recomputed from this device's own dependency list and nonce. */
  dependencyPreDigest(): Promise<Uint8Array<ArrayBuffer>> {
    return dependencyPreDigest(this.actId(), this.dependencyNonce, this.proposal.deps);
  }

  /** P, recomputed from the proposal and both nonces. */
  async preCommitment(): Promise<Uint8Array<ArrayBuffer>> {
    return preCommitment(this.proposal.body, await this.contentPreDigest(), await this.dependencyPreDigest());
  }
}

/**
 * The verified act: the header the host seals — body, P, pre-signature,
 * both commitments and both edition tags. No payload, no nonce, no host
 * order field.
 */
export class VerifiedAct {
  readonly body: StructuralBody;
  readonly preCommitment: Uint8Array;
  readonly preSignature: Uint8Array;
  readonly contentCommitment: Uint8Array;
  readonly depsCommitment: Uint8Array;
  readonly contentEdition: bigint;
  readonly depsEdition: bigint;

  constructor(fields: {
    body: StructuralBody;
    preCommitment: Uint8Array;
    preSignature: Uint8Array;
    contentCommitment: Uint8Array;
    depsCommitment: Uint8Array;
    contentEdition: bigint;
    depsEdition: bigint;
  }) {
    this.body = fields.body;
    this.preCommitment = fields.preCommitment;
    this.preSignature = fields.preSignature;
    this.contentCommitment = fields.contentCommitment;
    this.depsCommitment = fields.depsCommitment;
    this.contentEdition = fields.contentEdition;
    this.depsEdition = fields.depsEdition;
  }

  actId(): ActId {
    return this.body.actId();
  }

  /**
   * The encoded verified act — the message the host seal covers, and with
   * the seal the message the approval witness covers. No epoch index,
   * position, or logical time.
   */
  sealMsg(): Uint8Array<ArrayBuffer> {
    const e = new CborEncoder();
    e.array(8n);
    e.bytes(this.body.canonicalBytes());
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
}

/**
 * What the host returns: the verified act, both salts and the host seal
 * over the encoded verified act — every host-added field visible to the
 * device before approval.
 */
export class SealedAct {
  readonly act: VerifiedAct;
  readonly contentSalt: Uint8Array;
  readonly depsSalt: Uint8Array;
  readonly hostSeal: Uint8Array;

  constructor(fields: { act: VerifiedAct; contentSalt: Uint8Array; depsSalt: Uint8Array; hostSeal: Uint8Array }) {
    this.act = fields.act;
    this.contentSalt = fields.contentSalt;
    this.depsSalt = fields.depsSalt;
    this.hostSeal = fields.hostSeal;
  }

  /**
   * The digest the author's approval witness signs: the encoded verified
   * act and its host seal, together.
   */
  approvalDigest(): Promise<Uint8Array<ArrayBuffer>> {
    return sha256Tagged(Tags.APPROVAL, [this.act.sealMsg(), this.hostSeal]);
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
