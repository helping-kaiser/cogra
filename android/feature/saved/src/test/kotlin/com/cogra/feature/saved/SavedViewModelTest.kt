// Saved's reads (Saved.md; seam 220): the first page and the reader's pull,
// the next page as the reader nears the tail, and the reader's search — read
// from the server's own matcher (`bookmarks(query:)`) once typing rests,
// paged on the narrowed list's own cursors, and never mixed with another
// list's pages.

package com.cogra.feature.saved

import com.cogra.domain.AuthTokens
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileView
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedPage
import com.cogra.domain.saved.SavedRepository
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.SavedRead
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
class SavedViewModelTest {

    private val repository = RecordingSavedRepository()
    private val dispatcher = UnconfinedTestDispatcher()

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun person(id: String, handle: String) = SavedEntry(
        SavedCard.Person(
            ProfileView(
                id = id,
                handle = handle,
                displayName = ModeratedField(handle, FieldStatus.NORMAL),
                bio = ModeratedField(null, FieldStatus.NORMAL),
                websiteUrl = ModeratedField(null, FieldStatus.NORMAL),
            ),
        ),
        Instant.parse("2026-10-10T12:00:00Z"),
    )

    private fun page(vararg entries: SavedEntry, next: String? = null) =
        Outcome.Success<SavedPage?>(SavedPage(entries.toList(), next, hasNextPage = next != null))

    private fun viewModel(reads: SavedRepository = repository) = SavedViewModel(
        reads,
        SavedWrites(
            repository,
            FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") },
            CoroutineScope(Dispatchers.Unconfined),
        ),
        SensitiveReveals(),
        "https://cogra.test",
    )

    /** Typing rests: the debounced read fires. */
    private fun rest() {
        dispatcher.scheduler.advanceTimeBy(SAVED_SEARCH_DEBOUNCE_MILLIS)
        dispatcher.scheduler.runCurrent()
    }

    private val SavedViewModel.ids get() = state.value.entries.map { it.id }

    @Test
    fun `a search is the server's narrowed list, read once typing rests`() {
        repository.pages[SavedRead(null, null)] = page(person("u1", "ada"), next = "c1")
        repository.pages[SavedRead("sol", null)] = page(person("u3", "sol"))
        val vm = viewModel()
        vm.search("sol")
        // The field shows the query at once; nothing is read until typing rests.
        assertThat(vm.state.value.query).isEqualTo("sol")
        assertThat(repository.reads).containsExactly(SavedRead(null, null))
        rest()
        assertThat(repository.reads).containsExactly(SavedRead(null, null), SavedRead("sol", null)).inOrder()
        // Law 5: the match beyond the loaded window is found — no page of the
        // whole list is walked in to look for it.
        assertThat(vm.ids).containsExactly("u3")
        assertThat(vm.state.value.narrowedBy).isEqualTo("sol")
    }

    @Test
    fun `a burst of typing is one read of what was last typed, trimmed`() {
        val vm = viewModel()
        vm.search("@")
        vm.search("@a")
        vm.search("@ad ")
        rest()
        assertThat(repository.reads).containsExactly(SavedRead(null, null), SavedRead("@ad", null)).inOrder()
    }

    @Test
    fun `the served order stands - people first, then content, never re-sorted`() {
        val older = person("u9", "modsworth").copy(bookmarkedAt = Instant.parse("2026-01-01T00:00:00Z"))
        val newer = person("u2", "mod").copy(bookmarkedAt = Instant.parse("2026-10-01T00:00:00Z"))
        repository.pages[SavedRead("@mod", null)] = page(older, newer)
        val vm = viewModel()
        vm.search("@mod")
        rest()
        assertThat(vm.ids).containsExactly("u9", "u2").inOrder()
    }

    @Test
    fun `a narrowed list pages on its own cursor`() {
        repository.pages[SavedRead("sol", null)] = page(person("u3", "sol"), next = "s1")
        repository.pages[SavedRead("sol", "s1")] = page(person("u4", "solveig"))
        val vm = viewModel()
        vm.search("sol")
        rest()
        vm.loadMore()
        assertThat(repository.reads.last()).isEqualTo(SavedRead("sol", "s1"))
        assertThat(vm.ids).containsExactly("u3", "u4").inOrder()
        assertThat(vm.state.value.hasNextPage).isFalse()
    }

    @Test
    fun `clearing the field reads the whole list at once`() {
        repository.pages[SavedRead(null, null)] = page(person("u1", "ada"), next = "c1")
        repository.pages[SavedRead("sol", null)] = page(person("u3", "sol"))
        val vm = viewModel()
        vm.search("sol")
        rest()
        vm.search("")
        // No pause: the whole list is asked without waiting on typing.
        assertThat(repository.reads.last()).isEqualTo(SavedRead(null, null))
        assertThat(vm.ids).containsExactly("u1")
        assertThat(vm.state.value.narrowedBy).isNull()
        assertThat(vm.state.value.hasNextPage).isTrue()
    }

