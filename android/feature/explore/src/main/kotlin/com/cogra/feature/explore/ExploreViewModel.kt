// EXPLORE'S STATE HOLDER — the bar's search slot over the one search law
// (Explore.md, ExploreSearch.md, ExploreFilter.md, ExploreNone.md,
// ExploreUnscoped.md, ExplorePerson.md; api-spec.md "Search"). web's twin is
// `web/src/app/explore/explore-view.tsx`.
//
// SEARCHING IS A STATE OF THIS ROOT, never a screen of its own (Explore.md:9):
// the query is held here, and emptying it — the trailing ×, Back, an emptied
// field — brings the root back to rest (:13-17).
//
// THE RESULTS REFINE AS THE READER TYPES (ExploreSearch.md:3), once typing
// settles; a new filter asks at once. Two refines in flight never cross: a
// new ask cancels the last, and only the newest answer reaches the screen.
// BETWEEN A KEYSTROKE AND ITS ANSWER the rows stay readable; only an ask still
// unanswered after the loading ladder's 200ms shows `Loading…` (:55-57). A
// failed refine keeps the rows under `Couldn't load more` with Retry; a failed
// read with nothing loaded says the house line with Retry (:59-63).
//
// NOTHING HERE MARKS ANYTHING SEEN (ExploreFilter.md:39): a result counts as
// seen only once it is opened, on the surface it opens.

package com.cogra.feature.explore

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.ReaderDefaults
import com.cogra.domain.search.ExploreDeviceStore
import com.cogra.domain.search.READER_SEARCH_DEFAULT
import com.cogra.domain.search.SearchAsk
import com.cogra.domain.search.SearchFilter
import com.cogra.domain.search.SearchHit
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.search.SearchRepository
import com.cogra.domain.search.guestSearchFilter
import com.cogra.domain.search.onlyUnscopedComments
import com.cogra.domain.search.searchDefault
import com.cogra.domain.search.unscopedComments
import com.cogra.domain.store.TokenStore
import com.cogra.domain.topics.HeldTopicsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** How long the field waits for typing to settle before the search refines (web's twin's 250). */
const val EXPLORE_SEARCH_DEBOUNCE_MS = 250L

/** The loading ladder's quiet window (design/readme.md, *Loading*). */
const val LOADING_LADDER_MS = 200L

/** The rows on screen and the ask they answer. */
data class ExploreResults(
    val hits: List<SearchHit>,
    val endCursor: String?,
    val hasNextPage: Boolean,
    val hasMorePeople: Boolean,
    val query: String,
    val filter: SearchFilter,
)

data class ExploreUiState(
    /** The phase has said who is asking; nothing is asked before. */
    val resolved: Boolean = false,
    /** The signed-in reader; null for a guest. An applicant reads as a member (Explore.md:39). */
    val reader: String? = null,
    val query: String = "",
    /** The committed filter. */
    val filter: SearchFilter = READER_SEARCH_DEFAULT,
    val results: ExploreResults? = null,
    /** An ask is in flight. */
    val pending: Boolean = false,
    /** …and has outrun the loading ladder. */
    val slow: Boolean = false,
    /** The last ask failed. */
    val failed: Boolean = false,
    val loadingMore: Boolean = false,
    val moreFailed: Boolean = false,
    /** The reader pulled the results down. */
    val refreshing: Boolean = false,
    val recents: List<String> = emptyList(),
    /** How many topics the reader holds; null until read, and for a guest. */
    val heldCount: Int? = null,
    /**
     * THE READER'S DEFAULT AS SEARCH READS IT (SettingsReading.md): the order
     * and seen toggle of the feed default saved in Settings, search's own kinds.
     */
    val readerDefault: SearchFilter = READER_SEARCH_DEFAULT,
) {
    val guest: Boolean get() = resolved && reader == null
    val searching: Boolean get() = query.isNotBlank()

    /** The default the trigger and Reset read against: the reader's, or a guest's newest. */
    val defaultFilter: SearchFilter get() = if (guest) guestSearchFilter() else readerDefault

    /** Loading… stands in the rows' place once an ask outran the ladder. */
    val rowsShown: Boolean get() = results != null && !(slow && pending)

    /** Comments are on and no cue names a scope: the search-scope line stands (ExploreUnscoped.md:3-7). */
    val unscopedLine: Boolean get() = results?.let { unscopedComments(it.query, it.filter.kinds) } == true

    /** The answer to the query standing in the field came back empty, for no other reason (ExploreNone.md:3). */
    val nothingLine: Boolean
        get() {
            val answer = results ?: return false
            val answered = answer.query == query.trim() && !pending && !failed
            return answered && answer.hits.isEmpty() && !unscopedLine
        }
}

