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
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.feed.PeopleMark
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.cogra.domain.history.SeenRecord
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.history.StoredSeenRecord
import com.cogra.domain.testing.FakeSeenRecordStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingViewHistoryRepository
import com.cogra.domain.testing.ScriptedFeedRepository
import com.cogra.domain.testing.ScriptedSeenHistory
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.entry
import com.cogra.domain.testing.rankingOf
import com.cogra.domain.testing.settling
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import java.io.IOException
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

    /** The process's record and tracker — built lazily, so a test can script the store first. */
    private val seenRecord by lazy { SeenRecord(records, server, session, appScope) }
    private val seenTracker by lazy { SeenTracker(history, session, appScope, seenRecord) }

    private fun viewModel() =
        FeedViewModel(feed, FeedViewer(account, session), seenRecord, landings, reveals, seen, WEB_ORIGIN, seenTracker)

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
        vm.applyFilter(vm.state.value.filter.copy(topic = "h1"))
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
        vm.applyFilter(FeedFilter(topic = "h1", order = FeedOrder.NEWEST))
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

    // ── SEEN (CD-10; PR-48, PR-49, PR-51) ────────────────────────────────

    /**
     * jakob's scenario (PR-48): fetch, scroll Ranked until rows are reported
     * seen, switch to Newest with a local Done — none of the newly seen rows
     * is in the Newest list, and no call was made.
     */
    @Test
    fun aSwitchToNewestNeverShowsWhatRankedScrollingMadeSeen() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("a", "b", "c", "d"))
        val vm = viewModel()
        settle()

        vm.onCardsSeen(listOf("a", "b"))
        settle()
        vm.applyFilter(FeedFilter(order = FeedOrder.NEWEST))
        settle()

        assertThat(vm.ids()).containsExactly("d", "c").inOrder()
        assertThat(feed.rankings).hasSize(1)
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

    @Test
    fun theSeenCutReadsTheDevicesRecordFreshAtEveryDerive() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("a"), watermark = null)
        feed.answer = Outcome.Success(rankingOf("a", "b", "c"))
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("b", "c").inOrder()

        vm.onCardsSeen(listOf("b"))
        settle()
        vm.refresh()
        settle()

        assertThat(vm.ids()).containsExactly("c")
    }

    @Test
    fun showSeenOnKeepsSeenRows() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("a"), watermark = null)
        feed.answer = Outcome.Success(rankingOf("a", "b"))
        val vm = viewModel()
        settle()

        vm.applyFilter(FeedFilter(showSeen = true))
        settle()

        assertThat(vm.ids()).containsExactly("a", "b").inOrder()
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

    /** The record is the READER's: under a borrowed view the reader's own seeing is cut. */
    @Test
    fun aBorrowingReaderCutsTheirOwnSeeingFromTheLendersRanking() = runTest(dispatcher) {
        records.records["u1"] = StoredSeenRecord(setOf("b"), watermark = null)
        records.records["mira-id"] = StoredSeenRecord(setOf("a"), watermark = null)
        account.lender = Outcome.Success(ActorRef("mira-id", "mira"))
        feed.answer = Outcome.Success(rankingOf("a", "b", "c"))
        val vm = viewModel()
        settle()

        assertThat(vm.ids()).containsExactly("a", "c").inOrder()
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
        feed.answer = Outcome.Success(rankingOf(*ids.toTypedArray()))
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
        unrenderable.answer = Outcome.Success(rankingOf(*(topics + "p1").toTypedArray()))
        val vm = FeedViewModel(
            unrenderable,
            FeedViewer(account, session),
            seenRecord,
            landings,
            reveals,
            seen,
            WEB_ORIGIN,
            seenTracker,
        )
        settle()

        assertThat(vm.ids()).containsExactly("p1")
        assertThat(unrenderable.windows).hasSize(2)
    }

    @Test
    fun everyWindowTheFeedShowsIsHeldForTheDetailToOpenFrom() = runTest(dispatcher) {
        val ids = (1..21).map { "p$it" }
        feed.answer = Outcome.Success(rankingOf(*ids.toTypedArray()))
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
        feed.answer = Outcome.Success(rankingOf(*ids.toTypedArray()))
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
