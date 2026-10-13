// The account deletion's ViewModels as plain JVM tests: the request
// screen's two cases keyed on the server's path, the mail screen's Resend,
// the grace page's Cancel and the link landing's confirm and sweep.

package com.cogra.feature.settings

import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.deletion.DeletionStanding
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ScriptedAccountDeletionRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
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

@OptIn(ExperimentalCoroutinesApi::class)
class DeletionViewModelsTest {

    private val dispatcher = StandardTestDispatcher()
    private val deletions = ScriptedAccountDeletionRepository()
    private val standing = AccountDeletionState(deletions)
    private val tokens = FakeTokenStore()
    private val identity = FakeIdentityStore()
    private val settings = ScriptedSettings()
    private val grace = AccountDeletion(NOW.plusSeconds(7 * 86_400), includesContent = false)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    private fun path(path: AccountDeletionPath, deletion: AccountDeletion? = null) {
        deletions.standing = Outcome.Success(DeletionStanding(path, deletion))
    }

    private fun request() = DeleteAccountViewModel(deletions, standing, EndLocalSession(identity, tokens))

    private val rateLimited = Outcome.Refused(listOf(UserError(ErrorCode.RATE_LIMITED, "slow down")))

    // ------------------------------------------------------- the request

    @Test
    fun `by_link_draws_the_members_request_and_immediate_the_applicants`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK)
        val member = request()
        idle()
        assertThat(member.state.value.case).isEqualTo(DeleteAccountCase.MEMBER)

        path(AccountDeletionPath.IMMEDIATE)
        val applicant = request()
        idle()
        assertThat(applicant.state.value.case).isEqualTo(DeleteAccountCase.APPLICANT)
    }

    @Test
    fun `a_locked_path_sends_the_reader_back_and_draws_no_case`() = runTest(dispatcher) {
        path(AccountDeletionPath.LOCKED)
        val vm = request()
        val events = mutableListOf<DeleteAccountEvent>()
        val collecting = launch { vm.events.toList(events) }
        idle()
        assertThat(events).containsExactly(DeleteAccountEvent.Locked)
        assertThat(vm.state.value.case).isNull()
        collecting.cancel()
    }

    @Test
    fun `an_unanswered_path_read_offers_the_retry`() = runTest(dispatcher) {
        deletions.standing = Outcome.Failed(IOException("offline"))
        val vm = request()
        idle()
        assertThat(vm.state.value.unreachable).isTrue()
        path(AccountDeletionPath.BY_LINK)
        vm.onRetryRead()
        idle()
        assertThat(vm.state.value.unreachable).isFalse()
        assertThat(vm.state.value.case).isEqualTo(DeleteAccountCase.MEMBER)
    }

    @Test
    fun `send_records_the_sweep_choice_and_opens_the_mail_screen`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK)
        val vm = request()
        val events = mutableListOf<DeleteAccountEvent>()
        val collecting = launch { vm.events.toList(events) }
        idle()
        vm.onToggleSweep()
        vm.onSend()
        idle()
        assertThat(deletions.requests).containsExactly(true)
        assertThat(events).containsExactly(DeleteAccountEvent.Mailed(includeContent = true))
        collecting.cancel()
    }

    @Test
    fun `send_with_no_answer_keeps_the_choice_and_says_so_above_the_commit`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK)
        deletions.request = Outcome.Failed(IOException("offline"))
        val vm = request()
        idle()
        vm.onToggleSweep()
        vm.onSend()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.network_error)
        assertThat(vm.state.value.includeContent).isTrue()
        assertThat(vm.state.value.inFlight).isFalse()
    }

    @Test
    fun `a_spent_mail_budget_says_too_many_tries_above_the_commit`() = runTest(dispatcher) {
        // ER-G2, DeleteAccount.md:23: the line above, the commitment staying.
        path(AccountDeletionPath.BY_LINK)
        deletions.request = rateLimited
        val vm = request()
        idle()
        vm.onSend()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.rate_limited)
        assertThat(vm.state.value.case).isEqualTo(DeleteAccountCase.MEMBER)
    }

    @Test
    fun `a_refused_send_says_it_did_not_go_through_and_rereads_the_path`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK)
        deletions.request = Outcome.Refused(listOf(UserError(ErrorCode.FORBIDDEN, "no")))
        val vm = request()
        idle()
        val reads = deletions.standingReads
        vm.onSend()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.settings_save_failed)
        assertThat(deletions.standingReads).isEqualTo(reads + 1)
    }

    @Test
    fun `a_send_in_flight_refuses_a_second_press`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK)
        val gate = CompletableDeferred<Unit>()
        deletions.gate = gate
        val vm = request()
        idle()
        vm.onSend()
        idle()
        assertThat(vm.state.value.inFlight).isTrue()
        vm.onSend()
        vm.onToggleSweep()
        gate.complete(Unit)
        idle()
        assertThat(deletions.requests).hasSize(1)
        assertThat(vm.state.value.includeContent).isFalse()
    }

    @Test
    fun `the_applicants_delete_ends_the_session_and_says_why`() = runTest(dispatcher) {
        tokens.save(AuthTokens("a", "r", "u1"))
        path(AccountDeletionPath.IMMEDIATE)
        val vm = request()
        idle()
        vm.onDeleteNow()
        idle()
        assertThat(deletions.applicantDeletes).isEqualTo(1)
        assertThat(standing.accountDeleted.value).isTrue()
        assertThat(tokens.current()).isNull()
        // Never the member's mailed path.
        assertThat(deletions.requests).isEmpty()
    }

    @Test
    fun `the_applicants_delete_with_no_answer_deletes_nothing`() = runTest(dispatcher) {
        tokens.save(AuthTokens("a", "r", "u1"))
        path(AccountDeletionPath.IMMEDIATE)
        deletions.deleteApplicant = Outcome.Failed(IOException("offline"))
        val vm = request()
        idle()
        vm.onDeleteNow()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.network_error)
        assertThat(standing.accountDeleted.value).isFalse()
        assertThat(tokens.current()).isNotNull()
    }

    @Test
    fun `each_case_answers_only_its_own_commit`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK)
        val member = request()
        idle()
        member.onDeleteNow()
        idle()
        assertThat(deletions.applicantDeletes).isEqualTo(0)

        path(AccountDeletionPath.IMMEDIATE)
        val applicant = request()
        idle()
        applicant.onSend()
        idle()
        assertThat(deletions.requests).isEmpty()
    }

    // ----------------------------------------------------------- the mail

    @Test
    fun `the_mail_screen_names_the_address_and_resends_the_recorded_choice`() = runTest(dispatcher) {
        val vm = DeleteAccountMailViewModel(deletions, settings)
        vm.refresh()
        idle()
        assertThat(vm.state.value.email).isEqualTo("sol@solferreira.art")
        vm.onResend(includeContent = true)
        idle()
        assertThat(deletions.requests).containsExactly(true)
        assertThat(vm.state.value.fault).isNull()
    }

    @Test
    fun `an_answered_resend_names_the_address_for_its_snackbar`() = runTest(dispatcher) {
        // DeleteAccountMail.md:13.
        val vm = DeleteAccountMailViewModel(deletions, settings)
        val sent = mutableListOf<String>()
        val collecting = launch { vm.resent.toList(sent) }
        vm.refresh()
        idle()
        vm.onResend(includeContent = false)
        idle()
        assertThat(sent).containsExactly("sol@solferreira.art")
        collecting.cancel()
    }

    @Test
    fun `a_spent_mail_budget_says_too_many_tries_above_resend_and_never_sent_again`() = runTest(dispatcher) {
        // ER-G2, DeleteAccountMail.md:15.
        deletions.request = rateLimited
        val vm = DeleteAccountMailViewModel(deletions, settings)
        val sent = mutableListOf<String>()
        val collecting = launch { vm.resent.toList(sent) }
        vm.refresh()
        idle()
        vm.onResend(includeContent = false)
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.rate_limited)
        assertThat(sent).isEmpty()
        collecting.cancel()
    }

    @Test
    fun `a_resend_with_no_answer_answers_with_the_network_error`() = runTest(dispatcher) {
        deletions.request = Outcome.Failed(IOException("offline"))
        val vm = DeleteAccountMailViewModel(deletions, settings)
        vm.onResend(includeContent = false)
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.network_error)
    }

    // -------------------------------------------------------- the grace

    private fun pending() = DeleteAccountPendingViewModel(standing).also { it.clock = { NOW } }

    @Test
    fun `the_grace_page_reads_the_deadline_and_cancel_returns_with_the_snackbar`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK, grace)
        val vm = pending()
        val events = mutableListOf<DeleteAccountPendingEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.refresh()
        idle()
        assertThat(vm.state.value.deletion).isEqualTo(grace)
        vm.onCancel()
        idle()
        assertThat(deletions.cancels).isEqualTo(1)
        assertThat(standing.standing.value?.deletion).isNull()
        assertThat(events).containsExactly(DeleteAccountPendingEvent.Canceled)
        collecting.cancel()
    }

    @Test
    fun `a_cancel_with_no_answer_leaves_the_deletion_standing`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK, grace)
        deletions.cancel = Outcome.Failed(IOException("offline"))
        val vm = pending()
        vm.refresh()
        idle()
        vm.onCancel()
        idle()
        assertThat(vm.state.value.fault).isEqualTo(R.string.network_error)
        assertThat(standing.standing.value?.deletion).isEqualTo(grace)
    }

    @Test
    fun `a_deletion_canceled_elsewhere_sends_the_reader_back`() = runTest(dispatcher) {
        path(AccountDeletionPath.BY_LINK, null)
        val vm = pending()
        val events = mutableListOf<DeleteAccountPendingEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.refresh()
        idle()
        assertThat(events).containsExactly(DeleteAccountPendingEvent.Gone)
        collecting.cancel()
    }

    // ------------------------------------------------------ the landing

    private fun landing() = DeleteAccountConfirmedViewModel(deletions, standing).also { it.clock = { NOW } }

    @Test
    fun `opening_the_link_confirms_without_a_session_and_offers_the_sweep`() = runTest(dispatcher) {
        deletions.confirm = Outcome.Success(grace)
        val vm = landing()
        vm.start("t", signedIn = false)
        idle()
        assertThat(deletions.confirms).containsExactly("t" to false)
        assertThat(vm.state.value.landing).isEqualTo(ConfirmedLanding.Confirmed(grace))
        // Signed out, no account's standing is read: the link may be anyone's.
        assertThat(deletions.standingReads).isEqualTo(0)
    }

    @Test
    fun `signed_in_the_band_follows_from_the_accounts_own_read`() = runTest(dispatcher) {
        deletions.confirm = Outcome.Success(grace)
        path(AccountDeletionPath.BY_LINK, grace)
        val vm = landing()
        vm.start("t", signedIn = true)
        idle()
        assertThat(standing.standing.value?.deletion).isEqualTo(grace)
    }

    @Test
    fun `adding_the_ticked_sweep_reconfirms_with_it_and_says_so`() = runTest(dispatcher) {
        deletions.confirm = Outcome.Success(grace)
        val vm = landing()
        val events = mutableListOf<DeleteAccountConfirmedEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.start("t", signedIn = false)
        idle()
        deletions.confirm = Outcome.Success(grace.copy(includesContent = true))
        vm.onToggleSweep()
        vm.onAdd()
        idle()
        assertThat(deletions.confirms.last()).isEqualTo("t" to true)
        assertThat(vm.state.value.landing).isEqualTo(ConfirmedLanding.Confirmed(grace.copy(includesContent = true)))
        assertThat(events).containsExactly(DeleteAccountConfirmedEvent.Added)
        collecting.cancel()
    }

    @Test
    fun `adding_with_the_box_unticked_leaves_the_deletion_account_only`() = runTest(dispatcher) {
        deletions.confirm = Outcome.Success(grace)
        val vm = landing()
        val events = mutableListOf<DeleteAccountConfirmedEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.start("t", signedIn = false)
        idle()
        vm.onAdd()
        idle()
        assertThat(deletions.confirms.last()).isEqualTo("t" to false)
        assertThat(vm.state.value.landing).isEqualTo(ConfirmedLanding.Confirmed(grace))
        assertThat(events).isEmpty()
        collecting.cancel()
    }

    @Test
    fun `an_add_with_no_answer_keeps_the_tick_and_says_so`() = runTest(dispatcher) {
        deletions.confirm = Outcome.Success(grace)
        val vm = landing()
        vm.start("t", signedIn = false)
        idle()
        deletions.confirm = Outcome.Failed(IOException("offline"))
        vm.onToggleSweep()
        vm.onAdd()
        idle()
        assertThat(vm.state.value.sweepTicked).isTrue()
        assertThat(vm.state.value.fault).isEqualTo(R.string.network_error)
        assertThat(vm.state.value.landing).isEqualTo(ConfirmedLanding.Confirmed(grace))
    }

    @Test
    fun `no_answer_offers_the_retry_and_a_dead_link_lands_on_the_dead_landing`() = runTest(dispatcher) {
        deletions.confirm = Outcome.Failed(IOException("offline"))
        val vm = landing()
        vm.start("t", signedIn = false)
        idle()
        assertThat(vm.state.value.landing).isEqualTo(ConfirmedLanding.Unreachable)
        // ER-G1: one landing for every dead link (DeleteLinkExpired.md:5).
        deletions.confirm = Outcome.Refused(listOf(UserError(ErrorCode.DELETION_TOKEN_INVALID, "dead")))
        vm.onRetry()
        idle()
        assertThat(vm.state.value.landing).isEqualTo(ConfirmedLanding.Dead)
    }

    @Test
    fun `another_refusal_is_refused_not_dead`() = runTest(dispatcher) {
        deletions.confirm = rateLimited
        val vm = landing()
        vm.start("t", signedIn = false)
        idle()
        assertThat(vm.state.value.landing).isEqualTo(ConfirmedLanding.Refused)
    }
}
