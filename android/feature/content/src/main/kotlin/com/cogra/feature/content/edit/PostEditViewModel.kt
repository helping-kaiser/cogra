package com.cogra.feature.content.edit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.content.isDescriptionTooLong
import com.cogra.domain.content.isPostBodyTooLong
import com.cogra.domain.content.isSensitiveReasonTooLong
import com.cogra.domain.content.isTitleTooLong
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.store.IdentityStore
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.SectionsEditor
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.editableRow
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The post edit — `EditCompose`, `EditComposeVideo`, `EditWords`,
 * `EditPicked`, `EditActs` and `EditComposeUnchanged`: one screen, one batch.
 *
 * AN EDIT IS COMPLETE STATE (`PreparePostEditInput`): the record re-states
 * the title, the description, the body, the gallery and the author's own
 * mark, so each is carried from the read and sent back whether or not it was
 * touched. THE GUARD IS THE ACTS BATCH ([recordStaged]), never a byte
 * comparison. THE BODY IS WORDS OR MEDIA: the last picture or the clip
 * leaving flips it to words, the field empty and the standing description
 * dropped with the pictures (K8.1/D4; design/readme.md:8179-8181).
 */
data class PostEditUiState(
    val postId: String? = null,
    val loading: Boolean = false,
    val notFound: Boolean = false,
    val title: String = "",
    val description: String = "",
    val body: String = "",
    /** The license as signed — shown, locked; an edit has nothing to change it to. */
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    /** The gallery the edit leaves standing, in its order; the first is the cover. */
    val attachments: List<MediaAssetView> = emptyList(),
    val tagSection: TagSectionState = TagSectionState(),
    val referenceSection: ReferenceSectionState = ReferenceSectionState(),
    /** The author's own mark — never the OR a reader sees (round 4). */
    val sensitive: Boolean = false,
    val sensitiveReason: String? = null,
    /**
     * Whether the edit record is in the batch. STICKY: set by the first
     * change to a field the record carries and never cleared by typing it
     * back (EditComposeUnchanged.md:3).
     */
    val recordStaged: Boolean = false,
    val sensitiveOpen: Boolean = false,
    val actsOpen: Boolean = false,
    val pickedOpen: Boolean = false,
    /** The picture whose describe sheet is up, by its place in [attachments]. */
    val describingIndex: Int? = null,
    val submitting: Boolean = false,
    /** The signing has gone 5s unanswered — the slow line stands under the count. */
    val slow: Boolean = false,
    /** The prepared batch was not the one the foot read — the held press dropped. */
    val countChanged: Boolean = false,
    /** The write rule refused: `You can't sign right now` takes the commit's place. */
    val writeRuleRefused: Boolean = false,
    /** The key is not on this device: the key-absent seal stands, nothing staged. */
    val keyAbsent: Boolean = false,
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    val transportFailed: Boolean = false,
    /** One-shot: the edit signed; the caller returns to the post. */
    val saved: Boolean = false,
) {
    /** Whether the body is media: the gallery holds anything. */
    val mediaBody: Boolean get() = attachments.isNotEmpty()

    /** Whether the body is one clip — `EditComposeVideo`'s anatomy. */
    val clipBody: Boolean get() = attachments.size == 1 && attachments.first().isVideo

    /** The batch, every kind a row counted in the records it signs (`EditActs`). */
    val actRows: List<EditActRow>
        get() = editActRows(
            recordStaged = recordStaged,
            recordName = title.trim().ifEmpty { body.trim().take(RECORD_NAME_CHARS) }.ifEmpty { "The post" },
            tags = tagSection,
            references = referenceSection,
        )

    /** What one signature commits, in records — the guard reads this and nothing else. */
    val signedActionCount: Int get() = actRows.actCount()

    val titleTooLong: Boolean get() = isTitleTooLong(title)

    /** A description stands beside media only; the words edit carries none. */
    val descriptionTooLong: Boolean get() = mediaBody && isDescriptionTooLong(description)

    /** The words body's own cap — a media post's body is never this field. */
    val bodyTooLong: Boolean get() = !mediaBody && isPostBodyTooLong(body)

    val sensitiveReasonTooLong: Boolean
        get() = sensitive && isSensitiveReasonTooLong(sensitiveReason.orEmpty())

    /** A field past its cap holds the sign the way an empty batch does. */
    val overCap: Boolean
        get() = titleTooLong || descriptionTooLong || bodyTooLong || sensitiveReasonTooLong

    /** Inert, never hidden, at an empty batch (EditComposeUnchanged.md:5). */
    val canSign: Boolean
        get() = !loading && !submitting && signedActionCount > 0 && !overCap

    val anySheetOpen: Boolean get() = sensitiveOpen || actsOpen || pickedOpen || describingIndex != null

    companion object {
        /** How much of the words the acts card's Edit row names when there is no title. */
        const val RECORD_NAME_CHARS = 60
    }
}

