package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.NodeLanding
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.repo.ContentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** One page per fetch; the server default is the same number. */
internal const val FEED_PAGE_SIZE = 20

/** The held entry keeps its place; only its landing state moves. */
private fun List<PostView>.withLanding(update: NodeLanding): List<PostView> =
    if (none { it.id == update.nodeId }) {
        this
    } else {
        map { if (it.id == update.nodeId) it.copy(landing = update.landing) else it }
    }

data class FeedUiState(
    val loading: Boolean = true,
    val posts: List<PostView> = emptyList(),
    val endCursor: String? = null,
    val hasNextPage: Boolean = false,
    val loadingMore: Boolean = false,
    /**
     * The API's own default: pending entries ride the listing, marked.
     * False serves only what has landed on L1, for a reader who wants
     * the settled graph (api-spec.md "Pending entries come first, in
     * their own cursor namespace").
     */
    val includePending: Boolean = true,
    val transportFault: TransportFault? = null,
    /**
     * The veiled bodies this reader has chosen to look at, against the
     * marks they chose under. App-wide rather than per card, so a reveal
     * made here is still made when the post opens.
     */
    val reveals: Map<String, SensitiveMark> = emptyMap(),
)

/**
 * The chronological listing (roadmap "Slice 2"): every post,
 * newest-first in the graph's own landing order — deliberately not the
 * ranked feed.
 */
@HiltViewModel
class FeedViewModel @Inject constructor(
    private val content: ContentRepository,
    landings: LandingSignal,
    private val reveals: SensitiveReveals,
) : ViewModel() {

    private val _state = MutableStateFlow(FeedUiState())
    val state = _state.asStateFlow()

    /** A reader chose to look at a veiled body, as it stands right now. */
    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    init {
        refresh()
        // The reveal set is app-wide, so a choice made on the detail
        // screen reaches the card here too — being asked twice about the
        // same body reads as the app forgetting.
        viewModelScope.launch {
            reveals.revealed.collect { revealed -> _state.update { it.copy(reveals = revealed) } }
        }
        // A node the device has since read afresh — the reader opened
        // the post and pulled to refresh until it landed — carries its
        // state back to the card that is still on screen. The page
        // itself is untouched: no entry moves, arrives, or leaves, so
        // this is not the page reconciliation the snapshot rule
        // forbids (api-spec.md "A page is a snapshot, not a live
        // view"). A read that asked the other landed-only question saw
        // another version of the node, so it says nothing here.
        viewModelScope.launch {
            landings.updates.collect { update ->
                _state.update {
                    if (update.includePending != it.includePending) {
                        it
                    } else {
                        it.copy(posts = it.posts.withLanding(update))
                    }
                }
            }
        }
    }

    // The fault reflects the last COMPLETED fetch: clearing it
    // eagerly at fetch start made the error surface vanish and
    // reappear — a visible flash — on every failed retry. It also
    // carries which fetch failed, so the fault can surface where
    // that fetch was requested.
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
        _state.update { it.copy(loading = true) }
        val includePending = _state.value.includePending
        viewModelScope.launch {
            when (val outcome = content.posts(FEED_PAGE_SIZE, after = null, includePending = includePending)) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        loading = false,
                        transportFault = null,
                        posts = outcome.value.items,
                        endCursor = outcome.value.endCursor,
                        hasNextPage = outcome.value.hasNextPage,
                    )
                }
                // The listing is anonymous-capable; a refusal here is a
                // transport-shaped surprise, rendered the same way.
                else -> _state.update {
                    it.copy(loading = false, transportFault = TransportFault.REFRESH)
                }
            }
        }
    }

    fun loadMore() {
        val s = _state.value
        if (s.loadingMore || !s.hasNextPage) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch {
            when (
                val outcome =
                    content.posts(FEED_PAGE_SIZE, after = s.endCursor, includePending = s.includePending)
            ) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        loadingMore = false,
                        transportFault = null,
                        posts = it.posts.appendPage(outcome.value.items) { p -> p.id },
                        endCursor = outcome.value.endCursor,
                        hasNextPage = outcome.value.hasNextPage,
                    )
                }
                else -> _state.update {
                    it.copy(loadingMore = false, transportFault = TransportFault.APPEND)
                }
            }
        }
    }
}
