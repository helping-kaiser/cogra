package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.EdgeSighting
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.SeenPosts
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedRepository
import com.cogra.domain.feed.FeedRow
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.feed.FilterChange
import com.cogra.domain.feed.changeTo
import com.cogra.domain.feed.derive
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.hidden.HiddenStatus
import com.cogra.domain.history.SeenRecord
import com.cogra.domain.history.SeenTracker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * One window per hydration: the first screenful arrives fast, well under
 * the page budget of 100 ids (CD-2).
 */
internal const val FEED_PAGE_SIZE = 20

data class FeedUiState(
    /** A ranking is in flight: the first fetch, a pull, or a Done that changed kinds or topic. */
    val loading: Boolean = true,
    /** The cards: the derived list's hydrated head, in its order. */
    val posts: List<PostView> = emptyList(),
    /** Rows of the derived list not hydrated yet. */
    val hasNextPage: Boolean = false,
    val loadingMore: Boolean = false,
    val transportFault: TransportFault? = null,
    /**
     * The veiled bodies this reader has chosen to look at, against the
     * marks they chose under. App-wide rather than per card, so a reveal
     * made here is still made when the post opens.
     */
    val reveals: Map<String, SensitiveMark> = emptyMap(),
    /** The filter in force — what the reader's last Done chose. */
    val filter: FeedFilter = FeedFilter(),
    /**
     * The held answer, UNCUT: the frozen order every derive reads, and the
     * off-feed lookup source (CD-9). Replaced only by a fetch — a local
     * re-derive never touches it, nor its pin. Null before the first lands.
     */
    val ranking: FeedRanking? = null,
    /**
     * The derived list (§4.12): composed, ordered and cut at the last
     * derive, and frozen until the next one — rows seen while it is on
     * screen stay where they are (W-6).
     */
    val rows: List<FeedRow> = emptyList(),
)

/**
 * THE RANKED FEED (ranked-feed-api packet, RF-5): one `feedRanking` per
 * open, per pull, and per Done that changes what the ranker computes; the
 * device derives everything else from the held answer (CD-1).
 *
 * - **The pod orders, the device places and cuts.** Ranked is the
 *   answer's own order, Newest its second permutation, the settling rows
 *   stand where the pod wove them, and the seen, people and Still-settling
 *   cuts delete rows without re-ordering any (CD-7, CD-8, CD-10, CD-11).
 *   Nothing here scores or compares (PR-9/PR-10).
 * - **A local re-derive is not a fetch.** A Done that changes only
 *   device-side axes re-derives from the held answer: no call, no new pin.
 * - **Seen is cut from the device's record, read fresh at every derive**,
 *   and the derived list is frozen between derives: scrolling never
 *   deletes the rows under the reader (W-6).
 * - **Staleness (PR-55).** The ranking is fetched when this ViewModel is
 *   created — a cold start always refetches — and otherwise only when the
 *   reader pulls. Nothing here watches the app's lifecycle: a return from
 *   the background shows the feed exactly as it was left, however long
 *   the absence.
 *
 * Kinds other than posts hydrate to nothing until a card renders them;
 * the sheet's controls and the card's figure are the feed/card rework's.
 */
