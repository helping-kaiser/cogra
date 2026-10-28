// YOUR TOPICS' STATE HOLDER (YourTopics.md; `User.heldTopics`): every topic
// the reader holds, strongest first by association, down past nothing into
// the ones held against — the order is the server's, never re-sorted here.

package com.cogra.feature.explore

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.topics.HeldTopic
import com.cogra.domain.topics.HeldTopicsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class YourTopicsUiState(
    val loading: Boolean = true,
    val failed: Boolean = false,
    val topics: List<HeldTopic> = emptyList(),
    val endCursor: String? = null,
    val hasNextPage: Boolean = false,
    val loadingMore: Boolean = false,
    val moreFailed: Boolean = false,
)

@HiltViewModel
class YourTopicsViewModel @Inject constructor(
    private val held: HeldTopicsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(YourTopicsUiState())
    val state: StateFlow<YourTopicsUiState> = _state.asStateFlow()

    init {
        read()
    }

    /** The first page — on arrival, on Retry, and on each return (a walk-back may have left the list). */
    fun read() {
        _state.update { it.copy(loading = true, failed = false) }
        viewModelScope.launch {
            when (val outcome = held.heldPage(after = null)) {
                is Outcome.Success -> _state.update {
                    val page = outcome.value
                    it.copy(
                        loading = false,
                        topics = page?.topics.orEmpty(),
                        endCursor = page?.endCursor,
                        hasNextPage = page?.hasNextPage == true,
                        moreFailed = false,
                    )
                }
                else -> _state.update { it.copy(loading = false, failed = true) }
            }
        }
    }

    /** The next page, as the list nears its tail. */
    fun loadMore() {
        val current = _state.value
        if (current.loadingMore || current.moreFailed || !current.hasNextPage || current.endCursor == null) return
        fetchMore(current.endCursor)
    }

    /** Retry after a failed next page. */
    fun retryMore() {
        val cursor = _state.value.endCursor ?: return
        _state.update { it.copy(moreFailed = false) }
        fetchMore(cursor)
    }

    private fun fetchMore(cursor: String) {
        if (_state.value.loadingMore) return
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        viewModelScope.launch {
            when (val outcome = held.heldPage(cursor)) {
                is Outcome.Success -> _state.update { state ->
                    val page = outcome.value
                    val known = state.topics.mapTo(HashSet()) { it.name }
                    state.copy(
                        loadingMore = false,
                        topics = state.topics + page?.topics.orEmpty().filter { it.name !in known },
                        endCursor = page?.endCursor,
                        hasNextPage = page?.hasNextPage == true,
                    )
                }
                else -> _state.update { it.copy(loadingMore = false, moreFailed = true) }
            }
        }
    }
}
