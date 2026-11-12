package com.cogra.feature.auth

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.testing.ThrowingAccountRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

private class ScriptedAccount : ThrowingAccountRepository() {
    var requestOutcome: Outcome<Unit> = Outcome.Success(Unit)
    val requested = mutableListOf<String>()
    var gate: CompletableDeferred<Unit>? = null

    override suspend fun requestPasswordReset(email: String): Outcome<Unit> {
        requested += email
        gate?.await()
        return requestOutcome
    }
}

/** Reset.md's lines against the view model. */
@OptIn(ExperimentalCoroutinesApi::class)
class PasswordResetViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val account = ScriptedAccount()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = PasswordResetViewModel(account)

    @Test
    fun theStatusLineStandsOnlyAfterAPressWasAnswered() = runTest(dispatcher) {
        // Reset.md:11, :31 — never at rest; the answer is the same either way.
        val vm = viewModel()
        assertThat(vm.state.value.requested).isFalse()
        vm.onEmailChange(" user@example.com ")
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.requested).isTrue()
        assertThat(vm.state.value.fault).isNull()
        assertThat(account.requested).containsExactly("user@example.com")
    }

    @Test
    fun anEmptyEmailWaitsAndTheFirstCharacterWakesTheCommit() = runTest(dispatcher) {
        // Reset.md:35-37.
        val vm = viewModel()
        assertThat(vm.state.value.waiting).isTrue()
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(account.requested).isEmpty()
        vm.onEmailChange("a")
        assertThat(vm.state.value.waiting).isFalse()
    }

    @Test
    fun theCommitRefusesASecondPressUntilTheRequestAnswers() = runTest(dispatcher) {
        // Reset.md:5.
        account.gate = CompletableDeferred()
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.inFlight).isTrue()
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(account.requested).hasSize(1)
        account.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.inFlight).isFalse()
    }

    @Test
    fun noAnswerKeepsTheFieldAndStandsTheNoSendLine() = runTest(dispatcher) {
        // Reset.md:19.
        account.requestOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.reset_no_answer)
        assertThat(vm.state.value.email).isEqualTo("user@example.com")
        assertThat(vm.state.value.requested).isFalse()
    }

    @Test
    fun aRateLimitedRequestSaysSoInPlaceAndSendsNothingItClaims() = runTest(dispatcher) {
        // copy-voice "Faults by code" RATE_LIMITED: the per-IP window refuses visibly.
        account.requestOutcome = Outcome.Refused(listOf(UserError(ErrorCode.RATE_LIMITED, "slow down")))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.requested).isFalse()
        assertThat(vm.state.value.fault).isEqualTo(R.string.reset_rate_limited)
    }

    @Test
    fun aPressClearsTheLastFault() = runTest(dispatcher) {
        account.requestOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        account.requestOutcome = Outcome.Success(Unit)
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isNull()
        assertThat(vm.state.value.requested).isTrue()
    }
}
