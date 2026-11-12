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
import java.io.IOException

private class ScriptedReset : ThrowingAccountRepository() {
    var outcome: Outcome<Unit> = Outcome.Success(Unit)
    val sent = mutableListOf<Pair<String, String>>()

    override suspend fun confirmPasswordReset(resetToken: String, newPassword: String): Outcome<Unit> {
        sent += resetToken to newPassword
        return outcome
    }
}

private fun refused(code: ErrorCode) = Outcome.Refused(listOf(UserError(code, code.name)))

/** ResetNew.md, line by line, against the view model. */
@OptIn(ExperimentalCoroutinesApi::class)
class ResetNewViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val account = ScriptedReset()
    private val token = "reset-token-1"

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(password: String = "a strong password", confirm: String = password) =
        ResetNewViewModel(account).apply {
            onPasswordChange(password)
            onConfirmChange(confirm)
        }

    @Test
    fun setTheNewPasswordWaitsUntilBothFieldsHoldACharacter() {
        // ResetNew.md:49-51.
        val vm = ResetNewViewModel(account)
        assertThat(vm.state.value.waiting).isTrue()
        vm.onPasswordChange("a")
        assertThat(vm.state.value.waiting).isTrue()
        vm.onConfirmChange("a")
        assertThat(vm.state.value.waiting).isFalse()
        vm.onSubmit(token)
        assertThat(account.sent).isEmpty()
    }

    @Test
    fun aTakenPasswordOpensSignIn() = runTest(dispatcher) {
        // ResetNew.md:23 — the link's token and the password go out together.
        val vm = viewModel()
        vm.onSubmit(token)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(account.sent).containsExactly(token to "a strong password")
        assertThat(vm.state.value.done).isTrue()
    }

    @Test
    fun aMismatchIsSaidOnRepeatPasswordAndThePasswordNeverChanges() = runTest(dispatcher) {
        // ResetNew.md:27.
        val vm = viewModel(confirm = "a strong passwort")
        vm.onSubmit(token)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmLine).isEqualTo(R.string.reset_new_differ)
        assertThat(vm.state.value.newPasswordLine).isNull()
        assertThat(account.sent).isEmpty()
    }

    @Test
    fun theMismatchLineReChecksAsEitherPasswordChangesAndGoesOnceTheyMatch() = runTest(dispatcher) {
        // ResetNew.md:29.
        val vm = viewModel(confirm = "a strong")
        vm.onSubmit(token)
        vm.onConfirmChange("a strong passwor")
        assertThat(vm.state.value.confirmLine).isEqualTo(R.string.reset_new_differ)
        vm.onConfirmChange("a strong password")
        assertThat(vm.state.value.confirmLine).isNull()
        vm.onConfirmChange("a strong passwordX")
        vm.onSubmit(token)
        assertThat(vm.state.value.confirmLine).isEqualTo(R.string.reset_new_differ)
        vm.onPasswordChange("a strong passwordX")
        assertThat(vm.state.value.confirmLine).isNull()
        assertThat(account.sent).isEmpty()
    }

    @Test
    fun typingNeverMarksAFieldBeforeThePress() {
        // ResetNew.md:35 — only a press raises a line.
        val vm = viewModel(password = "short", confirm = "other")
        assertThat(vm.state.value.newPasswordLine).isNull()
        assertThat(vm.state.value.confirmLine).isNull()
    }

    @Test
    fun theLengthLinesAreSaidOnThePressAndReCheckAsTheTextChanges() = runTest(dispatcher) {
        // ResetNew.md:25, 39.
        val vm = viewModel(password = "short")
        vm.onSubmit(token)
        assertThat(vm.state.value.newPasswordLine).isEqualTo(R.string.reset_new_short)
        vm.onPasswordChange("x".repeat(129))
        assertThat(vm.state.value.newPasswordLine).isEqualTo(R.string.reset_new_long)
        vm.onPasswordChange("long enough now")
        assertThat(vm.state.value.newPasswordLine).isNull()
        assertThat(account.sent).isEmpty()
    }

    @Test
    fun aShortPasswordAndAMismatchAreEachSaidOnTheirOwnField() = runTest(dispatcher) {
        val vm = viewModel(password = "short", confirm = "shorter")
        vm.onSubmit(token)
        assertThat(vm.state.value.newPasswordLine).isEqualTo(R.string.reset_new_short)
        assertThat(vm.state.value.confirmLine).isEqualTo(R.string.reset_new_differ)
    }

    @Test
    fun theBreachLineStandsUntilTheNextPress() = runTest(dispatcher) {
        // ResetNew.md:31, 35.
        account.outcome = refused(ErrorCode.WEAK_PASSWORD)
        val vm = viewModel()
        vm.onSubmit(token)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.newPasswordLine).isEqualTo(R.string.reset_new_breached)
        vm.onPasswordChange("a strong password!")
        assertThat(vm.state.value.newPasswordLine).isEqualTo(R.string.reset_new_breached)
        vm.onConfirmChange("a strong password!")
        account.outcome = Outcome.Success(Unit)
        vm.onSubmit(token)
        assertThat(vm.state.value.newPasswordLine).isNull()
    }

    @Test
    fun noAnswerKeepsBothFieldsAndTheCommitIsTheRetry() = runTest(dispatcher) {
        // ResetNew.md:33.
        account.outcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.onSubmit(token)
        dispatcher.scheduler.advanceUntilIdle()
        val state = vm.state.value
        assertThat(state.fault).isEqualTo(R.string.reset_new_no_answer)
        assertThat(state.password).isEqualTo("a strong password")
        assertThat(state.confirm).isEqualTo("a strong password")
        assertThat(state.inFlight).isFalse()
        assertThat(state.waiting).isFalse()
    }

    @Test
    fun aSpentLinkHandsOnToTheExpiredReading() = runTest(dispatcher) {
        // ResetNew.md:41.
        account.outcome = refused(ErrorCode.RESET_TOKEN_INVALID)
        val vm = viewModel()
        vm.onSubmit(token)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.expired).isTrue()
        assertThat(vm.state.value.done).isFalse()
    }

    @Test
    fun aSecondPressIsRefusedWhileTheResetWaits() = runTest(dispatcher) {
        // ResetNew.md:19.
        val vm = viewModel()
        vm.onSubmit(token)
        assertThat(vm.state.value.inFlight).isTrue()
        vm.onSubmit(token)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(account.sent).hasSize(1)
    }

    @Test
    fun aRateLimitIsSaidAboveTheCommit() = runTest(dispatcher) {
        account.outcome = refused(ErrorCode.RATE_LIMITED)
        val vm = viewModel()
        vm.onSubmit(token)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.reset_new_rate_limited)
    }
}
