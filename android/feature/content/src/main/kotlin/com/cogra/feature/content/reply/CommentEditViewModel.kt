package com.cogra.feature.content.reply

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.map
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.VideoProcessor
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.search.SearchRepository
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
import com.cogra.feature.content.ReferencePickerEditor
import com.cogra.feature.content.ReferencePickerHandlers
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.SectionsEditor
import com.cogra.feature.content.TagPickerEditor
import com.cogra.feature.content.TagPickerHandlers
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.edit.EditCrop
import com.cogra.feature.content.edit.EditGallery
import com.cogra.feature.content.edit.EditMediaEditor
import com.cogra.feature.content.edit.EditPicture
import com.cogra.feature.content.edit.undoWithdrawal
import com.cogra.feature.content.editableRow
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.SealFault
import com.cogra.feature.content.wizard.UploadFailure
import com.cogra.feature.content.wizard.sealFaultOf
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * `CommentEdit` and `CommentEditVideo`.
 *
 * The one thing this holds that the screen never shows is the comment's
 * **standing sensitive mark**: `PrepareCommentEditInput` is complete-state,
 * so an edit that does not re-state the mark clears it. The mark is read
 * when the edit opens and sent back unchanged.
 *
 * NOTHING SIGNS BEFORE THE BYTES EXIST (CommentEdit.md, CommentEditVideo.md):
 * the pictures the edit adds and a clip's new face upload the moment they
 * are taken; a press of Sign the edit while they run is HELD and signs when
 * the last lands, and a failed upload drops it.
 */
