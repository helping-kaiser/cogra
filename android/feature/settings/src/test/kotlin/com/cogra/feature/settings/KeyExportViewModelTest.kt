package com.cogra.feature.settings

import com.cogra.crypto.ActorKey
import com.cogra.domain.identity.ExportActorKey
import com.cogra.domain.identity.SecretKind
import com.cogra.domain.testing.FakeIdentityStore
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

@OptIn(ExperimentalCoroutinesApi::class)
class KeyExportViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val identity = FakeIdentityStore()

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel() = KeyExportViewModel(ExportActorKey(identity))

    @Test
    fun nothingIsHeldBeforeTheReveal() = runTest(dispatcher) {
        identity.seed = ActorKey.generate().seed()
        val vm = viewModel()

        assertThat(vm.state.value.secrets).isEmpty()
        assertThat(vm.state.value.revealed).isFalse()
    }

    @Test
    fun theRevealCarriesTheActorKey() = runTest(dispatcher) {
        identity.seed = ActorKey.generate().seed()
        val vm = viewModel()

        vm.onReveal()
        testScheduler.advanceUntilIdle()

        assertThat(vm.state.value.secrets.map { it.kind }).containsExactly(SecretKind.ACTOR_KEY)
        assertThat(vm.state.value.revealed).isTrue()
    }

    @Test
    fun aDeviceWithoutTheKeyRevealsAnEmptyList() = runTest(dispatcher) {
        val vm = viewModel()

        vm.onReveal()
        testScheduler.advanceUntilIdle()

        assertThat(vm.state.value.secrets).isEmpty()
        // Revealed-and-empty is what tells "no key here" from "not yet".
        assertThat(vm.state.value.revealed).isTrue()
    }
}
