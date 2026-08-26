package com.cogra.feature.content

import com.cogra.crypto.ActorKey
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingTopicRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private const val TARGET = "post-1"

@OptIn(ExperimentalCoroutinesApi::class)
class TopicChipRowViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val writes = SealingWriteRepository(actor)

    /** Records exactly what the row asked for — target, name, pDirected. */
    private val topics = object : ThrowingTopicRepository() {
        val calls = mutableListOf<Triple<String, String, Double?>>()
        var prepareOutcome: Outcome<List<PreparedWriteView>>? = null

        override suspend fun prepareTag(
            target: String,
            name: String,
            pDirected: Double?,
            pInterest: Double?,
        ): Outcome<List<PreparedWriteView>> {
            calls += Triple(target, name, pDirected)
            return prepareOutcome ?: writes.prepareStance(target, pDirected ?: 0.1, pInterest ?: 1.0)
        }
    }

    private fun viewModel() = TopicChipRowViewModel(topics, WriteSigner(writes, identity))

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun addingATagOpensTheFieldThenStagesAndClosesOnSuccess() = runTest(dispatcher) {
        val vm = viewModel()
        var changed = 0
        vm.onOpenAdd(TARGET)
        assertThat(vm.state.value.getValue(TARGET).adding).isTrue()

        vm.onAddInputChange(TARGET, "#Rust")
        vm.onConfirmAdd(TARGET) { changed += 1 }
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.calls).containsExactly(Triple(TARGET, "rust", null))
        assertThat(vm.state.value.getValue(TARGET).adding).isFalse()
        assertThat(changed).isEqualTo(1)
    }

    @Test
    fun removingATagStagesRelevanceZero() = runTest(dispatcher) {
        val vm = viewModel()
        var changed = 0
        vm.onRemoveTag(TARGET, "rust") { changed += 1 }
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.calls).containsExactly(Triple(TARGET, "rust", 0.0))
        assertThat(changed).isEqualTo(1)
    }

    @Test
    fun aBlankEntryStagesNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onOpenAdd(TARGET)
        vm.onAddInputChange(TARGET, "   ")
        vm.onConfirmAdd(TARGET) {}
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(topics.calls).isEmpty()
    }

    @Test
    fun aKeylessDeviceMarksTheAddFailureAsNeedsKey() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        vm.onOpenAdd(TARGET)
        vm.onAddInputChange(TARGET, "rust")
        vm.onConfirmAdd(TARGET) {}
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.getValue(TARGET).failed).isTrue()
        assertThat(vm.state.value.getValue(TARGET).needsKey).isTrue()
    }

    @Test
    fun dismissingTheAddFieldClearsTheDraft() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onOpenAdd(TARGET)
        vm.onAddInputChange(TARGET, "rust")
        vm.onDismissAdd(TARGET)

        assertThat(vm.state.value.getValue(TARGET).adding).isFalse()
        assertThat(vm.state.value.getValue(TARGET).addInput).isEmpty()
    }
}
