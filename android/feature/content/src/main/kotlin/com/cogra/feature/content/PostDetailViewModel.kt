package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * One comment's reply thread as expanded past the prefetched first
 * page — keyed by comment id; absent means the prefetch is all that
 * shows.
 */
data class ReplyThread(
    val items: List<CommentView>,
    val endCursor: String?,
    val hasMore: Boolean,
    val loading: Boolean = false,
    val failed: Boolean = false,
)

/**
 * Which of the detail view's three authoring surfaces a tag gesture
 * belongs to (F9, F10). One set of callbacks serves all three — the
 * sections differ only in which submit they ride.
 */
enum class TagTarget { COMMENT, REPLY, EDIT }

data class PostDetailUiState(
    val loading: Boolean = true,
    val post: PostView? = null,
    val comments: List<CommentView> = emptyList(),
    val commentsEndCursor: String? = null,
    val commentsHaveMore: Boolean = false,
    val loadingMore: Boolean = false,
    /** The landed-only opt-out; true is the API's own default. */
    val includePending: Boolean = true,
    val notFound: Boolean = false,
    val transportFault: TransportFault? = null,
    /** The comment box. */
    val draft: String = "",
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    val submitting: Boolean = false,
    val refused: Boolean = false,
    val signingFailed: Boolean = false,
    /** The device held no key when signing failed — restore, don't wait. */
    val signingNeedsKey: Boolean = false,
    /** A submit that never reached the server; a composer error, not a read fault. */
    val submitTransportFailed: Boolean = false,
    /** One-shot: the comment signed; shown once, then consumed. */
    val commentSigned: Boolean = false,
    /** Reply threads expanded past their prefetched page. */
    val replyThreads: Map<String, ReplyThread> = emptyMap(),
    /** The comment being edited inline; null when none. */
    val editingCommentId: String? = null,
    val editDraft: String = "",
    val editSubmitting: Boolean = false,
    val editRefused: Boolean = false,
    val editSigningFailed: Boolean = false,
    /** The comment being replied to inline; null when none. */
    val replyingToId: String? = null,
    val replyDraft: String = "",
    val replySubmitting: Boolean = false,
    val replyRefused: Boolean = false,
    val replySigningFailed: Boolean = false,
    val replyTransportFailed: Boolean = false,
    /**
     * Which chip rows have been asked to show their claim parameters
     * (F8), keyed by the post or comment the row belongs to. Anyone may
     * see how strongly a tag is claimed — but only when they ask, so
     * the set starts empty on every visit.
     */
    val revealedTagRows: Set<String> = emptySet(),
    /**
     * Which reference rows have been asked to show their parameters,
     * keyed the same way [revealedTagRows] is. A citation's two
     * parameters are its own question, so the two rows reveal apart.
     */
    val revealedReferenceRows: Set<String> = emptySet(),
    /** The topics the comment box will declare (F9). */
    val commentTags: TagSectionState = TagSectionState(),
    /** The topics the reply box will declare (F9). */
    val replyTags: TagSectionState = TagSectionState(),
    /** The edited comment's topics, loaded at their real values (F10). */
    val editTags: TagSectionState = TagSectionState(),
    /** The references the comment box will declare (D10). */
    val commentReferences: ReferenceSectionState = ReferenceSectionState(),
    /** The references the reply box will declare. */
    val replyReferences: ReferenceSectionState = ReferenceSectionState(),
    /** The edited comment's references, loaded at their real values. */
    val editReferences: ReferenceSectionState = ReferenceSectionState(),
    /** What the edit opened with — text unchanged stages no edit record (F10). */
    val editLoadedText: String = "",
    /** Which submit the multi-action confirm is holding; null when none (F4). */
    val confirmPending: TagTarget? = null,
    /** The device preference behind that confirm. */
    val confirmMultiActionSubmits: Boolean = true,
) {
    /**
     * A comment's tags ride the minting write's own input, so the server
     * stages one Tag record per declared topic beside the Review — each
     * its own priced act (F4).
     */
    val commentSignedActions: Int
        get() = 1 + commentTags.tags.size + commentReferences.references.size

    val replySignedActions: Int
        get() = 1 + replyTags.tags.size + replyReferences.references.size

    /** An edit with unchanged text stages no edit record (F10). */
    val editContentChanged: Boolean get() = editDraft != editLoadedText

    /**
     * The edit's changes are standalone Tag and Reference acts beside
     * an optional edit record. Exact before anything is staged: a
     * withdrawal's batch is the count the claim served (B4).
     */
    val editSignedActions: Int
        get() = (if (editContentChanged) 1 else 0) +
            editTags.changeCount +
            editReferences.changeCount

    /**
     * What the edit's reference withdrawals cost, or null when it
     * withdraws nothing — the confirm names it beside the total so a
     * multi-record removal explains itself (B4).
     */
    val editWithdrawalCost: Int? get() = editReferences.withdrawalActs.takeIf { it > 0 }

    fun tagSection(target: TagTarget): TagSectionState = when (target) {
        TagTarget.COMMENT -> commentTags
        TagTarget.REPLY -> replyTags
        TagTarget.EDIT -> editTags
    }

    fun signedActions(target: TagTarget): Int = when (target) {
        TagTarget.COMMENT -> commentSignedActions
        TagTarget.REPLY -> replySignedActions
        TagTarget.EDIT -> editSignedActions
    }

    fun referenceSection(target: TagTarget): ReferenceSectionState = when (target) {
        TagTarget.COMMENT -> commentReferences
        TagTarget.REPLY -> replyReferences
        TagTarget.EDIT -> editReferences
    }

    fun withReferenceSection(
        target: TagTarget,
        section: ReferenceSectionState,
    ): PostDetailUiState = when (target) {
        TagTarget.COMMENT -> copy(commentReferences = section)
        TagTarget.REPLY -> copy(replyReferences = section)
        TagTarget.EDIT -> copy(editReferences = section)
    }

    fun withTagSection(target: TagTarget, section: TagSectionState): PostDetailUiState = when (target) {
        TagTarget.COMMENT -> copy(commentTags = section)
        TagTarget.REPLY -> copy(replyTags = section)
        TagTarget.EDIT -> copy(editTags = section)
    }
}

