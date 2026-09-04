// The interim act-authentication realization, client side (reference:
// crates/common/src/l1/crypto.rs — stand-in-scoped, not a Q30
// resolution): Ed25519 signatures over tagged SHA-256 digests, salted
// hash commitments, domain-separated throughout. Sign and verify ride
// WebCrypto (web.md "Key custody"), so this module is async.

import { concat, toHex } from "./bytes";

/**
 * Domain-separation tags. Every signed or hashed object is prefixed so
 * no artifact of one role verifies in another.
 */
export const Tags = {
  PRE_DIGEST_CONTENT: "cogra-l1:pre-digest:content:v1",
  PRE_DIGEST_DEPS: "cogra-l1:pre-digest:deps:v1",
  PRE_COMMITMENT: "cogra-l1:pre-commitment:v1",
  COMMIT_CONTENT: "cogra-l1:commitment:content:v1",
  COMMIT_DEPS: "cogra-l1:commitment:deps:v1",
  HOST_SEAL: "cogra-l1:host-seal:v1",
  APPROVAL: "cogra-l1:approval:v1",
} as const;

/** Salt / nonce length — the published entropy floor of the stand-in. */
export const SALT_LEN = 32;

const encoder = new TextEncoder();

function be64(length: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(length));
  return b;
}

/**
 * The tagged, length-framed hash every signature and commitment rides
 * on: SHA-256 over the tag and each part, each prefixed with its 8-byte
 * big-endian length so no concatenation is ambiguous.
 */
export async function sha256Tagged(
  tag: string,
  parts: readonly Uint8Array[],
): Promise<Uint8Array<ArrayBuffer>> {
  const tagBytes = encoder.encode(tag);
  const framed: Uint8Array[] = [be64(tagBytes.length), tagBytes];
  for (const p of parts) framed.push(be64(p.length), p);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", concat(...framed)));
}

/**
 * The actor-side pre-digest of a removable projection: binds the exact
 * bytes under the actor's private nonce, before any host salt exists.
 */
export function preDigest(
  tag: string,
  nonce: Uint8Array,
  bytes: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return sha256Tagged(tag, [nonce, bytes]);
}

/**
 * The host-side binding, concealing commitment over a removable
 * projection: SHA-256 over (tag, host salt, bytes).
 */
export function commitment(
  tag: string,
  salt: Uint8Array,
  bytes: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return sha256Tagged(tag, [salt, bytes]);
}

/** Ed25519 over the tagged digest — the interim signing primitive. */
export async function sign(
  privateKey: CryptoKey,
  tag: string,
  msg: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const framed = await sha256Tagged(tag, [msg]);
  return new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, framed));
}

/**
 * The environment cannot run Ed25519 — not a verdict about any signature.
 *
 * Its own type because the two answers demand opposite handling. "This
 * signature does not verify" is a fact about the bytes and spends the write
 * that carried them; "this browser has no Ed25519" is a fact about the browser
 * and must spend nothing, or a reader on an unsupported build loses write
 * material to a check that never ran.
 */
export class CryptoUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CryptoUnavailableError";
  }
}

let ed25519Probe: Promise<boolean> | null = null;

/**
 * Whether this browser can hold a CoGra key, probed once per page.
 *
 * WebCrypto has no capability registry — the documented way to ask whether an
 * algorithm is supported is to attempt an operation and see whether it rejects
 * with `NotSupportedError`. A key generation is the cheapest complete answer:
 * a runtime that can generate an Ed25519 pair can import, sign and verify one.
 */
export function ed25519Available(): Promise<boolean> {
  ed25519Probe ??= (async () => {
    try {
      await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"]);
      return true;
    } catch {
      return false;
    }
  })();
  return ed25519Probe;
}

/**
 * The Ed25519 group order `ℓ`. RFC 8032 §5.1.7 requires `S` in `[0, ℓ)`,
 * and a verifier that skips the check accepts a second, malleated
 * signature over the same message — two distinct approvals for one act.
 */
const ED25519_ORDER =
  7237005577332262213973186563042994240857116359379907606001950938285454250989n;

/**
 * The eight small-order point encodings.
 *
 * A public key that is one of these has no discrete log to guard: with
 * `A` and `R` both small-order, the ordinary verification equation holds
 * for EVERY message, so a "valid" signature proves nothing about who
 * produced it. The reference refuses them (`verify_strict`'s rule) and
 * so does this, because a signature that verifies against any message is
 * exactly the thing an approval must never be.
 */
const SMALL_ORDER_KEYS: ReadonlySet<string> = new Set([
  "0100000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05",
  "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
  "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85",
  "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa",
]);

/** `S`, the signature's second half, read as the little-endian scalar it is. */
function signatureScalar(signature: Uint8Array): bigint {
  let s = 0n;
  for (let i = 63; i >= 32; i--) s = (s << 8n) | BigInt(signature[i]);
  return s;
}

/**
 * Verifies a tagged signature; a malformed key or signature just fails.
 *
 * The two checks below the length guards are the STRICT rules the Rust
 * reference verifies under. WebCrypto's own strictness is the runtime's
 * business and differs between engines, so they are stated here rather
 * than assumed — the golden vectors' `signatureRefusals` are what pins
 * them.
 */
export async function verify(
  publicKey: Uint8Array,
  tag: string,
  msg: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  if (publicKey.length !== 32) return false;
  if (signature.length !== 64) return false;
  if (SMALL_ORDER_KEYS.has(toHex(publicKey))) return false;
  if (signatureScalar(signature) >= ED25519_ORDER) return false;
  const framed = await sha256Tagged(tag, [msg]);
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("raw", publicKey.slice(), "Ed25519", false, ["verify"]);
  } catch (e) {
    // `DataError` is the spec's answer for key data the algorithm cannot
    // parse — a real verdict about these bytes, so `false` as before. Every
    // other rejection (`NotSupportedError` above all) says the runtime could
    // not do the work, and answering `false` to that is a lie the caller acts
    // on by throwing the write away.
    if (e instanceof DOMException && e.name === "DataError") return false;
    throw new CryptoUnavailableError("this browser cannot import an Ed25519 key", { cause: e });
  }
  try {
    return await crypto.subtle.verify("Ed25519", key, signature.slice(), framed);
  } catch (e) {
    throw new CryptoUnavailableError("this browser cannot verify an Ed25519 signature", {
      cause: e,
    });
  }
}

/**
 * Derives the L0 address atom of a public key: lowercase hex of the
 * first 20 bytes of SHA-256(pubkey). A stand-in convention — the real
 * L0 address format arrives with the substrate.
 */
export async function addressOf(publicKey: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", publicKey.slice()));
  return toHex(digest.slice(0, 20));
}
