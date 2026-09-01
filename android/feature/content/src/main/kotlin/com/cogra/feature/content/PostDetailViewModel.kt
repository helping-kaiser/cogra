package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.CommentView
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.repo.ContentRepository
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
    /** Empty until a reader opens the branch: nothing is prefetched (Q49). */
    val items: List<CommentView> = emptyList(),
    val endCursor: String? = null,
    val hasMore: Boolean = false,
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
    /**
     * The veiled bodies this reader has chosen to look at — the post's
     * and every comment's alike — against the marks they chose under.
     * App-wide, so a reveal made in the feed is already made here.
     */
    val reveals: Map<String, SensitiveMark> = emptyMap(),
    /**
     * One-shot: a comment or an edit signed on the wizard; shown once,
     * then consumed.
     */
    val commentSigned: Boolean = false,
    /** Reply threads a reader has opened (Q49). */
    val replyThreads: Map<String, ReplyThread> = emptyMap(),
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
)


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
    private val landings: LandingSignal,
    private val reveals: SensitiveReveals,
) : ViewModel() {

    private val _state = MutableStateFlow(PostDetailUiState())
    val state = _state.asStateFlow()

    /**
     * A reader chose to look at a veiled body, as it stands right now.
     *
     * The set is app-wide, so this same choice unveils the card the
     * reader arrived from — the reveal follows the content, not the
     * screen (jakob 2026-08-31).
     */
    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    private var postId: String? = null

    init {
        viewModelScope.launch {
            reveals.revealed.collect { revealed -> _state.update { it.copy(reveals = revealed) } }
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
        // Nothing is prefetched (Q49), so the first expand starts from
        // an empty branch and the read fills it.
        val seeded = s.replyThreads[comment.id] ?: ReplyThread()
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

    /**
     * A comment or an edit came back signed from the wizard.
     *
     * The thread refetches rather than merging the new entry into the
     * page it already holds: a page is a snapshot, not a live view
     * (api-spec.md), and the refetched page is what carries the pending
     * marker the fresh write wears.
     */
    fun onCommentSigned() {
        _state.update { it.copy(commentSigned = true) }
        refresh()
    }

    fun onCommentSignedShown() = _state.update { it.copy(commentSigned = false) }


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

}
