package com.cogra.feature.home

import com.cogra.crypto.ActorKey
import com.cogra.domain.ActorRef
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserProfile
import com.cogra.domain.WriteState
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationProgress
import com.cogra.domain.signing.RegistrationSigner
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class ScriptedAccount : ThrowingAccountRepository() {
    var profile: UserProfile? =
        UserProfile("u1", "joiner", "joiner", invitedBy = ActorRef("inv1", "inviter"))

    override suspend fun me(): Outcome<UserProfile?> = Outcome.Success(profile)
}

private class ScriptedOnboarding : ThrowingOnboardingRepository() {
    var status: ApplicationStatus? = null
    var verify: Outcome<Unit> = Outcome.Success(Unit)
    var polls = 0

    override suspend fun application(applicantToken: String): Outcome<ApplicationStatus?> {
        polls += 1
        return Outcome.Success(status)
    }

    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = verify

    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = Outcome.Success(Unit)

    override suspend fun claimLandedSession(applicantToken: String, deviceLabel: String?): Outcome<AuthTokens> =
        Outcome.Success(AuthTokens("access", "refresh"))
}

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val account = ScriptedAccount()
    private val writes = SealingWriteRepository(actor)
    private val onboarding = ScriptedOnboarding()
    private val tokens = FakeTokenStore()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /**
     * The flow's loop rides runTest's backgroundScope so it is cancelled
     * with the test — a parked poll must never outlive its test body.
     */
    private fun TestScope.registrationFlow() = RegistrationFlow(
        RegistrationSigner(onboarding, ThrowingWriteRepository(), identity, tokens, account),
        backgroundScope,
        deviceLabel = null,
    )

    /** Member-shape tests get a flow whose loop never starts. */
    private fun idleRegistrationFlow() = RegistrationFlow(
        RegistrationSigner(onboarding, ThrowingWriteRepository(), identity, tokens, account),
        CoroutineScope(dispatcher),
        deviceLabel = null,
    )

    private fun viewModel(registration: RegistrationFlow = idleRegistrationFlow()) =
        HomeViewModel(account, writes, WriteSigner(writes, identity), identity, onboarding, registration)

    private fun applicationStatus(
        verified: Boolean = true,
        landed: Boolean = false,
        staged: StagedWriteView? = null,
    ) = ApplicationStatus(
        handle = "joiner",
        emailVerified = verified,
        approvedAt = null,
        landedAt = if (landed) Instant.EPOCH else null,
        expiresAt = Instant.MAX,
        stagedRegistration = staged,
    )

    // ----------------------------------------------------------------
    // Member shape
    // ----------------------------------------------------------------

    @Test
    fun theFirstLoginShowsTheReciprocationPrompt() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.applicant).isFalse()
        assertThat(vm.state.value.reciprocationTarget?.handle).isEqualTo("inviter")
        assertThat(vm.state.value.huskWarning).isFalse()
    }

    @Test
    fun reciprocatingSignsAndRemembers() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onReciprocate()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.reciprocated).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
        assertThat(identity.reciprocationDone).isTrue()

        // A fresh view model never prompts again.
        val next = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(next.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun dismissalIsRememberedToo() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDismissReciprocation()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.reciprocationDone).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun aMissingActorKeyShowsTheHuskWarningAndNoPrompt() = runTest(dispatcher) {
        identity.seed = null
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.huskWarning).isTrue()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun genesisActorsGetNoPrompt() = runTest(dispatcher) {
        account.profile = UserProfile("u1", "genesis", null, invitedBy = null)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.reciprocationTarget).isNull()
    }

    @Test
    fun aRestoreResultRefreshesTheHuskStateAndConfirms() = runTest(dispatcher) {
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
    fun theRestoreConfirmationClearsOnceShown() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onActorRestored()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.actorRestored).isTrue()

        vm.onActorRestoredShown()
        assertThat(vm.state.value.actorRestored).isFalse()
    }

    @Test
    fun parkedHandshakesSurfaceAndResume() = runTest(dispatcher) {
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

    // ----------------------------------------------------------------
    // Applicant shape (auth.md "Application": read now, act after landing)
    // ----------------------------------------------------------------

    @Test
    fun anApplicantTokenPutsHomeInTheApplicantShape() = runTest(dispatcher) {
        identity.token = "tok"
        onboarding.status = applicationStatus(verified = false)
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.applicant).isTrue()
        assertThat(vm.state.value.loading).isFalse()
        assertThat(vm.state.value.progress)
            .isEqualTo(RegistrationProgress.AwaitingEmailVerification)
        // No session surface was touched.
        assertThat(vm.state.value.profile).isNull()
    }

    @Test
    fun verifyingTheEmailReportsSuccessAndFailure() = runTest(dispatcher) {
        identity.token = "tok"
        onboarding.status = applicationStatus(verified = false)
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()

        vm.onTokenChange("token-1")
        onboarding.verify = Outcome.Refused(emptyList())
        vm.onVerify()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.verifyFailed).isTrue()

        // Editing the field clears the refusal; a good token verifies.
        vm.onTokenChange("token-2")
        assertThat(vm.state.value.verifyFailed).isFalse()
        onboarding.verify = Outcome.Success(Unit)
        vm.onVerify()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.verified).isTrue()
    }

    @Test
    fun resendingReportsBack() = runTest(dispatcher) {
        identity.token = "tok"
        onboarding.status = applicationStatus(verified = false)
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()

        vm.onResendEmailChange("joiner@example.com")
        vm.onResend()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.resent).isTrue()
    }

    @Test
    fun theWaitingHintDismissalIsInMemoryOnly() = runTest(dispatcher) {
        identity.token = "tok"
        onboarding.status = applicationStatus(verified = true)
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.AwaitingApproval)

        vm.onDismissWaitingHint()
        assertThat(vm.state.value.waitingHintDismissed).isTrue()
        // Nothing was persisted — the hint returns with the next app run.
        assertThat(identity.reciprocationDone).isFalse()
    }

    @Test
    fun theApprovalTransitionFiresItsOneShotOnce() = runTest(dispatcher) {
        identity.token = "tok"
        onboarding.status = applicationStatus(verified = true)
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.AwaitingApproval)
        assertThat(vm.state.value.approved).isFalse()

        // The inviter approved; the registration is relaying.
        onboarding.status = applicationStatus(
            staged = StagedWriteView(
                id = "reg-1",
                state = WriteState.RELAYING,
                family = com.cogra.crypto.Family.REGISTRATION,
                canonicalProposal = ByteArray(0),
                verifiedAct = null,
                recordId = null,
            ),
        )
        dispatcher.scheduler.advanceTimeBy(registration.pollDelayMs)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(vm.state.value.approved).isTrue()

        vm.onApprovedShown()
        assertThat(vm.state.value.approved).isFalse()
    }

    @Test
    fun aColdOpenIntoLandingShowsStateWithoutTheOneShot() = runTest(dispatcher) {
        identity.token = "tok"
        onboarding.status = applicationStatus(
            staged = StagedWriteView(
                id = "reg-1",
                state = WriteState.RELAYING,
                family = com.cogra.crypto.Family.REGISTRATION,
                canonicalProposal = ByteArray(0),
                verifiedAct = null,
                recordId = null,
            ),
        )
        val registration = registrationFlow()
        val vm = viewModel(registration)
        dispatcher.scheduler.runCurrent()
        assertThat(vm.state.value.progress).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(vm.state.value.approved).isFalse()
    }

    @Test
    fun theMemberShellWelcomesExactlyOnceAfterTheClaim() = runTest(dispatcher) {
        // The applicant loop claimed: token spent, session saved.
        identity.token = "tok"
        onboarding.status = applicationStatus(landed = true)
        val registration = registrationFlow()
        registration.ensureAdvancing()
        dispatcher.scheduler.runCurrent()
        assertThat(identity.token).isNull()

        account.profile = UserProfile("u1", "joiner", null, invitedBy = null)
        val vm = viewModel(registration)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.applicant).isFalse()
        assertThat(vm.state.value.welcome).isTrue()
        vm.onWelcomeShown()
        assertThat(vm.state.value.welcome).isFalse()

        // The claim is spent: the next member Home does not greet again.
        val next = viewModel(registration)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(next.state.value.welcome).isFalse()
    }
}
