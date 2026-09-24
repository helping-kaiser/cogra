// The picked-asset algebra, once. Three state types carry a
// `List<PickedAsset>` and used to re-implement the same transitions
// over it — byte-identical bodies, differing only in the receiver — so
// the operations live here and each state delegates
// (android/CLAUDE.md "Module discipline").

package com.cogra.feature.content.wizard

import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.CropFraming
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.domain.MediaAssetState
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.VideoProcessor
import com.cogra.domain.media.awaitReady
import com.cogra.domain.media.overPictureCap

/** Records one asset's upload state without disturbing the others (D5). */
fun List<PickedAsset>.withUpload(uri: String, upload: AssetUpload): List<PickedAsset> =
    map { if (it.uri == uri) it.copy(upload = upload) else it }

/** Records an asset's own ratio once the pipeline has read it. */
fun List<PickedAsset>.withSourceRatio(uri: String, ratio: Float): List<PickedAsset> =
    map { if (it.uri == uri) it.copy(sourceRatio = ratio) else it }

/** The alt text one asset carries — authored, never generated (D20). */
fun List<PickedAsset>.withAltText(uri: String, text: String): List<PickedAsset> =
    map { if (it.uri == uri) it.copy(altText = text) else it }

/**
 * The picks as the components see them.
 *
 * [framingOf] is the one place the surfaces genuinely differ: the post
 * wizard has a crop stage and hands back the author's window, while the
 * comment surfaces show whole frames and hand back nothing.
 */
fun List<PickedAsset>.pickedPictures(
    framingOf: (PickedAsset) -> CropFraming = { CropFraming.Whole },
): List<PickedPicture> = map { asset ->
    PickedPicture(
        item = MediaItem(
            asset.uri,
            asset.sourceRatio ?: 1f,
            asset.altText.ifBlank { null },
            framingOf(asset),
        ),
        described = asset.altText.isNotBlank(),
        uploading = asset.upload.inFlight,
        failed = asset.upload is AssetUpload.Failed,
        // A clip's tile says it is a clip. Without this the composer's
        // summary drew a video body as an undated square and read it out
        // as a picture.
        duration = asset.durationMs?.let { formatDuration(it) },
    )
}

/**
 * One picked picture's journey — process, then upload — as the upload
 * state to record when it ends.
 *
 * The three composers ran identical copies of this: process, refuse
 * what does not decode (the client half of the decode gate, D11), then
 * the same three-branch `when` over the outcome. Only the copy for a
 * refusal differed, so that is the parameter.
 *
 * THE STILL CAP IS SPENT HERE, on the encode's own bytes rather than on
 * the picked file: the pipeline downscales to 1080 and re-encodes to
 * WebP first, so this is the only weighing that matches what the server
 * measures — and it is what makes the refusal unreachable for an
 * ordinary camera photo instead of routine (HT-17).
 */
internal suspend fun uploadPicture(
    uri: String,
    crop: CropSpec,
    processor: MediaProcessor,
    media: MediaRepository,
    unreadable: UploadFailure = UploadFailure.UNREADABLE_PICTURE,
    refused: UploadFailure = UploadFailure.REFUSED_PICTURE,
): AssetUpload {
    val picture = processor.process(uri, crop)
        ?: return AssetUpload.Failed(unreadable)
    // Not worth retrying: the same source encodes to the same bytes.
    if (picture.overPictureCap()) return AssetUpload.Failed(UploadFailure.PICTURE_TOO_BIG)
    // READY answers here at once — no extra request: Android's own
    // uploads are always within target. `awaitReady` only starts
    // polling for the backstop case, a PROCESSING asset.
    return when (val outcome = media.awaitReady(media.uploadMedia(picture))) {
        is Outcome.Success -> outcome.value.toResolvedUpload(refused)
        is Outcome.Refused -> AssetUpload.Failed(refused, outcome.errors.firstOrNull()?.message)
        is Outcome.Failed -> AssetUpload.Failed(UploadFailure.TRANSPORT)
    }
}

/** How the skipped step's still ended ([uploadFirstFrame]). */
internal sealed interface FirstFrameStill {
    /** Frame 1 is on the server: the clip names it as its still. */
    data class Stored(val mediaId: String) : FirstFrameStill

    /**
     * No still could be made or kept. SILENT: the post ships without one
     * and the reading surfaces' neutral tile stands (`Cover · no frames
     * came back`) — the author chose nothing, so nothing is theirs to fix.
     */
    data object Absent : FirstFrameStill

    /**
     * The network failed underneath it — a fault, not an answer, so it
     * rides the clip's own failure line and its retry, which extracts
     * again.
     */
    data object Fault : FirstFrameStill
}

/**
 * THE SKIPPED STEP STILL TAKES FRAME 1 (design/readme.md "The feed-video
 * rulings — 2026-09-23"; `ComposeDetailsVideo.jsx`): skipping the cover
 * step skips the CHOICE, not the still. Frame 1 is extracted with the
 * frame picker's own machinery and uploaded as an ordinary still, on the
 * cover's own leg.
 *
 * Everything that means "there is no still to keep" — no frame came
 * back, the frame is over the still cap, the server refused it — ends
 * [FirstFrameStill.Absent], never a failure the author meets: an error
 * about a picture they did not ask for, on a step they never saw, has no
 * way out worth offering. Only a transport fault is reported, because a
 * retry can mend it.
 */
internal suspend fun uploadFirstFrame(
    uri: String,
    video: VideoProcessor,
    media: MediaRepository,
): FirstFrameStill {
    val still = video.firstFrame(uri)?.takeUnless { it.overPictureCap() }
        ?: return FirstFrameStill.Absent
    return when (val outcome = media.awaitReady(media.uploadMedia(still))) {
        is Outcome.Success -> if (outcome.value.state == MediaAssetState.READY) {
            FirstFrameStill.Stored(outcome.value.id)
        } else {
            FirstFrameStill.Absent
        }
        is Outcome.Refused -> FirstFrameStill.Absent
        is Outcome.Failed -> FirstFrameStill.Fault
    }
}

/**
 * The upload state a *resolved* asset settles into — one already past
 * `awaitReady`, so never PROCESSING. Shared by every call site that
 * uploads a picture, a clip, or a clip's cover
 * (`uploadPicture`, `WizardUploader`, `ReplyWizardViewModel`): each
 * only differs in which [UploadFailure] names a business refusal for
 * its own kind of asset.
 *
 * FAILED is never retryable here: the bytes already made the round
 * trip and the server refused them on inspection, so asking again would
 * send the identical bytes into the identical answer. UNKNOWN — a
 * server state this build was not shipped knowing about — is treated
 * the same way, conservatively.
 */
internal fun MediaAssetView.toResolvedUpload(refused: UploadFailure): AssetUpload = when (state) {
    MediaAssetState.READY -> AssetUpload.Done(id)
    MediaAssetState.FAILED, MediaAssetState.UNKNOWN ->
        AssetUpload.Failed(refused, failureReason, retryable = false)
    MediaAssetState.PROCESSING -> error("awaitReady never returns Success while PROCESSING")
}
