package com.cogra.feature.content.wizard

/**
 * Why one picked asset did not make it up.
 *
 * State names the reason; the screen resolves it to words. The copy
 * itself is blessed verbatim in `design/guidelines/copy-voice.md`
 * "Refused files" and lives in `strings.xml` like every other line the
 * app shows — carrying prose through the state layer is what made the
 * same sentence appear as a Kotlin literal in four files at once.
 *
 * **Screens say MB; the caps are MiB.** The enforced limit is the
 * binary one, so the number shown under-promises and can never turn a
 * file the product would have accepted into a refusal.
 */
enum class UploadFailure {
    /** The bytes did not decode as a picture — the client half of the decode gate (D11). */
    UNREADABLE_PICTURE,

    /** The bytes did not decode as a video. */
    UNREADABLE_VIDEO,

    /** Neither, so nothing can be done with the pick at all. */
    UNREADABLE_FILE,

    /** The chosen face did not decode. */
    UNREADABLE_COVER,

    /** The server refused the picture. */
    REFUSED_PICTURE,

    /** The server refused the clip. */
    REFUSED_VIDEO,

    /** The server refused the cover. */
    REFUSED_COVER,

    /** Over the still cap, before a byte leaves. */
    PICTURE_TOO_BIG,

    /** Over a post's clip cap. */
    POST_VIDEO_TOO_BIG,

    /** Over a comment's clip cap — half a post's. */
    COMMENT_VIDEO_TOO_BIG,

    /** The upload never reached the server. */
    TRANSPORT,
}
