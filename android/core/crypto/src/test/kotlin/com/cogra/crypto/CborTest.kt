package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertThrows
import org.junit.Test

class CborTest {

    @Test
    fun valuesRoundTrip() {
        val bytes = CborEncoder()
            .array(6u)
            .uint(4_294_967_296u)
            .bytes(byteArrayOf(1, 2, 3))
            .text("héllo → ✓")
            .float(-0.25)
            .nul()
            .array(0u)
            .finish()
        val d = CborDecoder(bytes)
        assertThat(d.array()).isEqualTo(6UL)
        assertThat(d.uint()).isEqualTo(4_294_967_296UL)
        assertThat(d.bytes()).isEqualTo(byteArrayOf(1, 2, 3))
        assertThat(d.text()).isEqualTo("héllo → ✓")
        assertThat(d.float()).isEqualTo(-0.25)
        assertThat(d.textOrNull()).isNull()
        assertThat(d.array()).isEqualTo(0UL)
        d.finish()
    }

    @Test
    fun textOrNullReadsText() {
        val d = CborDecoder(CborEncoder().text("x").finish())
        assertThat(d.textOrNull()).isEqualTo("x")
        d.finish()
    }

    @Test
    fun decoderIsLenientAboutHeadWidths() {
        // uint 1 in the two-byte form (0x18 0x01) still reads as 1 —
        // signing bases are re-encoded canonically, so wire-level
        // canonicality is never load-bearing.
        assertThat(CborDecoder(byteArrayOf(0x18, 0x01)).uint()).isEqualTo(1UL)
    }

    @Test
    fun truncatedInputIsRefused() {
        assertThrows(CborDecodeException::class.java) { CborDecoder(byteArrayOf()).uint() }
        assertThrows(CborDecodeException::class.java) {
            CborDecoder(byteArrayOf(0x42, 0x01)).bytes()
        }
        assertThrows(CborDecodeException::class.java) {
            // 8-byte float head with a missing tail.
            CborDecoder(byteArrayOf(0xFB.toByte(), 0x3F)).float()
        }
    }

    @Test
    fun wrongMajorTypeIsRefused() {
        val text = CborEncoder().text("x").finish()
        assertThrows(CborDecodeException::class.java) { CborDecoder(text).uint() }
        assertThrows(CborDecodeException::class.java) { CborDecoder(text).bytes() }
        assertThrows(CborDecodeException::class.java) { CborDecoder(text).array() }
        assertThrows(CborDecodeException::class.java) { CborDecoder(text).float() }
    }

    @Test
    fun unsupportedHeadIsRefused() {
        // Indefinite-length head (additional info 31) is outside the subset.
        assertThrows(CborDecodeException::class.java) {
            CborDecoder(byteArrayOf(0x1F)).uint()
        }
    }

    @Test
    fun invalidUtf8IsRefused() {
        // A 2-byte text item carrying an invalid UTF-8 sequence.
        assertThrows(CborDecodeException::class.java) {
            CborDecoder(byteArrayOf(0x62, 0xC3.toByte(), 0x28)).text()
        }
    }

    @Test
    fun trailingInputIsRefused() {
        val d = CborDecoder(byteArrayOf(0x01, 0x02))
        d.uint()
        assertThrows(CborDecodeException::class.java) { d.finish() }
    }

    @Test
    fun encodingIsDeterministic() {
        val once = CborEncoder().array(3u).text("act:x:1:opinion").float(0.5).bytes(byteArrayOf(7)).finish()
        val twice = CborEncoder().array(3u).text("act:x:1:opinion").float(0.5).bytes(byteArrayOf(7)).finish()
        assertThat(once).isEqualTo(twice)
    }

    @Test
    fun negativeZeroKeepsItsSignBit() {
        assertThat(CborEncoder().float(-0.0).finish())
            .isEqualTo(byteArrayOf(0xFB.toByte(), 0x80.toByte(), 0, 0, 0, 0, 0, 0, 0))
    }
}
