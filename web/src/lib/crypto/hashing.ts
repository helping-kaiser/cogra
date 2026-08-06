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

/** Verifies a tagged signature; malformed keys or signatures just fail. */
export async function verify(
  publicKey: Uint8Array,
  tag: string,
  msg: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  if (publicKey.length !== 32) return false;
  if (signature.length !== 64) return false;
  const framed = await sha256Tagged(tag, [msg]);
  try {
    const key = await crypto.subtle.importKey("raw", publicKey.slice(), "Ed25519", false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, signature.slice(), framed);
  } catch {
    return false;
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
