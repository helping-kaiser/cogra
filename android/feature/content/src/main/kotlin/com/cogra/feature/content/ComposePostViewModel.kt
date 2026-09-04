package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.valueOrNull
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ComposePostUiState(
    /** Null for a new post; the edited post's id otherwise. */
    val editingId: String? = null,
    val loading: Boolean = false,
    val title: String = "",
    val description: String = "",
    val body: String = "",
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    /**
     * The topics this post will carry once the submit lands: staged
     * chips when creating, the post's current tags plus the author's
     * changes when editing (F3).
     */
    val tagSection: TagSectionState = TagSectionState(),
    /**
     * The references this post will carry once the submit lands:
     * staged chips when creating, the post's current citations plus the
     * author's changes when editing (D10, D11).
     */
    val referenceSection: ReferenceSectionState = ReferenceSectionState(),
    val loadedTitle: String = "",
    val loadedDescription: String = "",
    val loadedBody: String = "",
    /**
     * The author's own sensitive mark this edit leaves standing, read
     * when the form opened.
     *
     * An edit record carries the complete content state, so a mark the
     * record does not re-state is a mark the record removes — carrying
     * it through is what keeps editing a marked post from quietly
     * unmarking it. The edit surface has no switch yet; until it does,
     * the only correct value is the one the post already had.
     */
    val sensitive: Boolean = false,
    val sensitiveReason: String? = null,
    val submitting: Boolean = false,
    val emptyBody: Boolean = false,
    /** A refusal that named no chip of its own, in the server's words (F2). */
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    /** The device held no key when signing failed — restore, don't wait. */
    val signingNeedsKey: Boolean = false,
    val transportFailed: Boolean = false,
    val notFound: Boolean = false,
    /** One-shot: the write signed; the caller leaves the composer. */
    val saved: Boolean = false,
    /** The multi-action confirm is open, holding this submit (F4). */
    val confirmPending: Boolean = false,
    /** The device preference behind that confirm. */
    val confirmMultiActionSubmits: Boolean = true,
) {
    val creating: Boolean get() = editingId == null

    /** Whether the edit record has anything to carry (F4's count depends on it). */
    val contentChanged: Boolean
        get() = creating ||
            title != loadedTitle ||
            description != loadedDescription ||
            body != loadedBody

    /**
     * What this submit will stage, counted the way the batch is priced —
     * each record its own signed act (F4). Live, so the reader watches
     * it move as they type. A creation's tags ride the minting write's
     * own input, so the server stages one Tag record per declared topic
     * beside it; an edit stages each change as its own standalone act.
     */
    val signedActionCount: Int
        get() = if (creating) {
            1 + tagSection.tags.size + referenceSection.references.size
        } else {
            (if (contentChanged) 1 else 0) +
                tagSection.changeCount +
                referenceSection.changeCount
        }

    /** Nothing to sign: an edit opened and left alone stages no record. */
    val nothingToSign: Boolean get() = signedActionCount == 0

    /**
     * What the withdrawals in this submit cost, or null when it
     * withdraws nothing — the confirm names it beside the total so a
     * multi-record removal explains itself (B4).
     */
    val withdrawalCost: Int? get() = referenceSection.withdrawalActs.takeIf { it > 0 }
}

/**
 * The composer, in create and edit mode. Create is a genesis Publish;
 * edit is the ordinary-role Publish behind the chain head, prepared by
 * the backend and signed here (post.md §1, §4). License qualifiers are
 * declared at authoring and immutable — the edit form never shows them.
 *
 * Tags are never fields of either record (post.md §3): they are their
 * own Tag acts, staged beside the content write and signed with it in
 * one pass, so a submit is one signing flow however many records it
 * carries (F3).
 */
