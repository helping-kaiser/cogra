// Canonical serialization for seam objects — the deterministic subset of
// CBOR (RFC 8949) the deployment fixed: definite lengths only,
// shortest-form integer heads, IEEE 754 double-precision floats, field
// order fixed by the encoder, no maps. Byte-for-byte the encoding of
// crates/common/src/l1/encoding.rs; the golden vectors pin the layout.

package com.cogra.crypto

import java.io.ByteArrayOutputStream

/** A decode failure over the deterministic subset. */
class CborDecodeException(message: String) : Exception(message)

/** Deterministic CBOR writer over the subset the seam needs. */
class CborEncoder {
    private val out = ByteArrayOutputStream()

    fun finish(): ByteArray = out.toByteArray()

    private fun head(major: Int, value: ULong) {
        val m = major shl 5
        when {
            value <= 23u -> out.write(m or value.toInt())
            value <= 0xFFu -> {
                out.write(m or 24)
                out.write(value.toInt())
            }
            value <= 0xFFFFu -> {
                out.write(m or 25)
                out.write((value shr 8).toInt() and 0xFF)
                out.write(value.toInt() and 0xFF)
            }
            value <= 0xFFFF_FFFFu -> {
                out.write(m or 26)
                for (shift in 24 downTo 0 step 8) out.write((value shr shift).toInt() and 0xFF)
            }
            else -> {
                out.write(m or 27)
                for (shift in 56 downTo 0 step 8) out.write((value shr shift).toInt() and 0xFF)
            }
        }
    }

    fun uint(v: ULong): CborEncoder {
        head(0, v)
        return this
    }

    fun bytes(b: ByteArray): CborEncoder {
        head(2, b.size.toULong())
        out.write(b)
        return this
    }

    fun text(s: String): CborEncoder {
        val utf8 = s.toByteArray(Charsets.UTF_8)
        head(3, utf8.size.toULong())
        out.write(utf8)
        return this
    }

    fun array(len: ULong): CborEncoder {
        head(4, len)
        return this
    }

    /**
     * Doubles are always encoded in the 8-byte form — one representation
     * per value, no shortest-float search.
     */
    fun float(v: Double): CborEncoder {
        out.write(0xFB)
        val bits = java.lang.Double.doubleToRawLongBits(v)
        for (shift in 56 downTo 0 step 8) out.write(((bits shr shift) and 0xFF).toInt())
        return this
    }

    fun nul(): CborEncoder {
        out.write(0xF6)
        return this
    }
}

/**
 * Reader over the same deterministic subset the [CborEncoder] writes.
 * Decoding is lenient about head widths — the signing bases are always
 * re-encoded canonically from the decoded values, so wire-level
 * canonicality is never load-bearing.
 */
class CborDecoder(private val input: ByteArray) {
    private var pos = 0

    private fun byte(): Int {
        if (pos >= input.size) throw CborDecodeException("unexpected end of input at byte $pos")
        return input[pos++].toInt() and 0xFF
    }

    private fun take(n: Int): ByteArray {
        if (n < 0 || pos + n > input.size) {
            throw CborDecodeException("unexpected end of input at byte $pos")
        }
        val slice = input.copyOfRange(pos, pos + n)
        pos += n
        return slice
    }

    private fun head(major: Int, expected: String): ULong {
        val at = pos
        val b = byte()
        if (b shr 5 != major) {
            throw CborDecodeException("expected $expected at byte $at, found major type ${b shr 5}")
        }
        return when (val info = b and 0x1F) {
            in 0..23 -> info.toULong()
            24 -> byte().toULong()
            25 -> take(2).fold(0UL) { acc, x -> (acc shl 8) or (x.toInt() and 0xFF).toULong() }
            26 -> take(4).fold(0UL) { acc, x -> (acc shl 8) or (x.toInt() and 0xFF).toULong() }
            27 -> take(8).fold(0UL) { acc, x -> (acc shl 8) or (x.toInt() and 0xFF).toULong() }
            else -> throw CborDecodeException("unsupported head byte ${"0x%02x".format(b)}")
        }
    }

    fun uint(): ULong = head(0, "uint")

    fun bytes(): ByteArray {
        val len = head(2, "bytes")
        return take(lengthToInt(len))
    }

    fun text(): String {
        val len = head(3, "text")
        val raw = take(lengthToInt(len))
        val decoded = String(raw, Charsets.UTF_8)
        // String() replaces malformed sequences; re-encoding detects them.
        if (!decoded.toByteArray(Charsets.UTF_8).contentEquals(raw)) {
            throw CborDecodeException("invalid UTF-8 in text item")
        }
        return decoded
    }

    fun array(): ULong = head(4, "array")

    fun float(): Double {
        val at = pos
        val b = byte()
        if (b != 0xFB) {
            throw CborDecodeException("expected float at byte $at, found major type ${b shr 5}")
        }
        val bits = take(8).fold(0L) { acc, x -> (acc shl 8) or (x.toLong() and 0xFF) }
        return java.lang.Double.longBitsToDouble(bits)
    }

    /** A text item or the null sentinel. */
    fun textOrNull(): String? {
        if (pos < input.size && input[pos].toInt() and 0xFF == 0xF6) {
            pos += 1
            return null
        }
        return text()
    }

    /** Asserts the input is fully consumed. */
    fun finish() {
        val rest = input.size - pos
        if (rest != 0) throw CborDecodeException("$rest bytes of trailing input")
    }

    private fun lengthToInt(len: ULong): Int {
        if (len > Int.MAX_VALUE.toULong()) {
            throw CborDecodeException("unexpected end of input at byte $pos")
        }
        return len.toInt()
    }
}
