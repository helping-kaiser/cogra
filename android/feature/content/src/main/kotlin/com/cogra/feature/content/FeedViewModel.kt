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
import com.cogra.domain.feed.CommittedFeedFilter
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedRepository
import com.cogra.domain.feed.FeedRow
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.feed.FilterChange
import com.cogra.domain.feed.MAX_CARDS_WINDOW
import com.cogra.domain.feed.ReaderDefaults
import com.cogra.domain.feed.changeTo
import com.cogra.domain.feed.heldFor
import com.cogra.domain.feed.derive
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.hidden.HiddenStatus
import com.cogra.domain.history.SeenRecord
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.removal.RemovedMarks
import com.cogra.domain.topics.HeldTopicsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CompletableDeferred
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
    /** The cards: the derived list's hydrated head, in its order, every kind as its own card. */
    val cards: List<FeedCard> = emptyList(),
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
    /** The filter in force — what the reader's last Done chose, the reader's default until then. */
    val filter: FeedFilter = FeedFilter.DEFAULT,
    /**
     * THE READER'S DEFAULT (SettingsReading.md): what the trigger speaks
     * deviations from, what the sheet's Reset stages and what FeedNothing's
     * way back restores — kept current as Settings saves it.
     */
    val readerDefault: FeedFilter = FeedFilter.DEFAULT,
    /** Whose view the feed borrows, for the sheet's and the trigger's words; null on the reader's own. */
    val borrowedHandle: String? = null,
    /** The topics the reader holds and is for — the sheet's One topic chips, read at each opening. */
    val heldTopics: List<FeedTopic> = emptyList(),
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
    /**
     * The rows of [rows] under `feed.seenSeparator` — the reader's seen
     * record as it stood at the last derive (FeedSeenTail.md). They stand
     * after every unseen row; empty, no separator stands.
     */
    val seenTail: Set<String> = emptySet(),
) {
    /** The post cards among [cards], in their order — the stage's clips, the thread's lookups. */
    val posts: List<PostView> get() = cards.mapNotNull { (it as? FeedCard.Post)?.post }
}

