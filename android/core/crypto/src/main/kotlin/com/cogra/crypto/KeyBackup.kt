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
open class KeyBackupException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * The input is not a recovery code's length. It is the one parse
 * failure a reader can act on — characters are missing or spare. Every
 * other rejection of a full-length input, an unusable character or the
 * trailing pad bits, is a code that will not open, which is what the
 * GCM tag would have said a moment later.
 */
class RecoveryCodeLengthException(message: String) : KeyBackupException(message)

private const val VERSION: Byte = 0x01
private const val CODE_LEN = 16
private const val HKDF_SALT_LEN = 16
private const val AES_NONCE_LEN = 12
private const val HKDF_INFO = "cogra:key-backup:v1"
private const val CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** U+FEFF — the byte-order mark a paste carries in ahead of the code. */
private const val BYTE_ORDER_MARK = 0xFEFF

/** U+0085 NEXT LINE — `White_Space`, and in no separator category. */
private const val NEXT_LINE = 0x85

/** The C0 run U+0009-U+000D: tab, line feed, vertical tab, form feed, return. */
private const val C0_WHITE_SPACE_FIRST = 0x09
private const val C0_WHITE_SPACE_LAST = 0x0D

/**
 * The characters Unicode gives the `White_Space` property.
 *
 * `Character.isSpaceChar` is the part of that property Unicode also
 * classes as a separator; what it leaves out is the C0 run and
 * NEXT LINE, which are named above.
 */
private fun Char.isUnicodeWhiteSpace(): Boolean =
    Character.isSpaceChar(this) ||
        code in C0_WHITE_SPACE_FIRST..C0_WHITE_SPACE_LAST ||
        code == NEXT_LINE

/**
 * What [RecoveryCode.normalize] drops: `-`, every `White_Space`
 * character, and the byte-order mark.
 *
 * The class is stated here rather than inherited from the platform,
 * because no two of the three clients spell "whitespace" the same and a
 * code typed on one has to read on all. Kotlin's own
 * `Char.isWhitespace()` is `Character.isWhitespace() ||
 * Character.isSpaceChar()`, which ADDS U+001C-U+001F — the C0
 * file/group/record/unit separators, which Unicode does not call white
 * space — and DROPS U+0085, which it does.
 */
private fun Char.isCodeSeparator(): Boolean =
    this == '-' || code == BYTE_ORDER_MARK || isUnicodeWhiteSpace()

/**
 * A 16-byte recovery code and its display/normalization rules.
 *
 * The bytes are copied in and copied out, the way [ActorKey.seed] hands
 * back BouncyCastle's defensive copy: a secret held by reference is one
 * the caller can still be holding — or still mutating — after it has
 * been sealed under.
 */
class RecoveryCode(bytes: ByteArray) {

    private val secret: ByteArray = bytes.copyOf()

    init {
        require(secret.size == CODE_LEN) { "a recovery code is $CODE_LEN bytes" }
    }

    /** The code's bytes, as a copy. */
    fun bytes(): ByteArray = secret.copyOf()