@HiltViewModel
class FeedViewModel @Inject constructor(
    private val feed: FeedRepository,
    private val viewer: FeedViewer,
    private val seenRecord: SeenRecord,
    landings: LandingSignal,
    private val reveals: SensitiveReveals,
    private val seen: SeenPosts,
    @WebOrigin private val webOrigin: String,
    private val seenTracker: SeenTracker,
    private val hidden: HiddenSet,
) : ViewModel() {

    /** Whether the reader's hidden set takes [post] out of the feed (hidden-actors §4.3). */
    private fun visible(post: PostView): Boolean = !hidden.view.value.hides(post.author?.id, post.id)

    private val _state = MutableStateFlow(FeedUiState())
    val state = _state.asStateFlow()

    /**
     * The posts hydrated since the last fetch, by id: a re-derive that
     * brings back a row already read shows it without reading it again.
     */
    private val hydrated = HashMap<String, PostView>()

    /** How far into [FeedUiState.rows] the cards reach. */
    private var cursor = 0

    /** The fetch or derive in flight; a newer one supersedes it. */
    private var composing: Job? = null

    /** Post cards that stood fully in the viewport, in the order they did. */
    fun onCardsSeen(postIds: List<String>) = seenTracker.saw(postIds)

    /** Tall post cards with an edge on screen; each joins once both edges have been. */
    fun onCardEdgesSeen(sightings: List<EdgeSighting>) =
        sightings.forEach { seenTracker.sawEdges(it.nodeId, top = it.top, bottom = it.bottom) }

    /** The reading paused — the scroll rested or the reader left. */
    fun onSeenCheckpoint() = seenTracker.flush()

    /** What the share control hands to the platform's own sheet. */
    fun shareUrl(postId: String): String = postShareUrl(webOrigin, postId)

    /** A reader chose to look at a veiled body, as it stands right now. */
    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    init {
        // The cold-start law (PR-55 (i)): a fresh process ranks afresh.
        refresh()
        // The reveal set is app-wide, so a choice made on the detail
        // screen reaches the card here too — being asked twice about the
        // same body reads as the app forgetting.
        viewModelScope.launch {
            reveals.revealed.collect { revealed -> _state.update { it.copy(reveals = revealed) } }
        }
        // A node the device has since read afresh — the reader opened
        // the post and pulled to refresh until it landed — carries its
        // state back to the card that is still on screen. No row moves,
        // arrives, or leaves (W-6). The windows read pending versions,
        // so a landed-only read says nothing here.
        viewModelScope.launch {
            landings.updates.collect { update ->
                if (!update.includePending) return@collect
                val landed: (PostView) -> PostView = { it.copy(landing = update.landing) }
                hydrated[update.nodeId]?.let { hydrated[update.nodeId] = landed(it) }
                _state.update { it.copy(posts = it.posts.withLanding(update.nodeId, landed)) }
            }
        }
    }

    // The fault reflects the last COMPLETED fetch: clearing it eagerly at
    // fetch start made the error surface vanish and reappear — a visible
    // flash — on every failed retry. It also carries which fetch failed,
    // so the fault can surface where that fetch was requested.

    /** The explicit refresh — the pull, the retry, the shell's signal: one ranking. */
    fun refresh() {
        _state.update { it.copy(loading = true) }
        composing?.cancel()
        composing = viewModelScope.launch {
            val filter = _state.value.filter
            // THE FEED NEVER DRAWS A PAGE BEFORE THE HIDDEN SET HAS BEEN READ
            // (hidden-actors §5.1): both reads go together, every open and
            // every pull, and a set that could not be read at all is the
            // feed's own fault — never an unfiltered page.
            val setRead = async { hidden.refetch() }
            val ranked = feed.rank(viewer, filter)
            val setKnown = setRead.await() || hidden.view.value.status == HiddenStatus.READ
            when {
                ranked is Outcome.Success && setKnown -> {
                    hydrated.clear()
                    install(ranked.value)
                }
                // A failed refresh keeps the held snapshot on screen; the
                // fault takes the house vehicles (§4.5) — never a silent
                // fallback to another order.
                else -> _state.update { it.copy(loading = false, transportFault = TransportFault.REFRESH) }
            }
        }
    }

    /**
     * The sheet's Done (CD-1): no change asks nothing; a change to kinds or
     * topic ranks once and derives; any other change is a local re-derive
     * from the held answer, with the seen cut read fresh.
     */
    fun applyFilter(staged: FeedFilter) {
        val change = _state.value.filter.changeTo(staged)
        if (change == FilterChange.NONE) return
        _state.update { it.copy(filter = staged) }
        when (change) {
            FilterChange.FETCH -> refresh()
            FilterChange.DERIVE -> rederive()
            FilterChange.NONE -> Unit
        }
    }

    private fun rederive() {
        // Nothing held yet: the fetch in flight derives with the new filter.
        val held = _state.value.ranking ?: return
        if (_state.value.loading) return
        composing?.cancel()
        composing = viewModelScope.launch { install(held) }
    }

    /**
     * THE DERIVE (§4.12) over [ranking], by the filter in force and the
     * seen record as it stands now, then the first window. The new list
     * replaces the old one only once its first window is read.
     */
    private suspend fun install(ranking: FeedRanking) {
        val filter = _state.value.filter
        val rows = ranking.derive(filter, seenRecord.seenIds())
        when (val first = feed.hydrate(rows, from = 0, hydrated, ::visible)) {
            is Outcome.Success -> {
                val (posts, next) = first.value
                cursor = next
                // What the reader can see is what the detail may open
                // from (HT-10).
                seen.saw(posts)
                _state.update {
                    it.copy(
                        loading = false,
                        transportFault = null,
                        ranking = ranking,
                        rows = rows,
                        posts = posts,
                        hasNextPage = next < rows.size,
                    )
                }
            }
            else -> _state.update { it.copy(loading = false, transportFault = TransportFault.REFRESH) }
        }
    }

    /** The next window of the frozen derived list — the tail watch's ask. */
    fun loadMore() {
        val s = _state.value
        if (s.loadingMore || !s.hasNextPage) return
        _state.update { it.copy(loadingMore = true) }
        val rows = s.rows
        val from = cursor
        viewModelScope.launch {
            val outcome = feed.hydrate(rows, from, hydrated, ::visible)
            // A derive that replaced the list meanwhile owns the cards now.
            if (_state.value.rows !== rows) {
                _state.update { it.copy(loadingMore = false) }
                return@launch
            }
            when (outcome) {
                is Outcome.Success -> {
                    val (posts, next) = outcome.value
                    cursor = next
                    seen.saw(posts)
                    _state.update {
                        it.copy(
                            loadingMore = false,
                            transportFault = null,
                            posts = it.posts.appendPage(posts) { p -> p.id },
                            hasNextPage = next < rows.size,
                        )
                    }
                }
                else -> _state.update { it.copy(loadingMore = false, transportFault = TransportFault.APPEND) }
            }
        }
    }
}

