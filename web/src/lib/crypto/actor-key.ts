// The device side of the admission handshake (reference:
// crates/common/src/l1/client.rs; substrate.md §6 — client-signed,
// backend-relayed). The signing side of a write is always this object;
// the backend relays, never signs. The key rides WebCrypto (web.md
// "Key custody").

import { concat, equalBytes, fromBase64Url, fromHex, randomBytes } from "./bytes";
import { addressOf, CryptoUnavailableError, SALT_LEN, sign, signDigest, Tags, verify, verifyDigest } from "./hashing";
import {
  ApprovalWitness,
  CONTENT_EDITION,
  contentCommitment,
  DEPENDENCY_EDITION,
  dependencyCommitment,
  PreSignedProposal,
  type Proposal,
  type SealedAct,
} from "./handshake";

/** A refused signing step — the device never signs what it cannot verify. */
export class HandshakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandshakeError";
  }
}

// The RFC 8410 PKCS#8 wrapper of a raw Ed25519 seed — the only private
// import format WebCrypto accepts, and the export encoding other tools
// read (key-export.ts).
export const PKCS8_PREFIX = fromHex("302e020100300506032b657004220420");

/**
 * Imports a seed as a signing pair fit for custody (web.md "Key
 * custody"): the private key is non-extractable — IndexedDB persists the
 * CryptoKey object itself, so script injection can use but never export
 * it. The public half comes out of a throwaway extractable import (`x`
 * is a required OKP member, RFC 8037); the throwaway is never stored.
 */
export async function importActorKeyPair(
  seed: Uint8Array,
): Promise<{ privateKey: CryptoKey; publicKey: Uint8Array<ArrayBuffer> }> {
  if (seed.length !== 32) throw new RangeError("an actor seed is 32 bytes");
  const pkcs8 = concat(PKCS8_PREFIX, seed);
  let throwaway: CryptoKey;
  try {
    throwaway = await crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", true, ["sign"]);
  } catch (e) {
    // The seed is 32 bytes and the wrapper is a constant, so nothing here can
    // be malformed: a rejection is the runtime saying it has no Ed25519. Named
    // as such, because custody failing is a different sentence to a reader
    // than a key failing.
    throw new CryptoUnavailableError("this browser cannot hold a CoGra key", { cause: e });
  }
  const jwk = await crypto.subtle.exportKey("jwk", throwaway);
  if (jwk.x === undefined) throw new Error("Ed25519 JWK export is missing the public key");
  const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", false, ["sign"]);
  return { privateKey, publicKey: fromBase64Url(jwk.x) };
}

