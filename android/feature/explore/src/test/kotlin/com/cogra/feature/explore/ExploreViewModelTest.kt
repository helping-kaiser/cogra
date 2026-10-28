// Explore's state holder, compiled from the sidecars: Explore.md (rest,
// recents, the action key, Back), ExploreSearch.md (refine as typed, the
// loading ladder, the faults, guests), ExploreFilter.md (Done re-queries once),
// ExplorePerson.md (See all profiles), ExploreUnscoped.md (no read for an
// answer known empty), plus the technical lines (debounce, the stale answer,
// the query surviving process death).

package com.cogra.feature.explore

import androidx.lifecycle.SavedStateHandle
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.search.SearchFilter
import com.cogra.domain.search.SearchHit
import com.cogra.domain.search.SearchNode
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.search.SearchPage
import com.cogra.domain.testing.FakeExploreDeviceStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ScriptedHeldTopicsRepository
import com.cogra.domain.testing.ScriptedSearchRepository
import com.cogra.domain.topics.HeldTopic
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class ExploreViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val search = ScriptedSearchRepository()
    private val held = ScriptedHeldTopicsRepository()
    private val device = FakeExploreDeviceStore()
    private val tokens = FakeTokenStore()

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun page(vararg titles: String) = SearchPage(
        hits = titles.map { SearchHit(SearchNode.Post(it, it, Instant.EPOCH, null), score = null) },
        endCursor = null,
        hasNextPage = false,
        hasMorePeople = false,
    )

    private fun member() {
        tokens.tokens.value = AuthTokens("a", "r", "me")
    }

    private fun model(saved: SavedStateHandle = SavedStateHandle()) =
        ExploreViewModel(search, held, device, tokens, saved)

    @Test
    fun `the results refine once typing settles, one ask for a run of keystrokes`() = runTest(dispatcher) {
        val vm = model()
        runCurrent()
        vm.onQueryChange("s")
        vm.onQueryChange("sa")
        vm.onQueryChange("sal")
        advanceTimeBy(EXPLORE_SEARCH_DEBOUNCE_MS - 1)
        assertThat(search.reads).isEmpty()
        advanceUntilIdle()
        assertThat(search.reads.map { it.ask.query }).containsExactly("sal")
    }

    @Test
    fun `a late answer for an old query never replaces a newer one`() = runTest(dispatcher) {
        val first = CompletableDeferred<Outcome<SearchPage>>()
        search.respond = { ask, _ -> if (ask.query == "old") first.await() else Outcome.Success(page("new")) }
        val vm = model()
        runCurrent()
        vm.onQueryChange("old")
        advanceTimeBy(EXPLORE_SEARCH_DEBOUNCE_MS + 1)
        vm.onQueryChange("new")
        advanceUntilIdle()
        first.complete(Outcome.Success(page("old")))
        advanceUntilIdle()
        assertThat(vm.state.value.results?.query).isEqualTo("new")
        assertThat(vm.state.value.results?.hits?.map { it.node.id }).containsExactly("new")
    }

    @Test
    fun `stale rows stay readable under 200ms, then Loading takes their place`() = runTest(dispatcher) {
        val gate = CompletableDeferred<Outcome<SearchPage>>()
        search.respond = { ask, _ -> if (ask.query == "salt") Outcome.Success(page("a")) else gate.await() }
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        vm.onQueryChange("salty")
        advanceTimeBy(EXPLORE_SEARCH_DEBOUNCE_MS + LOADING_LADDER_MS - 1)
        assertThat(vm.state.value.rowsShown).isTrue()
        assertThat(vm.state.value.slow).isFalse()
        advanceTimeBy(2)
        assertThat(vm.state.value.slow).isTrue()
        assertThat(vm.state.value.rowsShown).isFalse()
        gate.complete(Outcome.Success(page("b")))
        advanceUntilIdle()
        assertThat(vm.state.value.rowsShown).isTrue()
    }

    @Test
    fun `a failed refine keeps the rows, and Retry asks again`() = runTest(dispatcher) {
        var fail = false
        search.respond = { _, _ -> if (fail) Outcome.Failed(IOException("down")) else Outcome.Success(page("a")) }
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        fail = true
        vm.onQueryChange("salty")
        advanceUntilIdle()
        assertThat(vm.state.value.failed).isTrue()
        assertThat(vm.state.value.results?.hits).hasSize(1)
        fail = false
        vm.retry()
        advanceUntilIdle()
        assertThat(vm.state.value.failed).isFalse()
        assertThat(vm.state.value.results?.query).isEqualTo("salty")
    }

    @Test
    fun `a failed read with nothing loaded is a fault with no rows`() = runTest(dispatcher) {
        search.respond = { _, _ -> Outcome.Failed(IOException("down")) }
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        assertThat(vm.state.value.failed).isTrue()
        assertThat(vm.state.value.results).isNull()
    }

    @Test
    fun `the trailing x and Back bring the root to rest`() = runTest(dispatcher) {
        search.respond = { _, _ -> Outcome.Success(page("a")) }
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        vm.toRest()
        assertThat(vm.state.value.searching).isFalse()
        assertThat(vm.state.value.results).isNull()
    }

    @Test
    fun `an emptied field returns to rest and asks nothing`() = runTest(dispatcher) {
        val vm = model()
        runCurrent()
        vm.onQueryChange("s")
        vm.onQueryChange("")
        advanceUntilIdle()
        assertThat(vm.state.value.searching).isFalse()
        assertThat(search.reads).isEmpty()
    }

    @Test
    fun `a recent is written on opening a result or the action key, per account`() = runTest(dispatcher) {
        member()
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        vm.onAction()
        advanceUntilIdle()
        vm.onQueryChange("coast")
        vm.onOpenResult()
        advanceUntilIdle()
        assertThat(device.recentsNow("me")).containsExactly("coast", "salt").inOrder()
        assertThat(device.recentsNow(null)).isEmpty()
        assertThat(vm.state.value.recents).containsExactly("coast", "salt").inOrder()
    }

    @Test
    fun `a guest's recents are the device's own`() = runTest(dispatcher) {
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        vm.onAction()
        advanceUntilIdle()
        assertThat(device.recentsNow(null)).containsExactly("salt")
    }

    @Test
    fun `tapping a recent runs its query again at once`() = runTest(dispatcher) {
        val vm = model()
        runCurrent()
        vm.onRecent("@sol salt")
        runCurrent()
        assertThat(vm.state.value.query).isEqualTo("@sol salt")
        assertThat(search.reads.map { it.ask.query }).containsExactly("@sol salt")
    }

    @Test
    fun `Done re-queries once with the committed filter, kept on this device`() = runTest(dispatcher) {
        member()
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        val narrowed = SearchFilter(kinds = setOf(FeedKind.POST), order = SearchOrder.NEWEST)
        vm.commit(narrowed)
        advanceUntilIdle()
        assertThat(search.reads).hasSize(2)
        assertThat(search.reads.last().ask.kinds).containsExactly(FeedKind.POST)
        assertThat(search.reads.last().ask.order).isEqualTo(SearchOrder.NEWEST)
        assertThat(device.filters["me"]).isEqualTo(narrowed)
        vm.commit(narrowed)
        advanceUntilIdle()
        assertThat(search.reads).hasSize(2)
    }

    @Test
    fun `See all profiles narrows to Profiles alone and re-queries once`() = runTest(dispatcher) {
        val vm = model()
        runCurrent()
        vm.onQueryChange("sal")
        advanceUntilIdle()
        vm.allProfiles()
        advanceUntilIdle()
        assertThat(search.reads.last().ask.kinds).containsExactly(FeedKind.PROFILE)
        assertThat(vm.state.value.filter.profilesAlone).isTrue()
    }

    @Test
    fun `a member searches Ranked as the viewer with seen kept out`() = runTest(dispatcher) {
        member()
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        val ask = search.reads.single().ask
        assertThat(ask.order).isEqualTo(SearchOrder.RANKED)
        assertThat(ask.viewer).isEqualTo("me")
        assertThat(ask.includeSeen).isFalse()
    }

    @Test
    fun `a guest searches newest first with no viewer and nothing kept out`() = runTest(dispatcher) {
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        val ask = search.reads.single().ask
        assertThat(ask.order).isEqualTo(SearchOrder.NEWEST)
        assertThat(ask.viewer).isNull()
        assertThat(ask.includeSeen).isTrue()
        assertThat(vm.state.value.guest).isTrue()
    }

    @Test
    fun `comments alone with no cue send no read and stand the scope line`() = runTest(dispatcher) {
        device.filters[null] = SearchFilter(kinds = setOf(FeedKind.COMMENT))
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt flats")
        advanceUntilIdle()
        assertThat(search.reads).isEmpty()
        assertThat(vm.state.value.results?.hits).isEmpty()
        assertThat(vm.state.value.results?.query).isEqualTo("salt flats")
    }

    @Test
    fun `the half-typed query survives process death and asks again`() = runTest(dispatcher) {
        val vm = model(SavedStateHandle(mapOf("explore_query" to "coast")))
        advanceUntilIdle()
        assertThat(vm.state.value.query).isEqualTo("coast")
        assertThat(search.reads.map { it.ask.query }).containsExactly("coast")
    }

    @Test
    fun `the door counts the topics a member holds, and a guest reads no count`() = runTest(dispatcher) {
        held.topics = List(5) { HeldTopic("t$it", 0.1, 0.1, pending = false) }
        val guest = model()
        advanceUntilIdle()
        assertThat(guest.state.value.heldCount).isNull()
        assertThat(held.countReads).isEqualTo(0)
        member()
        val reader = model()
        advanceUntilIdle()
        assertThat(reader.state.value.heldCount).isEqualTo(5)
    }

    @Test
    fun `a pull asks the same search again`() = runTest(dispatcher) {
        val vm = model()
        runCurrent()
        vm.onQueryChange("salt")
        advanceUntilIdle()
        vm.pull()
        assertThat(vm.state.value.refreshing).isTrue()
        advanceUntilIdle()
        assertThat(search.reads).hasSize(2)
        assertThat(vm.state.value.refreshing).isFalse()
    }

    @Test
    fun `a next page appends what is new, and a failed page keeps the rows with its own retry`() =
        runTest(dispatcher) {
            var failMore = true
            search.respond = { _, after ->
                when {
                    after == null -> Outcome.Success(page("a", "b").copy(endCursor = "c1", hasNextPage = true))
                    failMore -> Outcome.Failed(IOException("down"))
                    else -> Outcome.Success(page("b", "c"))
                }
            }
            val vm = model()
            runCurrent()
            vm.onQueryChange("salt")
            advanceUntilIdle()
            vm.loadMore()
            advanceUntilIdle()
            assertThat(vm.state.value.moreFailed).isTrue()
            assertThat(vm.state.value.results?.hits).hasSize(2)
            failMore = false
            vm.retryMore()
            advanceUntilIdle()
            assertThat(vm.state.value.results?.hits?.map { it.node.id }).containsExactly("a", "b", "c").inOrder()
        }
}