    /** The display form: 26 Crockford characters grouped 5-5-5-5-6. */
    fun display(): String {
        var bits = 0
        var nbits = 0
        val chars = StringBuilder()
        for (b in secret) {
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
        fun generate(): RecoveryCode = RecoveryCode(Entropy.bytes(CODE_LEN))

        /**
         * The reading rule for anything a user typed: uppercase,
         * `I`/`L` → `1`, `O` → `0`, separators stripped. Applies to a
         * fragment as much as to a whole code, which is what lets the
         * write-it-down confirmation compare a typed code against the
         * one on screen.
         */
        fun normalize(input: String): String =
            input.uppercase()
                .replace("I", "1")
                .replace("L", "1")
                .replace("O", "0")
                .filter { !it.isCodeSeparator() }

        /**
         * Parses user input under [normalize]. No check digit —
         * AES-GCM's tag detects a mistyped code at unlock.
         */
        fun fromInput(input: String): RecoveryCode {
            val normalized = normalize(input)
            if (normalized.length != 26) {
                throw RecoveryCodeLengthException("a recovery code has 26 characters")
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
    // UTF-8, as the contract's own `hkdfInfoUtf8` names it: US-ASCII's
    // encoder replaces what it cannot represent, so a non-ASCII info
    // string would derive one key here and another everywhere else.
    hkdf.init(HKDFParameters(code.bytes(), salt, HKDF_INFO.toByteArray(Charsets.UTF_8)))
    return ByteArray(32).also { hkdf.generateBytes(it, 0, it.size) }
}

private fun cipher(mode: Int, key: ByteArray, nonce: ByteArray, aad: ByteArray): Cipher =
    Cipher.getInstance("AES/GCM/NoPadding").apply {
        init(mode, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
        updateAAD(aad)
    }

/**
 * Seals the actor seed under the recovery code — the production form.
 *
 * Salt and nonce are drawn here rather than accepted. The content key
 * is a pure function of `(code, salt)`, so a caller that could supply
 * both could reuse an AES-GCM nonce under an identical key; the
 * deterministic form the golden vectors pin is [sealKeyBackupWith],
 * mirroring the Rust reference's own split
 * (`crates/common/src/l1/key_backup.rs`).
 */
fun sealKeyBackup(seed: ByteArray, code: RecoveryCode): ByteArray =
    sealKeyBackupWith(seed, code, Entropy.bytes(HKDF_SALT_LEN), Entropy.bytes(AES_NONCE_LEN))

/** The deterministic form the golden vectors pin. */
internal fun sealKeyBackupWith(
    seed: ByteArray,
    code: RecoveryCode,
    salt: ByteArray,
    nonce: ByteArray,
): ByteArray {
    require(seed.size == 32) { "an actor seed is 32 bytes" }
    require(salt.size == HKDF_SALT_LEN) { "the HKDF salt is $HKDF_SALT_LEN bytes" }
    require(nonce.size == AES_NONCE_LEN) { "the AES-GCM nonce is $AES_NONCE_LEN bytes" }
    val header = byteArrayOf(VERSION) + salt + nonce
    val ciphertext = cipher(Cipher.ENCRYPT_MODE, contentKey(code, salt), nonce, header)
        .doFinal(keyBackupPlaintext(seed))
    return header + ciphertext
}

/**
 * The CBOR container the blob encrypts: `[seed, containerVersion]`.
 *
 * Reachable from the suite so the vectors can pin the plaintext and the
 * derived key separately. Without those two, a swapped HKDF argument
 * order reports only as "the blob differs", which names neither half.
 */
internal fun keyBackupPlaintext(seed: ByteArray): ByteArray =
    CborEncoder().array(2u).bytes(seed).uint(1u).finish()

/** The HKDF output the container is sealed under — pinned by the vectors. */
internal fun keyBackupContentKey(code: RecoveryCode, salt: ByteArray): ByteArray =
    contentKey(code, salt)

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
        throw KeyBackupException("the blob does not open under this code", e)
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
        throw KeyBackupException("malformed blob container: ${e.message}", e)
    }
}

/**
 * The upload proof's domain tag. Storing a blob is an L2 operation, not
 * an L1 act, so it carries this file's `cogra:key-backup:*` prefix
 * rather than one of the `cogra-l1:` act tags.
 */
const val UPLOAD_PROOF_TAG = "cogra:key-backup-upload:v1"

/**
 * The upload proof (auth.md "Key recovery"): the actor key signs the
 * server's challenge bound to the exact blob bytes. Binding the blob is
 * what stops a captured signature from authorizing different
 * ciphertext; binding the challenge is what stops the whole pair from
 * being replayed.
 */
fun signUpload(key: ActorKey, challenge: ByteArray, blob: ByteArray): ByteArray =
    key.signTagged(UPLOAD_PROOF_TAG, sha256Tagged(UPLOAD_PROOF_TAG, listOf(challenge, blob)))
