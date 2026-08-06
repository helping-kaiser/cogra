// The device side of the admission handshake (reference:
// crates/common/src/l1/client.rs; substrate.md §6 — client-signed,
// backend-relayed). The signing side of a write is always this object;
// the backend relays, never signs. The key rides WebCrypto (web.md "Key
// custody"): the seed imports as an Ed25519 CryptoKey, and the public
// half comes back out of the JWK export (`x` is a required OKP member,
// RFC 8037).

import { concat, equalBytes, fromHex, randomBytes } from "./bytes";
import {
  addressOf,
  commitment,
  preDigest,
  SALT_LEN,
  sign,
  Tags,
  verify,
} from "./hashing";
import {
  ApprovalWitness,
  canonicalDeps,
  preCommitmentMsg,
  PreSignedProposal,
  type Proposal,
  type VerifiedAct,
} from "./handshake";

/** A refused signing step — the device never signs what it cannot verify. */
export class HandshakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandshakeError";
  }
}

// The RFC 8410 PKCS#8 wrapper of a raw Ed25519 seed — the only private
// import format WebCrypto accepts.
const PKCS8_PREFIX = fromHex("302e020100300506032b657004220420");

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** An actor keypair under the interim realization. */
export class ActorKey {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: Uint8Array,
    private readonly seedBytes: Uint8Array,
  ) {}

  static async generate(): Promise<ActorKey> {
    return ActorKey.fromSeed(randomBytes(32));
  }

  static async fromSeed(seed: Uint8Array): Promise<ActorKey> {
    if (seed.length !== 32) throw new RangeError("an actor seed is 32 bytes");
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      concat(PKCS8_PREFIX, seed),
      "Ed25519",
      true,
      ["sign"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", privateKey);
    if (jwk.x === undefined) throw new Error("Ed25519 JWK export is missing the public key");
    return new ActorKey(privateKey, fromBase64Url(jwk.x), seed.slice());
  }

  /** The 32-byte seed — what the key-backup blob carries. */
  seed(): Uint8Array<ArrayBuffer> {
    return this.seedBytes.slice();
  }

  publicKeyBytes(): Uint8Array<ArrayBuffer> {
    return this.publicKey.slice();
  }

  /** The actor's L0 address atom (stand-in convention). */
  address(): Promise<string> {
    return addressOf(this.publicKey);
  }

  /**
   * Step 2 of the write — pre-sign: bind the exact proposal under a
   * fresh private nonce. The nonce parameter exists for the golden
   * vectors; production callers use the random default.
   */
  async preSign(proposal: Proposal, nonce: Uint8Array = randomBytes(SALT_LEN)): Promise<PreSignedProposal> {
    if (nonce.length !== SALT_LEN) throw new RangeError(`nonce must be ${SALT_LEN} bytes`);
    const digestContent = await preDigest(Tags.PRE_DIGEST_CONTENT, nonce, proposal.payload);
    const digestDeps = await preDigest(Tags.PRE_DIGEST_DEPS, nonce, canonicalDeps(proposal.deps));
    const msg = preCommitmentMsg(proposal.body, digestContent, digestDeps);
    const preSignature = await sign(this.privateKey, Tags.PRE_COMMITMENT, msg);
    return new PreSignedProposal({
      proposal,
      authorPubkey: this.publicKeyBytes(),
      nonce,
      preSignature,
    });
  }

  /**
   * Step 4 of the write — approve: verify the host seal, the exact
   * returned body, and both commitment openings, then sign the approval
   * witness. `sent` is the proposal the client pre-signed; the check is
   * exact equality against what the host returned.
   */
  async approve(sent: PreSignedProposal, sealed: VerifiedAct, hostPubkey: Uint8Array): Promise<ApprovalWitness> {
    if (
      !sealed.proposal.equals(sent.proposal) ||
      !equalBytes(sealed.preSignature, sent.preSignature) ||
      !equalBytes(sealed.nonce, sent.nonce)
    ) {
      throw new HandshakeError("host returned a different act than was pre-signed");
    }
    if (!(await verify(hostPubkey, Tags.HOST_SEAL, sealed.sealMsg(), sealed.hostSeal))) {
      throw new HandshakeError("invalid host seal");
    }
    // Both commitment openings: recompute from the returned salts and
    // the bytes the client itself holds.
    const content = await commitment(Tags.COMMIT_CONTENT, sealed.contentSalt, sent.proposal.payload);
    if (!equalBytes(content, sealed.contentCommitment)) {
      throw new HandshakeError("content commitment does not open over the sent payload");
    }
    const deps = await commitment(Tags.COMMIT_DEPS, sealed.depsSalt, canonicalDeps(sent.proposal.deps));
    if (!equalBytes(deps, sealed.depsCommitment)) {
      throw new HandshakeError("dependency commitment does not open over the sent list");
    }
    const approvalSignature = await sign(this.privateKey, Tags.APPROVAL, sealed.sealMsg());
    return new ApprovalWitness(sent.proposal.body.actId(), approvalSignature);
  }

  /** Signs `msg` under `tag` — the raw primitive the vectors pin. */
  signTagged(tag: string, msg: Uint8Array): Promise<Uint8Array> {
    return sign(this.privateKey, tag, msg);
  }
}