/**
 * The ranking for [filter]'s pod-side axes, of the view [viewer] resolves
 * to; the empty answer where nothing would rank.
 */
private suspend fun FeedRepository.rank(viewer: FeedViewer, filter: FeedFilter): Outcome<FeedRanking> {
    // Every kind off: the empty state, and the client never asks
    // (FeedNothing.md:3-5).
    if (filter.kinds.isEmpty()) return Outcome.Success(FeedRanking.EMPTY)
    return when (val who = viewer.resolve()) {
        is Outcome.Success -> {
            val id = who.value ?: return Outcome.Success(FeedRanking.EMPTY)
            when (val answer = ranking(id, filter.rankArgs)) {
                is Outcome.Success -> Outcome.Success(answer.value ?: FeedRanking.EMPTY)
                is Outcome.Refused -> answer
                is Outcome.Failed -> answer
            }
        }
        is Outcome.Refused -> who
        is Outcome.Failed -> who
    }
}

/**
 * Hydrates [rows] from [from] a window at a time, until a window yields a
 * [visible] card or the list ends (the fill rule, §5.1; hidden-actors §4.4
 * "over-fetch to fill"): a window of expired, not-yet-rendered or hidden
 * people's rows loads the next rather than leaving the reader at a dead end.
 * The hidden rows still ride along — the screen leaves them out, and Undo
 * puts them back where they stood. Rows already in [hydrated] — read since
 * the last fetch — are not read again; what is read joins it. Returns the
 * cards, in the list's order, and where the next window starts.
 */
private suspend fun FeedRepository.hydrate(
    rows: List<FeedRow>,
    from: Int,
    hydrated: MutableMap<String, PostView>,
    visible: (PostView) -> Boolean,
): Outcome<Pair<List<PostView>, Int>> {
    var at = from
    val cards = mutableListOf<PostView>()
    while (at < rows.size && cards.none(visible)) {
        val ids = rows.subList(at, minOf(at + FEED_PAGE_SIZE, rows.size)).map { it.targetId }
        val unread = ids.filterNot { it in hydrated }
        if (unread.isNotEmpty()) {
            when (val read = window(unread)) {
                is Outcome.Success -> read.value.forEach { hydrated[it.id] = it }
                is Outcome.Refused -> return read
                is Outcome.Failed -> return read
            }
        }
        cards += ids.mapNotNull { hydrated[it] }
        at += ids.size
    }
    return Outcome.Success(cards to at)
}

/** The held card keeps its place; only its own state moves. */
private fun List<PostView>.withLanding(id: String, change: (PostView) -> PostView): List<PostView> =
    if (none { it.id == id }) this else map { if (it.id == id) change(it) else it }
