package com.cogra.feature.auth

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.testing.ThrowingAccountRepository
import com.google.common.truth.Truth.assertThat
import java.io.IOException
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
    var confirmOutcome: Outcome<Unit> = Outcome.Success(Unit)
    var lastConfirmedToken: String? = null

    override suspend fun requestPasswordReset(email: String): Outcome<Unit> = requestOutcome

    override suspend fun confirmPasswordReset(resetToken: String, newPassword: String): Outcome<Unit> {
        lastConfirmedToken = resetToken
        return confirmOutcome
    }
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

    @Test
    fun aConfirmedResetFlagsCompletion() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onTokenChange(" token-1 ")
        vm.onNewPasswordChange("a strong password")
        vm.onConfirm()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmed).isTrue()
        assertThat(account.lastConfirmedToken).isEqualTo("token-1")
    }

    @Test
    fun anInvalidTokenRefusalSurfacesItsCodeAndTypingClearsIt() = runTest(dispatcher) {
        account.confirmOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.RESET_TOKEN_INVALID, "bad token")))
        val vm = viewModel()
        vm.onTokenChange("stale")
        vm.onNewPasswordChange("a strong password")
        vm.onConfirm()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.error).isEqualTo(ErrorCode.RESET_TOKEN_INVALID)
        assertThat(vm.state.value.confirmed).isFalse()
        vm.onTokenChange("stale2")
        assertThat(vm.state.value.error).isNull()
    }

    @Test
    fun transportFailureIsItsOwnState() = runTest(dispatcher) {
        account.confirmOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.onTokenChange("token")
        vm.onNewPasswordChange("a strong password")
        vm.onConfirm()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.error).isNull()
    }

    @Test
    fun blankFieldsCannotConfirm() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onConfirm()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(account.lastConfirmedToken).isNull()
    }
}
