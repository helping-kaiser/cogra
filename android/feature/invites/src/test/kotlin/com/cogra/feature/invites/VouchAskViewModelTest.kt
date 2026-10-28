package com.cogra.feature.invites

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.invites.ApplicantApplication
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.AskLinkCheck
import com.cogra.domain.invites.AskLinkUnusableReason
import com.cogra.domain.invites.MyApplication
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
import java.time.Instant

/**
 * The ask link's landing, compiled from VouchAsk.md, VouchAskPad.md,
 * VouchAskInvalid.md and VouchAskUnusable.md. The stage and the approval are
 * the scripted repository's; the vouch is signed by the device's own signer
 * against the in-memory sealing repository — never the shared stack.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VouchAskViewModelTest {

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

    private fun viewModel() =
        VouchAskViewModel(invites, account, WriteSigner(writes, identity), identity, StanceSignals())

    private fun noor(ready: Boolean = true) = ApplicationInfo(
        id = "noor",
        handle = "noor",
        emailVerified = ready,
        keyAttached = ready,
        createdAt = Instant.EPOCH,
        graphId = testGraphId("noor").takeIf { ready },
    )

    @Test
    fun aMemberMeetsTheAskAndNothingIsStagedByTheOpening() = runTest(dispatcher) {
        // VouchAsk.md:11.
        invites.askLinks[ASK] = AskLinkCheck(true, "noor", null)
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        assertThat(vm.state.value.landing).isEqualTo(AskLanding.Ask("noor"))
        assertThat(vm.padState.value?.pad).isEqualTo(com.cogra.core.designsystem.StancePadMode.CLOSED)
        assertThat(invites.staged).isEmpty()
    }

    @Test
    fun aGuestMeetsTheAskWithoutReadingAnAccount() = runTest(dispatcher) {
        // VouchAsk.md:11 — a guest.
        invites.askLinks[ASK] = AskLinkCheck(true, "noor", null)
        val vm = viewModel()
        vm.load(ASK, signedIn = false)
        advanceUntilIdle()
        assertThat(vm.state.value.landing).isEqualTo(AskLanding.Ask("noor"))
    }

    @Test
    fun anApplicantLandsAtAppOpenWithItsLine() = runTest(dispatcher) {
        // VouchAsk.md:13, :49 — even where the link could stage nobody.
        state = AccountState.APPLICANT
        invites.askLinks[ASK] = AskLinkCheck(false, "noor", AskLinkUnusableReason.LANDED)
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        assertThat(vm.state.value.exit).isEqualTo(AskExit.AppOpen(R.string.vouch_ask_once_in))
    }

    @Test
    fun theAskerLandsAtAppOpenWithTheirOwnLine() = runTest(dispatcher) {
        // VouchAsk.md:15.
        state = AccountState.APPLICANT
        invites.myApplication = Outcome.Success(
            MyApplication(ASK, ApplicantApplication("a", null, null, null, ActorRef("m", "mira"))),
        )
        invites.askLinks[ASK] = AskLinkCheck(true, "joiner", null)
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        assertThat(vm.state.value.exit).isEqualTo(AskExit.AppOpen(R.string.vouch_ask_own))
    }

    @Test
    fun aMemberAlreadyHoldingTheAskerMeetsInvites() = runTest(dispatcher) {
        // VouchAsk.md:17.
        invites.askLinks[ASK] = AskLinkCheck(false, "noor", AskLinkUnusableReason.WAITING_ON_VIEWER)
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        assertThat(vm.state.value.exit).isEqualTo(AskExit.Invites(InvitesNotice.AlreadyWaiting("noor")))
    }

    @Test
    fun anIdNamingNobodyIsTheInvalidPageSignedInOrNot() = runTest(dispatcher) {
        // VouchAskInvalid.md:3.
        val vm = viewModel()
        vm.load(ASK, signedIn = false)
        advanceUntilIdle()
        assertThat(vm.state.value.landing).isEqualTo(AskLanding.Invalid)
    }

    @Test
    fun aLandedAskerIsTheUnusablePage() = runTest(dispatcher) {
        // VouchAskUnusable.md:15.
        invites.askLinks[ASK] = AskLinkCheck(false, "noor", AskLinkUnusableReason.LANDED)
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        assertThat(vm.state.value.landing).isEqualTo(AskLanding.Landed("noor"))
    }

    @Test
    fun setStagesThenApprovesAndOpensInvitesWithTheSignedLine() = runTest(dispatcher) {
        // VouchAskPad.md:25.
        invites.askLinks[ASK] = AskLinkCheck(true, "noor", null)
        invites.stageable[ASK] = noor()
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        val pad = checkNotNull(vm.approvalPad())
        pad.open()
        advanceUntilIdle()
        pad.pick(StancePair(0.5, 0.5))
        pad.commit()
        advanceUntilIdle()
        assertThat(invites.staged).containsExactly(ASK)
        assertThat(invites.approved.single()).isEqualTo(Triple("noor", 0.5, 0.5))
        assertThat(vm.state.value.exit)
            .isEqualTo(AskExit.Invites(InvitesNotice.Signed("noor", StancePair(0.5, 0.5))))
    }

    @Test
    fun theHoldSignsTheModestDefaultWithoutThePad() = runTest(dispatcher) {
        // VouchAsk.md:25.
        invites.askLinks[ASK] = AskLinkCheck(true, "noor", null)
        invites.stageable[ASK] = noor()
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        checkNotNull(vm.approvalPad()).hold()
        advanceUntilIdle()
        assertThat(invites.approved.single()).isEqualTo(Triple("noor", 0.1, 0.1))
    }

    @Test
    fun anAskerNotFullyRegisteredIsStagedAndNothingIsSigned() = runTest(dispatcher) {
        // VouchAskPad.md:33; VouchAsk.md:27.
        invites.askLinks[ASK] = AskLinkCheck(true, "noor", null)
        invites.stageable[ASK] = noor(ready = false)
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        checkNotNull(vm.approvalPad()).hold()
        advanceUntilIdle()
        assertThat(invites.staged).containsExactly(ASK)
        assertThat(invites.approved).isEmpty()
        assertThat(writes.staged).isEmpty()
        assertThat(vm.state.value.exit).isEqualTo(AskExit.Invites(InvitesNotice.NotRegistered("noor")))
    }

    @Test
    fun aLinkThatTurnedUnusableShowsItsNewStateAndSignsNothing() = runTest(dispatcher) {
        // VouchAskPad.md:27.
        invites.askLinks[ASK] = AskLinkCheck(true, "noor", null)
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        // Since the ask opened, someone vouched them in.
        invites.askLinks[ASK] = AskLinkCheck(false, "noor", AskLinkUnusableReason.LANDED)
        invites.stageAnswers += Outcome.Refused(listOf(UserError(ErrorCode.ASK_LINK_UNUSABLE, "landed")))
        checkNotNull(vm.approvalPad()).commit()
        advanceUntilIdle()
        assertThat(vm.state.value.landing).isEqualTo(AskLanding.Landed("noor"))
        assertThat(invites.approved).isEmpty()
    }

    @Test
    fun aRetryAfterAFaultApprovesTheHeldStagingWithoutStagingTwice() = runTest(dispatcher) {
        // Packet residual flag "Kept-approval retry": a second stage would
        // answer WAITING_ON_VIEWER.
        invites.askLinks[ASK] = AskLinkCheck(true, "noor", null)
        invites.stageable[ASK] = noor()
        invites.approveAnswers += Outcome.Failed(Exception("offline"))
        val vm = viewModel()
        vm.load(ASK, signedIn = true)
        advanceUntilIdle()
        val pad = checkNotNull(vm.approvalPad())
        pad.open()
        advanceUntilIdle()
        pad.commit()
        advanceUntilIdle()
        assertThat(vm.padState.value?.failed).isTrue()
        pad.commit()
        advanceUntilIdle()
        assertThat(invites.staged).containsExactly(ASK)
        assertThat(invites.approved).hasSize(2)
        assertThat(vm.state.value.exit).isInstanceOf(AskExit.Invites::class.java)
    }

    private companion object {
        const val ASK = "5d9e7a41-b062-4c38-8e5f-1a4703cbd926"
    }
}
