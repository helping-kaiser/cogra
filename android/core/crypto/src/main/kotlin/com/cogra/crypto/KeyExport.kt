// Portable export of a client-held secret (auth.md "Key export"): the
// holder must be able to act as their L0 address on L1 even if CoGra
// disappears. The blob container's CBOR is a CoGra-only artifact, so
// each secret leaves in the encoding the wider world already reads —
// for Ed25519 that is RFC 8410's PKCS#8, plus the raw bytes as hex.

package com.cogra.crypto

import java.util.Base64

/** One secret in the two forms the export surface shows. */
data class ExportedKey(val pem: String, val hex: String)

/**
 * The RFC 8410 PKCS#8 prefix of a raw Ed25519 seed — `SEQUENCE {
 * version 0, AlgorithmIdentifier { id-Ed25519 }, OCTET STRING { OCTET
 * STRING (32) } }`. The same 16 bytes WebCrypto requires for a private
 * import; the vector in RFC 8410 §10.3 pins them.
 *
 * There is no cross-client vector for this and none is wanted: each
 * client is pinned to the standard, which cannot drift, rather than to
 * the other client, which can.
 */
private val PKCS8_PREFIX = byteArrayOf(
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
)

private const val PEM_LINE = 64

/**
 * Encodes the actor seed for export. For Ed25519 the 32-byte seed *is*
 * the private key (RFC 8032), so the two forms are two encodings of the
 * same bytes, not two secrets.
 */
fun exportActorSeed(seed: ByteArray): ExportedKey {
    require(seed.size == 32) { "an actor seed is 32 bytes" }
    val der = PKCS8_PREFIX + seed
    val body = Base64.getEncoder().encodeToString(der).chunked(PEM_LINE).joinToString("\n")
    return ExportedKey(
        pem = "-----BEGIN PRIVATE KEY-----\n$body\n-----END PRIVATE KEY-----",
        hex = seed.toHex(),
    )
}