/**
 * THE RANKED FEED (ranked-feed-api packet, RF-5; the feed/card rework's
 * FC-1/FC-2): one `feedRanking` per open, per pull, and per Done that changes
 * what the ranker computes; the device derives everything else from the held
 * answer (CD-1).
 *
 * - **The pod orders, the device places and cuts.** Ranked is the
 *   answer's own order, Newest its second permutation, the settling rows
 *   stand where the pod wove them, the people and Still-settling cuts
 *   delete rows, and the seen rows stand under `feed.seenSeparator` —
 *   none of it re-orders a row (CD-7, CD-8, CD-10, CD-11, PR-80).
 *   Nothing here scores or compares (PR-9/PR-10).
 * - **The post-rank predicates cut at hydration** (CD-4, [admits]): forms,
 *   Sensitive and Removed read the hydrated card, so a card they cut is
 *   never handed to the screen — and the held pages are cut again when the
 *   feed comes back into view ([onShown]).
 * - **A local re-derive is not a fetch.** A Done that changes only
 *   device-side axes re-derives from the held answer: no call, no new pin.
 * - **Seen is read from the device's record fresh at every derive**, and
 *   the derived list is frozen between derives: scrolling never moves the
 *   rows under the reader, nor the separator (W-6; FeedSeenTail.md).
 * - **Every feed opens with the reader's saved default** (SettingsReading.md),
 *   read from the device before the first ranking.
 * - **Staleness (PR-55).** The ranking is fetched when this ViewModel is
 *   created — a cold start always refetches — and otherwise only when the
 *   reader pulls. Nothing here watches the app's lifecycle: a return from
 *   the background shows the feed exactly as it was left, however long
 *   the absence.
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
    private val readerDefaults: ReaderDefaults,
    private val topics: HeldTopicsRepository,
    private val removedMarks: RemovedMarks,
    private val committed: CommittedFeedFilter,
) : ViewModel() {

    /** Whether the reader's hidden set takes [card] out of the feed (hidden-actors §4.3). */
    private fun visible(card: FeedCard): Boolean = !hidden.view.value.hides(card.authorId, card.id)

    private val _state = MutableStateFlow(FeedUiState())
    val state = _state.asStateFlow()

    /**
     * The cards hydrated since the last fetch, by id: a re-derive that brings
     * back a row already read shows it without reading it again. Held uncut —
     * the predicates cut what is handed to the screen, never this.
     */
    private val hydrated = HashMap<String, FeedCard>()

    /** How far into [FeedUiState.rows] the cards reach. */
    private var cursor = 0

    /** The fetch or derive in flight; a newer one supersedes it. */
    private var composing: Job? = null

    /** The reader's default has been read: no ranking leaves before it (every feed opens with it). */
    private val opened = CompletableDeferred<Unit>()

    /** What the feed's cards tell the seen tracker; the tail never reports (FeedSeenTail.md). */
    val seenCards = FeedSeenCards(seenTracker) { _state.value.seenTail }

    /** What every card's share hands over: the thing's own web address. */
    val shares = FeedShares(webOrigin)

    /** A reader chose to look at a veiled body, as it stands right now. */
    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    init {
        // A FEED OPENS WITH THE FILTER ITS LAST DONE COMMITTED ON THIS DEVICE,
        // else with the reader's saved default (FeedSheet.md, SettingsReading.md;
        // round 25) — then the cold-start law (PR-55 (i)): a fresh process ranks afresh.
        viewModelScope.launch {
            val default = readerDefaults.now()
            val opening = committed.now() ?: default
            _state.update { it.copy(filter = opening, readerDefault = default) }
            opened.complete(Unit)
        }
        refresh()
        // The default stays current as Settings saves it: the trigger speaks
        // deviations from it and Reset stages it. The filter in force is not
        // touched — the list on screen keeps the filter it was derived under.
        viewModelScope.launch {
            readerDefaults.current.collect { default -> _state.update { it.copy(readerDefault = default) } }
        }
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
                val held = hydrated[update.nodeId] as? FeedCard.Post
                if (held != null) hydrated[update.nodeId] = FeedCard.Post(landed(held.post))
                _state.update { it.copy(cards = it.cards.withLanding(update.nodeId, landed)) }
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
            opened.await()
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
                    if (ranked.value.resolved) _state.update { it.copy(borrowedHandle = ranked.value.borrowedHandle) }
                    install(ranked.value.ranking)
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
        // IT LASTS ON THIS DEVICE (round 25): through a reload, a restart and a
        // cold launch, and never as the reader's saved default.
        viewModelScope.launch { committed.commit(staged) }
        when (change) {
            FilterChange.FETCH -> refresh()
            FilterChange.DERIVE -> rederive()
            FilterChange.NONE -> Unit
        }
    }

    /**
     * FEEDNOTHING'S WAY BACK (FeedNothing.md:7): the filter returns to its
     * default — the reader's — and the feed shows its default view.
     */
    fun showPostsAgain() {
        applyFilter(_state.value.readerDefault)
        // Back on the default, nothing committed stands: the feed follows the
        // saved default again as Settings changes it.
        viewModelScope.launch { committed.forget() }
    }

    /**
     * THE SHEET OPENED: the topics held for are read at each opening, so one
     * the reader took up elsewhere is there. A borrowed view's are the
     * borrowed account's, which no read serves (`heldTopics` is the viewer's
     * own), so the section stands only on the reader's own feed; a read that
     * fails stands no section rather than a stale one.
     */
    fun onSheetOpened() {
        if (_state.value.borrowedHandle != null) {
            _state.update { it.copy(heldTopics = emptyList()) }
            return
        }
        viewModelScope.launch {
            val read = topics.heldFor()
            _state.update { it.copy(heldTopics = (read as? Outcome.Success)?.value.orEmpty()) }
        }
    }

    /**
     * THE FEED IS BACK IN VIEW — a return from the detail, a profile, the
     * composer. Its pages are the ones it held, so a removal taken meanwhile
     * on another surface reached [RemovedMarks], not them: they come back
     * wearing it, RE-CUT by the predicates under the filter they were made
     * under (CD-4) — a post removed meanwhile leaves a feed whose Removed is
     * off and stands as its mark in one whose Removed is on. Deleting a row
     * never moves the others (FP-1). While the feed stays in view, a removal
     * taken from its own ⋮ stands as its mark in place (RM-G9).
     */
    fun onShown() {
        val marks = removedMarks.marks.value
        if (marks.isEmpty()) return
        _state.update { s ->
            val recut = s.cards.map { it.marked(marks) }.filter { s.filter.admits(it) }
            if (recut == s.cards) s else s.copy(cards = recut)
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
        val derived = ranking.derive(filter, seenRecord.seenIds())
        val rows = derived.rows
        val cut = windowCut(filter, removedMarks, ::visible)
        when (val first = feed.hydrate(rows, from = 0, hydrated, cut)) {
            is Outcome.Success -> {
                val (cards, next) = first.value
                cursor = next
                // What the reader can see is what the detail may open
                // from (HT-10).
                seen.saw(cards.posts())
                _state.update {
                    it.copy(
                        loading = false,
                        transportFault = null,
                        ranking = ranking,
                        rows = rows,
                        seenTail = derived.tailIds,
                        cards = cards,
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
        val cut = windowCut(s.filter, removedMarks, ::visible)
        viewModelScope.launch {
            val outcome = feed.hydrate(rows, from, hydrated, cut)
            // A derive that replaced the list meanwhile owns the cards now.
            if (_state.value.rows !== rows) {
                _state.update { it.copy(loadingMore = false) }
                return@launch
            }
            when (outcome) {
                is Outcome.Success -> {
                    val (cards, next) = outcome.value
                    cursor = next
                    seen.saw(cards.posts())
                    _state.update {
                        it.copy(
                            loadingMore = false,
                            transportFault = null,
                            cards = it.cards.appendPage(cards) { card -> card.id },
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
 * A ranking, and whose view it was ranked from — [resolved] false where no
 * view was asked for (every kind off), so the borrowed name stands as it was.
 */
private data class Ranked(val ranking: FeedRanking, val resolved: Boolean, val borrowedHandle: String?)

/**
 * The ranking for [filter]'s pod-side axes, of the view [viewer] resolves
 * to; the empty answer where nothing would rank.
 */
private suspend fun FeedRepository.rank(viewer: FeedViewer, filter: FeedFilter): Outcome<Ranked> {
    // Every kind off: the empty state, and the client never asks
    // (FeedNothing.md:3-5).
    if (filter.kinds.isEmpty()) return Outcome.Success(Ranked(FeedRanking.EMPTY, resolved = false, null))
    return when (val who = viewer.view()) {
        is Outcome.Success -> {
            val view = who.value ?: return Outcome.Success(Ranked(FeedRanking.EMPTY, resolved = true, null))
            when (val answer = ranking(view.viewer, filter.rankArgs)) {
                is Outcome.Success -> {
                    Outcome.Success(Ranked(answer.value ?: FeedRanking.EMPTY, resolved = true, view.borrowedHandle))
                }
                is Outcome.Refused -> answer
                is Outcome.Failed -> answer
            }
        }
        is Outcome.Refused -> who
        is Outcome.Failed -> who
    }
}

/** What a window hands the screen under [filter]: the card as this device knows it now, the filter's to admit. */
private fun windowCut(filter: FeedFilter, marks: RemovedMarks, visible: (FeedCard) -> Boolean) = WindowCut(
    current = { card -> card.marked(marks.marks.value) },
    admits = { card -> filter.admits(card) },
    visible = visible,
)

/**
 * How a window hands its cards over: [current] the card as this device knows
 * it now, [admits] the filter's post-rank predicates (CD-4), [visible] the
 * hidden set's — a hidden card rides along (Undo puts it back where it
 * stood) but never ends the fill.
 */
private class WindowCut(
    val current: (FeedCard) -> FeedCard,
    val admits: (FeedCard) -> Boolean,
    val visible: (FeedCard) -> Boolean,
)

/**
 * Hydrates [rows] from [from] a window at a time, until a window yields a
 * card the filter admits and the reader has not hidden, or the list ends
 * (the fill rule, §5.1; hidden-actors §4.4 "over-fetch to fill"): a window of
 * expired, cut or hidden people's rows loads the next rather than leaving the
 * reader at a dead end. Each window's ids split by the kind the ranking
 * already named: the posts ride `FeedWindow`, the other kinds `FeedCards`, a
 * page of [MAX_CARDS_WINDOW] at a time. Rows already in [hydrated] — read
 * since the last fetch — are not read again; what is read joins it. Returns
 * the cards, in the list's order, and where the next window starts.
 */
private suspend fun FeedRepository.hydrate(
    rows: List<FeedRow>,
    from: Int,
    hydrated: MutableMap<String, FeedCard>,
    cut: WindowCut,
): Outcome<Pair<List<FeedCard>, Int>> {
    var at = from
    val cards = mutableListOf<FeedCard>()
    while (at < rows.size && cards.none(cut.visible)) {
        val window = rows.subList(at, minOf(at + FEED_PAGE_SIZE, rows.size))
        val unread = window.filterNot { it.targetId in hydrated }
        val (posts, others) = unread.partition { it.kind == FeedKind.POST }
        if (posts.isNotEmpty()) {
            when (val read = window(posts.map { it.targetId })) {
                is Outcome.Success -> read.value.forEach { hydrated[it.id] = FeedCard.Post(it) }
                is Outcome.Refused -> return read
                is Outcome.Failed -> return read
            }
        }
        for (page in others.map { it.targetId }.chunked(MAX_CARDS_WINDOW)) {
            when (val read = cards(page)) {
                is Outcome.Success -> read.value.forEach { hydrated[it.id] = it }
                is Outcome.Refused -> return read
                is Outcome.Failed -> return read
            }
        }
        cards += window.mapNotNull { row -> hydrated[row.targetId]?.let(cut.current)?.takeIf(cut.admits) }
        at += window.size
    }
    return Outcome.Success(cards to at)
}

private fun List<FeedCard>.posts(): List<PostView> = mapNotNull { (it as? FeedCard.Post)?.post }

/** The held card keeps its place; only its own state moves. */
private fun List<FeedCard>.withLanding(id: String, change: (PostView) -> PostView): List<FeedCard> =
    if (none { it.id == id }) {
        this
    } else {
        map { if (it is FeedCard.Post && it.id == id) it.copy(post = change(it.post)) else it }
    }

/**
 * READING THE TAIL RECORDS NOTHING (FeedSeenTail.md): a card under the
 * separator is one the record already holds, and seeing it again is never
 * reported — the tracker hears only the rows above the line, as [tail] stands
 * at the last derive.
 */
class FeedSeenCards internal constructor(
    private val tracker: SeenTracker,
    private val tail: () -> Set<String>,
) {
    /** Cards that stood fully in the viewport, in the order they did. */
    fun onCardsSeen(nodeIds: List<String>) {
        val under = tail()
        tracker.saw(nodeIds.filterNot { it in under })
    }

    /** Tall cards with an edge on screen; each joins once both edges have been. */
    fun onCardEdgesSeen(sightings: List<EdgeSighting>) {
        val under = tail()
        sightings
            .filterNot { it.nodeId in under }
            .forEach { tracker.sawEdges(it.nodeId, top = it.top, bottom = it.bottom) }
    }

    /** The reading paused — the scroll rested or the reader left. */
    fun onSeenCheckpoint() = tracker.flush()
}

/** What the feed's cards hand the platform's share sheet: each thing's own web address, as History's cards do. */
class FeedShares internal constructor(private val webOrigin: String) {
    /** A post card's share. */
    fun post(postId: String): String = postShareUrl(webOrigin, postId)

    /** The other kinds' shares. */
    val urls = CardShareUrls(
        post = ::post,
        comment = { postId, commentId -> "$webOrigin/posts/$postId?comment=$commentId" },
        profile = { handle -> "$webOrigin/u/$handle" },
    )

    /** A tag card's share: the tag page's own address. */
    fun topic(name: String): String = "$webOrigin/topics/$name"
}
