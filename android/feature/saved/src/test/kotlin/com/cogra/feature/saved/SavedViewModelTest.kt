// Saved's reads (Saved.md): the first page and the reader's pull, the next
// page as the reader nears the tail, and — because the bookmarks contract
// takes no query — a standing search walking the rest of the saved set in.

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
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingSavedRepository
import com.cogra.domain.testing.SavedRead
import com.google.common.truth.Truth.assertThat
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

    @Before
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

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

    private fun viewModel() = SavedViewModel(
        repository,
        SavedWrites(
            repository,
            FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") },
            CoroutineScope(Dispatchers.Unconfined),
        ),
        SensitiveReveals(),
        "https://cogra.test",
    )

    @Test
    fun `a search reads the whole saved set across pages`() {
        repository.pages[SavedRead(null, null)] = Outcome.Success(SavedPage(listOf(person("u1", "ada")), "c1", hasNextPage = true))
        repository.pages[SavedRead(null, "c1")] = Outcome.Success(SavedPage(listOf(person("u2", "mira")), "c2", hasNextPage = true))
        repository.pages[SavedRead(null, "c2")] = Outcome.Success(SavedPage(listOf(person("u3", "sol")), null, hasNextPage = false))
        val vm = viewModel()
        assertThat(vm.state.value.entries.map { it.id }).containsExactly("u1")
        vm.search("sol")
        assertThat(vm.state.value.entries.map { it.id }).containsExactly("u1", "u2", "u3").inOrder()
        assertThat(vm.state.value.hasNextPage).isFalse()
        assertThat(vm.state.value.query).isEqualTo("sol")
    }

    @Test
    fun `a blank query walks nothing in`() {
        repository.pages[SavedRead(null, null)] = Outcome.Success(SavedPage(listOf(person("u1", "ada")), "c1", hasNextPage = true))
        val vm = viewModel()
        vm.search("   ")
        assertThat(vm.state.value.entries.map { it.id }).containsExactly("u1")
        assertThat(vm.state.value.hasNextPage).isTrue()
    }

    @Test
    fun `a failed page during a search ends the list with its fault and retry walks on`() {
        repository.pages[SavedRead(null, null)] = Outcome.Success(SavedPage(listOf(person("u1", "ada")), "c1", hasNextPage = true))
        repository.pages[SavedRead(null, "c1")] = Outcome.Failed(IOException("down"))
        val vm = viewModel()
        vm.search("sol")
        assertThat(vm.state.value.moreFailed).isTrue()
        assertThat(vm.state.value.entries.map { it.id }).containsExactly("u1")
        repository.pages[SavedRead(null, "c1")] = Outcome.Success(SavedPage(listOf(person("u3", "sol")), null, hasNextPage = false))
        vm.retryMore()
        assertThat(vm.state.value.moreFailed).isFalse()
        assertThat(vm.state.value.entries.map { it.id }).containsExactly("u1", "u3").inOrder()
    }

    @Test
    fun `a pull keeps the query and walks the set in again`() {
        repository.pages[SavedRead(null, null)] = Outcome.Success(SavedPage(listOf(person("u1", "ada")), "c1", hasNextPage = true))
        repository.pages[SavedRead(null, "c1")] = Outcome.Success(SavedPage(listOf(person("u2", "mira")), null, hasNextPage = false))
        val vm = viewModel()
        vm.search("mira")
        vm.refresh()
        assertThat(vm.state.value.query).isEqualTo("mira")
        assertThat(vm.state.value.entries.map { it.id }).containsExactly("u1", "u2").inOrder()
    }

    @Test
    fun `a card's share hands over the thing's own address`() {
        val vm = viewModel()
        assertThat(vm.postShareUrl("p1")).isEqualTo("https://cogra.test/posts/p1")
        assertThat(vm.commentShareUrl("p1", "c1")).isEqualTo("https://cogra.test/posts/p1?comment=c1")
        assertThat(vm.profileShareUrl("mira")).isEqualTo("https://cogra.test/u/mira")
    }
}
