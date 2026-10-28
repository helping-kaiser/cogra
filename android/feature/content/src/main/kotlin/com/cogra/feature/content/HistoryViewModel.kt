// HISTORY'S READS (History.md, HistoryFilter.md, HistoryHidden.md,
// HistorySearch.md): the reader's seen-list, page by page, narrowed by the
// query and the kinds the reader set — every narrowing run on the server.
// web's twin is the state half of `web/src/app/history/history-view.tsx`.

package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.history.HistoryPage
import com.cogra.domain.history.HistoryRepository
import com.cogra.domain.history.historyNarrowing
import com.cogra.domain.history.unhidden
import com.cogra.domain.saved.SavedWrites
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What one read asked: the search it narrowed by (null = none) and the kinds (empty = every kind). */
data class HistoryAsk(val query: String?, val kinds: Set<FeedKind>)

/** What History has read, as the screen renders it. */
data class HistoryUiState(
    val entries: List<HistoryEntry> = emptyList(),
    val loading: Boolean = true,
    /** The first read failed with nothing standing for it: the transport line stands. */
    val failed: Boolean = false,
    val loadingMore: Boolean = false,
    /** A next page did not arrive: `Couldn't load more` with Retry ends the list. */
    val moreFailed: Boolean = false,
    val endCursor: String? = null,
    val hasNextPage: Boolean = false,
    val hasMorePeople: Boolean = false,
    val hasMoreTags: Boolean = false,
    /** What the reader typed in the search field, as typed. */
    val query: String = "",
    /** The kinds the filter holds — what the trigger reads. Empty is the default: every kind. */
    val kinds: Set<FeedKind> = emptySet(),
    /** What the list on screen answers; null until the first read lands. The cursor pages on it alone. */
    val answered: HistoryAsk? = null,
    /** Each veiled body the reader chose to look at, against its mark. */
    val reveals: Map<String, SensitiveMark> = emptyMap(),
)

/** How long typing rests before a search is read — Saved's own pause. */
const val HISTORY_SEARCH_DEBOUNCE_MILLIS = 250L

/** The longest search the server reads (api-spec.md "Search": past 640 characters is BAD_INPUT). */
const val HISTORY_SEARCH_MAX_CHARS = 640

/**
 * History's reads. A new read — the arrival, a pull, a settled query, a
 * kinds change — asks its first page beside a fresh read of the hidden set;
 * an older read's answer that lands after a newer one began is dropped (the
 * stale-answer guard). THE ORDER STANDS FROZEN PER OPEN (History.md:109): a
 * thing first seen while the reader scrolls joins only at the next open or
 * pull, which the server's keyset on `(firstSeenAt, node id)` keeps.
 */
