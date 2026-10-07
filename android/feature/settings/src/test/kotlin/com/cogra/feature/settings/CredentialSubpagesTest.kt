// The credential subpages' ViewModels as JVM tests, named after the
// packet's §8.2 behavior lines (settings-surface).

package com.cogra.feature.settings

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.settings.AccountEmail
import com.cogra.domain.settings.EmailChangeLinkCheck
import com.cogra.domain.settings.EmailChangeLinkState
import com.cogra.domain.testing.ThrowingAccountRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

private fun refused(code: ErrorCode) = Outcome.Refused(listOf(UserError(code, code.name)))

@OptIn(ExperimentalCoroutinesApi::class)
class CredentialSubpagesTest {

    private val dispatcher = StandardTestDispatcher()
    private val settings = ScriptedSettings()

    private val account = object : ThrowingAccountRepository() {
        var password: Outcome<Unit> = Outcome.Success(Unit)
        var handle: Outcome<Unit> = Outcome.Success(Unit)
        val handles = mutableListOf<String>()

        override suspend fun changePassword(currentPassword: String, newPassword: String) = password

        override suspend fun changeHandle(handle: String): Outcome<Unit> {
            handles += handle
            return this.handle
        }
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    // ---------------------------------------------------- ChangePassword

    private fun password() = ChangePasswordViewModel(account, settings).also { idle() }

    @Test
    fun `change_password_waits_for_both_fields`() = runTest(dispatcher) {
        val vm = password()
        assertThat(vm.state.value.waiting).isTrue()
        vm.onCurrent("saltmarsh-tide")
        assertThat(vm.state.value.waiting).isTrue()
        vm.onNew("x")
        assertThat(vm.state.value.waiting).isFalse()
    }

    @Test
    fun `form_opens_unmarked_and_typing_never_marks`() = runTest(dispatcher) {
        val vm = password()
        vm.onCurrent("a")
        vm.onNew("short")
        assertThat(vm.state.value.newError).isNull()
        assertThat(vm.state.value.currentError).isNull()
    }

    @Test
    fun `short_or_long_new_password_rechecks_live`() = runTest(dispatcher) {
        val vm = password()
        vm.onCurrent("saltmarsh-tide")
        vm.onNew("short")
        vm.onCommit()
        assertThat(vm.state.value.newError).isEqualTo(R.string.password_too_short)
        vm.onNew("x".repeat(129))
        assertThat(vm.state.value.newError).isEqualTo(R.string.password_too_long)
        vm.onNew("long-enough-now")
        assertThat(vm.state.value.newError).isNull()
    }

    @Test
    fun `wrong_current_password_reads_on_its_field_until_the_next_press`() = runTest(dispatcher) {
        account.password = refused(ErrorCode.INVALID_CREDENTIALS)
        val vm = password()
        vm.onCurrent("wrong-password")
        vm.onNew("a-new-long-password")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.currentError).isEqualTo(R.string.wrong_password)
        vm.onCurrent("wrong-passwor")
        assertThat(vm.state.value.currentError).isEqualTo(R.string.wrong_password)
    }

