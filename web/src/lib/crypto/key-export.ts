// Portable export of a client-held secret (auth.md "Key export"), the
// browser twin of core:crypto's KeyExport.kt: the holder must be able
// to act as their L0 address on L1 even if CoGra disappears. The blob
// container's CBOR is a CoGra-only artifact, so each secret leaves in
// the encoding the wider world already reads — for Ed25519 that is
// RFC 8410's PKCS#8, plus the raw bytes as hex.
//
// THE STANDARD IS THE REFERENCE HERE, NOT THE OTHER CLIENT. Key export
// has no Rust counterpart and no entry in `client-crypto-vectors.json`,
// deliberately: each client is pinned to RFC 8410 §10.3's own vector
// (`key-export.test.ts`, and `KeyExportTest.kt` on android), which
// cannot drift, rather than to the other client, which can.

import { PKCS8_PREFIX } from "./actor-key";
import { concat, toBase64, toHex } from "./bytes";

/** One secret in the two forms the export surface shows. */
export type ExportedKey = { pem: string; hex: string };

const PEM_LINE = 64;

/**
 * Encodes the actor seed for export. For Ed25519 the 32-byte seed *is*
 * the private key (RFC 8032), so the two forms are two encodings of the
 * same bytes, not two secrets.
 */
export function exportActorSeed(seed: Uint8Array): ExportedKey {
  if (seed.length !== 32) throw new RangeError("an actor seed is 32 bytes");
  const base64 = toBase64(concat(PKCS8_PREFIX, seed));
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += PEM_LINE) lines.push(base64.slice(i, i + PEM_LINE));
  return {
    pem: `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`,
    hex: toHex(seed),
  };
}
