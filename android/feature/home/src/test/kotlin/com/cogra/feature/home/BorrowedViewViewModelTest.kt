package com.cogra.feature.home

import com.cogra.crypto.ActorKey
import com.cogra.domain.ActorRef
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationSigner
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class ScriptedVantage : ThrowingAccountRepository() {
    var answer: Outcome<ActorRef?> = Outcome.Success(ActorRef("a1", "genesis_mod"))
    var reads = 0

    override suspend fun borrowedView(): Outcome<ActorRef?> {
        reads += 1
        return answer
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class BorrowedViewViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val account = ScriptedVantage()
    private val identity = FakeIdentityStore().apply { seed = ActorKey.generate().seed() }
    private val onboarding = ThrowingOnboardingRepository()
    private val loopScope = CoroutineScope(dispatcher + SupervisorJob())

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        loopScope.cancel()
        Dispatchers.resetMain()
    }

    /** The flow is never poked here; only its progress channel is read. */
    private fun registrationFlow() = RegistrationFlow(
        RegistrationSigner(
            onboarding,
            WriteSigner(ThrowingWriteRepository(), identity),
            identity,
            KeyCeremony(identity, onboarding, account),
        ),
        loopScope,
        FakeTokenStore(),
    )

    @Test
    fun theVantageIsReadOnceAtOpenAndNamed() = runTest(dispatcher) {
        val viewModel = BorrowedViewViewModel(account, registrationFlow())
        advanceUntilIdle()

        assertThat(account.reads).isEqualTo(1)
        assertThat(viewModel.state.value.loading).isFalse()
        assertThat(viewModel.state.value.vantage?.handle).isEqualTo("genesis_mod")
    }

    /**
     * The band is an honesty label over a feed already on screen, so a
     * read that did not answer must leave it off rather than put an
     * unanswered name under the bar.
     */
    @Test
    fun aRefusedReadNamesNobody() = runTest(dispatcher) {
        account.answer = Outcome.Refused(listOf(UserError(ErrorCode.INTERNAL, "unavailable")))
        val viewModel = BorrowedViewViewModel(account, registrationFlow())
        advanceUntilIdle()

        assertThat(viewModel.state.value.loading).isFalse()
        assertThat(viewModel.state.value.vantage).isNull()
    }

    /** A null answer is the landed member's own view, and the band goes. */
    @Test
    fun aReaderWithTheirOwnViewIsNamedNoVantage() = runTest(dispatcher) {
        account.answer = Outcome.Success(null)
        val viewModel = BorrowedViewViewModel(account, registrationFlow())
        advanceUntilIdle()

        assertThat(viewModel.state.value.vantage).isNull()
    }
}
