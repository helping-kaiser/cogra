package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.NodeLanding
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
) : ViewModel() {

    private val _state = MutableStateFlow(FeedUiState())
    val state = _state.asStateFlow()

    init {
        refresh()
        // A node the device has since read afresh — the reader opened
        // the post and pulled to refresh until it landed — carries its
        // state back to the card that is still on screen. The page
        // itself is untouched: no entry moves, arrives, or leaves, so
        // this is not the page reconciliation the snapshot rule
        // forbids (api-spec.md "A page is a snapshot, not a live
        // view").
        viewModelScope.launch {
            landings.updates.collect { update ->
                _state.update { it.copy(posts = it.posts.withLanding(update)) }
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