@HiltViewModel
class HistoryViewModel @Inject constructor(
    private val repository: HistoryRepository,
    private val hidden: HiddenSet,
    val writes: SavedWrites,
    private val reveals: SensitiveReveals,
    @WebOrigin private val webOrigin: String,
) : ViewModel() {
    private val _state = MutableStateFlow(HistoryUiState())
    val state: StateFlow<HistoryUiState> = _state.asStateFlow()

    /** Which read is live: a newer one fires, and an older one's pages must not land. */
    private var request = 0

    /** The search the live read asks — what a new keystroke is compared against. */
    private var wanted: String? = null

    /** The typing's pending read, cancelled by the next keystroke. */
    private var pendingSearch: Job? = null

    init {
        refresh()
        // SENSITIVE CONTENT KEEPS ITS VEIL, as on the feed (History.md:43).
        viewModelScope.launch {
            reveals.revealed.collect { revealed -> _state.update { it.copy(reveals = revealed) } }
        }
    }

    /** A reader chose to look at one veiled body, as it stands. */
    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    /** What a card's share hands over: the thing's own web address, never History's. */
    val shareUrls = CardShareUrls(
        post = { postId -> "$webOrigin/posts/$postId" },
        comment = { postId, commentId -> "$webOrigin/posts/$postId?comment=$commentId" },
        profile = { handle -> "$webOrigin/u/$handle" },
    )

    /** A tag card's share: the tag page's own address. */
    val topicShareUrl: (String) -> String = { name -> "$webOrigin/topics/$name" }

    /** The first page — on arrival, the reader's pull (History.md:111) and Retry — under what stands. */
    fun refresh() {
        _state.update { it.copy(loading = true) }
        read(HistoryAsk(historyNarrowing(_state.value.query), _state.value.kinds))
    }

    /**
     * The reader typed in the field. The field shows it at once; the read
     * follows once typing rests, and a cleared field reads the whole list
     * without waiting. A query that asks what is already asked reads nothing.
     */
    fun search(query: String) {
        _state.update { it.copy(query = query) }
        pendingSearch?.cancel()
        val narrowing = historyNarrowing(query)
        if (narrowing == wanted) return
        val kinds = _state.value.kinds
        if (narrowing == null) {
            read(HistoryAsk(null, kinds))
            return
        }
        pendingSearch = viewModelScope.launch {
            delay(HISTORY_SEARCH_DEBOUNCE_MILLIS)
            read(HistoryAsk(narrowing, kinds))
        }
    }

    /**
     * The sheet's Done (HistoryFilter.md:17): the staged kinds become the
     * filter and History re-reads ONCE with them, the query kept.
     */
    fun applyKinds(staged: Set<FeedKind>) {
        _state.update { it.copy(kinds = staged, loading = true) }
        read(HistoryAsk(historyNarrowing(_state.value.query), staged))
    }

    /** A section's door (HistorySearch.md:19, :27): its kind alone becomes the filter, the query kept. */
    fun narrowTo(kind: FeedKind) = applyKinds(setOf(kind))

    /** `Show everything` (HistoryNone.md:13): the query clears, no kind is narrowed, History stands whole. */
    fun showEverything() {
        pendingSearch?.cancel()
        _state.update { it.copy(query = "", kinds = emptySet(), loading = true) }
        read(HistoryAsk(null, emptySet()))
    }

    /** The first page of [ask]'s list, read beside the hidden set. */
    private fun read(ask: HistoryAsk) {
        pendingSearch?.cancel()
        wanted = ask.query
        val asked = ++request
        val query = ask.query
        if (query != null && query.codePointCount(0, query.length) > HISTORY_SEARCH_MAX_CHARS) {
            // PAST THE SERVER'S CAP NOTHING CAN MATCH: the list stands
            // narrowed to nothing rather than asking for a BAD_INPUT.
            land(asked, ask, HistoryPage(emptyList(), endCursor = null, hasNextPage = false))
            return
        }
        viewModelScope.launch {
            // EVERY FRESH READ READS THE HIDDEN SET AGAIN, beside the page
            // (HistoryHidden.md:7): a hide made since the last open takes hold
            // now — never mid-scroll. The server already keeps a hidden
            // account's things out, so a set that could not be read leaves the
            // page as served rather than failing it.
            val setRead = async { hidden.refetch() }
            val outcome = repository.historyPage(query = ask.query, kinds = ask.kinds, after = null)
            setRead.await()
            if (asked != request) return@launch
            val page = (outcome as? Outcome.Success)?.value
            if (page == null) {
                // A FAILED REFRESH keeps the cards on screen; a failed NEW
                // narrowing must not leave another narrowing's cards standing
                // as its answer.
                _state.update {
                    val same = it.answered == ask
                    it.copy(
                        entries = if (same) it.entries else emptyList(),
                        loading = false,
                        failed = true,
                        loadingMore = false,
                        moreFailed = false,
                        hasNextPage = if (same) it.hasNextPage else false,
                        hasMorePeople = if (same) it.hasMorePeople else false,
                        hasMoreTags = if (same) it.hasMoreTags else false,
                        answered = ask,
                    )
                }
                return@launch
            }
            land(asked, ask, page)
        }
    }

    private fun land(asked: Int, ask: HistoryAsk, page: HistoryPage) {
        if (asked != request) return
        _state.update {
            it.copy(
                entries = page.entries.unhidden(hides()),
                loading = false,
                failed = false,
                loadingMore = false,
                moreFailed = false,
                endCursor = page.endCursor,
                hasNextPage = page.hasNextPage,
                hasMorePeople = page.hasMorePeople,
                hasMoreTags = page.hasMoreTags,
                answered = ask,
            )
        }
    }

    /** Whom the device's hidden set takes out of what arrives now; a failed hide's card stands. */
    private fun hides(): (String?, String) -> Boolean {
        val view = hidden.view.value
        return { author, origin -> view.hides(author, origin) }
    }

    /** The next page of the list on screen, as the reader nears the tail — on that list's own cursor. */
    fun loadMore() {
        val current = _state.value
        val cursor = current.endCursor
        val ask = current.answered
        if (current.loadingMore || !current.hasNextPage) return
        if (cursor == null || ask == null) return
        val asked = request
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        viewModelScope.launch {
            val page = (repository.historyPage(ask.query, ask.kinds, cursor) as? Outcome.Success)?.value
            // A newer read replaced the list: this page belongs to none on screen.
            if (asked != request) return@launch
            if (page == null) {
                // THE CARDS ON SCREEN STAY, and the fault ends the list.
                _state.update { it.copy(loadingMore = false, moreFailed = true) }
                return@launch
            }
            // A next page never filters what already stands: only what arrives.
            val arrived = page.entries.unhidden(hides())
            _state.update { state ->
                state.copy(
                    entries = state.entries.appendPage(arrived) { it.id },
                    endCursor = page.endCursor,
                    hasNextPage = page.hasNextPage,
                    loadingMore = false,
                )
            }
        }
    }
}
