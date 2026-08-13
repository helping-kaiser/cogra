package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostView
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

    private val content = object : ThrowingContentRepository() {
        val pages = mutableMapOf<String?, Outcome<Page<PostView>>>()
        var calls = mutableListOf<String?>()

        override suspend fun posts(first: Int, after: String?): Outcome<Page<PostView>> {
            calls += after
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
        val vm = FeedViewModel(content)
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
        val vm = FeedViewModel(content)
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        val state = vm.state.value
        assertThat(state.posts.map { it.id }).containsExactly("p1", "p2").inOrder()
        assertThat(state.hasNextPage).isFalse()
        assertThat(content.calls).containsExactly(null, "c1").inOrder()
    }

    @Test
    fun loadMoreWithoutANextPageIsANoOp() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), "c1", hasNextPage = false))
        val vm = FeedViewModel(content)
        dispatcher.scheduler.advanceUntilIdle()

        vm.loadMore()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(content.calls).containsExactly(null)
    }

    @Test
    fun aTransportFaultRendersTheRetrySurface() = runTest(dispatcher) {
        content.pages[null] = Outcome.Failed(IOException("offline"))
        val vm = FeedViewModel(content)
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
        val vm = FeedViewModel(content)
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

    @Test
    fun aFailedRetryHoldsTheFaultAndThePostsSteady() = runTest(dispatcher) {
        content.pages[null] =
            Outcome.Success(Page(listOf(testPost("p1")), null, hasNextPage = false))
        val vm = FeedViewModel(content)
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