    @Test
    fun `breached_password_line_stands_until_the_next_press`() = runTest(dispatcher) {
        account.password = refused(ErrorCode.WEAK_PASSWORD)
        val vm = password()
        vm.onCurrent("saltmarsh-tide")
        vm.onNew("password123456")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.newError).isEqualTo(R.string.password_breached)
        vm.onNew("password1234567")
        assertThat(vm.state.value.newError).isEqualTo(R.string.password_breached)
    }

    @Test
    fun `offline_press_answers_in_slot_and_keeps_both_fields`() = runTest(dispatcher) {
        account.password = Outcome.Failed(IOException("offline"))
        val vm = password()
        vm.onCurrent("saltmarsh-tide")
        vm.onNew("a-new-long-password")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.network_error)
        assertThat(vm.state.value.current).isEqualTo("saltmarsh-tide")
        assertThat(vm.state.value.newPassword).isEqualTo("a-new-long-password")
    }

    @Test
    fun aTrippedReauthBudgetReadsB7sLineAboveTheCommit() = runTest(dispatcher) {
        account.password = refused(ErrorCode.RATE_LIMITED)
        val vm = password()
        vm.onCurrent("saltmarsh-tide")
        vm.onNew("a-new-long-password")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.rate_limited)
    }

    @Test
    fun `success_returns_to_settings_with_the_snackbar_and_new_age`() = runTest(dispatcher) {
        val vm = password()
        vm.onCurrent("saltmarsh-tide")
        vm.onNew("a-new-long-password")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.done).isTrue()
    }

    @Test
    fun `current_password_names_the_account_by_hidden_username`() = runTest(dispatcher) {
        val vm = password()
        assertThat(vm.state.value.account).isEqualTo("sol@solferreira.art")
    }

    // ------------------------------------------------------ ChangeHandle

    private fun handle() = ChangeHandleViewModel(account, settings).also { idle() }

    @Test
    fun `change_handle_waits_for_a_character`() = runTest(dispatcher) {
        val vm = handle()
        assertThat(vm.state.value.waiting).isTrue()
        vm.onHandle("S")
        assertThat(vm.state.value.handle).isEqualTo("s")
        assertThat(vm.state.value.waiting).isFalse()
    }

    @Test
    fun `malformed_handle_reads_the_format_line_and_never_opens_the_dialog`() = runTest(dispatcher) {
        val vm = handle()
        vm.onHandle("so")
        vm.onCommit()
        assertThat(vm.state.value.error).isEqualTo(R.string.change_handle_malformed)
        assertThat(vm.state.value.dialogOpen).isFalse()
    }

    @Test
    fun `format_line_rechecks_live`() = runTest(dispatcher) {
        val vm = handle()
        vm.onHandle("so")
        vm.onCommit()
        vm.onHandle("sol_f")
        assertThat(vm.state.value.error).isNull()
    }

    @Test
    fun `well_formed_handle_opens_the_dialog_naming_it`() = runTest(dispatcher) {
        val vm = handle()
        vm.onHandle("solferreira")
        vm.onCommit()
        assertThat(vm.state.value.dialogOpen).isTrue()
        assertThat(vm.state.value.current).isEqualTo("sol")
    }

    @Test
    fun `taken_handle_closes_the_dialog_onto_the_field_line`() = runTest(dispatcher) {
        account.handle = refused(ErrorCode.HANDLE_TAKEN)
        val vm = handle()
        vm.onHandle("solferreira")
        vm.onCommit()
        vm.onChangeIt()
        idle()
        assertThat(vm.state.value.dialogOpen).isFalse()
        assertThat(vm.state.value.error).isEqualTo(R.string.change_handle_taken)
        assertThat(vm.state.value.changedTo).isNull()
    }

    @Test
    fun `offline_change_it_reads_retry_with_the_line_in_the_dialog`() = runTest(dispatcher) {
        account.handle = Outcome.Failed(IOException("offline"))
        val vm = handle()
        vm.onHandle("solferreira")
        vm.onCommit()
        vm.onChangeIt()
        idle()
        assertThat(vm.state.value.dialogOpen).isTrue()
        assertThat(vm.state.value.dialogFault).isTrue()
    }

    @Test
    fun `keep_it_scrim_back_escape_are_locked_in_flight`() = runTest(dispatcher) {
        val vm = handle()
        vm.onHandle("solferreira")
        vm.onCommit()
        vm.onChangeIt()
        // In flight: Keep it is refused, and a second Change it is too.
        vm.onKeep()
        vm.onChangeIt()
        assertThat(vm.state.value.dialogOpen).isTrue()
        idle()
        assertThat(account.handles).containsExactly("solferreira")
    }

    @Test
    fun `keep_it_closes_onto_the_form_with_the_handle_still_typed`() = runTest(dispatcher) {
        val vm = handle()
        vm.onHandle("solferreira")
        vm.onCommit()
        vm.onKeep()
        assertThat(vm.state.value.dialogOpen).isFalse()
        assertThat(vm.state.value.handle).isEqualTo("solferreira")
        assertThat(account.handles).isEmpty()
    }

    @Test
    fun `success_returns_with_your_handle_is_now_snackbar`() = runTest(dispatcher) {
        val vm = handle()
        vm.onHandle("solferreira")
        vm.onCommit()
        vm.onChangeIt()
        idle()
        assertThat(vm.state.value.changedTo).isEqualTo("solferreira")
    }

    // ------------------------------------------------------- ChangeEmail

    private fun email() = ChangeEmailViewModel(settings).also { idle() }

    @Test
    fun `change_email_waits_for_both_fields`() = runTest(dispatcher) {
        val vm = email()
        vm.onNewEmail("sol@ferreira.studio")
        assertThat(vm.state.value.waiting).isTrue()
        vm.onPassword("x")
        assertThat(vm.state.value.waiting).isFalse()
    }

    @Test
    fun `malformed_address_reads_on_the_press_then_rechecks_live`() = runTest(dispatcher) {
        val vm = email()
        vm.onNewEmail("sol@ferreira")
        vm.onPassword("saltmarsh-tides")
        assertThat(vm.state.value.malformed).isFalse()
        vm.onCommit()
        assertThat(vm.state.value.chip).isEqualTo(EmailFault.MALFORMED)
        vm.onNewEmail("sol@ferreira.studio")
        assertThat(vm.state.value.malformed).isFalse()
    }

    @Test
    fun `wrong_password_reads_on_the_field_and_sends_nothing`() = runTest(dispatcher) {
        settings.request = refused(ErrorCode.INVALID_CREDENTIALS)
        val vm = email()
        vm.onNewEmail("sol@ferreira.studio")
        vm.onPassword("wrong")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.chip).isEqualTo(EmailFault.PASSWORD)
        assertThat(vm.state.value.sentTo).isNull()
    }

    @Test
    fun `mail_budget_line_stands_above_change_email`() = runTest(dispatcher) {
        settings.request = refused(ErrorCode.RATE_LIMITED)
        val vm = email()
        vm.onNewEmail("sol@ferreira.studio")
        vm.onPassword("saltmarsh-tides")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.rate_limited)
    }

    @Test
    fun `offline_press_answers_in_slot`() = runTest(dispatcher) {
        settings.request = Outcome.Failed(IOException("offline"))
        val vm = email()
        vm.onNewEmail("sol@ferreira.studio")
        vm.onPassword("saltmarsh-tides")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.network_error)
        assertThat(vm.state.value.newEmail).isEqualTo("sol@ferreira.studio")
    }

    @Test
    fun `success_opens_the_confirmation_and_row_reads_change_pending`() = runTest(dispatcher) {
        val vm = email()
        vm.onNewEmail("sol@ferreira.studio")
        vm.onPassword("saltmarsh-tides")
        vm.onCommit()
        idle()
        assertThat(vm.state.value.sentTo).isEqualTo("sol@ferreira.studio")
    }

    // ------------------------------------------------ ChangeEmailConfirm

    private fun confirm() = ChangeEmailConfirmViewModel(settings)

    @Test
    fun `reopen_lands_on_the_owed_side`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending(linkConfirmed = true)))
        val vm = confirm()
        idle()
        assertThat(vm.state.value.codeOwed).isTrue()
        assertThat(vm.state.value.pending?.linkConfirmed).isTrue()
    }

    @Test
    fun codeConfirmedTakesTheFieldAndCommitAway() = runTest(dispatcher) {
        // G3 ruled: once the code's side is confirmed the field and commit go.
        settings.read = Outcome.Success(account(pendingEmailChange = pending(codeConfirmed = true)))
        val vm = confirm()
        idle()
        assertThat(vm.state.value.codeOwed).isFalse()
    }

    @Test
    fun `right_code_with_link_done_moves_the_address_with_snackbar`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending(linkConfirmed = true)))
        settings.confirm = Outcome.Success(AccountEmail("sol@ferreira.studio", null))
        val vm = confirm()
        idle()
        val events = mutableListOf<ConfirmEmailEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onCode("123456")
        vm.onConfirm()
        idle()
        assertThat(events).contains(ConfirmEmailEvent.Exit(ConfirmEmailExit.Applied("sol@ferreira.studio")))
        collecting.cancel()
    }

    @Test
    fun `wrong_code_reads_that_code_doesnt_check_out`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        settings.confirm = refused(ErrorCode.VERIFICATION_TOKEN_INVALID)
        val vm = confirm()
        idle()
        vm.onCode("123456")
        vm.onConfirm()
        idle()
        assertThat(vm.state.value.codeError).isEqualTo(R.string.confirm_email_wrong_code)
    }

    @Test
    fun `disabled_code_line_stands_until_a_fresh_code_is_sent`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        settings.confirm = refused(ErrorCode.EMAIL_CHANGE_CODE_DISABLED)
        val vm = confirm()
        idle()
        vm.onCode("123456")
        vm.onConfirm()
        idle()
        assertThat(vm.state.value.codeError).isEqualTo(R.string.confirm_email_code_disabled)
        vm.onCode("12345")
        assertThat(vm.state.value.codeError).isEqualTo(R.string.confirm_email_code_disabled)
        vm.onResend()
        idle()
        assertThat(vm.state.value.codeError).isNull()
    }

    @Test
    fun `ran_out_fault_line_above_the_commit`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        settings.confirm = refused(ErrorCode.EMAIL_CHANGE_EXPIRED)
        val vm = confirm()
        idle()
        vm.onCode("123456")
        vm.onConfirm()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.confirm_email_ran_out)
    }

    @Test
    fun `taken_fault_line_and_retry_applies_when_freed`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending(linkConfirmed = true)))
        settings.confirm = refused(ErrorCode.EMAIL_IN_USE)
        val vm = confirm()
        idle()
        val events = mutableListOf<ConfirmEmailEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onCode("123456")
        vm.onConfirm()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.confirm_email_taken)
        settings.confirm = Outcome.Success(AccountEmail("sol@ferreira.studio", null))
        vm.onConfirm()
        idle()
        assertThat(events).contains(ConfirmEmailEvent.Exit(ConfirmEmailExit.Applied("sol@ferreira.studio")))
        collecting.cancel()
    }

    private suspend fun resendSnackbar(owed: com.cogra.domain.settings.PendingEmailChange): ConfirmEmailEvent? {
        settings.read = Outcome.Success(account(pendingEmailChange = owed))
        val vm = confirm()
        idle()
        val events = mutableListOf<ConfirmEmailEvent>()
        val collecting = kotlinx.coroutines.CoroutineScope(dispatcher).launch { vm.events.toList(events) }
        vm.onResend()
        idle()
        collecting.cancel()
        return events.firstOrNull()
    }

    @Test
    fun `resend_both_waiting_snackbar`() = runTest(dispatcher) {
        assertThat(resendSnackbar(pending())).isEqualTo(ConfirmEmailEvent.Snackbar(R.string.confirm_email_resent_both))
    }

    @Test
    fun `resend_link_confirmed_mails_only_the_code`() = runTest(dispatcher) {
        assertThat(resendSnackbar(pending(linkConfirmed = true)))
            .isEqualTo(ConfirmEmailEvent.Snackbar(R.string.confirm_email_resent_code, "sol@solferreira.art"))
    }

    @Test
    fun `resend_code_confirmed_mails_only_the_link`() = runTest(dispatcher) {
        assertThat(resendSnackbar(pending(codeConfirmed = true)))
            .isEqualTo(ConfirmEmailEvent.Snackbar(R.string.confirm_email_resent_link, "sol@ferreira.studio"))
    }

    @Test
    fun `resend_budget_spent_line_and_no_snackbar`() = runTest(dispatcher) {
        settings.resend = refused(ErrorCode.RATE_LIMITED)
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        val vm = confirm()
        idle()
        val events = mutableListOf<ConfirmEmailEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onResend()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.rate_limited)
        assertThat(events).isEmpty()
        collecting.cancel()
    }

    @Test
    fun `resend_offline_opens_network_error`() = runTest(dispatcher) {
        settings.resend = Outcome.Failed(IOException("offline"))
        assertThat(resendSnackbar(pending())).isEqualTo(ConfirmEmailEvent.Snackbar(R.string.network_error))
    }

    @Test
    fun `cancel_returns_with_change_canceled_snackbar`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        val vm = confirm()
        idle()
        val events = mutableListOf<ConfirmEmailEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onCancel()
        idle()
        assertThat(events).contains(ConfirmEmailEvent.Exit(ConfirmEmailExit.Canceled("sol@solferreira.art")))
        collecting.cancel()
    }

    @Test
    fun `cancel_offline_keeps_the_change`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        settings.cancel = Outcome.Failed(IOException("offline"))
        val vm = confirm()
        idle()
        val events = mutableListOf<ConfirmEmailEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onCancel()
        idle()
        assertThat(events).containsExactly(ConfirmEmailEvent.Snackbar(R.string.network_error))
        assertThat(vm.state.value.pending).isNotNull()
        collecting.cancel()
    }

    @Test
    fun `confirm_ip_rate_limited_line`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        settings.confirm = refused(ErrorCode.RATE_LIMITED)
        val vm = confirm()
        idle()
        vm.onCode("123456")
        vm.onConfirm()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.rate_limited)
    }

    // ------------------------------------------- ChangeEmailLinked(+SignedOut)

    private fun linked(signedIn: Boolean) = ChangeEmailLinkedViewModel(settings).also {
        it.start("tok", signedIn)
        idle()
    }

    @Test
    fun `first_side_reads_new_address_confirmed_and_enter_the_code`() = runTest(dispatcher) {
        settings.confirm = Outcome.Success(AccountEmail("sol@solferreira.art", pending(linkConfirmed = true)))
        assertThat(linked(true).state.value).isEqualTo(LinkedLanding.First("sol@solferreira.art"))
    }

    @Test
    fun `last_side_reads_email_changed_and_back_to_settings`() = runTest(dispatcher) {
        settings.confirm = Outcome.Success(AccountEmail("sol@ferreira.studio", null))
        assertThat(linked(true).state.value).isEqualTo(LinkedLanding.Last("sol@ferreira.studio"))
    }

    @Test
    fun `canceled_link_landing`() = runTest(dispatcher) {
        settings.confirm = refused(ErrorCode.EMAIL_CHANGE_CANCELED)
        assertThat(linked(true).state.value).isEqualTo(LinkedLanding.Canceled("sol@solferreira.art"))
    }

    @Test
    fun `applied_again_landing`() = runTest(dispatcher) {
        settings.confirm = refused(ErrorCode.EMAIL_CHANGE_ALREADY_APPLIED)
        assertThat(linked(true).state.value).isEqualTo(LinkedLanding.AppliedAgain("sol@solferreira.art"))
    }

    @Test
    fun `ran_out_landing`() = runTest(dispatcher) {
        settings.confirm = refused(ErrorCode.EMAIL_CHANGE_EXPIRED)
        assertThat(linked(true).state.value).isEqualTo(LinkedLanding.RanOut("sol@solferreira.art"))
    }

    @Test
    fun takenLanding() = runTest(dispatcher) {
        settings.confirm = refused(ErrorCode.EMAIL_IN_USE)
        assertThat(linked(true).state.value).isEqualTo(LinkedLanding.Taken)
    }

    @Test
    fun `other_account_landing_never_switches`() = runTest(dispatcher) {
        settings.confirm = refused(ErrorCode.EMAIL_CHANGE_OTHER_ACCOUNT)
        assertThat(linked(true).state.value).isEqualTo(LinkedLanding.OtherAccount)
    }

    @Test
    fun `signed_in_landing_never_calls_the_check`() = runTest(dispatcher) {
        settings.confirm = Outcome.Success(AccountEmail("sol@ferreira.studio", null))
        linked(true)
        assertThat(settings.checks).isEqualTo(0)
        assertThat(settings.confirmed).containsExactly("tok")
    }

    @Test
    fun `signed_out_landing_names_the_new_address_from_the_check`() = runTest(dispatcher) {
        settings.check = Outcome.Success(EmailChangeLinkCheck("sol@ferreira.studio", EmailChangeLinkState.PENDING))
        val vm = linked(false)
        assertThat(vm.state.value).isEqualTo(LinkedLanding.SignedOut("sol@ferreira.studio"))
        // Nothing applies before sign-in.
        assertThat(settings.confirmed).isEmpty()
    }

    @Test
    fun `signed_out_landing_never_prints_the_current_address`() = runTest(dispatcher) {
        settings.check = Outcome.Success(EmailChangeLinkCheck("sol@ferreira.studio", EmailChangeLinkState.APPLIED))
        assertThat(linked(false).state.value).isEqualTo(LinkedLanding.Dead(signedIn = false))
        settings.check = Outcome.Success(null)
        assertThat(linked(false).state.value).isEqualTo(LinkedLanding.Dead(signedIn = false))
    }
}
