package com.cogra.feature.auth

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
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
    var requestOutcome: Outcome<Unit> = Outcome.Success(Unit)

    override suspend fun requestPasswordReset(email: String): Outcome<Unit> = requestOutcome
}

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
    fun aRequestAlwaysReportsRequested() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onEmailChange(" user@example.com ")
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.requested).isTrue()

        // The silent verb: a refusal still reads as "check your mail"
        // (no account enumeration).
        account.requestOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "malformed")))
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.requested).isTrue()
        assertThat(vm.state.value.error).isNull()
    }

    @Test
    fun aRateLimitedRequestShowsItsRefusalNotTheCheckMailNote() = runTest(dispatcher) {
        // The one exception to the silent posture: a rate limit sent
        // nothing and reveals nothing about the account.
        account.requestOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.RATE_LIMITED, "slow down")))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onRequest()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.requested).isFalse()
        assertThat(vm.state.value.error).isEqualTo(ErrorCode.RATE_LIMITED)
    }
}
