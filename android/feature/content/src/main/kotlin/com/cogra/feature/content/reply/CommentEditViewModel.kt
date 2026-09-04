package com.cogra.feature.content.reply

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.SectionsEditor
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.editableRow
import com.cogra.feature.content.referenceFieldIndex
import com.cogra.feature.content.tagFieldIndex
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.UploadFailure
import com.cogra.feature.content.wizard.uploadPicture
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.attachmentFieldIndex
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * `CommentEdit`.
 *
 * The one thing this holds that the screen never shows is the comment's
 * **standing sensitive mark**: `PrepareCommentEditInput` is
 * complete-state, so an edit that does not re-state the mark clears it.
 * The mark is read when the edit opens and sent back unchanged.
 */
@HiltViewModel
class CommentEditViewModel @Inject constructor(
    private val content: ContentRepository,
    private val references: ReferenceRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val signer: WriteSigner,
    private val topics: TopicRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CommentEditState())
    val state: StateFlow<CommentEditState> = _state.asStateFlow()

    private val uploads = mutableMapOf<String, Job>()

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
     * Opens the edit on the comment as it stands.
     *
     * Everything but the parent's title is read rather than handed in:
     * the edit is complete-state on every axis, so starting from a
     * thread card's snapshot would risk signing away whatever the card
     * did not happen to carry. [parentTitle] is only the caption's
     * words, so it rides the route.
     */
    fun start(commentId: String, parentTitle: String) {
        if (started) return
        started = true
        _state.update { it.copy(commentId = commentId, parentTitle = parentTitle) }
        viewModelScope.launch {
            when (val outcome = content.commentForEdit(commentId)) {
                is Outcome.Success -> outcome.value?.let { loaded ->
                    // The gallery arrives already landed, so nothing
                    // re-uploads: these are the entries the edit keeps.
                    val landed = loaded.comment.attachments.map { asset ->
                        PickedAsset(
                            uri = asset.url,
                            sourceRatio = asset.aspectRatio,
                            altText = asset.altText.orEmpty(),
                            upload = AssetUpload.Done(asset.id),
                        )
                    }
                    val body = loaded.comment.content.value.orEmpty()
                    // The editor opens on what the comment actually
                    // carries — real stored parameters, not the defaults
                    // a fresh chip would take (F10) — so leaving a topic
                    // alone re-declares nothing.
                    val tags = loaded.comment.topics.map { claim ->
                        TagRow(
                            name = claim.hashtag.name.value.orEmpty(),
                            relevance = claim.relevance,
                            confidence = claim.confidence,
                        )
                    }
                    // A citation this build could not type is
                    // unaddressable — no write could name it — so it
                    // stays out of the editable section entirely and its
                    // absence is never read as a removal.
                    val refs = loaded.comment.references.mapNotNull { it.editableRow() }
                    _state.update {
                        it.copy(
                            loading = false,
                            body = body,
                            loadedBody = body,
                            picked = landed,
                            loadedAttachmentIds = landed.mapNotNull { p -> p.mediaId },
                            tagSection = TagSectionState(tags = tags, loaded = tags),
                            referenceSection = ReferenceSectionState(
                                references = refs,
                                loaded = refs,
                            ),
                            sensitive = loaded.selfMark.sensitive,
                            sensitiveReason = loaded.selfMark.reason,
                        )
                    }
                } ?: _state.update { it.copy(loading = false, refusal = GONE) }

                is Outcome.Refused -> _state.update { it.copy(loading = false, refusal = GONE) }
                is Outcome.Failed -> _state.update {
                    it.copy(loading = false, transportFailed = true)
                }
            }
        }
    }

    fun onBodyChange(value: String) = _state.update { it.copy(body = value) }

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

    /** One asset, whole: a target equal to the source frames nothing away. */
    private fun upload(uri: String, ratio: Float?) {
        uploads.remove(uri)?.cancel()
        _state.update { it.withUpload(uri, AssetUpload.Running) }
        uploads[uri] = viewModelScope.launch {
            val result = uploadPicture(uri, CropSpec(targetRatio = ratio ?: 1f), processor, media)
            _state.update { it.withUpload(uri, result) }
        }
    }

    fun onDescribeFirst() = _state.update {
        val next = it.picked.indexOfFirst { asset -> asset.altText.isBlank() }
        it.copy(describingIndex = if (next >= 0) next else 0)
    }

    fun onAltTextChange(uri: String, text: String) = _state.update { it.withAltText(uri, text) }

    fun onOpenActs() = _state.update { it.copy(actsOpen = true) }

    fun onCloseSheet() = _state.update { it.closedSheets() }

    /**
     * The way out the author asked for.
     *
     * The comment edit keeps no draft, so leaving it discards — and an
     * edit that changed something is asked first (`DiscardConfirm`,
     * design/readme.md §13). One opened and closed untouched leaves at
     * once: a confirm with nothing to lose is noise.
     *
     * Answers whether the caller may leave now.
     */
    fun onLeaveRequested(): Boolean {
        if (!_state.value.hasSomethingToLose) return true
        _state.update { it.copy(confirmingDiscard = true) }
        return false
    }

    /** "Keep writing" — the dialog closes over the edit it covered. */
    fun onKeepWriting() = _state.update { it.copy(confirmingDiscard = false) }

    fun onOpenHelp(topic: HelpTopic) = _state.update { it.copy(help = topic) }

    fun onCloseHelp() = _state.update { it.copy(help = null) }

    // -- Topics and citations --

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

    /**
     * Signs the edit, then each topic and citation the edit newly
     * declares — the "2 signed actions" the footer counts.
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
            val writes = mutableListOf<PreparedWriteView>()

            // The edit record only when its payload moved: an edit that
            // changed nothing but a topic stages no Edit act (F10).
            if (current.contentChanged) {
                when (
                    val outcome = content.prepareCommentEdit(
                        id = current.commentId,
                        content = current.body,
                        attachments = current.picked.mapNotNull { asset ->
                            asset.mediaId?.let {
                                AttachmentClaim(it, asset.altText.ifBlank { null })
                            }
                        },
                        // The standing mark, re-stated. The screen offers
                        // no switch, so this is exactly what was read when
                        // the edit opened — an edit must never unveil a
                        // comment its author marked.
                        sensitive = current.sensitive,
                        sensitiveReason = current.sensitiveReason,
                    )
                ) {
                    is Outcome.Success -> writes += outcome.value.writes
                    is Outcome.Refused -> return@launch refuse(outcome.errors)
                    is Outcome.Failed -> return@launch failTransport()
                }
            }

            // Topics and citations are never edit fields: each change is
            // its own priced act, staged beside the edit (post.md §3).
            for (row in current.tagSection.adds) {
                when (
                    val outcome =
                        topics.prepareTag(current.commentId, row.name, row.relevance, row.confidence)
                ) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuse(outcome.errors)
                    is Outcome.Failed -> return@launch failTransport()
                }
            }
            for (name in current.tagSection.removes) {
                when (
                    val outcome = topics.prepareTag(current.commentId, name, pDirected = WITHDRAWN)
                ) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuse(outcome.errors)
                    is Outcome.Failed -> return@launch failTransport()
                }
            }
            for (row in current.referenceSection.adds) {
                when (
                    val outcome = references.prepareReference(
                        current.commentId,
                        row.targetId,
                        row.relevance,
                        row.support,
                    )
                ) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuse(outcome.errors)
                    is Outcome.Failed -> return@launch failTransport()
                }
            }
            for (row in current.referenceSection.removes) {
                when (
                    val outcome =
                        references.prepareReferenceWithdrawal(current.commentId, row.targetId)
                ) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuse(outcome.errors)
                    is Outcome.Failed -> return@launch failTransport()
                }
            }

            val results = try {
                signer.sign(writes)
            } catch (_: NoActorKeyException) {
                _state.update { it.copy(submitting = false, keyAbsent = true) }
                return@launch
            }

            if (results.all { it is WriteResult.Done }) {
                _state.update { it.copy(submitting = false, saved = true) }
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }

    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

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

    private companion object {

        /** A Tag at relevance 0 is how a topic is taken off (hashtag.md §4). */
        const val WITHDRAWN = 0.0

        // The one message still carried as prose: `refusal` is also the
        // channel the server's own words arrive on, so moving this to a
        // resource means reshaping `problem()` on three screens and the
        // JVM tests that read it — a sweep of its own (AND-04 note).
        const val GONE = "That comment is no longer there."
    }
}
