package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.CommentView
import com.cogra.domain.Outcome
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.repo.ContentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * One comment's reply branch as a reader has unfolded it — keyed by
 * comment id; absent means the branch is still behind its count.
 */
data class ReplyThread(
    /** Empty until a reader opens the branch: nothing is prefetched (Q49). */
    val items: List<CommentView> = emptyList(),
    val endCursor: String? = null,
    val hasMore: Boolean = false,
    val loading: Boolean = false,
    val failed: Boolean = false,
)

/**
 * Where the reader was in the thread when the sheet gave way to a
 * composer — the LazyColumn's own two numbers.
 *
 * Half of the sheet's return contract. The other half is which comment
 * the new reply hangs under; a landing that reported only "a comment
 * landed" could restore neither.
 */
data class CommentsScroll(val index: Int, val offset: Int)

data class CommentsUiState(
    /** Nothing to show yet — the thread's own first read is out. */
    val loading: Boolean = true,
    val comments: List<CommentView> = emptyList(),
    /** The whole thread's size, cursor-independent: the count on the card. */
    val total: Int = 0,
    val endCursor: String? = null,
    val hasMore: Boolean = false,
    val loadingMore: Boolean = false,
    /** The landed-only opt-out; true is the API's own default. */
    val includePending: Boolean = true,
    val transportFault: TransportFault? = null,
    /**
     * The veiled bodies this reader has chosen to look at, against the
     * marks they chose under. App-wide, so a reveal made in the feed is
     * already made in the thread over it.
     */
    val reveals: Map<String, SensitiveMark> = emptyMap(),
    /**
     * One-shot: a comment or an edit signed on the wizard; shown once,
     * then consumed.
     */
    val commentSigned: Boolean = false,
    /** Reply branches a reader has opened (Q49). */
    val replyThreads: Map<String, ReplyThread> = emptyMap(),
)

/**
 * THE COMMENTS SHEET'S OWN STATE, and the reason it has one.
 *
 * The sheet is the one comments surface (jakob 2026-09-15): the count on
 * a feed card raises the same full-function thread the detail's count
 * does. It was a projection of the detail's state machine — it took
 * `PostDetailUiState` whole — which made it unraisable anywhere the
 * detail was not already loaded.
 *
 * So the thread owns itself. One holder per DESTINATION, keyed by post:
 * a sheet over the feed is not a destination of its own
 * (android/CLAUDE.md "Navigation"), so it cannot have a holder per card
 * — [start] rebinds this one to whichever post's count was tapped, the
 * same way the detail's holder rebinds to whichever post was opened.
 */
@HiltViewModel
class CommentsViewModel @Inject constructor(
    private val content: ContentRepository,
    private val reveals: SensitiveReveals,
) : ViewModel() {

    private val _state = MutableStateFlow(CommentsUiState())
    val state = _state.asStateFlow()

    private var postId: String? = null

    init {
        viewModelScope.launch {
            reveals.revealed.collect { revealed -> _state.update { it.copy(reveals = revealed) } }
        }
    }

    /**
     * A reader chose to look at a veiled body, as it stands right now.
     * The set is app-wide, so the choice follows the content rather than
     * the surface it was made on.
     */
    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    /**
     * Bind to a post's thread. A second raise of the same thread keeps
     * what is already on screen — including branches the reader had
     * unfolded — rather than reading it again.
     */
    fun start(id: String) {
        if (postId == id) return
        postId = id
        _state.value = CommentsUiState(reveals = _state.value.reveals)
        read()
    }

    /** The reader's own re-pull, and what a landing fires. */
    fun refresh() = read()

    private fun read(then: (() -> Unit)? = null) {
        val id = postId ?: return
        val includePending = _state.value.includePending
        viewModelScope.launch {
            when (val outcome = content.comments(id, FEED_PAGE_SIZE, null, includePending)) {
                is Outcome.Success -> {
                    val thread = outcome.value
                    _state.update {
                        it.copy(
                            loading = false,
                            transportFault = null,
                            comments = thread?.page?.items.orEmpty(),
                            total = thread?.total ?: 0,
                            endCursor = thread?.page?.endCursor,
                            hasMore = thread?.page?.hasNextPage ?: false,
                            // A page is a snapshot, not a live view
                            // (api-spec.md): the refetched thread is a
                            // new set of nodes, so unfolded branches
                            // start over rather than hanging off ids
                            // this page may not carry.
                            replyThreads = emptyMap(),
                        )
                    }
                    then?.invoke()
                }
                // The thread is what failed, so the fault reads where the
                // thread is — inside the sheet, over the surface below.
                else -> _state.update {
                    it.copy(loading = false, transportFault = TransportFault.REFRESH)
                }
            }
        }
    }

    fun loadMore() {
        val id = postId ?: return
        val s = _state.value
        if (s.loadingMore || !s.hasMore) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch {
            when (val outcome = content.comments(id, FEED_PAGE_SIZE, s.endCursor, s.includePending)) {
                is Outcome.Success -> _state.update {
                    val page = outcome.value?.page
                    it.copy(
                        loadingMore = false,
                        transportFault = null,
                        comments = it.comments.appendPage(page?.items.orEmpty()) { c -> c.id },
                        endCursor = page?.endCursor,
                        hasMore = page?.hasNextPage ?: false,
                    )
                }
                else -> _state.update {
                    it.copy(loadingMore = false, transportFault = TransportFault.APPEND)
                }
            }
        }
    }

    /** A further page of one comment's replies (the expand affordance). */
    fun onLoadMoreReplies(comment: CommentView) = expand(comment.id)

    private fun expand(commentId: String) {
        val s = _state.value
        // Nothing is prefetched (Q49), so the first expand starts from an
        // empty branch and the read fills it.
        val seeded = s.replyThreads[commentId] ?: ReplyThread()
        if (seeded.loading) return
        _state.update {
            it.copy(
                replyThreads = it.replyThreads +
                    (commentId to seeded.copy(loading = true, failed = false)),
            )
        }
        viewModelScope.launch {
            when (
                val outcome =
                    content.commentReplies(commentId, FEED_PAGE_SIZE, seeded.endCursor, s.includePending)
            ) {
                is Outcome.Success -> _state.update {
                    val thread = ReplyThread(
                        items = seeded.items.appendPage(outcome.value.items) { c -> c.id },
                        endCursor = outcome.value.endCursor,
                        hasMore = outcome.value.hasNextPage,
                    )
                    it.copy(replyThreads = it.replyThreads + (commentId to thread))
                }
                else -> _state.update {
                    it.copy(
                        replyThreads = it.replyThreads +
                            (commentId to seeded.copy(loading = false, failed = true)),
                    )
                }
            }
        }
    }

    /**
     * A comment or an edit came back signed from the composer.
     *
     * The thread refetches rather than merging the new entry into the
     * page it already holds: a page is a snapshot, not a live view
     * (api-spec.md), and the refetched page is what carries the pending
     * marker the fresh write wears.
     *
     * SHOW THE CONTENT THEY JUST WROTE (jakob 2026-09-15). A reply lands
     * one level down, behind its parent's collapsed count — so a
     * refetch alone would land the reader on a thread that looks
     * unchanged. [parentCommentId] names the comment it hangs under, and
     * that branch unfolds as the page arrives. Null is a comment on the
     * post itself, which is already at the top level.
     */
    fun onCommentLanded(parentCommentId: String?) {
        _state.update { it.copy(commentSigned = true) }
        read(then = { parentCommentId?.let(::expand) })
    }

    fun onCommentSignedShown() = _state.update { it.copy(commentSigned = false) }
}
