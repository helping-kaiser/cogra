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
import com.cogra.domain.signing.ContentShape
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.ExpectedContent
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.commentEdit
import com.cogra.domain.signing.contentExpectation
import com.cogra.domain.signing.editExpectation
import com.cogra.domain.signing.ledgerFor
import com.cogra.domain.topics.TagClaim
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.SectionsEditor
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.edit.undoWithdrawal
import com.cogra.feature.content.editableRow
import com.cogra.feature.content.referenceFieldIndex
import com.cogra.feature.content.tagFieldIndex
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.UploadFailure
import com.cogra.feature.content.wizard.attachmentFieldIndex
import com.cogra.feature.content.wizard.uploadPicture
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

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
                            coverMediaId = asset.cover?.id,
                            coverTaken = asset.coverTaken,
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
                            loadedSensitive = loaded.selfMark.sensitive,
                            loadedSensitiveReason = loaded.selfMark.reason,
                            license = loaded.comment.license,
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

    fun onBodyChange(value: String) = _state.update { it.copy(body = value, recordStaged = true) }

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

    fun onOpenSensitive() = _state.update { it.copy(sensitiveOpen = true) }

    /**
     * Unmarking clears the reason with it: a reason without the mark is
     * refused on `["sensitiveReason"]`, and one kept out of sight would
     * come back with the switch as words the author never re-read.
     */
    fun onSensitiveChange(marked: Boolean) = _state.update {
        it.copy(sensitive = marked, sensitiveReason = if (marked) it.sensitiveReason else null, recordStaged = true)
    }

    fun onSensitiveReasonChange(reason: String) =
        _state.update { it.copy(sensitiveReason = reason, recordStaged = it.recordStaged || it.sensitive) }

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

    /** Undo on a tag's `Withdrawn:` line: it returns as it stood, and the withdrawal unstages. */
    fun onUndoTagWithdrawal(name: String) = updateTags { it.undoWithdrawal(name) }

    /** Undo on a citation's `Withdrawn:` line, the same way. */
    fun onUndoReferenceWithdrawal(targetId: String) = updateReferences { it.undoWithdrawal(targetId) }

    /**
     * Signs the edit, then each tag and citation change — every act the
     * footer counts, the record included once it is staged.
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
            val expected = expectation(current) ?: return@launch
            val writes = mutableListOf<PreparedWriteView>()

            // The edit record only when its payload moved: an edit that
            // changed nothing but a topic stages no Edit act (F10).
            if (current.contentChanged) {
                when (
                    val outcome = content.prepareCommentEdit(
                        id = current.commentId,
                        content = current.body,
                        attachments = sentContent(current).attachments,
                        // Complete state: whatever the Mark row leaves
                        // standing, touched or not. An edit that omitted
                        // it would unveil a comment its author marked.
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
            for (row in current.tagSection.removes) {
                when (
                    val outcome = topics.prepareTag(current.commentId, row.name, WITHDRAWN, WITHDRAWN)
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
                signer.sign(writes, expected)
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

    /**
     * The acts card as the intent check reads it (Intent.kt): the L1 ids of
     * the comment, the node it answers, and every cited node the edit
     * touches are read first, before anything is staged. Null once a read
     * failed — already reported.
     */
    private suspend fun expectation(current: CommentEditState): Expectation? {
        val parent = parentOf(current.commentId) ?: return null
        val refs = current.referenceSection
        val ids = listOf(current.commentId, parent) + (refs.adds + refs.removes).map { it.targetId }
        val graphIds = when (val read = content.graphIds(ids)) {
            is Outcome.Success -> read.value
            is Outcome.Refused -> return null.also { refuse(read.errors) }
            is Outcome.Failed -> return null.also { failTransport() }
        }
        val commentGraphId = graphIds.getValue(current.commentId)
        val record = if (current.contentChanged) {
            val content = contentExpected(current) ?: return null
            commentEdit(graphIds.getValue(parent), commentGraphId, content)
        } else {
            null
        }
        return editExpectation(
            nodeGraphId = commentGraphId,
            record = record,
            tags = current.tagSection.adds.map { it.toClaim() } +
                current.tagSection.removes.map { TagClaim(it.name, WITHDRAWN, WITHDRAWN) },
            references = refs.adds.map { it.toClaim() },
            withdrawals = refs.removes.map { it.toWithdrawn() },
            graphIds = graphIds,
        )
    }

    /** The node the comment answers. Null once the read failed — already reported. */
    private suspend fun parentOf(commentId: String): String? = when (val read = content.commentAnswers(commentId)) {
        is Outcome.Success -> read.value ?: null.also { failTransport() }
        is Outcome.Refused -> null.also { refuse(read.errors) }
        is Outcome.Failed -> null.also { failTransport() }
    }

    /**
     * The record's payload as complete state: the pictures added here are
     * held to the digests this device computed, the kept ones to the
     * digests of the asset each names, read back by id
     * (PayloadExpectation.kt). Null once the read-back failed — already
     * reported.
     */
    private suspend fun contentExpected(current: CommentEditState): ExpectedContent? {
        val sent = sentContent(current)
        val own = current.picked.mapNotNull { asset ->
            (asset.upload as? AssetUpload.Done)?.let { done -> done.known?.let { done.mediaId to it } }
        }.toMap()
        val ledger = when (val read = media.ledgerFor(sent.attachments, own)) {
            is Outcome.Success -> read.value
            is Outcome.Refused -> return null.also { refuse(read.errors) }
            is Outcome.Failed -> return null.also { failTransport() }
        }
        return contentExpectation(current.commentId, sent, ContentShape.COMMENT, ledger)
    }

    /**
     * The edit record's request, read by the prepare and by the payload
     * expectation alike: the words, the whole gallery the edit leaves
     * standing, and the mark as the transport sends it for an edit — the
     * reason untouched (RepositoryImpls `prepareCommentEdit`).
     */
    private fun sentContent(current: CommentEditState): SentContent = SentContent(
        content = current.body,
        attachments = current.picked.mapNotNull { asset ->
            asset.mediaId?.let {
                AttachmentClaim(it, asset.altText.ifBlank { null }, asset.coverMediaId, asset.coverTaken)
            }
        },
        sensitive = current.sensitive,
        sensitiveReason = current.sensitiveReason,
    )

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

        /** A Tag at (0,0) — both parameters at this value — is how a topic is taken off (hashtag.md §4). */
        const val WITHDRAWN = 0.0

        // The one message still carried as prose: `refusal` is also the
        // channel the server's own words arrive on, so moving this to a
        // resource means reshaping `problem()` on three screens and the
        // JVM tests that read it — a sweep of its own (AND-04 note).
        const val GONE = "That comment is no longer there."
    }
}
