// The interim act-authentication realization, client side (reference:
// crates/common/src/l1/crypto.rs — stand-in-scoped, not a Q30
// resolution): Ed25519 signatures over tagged SHA-256 digests, salted
// hash commitments, domain-separated throughout.

package com.cogra.crypto

import java.security.MessageDigest
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer

/**
 * Domain-separation tags. Every signed or hashed object is prefixed so
 * no artifact of one role verifies in another.
 */
object Tags {
    const val PRE_DIGEST_CONTENT = "cogra-l1:pre-digest:content:v1"
    const val PRE_DIGEST_DEPS = "cogra-l1:pre-digest:deps:v1"
    const val PRE_COMMITMENT = "cogra-l1:pre-commitment:v1"
    const val COMMIT_CONTENT = "cogra-l1:commitment:content:v1"
    const val COMMIT_DEPS = "cogra-l1:commitment:deps:v1"
    const val HOST_SEAL = "cogra-l1:host-seal:v1"
    const val APPROVAL = "cogra-l1:approval:v1"
}

/** Salt / nonce length — the published entropy floor of the stand-in. */
const val SALT_LEN = 32

private fun be64(v: Long): ByteArray =
    ByteArray(8) { i -> ((v ushr ((7 - i) * 8)) and 0xFF).toByte() }

/**
 * The tagged, length-framed hash every signature and commitment rides
 * on: SHA-256 over the tag and each part, each prefixed with its 8-byte
 * big-endian length so no concatenation is ambiguous.
 */
fun sha256Tagged(tag: String, parts: List<ByteArray>): ByteArray {
    val h = MessageDigest.getInstance("SHA-256")
    val tagBytes = tag.toByteArray(Charsets.US_ASCII)
    h.update(be64(tagBytes.size.toLong()))
    h.update(tagBytes)
    for (p in parts) {
        h.update(be64(p.size.toLong()))
        h.update(p)
    }
    return h.digest()
}

/**
 * The actor-side pre-digest of a removable projection: binds the exact
 * bytes under the actor's private nonce, before any host salt exists.
 */
fun preDigest(tag: String, nonce: ByteArray, bytes: ByteArray): ByteArray =
    sha256Tagged(tag, listOf(nonce, bytes))

/**
 * The host-side binding, concealing commitment over a removable
 * projection: SHA-256 over (tag, host salt, bytes).
 */
fun commitment(tag: String, salt: ByteArray, bytes: ByteArray): ByteArray =
    sha256Tagged(tag, listOf(salt, bytes))

/** Ed25519 over the tagged digest — the interim signing primitive. */
internal fun sign(key: Ed25519PrivateKeyParameters, tag: String, msg: ByteArray): ByteArray {
    val framed = sha256Tagged(tag, listOf(msg))
    val signer = Ed25519Signer()
    signer.init(true, key)
    signer.update(framed, 0, framed.size)
    return signer.generateSignature()
}

/** Verifies a tagged signature; malformed keys or signatures just fail. */
fun verify(publicKey: ByteArray, tag: String, msg: ByteArray, signature: ByteArray): Boolean {
    if (publicKey.size != Ed25519PublicKeyParameters.KEY_SIZE) return false
    if (signature.size != Ed25519PrivateKeyParameters.SIGNATURE_SIZE) return false
    val framed = sha256Tagged(tag, listOf(msg))
    val verifier = Ed25519Signer()
    return try {
        verifier.init(false, Ed25519PublicKeyParameters(publicKey, 0))
        verifier.update(framed, 0, framed.size)
        verifier.verifySignature(signature)
    } catch (_: IllegalArgumentException) {
        false
    }
}

/**
 * Derives the L0 address atom of a public key: lowercase hex of the
 * first 20 bytes of SHA-256(pubkey). A stand-in convention — the real
 * L0 address format arrives with the substrate.
 */
fun addressOf(publicKey: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(publicKey)
    return digest.copyOfRange(0, 20).toHex()
}
