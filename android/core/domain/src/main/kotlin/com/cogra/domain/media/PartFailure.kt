package com.cogra.domain.media

/**
 * Why a resumable upload stopped, as a value rather than a sentence.
 *
 * The part uploader distinguishes three outcomes and the repository
 * above it has to tell them apart — a part the store *refused* is a
 * business answer, and telling the author to check their connection
 * about it is advice that cannot help. Carrying a prose message instead
 * is what made all three arrive as the same "could not reach the
 * server".
 */
enum class PartFailure {
    /** The file could not be read into parts of the dictated size. */
    UNREADABLE,

    /** The store answered, and the answer was no. */
    REFUSED,

    /** The bytes never landed: the connection, or a spent retry budget. */
    TRANSPORT,
}
