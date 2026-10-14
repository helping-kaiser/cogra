package com.cogra.feature.saved

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedQuery
import com.cogra.domain.saved.SavedRepository
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.saved.parseSavedQuery
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What the Saved list has read, as the screen renders it. */
data class SavedUiState(
    val entries: List<SavedEntry> = emptyList(),
    val loading: Boolean = true,
    /** The first read failed with nothing loaded: the transport line stands. */
    val failed: Boolean = false,
    val loadingMore: Boolean = false,
    /** A next page did not arrive: `Couldn't load more` with Retry ends the list. */
    val moreFailed: Boolean = false,
    val endCursor: String? = null,
    val hasNextPage: Boolean = false,
    /** What the reader typed in the search field, as typed. */
    val query: String = "",
    /** Each veiled body the reader chose to look at, against its mark. */
    val reveals: Map<String, SensitiveMark> = emptyMap(),
) {
    /** The query as the one search rule reads it. */
    val parsed: SavedQuery get() = parseSavedQuery(query)
}

/**
 * The Saved list's reads. The list on screen is the last read with the
 * reader's own acts laid over it ([SavedWrites]): the screen filters by the
 * overlay, so an unsave here, an Undo, and an unsave made elsewhere are all
 * applied in place without a refetch.
 *
 * A SEARCH READS THE WHOLE SAVED SET: the contract pages the list and takes no
 * query (the bookmarks contract stands untouched, round 12), so a standing
 * query walks the rest of the list in, page by page, and the screen narrows
 * the held set by the one search rule.
 */
@HiltViewModel
class SavedViewModel @Inject constructor(
    private val repository: SavedRepository,
    val writes: SavedWrites,
    private val reveals: SensitiveReveals,
    @WebOrigin private val webOrigin: String,
) : ViewModel() {
    private val _state = MutableStateFlow(SavedUiState())
    val state: StateFlow<SavedUiState> = _state.asStateFlow()

    /** Which read is live: a pull fires a new one, and the old one must not overwrite it. */
    private var request = 0

    init {
        refresh()
        // SENSITIVE CONTENT KEEPS ITS VEIL, as on the feed (Saved.md): a
        // reveal made on any surface carries here, and one made here carries
        // back.
        viewModelScope.launch {
            reveals.revealed.collect { revealed -> _state.update { it.copy(reveals = revealed) } }
        }
    }

    /** A reader chose to look at one veiled body, as it stands. */
    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    /** What a card's share hands over: the thing's own web address, never Saved's. */
    fun postShareUrl(postId: String): String = "$webOrigin/posts/$postId"

    fun commentShareUrl(postId: String, commentId: String): String = "$webOrigin/posts/$postId?comment=$commentId"

    fun profileShareUrl(handle: String): String = "$webOrigin/u/$handle"

    /** The first page — on arrival, and on the reader's pull (Saved.md). */
    fun refresh() {
        val asked = ++request
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            val outcome = repository.savedPage(after = null)
            if (asked != request) return@launch
            val page = (outcome as? Outcome.Success)?.value
            if (page == null) {
                _state.update { it.copy(loading = false, failed = true) }
                return@launch
            }
            // A FRESH LOAD: the cards' lines go (RowSigning.md:17), and the
            // overlay steps aside for what the read now says.
            writes.settle()
            _state.update {
                SavedUiState(
                    entries = page.entries,
                    loading = false,
                    endCursor = page.endCursor,
                    hasNextPage = page.hasNextPage,
                    query = it.query,
                    reveals = it.reveals,
                )
            }
            if (_state.value.parsed != SavedQuery.Blank) readRest()
        }
    }

    /** The reader typed in the field. A query that narrows reads the whole set in. */
    fun search(query: String) {
        _state.update { it.copy(query = query) }
        if (parseSavedQuery(query) != SavedQuery.Blank) readRest()
    }

    /** The next page, as the reader nears the tail. */
    fun loadMore() {
        val current = _state.value
        if (current.loadingMore || !current.hasNextPage || current.endCursor == null) return
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        viewModelScope.launch {
            val fetched = nextPage(current.endCursor)
            _state.update { it.copy(loadingMore = false) }
            // A search's walk goes on from where the reader's paging stopped.
            if (fetched && _state.value.parsed != SavedQuery.Blank) readRest()
        }
    }

    /** The fault's Retry: the page asked again — and, while a query narrows, the rest of the set. */
    fun retryMore() {
        if (_state.value.parsed != SavedQuery.Blank) readRest() else loadMore()
    }

    /** Every page past the held ones, in turn — what a narrowing query needs to search. */
    private fun readRest() {
        val current = _state.value
        if (current.loadingMore || !current.hasNextPage || current.endCursor == null) return
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        viewModelScope.launch {
            while (true) {
                val cursor = _state.value.endCursor
                if (!_state.value.hasNextPage || cursor == null || !nextPage(cursor)) break
            }
            _state.update { it.copy(loadingMore = false) }
        }
    }

    /** One page after [cursor]; false when it did not arrive, and the fault ends the list. */
    private suspend fun nextPage(cursor: String): Boolean {
        val page = (repository.savedPage(after = cursor) as? Outcome.Success)?.value
        if (page == null) {
            // THE CARDS ON SCREEN STAY, and the fault ends the list (Saved.md).
            _state.update { it.copy(moreFailed = true) }
            return false
        }
        _state.update { state ->
            val held = state.entries.map { it.id }.toSet()
            state.copy(
                entries = state.entries + page.entries.filterNot { it.id in held },
                endCursor = page.endCursor,
                hasNextPage = page.hasNextPage,
            )
        }
        return true
    }
}
