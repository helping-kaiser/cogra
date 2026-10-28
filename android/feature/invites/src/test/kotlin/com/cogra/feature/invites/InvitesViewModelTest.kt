package com.cogra.feature.invites

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.WriteState
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.InviteLinkInfo
import com.cogra.domain.invites.QueueLink
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.ScriptedInvitesRepository
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.testGraphId
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
import java.time.Duration
import java.time.Instant

/**
 * Invites' state holder, compiled from the sidecars' lines (Invites.md,
 * InviteNew.md, InviteExpiry.md, ApprovePad.md, RejectConfirm.md,
 * RejectAllConfirm.md). Nothing here signs on a shared stack: approvals
 * stage through the in-memory sealing repository and the device's own signer.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class InvitesViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply {
        seed = actor.seed()
        stancePadTaught = true
    }
    private val writes = SealingWriteRepository(actor)
    private val invites = ScriptedInvitesRepository(writes)
    private var state = AccountState.MEMBER
    private val account = object : ThrowingAccountRepository() {
        override suspend fun me(): Outcome<UserProfile?> =
            Outcome.Success(UserProfile("u", "jakob", null, state, true, null))
    }

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel() = InvitesViewModel(
        invites,
        account,
        WriteSigner(writes, identity),
        identity,
        StanceSignals(),
        "https://cogra.example",
    ).also { it.now = { NOW } }

    private fun row(id: String, age: Long, link: QueueLink? = MANY, ready: Boolean = true) = ApplicationInfo(
        id = id,
        handle = id,
        emailVerified = ready,
        keyAttached = ready,
        createdAt = Instant.ofEpochSecond(age),
        graphId = testGraphId(id),
        inviteLink = link,
    )

    private fun link(id: String, usable: Boolean = true, singleUse: Boolean = true) =
        InviteLinkInfo(id, singleUse, Instant.EPOCH, NOW.plus(Duration.ofDays(7)), null, usable)

    @Test
    fun theQueueReadsInOneRoundTripAndStandsByTheOrderLaw() = runTest(dispatcher) {
        invites.queue += listOf(row("late", 50), row("early", 10, SINGLE), row("asked", 99, link = null))
        invites.links += listOf(link("live"), link("used", usable = false))
        val vm = viewModel()
        advanceUntilIdle()
        assertThat(invites.reads).hasSize(1)
        // Invites.md:71 the ask-link row heads; :11 groups by their oldest row.
        assertThat(vm.state.value.layout.rows.map { it.id }).containsExactly("asked", "early", "late").inOrder()
        // :29 a link that no longer works never stands under Live links.
        assertThat(vm.state.value.links.map { it.id }).containsExactly("live")
    }

    @Test
    fun nothingWaitingAndNoLiveLinkIsTheEmptyInvites() = runTest(dispatcher) {
        invites.links += link("used", usable = false)
        val vm = viewModel()
        advanceUntilIdle()
        // InvitesEmpty.md:3.
        assertThat(vm.state.value.empty).isTrue()
    }

    @Test
    fun aReaderWhoIsNotAMemberNeverStandsOnInvites() = runTest(dispatcher) {
        // ProfileApplicant.md:18.
        state = AccountState.APPLICANT
        val vm = viewModel()
        advanceUntilIdle()
        assertThat(vm.state.value.notMember).isTrue()
    }

    @Test
    fun aRowNotFullyRegisteredAnswersWithTheSnackbarAndNeverOpensThePad() = runTest(dispatcher) {
        // Invites.md:39.
        invites.queue += row("imke", 1, ready = false)
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.single())
        assertThat(vm.state.value.snack).isEqualTo(InvitesSnack.FinishRegistering("@imke"))
        assertThat(vm.state.value.approvingId).isNull()
        assertThat(vm.padState.value).isNull()
    }

    @Test
    fun aReadyRowBloomsThePadAtTheStandingDefaultStagingNothing() = runTest(dispatcher) {
        // ApprovePad.md:3, :7.
        invites.queue += row("rafa", 1)
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.single())
        advanceUntilIdle()
        assertThat(vm.state.value.approvingId).isEqualTo("rafa")
        assertThat(vm.padState.value?.pick).isEqualTo(StancePair.TapDefault)
        assertThat(invites.approved).isEmpty()
        assertThat(invites.staged).isEmpty()
    }

    @Test
    fun cancelClosesThePadAndTheApplicationIsStillWaiting() = runTest(dispatcher) {
        // ApprovePad.md:29.
        invites.queue += row("rafa", 1)
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.single())
        advanceUntilIdle()
        vm.onApprovalDismissed()
        advanceUntilIdle()
        assertThat(vm.state.value.approvingId).isNull()
        assertThat(invites.approved).isEmpty()
        assertThat(vm.state.value.layout.rows.map { it.id }).containsExactly("rafa")
    }

    @Test
    fun setSignsTheVouchTheRowLeavesAndTheSignedLineSaysThePick() = runTest(dispatcher) {
        // ApprovePad.md:37.
        invites.queue += listOf(row("rafa", 1), row("imke", 2))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.first())
        advanceUntilIdle()
        val pad = checkNotNull(vm.approvalPad())
        pad.pick(StancePair(0.4, 0.2))
        pad.commit()
        advanceUntilIdle()
        assertThat(invites.approved.single()).isEqualTo(Triple("rafa", 0.4, 0.2))
        assertThat(writes.staged.values.single().state).isEqualTo(WriteState.RELAYING)
        assertThat(vm.state.value.snack).isEqualTo(InvitesSnack.Signed(StancePair(0.4, 0.2)))
        assertThat(vm.state.value.layout.rows.map { it.id }).containsExactly("imke")
        assertThat(vm.state.value.approvingId).isNull()
        // Invites.md:61 — focus moves to what now stands in the row's place.
        assertThat(vm.state.value.focusAfter).isEqualTo(FocusAfter(FocusAfter.Section.APPLICATION, 0))
    }

    @Test
    fun anEmptyPickAsksTheVouchInQuestionAndSetItAnywayIsTheApproval() = runTest(dispatcher) {
        // ApprovePad.md:43, :45.
        invites.queue += row("rafa", 1)
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.single())
        advanceUntilIdle()
        val pad = checkNotNull(vm.approvalPad())
        pad.pick(StancePair.Origin)
        pad.commit()
        advanceUntilIdle()
        assertThat(vm.padState.value?.emptySign).isNotNull()
        assertThat(invites.approved).isEmpty()

        pad.confirmEmptySign()
        advanceUntilIdle()
        assertThat(invites.approved.single()).isEqualTo(Triple("rafa", 0.0, 0.0))
        assertThat(vm.state.value.snack).isEqualTo(InvitesSnack.Signed(StancePair.Origin))
    }

    @Test
    fun aFailedSigningKeepsThePadOpenAtThePickWithItsFault() = runTest(dispatcher) {
        // ApprovePad.md:47.
        invites.queue += row("rafa", 1)
        invites.approveAnswers += Outcome.Failed(Exception("offline"))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.single())
        advanceUntilIdle()
        val pad = checkNotNull(vm.approvalPad())
        pad.pick(StancePair(0.3, 0.3))
        pad.commit()
        advanceUntilIdle()
        val padState = checkNotNull(vm.padState.value)
        assertThat(padState.failed).isTrue()
        assertThat(padState.pick).isEqualTo(StancePair(0.3, 0.3))
        assertThat(vm.state.value.approvingId).isEqualTo("rafa")
    }

    @Test
    fun theWriteRuleIsANoticeNotAFault() = runTest(dispatcher) {
        // ApprovePad.md:49.
        invites.queue += row("rafa", 1)
        invites.approveAnswers += Outcome.Refused(listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "solvency")))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.single())
        advanceUntilIdle()
        checkNotNull(vm.approvalPad()).commit()
        advanceUntilIdle()
        assertThat(vm.padState.value?.writeRule).isTrue()
        assertThat(vm.padState.value?.failed).isFalse()
        assertThat(writes.staged).isEmpty()
    }

    @Test
    fun withTheKeyElsewhereThePadCarriesTheKeyNoticeAndApprovesNothing() = runTest(dispatcher) {
        // ApprovePad.md:39 — the approval must not land only to strand the vouch.
        identity.seed = null
        invites.queue += row("rafa", 1)
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenRow(vm.state.value.layout.rows.single())
        advanceUntilIdle()
        assertThat(vm.padState.value?.keyAbsent).isTrue()
        checkNotNull(vm.approvalPad()).commit()
        advanceUntilIdle()
        assertThat(invites.approved).isEmpty()
    }

    @Test
    fun closingARowClosesOnlyItAndTheDialogLeaves() = runTest(dispatcher) {
        // RejectConfirm.md:19.
        invites.queue += listOf(row("imke", 1), row("vora", 2))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onCloseRow(vm.state.value.layout.rows.first())
        assertThat(vm.state.value.closing?.target).isInstanceOf(CloseTarget.One::class.java)
        vm.onConfirmClose()
        advanceUntilIdle()
        assertThat(invites.rejected).containsExactly("imke")
        assertThat(vm.state.value.closing).isNull()
        assertThat(vm.state.value.layout.rows.map { it.id }).containsExactly("vora")
    }

    @Test
    fun aClosingThatDidNotGoThroughKeepsTheDialogAndTheApplication() = runTest(dispatcher) {
        // RejectConfirm.md:23.
        invites.queue += row("imke", 1)
        invites.rejectAnswers += Outcome.Failed(Exception("offline"))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onCloseRow(vm.state.value.layout.rows.single())
        vm.onConfirmClose()
        advanceUntilIdle()
        assertThat(vm.state.value.closing?.failed).isTrue()
        assertThat(vm.state.value.closing?.working).isFalse()
        assertThat(vm.state.value.layout.rows).hasSize(1)
    }

    @Test
    fun aClosingInFlightRefusesASecondPressAndKeepIsLocked() = runTest(dispatcher) {
        // RejectConfirm.md:15.
        invites.queue += row("imke", 1)
        val vm = viewModel()
        advanceUntilIdle()
        vm.onCloseRow(vm.state.value.layout.rows.single())
        vm.onConfirmClose()
        vm.onConfirmClose()
        vm.onKeep()
        assertThat(vm.state.value.closing?.working).isTrue()
        advanceUntilIdle()
        assertThat(invites.rejected).hasSize(1)
    }

    @Test
    fun keepClosesTheDialogAndNothingIsClosed() = runTest(dispatcher) {
        // RejectConfirm.md:25.
        invites.queue += row("imke", 1)
        val vm = viewModel()
        advanceUntilIdle()
        vm.onCloseRow(vm.state.value.layout.rows.single())
        vm.onKeep()
        advanceUntilIdle()
        assertThat(vm.state.value.closing).isNull()
        assertThat(invites.rejected).isEmpty()
    }

    @Test
    fun closeAllSweepsOnlyThatGroupsWaitingApplications() = runTest(dispatcher) {
        // RejectAllConfirm.md:23.
        invites.queue += listOf(row("a", 1), row("b", 2), row("c", 3, SINGLE))
        val vm = viewModel()
        advanceUntilIdle()
        val group = vm.state.value.layout.groups.single { it.linkId == MANY.id }
        vm.onCloseAll(group)
        vm.onConfirmClose()
        advanceUntilIdle()
        assertThat(invites.swept).containsExactly(MANY.id)
        assertThat(vm.state.value.layout.rows.map { it.id }).containsExactly("c")
    }

    @Test
    fun revokeHoldsTheCardRefusesASecondPressAndSaysInviteRevoked() = runTest(dispatcher) {
        // Invites.md:49, :53.
        invites.links += listOf(link("one"), link("two"))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onRevoke(vm.state.value.links.first())
        vm.onRevoke(vm.state.value.links.first())
        assertThat(vm.state.value.revoking).isEqualTo("one")
        advanceUntilIdle()
        assertThat(invites.revoked).containsExactly("one")
        assertThat(vm.state.value.links.map { it.id }).containsExactly("two")
        assertThat(vm.state.value.snack).isEqualTo(InvitesSnack.Revoked)
        assertThat(vm.state.value.focusAfter).isEqualTo(FocusAfter(FocusAfter.Section.LINK, 0))
    }

    @Test
    fun aRevokeThatDidNotGoThroughKeepsTheCardWithTheFault() = runTest(dispatcher) {
        // Invites.md:59.
        invites.links += link("one")
        invites.revokeAnswers += Outcome.Failed(Exception("offline"))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onRevoke(vm.state.value.links.single())
        advanceUntilIdle()
        assertThat(vm.state.value.revokeFailed).isTrue()
        assertThat(vm.state.value.links).hasSize(1)
        assertThat(vm.state.value.snack).isNull()
    }

    @Test
    fun theCreateSheetOpensSingleUseAtSevenDaysAndMakesTheLinkWithTheStagedChoices() = runTest(dispatcher) {
        // InviteNew.md:7, :9, :15, :19; InviteExpiry.md:9.
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenSheet()
        assertThat(vm.state.value.sheet?.singleUse).isTrue()
        assertThat(vm.state.value.sheet?.expiry).isEqualTo(ExpiryChoice.DAYS_7)
        vm.onSingleUseChange(false)
        vm.onOpenExpiry()
        vm.onPickExpiry(ExpiryChoice.DAYS_30)
        assertThat(vm.state.value.sheet?.choosing).isFalse()
        assertThat(invites.created).isEmpty()

        vm.onCreate()
        advanceUntilIdle()
        assertThat(invites.created.single()).isEqualTo(NOW.plus(Duration.ofDays(30)) to false)
        // The sheet turns to its second stage, and the new link stands under Live links.
        assertThat(vm.state.value.sheet?.created?.id).isEqualTo("link-1")
        assertThat(vm.state.value.links.map { it.id }).containsExactly("link-1")
        assertThat(vm.joinUrl(vm.state.value.links.single())).isEqualTo("https://cogra.example/join/link-1")
    }

    @Test
    fun aCreateThatDidNotGoThroughKeepsTheStagedChoices() = runTest(dispatcher) {
        // InviteNew.md:23.
        invites.createAnswers += Outcome.Failed(Exception("offline"))
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenSheet()
        vm.onSingleUseChange(false)
        vm.onCreate()
        advanceUntilIdle()
        val sheet = checkNotNull(vm.state.value.sheet)
        assertThat(sheet.failed).isTrue()
        assertThat(sheet.singleUse).isFalse()
        assertThat(sheet.created).isNull()
    }

    @Test
    fun theExpiryChoosersScrimKeepsTheLengthItHad() = runTest(dispatcher) {
        // InviteExpiry.md:11.
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenSheet()
        vm.onOpenExpiry()
        vm.onCloseExpiry()
        assertThat(vm.state.value.sheet?.expiry).isEqualTo(ExpiryChoice.DAYS_7)
        assertThat(vm.state.value.sheet?.choosing).isFalse()
    }

    @Test
    fun closingTheSheetCreatesNothingAndTheNextOpenStartsAtTheDefaults() = runTest(dispatcher) {
        // InviteNew.md:25.
        val vm = viewModel()
        advanceUntilIdle()
        vm.onOpenSheet()
        vm.onSingleUseChange(false)
        vm.onCloseSheet()
        vm.onOpenSheet()
        assertThat(vm.state.value.sheet?.singleUse).isTrue()
        assertThat(invites.created).isEmpty()
    }

    @Test
    fun anAskLinksArrivalSaysItsLineAndStandsAtTheRow() = runTest(dispatcher) {
        // Invites.md:93; VouchAsk.md:17.
        val vm = viewModel()
        advanceUntilIdle()
        vm.onArrival(InvitesNotice.AlreadyWaiting("noor"))
        assertThat(vm.state.value.snack).isEqualTo(InvitesSnack.AlreadyWaiting("@noor"))
        assertThat(vm.state.value.standAt).isEqualTo("noor")
    }

    @Test
    fun theCarriedNoticeRoundTrips() {
        val notices = listOf(
            InvitesNotice.AlreadyWaiting("noor"),
            InvitesNotice.NotRegistered("noor"),
            InvitesNotice.Signed("noor", StancePair(0.4, -0.2)),
        )
        notices.forEach { assertThat(InvitesNotice.decode(it.encode())).isEqualTo(it) }
        assertThat(InvitesNotice.decode("unheard-of|x")).isNull()
        assertThat(InvitesNotice.decode(null)).isNull()
    }

    private companion object {
        val NOW: Instant = Instant.parse("2026-09-15T10:00:00Z")
        val MANY = QueueLink("c47b19e0", singleUse = false)
        val SINGLE = QueueLink("8f3c1d2a", singleUse = true)
    }
}
