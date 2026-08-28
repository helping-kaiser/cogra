package com.cogra.feature.content.wizard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.compose.ComposeDraftStore
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
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
     * Route entry. A held draft is *offered*, never restored silently:
     * the `ComposeDraft` board asks before it takes over the screen,
     * because an author who opened the composer to write something else
     * should not find last week's post in it.
     */
    fun start(referenceTargetId: String? = null) {
        if (started) return
        started = true
        viewModelScope.launch {
            drafts.draft()?.takeIf { !it.isEmpty }?.let { held ->
                _state.update { it.copy(draftOffer = held) }
            }
        }
        prefillReference(referenceTargetId)
    }

    // -- The draft offer (`ComposeDraft`) --

    fun onContinueDraft() {
        val held = _state.value.draftOffer ?: return
        _state.value = ComposeWizardState.from(held)
        // A restored media draft re-reads every asset's shape: the crop
        // preview needs it, and the URIs may no longer resolve.
        _state.value.picked.forEach { readSourceRatio(it.uri) }
    }

    fun onDiscardDraft() {
        _state.update { it.copy(draftOffer = null) }
        viewModelScope.launch { drafts.clear() }
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
        val before = _state.value.picked.size
        _state.update { it.togglePick(uri) }
        val after = _state.value.picked.size
        when {
            after > before -> readSourceRatio(uri)
            // A pick removed after its upload started: cancel the work
            // rather than leave an orphan the sweeper has to collect.
            after < before -> uploads.remove(uri)?.cancel()
            // Neither: the cap refused it, and the screen says so.
            else -> Unit
        }
    }

    fun onFrameAsset(index: Int) = _state.update {
        it.copy(framingIndex = index.coerceIn(0, (it.picked.size - 1).coerceAtLeast(0)))
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
    fun onAltTextChange(uri: String, text: String) = _state.update { it.withAltText(uri, text) }

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
        // Leaving the crop stage is what commits the framing, so it is
        // also where the uploads start: they then run while the author
        // fills in the details, and the seal waits only for whatever is
        // left (D5's "concurrency is the client's to arrange").
        if (current.step == WizardStep.Crop) startUploads(cropSpecsFor(current))
        _state.value = next
    }

    fun onBack(): Boolean {
        val retreated = _state.value.retreated() ?: return false
        _state.value = retreated
        return true
    }

    fun onOpenSheet(sheet: SealSheet) = _state.update { it.copy(sheet = sheet) }

    fun onCloseSheet() = _state.update { it.copy(sheet = SealSheet.None) }

    fun onLicenseChange(license: LicenseChoice) = _state.update { it.copy(license = license) }

    fun onPDirectedChange(value: Double) = _state.update { it.copy(pDirected = value) }

    // -- Uploads (D5: one call per asset, concurrent, retryable) --

    /**
     * The framing each pick was left at. The crop step hands these over
     * because the framing lives in the composition's own saveable state
     * — the design system's `CropState` — and never in the ViewModel.
     */
    private var committedCrops: Map<String, CropSpec> = emptyMap()

    fun onCropsCommitted(crops: Map<String, CropSpec>) {
        committedCrops = crops
    }

    private fun cropSpecsFor(state: ComposeWizardState): Map<String, CropSpec> {
        val ratio = state.shape.ratio()
        return state.picked.associate { asset ->
            asset.uri to (committedCrops[asset.uri] ?: CropSpec(targetRatio = ratio))
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
        if (asset.upload is AssetUpload.Running) return
        upload(uri, committedCrops[uri] ?: CropSpec(state.shape.ratio()))
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
            val altText = _state.value.picked.firstOrNull { it.uri == uri }?.altText?.ifBlank { null }
            when (val outcome = media.uploadMedia(picture, altText)) {
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
                            asset.mediaId?.let { AttachmentClaim(it) }
                        }
                    } else {
                        emptyList()
                    },
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

    private companion object {
        const val FINDER_DEBOUNCE_MILLIS = 250L
        const val UNREADABLE = "That file could not be read as a picture."
        const val REFUSED = "The server would not take that picture."
        const val TRANSPORT = "The upload could not reach the server."
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
