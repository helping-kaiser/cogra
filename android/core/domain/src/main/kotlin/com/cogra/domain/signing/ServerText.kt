// The server's own text normalization, mirrored for the intent check
// (web mirror: src/lib/signing/intent.ts `serverTrim`). The server trims a
// title, a description and alt text with Rust's `str::trim`, whose
// whitespace set is Unicode's White_Space property. Kotlin's `trim` is not
// that set — it trims U+001C–U+001F and leaves U+0085 — so a naive trim here
// would refuse lawful writes or accept altered ones. `intent-vectors.json`'s
// `trims` group pins this file to the reference.

package com.cogra.domain.signing

/** Unicode's White_Space property, all of it inside the Basic Multilingual Plane. */
private val WHITE_SPACE: List<CharRange> =
    listOf(
        '\u0009'..'\u000D',
        ' '..' ',
        '\u0085'..'\u0085',
        ' '..' ',
        ' '..' ',
        ' '..' ',
        ' '..' ',
        ' '..' ',
        ' '..' ',
        '　'..'　',
    )

/** What Rust's `char::is_whitespace` reads. */
private fun isServerWhitespace(codePoint: Int): Boolean =
    codePoint <= Char.MAX_VALUE.code && WHITE_SPACE.any { codePoint.toChar() in it }

/** Rust's `str::trim`: White_Space off both ends, nothing else. */
fun serverTrim(s: String): String {
    val points = s.codePoints().toArray()
    var start = 0
    var end = points.size
    while (start < end && isServerWhitespace(points[start])) start++
    while (end > start && isServerWhitespace(points[end - 1])) end--
    return String(points, start, end - start)
}

/** A title, description or alt text as the server carries it: trimmed, blank folded to absent. */
fun serverChecked(s: String?): String? = s?.let(::serverTrim)?.ifEmpty { null }

/** Words or a reason as the server carries them: untouched, blank folded to absent. */
fun serverBlankFolded(s: String?): String? = s?.takeUnless { serverTrim(it).isEmpty() }
