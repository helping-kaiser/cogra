// The key-backup blob, format v1 (auth.md "Blob format (v1)"): the
// actor seed sealed on-device under a generated recovery code. One
// format across every client — a blob sealed on the phone must open in
// the browser; the golden vectors pin every byte.

package com.cogra.crypto

import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.params.HKDFParameters

/** A blob that will not open: wrong code, tampered bytes, or bad format. */
class KeyBackupException(message: String) : Exception(message)

private const val VERSION: Byte = 0x01
private const val CODE_LEN = 16
private const val HKDF_SALT_LEN = 16
private const val AES_NONCE_LEN = 12
private const val HKDF_INFO = "cogra:key-backup:v1"
private const val CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** A 16-byte recovery code and its display/normalization rules. */
class RecoveryCode(val bytes: ByteArray) {
    init {
        require(bytes.size == CODE_LEN) { "a recovery code is $CODE_LEN bytes" }
    }

    /** The display form: 26 Crockford characters grouped 5-5-5-5-6. */
    fun display(): String {
        var bits = 0
        var nbits = 0
        val chars = StringBuilder()
        for (b in bytes) {
            bits = (bits shl 8) or (b.toInt() and 0xFF)
            nbits += 8
            while (nbits >= 5) {
                nbits -= 5
                chars.append(CROCKFORD[(bits shr nbits) and 31])
            }
        }
        if (nbits > 0) chars.append(CROCKFORD[(bits shl (5 - nbits)) and 31])
        check(chars.length == 26) { "16 code bytes encode to 26 characters" }
        return listOf(0..4, 5..9, 10..14, 15..19, 20..25)
            .joinToString("-") { chars.substring(it.first, it.last + 1) }
    }

    companion object {
        fun generate(): RecoveryCode = RecoveryCode(ActorKey.randomBytes(CODE_LEN))

        /**
         * Parses user input: uppercase, `I`/`L` → `1`, `O` → `0`,
         * separators stripped. No check digit — AES-GCM's tag detects a
         * mistyped code at unlock.
         */
        fun fromInput(input: String): RecoveryCode {
            val normalized = input.uppercase()
                .replace("I", "1")
                .replace("L", "1")
                .replace("O", "0")
                .filter { it != '-' && !it.isWhitespace() }
            if (normalized.length != 26) {
                throw KeyBackupException("a recovery code has 26 characters")
            }
            var bits = 0L
            var nbits = 0
            val out = ArrayList<Byte>(CODE_LEN)
            for (c in normalized) {
                val v = CROCKFORD.indexOf(c)
                if (v < 0) throw KeyBackupException("invalid recovery-code character `$c`")
                bits = (bits shl 5) or v.toLong()
                nbits += 5
                if (nbits >= 8) {
                    nbits -= 8
                    out.add(((bits shr nbits) and 0xFF).toByte())
                }
            }
            // 26 chars carry 130 bits; the trailing 2 pad bits must be zero.
            if (bits and ((1L shl nbits) - 1) != 0L) {
                throw KeyBackupException("invalid recovery code")
            }
            return RecoveryCode(out.toByteArray())
        }
    }
}

private fun contentKey(code: RecoveryCode, salt: ByteArray): ByteArray {
    val hkdf = HKDFBytesGenerator(SHA256Digest())
    hkdf.init(HKDFParameters(code.bytes, salt, HKDF_INFO.toByteArray(Charsets.US_ASCII)))
    return ByteArray(32).also { hkdf.generateBytes(it, 0, it.size) }
}

private fun cipher(mode: Int, key: ByteArray, nonce: ByteArray, aad: ByteArray): Cipher =
    Cipher.getInstance("AES/GCM/NoPadding").apply {
        init(mode, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
        updateAAD(aad)
    }

/**
 * Seals the actor seed under the recovery code. The [salt] and [nonce]
 * parameters exist for the golden vectors; production callers use the
 * random defaults.
 */
fun sealKeyBackup(
    seed: ByteArray,
    code: RecoveryCode,
    salt: ByteArray = ActorKey.randomBytes(HKDF_SALT_LEN),
    nonce: ByteArray = ActorKey.randomBytes(AES_NONCE_LEN),
): ByteArray {
    require(seed.size == 32) { "an actor seed is 32 bytes" }
    require(salt.size == HKDF_SALT_LEN) { "the HKDF salt is $HKDF_SALT_LEN bytes" }
    require(nonce.size == AES_NONCE_LEN) { "the AES-GCM nonce is $AES_NONCE_LEN bytes" }
    val plaintext = CborEncoder().array(2u).bytes(seed).uint(1u).finish()
    val header = byteArrayOf(VERSION) + salt + nonce
    val ciphertext = cipher(Cipher.ENCRYPT_MODE, contentKey(code, salt), nonce, header)
        .doFinal(plaintext)
    return header + ciphertext
}

/**
 * Opens a blob with the recovery code, returning the actor seed. A
 * failing GCM tag — mistyped code or tampered blob — throws; so does
 * any malformed container.
 */
fun openKeyBackup(blob: ByteArray, code: RecoveryCode): ByteArray {
    val headerLen = 1 + HKDF_SALT_LEN + AES_NONCE_LEN
    if (blob.size <= headerLen) throw KeyBackupException("blob too short")
    if (blob[0] != VERSION) throw KeyBackupException("unsupported blob version ${blob[0]}")
    val salt = blob.copyOfRange(1, 1 + HKDF_SALT_LEN)
    val nonce = blob.copyOfRange(1 + HKDF_SALT_LEN, headerLen)
    val header = blob.copyOfRange(0, headerLen)
    val plaintext = try {
        cipher(Cipher.DECRYPT_MODE, contentKey(code, salt), nonce, header)
            .doFinal(blob.copyOfRange(headerLen, blob.size))
    } catch (e: java.security.GeneralSecurityException) {
        throw KeyBackupException("the blob does not open under this code")
    }
    try {
        val d = CborDecoder(plaintext)
        if (d.array() != 2UL) throw KeyBackupException("malformed blob container")
        val seed = d.bytes()
        if (d.uint() != 1UL) throw KeyBackupException("unsupported blob container version")
        d.finish()
        if (seed.size != 32) throw KeyBackupException("malformed blob container")
        return seed
    } catch (e: CborDecodeException) {
        throw KeyBackupException("malformed blob container: ${e.message}")
    }
}
