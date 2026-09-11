// The caps on authored text the write side refuses past, mirrored from
// the server so a composer can say no before the round trip.
//
// The unit is the SERVER'S: Unicode scalar values, which is what Rust's
// `chars().count()` counts. Kotlin's `String.length` counts UTF-16 code
// units, so one astral character weighs two there and one here — measuring
// with `length` would refuse a title the server would have taken, and a
// mirror stricter than the thing it mirrors is worse than no mirror at all.
//
// The server stays the authority, as it does for topic names: every value
// still rides to it and a refusal surfaces on the offending field. This
// only lets the reader learn while typing.
//
// Pinned to `client-constants.json` by ClientConstantsTest.

package com.cogra.domain.content

/** Client mirror of the server's `MAX_TITLE_CHARS` (post.md §1). */
const val MAX_TITLE_CHARS = 100

/** Length as the server measures it — scalar values, not code units. */
fun authoredLength(text: String): Int {
    val trimmed = text.trim()
    return trimmed.codePointCount(0, trimmed.length)
}

/** Whether [title] is longer than a Post's title may be. */
fun isTitleTooLong(title: String): Boolean = authoredLength(title) > MAX_TITLE_CHARS