/** An actor keypair under the interim realization. */
export class ActorKey {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly publicKey: Uint8Array,
    private readonly seedBytes: Uint8Array | null,
  ) {}

  static async generate(): Promise<ActorKey> {
    return ActorKey.fromSeed(randomBytes(32));
  }

  static async fromSeed(seed: Uint8Array): Promise<ActorKey> {
    const pair = await importActorKeyPair(seed);
    return new ActorKey(pair.privateKey, pair.publicKey, seed.slice());
  }

  /** A key loaded back from custody — the seed is not retained there. */
  static stored(privateKey: CryptoKey, publicKey: Uint8Array): ActorKey {
    return new ActorKey(privateKey, publicKey.slice(), null);
  }

  /**
   * The 32-byte seed — what the key-backup blob carries. Present only
   * on a freshly minted or restored key.
   */
  seed(): Uint8Array<ArrayBuffer> {
    if (this.seedBytes === null) throw new Error("the seed is not retained on a stored key");
    return this.seedBytes.slice();
  }

  publicKeyBytes(): Uint8Array<ArrayBuffer> {
    return this.publicKey.slice();
  }

  /** The actor's address atom (stand-in convention). */
  address(): Promise<string> {
    return addressOf(this.publicKey);
  }

  /**
   * Step 2 of the write — pre-sign: bind the exact proposal under a
   * content nonce and a dependency nonce, two independent draws of
   * {@link SALT_LEN} bytes from the platform CSPRNG
   * (`crypto.getRandomValues`), form P, and sign it. The nonce parameters
   * exist for the golden vectors; production callers use the random
   * defaults.
   */
  async preSign(
    proposal: Proposal,
    contentNonce: Uint8Array = randomBytes(SALT_LEN),
    dependencyNonce: Uint8Array = randomBytes(SALT_LEN),
  ): Promise<PreSignedProposal> {
    if (contentNonce.length !== SALT_LEN) throw new RangeError(`content nonce must be ${SALT_LEN} bytes`);
    if (dependencyNonce.length !== SALT_LEN) throw new RangeError(`dependency nonce must be ${SALT_LEN} bytes`);
    // The host refuses a submission whose two nonces are equal; refusing it
    // here keeps such material from ever being stored or sent.
    if (equalBytes(contentNonce, dependencyNonce)) {
      throw new RangeError("content nonce and dependency nonce must differ");
    }
    // This key signs only proposals that name it as author — the reference's
    // `PreSigned::recover` rule, checked here as well as at approval so no
    // material for another author is ever stored or sent.
    if (proposal.body.author !== (await this.address())) {
      throw new HandshakeError("the proposal is not this actor's");
    }
    const unsigned = new PreSignedProposal({
      proposal,
      authorPubkey: this.publicKeyBytes(),
      contentNonce,
      dependencyNonce,
      preSignature: new Uint8Array(0),
    });
    const preSignature = await signDigest(this.privateKey, await unsigned.preCommitment());
    return new PreSignedProposal({ ...unsigned, preSignature });
  }

  /**
   * Step 4 of the write — approve: verify the exact returned act, the
   * pre-commitment and the editions, the host seal, and both commitments
   * recomputed from material this device holds itself, then sign the
   * approval witness over the verified act and its seal. `sent` is the
   * proposal the client pre-signed; the check is exact equality against
   * what the host returned.
   *
   * The sealed act carries no payload, nonce or dependency list, so
   * nothing the host returns can stand in for them: C_c is recomputed over
   * this device's own content pre-digest (from its payload and content
   * nonce — never over the payload bytes), C_d over its own canonical
   * dependency encoding. A different dependency list changes both P (via
   * h_d) and C_d, so those two checks are its equality check.
   */
  async approve(sent: PreSignedProposal, sealed: SealedAct, hostPubkey: Uint8Array): Promise<ApprovalWitness> {
    // THE MATERIAL HAS TO BE THIS KEY'S. `sent` is read back out of IndexedDB
    // on the web, so it can outlive the key that pre-signed it — a re-mint
    // between staging and approval leaves material whose pre-signature no
    // later key can stand behind. The Rust reference proves authorship before
    // signing over recovered material (`ActorKey::approve_recovered`,
    // crates/common/src/l1/client.rs); this is the same precondition, checked
    // against the pubkey the material itself carries.
    if (!equalBytes(sent.authorPubkey, this.publicKey)) {
      throw new HandshakeError("handshake material was pre-signed by a different key");
    }
    // Web material is ALWAYS recovered material — reloaded from IndexedDB —
    // so authorship is proven, not matched, as the reference's
    // `PreSigned::recover` proves it (crates/common/src/l1/proposal/device.rs):
    // the body names this key's address, and the stored pre-signature verifies
    // under this key over the P recomputed from the held proposal and nonces.
    if (sent.proposal.body.author !== (await this.address())) {
      throw new HandshakeError("the proposal is not this actor's");
    }
    const act = sealed.act;
    if (
      !equalBytes(act.body.canonicalBytes(), sent.proposal.body.canonicalBytes()) ||
      !equalBytes(act.preSignature, sent.preSignature)
    ) {
      throw new HandshakeError("host returned a different act than was pre-signed");
    }
    const formed = await sent.preCommitment();
    if (!(await verifyDigest(this.publicKey, formed, sent.preSignature))) {
      throw new HandshakeError("the stored pre-signature is not this key's over the held proposal");
    }
    if (!equalBytes(act.preCommitment, formed)) {
      throw new HandshakeError("host returned a different pre-commitment than was formed");
    }
    if (act.contentEdition !== CONTENT_EDITION || act.depsEdition !== DEPENDENCY_EDITION) {
      throw new HandshakeError(
        `unexpected editions (content ${act.contentEdition}, dependencies ${act.depsEdition}); this device signs content edition ${CONTENT_EDITION} and dependency edition ${DEPENDENCY_EDITION}`,
      );
    }
    if (!(await verify(hostPubkey, Tags.HOST_SEAL, act.sealMsg(), sealed.hostSeal))) {
      throw new HandshakeError("invalid host seal");
    }
    // Both commitments: recompute from the returned salts, the P this device
    // formed, and the material it holds.
    const actId = sent.actId();
    const content = await contentCommitment(actId, formed, sealed.contentSalt, await sent.contentPreDigest());
    if (!equalBytes(content, act.contentCommitment)) {
      throw new HandshakeError("content commitment is not formed over this device's content pre-digest");
    }
    const deps = await dependencyCommitment(actId, formed, sealed.depsSalt, sent.proposal.deps);
    if (!equalBytes(deps, act.depsCommitment)) {
      throw new HandshakeError("dependency commitment does not open over the dependency list");
    }
    const approvalSignature = await signDigest(this.privateKey, await sealed.approvalDigest());
    return new ApprovalWitness(actId, approvalSignature);
  }

  /** Signs `msg` under `tag` — the raw primitive the vectors pin. */
  signTagged(tag: string, msg: Uint8Array): Promise<Uint8Array> {
    return sign(this.privateKey, tag, msg);
  }
}
