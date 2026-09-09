// The one media screening, parameterized by surface.
//
// A comment is the post's grammar at half the byte budget, so the two
// composers differ in exactly the values named here and nothing else —
// which is why they are a parameter rather than a second copy of the
// rules. Written twice, the two copies drift: one gains a check the
// other never gets, and the composer that lets a file through hands the
// refusal to the reader after the upload instead of at the pick.
//
// The web client factors the same screening the same way
// (`web/src/lib/compose/pick.ts`, `PickScale`).
//
// What is NOT here: what a surface DOES with a refusal. The post
// composer marks the asset failed and keeps it on the tray; the reply
// composer drops the pick and shows the refusal beside the composer.
// Those are two boards, not one rule.

package com.cogra.feature.content.wizard

import com.cogra.domain.media.MediaProcessor

/** A post's clip: the same hundred megabytes a full gallery costs. */
internal const val POST_VIDEO_MAX_BYTES = 100L * 1024 * 1024

/** A comment's clip — half a post's. */
internal const val COMMENT_VIDEO_MAX_BYTES = 50L * 1024 * 1024

/**
 * What a surface's clip costs and what a file over that cap is refused
 * as. A still's cap is not here: it is the same on both surfaces and it
 * is spent at the upload, on the encode's own bytes
 * (`com.cogra.domain.media.overPictureCap`).
 */
internal data class PickScale(val videoMaxBytes: Long, val tooBigVideo: UploadFailure)

internal val POST_SCALE = PickScale(
    videoMaxBytes = POST_VIDEO_MAX_BYTES,
    tooBigVideo = UploadFailure.POST_VIDEO_TOO_BIG,
)

internal val COMMENT_SCALE = PickScale(
    videoMaxBytes = COMMENT_VIDEO_MAX_BYTES,
    tooBigVideo = UploadFailure.COMMENT_VIDEO_TOO_BIG,
)

/**
 * Screens one picked picture. Null means it may join the composer;
 * otherwise the refusal the surface draws.
 *
 * [knownReadable] is true for a file the grid itself listed — those
 * came out of `MediaStore` and decode by construction, so asking the
 * decoder again buys nothing. Everything else (the system picker, a
 * dropped-in file) is read before it is accepted, because a file
 * refused where it was offered is far better than one accepted and
 * failed at upload.
 *
 * NO SIZE CHECK ON A PICTURE HERE. The cap is on the bytes that are
 * UPLOADED, and a still is downscaled to 1080 and re-encoded to WebP
 * before any of them leave (`ImageProcessing`), so a phone camera's
 * twelve-megabyte original becomes a few hundred kilobytes. Screening
 * the SOURCE against the upload cap refused ordinary camera photos the
 * product would have taken happily; the upload weighs the encode's
 * output instead (`overPictureCap`), which is the thing the server
 * actually measures. A clip carries no such shrinking pass at the pick,
 * which is why [refusesVideo] still exists — judged on the transcode's
 * output for the same reason.
 */
internal suspend fun screenPicture(
    uri: String,
    processor: MediaProcessor,
    knownReadable: Boolean = false,
): RefusedPick? =
    if (!knownReadable && processor.aspectRatio(uri) == null) {
        // No preview to draw for a file nothing can read, so no uri.
        RefusedPick(uri = null, reason = UploadFailure.UNREADABLE_FILE)
    } else {
        null
    }

/**
 * Whether a re-encoded clip still exceeds what this surface sends.
 *
 * Judged on the transcode's output, not the recording: re-encoding is
 * precisely what usually brings a long recording under the cap, so
 * weighing the original would refuse posts the caps mean to allow. The
 * backend only refuses at prepare, which is far too late to be told.
 */
internal fun PickScale.refusesVideo(byteCount: Long): Boolean = byteCount > videoMaxBytes
