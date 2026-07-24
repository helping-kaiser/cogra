package com.cogra.feature.home

import com.cogra.crypto.ActorKey
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.UserProfile
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
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

private class ScriptedAccount : ThrowingAccountRepository() {
    var profile: UserProfile? =
        UserProfile("u1", "joiner", "joiner", invitedBy = ActorRef("inv1", "inviter"))

    override suspend fun me(): Outcome<UserProfile?> = Outcome.Success(profile)
}

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val account = ScriptedAccount()
    private val writes = SealingWriteRepository(actor)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = HomeViewModel(account, writes, WriteSigner(writes, identity), identity)

    @Test
    fun theFirstLoginShowsTheReciprocationPrompt() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.reciprocationTarget?.handle).isEqualTo("inviter")
        assertThat(vm.state.value.huskWarning).isFalse()
    }

    @Test
    fun reciprocatingSignsAndRemembers() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onReciprocate()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.reciprocated).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
        assertThat(identity.reciprocationDone).isTrue()

        // A fresh view model never prompts again.
        val next = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(next.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun dismissalIsRememberedToo() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissReciprocation()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.reciprocationDone).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun aMissingActorKeyShowsTheHuskWarningAndNoPrompt() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.huskWarning).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun genesisActorsGetNoPrompt() = runTest(dispatcher) {
        account.profile = UserProfile("u1", "genesis", null, invitedBy = null)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun parkedHandshakesSurfaceAndResume() = runTest(dispatcher) {
        val pre = actor.preSign(
            com.cogra.crypto.decodeProposal(com.cogra.domain.testing.testProposalBytes(actor, 9u)),
        )
        identity.saveHandshake("w9", pre)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.pendingHandshakes).isEqualTo(1)

        // The staged write is gone server-side; resume clears the material.
        vm.onResumePending()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.pendingHandshakes).isEqualTo(0)
    }
}
