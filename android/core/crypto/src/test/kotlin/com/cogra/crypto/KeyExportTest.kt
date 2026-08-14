package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertThrows
import org.junit.Test

class KeyExportTest {

    // RFC 8410 §10.3's Ed25519 private-key example: the standard's own
    // vector, so both clients encode against the spec rather than
    // against each other.
    private val rfc8410Seed = byteArrayOf(
        0xd4.toByte(), 0xee.toByte(), 0x72, 0xdb.toByte(), 0xf9.toByte(), 0x13, 0x58, 0x4a,
        0xd5.toByte(), 0xb6.toByte(), 0xd8.toByte(), 0xf1.toByte(), 0xf7.toByte(), 0x69,
        0xf8.toByte(), 0xad.toByte(), 0x3a, 0xfe.toByte(), 0x7c, 0x28, 0xcb.toByte(),
        0xf1.toByte(), 0xd4.toByte(), 0xfb.toByte(), 0xe0.toByte(), 0x97.toByte(),
        0xa8.toByte(), 0x8f.toByte(), 0x44, 0x75, 0x58, 0x42,
    )

    private val rfc8410Pem = """
        -----BEGIN PRIVATE KEY-----
        MC4CAQAwBQYDK2VwBCIEINTuctv5E1hK1bbY8fdp+K06/nwoy/HU++CXqI9EdVhC
        -----END PRIVATE KEY-----
    """.trimIndent()

    @Test
    fun theSeedEncodesToTheStandardsOwnPem() {
        assertThat(exportActorSeed(rfc8410Seed).pem).isEqualTo(rfc8410Pem)
    }

    @Test
    fun theHexFormIsTheRawSeed() {
        assertThat(exportActorSeed(rfc8410Seed).hex)
            .isEqualTo("d4ee72dbf913584ad5b6d8f1f769f8ad3afe7c28cbf1d4fbe097a88f44755842")
    }

    /** The PEM is the private key: it must import back as the same key. */
    @Test
    fun thePemCarriesTheKeyItselfNotACopyOfThePublicHalf() {
        val exported = exportActorSeed(rfc8410Seed)
        val der = java.util.Base64.getDecoder().decode(
            exported.pem.lines().drop(1).dropLast(1).joinToString(""),
        )
        assertThat(der.copyOfRange(16, der.size)).isEqualTo(rfc8410Seed)
        assertThat(der.size).isEqualTo(48)
    }

    @Test
    fun aNonSeedLengthIsRefused() {
        assertThrows(IllegalArgumentException::class.java) { exportActorSeed(ByteArray(31)) }
    }
}
