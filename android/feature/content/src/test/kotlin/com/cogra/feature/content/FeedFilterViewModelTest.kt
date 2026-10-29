// The feed filter's ViewModel half (feed/card rework FC-1, FC-2's hydration),
// compiled from the sidecars: every feed opens with the reader's saved default
// (SettingsReading.md), the default stays current for the trigger, FeedNothing's
// way back (FeedNothing.md:7), the post-rank predicates on the hydrated card and
// on the pages the feed comes back to (CD-4), the other kinds through
// `FeedCards`, the held-for topics read at each opening (FeedSheet.md:29-35) and
// a borrowed view's name. Nothing here is sent: the default is the device's.

package com.cogra.feature.content

import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.content.SeenPosts
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.feed.CommittedFeedFilter
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedForm
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.FeedViewer
import com.cogra.domain.feed.ReaderDefaults
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.history.SeenRecord
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.history.TagCardTopic
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
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.cogra.domain.topics.HeldTopic
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class FeedFilterViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val appScope = TestScope(dispatcher)
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }
    private val server = ScriptedSeenHistory().apply { reader = "u1" }
    private val records = FakeSeenRecordStore()
    private val history = RecordingViewHistoryRepository()

    private val account = object : ThrowingAccountRepository() {
        var lender: Outcome<ActorRef?> = Outcome.Success(null)

        override suspend fun borrowedView(): Outcome<ActorRef?> = lender
    }

    private val feed = ScriptedFeedRepository()
    private val defaults = InMemoryReaderDefaultStore()
    private val heldTopics = ScriptedHeldTopicsRepository()
    private val removedMarks = RemovedMarks()
    private val committedFilters = InMemoryCommittedFilterStore()
    private val seenRecord by lazy { SeenRecord(records, server, session, appScope) }
    private val seenTracker by lazy { SeenTracker(history, session, appScope, seenRecord) }
    private val hidden by lazy { HiddenSet(RecordingHiddenRepository(), session, appScope) }

    private fun viewModel() = FeedViewModel(
        feed,
        FeedViewer(account, session),
        seenRecord,
        LandingSignal(),
        SensitiveReveals(),
        SeenPosts(),
        "https://cogra.example",
        seenTracker,
        hidden,
        ReaderDefaults(defaults, session),
        heldTopics,
        removedMarks,
        CommittedFeedFilter(committedFilters, session),
    )

    private fun FeedViewModel.ids() = state.value.cards.map { it.id }

    private fun settle() = dispatcher.scheduler.advanceUntilIdle()

    private val picture = MediaAssetView(
        id = "m1",
        url = "https://media/1.jpg",
        altText = null,
        status = FieldStatus.NORMAL,
        aspectRatio = 1f,
        mimeType = "image/jpeg",
    )
    private val clip = MediaAssetView(
        id = "m2",
        url = "https://media/2.mp4",
        altText = null,
        status = FieldStatus.NORMAL,
        aspectRatio = 1f,
        mimeType = "video/mp4",
    )
    private val removal = Removal(Instant.EPOCH, RemovalAgent.AUTHOR)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ── THE READER'S DEFAULT (SettingsReading.md) ────────────────────────

    @Test
    fun everyFeedOpensWithTheReadersSavedDefault() = runTest(dispatcher) {
        val own = FeedFilter.DEFAULT.copy(kinds = setOf(FeedKind.POST, FeedKind.COMMENT), order = FeedOrder.NEWEST)
        defaults.save("u1", own)
        feed.answer = Outcome.Success(rankingOf("p1", "p2"))
        val vm = viewModel()
        settle()

        assertThat(vm.state.value.filter).isEqualTo(own)
        assertThat(vm.state.value.readerDefault).isEqualTo(own)
        // The first ranking already asks the default's kinds — never CoGra's first.
        assertThat(feed.rankings.map { it.second })
            .containsExactly(FeedRankArgs(setOf(FeedKind.POST, FeedKind.COMMENT), null))
        // …and the list stands in its order: rankingOf's NEWEST is the reverse.
        assertThat(vm.ids()).containsExactly("p2", "p1").inOrder()
    }

    @Test
    fun aReaderWhoSetNoneOpensOnCoGrasDefault() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        assertThat(vm.state.value.filter).isEqualTo(FeedFilter.DEFAULT)
    }

    /** The trigger speaks deviations from the default as it stands; the list keeps the filter it was derived under. */
    @Test
    fun aDefaultSavedInSettingsReachesTheOpenFeedWithoutMovingIt() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        val newer = FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST)
        defaults.save("u1", newer)
        settle()

        assertThat(vm.state.value.readerDefault).isEqualTo(newer)
        assertThat(vm.state.value.filter).isEqualTo(FeedFilter.DEFAULT)
        assertThat(feed.rankings).hasSize(1)
    }

    // ── THE COMMITTED FILTER LASTS ON THIS DEVICE (FeedSheet.md, round 25) ──

    @Test
    fun aCommittedFilterLastsThroughAColdLaunchAndTheFeedOpensWithIt() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2"))
        val first = viewModel()
        settle()
        val done = FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST, topic = FeedTopic("t1", "saltmaps"))
        first.applyFilter(done)
        settle()
        assertThat(committedFilters.stored).containsExactly("u1", done)

        // A fresh process: a new ViewModel over the same device.
        val relaunched = viewModel()
        settle()
        assertThat(relaunched.state.value.filter).isEqualTo(done)
        assertThat(feed.rankings.last().second).isEqualTo(FeedRankArgs(setOf(FeedKind.POST), "t1"))
    }

    @Test
    fun aCommittedFilterNeverChangesTheSavedDefault() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        vm.applyFilter(FeedFilter.DEFAULT.copy(showSeen = true))
        settle()
        assertThat(defaults.saved.value).isEmpty()
        assertThat(vm.state.value.readerDefault).isEqualTo(FeedFilter.DEFAULT)
    }

    @Test
    fun showPostsAgainLeavesNoCommittedFilterStanding() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        vm.applyFilter(FeedFilter.DEFAULT.copy(kinds = emptySet()))
        settle()
        vm.showPostsAgain()
        settle()
        assertThat(committedFilters.stored).isEmpty()
    }

    // ── FEEDNOTHING (FeedNothing.md) ─────────────────────────────────────

    @Test
    fun showPostsAgainReturnsTheFilterToTheReadersDefault() = runTest(dispatcher) {
        val own = FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST)
        defaults.save("u1", own)
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        vm.applyFilter(own.copy(kinds = emptySet()))
        settle()
        assertThat(vm.state.value.cards).isEmpty()
        assertThat(feed.rankings).hasSize(1)

        vm.showPostsAgain()
        settle()

        assertThat(vm.state.value.filter).isEqualTo(own)
        assertThat(feed.rankings).hasSize(2)
        assertThat(vm.ids()).containsExactly("p1")
    }

    // ── THE POST-RANK PREDICATES (CD-4) ──────────────────────────────────

    @Test
    fun theFormsCutOnTheHydratedCardAndOnlyReDerive() = runTest(dispatcher) {
        feed.posts["words"] = testPost("words")
        feed.posts["pics"] = testPost("pics").copy(attachments = listOf(picture))
        feed.posts["film"] = testPost("film").copy(attachments = listOf(picture, clip))
        feed.answer = Outcome.Success(rankingOf("words", "pics", "film"))
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("words", "pics", "film").inOrder()

        vm.applyFilter(vm.state.value.filter.copy(forms = setOf(FeedForm.PHOTOS)))
        settle()
        assertThat(vm.ids()).containsExactly("pics")

        // A clip anywhere makes it video.
        vm.applyFilter(vm.state.value.filter.copy(forms = setOf(FeedForm.VIDEO)))
        settle()
        assertThat(vm.ids()).containsExactly("film")
        assertThat(feed.rankings).hasSize(1)
    }

    @Test
    fun aVeiledBodyStaysOutUntilSensitiveIsOn() = runTest(dispatcher) {
        feed.posts["veiled"] = testPost("veiled").copy(content = ModeratedField("body", FieldStatus.SENSITIVE))
        feed.answer = Outcome.Success(rankingOf("veiled", "plain"))
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("plain")

        vm.applyFilter(vm.state.value.filter.copy(showSensitive = true))
        settle()
        assertThat(vm.ids()).containsExactly("veiled", "plain").inOrder()
    }

    /** Removed keys on the node's own `removal` first — a removed body has no form and no veil left to read. */
    @Test
    fun aRemovedBodyStaysOutUntilRemovedIsOnKeyedOnItsRemoval() = runTest(dispatcher) {
        feed.posts["gone"] = testPost("gone").copy(removal = removal, attachments = listOf(clip))
        feed.answer = Outcome.Success(rankingOf("gone", "plain"))
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("plain")

        vm.applyFilter(vm.state.value.filter.copy(showRemoved = true, forms = setOf(FeedForm.TEXT)))
        settle()
        assertThat(vm.ids()).containsExactly("gone", "plain").inOrder()
    }

    /**
     * THE PAGES THE FEED COMES BACK TO: a removal taken meanwhile on another
     * surface reached the marks, not the held pages — they come back wearing
     * it, re-cut under the filter they were made under.
     */
    @Test
    fun aRemovalTakenWhileAwayLeavesTheFeedOnReturnUnderRemovedOff() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2", "p3"))
        val vm = viewModel()
        settle()
        removedMarks.record("p2", removal)

        vm.onShown()

        assertThat(vm.ids()).containsExactly("p1", "p3").inOrder()
    }

    @Test
    fun aRemovalTakenWhileAwayStandsAsItsMarkUnderRemovedOn() = runTest(dispatcher) {
        defaults.save("u1", FeedFilter.DEFAULT.copy(showRemoved = true))
        feed.answer = Outcome.Success(rankingOf("p1", "p2"))
        val vm = viewModel()
        settle()
        removedMarks.record("p2", removal)

        vm.onShown()

        assertThat(vm.ids()).containsExactly("p1", "p2").inOrder()
        assertThat(vm.state.value.posts.last().removal).isEqualTo(removal)
    }

    @Test
    fun aReDeriveReadsACachedCardAsTheDeviceKnowsItNow() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1", "p2"))
        val vm = viewModel()
        settle()
        removedMarks.record("p1", removal)

        vm.applyFilter(vm.state.value.filter.copy(order = FeedOrder.NEWEST))
        settle()

        assertThat(vm.ids()).containsExactly("p2")
        assertThat(feed.windows).hasSize(1)
    }

    // ── EVERY KIND AS ITS OWN CARD (FeedKinds.md) ────────────────────────

    @Test
    fun theOtherKindsHydrateThroughFeedCardsAndKeepTheRankedOrder() = runTest(dispatcher) {
        val comment = FeedCard.Comment(testComment("c1"), target = null, threadPostId = "p1")
        val person = FeedCard.Person(testProfile("u-mira", "mira", "Mira"))
        val tag = FeedCard.Tag(TagCardTopic("h1", testModeratedField("saltmaps"), emptyList()))
        listOf(comment, person, tag).forEach { feed.cardsById[it.id] = it }
        feed.answer = Outcome.Success(
            FeedRanking(
                asOfEpoch = 3,
                entries = listOf(
                    entry("c1", 0, kind = FeedKind.COMMENT),
                    entry("p1", 1),
                    entry("u-mira", 2, kind = FeedKind.PROFILE),
                    entry("h1", 3, kind = FeedKind.TAG),
                ),
                settling = emptyList(),
            ),
        )
        defaults.save("u1", FeedFilter.DEFAULT.copy(kinds = FeedKind.entries.toSet()))
        val vm = viewModel()
        settle()

        assertThat(vm.ids()).containsExactly("c1", "p1", "u-mira", "h1").inOrder()
        // Posts ride the post window; the other kinds one `FeedCards` read.
        assertThat(feed.windows).containsExactly(listOf("p1"))
        assertThat(feed.cardReads).containsExactly(listOf("c1", "u-mira", "h1"))
    }

    @Test
    fun aCardsReadNeverCarriesMoreThanItsTen() = runTest(dispatcher) {
        val ids = (1..12).map { "h$it" }
        ids.forEach { feed.cardsById[it] = FeedCard.Tag(TagCardTopic(it, testModeratedField(it), emptyList())) }
        feed.answer = Outcome.Success(
            FeedRanking(3, ids.mapIndexed { i, id -> entry(id, i, kind = FeedKind.TAG) }, emptyList()),
        )
        defaults.save("u1", FeedFilter.DEFAULT.copy(kinds = setOf(FeedKind.TAG)))
        val vm = viewModel()
        settle()

        assertThat(feed.cardReads.map { it.size }).containsExactly(10, 2).inOrder()
        assertThat(vm.ids()).isEqualTo(ids)
    }

    @Test
    fun formsNeverCutAPersonOrATopic() = runTest(dispatcher) {
        val person = FeedCard.Person(testProfile("u-mira", "mira", "Mira"))
        feed.cardsById[person.id] = person
        feed.answer = Outcome.Success(FeedRanking(3, listOf(entry("u-mira", 0, kind = FeedKind.PROFILE)), emptyList()))
        defaults.save("u1", FeedFilter.DEFAULT.copy(kinds = setOf(FeedKind.PROFILE), forms = emptySet()))
        val vm = viewModel()
        settle()
        assertThat(vm.ids()).containsExactly("u-mira")
    }

    // ── THE SHEET'S TOPICS AND THE BORROWED VIEW (FeedSheet.md) ──────────

    @Test
    fun theHeldForTopicsAreReadAtEachOpening() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        heldTopics.topics = listOf(
            HeldTopic("saltmaps", 0.6, 0.2, pending = false, id = "t1"),
            HeldTopic("spam", -0.3, 0.1, pending = false, id = "t9"),
        )

        vm.onSheetOpened()
        settle()
        assertThat(vm.state.value.heldTopics).containsExactly(FeedTopic("t1", "saltmaps"))

        heldTopics.topics = emptyList()
        vm.onSheetOpened()
        settle()
        assertThat(vm.state.value.heldTopics).isEmpty()
        assertThat(heldTopics.pageReads).hasSize(2)
    }

    @Test
    fun aBorrowedViewNamesItsAccountAndReadsNoTopics() = runTest(dispatcher) {
        account.lender = Outcome.Success(ActorRef("u-mira", "mira"))
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        assertThat(vm.state.value.borrowedHandle).isEqualTo("mira")
        assertThat(feed.rankings.single().first).isEqualTo("u-mira")

        vm.onSheetOpened()
        settle()
        assertThat(heldTopics.pageReads).isEmpty()
        assertThat(vm.state.value.heldTopics).isEmpty()
    }

    @Test
    fun theReadersOwnViewNamesNoOne() = runTest(dispatcher) {
        feed.answer = Outcome.Success(rankingOf("p1"))
        val vm = viewModel()
        settle()
        assertThat(vm.state.value.borrowedHandle).isNull()
    }
}
