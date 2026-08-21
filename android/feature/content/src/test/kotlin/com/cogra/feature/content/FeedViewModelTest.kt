package com.cogra.feature.content

import com.cogra.domain.Landing
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostView
import com.cogra.domain.content.LandingSignal
import com.cogra.domain.testing.ThrowingContentRepository
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class FeedViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val landings = LandingSignal()

    private val content = object : ThrowingContentRepository() {
        val pages = mutableMapOf<String?, Outcome<Page<PostView>>>()
        var calls = mutableListOf<String?>()

        val includePendingAsked = mutableListOf<Boolean>()

        override suspend fun posts(
            first: Int,
            after: String?,
            includePending: Boolean,
        ): Outcome<Page<PostView>> {
            calls += after
            includePendingAsked += includePending
            return pages.getValue(after)
        }
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun refreshLoadsTheFirstPage() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1"), testPost("p2")), "c2", hasNextPage = true))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        val state = vm.state.value
        assertThat(state.loading).isFalse()
        assertThat(state.posts.map { it.id }).containsExactly("p1", "p2").inOrder()
        assertThat(state.hasNextPage).isTrue()
    }

    @Test
    fun loadMoreAppendsFromTheCursor() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), "c1", hasNextPage = true))
        content.pages["c1"] =
            Outcome.Success(Page(listOf(testPost("p2")), "c2", hasNextPage = false))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        val state = vm.state.value
        assertThat(state.posts.map { it.id }).containsExactly("p1", "p2").inOrder()
        assertThat(state.hasNextPage).isFalse()
        assertThat(content.calls).containsExactly(null, "c1").inOrder()
    }

    @Test
    fun anEntryThatLandedMidWalkIsNotAppendedTwice() = runTest(dispatcher) {
        // p1 rode the first page as pending and landed before the
        // second page was asked for, so the resumed walk offers it
        // again below its new position.
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1"), testPost("p2")), "c1", hasNextPage = true))
        content.pages["c1"] =
            Outcome.Success(Page(listOf(testPost("p1"), testPost("p3")), null, hasNextPage = false))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.posts.map { it.id }).containsExactly("p1", "p2", "p3").inOrder()
    }

    @Test
    fun theListingAsksForPendingEntriesByDefault() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), null, hasNextPage = false))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.includePending).isTrue()
        assertThat(content.includePendingAsked).containsExactly(true)
    }

    @Test
    fun theLandedOnlyOptOutRestartsTheWalk() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1"), testPost("p2")), "c1", hasNextPage = true))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        // The cursor namespaces differ, so the opt-out refetches from
        // the head rather than continuing the held walk.
        vm.setIncludePending(false)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.includePending).isFalse()
        assertThat(content.calls).containsExactly(null, null).inOrder()
        assertThat(content.includePendingAsked).containsExactly(true, false).inOrder()

        // Setting it to what it already is changes nothing.
        vm.setIncludePending(false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(content.calls).hasSize(2)
    }

    @Test
    fun theOptOutRidesTheNextPageToo() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), "c1", hasNextPage = true))
        content.pages["c1"] =
            Outcome.Success(Page(listOf(testPost("p2")), null, hasNextPage = false))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()
        vm.setIncludePending(false)
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.includePendingAsked).containsExactly(true, false, false).inOrder()
    }

    @Test
    fun loadMoreWithoutANextPageIsANoOp() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), "c1", hasNextPage = false))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.calls).containsExactly(null)
    }

    @Test
    fun aTransportFaultRendersTheRetrySurface() = runTest(dispatcher) {
        content.pages[null] = Outcome.Failed(IOException("offline"))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)

        // Retry heals.
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), null, hasNextPage = false))
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isNull()
        assertThat(vm.state.value.posts).hasSize(1)
    }

    @Test
    fun aFailedPageFetchFaultsAtTheAppendSlot() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), "c1", hasNextPage = true))
        content.pages["c1"] = Outcome.Failed(IOException("offline"))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.APPEND)
        assertThat(vm.state.value.posts).hasSize(1)
        assertThat(vm.state.value.hasNextPage).isTrue()

        // A later successful page clears the fault and appends.
        content.pages["c1"] =
            Outcome.Success(Page(listOf(testPost("p2")), null, hasNextPage = false))
        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isNull()
        assertThat(vm.state.value.posts.map { it.id }).containsExactly("p1", "p2").inOrder()
    }

    // The reader opened the pending post and refreshed there until it
    // landed; the card they come back to already knows.
    @Test
    fun aFresherLandingReadClearsTheHeldCardsMarker() = runTest(dispatcher) {
        content.pages[null] = Outcome.Success(
            Page(
                listOf(
                    testPost("p1", landing = Landing.Pending),
                    testPost("p2", landing = Landing.landed(4)),
                ),
                null,
                hasNextPage = false,
            ),
        )
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.posts.first().landing.isPending).isTrue()

        landings.observed("p1", Landing.landed(5))
        dispatcher.scheduler.advanceUntilIdle()

        // The entry keeps its place — the page is a snapshot, and only
        // the node's own state moved — and no page was refetched.
        assertThat(vm.state.value.posts.map { it.id }).containsExactly("p1", "p2").inOrder()
        assertThat(vm.state.value.posts.first().landing).isEqualTo(Landing.landed(5))
        assertThat(content.calls).containsExactly(null)
    }

    // Not monotone: an unlanded edit leaves a landed node pending, and
    // the freshest read is what the card shows.
    @Test
    fun aLandingUpdateForAnAbsentNodeLeavesTheListAlone() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1", landing = Landing.landed(4))), null, false))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        landings.observed("p9", Landing.Pending)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.posts.single().landing).isEqualTo(Landing.landed(4))

        landings.observed("p1", Landing.Pending)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.posts.single().landing.isPending).isTrue()
    }

    @Test
    fun aFailedRetryHoldsTheFaultAndThePostsSteady() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), null, hasNextPage = false))
        val vm = FeedViewModel(content, landings)
        dispatcher.scheduler.advanceUntilIdle()

        content.pages[null] = Outcome.Failed(IOException("offline"))
        vm.refresh()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(vm.state.value.posts).hasSize(1)

        // The fault reflects the last completed fetch: it must not
        // clear while the retry is still in flight (the banner flash),
        // nor after the retry fails again.
        vm.refresh()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(vm.state.value.loading).isTrue()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFault).isEqualTo(TransportFault.REFRESH)
        assertThat(vm.state.value.posts).hasSize(1)
    }
}
