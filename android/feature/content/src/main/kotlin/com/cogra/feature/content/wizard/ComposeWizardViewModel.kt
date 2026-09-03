package com.cogra.feature.content.wizard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.ComposeDraftStore
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.DeviceMediaSource
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.VideoInfo
import com.cogra.domain.media.VideoProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.valueOrNull
import com.cogra.domain.AttachmentClaim
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceFinderState
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.candidateRows
import com.cogra.feature.content.referenceFieldIndex
import com.cogra.feature.content.tagFieldIndex
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.File
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The compose wizard (design/readme.md §13; canonical `Compose*`
 * boards): body-first pick, crop, details, and a seal that names every
 * act before a single one is signed.
 *
 * It replaces the old composer for **creation**. Editing still runs the
 * shipped `ComposePostScreen`: an edit's batching is its own ruled bite
 * (D19's split-out), and the wizard's body step has no meaning for a
 * post whose body already exists.
 *
 * Three things drive the shape of this class:
 *
 * - **Uploads are concurrent and independently retryable** (D5). Each
 *   pick gets its own coroutine and its own state; one failure leaves
 *   the other nine alone, and a retry re-runs exactly one.
 * - **The XOR is structural** (D16). `preparePost` is called with the
 *   words or the gallery, never with both — [BodyMode] decides, and no
 *   validation step can forget to.
 * - **Expiry is a real outcome, not an error** (`ComposeExpired`). A
 *   staged act collected before it landed spent nothing, so the draft
 *   is kept and the notice says so.
 */
@HiltViewModel
class ComposeWizardViewModel @Inject constructor(
    private val content: ContentRepository,
    private val references: ReferenceRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val video: VideoProcessor,
    private val deviceMedia: DeviceMediaSource,
    private val drafts: ComposeDraftStore,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(ComposeWizardState())
    val state = _state.asStateFlow()

    /** One job per picked asset, so a retry cancels only its own. */
    private val uploads = mutableMapOf<String, Job>()

    private var finderJob: Job? = null
    private var started = false

    /**
     * Whether the store may be written to yet.
     *
     * A fresh wizard is empty, and persisting an empty wizard *clears*
     * the store — so writing before the held draft has been read and
     * answered would destroy the very draft the offer is about. Nothing
     * is written until the offer is settled one way or the other.
     *
     * It is also how a landed post stays landed: publishing disarms the
     * writer for good, and nothing re-arms it.
     */
    private var armed = false

    /** The pending debounced write, so a burst of typing is one save. */
    private var draftSaveJob: Job? = null

    /**
     * Route entry. A held draft is *offered*, never restored silently:
     * the `ComposeDraft` board asks before it takes over the screen,
     * because an author who opened the composer to write something else
     * should not find last week's post in it.
     */
    fun start(referenceTargetId: String? = null) {
        if (started) return
        started = true
        viewModelScope.launch {
            val held = drafts.draft()?.takeIf { !it.isEmpty }
            if (held != null) {
                _state.update { it.copy(draftOffer = held) }
            } else {
                armed = true
            }
        }
        // The draft follows the work rather than the exit: every
        // meaningful change schedules a write, so a process death between
        // two taps loses nothing (fix-round-2 ruling).
        viewModelScope.launch { _state.collect { rememberDraft() } }
        prefillReference(referenceTargetId)
    }

    // -- The draft offer (`ComposeDraft`) --

    fun onContinueDraft() {
        val current = _state.value
        val held = current.draftOffer ?: return
        // The grid belongs to the device, not to the draft. Restoring
        // replaces what was *authored*; carrying the grid across is what
        // keeps the pick stage from emptying out under the offer — the
        // permission effect fires on a *change* of permission, and
        // answering the offer changes none, so a wiped grid was never
        // refilled and the stage kept only its photos-app tile.
        _state.value = ComposeWizardState.from(held).copy(deviceMedia = current.deviceMedia)
        armed = true
        // A restored media draft re-reads every asset's shape: the crop
        // preview needs it, and the URIs may no longer resolve.
        _state.value.picked.forEach { readSourceRatio(it.uri) }
        restoreClipKind()
        // A draft can be days old and the library has moved on since;
        // one query is cheaper than showing a stale roll.
        refreshDeviceMedia()
    }

    fun onDiscardDraft() {
        _state.update { it.copy(draftOffer = null) }
        armed = true
        viewModelScope.launch { drafts.clear() }
    }

    /**
     * Writes what is authored right now, without waiting out the
     * debounce — the lifecycle's `ON_STOP`, which is the last moment the
     * process is guaranteed to still be running.
     */
    fun persistNow() {
        val draft = draftToWrite() ?: return
        // Deliberately untracked: the debounced write is what gets
        // cancelled, never this one. Tracking it would let the very next
        // state emission cancel the write that was made because the
        // process is about to stop.
        draftSaveJob?.cancel()
        viewModelScope.launch { write(draft) }
    }

    private fun rememberDraft() {
        val draft = draftToWrite() ?: return
        draftSaveJob?.cancel()
        draftSaveJob = viewModelScope.launch {
            delay(DRAFT_SAVE_DEBOUNCE_MILLIS)
            write(draft)
        }
    }

    /** What the store should hold right now, or null while it is not ours. */
    private fun draftToWrite(): ComposeDraft? {
        if (!armed) return null
        val current = _state.value
        // An answered outcome owns the store: a signed post cleared it, and
        // an expiry or a departure already wrote what it meant to keep.
        if (current.outcome != null || current.draftOffer != null) return null
        // So does a submit in flight. Scheduling here is what put the
        // draft back after a landed post had cleared it: signing emits
        // `submitting` before it emits its outcome, and a write scheduled
        // on that emission outlives the clear.
        if (current.submitting) return null
        return current.toDraft()
    }

    private suspend fun write(draft: ComposeDraft) {
        if (draft.isEmpty) drafts.clear() else drafts.save(draft)
    }

    // -- The body (`ComposeWords` / `ComposePick`) --

    fun onBodyChange(value: String) = _state.update { it.copy(body = value) }

    fun onModeChange(mode: BodyMode) = _state.update { it.withMode(mode) }

    fun onShapeChange(shape: DraftShape) = _state.update { it.copy(shape = shape) }

    /**
     * A tile in the device grid, or a `Cover`/remove badge in the tray.
     * The asset's own ratio is read in the background — the crop step
     * needs it, and reading it at pick time means the step opens
     * already knowing every shape.
     */
    fun onTogglePick(uri: String) {
        val current = _state.value
        // A removal needs nothing read: it is the pick already in hand.
        if (current.picked.any { it.uri == uri }) {
            _state.update { it.togglePick(uri) }
            // A pick removed after its upload started: cancel the work
            // rather than leave an orphan the sweeper has to collect.
            uploads.remove(uri)?.cancel()
            return
        }
        viewModelScope.launch {
            // The grid already knows, because `MediaStore` said which
            // collection the row came from. The system picker hands over
            // a bare URI, so that one is asked — a header read, not a
            // decode.
            val known = current.deviceMedia.firstOrNull { it.uri == uri }
            val clip = if (known != null) {
                known.takeIf { it.isVideo }?.let { VideoInfo(it.durationMs ?: 0, it.aspectRatio) }
            } else {
                video.info(uri)
            }
            // A file the step cannot read is refused where it was
            // offered rather than accepted and failed later
            // (`ComposePickedErrors`). The grid's own rows came out of
            // `MediaStore` and are readable by construction; this is the
            // system picker's path, and the dropped-in file's.
            if (clip == null && known == null && processor.aspectRatio(uri) == null) {
                _state.update {
                    it.copy(refused = it.refused + RefusedPick(uri = null, message = UNREADABLE_FILE))
                }
                return@launch
            }
            // A picture is weighed as it stands. The pipeline downscales
            // and re-encodes it, so the cap could in principle be judged
            // on the result instead — but the board weighs the file the
            // author offered, and a cap nobody can predict is worse than
            // one they can. A clip is weighed *after* its transcode
            // instead: see `startVideoUpload`.
            val size = if (clip == null) processor.sizeBytes(uri) else null
            if (size != null && size > MAX_PICTURE_BYTES) {
                _state.update {
                    it.copy(refused = it.refused + RefusedPick(uri = uri, message = PICTURE_TOO_BIG))
                }
                return@launch
            }
            val before = _state.value.picked.size
            _state.update {
                it.togglePick(
                    uri = uri,
                    sourceRatio = clip?.aspectRatio ?: known?.aspectRatio,
                    durationMs = clip?.durationMs,
                )
            }
            val after = _state.value.picked.size
            when {
                // A picture's own ratio is read from its header for the
                // crop preview; a clip already stated its shape above.
                after > before && clip == null -> readSourceRatio(uri)
                // Replaced rather than added: whatever the previous body
                // was uploading is no longer part of this post.
                after <= before -> cancelUploadsExcept(uri)
                else -> Unit
            }
        }
    }

    /**
     * Clears one refusal (`ComposePickedErrors`, "Remove it").
     *
     * The only way out the board gives it: the file never joined the
     * batch, so there is nothing to retry and nothing to remove from the
     * post — only the notice itself to dismiss.
     */
    fun onDismissRefusal(index: Int) = _state.update {
        if (index !in it.refused.indices) {
            it
        } else {
            it.copy(refused = it.refused.filterIndexed { at, _ -> at != index })
        }
    }

    /** Drops every upload job but the one asset still in the body. */
    private fun cancelUploadsExcept(uri: String) {
        uploads.keys.filterNot { it == uri }.forEach { uploads.remove(it)?.cancel() }
    }

    // -- The video's face (`ComposeCover`) --

    /**
     * Lifts the offered frames out of the clip.
     *
     * Called on entering the stage rather than at pick time: extracting
     * frames costs a decode per frame, and an author who picked a clip
     * and then changed their mind should not have paid for it.
     */
    private fun loadCoverFrames() {
        val clip = _state.value.video ?: return
        if (_state.value.coverFrames.isNotEmpty()) return
        viewModelScope.launch {
            val frames = video.coverFrames(clip.uri, COVER_FRAME_COUNT)
            _state.update { it.copy(coverFrames = frames) }
        }
    }

    fun onPickCoverFrame(index: Int) =
        _state.update { it.copy(coverChoice = CoverChoice.Frame(index), coverMediaId = null) }

    /**
     * A cover of the author's own, from the device's picker.
     *
     * The id is dropped with the choice: a cover already uploaded is
     * bytes on the server that this video is no longer covered by, and
     * the next upload names the new one.
     */
    fun onPickCoverPicture(uri: String) =
        _state.update { it.copy(coverChoice = CoverChoice.Picture(uri), coverMediaId = null) }

    fun onFrameAsset(index: Int) = _state.update {
        it.copy(framingIndex = index.coerceIn(0, (it.picked.size - 1).coerceAtLeast(0)))
    }

    /**
     * Loads `ComposePick`'s grid. Called whenever a media permission is
     * granted — including a re-grant, since a partial grant may have
     * gained pictures since the last look.
     */
    fun onMediaPermissionGranted() = refreshDeviceMedia()

    /**
     * Re-reads the roll into the grid.
     *
     * Safe to call without a permission: the source answers an empty list
     * rather than throwing, so a caller never has to ask first.
     */
    private fun refreshDeviceMedia() {
        viewModelScope.launch {
            _state.update { it.copy(deviceMedia = deviceMedia.newestMedia(DEVICE_MEDIA_PAGE)) }
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
    private fun restoreClipKind() {
        val only = _state.value.picked.singleOrNull() ?: return
        viewModelScope.launch {
            val clip = video.info(only.uri) ?: return@launch
            _state.update { state ->
                state.copy(
                    picked = state.picked.map {
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

    private fun readSourceRatio(uri: String) {
        viewModelScope.launch {
            val ratio = processor.aspectRatio(uri) ?: return@launch
            _state.update { it.withSourceRatio(uri, ratio) }
        }
    }

    // -- Details (`ComposeDetails`) --

    fun onTitleChange(value: String) = _state.update { it.copy(title = value) }

    fun onDescriptionChange(value: String) = _state.update { it.copy(description = value) }

    /**
     * The alt text for one asset. It is added to the details step
     * rather than found on a board: no canonical board carries a place
     * for it, and shipping a gallery with no way to describe it would
     * fail the accessibility bar android.md sets from day one. Flagged
     * as an addition rather than a match.
     */
    /**
     * A picture's description, authored in `DescribeSheet`.
     *
     * Re-describing an asset that already uploaded sends it again: the
     * description rides `UploadMediaInput` and an asset row is immutable
     * after upload (D3), so the only way the new words reach the server is
     * a fresh upload. That happens when the author steps back from the seal
     * to Details and edits — rare, but silently keeping the old words would
     * be worse than the extra call.
     */
    /**
     * Describing a picture never touches its upload: the description is
     * a fact about the placement and rides `AttachmentClaim` at prepare,
     * so the bytes already on the server are still the right bytes.
     *
     * This is the whole reason pictures may go up before the author has
     * written anything — an upload invalidated by every keystroke could
     * only ever start at the seal.
     */
    fun onAltTextChange(uri: String, text: String) =
        _state.update { it.withAltText(uri, text) }

    fun onTagInputChange(value: String) = updateTags { it.withInput(value) }

    fun onAddTag() = updateTags { it.added() }

    fun onRemoveTag(name: String) = updateTags { it.removed(name) }

    fun onTuneTag(name: String) = updateTags { it.tuned(name) }

    fun onDoneTuningTag() = updateTags { it.tuned(null) }

    fun onTagRelevanceChange(name: String, value: Double) = updateTags { it.withRelevance(name, value) }

    fun onTagConfidenceChange(name: String, value: Double) = updateTags { it.withConfidence(name, value) }

    private fun updateTags(block: (TagSectionState) -> TagSectionState) =
        _state.update { it.copy(tagSection = block(it.tagSection)) }

    fun onOpenFinder() = updateReferences { it.withFinder(ReferenceFinderState()) }

    fun onCloseFinder() {
        finderJob?.cancel()
        updateReferences { it.withFinder(null) }
    }

    fun onFinderQueryChange(query: String) {
        finderJob?.cancel()
        updateReferences { section ->
            section.withFinder(
                (section.finder ?: ReferenceFinderState()).copy(
                    query = query,
                    searching = query.isNotBlank(),
                    failed = false,
                ),
            )
        }
        finderJob = viewModelScope.launch {
            delay(FINDER_DEBOUNCE_MILLIS)
            when (val outcome = references.candidateRows(query)) {
                is Outcome.Success -> updateReferences { section ->
                    // An answer that arrived after the author typed on
                    // is stale — only the current query's lands.
                    section.finder?.takeIf { it.query == query }?.let {
                        section.withFinder(
                            it.copy(candidates = outcome.value, searching = false, failed = false),
                        )
                    } ?: section
                }
                is Outcome.Refused, is Outcome.Failed -> updateReferences { section ->
                    section.finder?.takeIf { it.query == query }?.let {
                        section.withFinder(it.copy(searching = false, failed = true))
                    } ?: section
                }
            }
        }
    }

    fun onPickReference(row: ReferenceCandidateRow) {
        finderJob?.cancel()
        updateReferences { it.added(row.targetId, row.target).withFinder(null) }
    }

    fun onRemoveReference(targetId: String) = updateReferences { it.removed(targetId) }

    fun onTuneReference(targetId: String) = updateReferences { it.tuned(targetId) }

    fun onDoneTuningReference() = updateReferences { it.tuned(null) }

    fun onReferenceRelevanceChange(targetId: String, value: Double) =
        updateReferences { it.withRelevance(targetId, value) }

    fun onReferenceSupportChange(targetId: String, value: Double) =
        updateReferences { it.withSupport(targetId, value) }

    private fun updateReferences(block: (ReferenceSectionState) -> ReferenceSectionState) =
        _state.update { it.copy(referenceSection = block(it.referenceSection)) }

    private fun prefillReference(targetId: String?) {
        if (targetId == null) return
        if (_state.value.referenceSection.references.any { it.targetId == targetId }) return
        updateReferences { it.added(targetId, target = null) }
        viewModelScope.launch {
            val resolved = references.candidateRows(targetId).valueOrNull()
                ?.firstOrNull { it.targetId == targetId }
                ?: return@launch
            updateReferences { section ->
                section.copy(
                    references = section.references.map { row ->
                        if (row.targetId == targetId) row.copy(target = resolved.target) else row
                    },
                )
            }
        }
    }

    // -- Navigation between stages --

    fun onNext() {
        val current = _state.value
        val next = current.advanced() ?: return
        // Uploads start on leaving CROP — `ComposeUploading`'s footnote,
        // "Pictures upload while you write — signing waits for them".
        // Framing is settled here and nothing later changes the bytes: a
        // description rides `AttachmentClaim` at prepare rather than the
        // upload, so the whole Details stage is time the pictures spend
        // on the wire instead of time the author spends waiting at the
        // seal.
        //
        // The waiting still shows exactly where the boards draw it:
        // `ComposeSealUploading` gates the seal on `UploadStatusLine`, and
        // stepping back to Details renders the in-flight rings.
        if (current.step == WizardStep.Crop) startUploads(cropSpecsFor(current))
        // The video path spends the same stage on the wire, one stage
        // later: its face is settled on the cover step, and the cover is
        // what the clip's own upload has to name.
        if (current.step == WizardStep.Cover) startVideoUpload()
        _state.value = next
        // Entering the cover stage is what pays for the frames.
        if (next.step == WizardStep.Cover) loadCoverFrames()
    }

    /**
     * The header's arrow and the system gesture: **always one step back**
     * (jakob 2026-08-31).
     *
     * Returns true when the gesture was absorbed inside the wizard, false
     * only from the first stage — where there is no earlier stage and
     * back therefore leaves. The draft survives either way: it is written
     * continuously as the author works, so stepping back and walking out
     * both keep it.
     *
     * The crop step is the wizard's only second entrance, reached with
     * this arrow — which is why `PickedRow` carries no `Crop` link
     * (design/components/compose/PickedRow.prompt.md).
     */
    fun onBack(): Boolean {
        if (_state.value.sheet != SealSheet.None) {
            onCloseSheet()
            return true
        }
        if (_state.value.draftOffer != null) {
            // Leaving with the offer still up must not overwrite the very
            // draft being offered.
            _state.update { it.copy(outcome = WizardOutcome.DraftKept) }
            return true
        }
        val back = _state.value.retreated() ?: return false
        _state.value = back
        return true
    }

    /** `ComposeSeal`'s Back pill: one stage, not out of the wizard. */
    fun onSealBack() {
        _state.value.retreated()?.let { _state.value = it }
    }

    /** The screen's one `?`; every one opens the house plain dialog. */
    fun onOpenHelp(topic: HelpTopic) = _state.update { it.copy(help = topic) }

    fun onCloseHelp() = _state.update { it.copy(help = null) }

    /**
     * The author's own sensitive mark.
     *
     * Turning the mark off drops the reason with it: the contract
     * refuses a reason without `sensitive: true`, so keeping one around
     * would send a value that is guaranteed to be refused.
     */
    fun onSensitiveChange(marked: Boolean) = _state.update {
        if (marked) it.copy(sensitive = true) else it.copy(sensitive = false, sensitiveReason = "")
    }

    fun onSensitiveReasonChange(reason: String) =
        _state.update { it.copy(sensitiveReason = reason) }

    fun onOpenSheet(sheet: SealSheet) = _state.update { it.copy(sheet = sheet) }

    fun onCloseSheet() = _state.update { it.closedSheets() }

    // -- The picked-pictures manager (`PickedSheet`) --

    /** "Show all", and the details step's picked row. */
    fun onOpenPickedSheet() = _state.update { it.copy(pickedSheetOpen = true) }

    /** Reorder; the first pick is the cover, so the badge follows the move. */
    fun onMovePick(from: Int, to: Int) = _state.update { it.movedPick(from, to) }

    fun onRemovePickAt(index: Int) = _state.update { state ->
        state.picked.getOrNull(index)?.let { state.removePick(it.uri) } ?: state
    }

    // -- Descriptions (`DescribeSheet`) --

    /** Opens the sheet on one picture, from the counter or the Show all sheet. */
    fun onDescribe(index: Int) = _state.update {
        if (index in it.picked.indices) it.copy(describingIndex = index) else it
    }

    /**
     * The details step's "Describe the pictures": the first picture without
     * a description, or the first picture when every one has one — so the
     * link always opens something rather than doing nothing.
     */
    fun onDescribeFirst() = _state.update { state ->
        if (state.picked.isEmpty()) {
            state
        } else {
            val next = state.picked.indexOfFirst { it.altText.isBlank() }
            state.copy(describingIndex = if (next >= 0) next else 0)
        }
    }

    fun onLicenseChange(license: LicenseChoice) = _state.update { it.copy(license = license) }

    fun onPDirectedChange(value: Double) = _state.update { it.copy(pDirected = value) }

    // -- Uploads (D5: one call per asset, concurrent, retryable) --

    /**
     * The framing each pick was left at, as the crop stage reports it.
     *
     * It is kept in the state rather than beside it because the crop
     * stage is left and re-entered: its own saveable holder dies with
     * the composition, so the framing has to outlive it here — and the
     * later stages' previews read the same map to draw what the author
     * framed (jakob 2026-09-01).
     */
    fun onCropsCommitted(crops: Map<String, CropSpec>) = _state.update { state ->
        if (state.crops == crops) state else state.copy(crops = crops)
    }

    private fun cropSpecsFor(state: ComposeWizardState): Map<String, CropSpec> {
        val ratio = state.shape.ratio()
        return state.picked.associate { asset ->
            asset.uri to (state.crops[asset.uri] ?: CropSpec(targetRatio = ratio))
        }
    }

    private fun startUploads(crops: Map<String, CropSpec>) {
        _state.value.picked.forEach { asset ->
            if (asset.upload is AssetUpload.Done) return@forEach
            upload(asset.uri, crops[asset.uri] ?: CropSpec(_state.value.shape.ratio()))
        }
    }

    /** Retries exactly one asset — the point of the one-call-per-asset shape. */
    fun onRetryUpload(uri: String) {
        val state = _state.value
        val asset = state.picked.firstOrNull { it.uri == uri } ?: return
        if (asset.upload is AssetUpload.Running || asset.upload is AssetUpload.Transcoding) return
        if (asset.isVideo) {
            startVideoUpload()
            return
        }
        upload(uri, state.crops[uri] ?: CropSpec(state.shape.ratio()))
    }

    /**
     * The clip's whole journey: its face first, then the bytes.
     *
     * The order is the contract's. An asset row is immutable once
     * written, so a video names its cover when it is created rather than
     * gaining one afterwards — which means the cover must already have
     * an id. Uploading it first also fails fast: a refused cover is
     * learned in a second, instead of after a minute of transcoding.
     */
    private fun startVideoUpload() {
        val clip = _state.value.video ?: return
        uploads.remove(clip.uri)?.cancel()
        uploads[clip.uri] = viewModelScope.launch {
            val coverId = _state.value.coverMediaId ?: uploadCover() ?: return@launch
            _state.update { it.copy(coverMediaId = coverId) }

            _state.update { it.withUpload(clip.uri, AssetUpload.Transcoding(0)) }
            val processed = video.transcode(clip.uri, MAX_VIDEO_BYTES) { percent ->
                _state.update { it.withUpload(clip.uri, AssetUpload.Transcoding(percent)) }
            }
            if (processed == null) {
                _state.update { it.withUpload(clip.uri, AssetUpload.Failed(UNREADABLE_VIDEO)) }
                return@launch
            }
            // The cap is judged on what would be sent, not on what was
            // picked: the whole point of re-encoding is that a large
            // recording usually becomes a small upload, and weighing the
            // original would refuse posts the ruling means to allow.
            if (processed.byteCount > MAX_VIDEO_BYTES) {
                _state.update { it.withUpload(clip.uri, AssetUpload.Failed(VIDEO_TOO_BIG)) }
                runCatching { File(processed.path).delete() }
                return@launch
            }

            _state.update { it.withUpload(clip.uri, AssetUpload.Running) }
            when (val outcome = media.uploadVideo(processed, coverId)) {
                is Outcome.Success -> _state.update {
                    it.withUpload(clip.uri, AssetUpload.Done(outcome.value.id))
                }
                is Outcome.Refused -> _state.update {
                    it.withUpload(
                        clip.uri,
                        AssetUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED_VIDEO),
                    )
                }
                is Outcome.Failed -> _state.update {
                    it.withUpload(clip.uri, AssetUpload.Failed(TRANSPORT))
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
     */
    private suspend fun uploadCover(): String? {
        val state = _state.value
        val clip = state.video ?: return null
        val picture = when (val choice = state.coverChoice) {
            is CoverChoice.Frame -> state.coverFrames.getOrNull(choice.index)?.picture
            is CoverChoice.Picture -> processor.process(
                choice.uri,
                CropSpec(targetRatio = clip.sourceRatio ?: 1f),
            )
        }
        if (picture == null) {
            _state.update { it.withUpload(clip.uri, AssetUpload.Failed(UNREADABLE_COVER)) }
            return null
        }
        return when (val outcome = media.uploadMedia(picture)) {
            is Outcome.Success -> outcome.value.id
            is Outcome.Refused -> {
                _state.update {
                    it.withUpload(
                        clip.uri,
                        AssetUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED_COVER),
                    )
                }
                null
            }
            is Outcome.Failed -> {
                _state.update { it.withUpload(clip.uri, AssetUpload.Failed(TRANSPORT)) }
                null
            }
        }
    }

    private fun upload(uri: String, crop: CropSpec) {
        uploads.remove(uri)?.cancel()
        _state.update { it.withUpload(uri, AssetUpload.Running) }
        uploads[uri] = viewModelScope.launch {
            val picture = processor.process(uri, crop)
            if (picture == null) {
                // The client half of the decode gate (D11): bytes that
                // do not decode never reach the wire.
                _state.update { it.withUpload(uri, AssetUpload.Failed(UNREADABLE)) }
                return@launch
            }
            when (val outcome = media.uploadMedia(picture)) {
                is Outcome.Success -> _state.update {
                    it.withUpload(uri, AssetUpload.Done(outcome.value.id))
                }
                is Outcome.Refused -> _state.update {
                    it.withUpload(uri, AssetUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED))
                }
                is Outcome.Failed -> _state.update {
                    it.withUpload(uri, AssetUpload.Failed(TRANSPORT))
                }
            }
        }
    }

    // -- The seal (`ComposeSeal`) --

    /**
     * Stages the batch and signs it. A refusal from the prepare stops
     * before any signature: nothing was signed, so nothing may claim
     * signing failed.
     */
    fun onSign() {
        val current = _state.value
        if (!current.canSign) return
        // A landed post clears the store; a pending write must not put the
        // draft back after it.
        draftSaveJob?.cancel()
        _state.update {
            it.copy(
                submitting = true,
                refusal = null,
                signingFailed = false,
                keyAbsent = false,
                transportFailed = false,
            )
        }
        viewModelScope.launch {
            val prepared = when (
                val outcome = content.preparePost(
                    title = current.title.ifBlank { null },
                    description = current.description.ifBlank { null },
                    // The XOR, structurally: a media post sends no
                    // content at all, and a words post no gallery.
                    content = current.body.takeIf { current.mode == BodyMode.Words },
                    license = current.license,
                    tags = current.tagSection.tags.map { it.toClaim() },
                    references = current.referenceSection.references.map { it.toClaim() },
                    attachments = if (current.mode == BodyMode.Media) {
                        current.picked.mapNotNull { asset ->
                            asset.mediaId?.let {
                                AttachmentClaim(it, asset.altText.ifBlank { null })
                            }
                        }
                    } else {
                        emptyList()
                    },
                    // Always sent explicitly, never omitted: an edit
                    // payload is the complete state, so an omitted mark
                    // UNMARKS. Sending the switch's current value is what
                    // keeps create and edit the same code.
                    sensitive = current.sensitive,
                    // Blank counts as none, said here rather than left to
                    // the transport: an empty string is a value, and "no
                    // reason" is what the author actually chose.
                    sensitiveReason = current.sensitiveReason.ifBlank { null },
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> return@launch refuse(outcome.errors)
                is Outcome.Failed -> return@launch failTransport()
            }

            val results = try {
                signer.sign(prepared.writes)
            } catch (_: NoActorKeyException) {
                // `ComposeKeyAbsent`: the write waits on the reader
                // restoring the key, not on time passing. The draft is
                // kept so restoring loses nothing.
                keepDraft()
                _state.update { it.copy(submitting = false, keyAbsent = true) }
                return@launch
            }

            when {
                results.all { it is WriteResult.Done } -> {
                    // The post is published: this wizard has nothing left
                    // to keep. Disarming *before* the clear is what makes
                    // the clear final — `outcome` alone could not, because
                    // the route consumes it the moment it navigates, and
                    // the state it leaves behind still holds every word
                    // and pick of the post that just landed. The next
                    // `ON_STOP` then wrote them straight back
                    // (jakob 2026-08-31: "once a post is sent its draft
                    // should be gone").
                    armed = false
                    draftSaveJob?.cancel()
                    drafts.clear()
                    _state.update {
                        it.copy(submitting = false, outcome = WizardOutcome.Landed(prepared.node))
                    }
                }
                // A staged act collected before it landed: nothing was
                // spent, and the draft is what the notice promises.
                results.any { it.expired() } -> {
                    keepDraft()
                    _state.update {
                        it.copy(submitting = false, outcome = WizardOutcome.Expired(it.draftLabel()))
                    }
                }
                else -> {
                    keepDraft()
                    _state.update { it.copy(submitting = false, signingFailed = true) }
                }
            }
        }
    }

    /** The author left the wizard: the draft is kept, never discarded silently. */
    fun onLeave() {
        val current = _state.value
        if (current.outcome != null || current.draftOffer != null) return
        // A write already in flight would land after this one and undo it.
        draftSaveJob?.cancel()
        viewModelScope.launch {
            val draft = current.toDraft()
            if (draft.isEmpty) drafts.clear() else drafts.save(draft)
        }
        _state.update { it.copy(outcome = WizardOutcome.DraftKept) }
    }

    fun onOutcomeConsumed() = _state.update { it.copy(outcome = null) }

    private suspend fun keepDraft() {
        val draft = _state.value.toDraft()
        if (!draft.isEmpty) drafts.save(draft)
    }

    private fun ComposeWizardState.draftLabel(): String = title.ifBlank { sealSummary }

    /**
     * A refusal from the one write whose input carries the whole batch:
     * the server names the offender by path, so `["tags", i, …]` lands
     * on chip i, `["attachments", i, …]` on pick i, and everything else
     * says its piece once.
     */
    private fun refuse(errors: List<UserError>) = _state.update { st ->
        var tags = st.tagSection
        var refs = st.referenceSection
        var picks = st.picked
        val unplaced = mutableListOf<String>()
        for (error in errors) {
            val tagIndex = tagFieldIndex(error.field)
            val referenceIndex = referenceFieldIndex(error.field)
            val attachmentIndex = attachmentFieldIndex(error.field)
            when {
                tagIndex != null -> {
                    val (next, left) = tags.withErrorAt(tagIndex, error.message)
                    tags = next
                    left?.let { unplaced += it }
                }
                referenceIndex != null -> {
                    val (next, left) = refs.withErrorAt(referenceIndex, error.message)
                    refs = next
                    left?.let { unplaced += it }
                }
                attachmentIndex != null && attachmentIndex in picks.indices -> {
                    picks = picks.mapIndexed { i, asset ->
                        if (i == attachmentIndex) {
                            asset.copy(upload = AssetUpload.Failed(error.message))
                        } else {
                            asset
                        }
                    }
                }
                else -> unplaced += error.message
            }
        }
        st.copy(
            submitting = false,
            tagSection = tags,
            referenceSection = refs,
            picked = picks,
            refusal = unplaced.firstOrNull(),
        )
    }

    private fun failTransport() = _state.update { it.copy(submitting = false, transportFailed = true) }

    // Internal rather than private so the suite can assert against the
    // words themselves instead of re-typing them: a copy change should
    // move the test with it, not break it.
    internal companion object {
        const val FINDER_DEBOUNCE_MILLIS = 250L

        /** Long enough that a typed word is one write, short enough to be a save. */
        const val DRAFT_SAVE_DEBOUNCE_MILLIS = 400L

        /** How much of the camera roll the grid offers before the picker. */
        const val DEVICE_MEDIA_PAGE = 300

        const val UNREADABLE = "That file could not be read as a picture."
        const val REFUSED = "The server would not take that picture."
        const val TRANSPORT = "The upload could not reach the server."

        // The refusal copy is blessed, verbatim, in
        // design/guidelines/copy-voice.md "Refused files". Each line
        // names the cap it broke, because that is the only place a cap
        // is named — nothing announces the limits in advance.
        //
        // **Screens say MB; the caps are MiB.** The enforced limit is
        // the binary one, so the number on screen under-promises and can
        // never turn a file the product would have accepted into a
        // refusal.
        const val UNREADABLE_FILE = "That file isn't a picture or a video CoGra can read."
        const val PICTURE_TOO_BIG = "That picture is too big — a picture can be up to 10 MB."
        const val VIDEO_TOO_BIG = "That video is too big — a post's video can be up to 100 MB."

        /** A still's cap: ten per post, ten mebibytes each (D9). */
        const val MAX_PICTURE_BYTES = 10L * 1024 * 1024

        /** A clip's cap: the same hundred megabytes a full gallery costs. */
        const val MAX_VIDEO_BYTES = 100L * 1024 * 1024

        const val UNREADABLE_VIDEO = "That file could not be read as a video."
        const val REFUSED_VIDEO = "The server would not take that video."
        const val UNREADABLE_COVER = "That picture could not be read as a cover."
        const val REFUSED_COVER = "The server would not take that cover."

        /** How many frames `ComposeCover` offers — the board draws three. */
        const val COVER_FRAME_COUNT = 3
    }
}

/** The post-wide shape as a width ÷ height ratio. */
internal fun DraftShape.ratio(): Float = when (this) {
    DraftShape.Tall -> 4f / 5f
    DraftShape.Square -> 1f
    DraftShape.Wide -> 1.91f
}

/** `["attachments", "<i>", "mediaId"]` — claim 64's own example path. */
internal fun attachmentFieldIndex(field: List<String>?): Int? =
    field?.takeIf { it.size >= 2 && it[0] == "attachments" }?.getOrNull(1)?.toIntOrNull()

/** Whether one signing result is the expiry the calm notice speaks for. */
private fun WriteResult.expired(): Boolean =
    this is WriteResult.Refused && errors.any { it.code == ErrorCode.STAGED_WRITE_EXPIRED }