@HiltViewModel
class CommentEditViewModel @Inject constructor(
    private val content: ContentRepository,
    private val references: ReferenceRepository,
    private val media: MediaRepository,
    processor: MediaProcessor,
    private val signer: WriteSigner,
    private val topics: TopicRepository,
    video: VideoProcessor,
    /** The one search read the tag picker's index rides (`#prefix` over topics). */
    search: SearchRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CommentEditState())
    val state: StateFlow<CommentEditState> = _state.asStateFlow()

    private var slowTimer: Job? = null

    private val sections = SectionsEditor(
        scope = viewModelScope,
        references = references,
        state = _state,
        tagsOf = { it.tagSection },
        withTags = { state, tags -> state.copy(tagSection = tags) },
        referencesOf = { it.referenceSection },
        withReferences = { state, refs -> state.copy(referenceSection = refs) },
    )

    /** `+ Add a tag`: the tag picker in the edit's place (TagPicker), its picks staged straight into the edit. */
    val tagPicker: TagPickerHandlers = TagPickerEditor(
        scope = viewModelScope,
        search = search,
        state = _state,
        tagsOf = { it.tagSection },
        withTags = { state, tags -> state.copy(tagSection = tags) },
    )

    /** `+ Cite something`: the citation picker in the edit's place (ReferencePicker). */
    val referencePicker: ReferencePickerHandlers = ReferencePickerEditor(
        scope = viewModelScope,
        references = references,
        state = _state,
        referencesOf = { it.referenceSection },
        withReferences = { state, refs -> state.copy(referenceSection = refs) },
    )

    private val uploads = EditMediaEditor(
        scope = viewModelScope,
        state = _state,
        processor = processor,
        media = media,
        video = video,
        galleryOf = { it.gallery },
        withGallery = { state, gallery -> state.copy(gallery = gallery) },
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
                            // The gallery arrives already landed, so nothing
                            // re-uploads: these are the entries the edit keeps.
                            gallery = EditGallery.of(loaded.comment.attachments),
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

    /**
     * What the platform's own picker handed back (`+ Add pictures`) — NEVER a
     * pick stage. A comment's pictures never crop: each goes up whole the
     * moment it is taken. Past the fourth, the file is refused in words under
     * the pictures (copy-voice, *Refused files*), never dropped in silence.
     */
    fun onPicked(uris: List<String>) {
        if (uris.isEmpty() || !_state.value.canAddPicture) return
        viewModelScope.launch {
            val screened = uploads.screen(
                uris = uris,
                cap = CommentEditState.MAX_PICTURES,
                overCap = UploadFailure.COMMENT_PICTURE_COUNT,
                mayHoldVideo = false,
            )
            _state.update {
                it.copy(
                    gallery = it.gallery.adding(screened.accepted, CommentEditState.MAX_PICTURES),
                    refused = it.refused + screened.refused,
                    recordStaged = it.recordStaged || screened.accepted.isNotEmpty(),
                )
            }
            screened.accepted.forEach { uploads.upload(it.uri) }
        }
    }

    /**
     * A picture leaves the batch, its upload with it — or the clip leaves
     * whole, taking the comment's media with it, and the comment is its words
     * (CommentEditVideo.md).
     */
    fun onRemovePickAt(index: Int) {
        val gallery = _state.value.gallery
        val picture = gallery.pictures.getOrNull(index) ?: return
        uploads.cancel(picture.key)
        if (gallery.clip?.key == picture.key) gallery.newCover?.let { uploads.cancel(it.uri) }
        _state.update {
            it.copy(gallery = it.gallery.removing(picture.key), describingIndex = null, recordStaged = true)
        }
    }

    /** `Remove it` on a refused file: its line leaves. */
    fun onDismissRefusal(index: Int) = _state.update {
        it.copy(refused = it.refused.filterIndexed { i, _ -> i != index })
    }

    /** `Retry`, under the pictures or in the gate: every failed upload tries again — and never signs on its own. */
    fun onRetryUploads() = uploads.retryFailed()

    /** `Remove it` / `Remove them` under the pictures: every failed picture leaves the batch. */
    fun onRemoveFailed() {
        _state.value.gallery.pictures
            .filter { it is EditPicture.Added && it.asset.upload is AssetUpload.Failed }
            .forEach { failed ->
                val index = _state.value.gallery.pictures.indexOfFirst { it.key == failed.key }
                if (index >= 0) onRemovePickAt(index)
            }
    }

    // -- The clip's cover (`CommentEditVideo`, `CoverCrop`) --

    /**
     * `Change the cover` / `Add a cover`: the platform's own picker handed
     * back a picture — NEVER the clip's frames — and it passes the cover's
     * crop, locked to the comment's square, before it lands on the edit.
     */
    fun onPickCover(uri: String) = _state.update { st ->
        if (st.gallery.clip == null) return@update st
        st.copy(cropping = EditCrop.Cover(PickedAsset(uri), ratio = COMMENT_SQUARE))
    }

    fun onCoverCropChanged(crop: CropSpec) = _state.update { st ->
        st.copy(cropping = st.cropping?.copy(crop = crop))
    }

    /** The cover's crop's back arrow: the edit comes back, the picture unused. */
    fun onCropBack() = _state.update { it.copy(cropping = null) }

    /**
     * The cover's crop's Next: the cover row comes back with the new face,
     * and only its cropped export leaves the device. A face set is a change
     * to the record — the clip's attachment points at it from the signing.
     */
    fun onCoverCropDone() {
        val crop = _state.value.cropping ?: return
        _state.value.gallery.newCover?.let { uploads.cancel(it.uri) }
        val spec = crop.crop ?: CropSpec(targetRatio = crop.ratio)
        _state.update {
            it.copy(gallery = it.gallery.withNewCover(crop.asset, spec), cropping = null, recordStaged = true)
        }
        uploads.upload(crop.asset.uri)
    }

    /** `Remove it` under the cover row: the new face leaves, and the row reads as it stood before the edit. */
    fun onRemoveCover() {
        _state.value.gallery.newCover?.let { uploads.cancel(it.uri) }
        _state.update { it.copy(gallery = it.gallery.withNewCover(null)) }
    }

    fun onDescribeFirst() = _state.update {
        val next = it.gallery.pictures.indexOfFirst { picture -> picture.altText.isBlank() }
        it.copy(describingIndex = if (next >= 0) next else 0)
    }

    fun onAltTextChange(key: String, text: String) =
        _state.update { it.copy(gallery = it.gallery.withAltText(key, text), recordStaged = true) }

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
     * The way out the author asked for — the edit's back arrow or X, or the
     * cover crop's X, which is the edit's own (CoverCrop.md).
     *
     * The comment edit keeps no draft, so leaving it discards — and an
     * edit that changed something is asked first (`DiscardConfirm`,
     * design/readme.md §13). One opened and closed untouched leaves at
     * once: a confirm with nothing to lose is noise. Refused while the
     * signing holds the reader.
     *
     * Answers whether the caller may leave now.
     */
    fun onLeaveRequested(): Boolean {
        val s = _state.value
        if (s.pressed) return false
        if (!s.hasSomethingToLose) return true
        _state.update { it.copy(confirmingDiscard = true) }
        return false
    }

    /** "Keep writing" — the dialog closes over the edit it covered. */
    fun onKeepWriting() = _state.update { it.copy(confirmingDiscard = false) }

    /** `Discard the edit` under the bug notice: asks first (`Discard the changes?`). */
    fun onDiscardAsked() = _state.update { it.copy(confirmingDiscard = true) }

    /** `Not now` under the write rule's notice: the notice goes, the edit stands with the changes as they were. */
    fun onNotNow() = _state.update { it.copy(fault = null) }

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

    fun onOpenFinder() = sections.onOpenFinder()

    fun onCloseFinder() = sections.onCloseFinder()

    fun onFinderQueryChange(query: String) = sections.onFinderQueryChange(query)

    fun onPickReference(row: ReferenceCandidateRow) = sections.onPickReference(row)

    /**
     * A citation's ×, or `Remove it` under the line that says it never
     * landed: the refused row's fault goes with it.
     */
    fun onRemoveReference(targetId: String) {
        sections.onRemoveReference(targetId)
        _state.update { st ->
            if ((st.fault as? SealFault.Row)?.targetId == targetId) st.copy(fault = null) else st
        }
    }

    fun onTuneReference(targetId: String) = sections.onTuneReference(targetId)

    fun onDoneTuningReference() = sections.onDoneTuningReference()

    fun onReferenceRelevanceChange(targetId: String, value: Double) =
        sections.onReferenceRelevanceChange(targetId, value)

    fun onReferenceSupportChange(targetId: String, value: Double) =
        sections.onReferenceSupportChange(targetId, value)

    /** Undo on a tag's `Withdrawn:` line: it returns as it stood, and the withdrawal unstages. */
    fun onUndoTagWithdrawal(name: String) = sections.updateTags { it.undoWithdrawal(name) }

    /** Undo on a citation's `Withdrawn:` line, the same way. */
    fun onUndoReferenceWithdrawal(targetId: String) = sections.updateReferences { it.undoWithdrawal(targetId) }

    // -- Signing --

    /**
     * Signs the edit, then each tag and citation change — every act the
     * footer counts, the record included once it is staged. A press while
     * the uploads run is held, and signs when the last lands (CommentEdit.md).
     */
    fun onSign() {
        if (!_state.value.canSign) return
        beginPress()
        viewModelScope.launch {
            val settled = _state.first { it.gallery.uploadsFailed > 0 || it.gallery.claims != null }
            // A failure drops the held press: the gate takes its fault
            // reading and nothing signs until Sign the edit is pressed again.
            if (settled.gallery.uploadsFailed > 0) return@launch end { it }
            _state.update { it.copy(heldPress = false, submitting = true) }
            val current = _state.value
            val expected = expectation(current) ?: return@launch
            val writes = prepareBatch(current) ?: return@launch
            // THE COUNT THE SIGNING PREPARED IS THE ONE THE FOOT READ, or
            // nothing is signed: the held press drops (CommentEdit.md).
            if (writes.size != current.signedActionCount) return@launch end { it.copy(countChanged = true) }

            val results = try {
                signer.sign(writes, expected)
            } catch (_: NoActorKeyException) {
                return@launch end { it.copy(keyAbsent = true) }
            }
            if (results.all { it is WriteResult.Done }) {
                end { it.copy(saved = true) }
            } else {
                end { it.copy(signingFailed = true) }
            }
        }
    }

    /** The press: what the last one left clears, the press holds, and past 5s the slow line stands. */
    private fun beginPress() {
        _state.update {
            it.copy(
                heldPress = true,
                slow = false,
                countChanged = false,
                fault = null,
                refusal = null,
                signingFailed = false,
                keyAbsent = false,
                transportFailed = false,
            )
        }
        slowTimer?.cancel()
        slowTimer = viewModelScope.launch {
            delay(SLOW_SIGNING_MS)
            _state.update { it.copy(slow = it.pressed) }
        }
    }

    /**
     * Prepares EVERY act before signing any: the edit record only when its
     * payload moved — an edit that changed nothing but a topic stages no Edit
     * act (F10) — then each topic and citation change, its own priced act
     * (post.md §3). Null once a prepare refused or failed — already reported.
     */
    private suspend fun prepareBatch(current: CommentEditState): List<PreparedWriteView>? {
        val writes = mutableListOf<PreparedWriteView>()
        if (current.contentChanged) {
            val sent = sentContent(current)
            writes += staged(
                content.prepareCommentEdit(
                    id = current.commentId,
                    content = current.body,
                    attachments = sent.attachments,
                    // Complete state: whatever the Mark row leaves standing,
                    // touched or not. An edit that omitted it would unveil a
                    // comment its author marked.
                    sensitive = current.sensitive,
                    sensitiveReason = current.sensitiveReason,
                ).map { it.writes },
            ) ?: return null
        }
        for (row in current.tagSection.adds) {
            writes += staged(topics.prepareTag(current.commentId, row.name, row.relevance, row.confidence))
                ?: return null
        }
        for (row in current.tagSection.removes) {
            writes += staged(topics.prepareTag(current.commentId, row.name, WITHDRAWN, WITHDRAWN)) ?: return null
        }
        for (row in current.referenceSection.adds) {
            writes += staged(
                references.prepareReference(current.commentId, row.targetId, row.relevance, row.support),
            ) ?: return null
        }
        for (row in current.referenceSection.removes) {
            writes += staged(references.prepareReferenceWithdrawal(current.commentId, row.targetId))
                ?: return null
        }
        return writes
    }

    private fun staged(outcome: Outcome<List<PreparedWriteView>>): List<PreparedWriteView>? = when (outcome) {
        is Outcome.Success -> outcome.value
        is Outcome.Refused -> null.also { refuse(outcome.errors) }
        is Outcome.Failed -> null.also { failTransport() }
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
     * The record's payload as complete state: the bytes uploaded here are
     * held to the digests this device computed, the kept ones to the digests
     * of the asset each names, read back by id (PayloadExpectation.kt). Null
     * once the read-back failed — already reported.
     */
    private suspend fun contentExpected(current: CommentEditState): ExpectedContent? {
        val sent = sentContent(current)
        val ledger = when (val read = media.ledgerFor(sent.attachments, current.gallery.ownKnown)) {
            is Outcome.Success -> read.value
            is Outcome.Refused -> return null.also { refuse(read.errors) }
            is Outcome.Failed -> return null.also { failTransport() }
        }
        return contentExpectation(current.commentId, sent, ContentShape.COMMENT, ledger)
    }

    /**
     * The edit record's request, read by the prepare and by the payload
     * expectation alike: the words, the whole gallery the edit leaves
     * standing — each placement naming the cover it keeps or the face the
     * edit set — and the mark as the transport sends it for an edit, the
     * reason untouched (RepositoryImpls `prepareCommentEdit`).
     */
    private fun sentContent(current: CommentEditState): SentContent = SentContent(
        content = current.body,
        attachments = current.gallery.claims.orEmpty(),
        sensitive = current.sensitive,
        sensitiveReason = current.sensitiveReason,
    )

    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    /** The press answered, or dropped: it is released, and the slow line goes. */
    private fun end(block: (CommentEditState) -> CommentEditState) {
        slowTimer?.cancel()
        _state.update { block(it.copy(submitting = false, heldPress = false, slow = false)) }
    }

    /**
     * A refusal, read the way the edit draws it (`SealFault`): the write
     * rule's notice, the one citation whose target never landed — said on its
     * row — or the bug notice for any other refused act (CommentEdit.md).
     */
    private fun refuse(errors: List<UserError>) = end { st ->
        st.copy(fault = sealFaultOf(errors, st.referenceSection.references))
    }

    private fun failTransport() = end { it.copy(transportFailed = true) }

    companion object {
        /** A Tag at (0,0) — both parameters at this value — is how a topic is taken off (hashtag.md §4). */
        private const val WITHDRAWN = 0.0

        /** The comment pager's square: a comment clip's face is cut to it (CoverCrop.md). */
        private const val COMMENT_SQUARE = 1f

        /** How long a signing may go unanswered before the foot says the network is slow. */
        const val SLOW_SIGNING_MS = 5_000L

        // The one message still carried as prose: `refusal` is also the
        // channel the server's own words arrive on, so moving this to a
        // resource means reshaping `problem()` on three screens and the
        // JVM tests that read it — a sweep of its own (AND-04 note).
        private const val GONE = "That comment is no longer there."
    }
}