@HiltViewModel
class ComposePostViewModel @Inject constructor(
    private val content: ContentRepository,
    private val topics: TopicRepository,
    private val references: ReferenceRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(ComposePostUiState())
    val state = _state.asStateFlow()

    private val sections = SectionsEditor(
        scope = viewModelScope,
        references = references,
        state = _state,
        tagsOf = { it.tagSection },
        withTags = { state, tags -> state.copy(tagSection = tags) },
        referencesOf = { it.referenceSection },
        withReferences = { state, refs -> state.copy(referenceSection = refs) },
    )

    init {
        viewModelScope.launch {
            identity.confirmMultiActionSubmits.collect { on ->
                _state.update { it.copy(confirmMultiActionSubmits = on) }
            }
        }
    }

    /**
     * Route entry: null [postId] for create, a post id for edit
     * (pre-fills). [referenceTargetId] arrives from the Reference
     * affordance on a content node (D20) — the composer opens with
     * that node already staged as a chip.
     */
    fun start(postId: String?, referenceTargetId: String? = null) {
        prefillReference(referenceTargetId)
        if (postId == null || _state.value.editingId == postId) return
        _state.update { it.copy(editingId = postId, loading = true) }
        viewModelScope.launch {
            when (val outcome = content.post(postId, commentsFirst = 1, commentsAfter = null)) {
                is Outcome.Success -> {
                    val post = outcome.value?.post
                    if (post == null) {
                        _state.update { it.copy(loading = false, notFound = true) }
                    } else {
                        val tags = post.topics.map { claim ->
                            TagRow(
                                name = claim.hashtag.name.value.orEmpty(),
                                relevance = claim.relevance,
                                confidence = claim.confidence,
                            )
                        }
                        // A citation this instance could not type is
                        // unaddressable — no write could name it — so it
                        // stays out of the editable section entirely and
                        // its absence is never read as a removal.
                        val refs = post.references.mapNotNull { it.editableRow() }
                        // The mark is read before the form opens, never
                        // defaulted: an edit prepared without it unmarks
                        // the post, so a mark this read could not confirm
                        // is a mark no edit may be built on. A fault here
                        // therefore fails the load, exactly as the post
                        // read's own fault does.
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
                                loadedTitle = post.title.value.orEmpty(),
                                loadedDescription = post.description.value.orEmpty(),
                                loadedBody = post.content.value.orEmpty(),
                                sensitive = mark?.sensitive ?: false,
                                sensitiveReason = mark?.reason,
                                tagSection = TagSectionState(tags = tags, loaded = tags),
                                referenceSection = ReferenceSectionState(
                                    references = refs,
                                    loaded = refs,
                                ),
                            )
                        }
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, notFound = true) }
                is Outcome.Failed -> _state.update { it.copy(loading = false, transportFailed = true) }
            }
        }
    }

    /**
     * Stages the node the Reference affordance named. Its typed form
     * comes from the finder's own lookup — a UUID is one of the shapes
     * that query resolves — so the affordance needs no second endpoint
     * and the chip reads the same as a picked one. A target that will
     * not resolve is still staged: the citation names it by id, and the
     * chip says so rather than silently dropping the author's gesture.
     */
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

    fun onTitleChange(v: String) = _state.update { it.copy(title = v) }
    fun onDescriptionChange(v: String) = _state.update { it.copy(description = v) }
    fun onBodyChange(v: String) = _state.update { it.copy(body = v, emptyBody = false) }
    fun onLicenseChange(v: LicenseChoice) = _state.update { it.copy(license = v) }
    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    fun onTagInputChange(v: String) = sections.onTagInputChange(v)

    fun onAddTag() = sections.onAddTag()

    fun onRemoveTag(name: String) = sections.onRemoveTag(name)

    /** Tapping a staged chip opens its parameters (F6). */
    fun onTuneTag(name: String) = sections.onTuneTag(name)

    fun onDoneTuningTag() = sections.onDoneTuningTag()

    fun onTagRelevanceChange(name: String, value: Double) = sections.onTagRelevanceChange(name, value)

    fun onTagConfidenceChange(name: String, value: Double) = sections.onTagConfidenceChange(name, value)

    private fun updateTags(block: (TagSectionState) -> TagSectionState) = sections.updateTags(block)

    // -- References (D10, D20) --

    fun onOpenFinder() = sections.onOpenFinder()

    fun onCloseFinder() = sections.onCloseFinder()

    fun onFinderQueryChange(query: String) = sections.onFinderQueryChange(query)

    /** Picking a candidate stages it and closes the finder. */
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
     * The submit gate (F4): a batch of more than one signed act asks
     * first, unless this device has been told not to.
     *
     * Withdrawals ask first too. Their cost is a batch — a citation
     * revised upward several times needs several counter-records to
     * reach `(0, 0)` (D11) — but the claim serves that count off the
     * raw bundle sums (B4), so nothing has to be staged to learn it.
     */
    fun onSubmit() {
        val s = _state.value
        if (s.submitting || s.confirmPending) return
        if (s.creating && s.body.isBlank()) {
            _state.update { it.copy(emptyBody = true) }
            return
        }
        if (s.nothingToSign) return
        if (s.confirmMultiActionSubmits && s.signedActionCount > 1) {
            _state.update { it.copy(confirmPending = true) }
            return
        }
        stage()
    }

    fun onConfirmSubmit(dontAskAgain: Boolean) {
        if (dontAskAgain) viewModelScope.launch { identity.setConfirmMultiActionSubmits(false) }
        _state.update { it.copy(confirmPending = false) }
        stage()
    }

    fun onDismissConfirm() {
        _state.update { it.copy(confirmPending = false, submitting = false) }
    }

    /**
     * Stages every record this submit carries, then signs them together.
     * A refusal from any prepare stops before signing: nothing was
     * signed, so nothing may claim signing failed (F2).
     */
    private fun stage() {
        val s = _state.value
        _state.update {
            it.copy(
                submitting = true,
                refusal = null,
                signingFailed = false,
                signingNeedsKey = false,
                transportFailed = false,
                tagSection = it.tagSection.withoutErrors(),
                referenceSection = it.referenceSection.withoutErrors(),
            )
        }
        viewModelScope.launch {
            val writes = mutableListOf<PreparedWriteView>()
            val editingId = s.editingId
            if (editingId == null) {
                when (val outcome = content.preparePost(
                    title = s.title.ifBlank { null },
                    description = s.description.ifBlank { null },
                    content = s.body,
                    license = s.license,
                    tags = s.tagSection.tags.map { it.toClaim() },
                    references = s.referenceSection.references.map { it.toClaim() },
                )) {
                    is Outcome.Success -> writes += outcome.value.writes
                    is Outcome.Refused -> return@launch refuse(outcome.errors)
                    is Outcome.Failed -> return@launch failTransport()
                }
            } else {
                if (s.contentChanged) {
                    when (val outcome = content.preparePostEdit(
                        id = editingId,
                        title = s.title.ifBlank { null },
                        description = s.description.ifBlank { null },
                        content = s.body,
                        // Carried through unchanged: the record is the
                        // post's complete content state, so the mark the
                        // form read is the mark the edit has to re-state.
                        sensitive = s.sensitive,
                        sensitiveReason = s.sensitiveReason,
                    )) {
                        is Outcome.Success -> writes += outcome.value.writes
                        is Outcome.Refused -> return@launch refuse(outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
                for (row in s.tagSection.adds) {
                    when (val outcome = topics.prepareTag(editingId, row.name, row.relevance, row.confidence)) {
                        is Outcome.Success -> writes += outcome.value
                        is Outcome.Refused -> return@launch refuseTag(row.name, outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
                for (name in s.tagSection.removes) {
                    when (val outcome = topics.prepareTag(editingId, name, pDirected = WITHDRAWN)) {
                        is Outcome.Success -> writes += outcome.value
                        is Outcome.Refused -> return@launch refuseTag(name, outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
                // Citations are never edit fields, so each change is its
                // own priced act staged beside the edit (post.md §3).
                for (row in s.referenceSection.adds) {
                    when (val outcome =
                        references.prepareReference(editingId, row.targetId, row.relevance, row.support)) {
                        is Outcome.Success -> writes += outcome.value
                        is Outcome.Refused -> return@launch refuseReference(row.targetId, outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
                for (row in s.referenceSection.removes) {
                    when (val outcome =
                        references.prepareReferenceWithdrawal(editingId, row.targetId)) {
                        is Outcome.Success -> writes += outcome.value
                        is Outcome.Refused -> return@launch refuseReference(row.targetId, outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
            }
            sign(writes)
        }
    }

    /**
     * Signs a staged batch. A refusal from any prepare stops before
     * this: nothing was signed, so nothing may claim signing failed
     * (F2).
     */
    private suspend fun sign(writes: List<PreparedWriteView>) {
        _state.update { it.copy(submitting = true) }
        val results = try {
            signer.sign(writes)
        } catch (_: NoActorKeyException) {
            // A husk device: the write waits on the reader restoring
            // the key, not on time passing (the invites twin) —
            // without the catch the coroutine would die unreported.
            _state.update {
                it.copy(submitting = false, signingFailed = true, signingNeedsKey = true)
            }
            return
        }
        if (results.all { it is WriteResult.Done }) {
            _state.update { it.copy(submitting = false, saved = true) }
        } else {
            _state.update { it.copy(submitting = false, signingFailed = true) }
        }
    }

    /**
     * A refusal from a write whose input carries the whole batch: the
     * server names the offender by path, so `["tags", i, …]` lands on
     * chip i and everything else says its piece once (F2).
     */
    private fun refuse(errors: List<UserError>) = _state.update { st ->
        var tags = st.tagSection
        var refs = st.referenceSection
        val unplaced = mutableListOf<String>()
        for (error in errors) {
            val tagIndex = tagFieldIndex(error.field)
            val referenceIndex = referenceFieldIndex(error.field)
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
                // A whole-batch refusal names no field — the balance
                // could not carry every act, so nothing was staged
                // (D19). It says its piece once, not per chip.
                else -> unplaced += error.message
            }
        }
        st.copy(
            submitting = false,
            tagSection = tags,
            referenceSection = refs,
            refusal = unplaced.firstOrNull(),
        )
    }

    /**
     * A refusal from a standalone Tag: its input holds one name, so the
     * chip it was staged for is the offender — a removal has no chip
     * left to carry the message, so that one surfaces on its own.
     */
    private fun refuseTag(name: String, errors: List<UserError>) = _state.update { st ->
        val (section, unplaced) = st.tagSection.withError(name, errors.firstOrNull()?.message)
        st.copy(submitting = false, tagSection = section, refusal = unplaced)
    }

    /**
     * A refusal from a standalone Reference or its withdrawal: the
     * chip it was staged for is the offender — a withdrawal has no chip
     * left to carry the message, so that one surfaces on its own.
     */
    private fun refuseReference(targetId: String, errors: List<UserError>) = _state.update { st ->
        val (section, unplaced) =
            st.referenceSection.withError(targetId, errors.firstOrNull()?.message)
        st.copy(submitting = false, referenceSection = section, refusal = unplaced)
    }

    private fun failTransport() = _state.update { it.copy(submitting = false, transportFailed = true) }

    private companion object {
        /** A tag withdrawal is a Tag act at relevance 0 (hashtag.md §4). */
        const val WITHDRAWN = 0.0
    }
}
