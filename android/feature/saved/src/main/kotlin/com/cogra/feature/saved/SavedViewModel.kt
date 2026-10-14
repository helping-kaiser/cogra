package com.cogra.feature.saved

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.saved.ComfortKind
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedRepository
import com.cogra.domain.saved.SavedWrites
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
)

/**
 * The Saved list's reads. The list on screen is the last read with the
 * reader's own acts laid over it ([SavedWrites]): the screen filters by the
 * overlay, so an unsave here, an Undo, and an unsave made elsewhere are all
 * applied in place without a refetch.
 */
@HiltViewModel
class SavedViewModel @Inject constructor(
    private val repository: SavedRepository,
    val writes: SavedWrites,
) : ViewModel() {
    private val _state = MutableStateFlow(SavedUiState())
    val state: StateFlow<SavedUiState> = _state.asStateFlow()

    /** Which read is live: a pull fires a new one, and the old one must not overwrite it. */
    private var request = 0

    init {
        refresh()
    }

    /** The first page — on arrival, and on the reader's pull (design digest item 57). */
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
            // A FRESH LOAD: the rows' lines go (RowSigning.md:17), and the
            // overlay steps aside for what the read now says.
            writes.settle()
            _state.value = SavedUiState(
                entries = page.entries,
                loading = false,
                endCursor = page.endCursor,
                hasNextPage = page.hasNextPage,
            )
        }
    }

    fun loadMore() {
        val current = _state.value
        if (current.loadingMore || !current.hasNextPage || current.endCursor == null) return
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        viewModelScope.launch {
            val page = (repository.savedPage(after = current.endCursor) as? Outcome.Success)?.value
            if (page == null) {
                // THE ROWS ON SCREEN STAY, and the fault ends the list (Saved.md).
                _state.update { it.copy(loadingMore = false, moreFailed = true) }
                return@launch
            }
            _state.update { state ->
                val held = state.entries.map { it.id }.toSet()
                state.copy(
                    entries = state.entries + page.entries.filterNot { it.id in held },
                    loadingMore = false,
                    endCursor = page.endCursor,
                    hasNextPage = page.hasNextPage,
                )
            }
        }
    }

    /** A row's own Unsave. */
    fun unsave(entry: SavedEntry) {
        writes.drop(entry.id, entry.bookmarkedAt)
    }

    /** UNDO PUTS THE ROW BACK WHERE IT WAS: kept again at its own first time (SavedUndo.md). */
    fun undo(entry: SavedEntry) {
        writes.keep(entry.id, null, entry.bookmarkedAt, ComfortKind.RESTORE)
    }
}
