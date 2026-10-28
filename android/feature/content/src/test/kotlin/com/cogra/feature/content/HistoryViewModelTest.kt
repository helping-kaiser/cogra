// History's reads, compiled from the sidecars: the whole list on arrival
// (History.md:23), the search read from the server once typing rests and
// never mixed with another list's pages (History.md:85-103), the kinds
// sheet's Done reading once (HistoryFilter.md:17), a section's door keeping
// the query (HistorySearch.md:19, :27), Show everything (HistoryNone.md:13),
// the hidden set read beside every fresh page and a hide taking hold only at
// the next one (History.md:41; HistoryHidden.md:3-7), and the tail's pages on
// the list's own cursor. web's twin is the state half of `history-view.test.tsx`.

package com.cogra.feature.content

import com.cogra.domain.ActorRef
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryEntry
import com.cogra.domain.history.HistoryPage
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.HistoryRead
import com.cogra.domain.testing.RecordingHiddenRepository
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.ScriptedHistoryRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class HistoryViewModelTest {

    private val repository = ScriptedHistoryRepository()
    private val hiddenRepository = RecordingHiddenRepository()
    private val dispatcher = UnconfinedTestDispatcher()
    private val tokens = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }
    private val hidden = HiddenSet(hiddenRepository, tokens, CoroutineScope(Dispatchers.Unconfined))

    private val whole = HistoryRead(null, emptySet(), null)

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private val seen = Instant.parse("2026-10-05T09:00:00Z")
    private val ada = ActorRef("u-ada", "ada")

    private fun post(id: String, author: ActorRef? = ActorRef("u-sol", "sol")) =
        HistoryEntry(HistoryCard.Post(testPost(id, author = author)), seen)

    private fun comment(id: String, author: ActorRef) =
        HistoryEntry(HistoryCard.Comment(testComment(id, author = author), null, "p0"), seen)

    private fun person(id: String, handle: String) = HistoryEntry(HistoryCard.Person(testProfile(id, handle)), seen)

    private fun page(vararg entries: HistoryEntry, next: String? = null, morePeople: Boolean = false) =
        Outcome.Success<HistoryPage?>(
            HistoryPage(entries.toList(), next, hasNextPage = next != null, hasMorePeople = morePeople),
        )

    private fun viewModel() = HistoryViewModel(
        repository,
        hidden,
        SavedWrites(RecordingSavedRepository(), tokens, CoroutineScope(Dispatchers.Unconfined)),
        SensitiveReveals(),
        "https://cogra.test",
    )

    /** Typing rests: the debounced read fires. */
    private fun rest() {
        dispatcher.scheduler.advanceTimeBy(HISTORY_SEARCH_DEBOUNCE_MILLIS)
        dispatcher.scheduler.runCurrent()
    }

    private val HistoryViewModel.ids get() = state.value.entries.map { it.id }

    private fun hiddenAda() = HiddenEntry(HiddenPerson("u-ada", "ada", "Ada", null, false), seen)

    @Test
    fun `History opens on the whole list, every kind, newest first by first seeing`() {
        repository.pages[whole] = page(post("p2"), post("p1"))
        val vm = viewModel()
        assertThat(repository.reads).containsExactly(whole)
        assertThat(vm.ids).containsExactly("p2", "p1").inOrder()
        assertThat(vm.state.value.answered).isEqualTo(HistoryAsk(null, emptySet()))
    }

    @Test
    fun `a query reaches everything seen, read from the server once typing rests`() {
        val vm = viewModel()
        repository.pages[HistoryRead("mira", emptySet(), null)] = page(person("u-m", "mira"))
        vm.search("mira")
        assertThat(vm.state.value.query).isEqualTo("mira")
        assertThat(repository.reads).containsExactly(whole)
        rest()
        assertThat(repository.reads).containsExactly(whole, HistoryRead("mira", emptySet(), null)).inOrder()
        assertThat(vm.ids).containsExactly("u-m")
        assertThat(vm.state.value.answered?.query).isEqualTo("mira")
    }

    @Test
    fun `a burst of typing is one read of what was last typed, trimmed`() {
        val vm = viewModel()
        vm.search("m")
        vm.search("mi")
        vm.search("mir ")
        rest()
        assertThat(repository.reads).containsExactly(whole, HistoryRead("mir", emptySet(), null)).inOrder()
    }

    @Test
    fun `emptying the field stands History whole at once`() {
        val vm = viewModel()
        vm.search("mira")
        rest()
        vm.search("")
        assertThat(repository.reads.last()).isEqualTo(whole)
        assertThat(vm.state.value.answered).isEqualTo(HistoryAsk(null, emptySet()))
    }

    @Test
    fun `an older answer that lands after a newer read began never stands`() {
        val stale = CompletableDeferred<Outcome<HistoryPage?>>()
        repository.held[HistoryRead("m", emptySet(), null)] = stale
        repository.pages[HistoryRead("ma", emptySet(), null)] = page(person("u-ma", "maren"))
        val vm = viewModel()
        vm.search("m")
        rest()
        vm.search("ma")
        rest()
        stale.complete(page(person("u-m", "mira")))
        assertThat(vm.ids).containsExactly("u-ma")
        assertThat(vm.state.value.answered?.query).isEqualTo("ma")
    }

    @Test
    fun `Done reads once with the staged kinds, the query kept`() {
        val vm = viewModel()
        vm.search("m")
        rest()
        vm.applyKinds(setOf(FeedKind.POST, FeedKind.TAG))
        assertThat(repository.reads.last()).isEqualTo(HistoryRead("m", setOf(FeedKind.POST, FeedKind.TAG), null))
        assertThat(repository.reads.count { it.kinds.isNotEmpty() }).isEqualTo(1)
        assertThat(vm.state.value.kinds).containsExactly(FeedKind.POST, FeedKind.TAG)
    }

    @Test
    fun `Done with the kinds unchanged still re-reads once`() {
        val vm = viewModel()
        vm.applyKinds(emptySet())
        assertThat(repository.reads).containsExactly(whole, whole)
    }

    @Test
    fun `a section's door narrows to its kind alone and keeps the query`() {
        val vm = viewModel()
        vm.search("m")
        rest()
        vm.narrowTo(FeedKind.PROFILE)
        assertThat(repository.reads.last()).isEqualTo(HistoryRead("m", setOf(FeedKind.PROFILE), null))
        assertThat(vm.state.value.query).isEqualTo("m")
        assertThat(vm.state.value.kinds).containsExactly(FeedKind.PROFILE)
    }

    @Test
    fun `Show everything clears the query and every kind and reads History whole`() {
        val vm = viewModel()
        vm.search("brackish")
        rest()
        vm.applyKinds(setOf(FeedKind.TAG))
        vm.showEverything()
        assertThat(repository.reads.last()).isEqualTo(whole)
        assertThat(vm.state.value.query).isEmpty()
        assertThat(vm.state.value.kinds).isEmpty()
    }

    @Test
    fun `a query past the server's cap stands narrowed to nothing without asking`() {
        val vm = viewModel()
        vm.search("x".repeat(HISTORY_SEARCH_MAX_CHARS + 1))
        rest()
        assertThat(repository.reads).containsExactly(whole)
        assertThat(vm.state.value.entries).isEmpty()
        assertThat(vm.state.value.answered?.query).hasLength(HISTORY_SEARCH_MAX_CHARS + 1)
    }

    @Test
    fun `the hidden set is read again beside every fresh page`() {
        val vm = viewModel()
        val before = hiddenRepository.reads
        vm.refresh()
        assertThat(hiddenRepository.reads).isEqualTo(before + 1)
    }

    @Test
    fun `a hidden account's posts and comments stay out and its own profile card stays`() {
        hiddenRepository.served = Outcome.Success(listOf(hiddenAda()))
        repository.pages[whole] = page(post("p1", ada), comment("c1", ada), person("u-ada", "ada"), post("p2"))
        val vm = viewModel()
        assertThat(vm.ids).containsExactly("u-ada", "p2").inOrder()
    }

    @Test
    fun `a hide while History stands moves nothing until the next pull`() {
        repository.pages[whole] = page(post("p1", ada), post("p2"))
        val vm = viewModel()
        assertThat(vm.ids).containsExactly("p1", "p2").inOrder()
        // The hide lands on the device's set (HistoryHidden.md:3-5): the open
        // History stands as it stood, every card in its place.
        hiddenRepository.served = Outcome.Success(listOf(hiddenAda()))
        hidden.hide(hiddenAda().person, origin = "p1")
        assertThat(vm.ids).containsExactly("p1", "p2").inOrder()
        // HistoryHidden.md:7: at the next pull the hidden person's posts are out.
        vm.refresh()
        assertThat(vm.ids).containsExactly("p2")
    }

    @Test
    fun `the next page continues the list on screen on its own cursor`() {
        repository.pages[HistoryRead("m", emptySet(), null)] = page(person("u1", "mira"), next = "k1")
        repository.pages[HistoryRead("m", emptySet(), "k1")] = page(person("u1", "mira"), person("u2", "maren"))
        val vm = viewModel()
        vm.search("m")
        rest()
        vm.loadMore()
        assertThat(repository.reads.last()).isEqualTo(HistoryRead("m", emptySet(), "k1"))
        // A thing already standing is never doubled.
        assertThat(vm.ids).containsExactly("u1", "u2").inOrder()
        assertThat(vm.state.value.hasNextPage).isFalse()
    }

    @Test
    fun `a next page that does not arrive keeps the cards and ends the list with its fault`() {
        repository.pages[whole] = page(post("p1"), next = "k1")
        repository.pages[HistoryRead(null, emptySet(), "k1")] = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.loadMore()
        assertThat(vm.ids).containsExactly("p1")
        assertThat(vm.state.value.moreFailed).isTrue()
    }

    @Test
    fun `a failed refresh keeps the cards and a failed new narrowing never stands another's cards`() {
        repository.pages[whole] = page(post("p1"))
        val vm = viewModel()
        repository.pages[whole] = Outcome.Failed(IOException("down"))
        vm.refresh()
        assertThat(vm.ids).containsExactly("p1")
        assertThat(vm.state.value.failed).isTrue()
        repository.pages[HistoryRead("x", emptySet(), null)] = Outcome.Failed(IOException("down"))
        vm.search("x")
        rest()
        assertThat(vm.ids).isEmpty()
        assertThat(vm.state.value.answered?.query).isEqualTo("x")
    }
}
