package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.repo.ContentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** One page per fetch; the server default is the same number. */
internal const val FEED_PAGE_SIZE = 20

data class FeedUiState(
    val loading: Boolean = true,
    val posts: List<PostView> = emptyList(),
    val endCursor: String? = null,
    val hasNextPage: Boolean = false,
    val loadingMore: Boolean = false,
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
) : ViewModel() {

    private val _state = MutableStateFlow(FeedUiState())
    val state = _state.asStateFlow()

    init {
        refresh()
    }

    // The fault reflects the last COMPLETED fetch: clearing it
    // eagerly at fetch start made the error surface vanish and
    // reappear — a visible flash — on every failed retry. It also
    // carries which fetch failed, so the fault can surface where
    // that fetch was requested.
    fun refresh() {
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            when (val outcome = content.posts(FEED_PAGE_SIZE, after = null)) {
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
            when (val outcome = content.posts(FEED_PAGE_SIZE, after = s.endCursor)) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        loadingMore = false,
                        transportFault = null,
                        posts = it.posts + outcome.value.items,
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
