// The device lock, format v1 (auth.md "Device lock"): one locked custody
// record sealed under a key derived from a server-held secret. The Rust
// reference is `crates/common/src/l1/device_lock.rs`; the golden vectors
// (`client-crypto-vectors.json` `deviceLock`) pin every byte.
//
// HKDF-SHA-256 over the secret with a fresh 16-byte salt and the info
// `cogra:device-lock:v1`, then AES-256-GCM with a fresh 12-byte nonce. The
// record is `0x01 ‖ salt ‖ nonce ‖ ciphertext`, and its associated data is
// that header, then the account's 16 UUID bytes, then the record's kind and
// key — each framed by its big-endian u64 length — so a locked record cannot
// be moved into another account's slot or swapped for another record.

package com.cogra.crypto

import java.nio.ByteBuffer
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.params.HKDFParameters

/** A record that will not open under this lock and binding, or a malformed container. */
class DeviceLockException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Where a locked record belongs: its account, the kind of custody it holds, its name within that kind. */
data class DeviceLockBinding(val account: UUID, val kind: String, val key: String)

/** The server-held secret's length. */
const val DEVICE_LOCK_SECRET_LEN = 32

private const val LOCK_VERSION: Byte = 0x01
private const val LOCK_SALT_LEN = 16
private const val LOCK_NONCE_LEN = 12
private const val LOCK_HEADER_LEN = 1 + LOCK_SALT_LEN + LOCK_NONCE_LEN
private const val LOCK_INFO = "cogra:device-lock:v1"
private const val GCM_TAG_BITS = 128
private const val U64_BYTES = 8

/** A UUID's 16 bytes, as `Uuid::as_bytes` gives them (most significant half first). */
internal fun uuidBytes(uuid: UUID): ByteArray =
    ByteBuffer.allocate(2 * Long.SIZE_BYTES)
        .putLong(uuid.mostSignificantBits)
        .putLong(uuid.leastSignificantBits)
        .array()

private fun lengthFramed(part: ByteArray): ByteArray =
    ByteBuffer.allocate(U64_BYTES).putLong(part.size.toLong()).array() + part

/** The associated data a record seals under (the reference's `associated_data`). */
internal fun deviceLockAssociatedData(header: ByteArray, binding: DeviceLockBinding): ByteArray =
    header +
        uuidBytes(binding.account) +
        lengthFramed(binding.kind.toByteArray(Charsets.UTF_8)) +
        lengthFramed(binding.key.toByteArray(Charsets.UTF_8))

/** The lock key one record seals under — pinned by the vectors. */
internal fun deviceLockKey(secret: ByteArray, salt: ByteArray): ByteArray {
    require(secret.size == DEVICE_LOCK_SECRET_LEN) { "a device-lock secret is $DEVICE_LOCK_SECRET_LEN bytes" }
    val hkdf = HKDFBytesGenerator(SHA256Digest())
    hkdf.init(HKDFParameters(secret, salt, LOCK_INFO.toByteArray(Charsets.UTF_8)))
    return ByteArray(DEVICE_LOCK_SECRET_LEN).also { hkdf.generateBytes(it, 0, it.size) }
}

private fun lockCipher(mode: Int, key: ByteArray, nonce: ByteArray, aad: ByteArray): Cipher =
    Cipher.getInstance("AES/GCM/NoPadding").apply {
        init(mode, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, nonce))
        updateAAD(aad)
    }

/**
 * Seals one record under the lock — the production form. Salt and nonce are
 * drawn here, never accepted, as [sealKeyBackup] draws its own.
 */
fun sealDeviceLockRecord(secret: ByteArray, binding: DeviceLockBinding, plaintext: ByteArray): ByteArray =
    sealDeviceLockRecordWith(secret, binding, plaintext, Entropy.bytes(LOCK_SALT_LEN), Entropy.bytes(LOCK_NONCE_LEN))

/** The deterministic form the golden vectors pin. */
internal fun sealDeviceLockRecordWith(
    secret: ByteArray,
    binding: DeviceLockBinding,
    plaintext: ByteArray,
    salt: ByteArray,
    nonce: ByteArray,
): ByteArray {
    require(salt.size == LOCK_SALT_LEN) { "the HKDF salt is $LOCK_SALT_LEN bytes" }
    require(nonce.size == LOCK_NONCE_LEN) { "the AES-GCM nonce is $LOCK_NONCE_LEN bytes" }
    val header = byteArrayOf(LOCK_VERSION) + salt + nonce
    val ciphertext = lockCipher(
        Cipher.ENCRYPT_MODE,
        deviceLockKey(secret, salt),
        nonce,
        deviceLockAssociatedData(header, binding),
    ).doFinal(plaintext)
    return header + ciphertext
}

/** Opens one record under its lock and binding; a failing GCM tag refuses. */
fun openDeviceLockRecord(secret: ByteArray, record: ByteArray, binding: DeviceLockBinding): ByteArray {
    if (record.size <= LOCK_HEADER_LEN) throw DeviceLockException("malformed device-lock record")
    if (record[0] != LOCK_VERSION) throw DeviceLockException("unsupported device-lock version ${record[0]}")
    val salt = record.copyOfRange(1, 1 + LOCK_SALT_LEN)
    val nonce = record.copyOfRange(1 + LOCK_SALT_LEN, LOCK_HEADER_LEN)
    val header = record.copyOfRange(0, LOCK_HEADER_LEN)
    return try {
        lockCipher(Cipher.DECRYPT_MODE, deviceLockKey(secret, salt), nonce, deviceLockAssociatedData(header, binding))
            .doFinal(record.copyOfRange(LOCK_HEADER_LEN, record.size))
    } catch (e: java.security.GeneralSecurityException) {
        throw DeviceLockException("the record does not open under this lock and binding", e)
    }
}
