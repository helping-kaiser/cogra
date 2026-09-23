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
     * the clip goes up. [CoverChoice.None] is a settled answer rather
     * than a wait, so it skips straight to the clip's own bytes.
     */
    fun startVideoUpload() {
        val clip = state.value.video ?: return
        jobs.remove(clip.uri)?.cancel()
        jobs[clip.uri] = scope.launch {
            val coverId = when (state.value.coverChoice) {
                CoverChoice.None -> null
                else -> state.value.coverMediaId ?: uploadCover() ?: return@launch
            }
            state.update { it.copy(coverMediaId = coverId) }

            state.update { it.withUpload(clip.uri, AssetUpload.Transcoding(0)) }
            val processed = video.transcode(clip.uri, scale.videoMaxBytes) { percent ->
                state.update { it.withUpload(clip.uri, AssetUpload.Transcoding(percent)) }
            }
            if (processed == null) {
                state.update { it.withUpload(clip.uri, AssetUpload.Failed(UploadFailure.UNREADABLE_VIDEO)) }
                return@launch
            }
            // The clip's half of the shared screening (`PickScale.kt`),
            // which is why it runs here rather than at pick time.
            if (scale.refusesVideo(processed.byteCount)) {
                state.update { it.withUpload(clip.uri, AssetUpload.Failed(scale.tooBigVideo)) }
                runCatching { File(processed.path).delete() }
                return@launch
            }

            state.update { it.withUpload(clip.uri, AssetUpload.Running) }
            val sending = { progress: UploadProgress ->
                onUploadSessionStarted(progress.uploadId)
                state.update { it.withUpload(clip.uri, AssetUpload.Sending(progress.percent)) }
            }
            when (val outcome = media.uploadVideo(processed, scale.destination, sending)) {
                is Outcome.Success -> state.update {
                    it.withUpload(clip.uri, AssetUpload.Done(outcome.value.id))
                }
                is Outcome.Refused -> state.update {
                    it.withUpload(
                        clip.uri,
                        AssetUpload.Failed(UploadFailure.REFUSED_VIDEO, outcome.errors.firstOrNull()?.message),
                    )
                }
                is Outcome.Failed -> state.update {
                    it.withUpload(clip.uri, AssetUpload.Failed(UploadFailure.TRANSPORT))
                }
            }
            // The transcode's cache copy has served its purpose either
            // way: the bytes are on the server, or the attempt failed
            // and a retry re-encodes from the original.
            runCatching { File(processed.path).delete() }
        }
    }

    /**
     * Uploads whatever the author chose as the face, as its own still.
     *
     * A frame arrives already processed — the pipeline shaped it exactly
     * as it shapes a picked picture. A chosen picture is processed here,
     * framed to the clip's own shape: a poster that is not the video's
     * shape would letterbox the thing it stands in for.
     *
     * Never called for [CoverChoice.None] — [startVideoUpload] skips
     * straight past it — so that branch is unreached in practice; it
     * fails loudly rather than silently if that invariant ever breaks.
     */
    private suspend fun uploadCover(): String? {
        val current = state.value
        val clip = current.video ?: return null
        val picture = when (val choice = current.coverChoice) {
            CoverChoice.None -> null
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
        return when (val outcome = media.uploadMedia(picture)) {
            is Outcome.Success -> outcome.value.id
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
