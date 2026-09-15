// WHAT THE WIZARD READS OFF THE DEVICE, in one place.
//
// Four reads with one shape: ask the platform something about media —
// the roll, a clip's frames, a clip's kind, a picture's shape — and fold
// the answer into the wizard's state. None of them decides anything; the
// stage machine and the uploads do that, and they live where they are
// decided.
//
// It is a collaborator rather than a region of the view model for the
// reason `SectionsEditor` already is one in this feature: a cluster that
// only needs the state flow, a scope and its own sources is a cluster
// that can be held somewhere else, and the view model is the poorer for
// holding it.

package com.cogra.feature.content.wizard

import com.cogra.domain.media.DeviceMediaSource
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.VideoProcessor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class WizardMediaReader(
    private val scope: CoroutineScope,
    private val state: MutableStateFlow<ComposeWizardState>,
    private val video: VideoProcessor,
    private val processor: MediaProcessor,
    private val deviceMedia: DeviceMediaSource,
) {

    /**
     * Lifts the offered frames out of the clip.
     *
     * Called on entering the stage rather than at pick time: extracting
     * frames costs a decode per frame, and an author who picked a clip
     * and then changed their mind should not have paid for it.
     *
     * EXTRACTION OFFERS; IT NEVER CHOOSES. The frames land in the state
     * and nothing else moves: [CoverChoice.None] is what an author who
     * has not tapped anything has, and it is what they keep. A cover is
     * optional and its own standalone asset, so a face nobody picked is
     * a face nobody signed — and it would upload on the way out of the
     * stage, attaching an image the author never chose.
     */
    fun loadCoverFrames() {
        val clip = state.value.video ?: return
        if (state.value.coverFrames.isNotEmpty()) return
        scope.launch {
            val frames = video.coverFrames(clip.uri, ComposeWizardViewModel.COVER_FRAME_COUNT)
            state.update { current -> current.copy(coverFrames = frames) }
        }
    }

    /**
     * Re-reads the roll into the grid.
     *
     * Safe to call without a permission: the source answers an empty list
     * rather than throwing, so a caller never has to ask first.
     */
    fun refreshDeviceMedia() {
        scope.launch {
            state.update {
                it.copy(deviceMedia = deviceMedia.newestMedia(ComposeWizardViewModel.DEVICE_MEDIA_PAGE))
            }
        }
    }

    /**
     * Re-reads whether a restored single pick is a clip.
     *
     * A held draft stores a URI and its words, not what kind of thing
     * the URI is — so a restored video would otherwise come back as a
     * one-picture gallery and be sent to the crop stage it never had.
     * Only a lone pick can be a clip, which is the same rule the toggle
     * enforces, so nothing else needs asking.
     */
    fun restoreClipKind() {
        val only = state.value.picked.singleOrNull() ?: return
        scope.launch {
            val clip = video.info(only.uri) ?: return@launch
            state.update { current ->
                current.copy(
                    picked = current.picked.map {
                        if (it.uri == only.uri) {
                            it.copy(durationMs = clip.durationMs, sourceRatio = clip.aspectRatio)
                        } else {
                            it
                        }
                    },
                )
            }
        }
    }

    fun readSourceRatio(uri: String) {
        scope.launch {
            val ratio = processor.aspectRatio(uri) ?: return@launch
            state.update { it.withSourceRatio(uri, ratio) }
        }
    }
}