@HiltViewModel
class PostEditViewModel @Inject constructor(
    private val content: ContentRepository,
    private val topics: TopicRepository,
    private val references: ReferenceRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(PostEditUiState())
    val state = _state.asStateFlow()

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

    /** Route entry: reads the post the edit opens on. */
    fun start(postId: String) {
        if (_state.value.postId == postId) return
        _state.update { it.copy(postId = postId, loading = true) }
        viewModelScope.launch {
            when (val outcome = content.post(postId, commentsFirst = 1, commentsAfter = null)) {
                is Outcome.Success -> {
                    val post = outcome.value?.post
                        ?: return@launch _state.update { it.copy(loading = false, notFound = true) }
                    val tags = post.topics.map { claim ->
                        TagRow(
                            name = claim.hashtag.name.value.orEmpty(),
                            relevance = claim.relevance,
                            confidence = claim.confidence,
                        )
                    }
                    // A citation this instance could not type is
                    // unaddressable — no write could name it — so it stays
                    // out of the editable section and its absence is never
                    // read as a withdrawal.
                    val refs = post.references.mapNotNull { it.editableRow() }
                    // The mark is read before the edit opens, never
                    // defaulted: an edit prepared without it unmarks the
                    // post, so a mark this read could not confirm is a mark
                    // no edit may be built on.
                    val mark = when (val marked = content.postSelfMark(postId)) {
                        is Outcome.Success -> marked.value
                        is Outcome.Refused -> return@launch _state.update {
                            it.copy(loading = false, notFound = true)
                        }
                        is Outcome.Failed -> return@launch _state.update {
                            it.copy(loading = false, transportFailed = true)
                        }
                    }
                    _state.update {
                        it.copy(
                            loading = false,
                            title = post.title.value.orEmpty(),
                            description = post.description.value.orEmpty(),
                            body = post.content.value.orEmpty(),
                            license = post.license,
                            attachments = post.attachments,
                            sensitive = mark?.sensitive ?: false,
                            sensitiveReason = mark?.reason,
                            tagSection = TagSectionState(tags = tags, loaded = tags),
                            referenceSection = ReferenceSectionState(references = refs, loaded = refs),
                        )
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, notFound = true) }
                is Outcome.Failed -> _state.update { it.copy(loading = false, transportFailed = true) }
            }
        }
    }

    fun onTitleChange(v: String) = _state.update { it.copy(title = v, recordStaged = true) }

    fun onDescriptionChange(v: String) = _state.update { it.copy(description = v, recordStaged = true) }

    fun onBodyChange(v: String) = _state.update { it.copy(body = v, recordStaged = true) }

    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    fun onOpenSensitive() = _state.update { it.copy(sensitiveOpen = true) }

    fun onOpenActs() = _state.update { it.copy(actsOpen = true) }

    fun onOpenPicked() = _state.update { it.copy(pickedOpen = true) }

    /** Every drawer closes onto the edit, and whatever it applied stands (EditPicked.md). */
    fun onCloseSheet() =
        _state.update { it.copy(sensitiveOpen = false, actsOpen = false, pickedOpen = false, describingIndex = null) }

    /** Unmarking drops the reason with it: the contract refuses a reason without the mark. */
    fun onSensitiveChange(marked: Boolean) = _state.update {
        it.copy(sensitive = marked, sensitiveReason = if (marked) it.sensitiveReason else null, recordStaged = true)
    }

    /** A reason only takes input while marked, so only then does it stage the record. */
    fun onSensitiveReasonChange(reason: String) = _state.update {
        it.copy(sensitiveReason = reason.ifBlank { null }, recordStaged = it.recordStaged || it.sensitive)
    }

    // -- The pictures (`EditPicked`) --

    /** Moves the picture at [from] to [to]; the one now first is the cover. */
    fun onMovePicture(from: Int, to: Int) = _state.update {
        val list = it.attachments
        if (from == to || from !in list.indices || to !in list.indices) return@update it
        val moved = list.toMutableList().apply { add(to, removeAt(from)) }
        it.copy(attachments = moved, recordStaged = true)
    }

    /**
     * A picture or the clip leaves the edit's batch. The LAST one leaving
     * flips the body to words: the sheet closes onto the words edit, the
     * field arrives empty, and the description goes with the pictures it
     * stood beside — never refused (EditPicked.md, EditWords.md; K8.1/D4).
     */
    fun onRemovePicture(index: Int) = _state.update {
        if (index !in it.attachments.indices) return@update it
        val left = it.attachments.filterIndexed { i, _ -> i != index }
        val flipped = left.isEmpty()
        it.copy(
            attachments = left,
            body = if (flipped) "" else it.body,
            description = if (flipped) "" else it.description,
            pickedOpen = it.pickedOpen && !flipped,
            describingIndex = null,
            recordStaged = true,
        )
    }

    fun onDescribePicture(index: Int) = _state.update { it.copy(describingIndex = index) }

    fun onAltTextChange(index: Int, text: String) = _state.update {
        if (index !in it.attachments.indices) return@update it
        val described = it.attachments.mapIndexed { i, asset ->
            if (i == index) asset.copy(altText = text.ifBlank { null }) else asset
        }
        it.copy(attachments = described, recordStaged = true)
    }

    // -- Tags and citations: their own acts, beside the record --

    fun onTagInputChange(v: String) = sections.onTagInputChange(v)

    fun onAddTag() = sections.onAddTag()

    fun onRemoveTag(name: String) = sections.onRemoveTag(name)

    fun onTuneTag(name: String) = sections.onTuneTag(name)

    fun onDoneTuningTag() = sections.onDoneTuningTag()

    fun onTagRelevanceChange(name: String, value: Double) = sections.onTagRelevanceChange(name, value)

    fun onTagConfidenceChange(name: String, value: Double) = sections.onTagConfidenceChange(name, value)

    /** Undo on a tag's `Withdrawn:` line: it returns as it stood, and the withdrawal unstages. */
    fun onUndoTagWithdrawal(name: String) = sections.updateTags { it.undoWithdrawal(name) }

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

    /** Undo on a citation's `Withdrawn:` line, the same way. */
    fun onUndoReferenceWithdrawal(targetId: String) = sections.updateReferences { it.undoWithdrawal(targetId) }

    // -- Signing --

    /**
     * Sign the edit. Sign is the confirmation: the count is said on the foot
     * and in the acts sheet, and no dialog asks again (EditActs.jsx). A press
     * while the signing is out is refused.
     */
    fun onSign() {
        val s = _state.value
        if (!s.canSign) return
        val postId = s.postId ?: return
        beginSigning()
        viewModelScope.launch {
            // THE KEY-ABSENT SEAL: nothing is staged or signed without the key.
            if (identity.actorSeed() == null) return@launch end { it.copy(keyAbsent = true) }
            val writes = prepareBatch(s, postId) ?: return@launch
            // THE COUNT THE SIGNING PREPARED IS THE ONE THE FOOT READ, or
            // nothing is signed: the held press drops (EditCompose.md).
            if (writes.size != s.signedActionCount) return@launch end { it.copy(countChanged = true) }
            sign(writes)
        }
    }

    /** The press is held: errors clear, and past 5s the slow line stands. */
    private fun beginSigning() {
        _state.update {
            it.copy(
                submitting = true,
                slow = false,
                countChanged = false,
                refusal = null,
                signingFailed = false,
                transportFailed = false,
                tagSection = it.tagSection.withoutErrors(),
                referenceSection = it.referenceSection.withoutErrors(),
            )
        }
        slowTimer?.cancel()
        slowTimer = viewModelScope.launch {
            delay(SLOW_SIGNING_MS)
            _state.update { it.copy(slow = it.submitting) }
        }
    }

    /**
     * Prepares EVERY act before signing any: a refusal on the third tag must
     * not leave the first two signed, and staged writes nobody signs are the
     * server's own GC to collect. Null once a prepare refused or failed —
     * already reported.
     */
    private suspend fun prepareBatch(s: PostEditUiState, postId: String): List<PreparedWriteView>? {
        val writes = mutableListOf<PreparedWriteView>()
        val record = if (s.recordStaged) prepareRecord(s, postId) ?: return null else emptyList()
        writes += record
        for (row in s.tagSection.adds) {
            val staged = staged(topics.prepareTag(postId, row.name, row.relevance, row.confidence)) {
                refuseTag(row.name, it)
            } ?: return null
            writes += staged
        }
        for (row in s.tagSection.removes) {
            val staged = staged(topics.prepareTag(postId, row.name, WITHDRAWN, row.confidence)) {
                refuseTag(row.name, it)
            } ?: return null
            writes += staged
        }
        for (row in s.referenceSection.adds) {
            val staged = staged(references.prepareReference(postId, row.targetId, row.relevance, row.support)) {
                refuseReference(row.targetId, it)
            } ?: return null
            writes += staged
        }
        for (row in s.referenceSection.removes) {
            val staged = staged(references.prepareReferenceWithdrawal(postId, row.targetId)) {
                refuseReference(row.targetId, it)
            } ?: return null
            writes += staged
        }
        return writes
    }

    /** The edit record: the post's complete new content state. */
    private suspend fun prepareRecord(s: PostEditUiState, postId: String): List<PreparedWriteView>? {
        val outcome = content.preparePostEdit(
            id = postId,
            title = s.title.ifBlank { null },
            // The words path carries no description (K8.1/D4).
            description = s.description.ifBlank { null }.takeIf { s.mediaBody },
            // Words XOR media: a media post sends no words at all.
            content = s.body.takeIf { !s.mediaBody },
            // The whole gallery the edit leaves standing, in its order, each
            // placement re-stating the cover it names.
            attachments = s.attachments.map { AttachmentClaim(it.id, it.altText, it.cover?.id, it.coverTaken) },
            sensitive = s.sensitive,
            sensitiveReason = s.sensitiveReason,
        )
        return when (outcome) {
            is Outcome.Success -> outcome.value.writes
            is Outcome.Refused -> null.also { refuse(outcome.errors) }
            is Outcome.Failed -> null.also { failTransport() }
        }
    }

    /** One standalone act's prepare: its writes, or null once its refusal or fault is reported. */
    private fun staged(
        outcome: Outcome<List<PreparedWriteView>>,
        onRefused: (List<UserError>) -> Unit,
    ): List<PreparedWriteView>? = when (outcome) {
        is Outcome.Success -> outcome.value
        is Outcome.Refused -> null.also { onRefused(outcome.errors) }
        is Outcome.Failed -> null.also { failTransport() }
    }

    private suspend fun sign(writes: List<PreparedWriteView>) {
        val results = try {
            signer.sign(writes)
        } catch (_: NoActorKeyException) {
            return end { it.copy(keyAbsent = true) }
        }
        if (results.all { it is WriteResult.Done }) {
            end { it.copy(saved = true) }
        } else {
            end { it.copy(signingFailed = true) }
        }
    }

    /** The signing answered: the press is released and the slow line goes. */
    private fun end(block: (PostEditUiState) -> PostEditUiState) {
        slowTimer?.cancel()
        _state.update { block(it.copy(submitting = false, slow = false)) }
    }

    /**
     * A refusal from the edit record: the write rule's takes the commit's
     * place; anything else says its piece once (F2).
     */
    private fun refuse(errors: List<UserError>) = end { st ->
        if (errors.any { it.code == ErrorCode.WRITE_RULE_FAILED }) {
            st.copy(writeRuleRefused = true)
        } else {
            st.copy(refusal = errors.firstOrNull()?.message)
        }
    }

    /** A standalone Tag's refusal lands on its chip; a withdrawal's, on its own. */
    private fun refuseTag(name: String, errors: List<UserError>) = end { st ->
        if (errors.any { it.code == ErrorCode.WRITE_RULE_FAILED }) return@end st.copy(writeRuleRefused = true)
        val (section, unplaced) = st.tagSection.withError(name, errors.firstOrNull()?.message)
        st.copy(tagSection = section, refusal = unplaced)
    }

    /** A standalone Reference's refusal lands on its chip; a withdrawal's, on its own. */
    private fun refuseReference(targetId: String, errors: List<UserError>) = end { st ->
        if (errors.any { it.code == ErrorCode.WRITE_RULE_FAILED }) return@end st.copy(writeRuleRefused = true)
        val (section, unplaced) = st.referenceSection.withError(targetId, errors.firstOrNull()?.message)
        st.copy(referenceSection = section, refusal = unplaced)
    }

    private fun failTransport() = end { it.copy(transportFailed = true) }

    companion object {
        /** A tag withdrawal is a Tag act at relevance 0 (hashtag.md §4). */
        const val WITHDRAWN = 0.0

        /** How long a signing may go unanswered before the foot says the network is slow. */
        const val SLOW_SIGNING_MS = 5_000L
    }
}