/**
 * One post and its direct thread (comment.md §2), with the comment box
 * — a genesis Review signed on this device. A freshly signed comment is
 * its author's content from the moment they sign it and reads for
 * everyone, marked as not yet final (substrate.md §6), so the thread
 * refetches once the signature is in: the refetched page carries the
 * new state, which is the only way a client takes it on — never by
 * merging the new entry into the page it already holds (api-spec.md
 * "A page is a snapshot, not a live view").
 */
@HiltViewModel
class PostDetailViewModel @Inject constructor(
    private val content: ContentRepository,
    private val topics: TopicRepository,
    private val references: ReferenceRepository,
    private val signer: WriteSigner,
    private val landings: LandingSignal,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(PostDetailUiState())
    val state = _state.asStateFlow()

    /** Debounces the finder, which runs on every keystroke (D20). */
    private var finderJob: Job? = null

    private var postId: String? = null

    init {
        viewModelScope.launch {
            identity.confirmMultiActionSubmits.collect { on ->
                _state.update { it.copy(confirmMultiActionSubmits = on) }
            }
        }
    }

    fun start(id: String) {
        if (postId == id) return
        postId = id
        refresh()
    }

    // As in FeedViewModel: the fault reflects the last COMPLETED
    // fetch — so a failed retry never flashes the error surface —
    // and carries which fetch failed, so it surfaces where that
    // fetch was requested.
    /**
     * The landed-only opt-out. The cursor namespaces differ, so a
     * change restarts the walk rather than continuing the held one.
     */
    fun setIncludePending(include: Boolean) {
        if (_state.value.includePending == include) return
        _state.update { it.copy(includePending = include) }
        refresh()
    }

    fun refresh() {
        val id = postId ?: return
        _state.update { it.copy(loading = true) }
        val includePending = _state.value.includePending
        viewModelScope.launch {
            when (
                val outcome =
                    content.post(id, FEED_PAGE_SIZE, commentsAfter = null, includePending = includePending)
            ) {
                is Outcome.Success -> {
                    val detail = outcome.value
                    if (detail == null) {
                        _state.update {
                            it.copy(loading = false, notFound = true, transportFault = null)
                        }
                    } else {
                        // This read is the device's freshest word on
                        // where the post stands; the feed card the
                        // reader came from is still holding the state
                        // its own page carried.
                        landings.observed(detail.post.id, detail.post.landing, includePending)
                        _state.update {
                            it.copy(
                                loading = false,
                                transportFault = null,
                                post = detail.post,
                                comments = detail.comments.items,
                                commentsEndCursor = detail.comments.endCursor,
                                commentsHaveMore = detail.comments.hasNextPage,
                                replyThreads = emptyMap(),
                            )
                        }
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, notFound = true) }
                is Outcome.Failed -> _state.update {
                    it.copy(loading = false, transportFault = TransportFault.REFRESH)
                }
            }
        }
    }

    fun loadMoreComments() {
        val id = postId ?: return
        val s = _state.value
        if (s.loadingMore || !s.commentsHaveMore) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch {
            when (
                val outcome =
                    content.comments(id, FEED_PAGE_SIZE, s.commentsEndCursor, s.includePending)
            ) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        loadingMore = false,
                        transportFault = null,
                        comments = it.comments.appendPage(outcome.value.items) { c -> c.id },
                        commentsEndCursor = outcome.value.endCursor,
                        commentsHaveMore = outcome.value.hasNextPage,
                    )
                }
                else -> _state.update {
                    it.copy(loadingMore = false, transportFault = TransportFault.APPEND)
                }
            }
        }
    }

    /** A further page of one comment's replies (the expand affordance). */
    fun onLoadMoreReplies(comment: CommentView) {
        val s = _state.value
        val seeded = s.replyThreads[comment.id] ?: ReplyThread(
            items = comment.replies?.items.orEmpty(),
            endCursor = comment.replies?.endCursor,
            hasMore = comment.replies?.hasNextPage ?: false,
        )
        if (seeded.loading) return
        _state.update {
            it.copy(replyThreads = it.replyThreads + (comment.id to seeded.copy(loading = true, failed = false)))
        }
        viewModelScope.launch {
            when (
                val outcome = content.commentReplies(
                    comment.id,
                    FEED_PAGE_SIZE,
                    seeded.endCursor,
                    s.includePending,
                )
            ) {
                is Outcome.Success -> _state.update {
                    val thread = ReplyThread(
                        items = seeded.items.appendPage(outcome.value.items) { c -> c.id },
                        endCursor = outcome.value.endCursor,
                        hasMore = outcome.value.hasNextPage,
                    )
                    it.copy(replyThreads = it.replyThreads + (comment.id to thread))
                }
                else -> _state.update {
                    it.copy(
                        replyThreads = it.replyThreads +
                            (comment.id to seeded.copy(loading = false, failed = true)),
                    )
                }
            }
        }
    }

    // The inline comment edit — creator-only upstream; the affordance
    // only renders on the viewer's own comments (comment.md §4).
    fun onStartEditComment(comment: CommentView) = _state.update {
        val loaded = comment.content.value.orEmpty()
        // The editor opens on what the comment actually carries — real
        // stored parameters, not the defaults a fresh chip would take
        // (F10), so leaving a tag alone re-declares nothing.
        val tags = comment.topics.map { claim ->
            TagRow(
                name = claim.hashtag.name.value.orEmpty(),
                relevance = claim.relevance,
                confidence = claim.confidence,
            )
        }
        // A citation this instance could not type is unaddressable — no
        // write could name it — so it stays out of the editable section
        // entirely and its absence is never read as a removal.
        val refs = comment.references.mapNotNull { it.editableRow() }
        it.copy(
            editingCommentId = comment.id,
            editDraft = loaded,
            editLoadedText = loaded,
            editTags = TagSectionState(tags = tags, loaded = tags),
            editReferences = ReferenceSectionState(references = refs, loaded = refs),
            editRefused = false,
            editSigningFailed = false,
            replyingToId = null,
        )
    }

    fun onEditDraftChange(v: String) = _state.update { it.copy(editDraft = v) }

    fun onCancelEditComment() = _state.update {
        it.copy(
            editingCommentId = null,
            editDraft = "",
            editLoadedText = "",
            editTags = TagSectionState(),
            editReferences = ReferenceSectionState(),
        )
    }

    fun onSubmitCommentEdit() {
        val s = _state.value
        if (s.editingCommentId == null || s.editSubmitting || s.editDraft.isBlank()) return
        // An edit opened and left alone stages no record at all.
        if (s.editSignedActions == 0) return
        if (gateOnConfirm(TagTarget.EDIT, s)) return
        stageCommentEdit()
    }

    /**
     * Every record this edit carries, staged before anything is signed
     * (F10): the edit record only when the text moved, then one Tag act
     * per change — an add or a re-tune at its parameters, a removal at
     * relevance 0. A refusal from any prepare stops before signing, so
     * nothing may claim signing failed (F2).
     */
    private fun stageCommentEdit() {
        val s = _state.value
        val id = s.editingCommentId ?: return
        _state.update {
            it.copy(
                editSubmitting = true,
                editRefused = false,
                editSigningFailed = false,
                signingNeedsKey = false,
                editTags = it.editTags.withoutErrors(),
                editReferences = it.editReferences.withoutErrors(),
            )
        }
        viewModelScope.launch {
            val writes = mutableListOf<PreparedWriteView>()
            if (s.editContentChanged) {
                when (val outcome = content.prepareCommentEdit(id, s.editDraft)) {
                    is Outcome.Success -> writes += outcome.value.writes
                    // The edit prepare has no per-chip field to name, so
                    // a refusal and a transport fault both land on the
                    // editor's own line, as they did before tags.
                    is Outcome.Refused -> return@launch failEdit()
                    is Outcome.Failed -> return@launch failEdit()
                }
            }
            for (row in s.editTags.adds) {
                when (val outcome = topics.prepareTag(id, row.name, row.relevance, row.confidence)) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuseEditTag(row.name, outcome.errors)
                    is Outcome.Failed -> return@launch failEdit()
                }
            }
            for (name in s.editTags.removes) {
                when (val outcome = topics.prepareTag(id, name, pDirected = WITHDRAWN)) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuseEditTag(name, outcome.errors)
                    is Outcome.Failed -> return@launch failEdit()
                }
            }
            // Citations are never edit fields, so each change is its own
            // priced act staged beside the edit (post.md §3).
            for (row in s.editReferences.adds) {
                when (val outcome =
                    references.prepareReference(id, row.targetId, row.relevance, row.support)) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuseEditReference(row.targetId, outcome.errors)
                    is Outcome.Failed -> return@launch failEdit()
                }
            }
            for (row in s.editReferences.removes) {
                when (val outcome = references.prepareReferenceWithdrawal(id, row.targetId)) {
                    is Outcome.Success -> writes += outcome.value
                    is Outcome.Refused -> return@launch refuseEditReference(row.targetId, outcome.errors)
                    is Outcome.Failed -> return@launch failEdit()
                }
            }
            signCommentEdit(writes)
        }
    }

    /** Signs a staged edit batch, whether it was quoted first or not. */
    private suspend fun signCommentEdit(writes: List<PreparedWriteView>) {
        _state.update { it.copy(editSubmitting = true) }
        val results = try {
            signer.sign(writes)
        } catch (_: NoActorKeyException) {
            // A husk device: the write waits on the reader restoring
            // the key, not on time passing (the invites twin) —
            // without the catch the coroutine would die unreported.
            _state.update {
                it.copy(editSubmitting = false, editSigningFailed = true, signingNeedsKey = true)
            }
            return
        }
        if (results.all { it is WriteResult.Done }) {
            _state.update {
                it.copy(
                    editSubmitting = false,
                    editingCommentId = null,
                    editDraft = "",
                    editLoadedText = "",
                    editTags = TagSectionState(),
                    editReferences = ReferenceSectionState(),
                    commentSigned = true,
                )
            }
            refresh()
        } else {
            _state.update { it.copy(editSubmitting = false, editSigningFailed = true) }
        }
    }

    private fun failEdit() = _state.update { it.copy(editSubmitting = false, editRefused = true) }

    /** A standalone Tag's refusal names one chip; a withdrawal has none left. */
    private fun refuseEditTag(name: String, errors: List<UserError>) = _state.update { st ->
        val (section, unplaced) = st.editTags.withError(name, errors.firstOrNull()?.message)
        st.copy(editSubmitting = false, editTags = section, editRefused = unplaced != null)
    }

    /** The same shape for a citation: its chip, or the editor's own line. */
    private fun refuseEditReference(targetId: String, errors: List<UserError>) = _state.update { st ->
        val (section, unplaced) =
            st.editReferences.withError(targetId, errors.firstOrNull()?.message)
        st.copy(editSubmitting = false, editReferences = section, editRefused = unplaced != null)
    }

    // The inline reply — a genesis Review targeting the comment
    // (comment.md §1); it shares the composer's license controls.
    fun onStartReply(commentId: String) = _state.update {
        it.copy(
            replyingToId = commentId,
            replyDraft = "",
            replyTags = TagSectionState(),
            replyReferences = ReferenceSectionState(),
            replyRefused = false,
            replySigningFailed = false,
            replyTransportFailed = false,
            editingCommentId = null,
        )
    }

    fun onReplyDraftChange(v: String) = _state.update { it.copy(replyDraft = v) }

    fun onCancelReply() = _state.update {
        it.copy(
            replyingToId = null,
            replyDraft = "",
            replyTags = TagSectionState(),
            replyReferences = ReferenceSectionState(),
        )
    }

    fun onSubmitReply() {
        val s = _state.value
        if (s.replyingToId == null || s.replySubmitting || s.replyDraft.isBlank()) return
        if (gateOnConfirm(TagTarget.REPLY, s)) return
        stageReply()
    }

    private fun stageReply() {
        val s = _state.value
        val target = s.replyingToId ?: return
        _state.update {
            it.copy(
                replySubmitting = true,
                replyRefused = false,
                replySigningFailed = false,
                signingNeedsKey = false,
                replyTransportFailed = false,
                replyTags = it.replyTags.withoutErrors(),
                replyReferences = it.replyReferences.withoutErrors(),
            )
        }
        viewModelScope.launch {
            val prepared = when (
                val outcome = content.prepareComment(
                    target = target,
                    content = s.replyDraft,
                    license = s.license,
                    tags = s.replyTags.tags.map { it.toClaim() },
                    references = s.replyReferences.references.map { it.toClaim() },
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    refuseCreation(TagTarget.REPLY, outcome.errors)
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(replySubmitting = false, replyTransportFailed = true) }
                    return@launch
                }
            }
            // The whole batch — the minting Review and every Tag record
            // beside it — goes through the one signing pass (F9).
            val results = try {
                signer.sign(prepared.writes)
            } catch (_: NoActorKeyException) {
                _state.update {
                    it.copy(replySubmitting = false, replySigningFailed = true, signingNeedsKey = true)
                }
                return@launch
            }
            if (results.all { it is WriteResult.Done }) {
                _state.update {
                    it.copy(
                        replySubmitting = false,
                        replyingToId = null,
                        replyDraft = "",
                        replyTags = TagSectionState(),
                        replyReferences = ReferenceSectionState(),
                        commentSigned = true,
                    )
                }
                refresh()
            } else {
                _state.update { it.copy(replySubmitting = false, replySigningFailed = true) }
            }
        }
    }

    /** The reveal is per row and per reading (F8) — one row saying yes says nothing about the next. */
    fun onToggleTagValues(ownerId: String) = _state.update {
        it.copy(
            revealedTagRows = if (ownerId in it.revealedTagRows) {
                it.revealedTagRows - ownerId
            } else {
                it.revealedTagRows + ownerId
            },
        )
    }

    fun onDraftChange(v: String) = _state.update { it.copy(draft = v) }
    fun onLicenseChange(v: LicenseChoice) = _state.update { it.copy(license = v) }
    fun onCommentSignedShown() = _state.update { it.copy(commentSigned = false) }

    fun onSubmitComment() {
        val s = _state.value
        if (postId == null || s.submitting || s.draft.isBlank()) return
        if (gateOnConfirm(TagTarget.COMMENT, s)) return
        stageComment()
    }

    private fun stageComment() {
        val id = postId ?: return
        val s = _state.value
        _state.update {
            it.copy(
                submitting = true,
                refused = false,
                signingFailed = false,
                signingNeedsKey = false,
                submitTransportFailed = false,
                commentTags = it.commentTags.withoutErrors(),
                commentReferences = it.commentReferences.withoutErrors(),
            )
        }
        viewModelScope.launch {
            val prepared = when (
                val outcome = content.prepareComment(
                    target = id,
                    content = s.draft,
                    license = s.license,
                    tags = s.commentTags.tags.map { it.toClaim() },
                    references = s.commentReferences.references.map { it.toClaim() },
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    refuseCreation(TagTarget.COMMENT, outcome.errors)
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(submitting = false, submitTransportFailed = true) }
                    return@launch
                }
            }
            val results = try {
                signer.sign(prepared.writes)
            } catch (_: NoActorKeyException) {
                _state.update {
                    it.copy(submitting = false, signingFailed = true, signingNeedsKey = true)
                }
                return@launch
            }
            if (results.all { it is WriteResult.Done }) {
                _state.update {
                    it.copy(
                        submitting = false,
                        draft = "",
                        commentTags = TagSectionState(),
                        commentReferences = ReferenceSectionState(),
                        commentSigned = true,
                    )
                }
                refresh()
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }

    // -- The tag sections, and the gate every submit passes (F4, F9, F10) --

    fun onTagInputChange(target: TagTarget, v: String) = updateTags(target) { it.withInput(v) }

    fun onAddTag(target: TagTarget) = updateTags(target) { it.added() }

    fun onRemoveTag(target: TagTarget, name: String) = updateTags(target) { it.removed(name) }

    fun onTuneTag(target: TagTarget, name: String) = updateTags(target) { it.tuned(name) }

    fun onDoneTuningTag(target: TagTarget) = updateTags(target) { it.tuned(null) }

    fun onTagRelevanceChange(target: TagTarget, name: String, value: Double) =
        updateTags(target) { it.withRelevance(name, value) }

    fun onTagConfidenceChange(target: TagTarget, name: String, value: Double) =
        updateTags(target) { it.withConfidence(name, value) }

    private fun updateTags(target: TagTarget, block: (TagSectionState) -> TagSectionState) =
        _state.update { it.withTagSection(target, block(it.tagSection(target))) }

    // -- The reference sections and their finder (D10, D20) --

    fun onOpenFinder(target: TagTarget) =
        updateReferences(target) { it.withFinder(ReferenceFinderState()) }

    fun onCloseFinder(target: TagTarget) {
        finderJob?.cancel()
        updateReferences(target) { it.withFinder(null) }
    }

    fun onFinderQueryChange(target: TagTarget, query: String) {
        finderJob?.cancel()
        updateReferences(target) { section ->
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
                is Outcome.Success -> updateReferences(target) { section ->
                    // A result that arrived after the author typed on
                    // is stale — only the current query's answer lands.
                    section.finder?.takeIf { it.query == query }?.let {
                        section.withFinder(
                            it.copy(candidates = outcome.value, searching = false, failed = false),
                        )
                    } ?: section
                }
                is Outcome.Refused, is Outcome.Failed -> updateReferences(target) { section ->
                    section.finder?.takeIf { it.query == query }?.let {
                        section.withFinder(it.copy(searching = false, failed = true))
                    } ?: section
                }
            }
        }
    }

    fun onPickReference(target: TagTarget, row: ReferenceCandidateRow) {
        finderJob?.cancel()
        updateReferences(target) { it.added(row.targetId, row.target).withFinder(null) }
    }

    fun onRemoveReference(target: TagTarget, targetId: String) =
        updateReferences(target) { it.removed(targetId) }

    fun onTuneReference(target: TagTarget, targetId: String) =
        updateReferences(target) { it.tuned(targetId) }

    fun onDoneTuningReference(target: TagTarget) = updateReferences(target) { it.tuned(null) }

    fun onReferenceRelevanceChange(target: TagTarget, targetId: String, value: Double) =
        updateReferences(target) { it.withRelevance(targetId, value) }

    fun onReferenceSupportChange(target: TagTarget, targetId: String, value: Double) =
        updateReferences(target) { it.withSupport(targetId, value) }

    private fun updateReferences(
        target: TagTarget,
        block: (ReferenceSectionState) -> ReferenceSectionState,
    ) = _state.update { it.withReferenceSection(target, block(it.referenceSection(target))) }

    /** The reference row's reveal, which toggles apart from the tag row's. */
    fun onToggleReferenceValues(ownerId: String) = _state.update {
        it.copy(
            revealedReferenceRows = if (ownerId in it.revealedReferenceRows) {
                it.revealedReferenceRows - ownerId
            } else {
                it.revealedReferenceRows + ownerId
            },
        )
    }

    /**
     * A batch of more than one signed act asks first, unless this device
     * has been told not to (F4). True when the confirm now holds the
     * submit, so the caller stops.
     */
    private fun gateOnConfirm(target: TagTarget, s: PostDetailUiState): Boolean {
        if (s.confirmPending != null) return true
        if (!s.confirmMultiActionSubmits || s.signedActions(target) <= 1) return false
        _state.update { it.copy(confirmPending = target) }
        return true
    }

    fun onConfirmSubmit(dontAskAgain: Boolean) {
        val target = _state.value.confirmPending ?: return
        if (dontAskAgain) viewModelScope.launch { identity.setConfirmMultiActionSubmits(false) }
        _state.update { it.copy(confirmPending = null) }
        when (target) {
            TagTarget.COMMENT -> stageComment()
            TagTarget.REPLY -> stageReply()
            TagTarget.EDIT -> stageCommentEdit()
        }
    }

    fun onDismissConfirm() {
        _state.update { it.copy(confirmPending = null, editSubmitting = false) }
    }

    /**
     * A refusal from a creation whose input carries the whole batch: the
     * server names the offender by path, so `["tags", i, …]` lands on
     * chip i and anything unplaced falls back to the box's own line (F2).
     */
    private fun refuseCreation(target: TagTarget, errors: List<UserError>) = _state.update { st ->
        var section = st.tagSection(target)
        var refs = st.referenceSection(target)
        var unplaced = false
        for (error in errors) {
            val tagIndex = tagFieldIndex(error.field)
            val referenceIndex = referenceFieldIndex(error.field)
            when {
                tagIndex != null -> {
                    val (next, left) = section.withErrorAt(tagIndex, error.message)
                    section = next
                    if (left != null) unplaced = true
                }
                referenceIndex != null -> {
                    val (next, left) = refs.withErrorAt(referenceIndex, error.message)
                    refs = next
                    if (left != null) unplaced = true
                }
                // A whole-batch refusal names no field — the balance
                // could not carry every act, so nothing was staged
                // (D19). It says its piece once, not per chip.
                else -> unplaced = true
            }
        }
        // Errors that named nothing at all still have to say something.
        if (errors.isEmpty()) unplaced = true
        val withSection = st.withTagSection(target, section).withReferenceSection(target, refs)
        when (target) {
            TagTarget.COMMENT -> withSection.copy(submitting = false, refused = unplaced)
            TagTarget.REPLY -> withSection.copy(replySubmitting = false, replyRefused = unplaced)
            TagTarget.EDIT -> withSection.copy(editSubmitting = false, editRefused = unplaced)
        }
    }

    private companion object {
        /** A tag withdrawal is a Tag act at relevance 0 (hashtag.md §4). */
        const val WITHDRAWN = 0.0
    }
}
