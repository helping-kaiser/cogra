package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertThrows
import org.junit.Test

class KeyBackupTest {

    @Test
    fun sealAndOpenRoundTrip() {
        val seed = ActorKey.generate().seed()
        val code = RecoveryCode.generate()
        val blob = sealKeyBackup(seed, code)
        assertThat(openKeyBackup(blob, code)).isEqualTo(seed)
    }

    @Test
    fun aWrongCodeDoesNotOpen() {
        val blob = sealKeyBackup(ActorKey.generate().seed(), RecoveryCode.generate())
        assertThrows(KeyBackupException::class.java) {
            openKeyBackup(blob, RecoveryCode.generate())
        }
    }

    @Test
    fun aTamperedHeaderDoesNotOpen() {
        val code = RecoveryCode.generate()
        val blob = sealKeyBackup(ActorKey.generate().seed(), code)
        // The header rides as associated data — flipping a salt bit
        // breaks the tag even though the ciphertext is untouched.
        val tampered = blob.copyOf()
        tampered[5] = (tampered[5].toInt() xor 1).toByte()
        assertThrows(KeyBackupException::class.java) { openKeyBackup(tampered, code) }
    }

    @Test
    fun aTamperedCiphertextDoesNotOpen() {
        val code = RecoveryCode.generate()
        val blob = sealKeyBackup(ActorKey.generate().seed(), code)
        val tampered = blob.copyOf()
        tampered[blob.size - 1] = (tampered[blob.size - 1].toInt() xor 1).toByte()
        assertThrows(KeyBackupException::class.java) { openKeyBackup(tampered, code) }
    }

    @Test
    fun unsupportedVersionAndTruncationAreRefused() {
        val code = RecoveryCode.generate()
        val blob = sealKeyBackup(ActorKey.generate().seed(), code)
        val wrongVersion = blob.copyOf()
        wrongVersion[0] = 0x02
        assertThrows(KeyBackupException::class.java) { openKeyBackup(wrongVersion, code) }
        assertThrows(KeyBackupException::class.java) {
            openKeyBackup(blob.copyOfRange(0, 29), code)
        }
    }

    @Test
    fun sealRejectsMalformedInputs() {
        val code = RecoveryCode.generate()
        assertThrows(IllegalArgumentException::class.java) {
            sealKeyBackup(ByteArray(16), code)
        }
        assertThrows(IllegalArgumentException::class.java) {
            sealKeyBackupWith(ByteArray(32), code, salt = ByteArray(8), nonce = ByteArray(12))
        }
        assertThrows(IllegalArgumentException::class.java) {
            sealKeyBackupWith(ByteArray(32), code, salt = ByteArray(16), nonce = ByteArray(8))
        }
        assertThrows(IllegalArgumentException::class.java) { RecoveryCode(ByteArray(8)) }
    }

    @Test
    fun displayGroupsAndInputNormalizes() {
        val code = RecoveryCode.generate()
        val display = code.display()
        assertThat(display).matches("[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}-[0-9A-HJKMNP-TV-Z]{6}")
        // Lowercase, confusable letters, and stray separators all read back.
        val sloppy = display.lowercase()
            .replace('1', 'l')
            .replace('0', 'o')
            .replace("-", " - ")
        assertThat(RecoveryCode.fromInput(sloppy).bytes()).isEqualTo(code.bytes())
    }

    @Test
    fun inputRefusesWrongLengthAndBadCharacters() {
        assertThrows(KeyBackupException::class.java) { RecoveryCode.fromInput("TOO-SHORT") }
        assertThrows(KeyBackupException::class.java) {
            // 'U' is not in the Crockford alphabet.
            RecoveryCode.fromInput("U".repeat(26))
        }
        // A wrong final character with nonzero pad bits is refused, not
        // silently truncated.
        val display = RecoveryCode(ByteArray(16)).display()
        assertThrows(KeyBackupException::class.java) {
            RecoveryCode.fromInput(display.dropLast(1) + "Z")
        }
    }

    // Only the length is a shape complaint the reader can act on; a
    // full-length input that will not decode is a wrong code, and
    // saying "that isn't a code" about a one-character typo misleads.
    @Test
    fun onlyAWrongLengthReportsAsAShapeProblem() {
        assertThrows(RecoveryCodeLengthException::class.java) {
            RecoveryCode.fromInput("TOO-SHORT")
        }
        val display = RecoveryCode(ByteArray(16)).display()
        for (input in listOf(display.dropLast(1) + "Z", "U".repeat(26))) {
            val thrown = assertThrows(KeyBackupException::class.java) {
                RecoveryCode.fromInput(input)
            }
            assertThat(thrown).isNotInstanceOf(RecoveryCodeLengthException::class.java)
        }
    }
}
