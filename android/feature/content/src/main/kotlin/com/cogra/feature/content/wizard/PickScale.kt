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

/** A still's cap, the same on both surfaces: ten mebibytes (D9). */
internal const val PICTURE_MAX_BYTES = 10L * 1024 * 1024

/** A post's clip: the same hundred megabytes a full gallery costs. */
internal const val POST_VIDEO_MAX_BYTES = 100L * 1024 * 1024

/** A comment's clip — half a post's. */
internal const val COMMENT_VIDEO_MAX_BYTES = 50L * 1024 * 1024

/**
 * What a surface's media costs and what a file over the clip cap is
 * refused as.
 */
internal data class PickScale(val pictureMaxBytes: Long, val videoMaxBytes: Long, val tooBigVideo: UploadFailure)

internal val POST_SCALE = PickScale(
    pictureMaxBytes = PICTURE_MAX_BYTES,
    videoMaxBytes = POST_VIDEO_MAX_BYTES,
    tooBigVideo = UploadFailure.POST_VIDEO_TOO_BIG,
)

internal val COMMENT_SCALE = PickScale(
    pictureMaxBytes = PICTURE_MAX_BYTES,
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
 * A picture is weighed as it stands rather than after the pipeline
 * downscales it: the board weighs the file the author offered, and a
 * cap nobody can predict is worse than one they can. A clip is weighed
 * the other way round — see [refusesVideo].
 */
internal suspend fun screenPicture(
    uri: String,
    processor: MediaProcessor,
    scale: PickScale,
    knownReadable: Boolean = false,
): RefusedPick? {
    if (!knownReadable && processor.aspectRatio(uri) == null) {
        // No preview to draw for a file nothing can read, so no uri.
        return RefusedPick(uri = null, reason = UploadFailure.UNREADABLE_FILE)
    }
    val size = processor.sizeBytes(uri)
    return if (size != null && size > scale.pictureMaxBytes) {
        RefusedPick(uri = uri, reason = UploadFailure.PICTURE_TOO_BIG)
    } else {
        null
    }
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
