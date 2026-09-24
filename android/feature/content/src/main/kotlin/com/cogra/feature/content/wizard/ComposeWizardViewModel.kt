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
import com.cogra.domain.media.PICTURE_MAX_BYTES
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
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.SectionsEditor
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.candidateRows
import com.cogra.feature.content.referenceFieldIndex
import com.cogra.feature.content.tagFieldIndex
import dagger.hilt.android.lifecycle.HiltViewModel
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

    /**
     * The resumable session a clip is going up on, once there is one.
     *
     * Held so it can be given back: until an upload is completed or
     * aborted the store keeps every part it was handed, for a day. The
     * id is the server's, so it only exists from the first progress
     * tick onwards.
     */
    private var uploadSession: String? = null

    /** Everything the wizard reads off the device (`WizardMediaReader`). */
    private val mediaReader = WizardMediaReader(
        scope = viewModelScope,
        state = _state,
        video = video,
        processor = processor,
        deviceMedia = deviceMedia,
    )

    /** Every asset's journey onto the server (`WizardUploader`). */
    private val uploader = WizardUploader(
        scope = viewModelScope,
        state = _state,
        video = video,
        processor = processor,
        media = media,
        jobs = uploads,
        onUploadSessionStarted = { uploadSession = it },
    )

    private val sections = SectionsEditor(
        scope = viewModelScope,
        references = references,
        state = _state,
        tagsOf = { it.tagSection },
        withTags = { state, tags -> state.copy(tagSection = tags) },
        referencesOf = { it.referenceSection },
        withReferences = { state, refs -> state.copy(referenceSection = refs) },
    )

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
        //
        // THE CITATION CROSSES TOO, and for a sharper reason: the author
        // reached this screen by asking to cite a node (D20), and the
        // draft is the answer to a different question — what they were
        // writing last week. Restoring it must not undo the gesture that
        // opened the wizard, or `Cite in a new post` silently opens an
        // ordinary composer. A draft carries no citations of its own
        // (`ComposeDraft`), so nothing is overwritten by keeping it.
        _state.value = ComposeWizardState.from(held).copy(
            deviceMedia = current.deviceMedia,
            referenceSection = current.referenceSection,
        )
        armed = true
        // A restored media draft re-reads every asset's shape: the crop
        // preview needs it, and the URIs may no longer resolve.
        _state.value.picked.forEach { mediaReader.readSourceRatio(it.uri) }
        mediaReader.restoreClipKind()
        // A draft can be days old and the library has moved on since;
        // one query is cheaper than showing a stale roll.
        mediaReader.refreshDeviceMedia()
    }

    fun onDiscardDraft() {
        _state.update { it.copy(draftOffer = null) }
        armed = true
        viewModelScope.launch { drafts.clear() }
    }

    /**
     * Authoring is the offer's third answer.
     *
     * The board re-words the caption to "Or start fresh —" and points it
     * at the grid, so picking a picture *is* an answer — and until it was
     * recorded as one the offer stayed up over the work: the stage went
     * on wearing the dim the offer puts on it, `draftToWrite` kept
     * refusing to persist anything, and Continue was still there to
     * replace the new pictures with the old draft.
     *
     * The held draft is not cleared outright: the first write of the
     * fresh post overwrites the store, which is the same end state
     * without a destructive call.
     */
    private fun settleOffer() {
        if (_state.value.draftOffer == null) return
        _state.update { it.copy(draftOffer = null) }
        armed = true
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
            // The grid already knows the KIND, because `MediaStore` said
            // which collection the row came from. The system picker hands
            // over a bare URI, so that one is asked — a header read, not a
            // decode.
            val known = current.deviceMedia.firstOrNull { it.uri == uri }
            // A CLIP'S SHAPE COMES FROM ITS OWN HEADER, grid or not. The
            // store's WIDTH/HEIGHT are the stored dimensions, with the
            // rotation in a separate ORIENTATION column (MediaProvider's
            // `ModernMediaScanner`), so a phone's portrait recording rows
            // in as landscape — and the shape decides whether the cover
            // step stands (`hasCoverStep`). `VideoInfo` is post-rotation.
            val header = if (known == null || known.isVideo) video.info(uri) else null
            val isClip = known?.isVideo ?: (header != null)
            // The shared screening (`PickScale.kt`): a file nothing can
            // read is refused where it was offered rather than accepted
            // and failed later (`ComposePickedErrors`). Bytes are weighed
            // after the pass that shrinks them — a still at its upload,
            // a clip after its transcode (see `startVideoUpload`).
            if (!isClip) {
                val refusal = screenPicture(uri, processor, knownReadable = known != null)
                if (refusal != null) {
                    _state.update { it.copy(refused = it.refused + refusal) }
                    return@launch
                }
            }
            val before = _state.value.picked.size
            _state.update {
                it.togglePick(
                    uri = uri,
                    // A grid clip whose header will not read has no
                    // trustworthy shape: null, which takes the cover
                    // step — the safe default `hasCoverStep` names.
                    sourceRatio = if (isClip) header?.aspectRatio else known?.aspectRatio,
                    durationMs = if (isClip) known?.durationMs ?: header?.durationMs ?: 0 else null,
                )
            }
            val after = _state.value.picked.size
            if (after > before) settleOffer()
            when {
                // A picture's own ratio is read from its header for the
                // crop preview; a clip already stated its shape above.
                after > before && !isClip -> mediaReader.readSourceRatio(uri)
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
    fun onMediaPermissionGranted() = mediaReader.refreshDeviceMedia()

    // -- Details (`ComposeDetails`) --

    fun onTitleChange(value: String) = _state.update { it.copy(title = value) }

    fun onDescriptionChange(value: String) = _state.update { it.copy(description = value) }

    /**
     * A picture's description, authored in `DescribeSheet`.
     *
     * It lives on the details step rather than on a board of its own:
     * no canonical board carries a place for it, and shipping a gallery
     * with no way to describe it would fail the accessibility bar
     * android.md sets from day one.
     *
     * Describing a picture never touches its upload — the description
     * is a fact about the placement and rides `AttachmentClaim` at
     * prepare, so the bytes already on the server are still the right
     * bytes. That is the whole reason pictures may go up before the
     * author has written anything: an upload invalidated by every
     * keystroke could only ever start at the seal.
     */
    fun onAltTextChange(uri: String, text: String) =
        _state.update { it.withAltText(uri, text) }

    // The topics + citations surface is one implementation, shared with
    // the reply wizard, the comment edit and the post edit; these
    // forward to it so the screens keep talking to the ViewModel.
    fun onTagInputChange(value: String) = sections.onTagInputChange(value)

    fun onAddTag() = sections.onAddTag()

    fun onRemoveTag(name: String) = sections.onRemoveTag(name)

    fun onTuneTag(name: String) = sections.onTuneTag(name)

    fun onDoneTuningTag() = sections.onDoneTuningTag()

    fun onTagRelevanceChange(name: String, value: Double) = sections.onTagRelevanceChange(name, value)

    fun onTagConfidenceChange(name: String, value: Double) = sections.onTagConfidenceChange(name, value)

    private fun updateTags(block: (TagSectionState) -> TagSectionState) = sections.updateTags(block)

    fun onOpenFinder() = sections.onOpenFinder()

    fun onCloseFinder() = sections.onCloseFinder()

    fun onFinderQueryChange(query: String) = sections.onFinderQueryChange(query)

    fun onPickReference(row: ReferenceCandidateRow) = sections.onPickReference(row)

    fun onRemoveReference(targetId: String) = sections.onRemoveReference(targetId)

    fun onTuneReference(targetId: String) = sections.onTuneReference(targetId)

    fun onDoneTuningReference() = sections.onDoneTuningReference()

    fun onReferenceRelevanceChange(targetId: String, value: Double) =
        sections.onReferenceRelevanceChange(targetId, value)

    fun onReferenceSupportChange(targetId: String, value: Double) =
        sections.onReferenceSupportChange(targetId, value)

    private fun updateReferences(block: (ReferenceSectionState) -> ReferenceSectionState) =
        sections.updateReferences(block)

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
        //
        // The new state lands first: the video journey reads the face
        // off the state, and a vertical clip only takes its first frame
        // as it is routed past the cover step.
        _state.value = next
        if (current.step == WizardStep.Crop) startUploads(cropSpecsFor(current))
        // The video path spends the same stage on the wire: its face is
        // settled by the time details opens — chosen on the cover step,
        // or, for a vertical clip, by the step being skipped — and the
        // face is what the clip's own upload has to name.
        // A words post whose media half still holds a clip sends no clip.
        if (next.step == WizardStep.Details && next.mode == BodyMode.Media && next.isVideoPost) {
            uploader.startVideoUpload()
        }
        // Entering the cover stage is what pays for the frames.
        if (next.step == WizardStep.Cover) mediaReader.loadCoverFrames()
    }

    /**
     * The details door's "Add a cover" (`ComposeDetailsVideo` →
     * `ComposeCover`): the step a vertical clip skipped, opened on
     * purpose. Entering it pays for the frames exactly as walking into it
     * does; its `Next` comes back to details.
     */
    fun onOpenCoverStep() {
        val opened = _state.value.openedCoverStep() ?: return
        _state.value = opened
        mediaReader.loadCoverFrames()
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
        val before = _state.value
        val back = before.retreated() ?: return false
        _state.value = back
        // The door's stage returns to details by Back as well as by Next,
        // and either way whatever face now stands has to go up.
        if (before.step == WizardStep.Cover && back.step == WizardStep.Details) {
            uploader.startVideoUpload()
        }
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

    /**
     * Opening the pad starts it from the stance that is standing, so
     * Cancel can put it back exactly.
     */
    fun onOpenSheet(sheet: SealSheet) = _state.update {
        if (sheet == SealSheet.Stance) {
            it.copy(sheet = sheet, stagedPDirected = it.pDirected)
        } else {
            it.copy(sheet = sheet)
        }
    }

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

    /** A drag on the pad's field: staged, not set (`ComposePad`). */
    fun onPDirectedChange(value: Double) = _state.update { it.copy(stagedPDirected = value) }

    /** The pad's Set — the one gesture that moves the stance the seal reads. */
    fun onSetStance() = _state.update { it.copy(pDirected = it.stagedPDirected).closedSheets() }

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
            uploader.upload(asset.uri, crops[asset.uri] ?: CropSpec(_state.value.shape.ratio()))
        }
    }

    fun onRetryUpload(uri: String) = uploader.onRetryUpload(uri)

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
                    // The poster rides the clip's own placement, never a
                    // gallery entry of its own — which is what keeps "ten
                    // pictures or one video" one counting rule.
                    attachments = if (current.mode == BodyMode.Media) {
                        current.picked.mapNotNull { asset ->
                            asset.mediaId?.let {
                                AttachmentClaim(
                                    mediaId = it,
                                    altText = asset.altText.ifBlank { null },
                                    coverMediaId = current.coverMediaId.takeIf { _ -> asset.isVideo },
                                    // TAKEN (frame 1, silently) vs CHOSEN —
                                    // the fact `storesFirstFrame` already
                                    // names, gated the same way as the id
                                    // itself so a picture post never claims it.
                                    coverTaken = current.coverChoice.storesFirstFrame.takeIf { asset.isVideo } ?: false,
                                )
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
        // The draft is kept but the session is not: nothing can ask the
        // server what a half-sent upload already received, so returning
        // to this draft starts a fresh one either way. Handing the parts
        // back now saves the store a day of holding them.
        releaseSession()
        _state.update { it.copy(outcome = WizardOutcome.DraftKept) }
    }

    /** Gives back a half-finished upload's parts, if there are any. */
    private fun releaseSession() {
        val session = uploadSession ?: return
        uploadSession = null
        viewModelScope.launch { media.abortUpload(session) }
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
                            asset.copy(upload = AssetUpload.Failed(UploadFailure.REFUSED_PICTURE, error.message))
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
    // caps themselves instead of re-typing them.
    internal companion object {

        /** Long enough that a typed word is one write, short enough to be a save. */
        const val DRAFT_SAVE_DEBOUNCE_MILLIS = 400L

        /** How much of the camera roll the grid offers before the picker. */
        const val DEVICE_MEDIA_PAGE = 300

        // The caps this surface screens against, named here for the
        // suite. Both forward to the shared screening (`PickScale.kt`),
        // where each number is written once for both composers.
        const val MAX_PICTURE_BYTES = PICTURE_MAX_BYTES
        const val MAX_VIDEO_BYTES = POST_VIDEO_MAX_BYTES

        /** How many frames `ComposeCover` offers — the board draws four. */
        const val COVER_FRAME_COUNT = 4
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
