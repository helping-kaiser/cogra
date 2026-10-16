package com.cogra.feature.saved

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedPage
import com.cogra.domain.saved.SavedRepository
import com.cogra.domain.saved.SavedWrites
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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
    /**
     * The search the held list answers, as sent; null when it is the whole
     * list. The cursor pages on this search alone.
     */
    val narrowedBy: String? = null,
    /** Each veiled body the reader chose to look at, against its mark. */
    val reveals: Map<String, SensitiveMark> = emptyMap(),
)

/** How long typing rests before a search is read — the reference finder's own pause. */
const val SAVED_SEARCH_DEBOUNCE_MILLIS = 250L

/**
 * The longest search the server reads (api-spec.md "Search": past 640
 * characters is BAD_INPUT), counted as the server counts — characters of the
 * trimmed query.
 */
const val SAVED_SEARCH_MAX_CHARS = 640

/** The search a typed query sends: trimmed, and null when it narrows nothing. */
fun savedNarrowing(query: String): String? = query.trim().ifEmpty { null }

/**
 * The Saved list's reads. The list on screen is the last read with the
 * reader's own acts laid over it ([SavedWrites]): the screen filters by the
 * overlay, so an unsave here, an Undo, and an unsave made elsewhere are all
 * applied in place without a refetch.
 *
 * THE SEARCH RUNS ON THE SERVER (seam 220, law 5): `bookmarks(query:)`
 * narrows the whole saved set by the one search law, so a match is found
 * wherever it stands in the list, never only in what is loaded. The field's
 * typing rests [SAVED_SEARCH_DEBOUNCE_MILLIS] before the narrowed first page
 * is read; clearing it reads the whole list at once. The narrowed list comes
 * sectioned — people, then content — and stands in the order it is served.
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

    /** Which read is live: a newer one fires, and an older one's pages must not land. */
    private var request = 0

    /** The search the live read asks — what a new keystroke is compared against. */
    private var wanted: String? = null

    /** The typing's pending read, cancelled by the next keystroke. */
    private var pendingSearch: Job? = null

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

    /** The first page — on arrival, and on the reader's pull (Saved.md), under the query standing. */
    fun refresh() {
        _state.update { it.copy(loading = true) }
        read(savedNarrowing(_state.value.query), fresh = true)
    }

    /**
     * The reader typed in the field. The field shows it at once; the read
     * follows once typing rests, and a cleared field reads the whole list
     * without waiting. A query that asks what is already asked reads nothing.
     */
    fun search(query: String) {
        _state.update { it.copy(query = query) }
        pendingSearch?.cancel()
        val narrowing = savedNarrowing(query)
        if (narrowing == wanted) return
        if (narrowing == null) {
            read(null, fresh = false)
            return
        }
        pendingSearch = viewModelScope.launch {
            delay(SAVED_SEARCH_DEBOUNCE_MILLIS)
            read(narrowing, fresh = false)
        }
    }

    /**
     * The first page of [narrowing]'s list. A [fresh] read — arrival or the
     * pull — also lets the overlay step aside for what the read now says
     * (RowSigning.md:17); a search's read only replaces the list.
     */
    private fun read(narrowing: String?, fresh: Boolean) {
        pendingSearch?.cancel()
        wanted = narrowing
        val asked = ++request
        if (narrowing != null && narrowing.codePointCount(0, narrowing.length) > SAVED_SEARCH_MAX_CHARS) {
            // PAST THE SERVER'S CAP NOTHING CAN MATCH: the list stands narrowed
            // to nothing rather than asking for a BAD_INPUT.
            land(asked, narrowing, SavedPage(emptyList(), endCursor = null, hasNextPage = false), fresh)
            return
        }
        viewModelScope.launch {
            val outcome = repository.savedPage(query = narrowing, after = null)
            if (asked != request) return@launch
            val page = (outcome as? Outcome.Success)?.value
            if (page == null) {
                // A search's list that did not arrive holds no stale matches:
                // the transport line stands, and Retry reads it again.
                _state.update {
                    it.copy(
                        entries = if (narrowing == it.narrowedBy) it.entries else emptyList(),
                        loading = false,
                        failed = true,
                        loadingMore = false,
                        moreFailed = false,
                        narrowedBy = narrowing,
                    )
                }
                return@launch
            }
            land(asked, narrowing, page, fresh)
        }
    }

    private fun land(asked: Int, narrowing: String?, page: SavedPage, fresh: Boolean) {
        if (asked != request) return
        // A FRESH LOAD: the cards' lines go (RowSigning.md:17), and the
        // overlay steps aside for what the read now says.
        if (fresh) writes.settle()
        _state.update {
            SavedUiState(
                entries = page.entries,
                loading = false,
                endCursor = page.endCursor,
                hasNextPage = page.hasNextPage,
                query = it.query,
                narrowedBy = narrowing,
                reveals = it.reveals,
            )
        }
    }

    /** The next page of the list on screen, as the reader nears the tail — on that list's own cursor. */
    fun loadMore() {
        val current = _state.value
        val cursor = current.endCursor
        if (current.loadingMore || !current.hasNextPage || cursor == null) return
        val asked = request
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        viewModelScope.launch {
            val page = (repository.savedPage(query = current.narrowedBy, after = cursor) as? Outcome.Success)?.value
            // A newer read replaced the list: this page belongs to none on screen.
            if (asked != request) return@launch
            if (page == null) {
                // THE CARDS ON SCREEN STAY, and the fault ends the list (Saved.md).
                _state.update { it.copy(loadingMore = false, moreFailed = true) }
                return@launch
            }
            _state.update { state ->
                val held = state.entries.map { it.id }.toSet()
                state.copy(
                    entries = state.entries + page.entries.filterNot { it.id in held },
                    endCursor = page.endCursor,
                    hasNextPage = page.hasNextPage,
                    loadingMore = false,
                )
            }
        }
    }

    /** The fault's Retry: the page asked again. */
    fun retryMore() = loadMore()
}
