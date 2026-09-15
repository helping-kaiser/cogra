package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.SeenPosts
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.repo.ContentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Which of the detail view's three authoring surfaces a tag gesture
 * belongs to (F9, F10). One set of callbacks serves all three — the
 * sections differ only in which submit they ride.
 */
enum class TagTarget { COMMENT, REPLY, EDIT }

data class PostDetailUiState(
    /**
     * There is nothing to show yet. Distinct from [refreshing]: a post
     * the device had already read paints while its own read is still
     * out, so the screen is busy without being empty (HT-10).
     */
    val loading: Boolean = true,
    /**
     * A read the reader ASKED for is in flight — what the
     * pull-to-refresh indicator says. The screen's own opening read
     * never sets it: an indicator answers the gesture that started it,
     * and nothing else.
     */
    val refreshing: Boolean = false,
    val post: PostView? = null,
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
)

/**
 * One post, as its own surface reads it.
 *
 * NOT its thread: the comments sheet is the one comments surface and
 * owns its own state ([CommentsViewModel]), because the same sheet is
 * raised over the feed, where no detail is loaded. What the detail
 * keeps of the thread is the count on the post's affordance row, which
 * is a fact about the post.
 */
@HiltViewModel
class PostDetailViewModel @Inject constructor(
    private val content: ContentRepository,
    private val landings: LandingSignal,
    private val reveals: SensitiveReveals,
    private val seen: SeenPosts,
    @WebOrigin private val webOrigin: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PostDetailUiState())
    val state = _state.asStateFlow()

    /** What the share control hands to the platform's own sheet. */
    fun shareUrl(postId: String): String = postShareUrl(webOrigin, postId)

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
        // The post the reader just tapped is already on this device, so
        // the screen opens on it and the read catches up behind. Only
        // the post: the thread is always the fresh read's, so a comment
        // never shows from a page nobody asked for.
        seen.lastSeen(id)?.let { held -> _state.update { it.copy(loading = false, post = held) } }
        // The opening read is the screen's own, not a gesture the reader
        // made, so it says nothing while it runs: the held post is
        // already painted and an indicator over content the reader can
        // see claims the screen is still arriving when it has arrived
        // (F2-9). Only a reader's own pull reports itself.
        read(indicate = false)
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

    /** The reader's own re-pull — the one read that reports itself. */
    fun refresh() = read(indicate = true)

    private fun read(indicate: Boolean) {
        val id = postId ?: return
        _state.update { it.copy(loading = it.post == null, refreshing = indicate) }
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
                            it.copy(
                                loading = false,
                                refreshing = false,
                                notFound = true,
                                transportFault = null,
                            )
                        }
                    } else {
                        // This read is the device's freshest word on
                        // where the post stands; the feed card the
                        // reader came from is still holding the state
                        // its own page carried.
                        landings.observed(detail.post.id, detail.post.landing, includePending)
                        // The freshest word this device has: the next
                        // open of this post starts from it.
                        seen.saw(detail.post)
                        _state.update {
                            it.copy(
                                loading = false,
                                refreshing = false,
                                transportFault = null,
                                post = detail.post,
                            )
                        }
                    }
                }
                is Outcome.Refused -> _state.update {
                    it.copy(loading = false, refreshing = false, notFound = true)
                }
                is Outcome.Failed -> _state.update {
                    it.copy(loading = false, refreshing = false, transportFault = TransportFault.REFRESH)
                }
            }
        }
    }
}