// One handler per intent the boards draw (type, clear, recent, action key,
// open, Done, See all profiles, retry, pull, the next page and its retry):
// the surface is one state machine, and splitting its intents across classes
// would hide the transitions they share.
@Suppress("TooManyFunctions")
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class ExploreViewModel @Inject constructor(
    private val search: SearchRepository,
    private val heldTopics: HeldTopicsRepository,
    private val device: ExploreDeviceStore,
    tokens: TokenStore,
    private val saved: SavedStateHandle,
    private val readerDefaults: ReaderDefaults,
) : ViewModel() {

    private val _state = MutableStateFlow(ExploreUiState(query = saved[QUERY] ?: ""))
    val state: StateFlow<ExploreUiState> = _state.asStateFlow()

    /** Test seam: the debounce. */
    internal var debounceMs = EXPLORE_SEARCH_DEBOUNCE_MS

    private var settle: Job? = null
    private var ask: Job? = null
    private var ladder: Job? = null
    private var more: Job? = null

    init {
        val readers = tokens.tokens.map { it?.accountId }.distinctUntilChanged()
        viewModelScope.launch {
            readers.collect { reader -> onReader(reader) }
        }
        // The default stays current as Settings saves it: the trigger and Reset read it.
        viewModelScope.launch {
            readerDefaults.current.collect { default ->
                _state.update { it.copy(readerDefault = default.searchDefault()) }
            }
        }
        viewModelScope.launch {
            readers.flatMapLatest { device.recents(it) }.collect { list -> _state.update { it.copy(recents = list) } }
        }
    }

    /** Whose filter this is: the account's committed one, or a guest's — newest, no seen toggle. */
    private suspend fun onReader(reader: String?) {
        val filter = if (reader == null) {
            guestSearchFilter(device.committedFilter(null)?.kinds.orEmpty())
        } else {
            device.committedFilter(reader) ?: readerDefaults.now().searchDefault()
        }
        val first = !_state.value.resolved
        _state.update {
            it.copy(
                resolved = true,
                reader = reader,
                filter = filter,
                heldCount = null,
                // Another reader starts fresh: no row of the last one's stays.
                results = if (first) it.results else null,
            )
        }
        readHeldCount()
        // A query that came back with the screen (process death) asks again once.
        val query = _state.value.query
        if (query.isNotBlank()) read(query.trim(), filter)
    }

    /** The door's count (Explore.md:43): read on arrival and each return; never for a guest. */
    fun readHeldCount() {
        if (_state.value.reader == null) return
        viewModelScope.launch {
            val count = (heldTopics.heldCount() as? Outcome.Success)?.value
            _state.update { it.copy(heldCount = count ?: it.heldCount) }
        }
    }

    /** A keystroke. An emptied field rests (Explore.md:17). */
    fun onQueryChange(text: String) {
        if (text.isBlank() && _state.value.searching) {
            toRest()
            return
        }
        setQuery(text)
        settle?.cancel()
        settle = viewModelScope.launch {
            delay(debounceMs)
            refine()
        }
    }

    /** The trailing ×, Back from a standing search, or an emptied field: Explore stands at rest. */
    fun toRest() {
        settle?.cancel()
        cancelAsk()
        more?.cancel()
        setQuery("")
        _state.update {
            it.copy(
                results = null,
                pending = false,
                slow = false,
                failed = false,
                moreFailed = false,
                refreshing = false,
            )
        }
    }

    /** A recent search, tapped: its query runs again (Explore.md:29), at once. */
    fun onRecent(query: String) {
        settle?.cancel()
        setQuery(query)
        refine()
    }

    /** The keyboard's action key: the query joins the recents, and nothing else happens (Explore.md:25). */
    fun onAction() = rememberQuery()

    /** A result opened: the query joins the recents (Explore.md:23). */
    fun onOpenResult() = rememberQuery()

    /** Done: the sheet's staged filter commits, kept on this device, and the search re-queries once. */
    fun commit(filter: SearchFilter) {
        val current = _state.value
        if (filter == current.filter) return
        _state.update { it.copy(filter = filter) }
        viewModelScope.launch { device.commitFilter(current.reader, filter) }
        settle?.cancel()
        refine()
    }

    /** `See all profiles` (ExplorePerson.md:13): Profiles alone becomes the filter's kind. */
    fun allProfiles() = commit(_state.value.filter.copy(kinds = setOf(FeedKind.PROFILE)))

    /** Retry, after a failed refine or a failed first read. */
    fun retry() = refine()

    /** The results pulled down: the same ask again. */
    fun pull() {
        if (!_state.value.searching) return
        _state.update { it.copy(refreshing = true) }
        refine()
    }

    /** The next page of the same ask, as the list nears its tail. */
    fun loadMore() {
        val current = _state.value
        val results = current.results ?: return
        val exhausted = !results.hasNextPage || results.endCursor == null
        if (current.loadingMore || current.moreFailed || exhausted) return
        fetchMore(results)
    }

    /** Retry after a failed next page. */
    fun retryMore() {
        val results = _state.value.results ?: return
        _state.update { it.copy(moreFailed = false) }
        fetchMore(results)
    }

    private fun fetchMore(results: ExploreResults) {
        if (_state.value.loadingMore) return
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        more = viewModelScope.launch {
            val outcome = search.searchPage(askOf(results.query, results.filter), results.endCursor)
            _state.update { state ->
                val now = state.results
                if (outcome !is Outcome.Success || now == null || now.query != results.query) {
                    return@update state.copy(loadingMore = false, moreFailed = outcome !is Outcome.Success)
                }
                val known = now.hits.mapTo(HashSet()) { it.node.id }
                state.copy(
                    loadingMore = false,
                    results = now.copy(
                        hits = now.hits + outcome.value.hits.filter { it.node.id !in known },
                        endCursor = outcome.value.endCursor,
                        hasNextPage = outcome.value.hasNextPage,
                    ),
                )
            }
        }
    }

    private fun refine() {
        val current = _state.value
        if (!current.resolved) return
        read(current.query.trim(), current.filter)
    }

    private fun read(text: String, filter: SearchFilter) {
        cancelAsk()
        more?.cancel()
        _state.update { it.copy(moreFailed = false, loadingMore = false) }
        if (text.isEmpty()) {
            _state.update { it.copy(pending = false, slow = false, failed = false, refreshing = false) }
            return
        }
        // Comments alone and no cue: nothing can stand, the line says the way
        // (ExploreUnscoped.md:3-5) — no read is sent for an answer known empty.
        if (onlyUnscopedComments(text, filter.kinds)) {
            _state.update {
                it.copy(
                    pending = false,
                    slow = false,
                    failed = false,
                    refreshing = false,
                    results = ExploreResults(emptyList(), null, false, false, text, filter),
                )
            }
            return
        }
        _state.update { it.copy(pending = true, slow = false) }
        ladder = viewModelScope.launch {
            delay(LOADING_LADDER_MS)
            _state.update { it.copy(slow = true) }
        }
        ask = viewModelScope.launch {
            val outcome = search.searchPage(askOf(text, filter), after = null)
            ladder?.cancel()
            _state.update { state ->
                val settled = state.copy(pending = false, slow = false, refreshing = false)
                when (outcome) {
                    is Outcome.Success -> settled.copy(
                        failed = false,
                        results = ExploreResults(
                            hits = outcome.value.hits,
                            endCursor = outcome.value.endCursor,
                            hasNextPage = outcome.value.hasNextPage,
                            hasMorePeople = outcome.value.hasMorePeople,
                            query = text,
                            filter = filter,
                        ),
                    )
                    else -> settled.copy(failed = true)
                }
            }
        }
    }

    private fun askOf(text: String, filter: SearchFilter): SearchAsk {
        val reader = _state.value.reader
        val guest = reader == null
        val order = if (guest) SearchOrder.NEWEST else filter.order
        return SearchAsk(
            query = text,
            kinds = filter.kinds,
            includeSeen = guest || filter.seen,
            order = order,
            viewer = reader.takeIf { order == SearchOrder.RANKED },
        )
    }

    private fun cancelAsk() {
        ask?.cancel()
        ladder?.cancel()
    }

    private fun setQuery(text: String) {
        saved[QUERY] = text
        _state.update { it.copy(query = text) }
    }

    private fun rememberQuery() {
        val current = _state.value
        val query = current.query.trim()
        if (query.isEmpty()) return
        viewModelScope.launch { device.rememberSearch(current.reader, query) }
    }

    private companion object {
        /** The half-typed query survives process death (readme §13). */
        const val QUERY = "explore_query"
    }
}
