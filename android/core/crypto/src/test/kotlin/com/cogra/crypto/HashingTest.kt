package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class HashingTest {

    /**
     * All eight tags in [Tags] are ASCII, so this is latent rather than
     * live — which is exactly why it is worth a test: a US-ASCII
     * encoder REPLACES what it cannot represent, so the first non-ASCII
     * tag would silently hash `?` and diverge from every other client
     * with nothing in the digest to say why.
     */
    @Test
    fun aNonAsciiTagHashesItsOwnBytes() {
        val parts = listOf(byteArrayOf(1, 2))
        val accented = sha256Tagged("cogra-l1:é:v1", parts)
        val replaced = sha256Tagged("cogra-l1:?:v1", parts)
        assertThat(accented.toHex()).isNotEqualTo(replaced.toHex())
    }

    /** The tag is framed by its byte length, not its character count. */
    @Test
    fun theTagIsFramedByItsUtf8Length() {
        val parts = listOf(byteArrayOf(3))
        // Two tags of equal character length but different byte length.
        assertThat(sha256Tagged("é", parts).toHex()).isNotEqualTo(sha256Tagged("e", parts).toHex())
    }
}
