// THE BYTES AN EDIT TAKES, from the device's picker to the server — the post
// edit's and the comment edit's alike (EditCompose, EditComposeVideo,
// CommentEdit, CommentEditVideo).
//
// A collaborator rather than a region of each view model, for the reason
// `SectionsEditor` and `WizardUploader` already are: a cluster that needs only
// the state flow, a scope and its own sources can be held somewhere else, and
// two edits holding one copy each is how the two would drift. Each edit hands
// it a lens onto its gallery; what an add or a removal STAGES stays the edit's
// own, since the record is the edit's.

package com.cogra.feature.content.edit

import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.VideoProcessor
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.UploadFailure
import com.cogra.feature.content.wizard.uploadPicture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** A picked batch, screened: what may join the edit, and what is said back on the media row. */
data class ScreenedPick(val accepted: List<PickedAsset>, val refused: List<RefusedPick>)

internal class EditMediaEditor<S>(
    private val scope: CoroutineScope,
    private val state: MutableStateFlow<S>,
    private val processor: MediaProcessor,
    private val media: MediaRepository,
    private val video: VideoProcessor,
    private val galleryOf: (S) -> EditGallery,
    private val withGallery: (S, EditGallery) -> S,
) {
    private val jobs = mutableMapOf<String, Job>()

    private fun updateGallery(block: (EditGallery) -> EditGallery) =
        state.update { withGallery(it, block(galleryOf(it))) }

    /**
     * Screens a batch from the device's own picker against the body it would
     * join, one file at a time and the file before the body (copy-voice, *A
     * file is judged on its own before it is judged against the body*): a
     * format nothing here reads, then a clip — which no edit takes yet
     * ([UploadFailure.VIDEO_AT_EDIT]) — then the cap, [overCap] past it. What
     * is refused says why on the media row; NEVER a dialog (EditCompose.md).
     *
     * [mayHoldVideo] is false behind a pictures-only picker, where asking the
     * video reader about every file buys nothing.
     */
    suspend fun screen(uris: List<String>, cap: Int, overCap: UploadFailure, mayHoldVideo: Boolean): ScreenedPick {
        val gallery = galleryOf(state.value)
        var room = cap - gallery.size
        val accepted = mutableListOf<PickedAsset>()
        val refused = mutableListOf<RefusedPick>()
        for (uri in uris.distinct().filterNot { uri -> gallery.pictures.any { it.key == uri } }) {
            if (mayHoldVideo && video.info(uri) != null) {
                refused += RefusedPick(uri, UploadFailure.VIDEO_AT_EDIT, isVideo = true)
                continue
            }
            val ratio = processor.aspectRatio(uri)
            when {
                // No preview to draw for a file nothing can read, so no uri.
                ratio == null -> refused += RefusedPick(uri = null, reason = UploadFailure.UNREADABLE_FILE)
                room <= 0 -> refused += RefusedPick(uri, overCap)
                else -> {
                    room -= 1
                    accepted += PickedAsset(uri, sourceRatio = ratio)
                }
            }
        }
        return ScreenedPick(accepted, refused)
    }

    /**
     * Sends one upload the edit took — an added picture, or the clip's new
     * face — cut to the window its gallery holds for it, or whole where it
     * holds none (a comment's picture: a target equal to the source frames
     * nothing away). Each upload is its own coroutine, independently
     * retryable (D5); progress stages nothing, since it is no change of the
     * author's.
     */
    fun upload(uri: String) {
        val gallery = galleryOf(state.value)
        val asset = gallery.uploads.firstOrNull { it.uri == uri } ?: return
        val cover = gallery.newCover?.uri == uri
        val crop = gallery.crops[uri] ?: CropSpec(targetRatio = asset.sourceRatio ?: 1f)
        jobs.remove(uri)?.cancel()
        updateGallery { it.withUpload(uri, AssetUpload.Running) }
        jobs[uri] = scope.launch {
            val result = uploadPicture(
                uri,
                crop,
                processor,
                media,
                unreadable = if (cover) UploadFailure.UNREADABLE_COVER else UploadFailure.UNREADABLE_PICTURE,
                refused = if (cover) UploadFailure.REFUSED_COVER else UploadFailure.REFUSED_PICTURE,
            )
            updateGallery { it.withUpload(uri, result) }
        }
    }

    /** `Retry` under the row or in the gate: every failed upload tries again, and the gate runs again. */
    fun retryFailed() {
        galleryOf(state.value).uploads.filter { it.upload is AssetUpload.Failed }.forEach { upload(it.uri) }
    }

    /** A picture or a face that left the edit takes its upload with it. */
    fun cancel(uri: String) {
        jobs.remove(uri)?.cancel()
    }
}
