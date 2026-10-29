// The ranked feed's ViewModel half of ranked-feed-api §14.3 (RF-5): one
// ranking per open/pull/kinds-or-topic Done, every other change a local
// re-derive, the seen cut read fresh from the device's record at each
// derive and never under a scroll, and the staleness law (PR-55). The
// packet's underscore names render here in this module's camelCase idiom
// (`a_switch_to_newest_…` → `aSwitchToNewest…`).

package com.cogra.feature.content

import com.cogra.core.designsystem.EdgeSighting
import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.SeenPosts
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.content.isRevealed
import com.cogra.domain.feed.CommittedFeedFilter
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.feed.PeopleMark
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.cogra.domain.feed.ReaderDefaults
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.history.SeenRecord
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.history.StoredSeenRecord
import com.cogra.domain.removal.RemovedMarks
import com.cogra.domain.testing.FakeSeenRecordStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.InMemoryCommittedFilterStore
import com.cogra.domain.testing.InMemoryReaderDefaultStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.cogra.domain.testing.RecordingViewHistoryRepository
import com.cogra.domain.testing.ScriptedFeedRepository
import com.cogra.domain.testing.ScriptedHeldTopicsRepository
import com.cogra.domain.testing.ScriptedSeenHistory
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.entry
import com.cogra.domain.testing.rankingOf
import com.cogra.domain.testing.settling
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class FeedViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val appScope = TestScope(dispatcher)
    private val landings = LandingSignal()
    private val reveals = SensitiveReveals()
    private val seen = SeenPosts()
    private val history = RecordingViewHistoryRepository()
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }
    private val server = ScriptedSeenHistory().apply { reader = "u1" }
    private val records = FakeSeenRecordStore()

    /** Whose view the reader borrows; null once their own view exists. */
    private val account = object : ThrowingAccountRepository() {
        var lender: Outcome<ActorRef?> = Outcome.Success(null)

        override suspend fun borrowedView(): Outcome<ActorRef?> = lender
    }

    private val feed = ScriptedFeedRepository()

    /** The reader defaults this device holds, per account; none unless a test saves one. */
    private val defaults = InMemoryReaderDefaultStore()
    private val heldTopics = ScriptedHeldTopicsRepository()
    private val removedMarks = RemovedMarks()
    private val committedFilters = InMemoryCommittedFilterStore()

    /** The process's record and tracker — built lazily, so a test can script the store first. */
    private val seenRecord by lazy { SeenRecord(records, server, session, appScope) }
    private val seenTracker by lazy { SeenTracker(history, session, appScope, seenRecord) }

    /** The reader's hidden set; empty unless a test scripts one. */
    private val hiddenRepository = RecordingHiddenRepository()
    private val hidden by lazy { HiddenSet(hiddenRepository, session, appScope) }

    private fun viewModel() = FeedViewModel(
        feed,
        FeedViewer(account, session),
        seenRecord,
        landings,
        reveals,
        seen,
        WEB_ORIGIN,
        seenTracker,
        hidden,
        ReaderDefaults(defaults, session),
        heldTopics,
        removedMarks,
        CommittedFeedFilter(committedFilters, session),
    )

    private fun FeedViewModel.ids() = state.value.posts.map { it.id }

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ── THE SNAPSHOT (CD-1) ──────────────────────────────────────────────

    @Test
    fun theFeedRanksOncePerOpen() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2"))
        val vm = viewModel()
        settle()

        assertThat(feed.rankings).containsExactly("u1" to FeedRankArgs(setOf(FeedKind.POST), null))
        assertThat(vm.state.value.loading).isFalse()
        assertThat(vm.ids()).containsExactly("p1", "p2").inOrder()
    }

    /**
     * Hidden-actors §4.4 "over-fetch to fill": a window of nothing but a
     * hidden person's posts reads the next window rather than leaving the
     * reader at a dead end. The hidden rows ride along — the screen leaves
     * them out, and Undo puts them back where they stood.
     */
    @Test
    fun aPageOfOnlyHiddenPostsLoadsTheNext() = runTest(dispatcher) {
        val hiddenIds = List(FEED_PAGE_SIZE) { "h$it" }
        hiddenIds.forEach { feed.posts[it] = testPost(it, author = ActorRef("ada-id", "ada")) }
        feed.answer = Outcome.Success(rankingOf(hiddenIds + "p-after"))
        hiddenRepository.served = Outcome.Success(listOf(hiddenEntry("ada-id", "ada")))
        val vm = viewModel()
        settle()

        assertThat(feed.windows.map { it.size }).containsExactly(FEED_PAGE_SIZE, 1).inOrder()
        assertThat(vm.ids()).containsExactlyElementsIn(hiddenIds + "p-after").inOrder()
        assertThat(vm.state.value.hasNextPage).isFalse()
    }

    /** Hidden-actors §5.1: the feed never draws a page before the hidden set has been read. */
    @Test
    fun theFeedNeverRendersBeforeTheHiddenSetIsRead() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        hiddenRepository.served = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        settle()

        assertThat(vm.ids()).isEmpty()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(hiddenRepository.reads).isEqualTo(1)
    }

    /** Hidden-actors §5.1: every pull reads the set again, so a hide made elsewhere reaches this feed. */
    @Test
    fun theHiddenSetRefetchesOnFeedOpenAndPull() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        vm.refresh()
        settle()

        assertThat(hiddenRepository.reads).isEqualTo(2)
    }

    private fun hiddenEntry(id: String, handle: String) = HiddenEntry(
        HiddenPerson(id, handle, displayName = null, avatarUrl = null, redacted = false),
        java.time.Instant.parse("2026-10-01T00:00:00Z"),
    )

    /** PR-55 (i): a fully-closed, reopened app ranks afresh — a new process is a new ViewModel. */
    @Test
    fun aColdStartAlwaysRefetchesTheRanking() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        viewModel()
        settle()

        feed.answer = Outcome.Success(rankingOf("p2", "p1"))
        val reopened = viewModel()
        settle()

        assertThat(feed.rankings).hasSize(2)
        assertThat(reopened.ids()).containsExactly("p2", "p1").inOrder()
    }

    /**
     * PR-55 (ii): the app going to the background — whose one observable
     * act is the seen tracker's checkpoint — and hours away never refetch:
     * the reader returns to the feed exactly as it was left.
     */
    @Test
    fun aReturnFromBackgroundKeepsTheHeldFeedUnfetched() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2"))
        val vm = viewModel()
        settle()
        val held = vm.state.value

        vm.onSeenCheckpoint()
        advanceTimeBy(HOURS_AWAY)
        settle()

        assertThat(feed.rankings).hasSize(1)
        assertThat(vm.state.value.ranking).isSameInstanceAs(held.ranking)
        assertThat(vm.ids()).containsExactly("p1", "p2").inOrder()
    }

    @Test
    fun anExplicitRefreshRanksOnce() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()

        feed.answer = Outcome.Success(rankingOf("p3", "p1"))
        vm.refresh()
        settle()

        assertThat(feed.rankings).hasSize(2)
        assertThat(vm.ids()).containsExactly("p3", "p1").inOrder()
    }

    @Test
    fun doneWithAKindsOrTopicChangeRanksOnce() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()

        vm.applyFilter(FeedFilter(kinds = setOf(FeedKind.POST, FeedKind.COMMENT)))
        settle()
        vm.applyFilter(vm.state.value.filter.copy(topic = FeedTopic("h1", "saltmaps")))
        settle()

        assertThat(feed.rankings.map { it.second }).containsExactly(
            FeedRankArgs(setOf(FeedKind.POST), null),
            FeedRankArgs(setOf(FeedKind.POST, FeedKind.COMMENT), null),
            FeedRankArgs(setOf(FeedKind.POST, FeedKind.COMMENT), "h1"),
        ).inOrder()
    }

    @Test
    fun doneWithOnlyDeviceSideChangesNeverRanksAndRederives() = runTest(dispatcher) {
        feed.answer = Outcome.Success(marked())
        val vm = viewModel()
        settle()

        vm.applyFilter(FeedFilter(people = PeopleScope.YOUR_PEOPLE, peopleSign = PeopleSign.FOR, showSeen = true))
        settle()

        assertThat(feed.rankings).hasSize(1)
        assertThat(vm.ids()).containsExactly("friend")
    }

    @Test
    fun aMixedDoneRanksOnceThenDerives() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2"))
        val vm = viewModel()
        settle()

        feed.answer = Outcome.Success(rankingOf("t1", "t2", "t3"))
        vm.applyFilter(FeedFilter(topic = FeedTopic("h1", "saltmaps"), order = FeedOrder.NEWEST))
        settle()

        assertThat(feed.rankings).hasSize(2)
        // The new answer, in its NEWEST permutation.
        assertThat(vm.ids()).containsExactly("t3", "t2", "t1").inOrder()
    }

    @Test
    fun aLocalRederiveKeepsThePinAndTheLookupSource() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2", asOfEpoch = 41))
        val vm = viewModel()
        settle()
        val held = vm.state.value.ranking

        vm.applyFilter(FeedFilter(order = FeedOrder.NEWEST, stillSettling = false))
        settle()

        assertThat(vm.state.value.ranking).isSameInstanceAs(held)
        assertThat(vm.state.value.ranking?.asOfEpoch).isEqualTo(41)
        assertThat(feed.rankings).hasSize(1)
    }

    @Test
    fun doneWithoutChangesNeverRanks() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        val windows = feed.windows.size

        vm.applyFilter(FeedFilter())
        settle()

        assertThat(feed.rankings).hasSize(1)
        assertThat(feed.windows).hasSize(windows)
    }

    // ── ORDER, PEOPLE, SETTLING (CD-7, CD-8, CD-11) ──────────────────────

    @Test
    fun anOrderSwitchNeverFetches() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2", "p3"))
        val vm = viewModel()
        settle()

        vm.applyFilter(FeedFilter(order = FeedOrder.NEWEST))
        settle()

        assertThat(feed.rankings).hasSize(1)
        assertThat(vm.ids()).containsExactly("p3", "p2", "p1").inOrder()
        // Every row was already read: re-placing them reads nothing again.
        assertThat(feed.windows).hasSize(1)
    }

    @Test
    fun aPeopleChangeNeverFetches() = runTest(dispatcher) {
        feed.answer = Outcome.Success(marked())
        val vm = viewModel()
        settle()

        vm.applyFilter(FeedFilter(people = PeopleScope.YOUR_PEOPLE))
        settle()

        assertThat(feed.rankings).hasSize(1)
        assertThat(vm.ids()).containsExactly("friend", "foe").inOrder()
    }

    @Test
    fun stillSettlingOffDropsSettlingRowsLocallyWithoutAFetch() = runTest(dispatcher) {
        feed.answer = Outcome.Success(
            FeedRanking(
                asOfEpoch = 3,
                entries = listOf(entry("p1", newestIndex = 0), entry("p2", newestIndex = 1)),
                settling = listOf(settling("s1", ranked = 1, newest = 0)),
            ),
        )
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("p1", "s1", "p2").inOrder()

        vm.applyFilter(FeedFilter(stillSettling = false))
        settle()

        assertThat(vm.ids()).containsExactly("p1", "p2").inOrder()
        assertThat(feed.rankings).hasSize(1)
    }

    @Test
    fun everyKindOffShowsTheEmptyStateAndNeverRanks() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()

        vm.applyFilter(FeedFilter(kinds = emptySet()))
        settle()

        assertThat(feed.rankings).hasSize(1)
        assertThat(vm.state.value.posts).isEmpty()
        assertThat(vm.state.value.loading).isFalse()
        assertThat(vm.state.value.transportFault).isNull()
    }

    @Test
    fun aViewerWithNoRankableActorShowsTheEmptyState() = runTest(dispatcher) {
        feed.answer = Outcome.Success(null)
        val vm = viewModel()
        settle()

        assertThat(vm.state.value.posts).isEmpty()
        assertThat(vm.state.value.loading).isFalse()
        assertThat(vm.state.value.transportFault).isNull()
    }

    // ── SEEN (CD-10; PR-48, PR-49, PR-51, PR-80) ─────────────────────────

    /**
     * jakob's scenario (PR-48), under the seen tail (PR-80): fetch, scroll
     * Ranked until rows are reported seen, switch to Newest with a local
     * Done — the newly seen rows stand under the separator, by time, and no
     * call was made.
     */
    @Test
    fun aSwitchToNewestStandsWhatRankedScrollingMadeSeenUnderTheSeparator() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("a", "b", "c", "d"))
        val vm = viewModel()
        settle()

        vm.onCardsSeen(listOf("a", "b"))
        settle()
        vm.applyFilter(FeedFilter(order = FeedOrder.NEWEST))
        settle()

        assertThat(vm.ids()).containsExactly("d", "c", "b", "a").inOrder()
        assertThat(vm.state.value.seenTail).containsExactly("a", "b")
        assertThat(feed.rankings).hasSize(1)
    }

    /**
     * PR-80's named device test (FeedSeenTail.md "WHEN the reader scrolls or
     * reads the rows under feed.seenSeparator -> NEVER anything is
     * recorded"): a tail card that stands fully in view, or edge by edge,
     * is never handed to the tracker — only the row above the line goes out.
     */
    @Test
    fun readingTheTailRecordsNothing() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("a", "t"), watermark = null)
        feed.answer = Outcome.Success(rankingOf("a", "b", "t"))
        val vm = viewModel()
        settle()
        assertThat(vm.state.value.seenTail).containsExactly("a", "t")

        vm.onCardsSeen(listOf("b", "a"))
        vm.onCardEdgesSeen(listOf(EdgeSighting("t", top = true, bottom = false)))
        vm.onCardEdgesSeen(listOf(EdgeSighting("t", top = false, bottom = true)))
        vm.onSeenCheckpoint()
        settle()

        assertThat(history.calls).containsExactly(listOf("b"))
    }

    /**
     * FeedSeenTail.md: nothing unseen, seen rows admitted — the feed loads
     * the seen rows, all of them under the separator, and the empty state
     * never stands. The screen half is
     * `FeedSeenTailTest.nothing_unseen_opens_the_feed_at_the_separator`.
     */
    @Test
    fun nothingUnseenLoadsTheSeenRowsAllUnderTheSeparator() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("a", "b"), watermark = null)
        feed.answer = Outcome.Success(rankingOf("a", "b"))
        val vm = viewModel()
        settle()

        assertThat(vm.ids()).containsExactly("a", "b").inOrder()
        assertThat(vm.state.value.seenTail).containsExactly("a", "b")
    }

    /** W-6: scrolling never deletes the rows under the reader. */
    @Test
    fun aRowSeenWhileHeldStaysUntilTheNextDerive() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("a", "b", "c"))
        val vm = viewModel()
        settle()

        vm.onCardsSeen(listOf("a"))
        vm.onSeenCheckpoint()
        settle()

        assertThat(vm.ids()).containsExactly("a", "b", "c").inOrder()
    }

    /**
     * The record is read fresh at every derive, and a refresh lands what is
     * still unseen above the separator — a row seen since joins the tail,
     * in the feed's own order (FeedSeenTail.md, the refresh law).
     */
    @Test
    fun theSeenPartitionReadsTheDevicesRecordFreshAtEveryDerive() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("a"), watermark = null)
        feed.answer = Outcome.Success(rankingOf("a", "b", "c"))
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("b", "c", "a").inOrder()
        assertThat(vm.state.value.seenTail).containsExactly("a")

        vm.onCardsSeen(listOf("b"))
        settle()
        // W-6: the row seen on screen does not move, nor does the line.
        assertThat(vm.ids()).containsExactly("b", "c", "a").inOrder()
        vm.refresh()
        settle()

        assertThat(vm.ids()).containsExactly("c", "a", "b").inOrder()
        assertThat(vm.state.value.seenTail).containsExactly("a", "b")
    }

    /**
     * PR-83's named device test (jakob, seam 199: "seen list is
     * placement-only"): Show what you've already seen is a pure device
     * re-partition of the held answer — never a fetch, never a re-sort. The
     * held order m z a (newest z a m) disagrees with every sort the device
     * could reach for — by id a m z, by score z a m — and each toggle reads
     * that held permutation, split or whole.
     */
    @Test
    fun togglingShowSeenRePartitionsWithoutAFetchOrASort() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("z"), watermark = null)
        feed.answer = Outcome.Success(
            FeedRanking(
                asOfEpoch = 7,
                entries = listOf(
                    entry("m", newestIndex = 2, score = 0.1),
                    entry("z", newestIndex = 0, score = 0.9),
                    entry("a", newestIndex = 1, score = 0.5),
                ),
                settling = emptyList(),
            ),
        )
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("m", "a", "z").inOrder()
        assertThat(vm.state.value.seenTail).containsExactly("z")

        vm.applyFilter(FeedFilter(showSeen = true))
        settle()
        assertThat(vm.ids()).containsExactly("m", "z", "a").inOrder()
        assertThat(vm.state.value.seenTail).isEmpty()

        vm.applyFilter(FeedFilter(showSeen = false))
        settle()
        assertThat(vm.ids()).containsExactly("m", "a", "z").inOrder()
        assertThat(vm.state.value.seenTail).containsExactly("z")

        vm.applyFilter(FeedFilter(order = FeedOrder.NEWEST, showSeen = true))
        settle()
        assertThat(vm.ids()).containsExactly("z", "a", "m").inOrder()
        vm.applyFilter(FeedFilter(order = FeedOrder.NEWEST))
        settle()
        assertThat(vm.ids()).containsExactly("a", "m", "z").inOrder()

        // One ranking, the open's — and one window: the toggles re-read the
        // rows already hydrated and asked the wire for nothing.
        assertThat(feed.rankings).hasSize(1)
        assertThat(feed.windows).hasSize(1)
    }

    /** Toggle on: one list, the seen rows ranked in among the rest, no separator (FeedSeenTail.md). */
    @Test
    fun showSeenOnStandsOneListWithNoSeparator() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("a"), watermark = null)
        feed.answer = Outcome.Success(rankingOf("a", "b"))
        val vm = viewModel()
        settle()

        vm.applyFilter(FeedFilter(showSeen = true))
        settle()

        assertThat(vm.ids()).containsExactly("a", "b").inOrder()
        assertThat(vm.state.value.seenTail).isEmpty()
        assertThat(feed.rankings).hasSize(1)
    }

    @Test
    fun aSessionLessReaderCutsNothingForSeen() = runTest(dispatcher) {
        session.tokens.value = null
        server.reader = null
        account.lender = Outcome.Success(ActorRef("genesis-id", "genesis_mod"))
        feed.answer = Outcome.Success(rankingOf("a", "b"))
        val vm = viewModel()
        settle()

        vm.onCardsSeen(listOf("a"))
        settle()
        vm.applyFilter(FeedFilter(order = FeedOrder.NEWEST))
        settle()

        assertThat(feed.rankings.single().first).isEqualTo("genesis-id")
        assertThat(vm.ids()).containsExactly("b", "a").inOrder()
        assertThat(vm.state.value.seenTail).isEmpty()
    }

    // ── VIEWER (CD-5) ────────────────────────────────────────────────────

    @Test
    fun aBorrowingReaderRanksTheLendersView() = runTest(dispatcher) {
        account.lender = Outcome.Success(ActorRef("mira-id", "mira"))
        feed.answer = Outcome.Success(rankingOf("p1"))
        viewModel()
        settle()

        assertThat(feed.rankings.single().first).isEqualTo("mira-id")
    }

    /** The record is the READER's: under a borrowed view the reader's own seeing forms the tail. */
    @Test
    fun aBorrowingReadersOwnSeeingFormsTheTailOfTheLendersRanking() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("b"), watermark = null)
        records.records["mira-id"] = StoredSeenRecord(setOf("a"), watermark = null)
        account.lender = Outcome.Success(ActorRef("mira-id", "mira"))
        feed.answer = Outcome.Success(rankingOf("a", "b", "c"))
        val vm = viewModel()
        settle()

        assertThat(vm.ids()).containsExactly("a", "c", "b").inOrder()
        assertThat(vm.state.value.seenTail).containsExactly("b")
    }

    @Test
    fun theHandOverRanksTheOwnViewOnNextRefresh() = runTest(dispatcher) {
        account.lender = Outcome.Success(ActorRef("mira-id", "mira"))
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()

        account.lender = Outcome.Success(null)
        vm.refresh()
        settle()

        assertThat(feed.rankings.map { it.first }).containsExactly("mira-id", "u1").inOrder()
    }

    /** A ladder read that fails is the fetch's failure — never a guess at whose view to rank. */
    @Test
    fun aFailedViewerReadRanksNothing() = runTest(dispatcher) {
        account.lender = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        settle()

        assertThat(feed.rankings).isEmpty()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
    }

    // ── WINDOWS (CD-2) ───────────────────────────────────────────────────

    @Test
    fun theFeedHydratesByWindowsOfAtMost100() = runTest(dispatcher) {
        val ids = (1..45).map { "p$it" }
        feed.answer = Outcome.Success(rankingOf(ids))
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).isEqualTo(ids.take(FEED_PAGE_SIZE))
        assertThat(vm.state.value.hasNextPage).isTrue()

        vm.loadMore()
        settle()
        vm.loadMore()
        settle()

        assertThat(vm.ids()).isEqualTo(ids)
        assertThat(vm.state.value.hasNextPage).isFalse()
        assertThat(feed.windows.map { it.size }).containsExactly(20, 20, 5).inOrder()
        assertThat(feed.windows.flatten()).isEqualTo(ids)
    }

    @Test
    fun aWindowOfOnlyUnrenderableRowsLoadsTheNext() = runTest(dispatcher) {
        val topics = (1..FEED_PAGE_SIZE).map { "t$it" }
        val unrenderable = object : ScriptedFeedRepository() {
            override fun defaultPost(id: String): PostView? = if (id.startsWith("t")) null else testPost(id)
        }
        unrenderable.answer = Outcome.Success(rankingOf(topics + "p1"))
        val vm = FeedViewModel(
            unrenderable,
            FeedViewer(account, session),
            seenRecord,
            landings,
            reveals,
            seen,
            WEB_ORIGIN,
            seenTracker,
            hidden,
            ReaderDefaults(defaults, session),
            heldTopics,
            removedMarks,
            CommittedFeedFilter(committedFilters, session),
        )
        settle()

        assertThat(vm.ids()).containsExactly("p1")
        assertThat(unrenderable.windows).hasSize(2)
    }

    @Test
    fun everyWindowTheFeedShowsIsHeldForTheDetailToOpenFrom() = runTest(dispatcher) {
        val ids = (1..21).map { "p$it" }
        feed.answer = Outcome.Success(rankingOf(ids))
        val vm = viewModel()
        settle()
        assertThat(seen.lastSeen("p1")?.id).isEqualTo("p1")

        vm.loadMore()
        settle()
        assertThat(seen.lastSeen("p21")?.id).isEqualTo("p21")
    }

    @Test
    fun loadMoreWithoutANextPageIsANoOp() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()

        vm.loadMore()
        settle()

        assertThat(feed.windows).hasSize(1)
    }

    // ── FAULTS (§4.5) ────────────────────────────────────────────────────

    @Test
    fun aRankingFaultWithNothingLoadedShowsTheHouseLineAndRetry() = runTest(dispatcher) {
        feed.answer = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        settle()

        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(vm.state.value.posts).isEmpty()

        // Retry heals.
        feed.answer = Outcome.Success(rankingOf("p1"))
        vm.refresh()
        settle()
        assertThat(vm.state.value.transportFault).isNull()
        assertThat(vm.ids()).containsExactly("p1")
    }

    @Test
    fun aFailedRefreshKeepsTheHeldSnapshot() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        val held = vm.state.value.ranking

        feed.answer = Outcome.Failed(IOException("offline"))
        vm.refresh()
        // The fault reflects the last completed fetch: no flash while the
        // retry is in flight.
        assertThat(vm.state.value.loading).isTrue()
        settle()

        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(vm.state.value.ranking).isSameInstanceAs(held)
        assertThat(vm.ids()).containsExactly("p1")
    }

    @Test
    fun aFailedWindowFaultsAtTheAppendSlot() = runTest(dispatcher) {
        val ids = (1..25).map { "p$it" }
        feed.answer = Outcome.Success(rankingOf(ids))
        val vm = viewModel()
        settle()

        feed.windowAnswer = Outcome.Failed(IOException("offline"))
        vm.loadMore()
        settle()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.APPEND)
        assertThat(vm.state.value.posts).hasSize(FEED_PAGE_SIZE)
        assertThat(vm.state.value.hasNextPage).isTrue()

        feed.windowAnswer = null
        vm.loadMore()
        settle()
        assertThat(vm.state.value.transportFault).isNull()
        assertThat(vm.ids()).isEqualTo(ids)
    }

    // ── THE CARDS' OWN STATE ─────────────────────────────────────────────

    /**
     * The reveal set is one app-wide holder, so a choice the detail
     * screen recorded is already in the feed's state — the reader is
     * not asked twice about the same body (jakob 2026-08-31).
     */
    @Test
    fun aRevealMadeElsewhereReachesTheFeedsState() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        assertThat(vm.state.value.reveals).isEmpty()

        val mark = SensitiveMark(FieldStatus.SENSITIVE, FieldStatus.NORMAL, FieldStatus.NORMAL)
        reveals.reveal("p1", mark)
        settle()

        assertThat(vm.state.value.reveals.isRevealed("p1", mark)).isTrue()
    }

    // The reader opened the settling post and refreshed there until it
    // landed; the card they come back to already knows, in its place.
    @Test
    fun aFresherLandingReadClearsTheHeldCardsMarker() = runTest(dispatcher) {
        feed.posts["s1"] = testPost("s1", landing = Landing.Pending)
        feed.answer = Outcome.Success(
            FeedRanking(
                asOfEpoch = 3,
                entries = listOf(entry("p2", newestIndex = 0)),
                settling = listOf(settling("s1", ranked = 0, newest = 0)),
            ),
        )
        val vm = viewModel()
        settle()
        assertThat(vm.state.value.posts.first().landing.isPending).isTrue()

        landings.observed("s1", Landing.landed(5), includePending = true)
        settle()

        assertThat(vm.ids()).containsExactly("s1", "p2").inOrder()
        assertThat(vm.state.value.posts.first().landing).isEqualTo(Landing.landed(5))
        assertThat(feed.rankings).hasSize(1)

        // A landed-only read saw another version; it says nothing here.
        landings.observed("s1", Landing.Pending, includePending = false)
        settle()
        assertThat(vm.state.value.posts.first().landing).isEqualTo(Landing.landed(5))
    }

    // The screen decides what was seen; the feed hands it to the tracker
    // and sends it where the reading pauses — nothing before.
    @Test
    fun cardsTheFeedSawGoOutAtItsCheckpoint() = runTest(dispatcher) {
        val vm = viewModel()
        settle()

        vm.onCardsSeen(listOf("p1", "p2"))
        settle()
        assertThat(history.calls).isEmpty()

        vm.onSeenCheckpoint()
        settle()
        assertThat(history.calls).containsExactly(listOf("p1", "p2"))
    }

    @Test
    fun aTallPostTheFeedSawEdgeByEdgeGoesOutOnceBothEdgesCame() = runTest(dispatcher) {
        val vm = viewModel()
        settle()

        vm.onCardEdgesSeen(listOf(EdgeSighting("p9", top = true, bottom = false)))
        vm.onSeenCheckpoint()
        settle()
        assertThat(history.calls).isEmpty()

        vm.onCardEdgesSeen(listOf(EdgeSighting("p9", top = false, bottom = true)))
        vm.onSeenCheckpoint()
        settle()
        assertThat(history.calls).containsExactly(listOf("p9"))
    }

    /** friend (FOR), stranger (none), foe (AGAINST), in that ranked order. */
    private fun marked() = FeedRanking(
        asOfEpoch = 5,
        entries = listOf(
            entry("friend", newestIndex = 2, mark = PeopleMark.FOR),
            entry("stranger", newestIndex = 1),
            entry("foe", newestIndex = 0, mark = PeopleMark.AGAINST),
        ),
        settling = emptyList(),
    )
}

/** The build's web origin, as the share link is built from it. */
private const val WEB_ORIGIN = "https://cogra.example"

/** Hours in the background, in test-clock milliseconds. */
private const val HOURS_AWAY = 6 * 60 * 60 * 1000L
