package com.cogra.feature.home

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationProgress
import com.cogra.domain.signing.RegistrationSigner
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private fun member(
    invitedBy: ActorRef? = ActorRef("inv1", "inviter"),
    hasReciprocated: Boolean = false,
) = UserProfile("u1", "joiner", "joiner", AccountState.MEMBER, hasReciprocated, invitedBy)

private fun applicant() =
    UserProfile("u1", "joiner", "joiner", AccountState.APPLICANT, false, invitedBy = null)

private class ScriptedAccount : ThrowingAccountRepository() {
    var profile: UserProfile? = member()

    override suspend fun me(): Outcome<UserProfile?> = Outcome.Success(profile)
}

private class ScriptedOnboarding : ThrowingOnboardingRepository() {
    var status: ApplicationStatus = ApplicationStatus(AccountState.APPLICANT, null, null)
    var verify: Outcome<Unit> = Outcome.Success(Unit)
    var rearm: Outcome<Unit> = Outcome.Success(Unit)
    var polls = 0

    override suspend fun applicationStatus(): Outcome<ApplicationStatus> {
        polls += 1
        return Outcome.Success(status)
    }

    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = verify

    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = Outcome.Success(Unit)

    override suspend fun applyWithInvite(inviteLink: String): Outcome<Unit> = rearm
}

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val account = ScriptedAccount()
    private val writes = SealingWriteRepository(actor)
    private val onboarding = ScriptedOnboarding()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    /**
     * The flow's loop rides a test-owned scope on the test dispatcher —
     * runTest's backgroundScope parks new work once the scheduler has
     * gone idle, which would swallow every mid-test kick.
     */
    private val loopScope = CoroutineScope(dispatcher + SupervisorJob())

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /**
     * runTest's cleanup drains the scheduler, and a still-alive poll
     * loop would feed it forever — so the loop scope dies with the
     * test body, not in @After.
     */
    private fun homeTest(body: suspend kotlinx.coroutines.test.TestScope.() -> Unit) =
        runTest(dispatcher) {
            try {
                body()
            } finally {
                loopScope.cancel()
            }
        }

    private fun registrationFlow() = RegistrationFlow(
        RegistrationSigner(
            onboarding,
            WriteSigner(ThrowingWriteRepository(), identity),
            identity,
            KeyCeremony(identity, onboarding, account),
        ),
        loopScope,
    )

    private fun viewModel(registration: RegistrationFlow = registrationFlow()) =
        HomeViewModel(account, writes, WriteSigner(writes, identity), identity, onboarding, registration)

    private fun applicationView(
        verified: Boolean = true,
        keyAttached: Boolean = true,
        approved: Boolean = false,
        expired: Boolean = false,
    ) = ApplicationView(
        handle = "joiner",
        emailVerified = verified,
        keyAttached = keyAttached,
        approvedAt = if (approved) Instant.EPOCH else null,
        landedAt = null,
        expiresAt = if (expired) Instant.EPOCH else Instant.MAX,
    )

    private fun applicantStatus(application: ApplicationView? = applicationView()) =
        ApplicationStatus(AccountState.APPLICANT, application, null)

    // ----------------------------------------------------------------
    // Member shape
    // ----------------------------------------------------------------

    @Test
    fun theFirstLoginShowsTheReciprocationPrompt() = homeTest {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.applicant).isFalse()
        assertThat(vm.state.value.reciprocationTarget?.handle).isEqualTo("inviter")
        assertThat(vm.state.value.huskWarning).isFalse()
    }

    @Test
    fun aMemberNeverStartsThePollLoop() = homeTest {
        viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        // Event-driven only: no onboarding poll for a member.
        assertThat(onboarding.polls).isEqualTo(0)
    }

    @Test
    fun reciprocatingSignsWithoutTouchingTheDeviceBit() = homeTest {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onReciprocate()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.reciprocated).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
        // The graph knows (the staged write is in flight); the device
        // bit is dismissal memory only.
        assertThat(identity.dismissedReciprocation).isFalse()

        // The next profile read carries the server's answer.
        account.profile = member(hasReciprocated = true)
        val next = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(next.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun theServerAnswerSilencesThePromptAcrossDevices() = homeTest {
        // A reciprocated pair, fresh device: no local bit, no prompt.
        account.profile = member(hasReciprocated = true)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.dismissedReciprocation).isFalse()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun dismissalIsRememberedToo() = homeTest {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissReciprocation()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.dismissedReciprocation).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()

        // Dismissed locally, still unreciprocated: no prompt on reload.
        val next = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(next.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun aMissingActorKeyShowsTheHuskWarningAndNoPrompt() = homeTest {
        identity.seed = null
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.huskWarning).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun genesisActorsGetNoPrompt() = homeTest {
        account.profile = member(invitedBy = null)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun aRestoreResultRefreshesTheHuskStateAndConfirms() = homeTest {
        identity.seed = null
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.huskWarning).isTrue()

        // The Restore destination landed the seed and reported back.
        identity.seed = actor.seed()
        vm.onActorRestored()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.huskWarning).isFalse()
        assertThat(vm.state.value.actorRestored).isTrue()
    }

    @Test
    fun theRestoreConfirmationClearsOnceShown() = homeTest {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onActorRestored()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.actorRestored).isTrue()

        vm.onActorRestoredShown()
        assertThat(vm.state.value.actorRestored).isFalse()
    }

    @Test
    fun parkedHandshakesSurfaceAndResume() = homeTest {
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

    @Test
    fun pullToRefreshRereadsTheProfile() = homeTest {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        account.profile = member(invitedBy = null)
        vm.onPullRefresh()
        assertThat(vm.state.value.refreshing).isTrue()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refreshing).isFalse()
        assertThat(vm.state.value.profile?.invitedBy).isNull()
    }

    // ----------------------------------------------------------------
    // Applicant shape (auth.md "Application": read now, act after landing)
    // ----------------------------------------------------------------

    @Test
    fun anApplicantAccountPutsHomeInTheApplicantShape() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus(applicationView(verified = false))
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.applicant).isTrue()
        assertThat(vm.state.value.loading).isFalse()
        // The applicant is a logged-in account: the profile is there.
        assertThat(vm.state.value.profile?.handle).isEqualTo("joiner")
        assertThat(vm.state.value.progress).isEqualTo(
            RegistrationProgress.AwaitingApproval(emailVerified = false, keyAttached = true, keyOnDevice = true),
        )
        // No reciprocation prompt, no husk card — acting is member-gated.
        assertThat(vm.state.value.reciprocationTarget).isNull()
        assertThat(vm.state.value.huskWarning).isFalse()
    }

    @Test
    fun verifyingTheEmailReportsBackAndKicksThePoll() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus(applicationView(verified = false))
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        val pollsBefore = onboarding.polls

        vm.onTokenChange("token-1")
        onboarding.verify = Outcome.Refused(emptyList())
        vm.onVerify()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.verifyFailed).isTrue()

        // Editing the field clears the refusal; a good token verifies
        // and pokes the loop instead of waiting out its delay.
        vm.onTokenChange("token-2")
        assertThat(vm.state.value.verifyFailed).isFalse()
        onboarding.verify = Outcome.Success(Unit)
        onboarding.status = applicantStatus(applicationView(verified = true))
        vm.onVerify()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.verified).isTrue()
        assertThat(onboarding.polls).isGreaterThan(pollsBefore)
    }

    @Test
    fun resendingReportsBack() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus(applicationView(verified = false))
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()

        vm.onResendEmailChange("joiner@example.com")
        vm.onResend()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.resent).isTrue()
    }

    @Test
    fun theWaitingHintDismissalIsInMemoryOnly() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus()
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress)
            .isInstanceOf(RegistrationProgress.AwaitingApproval::class.java)

        vm.onDismissWaitingHint()
        assertThat(vm.state.value.waitingHintDismissed).isTrue()
        // Nothing was persisted — the hint returns with the next app run.
        assertThat(identity.dismissedReciprocation).isFalse()
    }

    @Test
    fun theApprovalTransitionFiresItsOneShotOnce() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus()
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.approved).isFalse()

        // The inviter approved; landing is now the server's move.
        onboarding.status = applicantStatus(applicationView(approved = true))
        dispatcher.scheduler.advanceTimeBy(registration.slowDelayMs)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(vm.state.value.approved).isTrue()

        vm.onApprovedShown()
        assertThat(vm.state.value.approved).isFalse()
    }

    @Test
    fun aColdOpenIntoLandingShowsStateWithoutTheOneShot() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus(applicationView(approved = true))
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(vm.state.value.approved).isFalse()
    }

    @Test
    fun aWatchedLandingWelcomesExactlyOnce() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus(applicationView(approved = true))
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.AwaitingLanding)

        // The Registration confirmed: the account state flips, the
        // session never changes, and the shell greets once.
        account.profile = member(invitedBy = null)
        onboarding.status = ApplicationStatus(AccountState.MEMBER, null, null)
        dispatcher.scheduler.advanceTimeBy(registration.fastDelayMs)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.applicant).isFalse()
        assertThat(vm.state.value.welcome).isTrue()
        vm.onWelcomeShown()
        assertThat(vm.state.value.welcome).isFalse()

        // The landing is spent: the next member Home does not greet.
        val next = viewModel(registration)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(next.state.value.welcome).isFalse()
    }

    @Test
    fun aDeadApplicationRearmsWithAFreshInvite() = homeTest {
        account.profile = applicant()
        onboarding.status = applicantStatus(application = null)
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.NeedsInvite)

        // Garbage first: no request leaves the device.
        vm.onRearmInputChange("not a link")
        vm.onRearm()
        assertThat(vm.state.value.rearmMalformed).isTrue()

        // A refusal surfaces its code.
        onboarding.rearm = Outcome.Refused(listOf(UserError(ErrorCode.INVITE_UNUSABLE, "dead")))
        vm.onRearmInputChange("0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1")
        vm.onRearm()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.rearmError).isEqualTo(ErrorCode.INVITE_UNUSABLE)

        // A fresh link re-arms and pokes the loop.
        val pollsBefore = onboarding.polls
        onboarding.rearm = Outcome.Success(Unit)
        onboarding.status = applicantStatus(applicationView(verified = false))
        vm.onRearm()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.rearmInput).isEmpty()
        assertThat(onboarding.polls).isGreaterThan(pollsBefore)
    }
}
