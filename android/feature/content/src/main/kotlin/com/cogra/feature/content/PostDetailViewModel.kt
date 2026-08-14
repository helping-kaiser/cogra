package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.OversightChoice
import com.cogra.domain.PostView
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
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

data class PostDetailUiState(
    val loading: Boolean = true,
    val post: PostView? = null,
    val comments: List<CommentView> = emptyList(),
    val commentsEndCursor: String? = null,
    val commentsHaveMore: Boolean = false,
    val loadingMore: Boolean = false,
    val notFound: Boolean = false,
    val transportFault: TransportFault? = null,
    /** The comment box. */
    val draft: String = "",
    val attributionRequired: Boolean = false,
    val oversight: OversightChoice = OversightChoice.NONE,
    val submitting: Boolean = false,
    val refused: Boolean = false,
    val signingFailed: Boolean = false,
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
)

/**
 * One post and its direct thread (comment.md §2), with the comment box
 * — a genesis Review signed on this device. A freshly signed comment is
 * still in flight (confirmation is asynchronous), so the thread shows
 * it only once its record lands; the refresh after landing is a pull.
 */
@HiltViewModel
class PostDetailViewModel @Inject constructor(
    private val content: ContentRepository,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(PostDetailUiState())
    val state = _state.asStateFlow()

    private var postId: String? = null

    fun start(id: String) {
        if (postId == id) return
        postId = id
        refresh()
    }

    // As in FeedViewModel: the fault reflects the last COMPLETED
    // fetch — so a failed retry never flashes the error surface —
    // and carries which fetch failed, so it surfaces where that
    // fetch was requested.
    fun refresh() {
        val id = postId ?: return
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            when (val outcome = content.post(id, FEED_PAGE_SIZE, commentsAfter = null)) {
                is Outcome.Success -> {
                    val detail = outcome.value
                    if (detail == null) {
                        _state.update {
                            it.copy(loading = false, notFound = true, transportFault = null)
                        }
                    } else {
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
            when (val outcome = content.comments(id, FEED_PAGE_SIZE, s.commentsEndCursor)) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        loadingMore = false,
                        transportFault = null,
                        comments = it.comments + outcome.value.items,
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
            when (val outcome = content.commentReplies(comment.id, FEED_PAGE_SIZE, seeded.endCursor)) {
                is Outcome.Success -> _state.update {
                    val thread = ReplyThread(
                        items = seeded.items + outcome.value.items,
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
        it.copy(
            editingCommentId = comment.id,
            editDraft = comment.content.value.orEmpty(),
            editRefused = false,
            editSigningFailed = false,
            replyingToId = null,
        )
    }

    fun onEditDraftChange(v: String) = _state.update { it.copy(editDraft = v) }

    fun onCancelEditComment() = _state.update { it.copy(editingCommentId = null, editDraft = "") }

    fun onSubmitCommentEdit() {
        val s = _state.value
        val id = s.editingCommentId ?: return
        if (s.editSubmitting || s.editDraft.isBlank()) return
        _state.update { it.copy(editSubmitting = true, editRefused = false, editSigningFailed = false) }
        viewModelScope.launch {
            val prepared = when (val outcome = content.prepareCommentEdit(id, s.editDraft)) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    _state.update { it.copy(editSubmitting = false, editRefused = true) }
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(editSubmitting = false, editRefused = true) }
                    return@launch
                }
            }
            val results = signer.sign(prepared.writes)
            if (results.all { it is WriteResult.Done }) {
                _state.update {
                    it.copy(
                        editSubmitting = false,
                        editingCommentId = null,
                        editDraft = "",
                        commentSigned = true,
                    )
                }
            } else {
                _state.update { it.copy(editSubmitting = false, editSigningFailed = true) }
            }
        }
    }

    // The inline reply — a genesis Review targeting the comment
    // (comment.md §1); it shares the composer's license controls.
    fun onStartReply(commentId: String) = _state.update {
        it.copy(
            replyingToId = commentId,
            replyRefused = false,
            replySigningFailed = false,
            replyTransportFailed = false,
            editingCommentId = null,
        )
    }

    fun onReplyDraftChange(v: String) = _state.update { it.copy(replyDraft = v) }

    fun onCancelReply() = _state.update { it.copy(replyingToId = null, replyDraft = "") }

    fun onSubmitReply() {
        val s = _state.value
        val target = s.replyingToId ?: return
        if (s.replySubmitting || s.replyDraft.isBlank()) return
        _state.update {
            it.copy(replySubmitting = true, replyRefused = false, replySigningFailed = false, replyTransportFailed = false)
        }
        viewModelScope.launch {
            val prepared = when (
                val outcome = content.prepareComment(
                    target = target,
                    content = s.replyDraft,
                    license = LicenseChoice(s.attributionRequired, s.oversight),
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    _state.update { it.copy(replySubmitting = false, replyRefused = true) }
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(replySubmitting = false, replyTransportFailed = true) }
                    return@launch
                }
            }
            val results = signer.sign(prepared.writes)
            if (results.all { it is WriteResult.Done }) {
                _state.update {
                    it.copy(replySubmitting = false, replyingToId = null, replyDraft = "", commentSigned = true)
                }
            } else {
                _state.update { it.copy(replySubmitting = false, replySigningFailed = true) }
            }
        }
    }

    fun onDraftChange(v: String) = _state.update { it.copy(draft = v) }
    fun onAttributionChange(v: Boolean) = _state.update { it.copy(attributionRequired = v) }
    fun onOversightChange(v: OversightChoice) = _state.update { it.copy(oversight = v) }
    fun onCommentSignedShown() = _state.update { it.copy(commentSigned = false) }

    fun onSubmitComment() {
        val id = postId ?: return
        val s = _state.value
        if (s.submitting || s.draft.isBlank()) return
        _state.update {
            it.copy(
                submitting = true,
                refused = false,
                signingFailed = false,
                submitTransportFailed = false,
            )
        }
        viewModelScope.launch {
            val prepared = when (
                val outcome = content.prepareComment(
                    target = id,
                    content = s.draft,
                    license = LicenseChoice(s.attributionRequired, s.oversight),
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    _state.update { it.copy(submitting = false, refused = true) }
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(submitting = false, submitTransportFailed = true) }
                    return@launch
                }
            }
            val results = signer.sign(prepared.writes)
            if (results.all { it is WriteResult.Done }) {
                _state.update { it.copy(submitting = false, draft = "", commentSigned = true) }
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }
}
