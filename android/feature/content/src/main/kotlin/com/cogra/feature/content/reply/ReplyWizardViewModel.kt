package com.cogra.feature.content.reply

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceFinderState
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.candidateRows
import com.cogra.feature.content.referenceFieldIndex
import com.cogra.feature.content.tagFieldIndex
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.attachmentFieldIndex
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The reply wizard.
 *
 * The post wizard's shape without its draft store: comments keep no
 * drafts (jakob 2026-09-01), so there is nothing to persist, nothing to
 * offer back, and leaving is simply leaving.
 *
 * Uploads start **at pick** rather than after a crop stage, because
 * comment pictures never crop (design/readme.md §The media slice) —
 * which is also why a picture is uploaded whole, at its own ratio.
 */
@HiltViewModel
class ReplyWizardViewModel @Inject constructor(
    private val content: ContentRepository,
    private val references: ReferenceRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(ReplyWizardState())
    val state: StateFlow<ReplyWizardState> = _state.asStateFlow()

    private val uploads = mutableMapOf<String, Job>()
    private var finderJob: Job? = null
    private var started = false

    /** Pins what is being answered. Idempotent: the route calls it on every entry. */
    fun start(target: ReplyTarget) {
        if (started) return
        started = true
        _state.update { it.copy(target = target) }
    }

    // -- The composer (`ReplyCompose` / `ReplyPictures`) --

    fun onBodyChange(value: String) = _state.update { it.copy(body = value) }

    /**
     * A pick from the platform's own picker — comments have no pick
     * stage. Reading the asset's ratio is what lets it be shown and
     * uploaded whole.
     */
    fun onPicked(uri: String) {
        val before = _state.value
        if (before.picked.any { it.uri == uri } || !before.canAddPicture) return
        _state.update { it.addPick(uri) }
        viewModelScope.launch {
            val ratio = processor.aspectRatio(uri)
            if (ratio != null) _state.update { it.withSourceRatio(uri, ratio) }
            upload(uri, ratio)
        }
    }

    fun onRemovePickAt(index: Int) {
        val uri = _state.value.picked.getOrNull(index)?.uri ?: return
        uploads.remove(uri)?.cancel()
        _state.update { it.removePick(uri) }
    }

    fun onRetryUpload(uri: String) {
        val asset = _state.value.picked.firstOrNull { it.uri == uri } ?: return
        if (asset.upload is AssetUpload.Running) return
        viewModelScope.launch { upload(uri, asset.sourceRatio ?: processor.aspectRatio(uri)) }
    }

    /**
     * One asset, whole.
     *
     * The crop spec names the picture's **own** ratio, which is how "no
     * crop" is said to a processor whose job is to produce a framed
     * export: a target equal to the source frames nothing away.
     */
    private fun upload(uri: String, ratio: Float?) {
        uploads.remove(uri)?.cancel()
        _state.update { it.withUpload(uri, AssetUpload.Running) }
        uploads[uri] = viewModelScope.launch {
            val picture = processor.process(uri, CropSpec(targetRatio = ratio ?: 1f))
            if (picture == null) {
                _state.update { it.withUpload(uri, AssetUpload.Failed(UNREADABLE)) }
                return@launch
            }
            when (val outcome = media.uploadMedia(picture)) {
                is Outcome.Success -> _state.update {
                    it.withUpload(uri, AssetUpload.Done(outcome.value.id))
                }
                is Outcome.Refused -> _state.update {
                    it.withUpload(
                        uri,
                        AssetUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED),
                    )
                }
                is Outcome.Failed -> _state.update { it.withUpload(uri, AssetUpload.Failed(TRANSPORT)) }
            }
        }
    }

    fun onDescribeFirst() = _state.update {
        val next = it.picked.indexOfFirst { asset -> asset.altText.isBlank() }
        it.copy(describingIndex = if (next >= 0) next else 0)
    }

    fun onDescribe(index: Int) = _state.update { it.copy(describingIndex = index) }

    fun onAltTextChange(uri: String, text: String) = _state.update { it.withAltText(uri, text) }

    // -- Stage movement --

    fun onNext() = _state.update { it.advanced() ?: it }

    /** False where there is no stage left to step back to — the caller leaves. */
    fun onBack(): Boolean {
        val next = _state.value.retreated() ?: return false
        _state.value = next
        return true
    }

    fun onSealBack() = _state.update { it.copy(step = ReplyStep.Compose) }

    // -- The seal --

    fun onOpenSheet(sheet: ReplySealSheet) = _state.update { it.copy(sheet = sheet) }

    fun onCloseSheet() = _state.update { it.closedSheets() }

    fun onLicenseChange(license: LicenseChoice) = _state.update { it.copy(license = license) }

    fun onStanceChange(directed: Double, interest: Double) =
        _state.update { it.copy(pDirected = directed, pInterest = interest) }

    fun onOpenHelp(topic: HelpTopic) = _state.update { it.copy(help = topic) }

    fun onCloseHelp() = _state.update { it.copy(help = null) }

    // -- Topics and citations --

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
                    // An answer that arrived after the author typed on is
                    // stale — only the current query's lands.
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

    // -- Signing --

    /**
     * Stages the batch and signs it. A refusal from the prepare stops
     * before any signature: nothing was signed, so nothing may claim
     * signing failed.
     */
    fun onSign() {
        val current = _state.value
        val target = current.target ?: return
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
                val outcome = content.prepareComment(
                    target = target.id,
                    content = current.body,
                    license = current.license,
                    tags = current.tagSection.tags.map { it.toClaim() },
                    references = current.referenceSection.references.map { it.toClaim() },
                    attachments = current.picked.mapNotNull { asset ->
                        asset.mediaId?.let { AttachmentClaim(it, asset.altText.ifBlank { null }) }
                    },
                    pDirected = current.pDirected,
                    pInterest = current.pInterest,
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
                // restoring the key. There is no draft to keep, so the
                // card offers the restore and the way out, nothing else.
                _state.update { it.copy(submitting = false, keyAbsent = true) }
                return@launch
            }

            if (results.all { it is WriteResult.Done }) {
                _state.update {
                    it.copy(submitting = false, outcome = ReplyOutcome.Signed(prepared.node))
                }
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }

    /**
     * The author left. The comment is discarded — comments keep no
     * drafts, so there is nothing here but the signal to go.
     */
    fun onLeave() {
        if (_state.value.outcome != null) return
        uploads.values.forEach { it.cancel() }
        uploads.clear()
        _state.update { it.copy(outcome = ReplyOutcome.Left) }
    }

    fun onOutcomeConsumed() = _state.update { it.copy(outcome = null) }

    /**
     * A refusal from the one write whose input carries the whole batch:
     * the server names the offender by path, so `["tags", i, …]` lands on
     * chip i, `["attachments", i, …]` on pick i, and everything else says
     * its piece once.
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