    @Test
    fun `a blank query leaves the list unchanged and reads nothing`() {
        repository.pages[SavedRead(null, null)] = page(person("u1", "ada"), next = "c1")
        val vm = viewModel()
        vm.search("   ")
        rest()
        assertThat(repository.reads).containsExactly(SavedRead(null, null))
        assertThat(vm.ids).containsExactly("u1")
        assertThat(vm.state.value.hasNextPage).isTrue()
    }

    @Test
    fun `typing back to what is asked reads nothing again`() {
        repository.pages[SavedRead("sol", null)] = page(person("u3", "sol"))
        val vm = viewModel()
        vm.search("sol")
        rest()
        vm.search("so")
        vm.search("sol")
        rest()
        assertThat(repository.reads).containsExactly(SavedRead(null, null), SavedRead("sol", null)).inOrder()
    }

    @Test
    fun `a page of the list a search replaced never lands`() {
        repository.pages[SavedRead(null, null)] = page(person("u1", "ada"), next = "c1")
        // The whole list's next page is asked, but answers only after a search
        // has replaced the list — it must not join the narrowed one.
        val gate = CompletableDeferred<Unit>()
        val slow = object : SavedRepository by repository {
            override suspend fun savedPage(query: String?, after: String?): Outcome<SavedPage?> {
                if (after == "c1") gate.await()
                return repository.savedPage(query, after)
            }
        }
        repository.pages[SavedRead(null, "c1")] = page(person("u2", "mira"))
        repository.pages[SavedRead("sol", null)] = page(person("u3", "sol"))
        val gated = viewModel(slow)
        gated.loadMore()
        gated.search("sol")
        rest()
        gate.complete(Unit)
        dispatcher.scheduler.runCurrent()
        assertThat(gated.ids).containsExactly("u3")
        assertThat(gated.state.value.loadingMore).isFalse()
    }

    @Test
    fun `a search whose read fails holds no stale matches and the pull reads it again`() {
        repository.pages[SavedRead(null, null)] = page(person("u1", "ada"))
        repository.pages[SavedRead("sol", null)] = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.search("sol")
        rest()
        assertThat(vm.state.value.failed).isTrue()
        assertThat(vm.ids).isEmpty()
        repository.pages[SavedRead("sol", null)] = page(person("u3", "sol"))
        vm.refresh()
        assertThat(vm.state.value.failed).isFalse()
        assertThat(vm.ids).containsExactly("u3")
        assertThat(vm.state.value.query).isEqualTo("sol")
    }

    @Test
    fun `a failed next page ends the list with its fault and retry asks it again`() {
        repository.pages[SavedRead("sol", null)] = page(person("u3", "sol"), next = "s1")
        repository.pages[SavedRead("sol", "s1")] = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.search("sol")
        rest()
        vm.loadMore()
        assertThat(vm.state.value.moreFailed).isTrue()
        assertThat(vm.ids).containsExactly("u3")
        repository.pages[SavedRead("sol", "s1")] = page(person("u4", "solveig"))
        vm.retryMore()
        assertThat(vm.state.value.moreFailed).isFalse()
        assertThat(vm.ids).containsExactly("u3", "u4").inOrder()
    }

    @Test
    fun `a pull keeps the query and reads its list again at once`() {
        repository.pages[SavedRead("mira", null)] = page(person("u2", "mira"))
        val vm = viewModel()
        vm.search("mira")
        // The pull does not wait on the typing's pause.
        vm.refresh()
        assertThat(repository.reads.last()).isEqualTo(SavedRead("mira", null))
        assertThat(vm.state.value.query).isEqualTo("mira")
        assertThat(vm.ids).containsExactly("u2")
        rest()
        // The cancelled pause asks nothing more.
        assertThat(repository.reads.count { it.query == "mira" }).isEqualTo(1)
    }

    @Test
    fun `a query past the server's cap stands narrowed to nothing without asking`() {
        val vm = viewModel()
        val long = "a".repeat(SAVED_SEARCH_MAX_CHARS + 1)
        vm.search(long)
        rest()
        assertThat(repository.reads).containsExactly(SavedRead(null, null))
        assertThat(vm.ids).isEmpty()
        assertThat(vm.state.value.narrowedBy).isEqualTo(long)
        // Exactly the cap is asked.
        vm.search("b".repeat(SAVED_SEARCH_MAX_CHARS))
        rest()
        assertThat(repository.reads.last().query).hasLength(SAVED_SEARCH_MAX_CHARS)
    }

    @Test
    fun `a card's share hands over the thing's own address`() {
        val vm = viewModel()
        assertThat(vm.postShareUrl("p1")).isEqualTo("https://cogra.test/posts/p1")
        assertThat(vm.commentShareUrl("p1", "c1")).isEqualTo("https://cogra.test/posts/p1?comment=c1")
        assertThat(vm.profileShareUrl("mira")).isEqualTo("https://cogra.test/u/mira")
    }
}
