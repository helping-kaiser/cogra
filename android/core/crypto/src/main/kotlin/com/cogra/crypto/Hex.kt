// Hex, once. The Rust reference routes every one of these through the
// `hex` crate and the web client through its own bytes module; this is
// Android's equivalent, so the encoding is not re-typed per call site.
//
// Hand-rolled rather than `java.util.HexFormat`: the module is plain
// Kotlin but ships inside the Android app, where minSdk 26 has no
// `java.util.HexFormat` and core-library desugaring does not supply it.

package com.cogra.crypto

private const val HEX_DIGITS = "0123456789abcdef"

/** Lowercase hex, two characters per byte. */
fun ByteArray.toHex(): String {
    val out = StringBuilder(size * 2)
    for (b in this) {
        val v = b.toInt() and 0xFF
        out.append(HEX_DIGITS[v ushr 4]).append(HEX_DIGITS[v and 0x0F])
    }
    return out.toString()
}

/** The inverse, for the pinned strings the vectors carry. */
fun String.hexToBytes(): ByteArray {
    require(length % 2 == 0) { "a hex string has an even number of characters" }
    return ByteArray(length / 2) { i ->
        val hi = Character.digit(this[i * 2], 16)
        val lo = Character.digit(this[i * 2 + 1], 16)
        require(hi >= 0 && lo >= 0) { "not a hex string" }
        ((hi shl 4) or lo).toByte()
    }
}
