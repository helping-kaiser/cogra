// EVERY PICKED ASSET'S JOURNEY ONTO THE SERVER, in one place.
//
// A picked picture, a picked clip, and the clip's chosen face each go
// up as their own coroutine, independently retryable (D5) — this
// collaborator is where that coroutine lives, from the call that
// starts it to the outcome the state records.
//
// It is a collaborator rather than a region of the view model for the
// reason `SectionsEditor` already is one in this feature: a cluster
// that only needs the state flow, a scope and its own sources is a
// cluster that can be held somewhere else, and the view model is the
// poorer for holding it. The job map and the emerging upload-session id
// stay the view model's own to hold — a cancelled pick and a departed
// author both reach for them independently of any one upload — so they
// cross the boundary as a shared reference and a callback rather than
// moving in whole.

package com.cogra.feature.content.wizard

import com.cogra.domain.Outcome
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.UploadProgress
import com.cogra.domain.media.VideoProcessor
import com.cogra.domain.media.awaitReady
import com.cogra.domain.media.overPictureCap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

internal class WizardUploader(
    private val scope: CoroutineScope,
    private val state: MutableStateFlow<ComposeWizardState>,
    private val video: VideoProcessor,
    private val processor: MediaProcessor,
    private val media: MediaRepository,
    private val jobs: MutableMap<String, Job>,
    private val onUploadSessionStarted: (String) -> Unit,
) {

    /**
     * The only thing this composer and the reply composer differ by in
     * their media screening (`PickScale.kt`).
     */
    private val scale = POST_SCALE

    /** Retries exactly one asset — the point of the one-call-per-asset shape. */
    fun onRetryUpload(uri: String) {
        val current = state.value
        val asset = current.picked.firstOrNull { it.uri == uri } ?: return
        if (asset.upload.inFlight) return
        if (asset.isVideo) {
            startVideoUpload()
            return
        }
        upload(uri, current.crops[uri] ?: CropSpec(current.shape.ratio()))
    }

    /**
     * The clip's whole journey: its face first when it has one, then the
     * bytes.
     *
     * Two standalone uploads where a cover was chosen, and the order is
     * this way because the cover is the cheap leg: a refused cover is
     * learned in a second, instead of after a minute of transcoding and
     * a ninety-megabyte send. The placement names the poster's id at
     * prepare, so the id has to exist by then rather than by the time
     * the clip goes up.
     *
     * A NEW FACE NEVER MOVES THE CLIP'S BYTES. The placement names the
     * face at prepare, so a clip already on the server stays there while
     * a face chosen afterwards — through the details door, or after
     * stepping back — goes up on its own; and a journey with nothing left
     * to send does nothing at all.
     *
     * A clip with no face chosen — skipped or declined alike
     * ([storesFirstFrame]) — stores frame 1 on this leg instead
     * ([uploadFirstFrame]): the same leg, the same order, and the same
     * gate as a chosen face. The offered frames are slice midpoints that
     * keep off frame 0, so frame 1 is always extracted on its own.
     */
    fun startVideoUpload() {
        val current = state.value
        val clip = current.video ?: return
        if (clip.upload is AssetUpload.Done && current.coverSettled) return
        jobs.remove(clip.uri)?.cancel()
        jobs[clip.uri] = scope.launch {
            val choice = state.value.coverChoice
            val coverId = when {
                choice.storesFirstFrame -> when (val still = firstFrameStill(clip.uri)) {
                    is FirstFrameStill.Stored -> still.mediaId
                    FirstFrameStill.Absent -> null
                    FirstFrameStill.Fault -> return@launch
                }
                choice is CoverChoice.None || choice is CoverChoice.NoStill -> null
                else -> state.value.coverMediaId ?: uploadCover() ?: return@launch
            }
            state.update { it.withCoverIdFor(choice, coverId) }
            if (state.value.video?.upload is AssetUpload.Done) return@launch
            sendClip(clip.uri)
        }
    }

    /**
     * Frame 1's id, reusing one already stored; an absent still settles
     * to [CoverChoice.NoStill], silently, and a fault lands on the clip's
     * own failure line, where its retry extracts again.
     */
    private suspend fun firstFrameStill(uri: String): FirstFrameStill {
        state.value.coverMediaId?.let { return FirstFrameStill.Stored(it) }
        val still = uploadFirstFrame(uri, video, media)
        when (still) {
            is FirstFrameStill.Stored -> Unit
            FirstFrameStill.Absent -> state.update { it.withoutFirstFrame() }
            FirstFrameStill.Fault -> state.update {
                it.withUpload(uri, AssetUpload.Failed(UploadFailure.TRANSPORT))
            }
        }
        return still
    }

    /** The clip's own leg: re-encoded, weighed, then sent. */
    private suspend fun sendClip(uri: String) {
        state.update { it.withUpload(uri, AssetUpload.Transcoding(0)) }
        val processed = video.transcode(uri, scale.videoMaxBytes) { percent ->
            state.update { it.withUpload(uri, AssetUpload.Transcoding(percent)) }
        }
        if (processed == null) {
            state.update { it.withUpload(uri, AssetUpload.Failed(UploadFailure.UNREADABLE_VIDEO)) }
            return
        }
        // The clip's half of the shared screening (`PickScale.kt`),
        // which is why it runs here rather than at pick time.
        if (scale.refusesVideo(processed.byteCount)) {
            state.update { it.withUpload(uri, AssetUpload.Failed(scale.tooBigVideo)) }
            runCatching { File(processed.path).delete() }
            return
        }

        state.update { it.withUpload(uri, AssetUpload.Running) }
        val sending = { progress: UploadProgress ->
            onUploadSessionStarted(progress.uploadId)
            state.update { it.withUpload(uri, AssetUpload.Sending(progress.percent)) }
        }
        // READY answers here at once — no extra request. `awaitReady`
        // only starts polling for the backstop case, a PROCESSING
        // asset (Android's own uploads are always within target).
        when (val outcome = media.awaitReady(media.uploadVideo(processed, scale.destination, sending))) {
            is Outcome.Success -> state.update {
                it.withUpload(uri, outcome.value.toResolvedUpload(UploadFailure.REFUSED_VIDEO))
            }
            is Outcome.Refused -> state.update {
                it.withUpload(
                    uri,
                    AssetUpload.Failed(UploadFailure.REFUSED_VIDEO, outcome.errors.firstOrNull()?.message),
                )
            }
            is Outcome.Failed -> state.update {
                it.withUpload(uri, AssetUpload.Failed(UploadFailure.TRANSPORT))
            }
        }
        // The transcode's cache copy has served its purpose either
        // way: the bytes are on the server, or the attempt failed
        // and a retry re-encodes from the original.
        runCatching { File(processed.path).delete() }
    }

    /**
     * Uploads whatever the author chose as the face, as its own still.
     *
     * A frame arrives already processed — the pipeline shaped it exactly
     * as it shapes a picked picture. A chosen picture is processed here,
     * framed to the clip's own shape: a poster that is not the video's
     * shape would letterbox the thing it stands in for.
     *
     * Never called for [CoverChoice.None] or [CoverChoice.FirstFrame] —
     * [startVideoUpload] routes both elsewhere — so that branch is
     * unreached in practice; it fails loudly rather than silently if
     * that invariant ever breaks.
     */
    private suspend fun uploadCover(): String? {
        val current = state.value
        val clip = current.video ?: return null
        val picture = when (val choice = current.coverChoice) {
            CoverChoice.None, CoverChoice.FirstFrame, CoverChoice.NoStill -> null
            is CoverChoice.Frame -> current.coverFrames.getOrNull(choice.index)?.picture
            is CoverChoice.Picture -> processor.process(
                choice.uri,
                CropSpec(targetRatio = clip.sourceRatio ?: 1f),
            )
        }
        if (picture == null) {
            state.update { it.withUpload(clip.uri, AssetUpload.Failed(UploadFailure.UNREADABLE_COVER)) }
            return null
        }
        // A cover is an ordinary still and rides the still cap, on the
        // encoded bytes exactly as a picture does.
        if (picture.overPictureCap()) {
            state.update { it.withUpload(clip.uri, AssetUpload.Failed(UploadFailure.PICTURE_TOO_BIG)) }
            return null
        }
        // READY answers here at once — no extra request. `awaitReady`
        // only starts polling for the backstop case, a PROCESSING cover.
        return when (val outcome = media.awaitReady(media.uploadMedia(picture))) {
            is Outcome.Success -> when (val resolved = outcome.value.toResolvedUpload(UploadFailure.REFUSED_COVER)) {
                is AssetUpload.Done -> resolved.mediaId
                else -> {
                    state.update { it.withUpload(clip.uri, resolved) }
                    null
                }
            }
            is Outcome.Refused -> {
                state.update {
                    it.withUpload(
                        clip.uri,
                        AssetUpload.Failed(UploadFailure.REFUSED_COVER, outcome.errors.firstOrNull()?.message),
                    )
                }
                null
            }
            is Outcome.Failed -> {
                state.update { it.withUpload(clip.uri, AssetUpload.Failed(UploadFailure.TRANSPORT)) }
                null
            }
        }
    }

    fun upload(uri: String, crop: CropSpec) {
        jobs.remove(uri)?.cancel()
        state.update { it.withUpload(uri, AssetUpload.Running) }
        jobs[uri] = scope.launch {
            val result = uploadPicture(uri, crop, processor, media)
            state.update { it.withUpload(uri, result) }
        }
    }
}
