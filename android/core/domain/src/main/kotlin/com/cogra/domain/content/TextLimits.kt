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

/** Client mirror of the server's `MAX_DESCRIPTION_CHARS`. */
const val MAX_DESCRIPTION_CHARS = 500

/** Client mirror of the server's `MAX_POST_BODY_CHARS`. */
const val MAX_POST_BODY_CHARS = 5000

/** Client mirror of the server's `MAX_COMMENT_BODY_CHARS`. */
const val MAX_COMMENT_BODY_CHARS = 2000

/** Client mirror of the server's `MAX_SENSITIVE_REASON_CHARS`. */
const val MAX_SENSITIVE_REASON_CHARS = 140

/** Client mirror of the server's `MAX_DISPLAY_NAME_CHARS`. */
const val MAX_DISPLAY_NAME_CHARS = 50

/** Client mirror of the server's `MAX_BIO_CHARS`. */
const val MAX_BIO_CHARS = 500

/** Client mirror of the server's `MAX_WEBSITE_URL_CHARS`. */
const val MAX_WEBSITE_URL_CHARS = 2048

/** Length as the server measures it — scalar values, not code units. */
fun authoredLength(text: String): Int {
    val trimmed = text.trim()
    return trimmed.codePointCount(0, trimmed.length)
}

/** Whether [title] is longer than a Post's title may be. */
fun isTitleTooLong(title: String): Boolean = authoredLength(title) > MAX_TITLE_CHARS

/** Whether [text] is longer than a Post's description may be. */
fun isDescriptionTooLong(text: String): Boolean = authoredLength(text) > MAX_DESCRIPTION_CHARS

/** Whether [text] is longer than a Post's words body may be. */
fun isPostBodyTooLong(text: String): Boolean = authoredLength(text) > MAX_POST_BODY_CHARS

/** Whether [text] is longer than a Comment's body may be. */
fun isCommentBodyTooLong(text: String): Boolean = authoredLength(text) > MAX_COMMENT_BODY_CHARS

/** Whether [text] is longer than a sensitive mark's reason may be. */
fun isSensitiveReasonTooLong(text: String): Boolean =
    authoredLength(text) > MAX_SENSITIVE_REASON_CHARS

/** Whether [text] is longer than a profile's display name may be. */
fun isDisplayNameTooLong(text: String): Boolean = authoredLength(text) > MAX_DISPLAY_NAME_CHARS

/** Whether [text] is longer than a profile's bio may be. */
fun isBioTooLong(text: String): Boolean = authoredLength(text) > MAX_BIO_CHARS

/** Whether [text] is longer than a profile's website URL may be. */
fun isWebsiteUrlTooLong(text: String): Boolean = authoredLength(text) > MAX_WEBSITE_URL_CHARS
