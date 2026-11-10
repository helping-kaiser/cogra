package com.cogra.feature.onboarding

import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.InviteCheck
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.identity.Register
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationSigner
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.google.common.truth.Truth.assertThat
import java.io.IOException
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

private class ScriptedOnboarding : ThrowingOnboardingRepository() {
    var check: Outcome<InviteCheck?> =
        Outcome.Success(InviteCheck(usable = true, inviterHandle = "inviter", expiresAt = Instant.MAX))
    var registerOutcome: Outcome<AuthTokens> = Outcome.Success(AuthTokens("access", "refresh", "u1"))
    var lastRegisteredHandle: String? = null
    var registrations = 0
    var checks = 0
    var attachOutcome: Outcome<Unit> = Outcome.Success(Unit)
    val attachedKeys = mutableListOf<Pair<String, String>>()
    var statusPolls = 0

    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> {
        checks += 1
        return check
    }

    override suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens> {
        lastRegisteredHandle = handle
        registrations += 1
        return registerOutcome
    }

    override suspend fun attachActorKey(actorPubkeyBase64: String, realizationAddress: String): Outcome<Unit> {
        attachedKeys += actorPubkeyBase64 to realizationAddress
        return attachOutcome
    }

    // Terminal at once, so a kicked flow loop stops after one pass.
    override suspend fun applicationStatus(): Outcome<ApplicationStatus> {
        statusPolls += 1
        return Outcome.Success(ApplicationStatus(AccountState.MEMBER, null, null, null))
    }
}

private class UploadingAccount : ThrowingAccountRepository() {
    var uploaded: ByteArray? = null
    var failUpload = false

    override suspend fun keyBackupChallenge(): Outcome<ByteArray> = Outcome.Success(ByteArray(32) { 0x71 })

    override suspend fun uploadKeyBackup(
        blob: ByteArray,
        challenge: ByteArray,
        signature: ByteArray,
    ): Outcome<Unit> {
        if (failUpload) return Outcome.Failed(IOException("upload lost"))
        uploaded = blob
        return Outcome.Success(Unit)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingViewModelsTest {

    private val dispatcher = StandardTestDispatcher()
    private val onboarding = ScriptedOnboarding()
    private val identity = FakeIdentityStore()
    private val tokens = FakeTokenStore()
    private val account = UploadingAccount()
    private val ceremony = KeyCeremony(identity, onboarding, account)

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    /** See HomeViewModelTest: backgroundScope parks post-idle launches. */
    private val loopScope = CoroutineScope(dispatcher + SupervisorJob())

    @After
    fun tearDown() {
        loopScope.cancel()
        Dispatchers.resetMain()
    }

    // ----------------------------------------------------------------
    // The invite door (InviteEntry.md, JoinInvalid.md)
    // ----------------------------------------------------------------

    private val link = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1"

    @Test
    fun aLinkThatChecksOutOpensJoinHoldingItAndItsInviter() = runTest(dispatcher) {
        val vm = InviteEntryViewModel(onboarding)
        vm.onInputChange("https://cogra.social/join/$link")
        vm.onContinue()
        assertThat(vm.state.value.inFlight).isTrue()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.exit).isEqualTo(InviteEntryExit.Join(link, "inviter"))
        assertThat(vm.state.value.invalid).isFalse()
    }

    @Test
    fun anUnknownOrUnusableLinkBringsTheDoorsUnusableReadingAndKeepsWhatWasPasted() = runTest(dispatcher) {
        val answers = listOf<Outcome<InviteCheck?>>(
            Outcome.Success(null),
            Outcome.Success(InviteCheck(false, "inviter", Instant.MAX)),
            Outcome.Refused(listOf(UserError(ErrorCode.INVITE_UNUSABLE, "spent", null))),
        )
        for (answer in answers) {
            onboarding.check = answer
            val vm = InviteEntryViewModel(onboarding)
            vm.onInputChange(link)
            vm.onContinue()
            dispatcher.scheduler.advanceUntilIdle()
            // JoinInvalid.md:25 — still unusable: JoinInvalid stands AND NEVER the screen moves.
            assertThat(vm.state.value.invalid).isTrue()
            assertThat(vm.state.value.exit).isNull()
            assertThat(vm.state.value.input).isEqualTo(link)
        }
    }

    @Test
    fun aPressWithNothingThatReadsAsALinkSaysSoAndTheLineGoesOnceItDoes() = runTest(dispatcher) {
        val vm = InviteEntryViewModel(onboarding)
        vm.onInputChange("garbage")
        assertThat(vm.state.value.notALink).isFalse()
        vm.onContinue()
        assertThat(vm.state.value.notALink).isTrue()
        assertThat(vm.state.value.inFlight).isFalse()
        vm.onInputChange("garbage!")
        assertThat(vm.state.value.notALink).isTrue()
        vm.onInputChange(link)
        assertThat(vm.state.value.notALink).isFalse()
    }

    @Test
    fun noAnswerKeepsThePasteAndContinueIsTheRetry() = runTest(dispatcher) {
        onboarding.check = Outcome.Failed(IOException("offline"))
        val vm = InviteEntryViewModel(onboarding)
        vm.onInputChange(link)
        vm.onContinue()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.noAnswer).isTrue()
        assertThat(vm.state.value.input).isEqualTo(link)
        onboarding.check = Outcome.Success(InviteCheck(true, "inviter", Instant.MAX))
        vm.onContinue()
        assertThat(vm.state.value.noAnswer).isFalse()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.exit).isEqualTo(InviteEntryExit.Join(link, "inviter"))
    }

    @Test
    fun continueWaitsOnAnEmptyFieldAndRefusesASecondPressWhileItChecks() = runTest(dispatcher) {
        val vm = InviteEntryViewModel(onboarding)
        assertThat(vm.state.value.waiting).isTrue()
        vm.onContinue()
        assertThat(vm.state.value.inFlight).isFalse()
        vm.onInputChange(link)
        assertThat(vm.state.value.waiting).isFalse()
        vm.onContinue()
        vm.onContinue()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(onboarding.checks).isEqualTo(1)
        assertThat(vm.state.value.exit).isEqualTo(InviteEntryExit.Join(link, "inviter"))
    }

    @Test
    fun aDeadArrivalNeverShowsTheUnusableReading() = runTest(dispatcher) {
        onboarding.check = Outcome.Success(InviteCheck(false, "inviter", Instant.MAX))
        val vm = InviteEntryViewModel(onboarding)
        vm.onArrival(link)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.exit).isEqualTo(InviteEntryExit.DeadArrival)
        assertThat(vm.state.value.invalid).isFalse()
        vm.onExitConsumed()
        assertThat(vm.state.value.exit).isNull()
    }

    // ----------------------------------------------------------------
    // The registration form (Join.md, JoinErrors.md)
    // ----------------------------------------------------------------

    private val draft = JoinDraft()

    private fun joinViewModel(): JoinViewModel = JoinViewModel(Register(onboarding, tokens), draft)

    private fun JoinViewModel.fill(handle: String = "Joiner", password: String = "a strong password") {
        onHandleChange(handle)
        onEmailChange("joiner@example.com")
        onPasswordChange(password)
    }

    private fun refuse(code: ErrorCode, field: String? = null) {
        onboarding.registerOutcome = Outcome.Refused(listOf(UserError(code, "no", field?.let { listOf("input", it) })))
    }

    @Test
    fun aSuccessfulRegisterStoresTheSessionPairAndForgetsTheDraft() = runTest(dispatcher) {
        val vm = joinViewModel()
        vm.fill()
        // The handle field folds case (auth.md "Handle and email format").
        assertThat(vm.state.value.handle).isEqualTo("joiner")
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(tokens.current()).isEqualTo(AuthTokens("access", "refresh", "u1"))
        assertThat(onboarding.lastRegisteredHandle).isEqualTo("joiner")
        assertThat(vm.state.value.created).isTrue()
        assertThat(draft.handle).isEmpty()
        assertThat(draft.email).isEmpty()
    }

    @Test
    fun createAccountWaitsUntilAllThreeFieldsHoldACharacter() {
        // Join.md:89-91.
        val vm = joinViewModel()
        assertThat(vm.state.value.waiting).isTrue()
        vm.onHandleChange("a")
        vm.onEmailChange("b")
        assertThat(vm.state.value.waiting).isTrue()
        vm.onPasswordChange("c")
        assertThat(vm.state.value.waiting).isFalse()
    }

    @Test
    fun typingNeverMarksAFieldBeforeThePress() {
        // Join.md:39.
        val vm = joinViewModel()
        vm.fill(handle = "a-b", password = "short")
        vm.onEmailChange("not an address")
        assertThat(vm.state.value.handleLine).isNull()
        assertThat(vm.state.value.emailLine).isNull()
        assertThat(vm.state.value.passwordLine).isNull()
    }

    @Test
    fun aPressSaysEachFieldsShapeAndNothingGoesOut() = runTest(dispatcher) {
        // Join.md:57-63.
        val vm = joinViewModel()
        vm.fill(handle = "ab", password = "short")
        vm.onEmailChange("joiner@")
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.handleLine).isEqualTo(JoinLine.HANDLE_SHAPE)
        assertThat(vm.state.value.emailLine).isEqualTo(JoinLine.EMAIL_SHAPE)
        assertThat(vm.state.value.passwordLine).isEqualTo(JoinLine.PASSWORD_SHORT)
        assertThat(onboarding.registrations).isEqualTo(0)

        vm.onPasswordChange("x".repeat(129))
        assertThat(vm.state.value.passwordLine).isEqualTo(JoinLine.PASSWORD_LONG)
    }

    @Test
    fun theHandleRuleHoldsItsCeilingAndCharset() = runTest(dispatcher) {
        val vm = joinViewModel()
        vm.fill(handle = "a".repeat(31))
        vm.onSubmit(link)
        assertThat(vm.state.value.handleLine).isEqualTo(JoinLine.HANDLE_SHAPE)
        // A local line re-checks as the text changes (Join.md:75).
        vm.onHandleChange("joiner.two")
        assertThat(vm.state.value.handleLine).isEqualTo(JoinLine.HANDLE_SHAPE)
        vm.onHandleChange("joiner_two")
        assertThat(vm.state.value.handleLine).isNull()
    }

    @Test
    fun thePasswordLineGoesOnceThePasswordReachesTwelve() = runTest(dispatcher) {
        // JoinErrors.md:11.
        val vm = joinViewModel()
        vm.fill(password = "fieldday")
        vm.onSubmit(link)
        assertThat(vm.state.value.passwordLine).isEqualTo(JoinLine.PASSWORD_SHORT)
        vm.onPasswordChange("fielddayfiel")
        assertThat(vm.state.value.passwordLine).isNull()
    }

    @Test
    fun eachServerRefusalLandsOnItsField() = runTest(dispatcher) {
        // Join.md:53, 55, 65; copy-voice, the refusals.
        val cases = listOf(
            Triple(ErrorCode.HANDLE_TAKEN, "handle", Triple(JoinLine.HANDLE_TAKEN, null, null)),
            Triple(ErrorCode.EMAIL_IN_USE, "email", Triple(null, JoinLine.EMAIL_IN_USE, null)),
            Triple(ErrorCode.WEAK_PASSWORD, "password", Triple(null, null, JoinLine.PASSWORD_BREACHED)),
            Triple(ErrorCode.BAD_INPUT, "handle", Triple(JoinLine.HANDLE_SHAPE, null, null)),
        )
        for ((code, field, expected) in cases) {
            refuse(code, field)
            val vm = joinViewModel()
            vm.fill()
            vm.onSubmit(link)
            dispatcher.scheduler.advanceUntilIdle()
            val state = vm.state.value
            assertThat(Triple(state.handleLine, state.emailLine, state.passwordLine)).isEqualTo(expected)
            assertThat(state.fault).isNull()
            assertThat(tokens.current()).isNull()
        }
    }

    @Test
    fun aServerLineStandsThroughTypingUntilTheNextPress() = runTest(dispatcher) {
        // JoinErrors.md:13, Join.md:75.
        refuse(ErrorCode.HANDLE_TAKEN, "handle")
        val vm = joinViewModel()
        vm.fill(handle = "noor")
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onHandleChange("noor2")
        assertThat(vm.state.value.handleLine).isEqualTo(JoinLine.HANDLE_TAKEN)
        onboarding.registerOutcome = Outcome.Success(AuthTokens("access", "refresh", "u1"))
        vm.onSubmit(link)
        assertThat(vm.state.value.handleLine).isNull()
    }

    @Test
    fun aTakenHandleAndAShortPasswordStandTogetherAndTheEmailNeverChanges() = runTest(dispatcher) {
        // JoinErrors.md:3 — the board's two errors at once.
        refuse(ErrorCode.HANDLE_TAKEN, "handle")
        val vm = joinViewModel()
        vm.fill(handle = "noor")
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onPasswordChange("fieldday")
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        val state = vm.state.value
        assertThat(state.handleLine).isEqualTo(JoinLine.HANDLE_TAKEN)
        assertThat(state.passwordLine).isEqualTo(JoinLine.PASSWORD_SHORT)
        assertThat(state.emailLine).isNull()
        assertThat(state.email).isEqualTo("joiner@example.com")
    }

    @Test
    fun noAnswerKeepsTheFieldsAndSaysSoAboveTheCommit() = runTest(dispatcher) {
        // Join.md:69.
        onboarding.registerOutcome = Outcome.Failed(IOException("offline"))
        val vm = joinViewModel()
        vm.fill()
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        val state = vm.state.value
        assertThat(state.fault).isEqualTo(JoinFault.NO_ANSWER)
        assertThat(state.handle).isEqualTo("joiner")
        assertThat(state.password).isEqualTo("a strong password")
        assertThat(state.inFlight).isFalse()
    }

    @Test
    fun aRateLimitAndAnUnnamedRefusalAreSaidInPlace() = runTest(dispatcher) {
        refuse(ErrorCode.RATE_LIMITED)
        val limited = joinViewModel().apply { fill() }
        limited.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(limited.state.value.fault).isEqualTo(JoinFault.RATE_LIMITED)

        refuse(ErrorCode.BAD_INPUT)
        val unnamed = joinViewModel().apply { fill() }
        unnamed.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(unnamed.state.value.fault).isEqualTo(JoinFault.NOT_THROUGH)
    }

    @Test
    fun aSpentLinkTurnsTheFormIntoTheDoor() = runTest(dispatcher) {
        refuse(ErrorCode.INVITE_UNUSABLE)
        val vm = joinViewModel()
        vm.fill()
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.spent).isTrue()
    }

    @Test
    fun createAccountRefusesASecondPressWhileItWaits() = runTest(dispatcher) {
        // Join.md:41.
        val vm = joinViewModel()
        vm.fill()
        vm.onSubmit(link)
        assertThat(vm.state.value.inFlight).isTrue()
        vm.onSubmit(link)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(onboarding.registrations).isEqualTo(1)
    }

    @Test
    fun theHandleAndEmailOutliveAWayOutButThePasswordNever() {
        // Join.md:25 — the same session finds Handle and Email as typed, Password empty.
        val first = joinViewModel()
        first.fill()
        first.onLeave()
        assertThat(first.state.value.password).isEmpty()
        val again = joinViewModel()
        assertThat(again.state.value.handle).isEqualTo("joiner")
        assertThat(again.state.value.email).isEqualTo("joiner@example.com")
        assertThat(again.state.value.password).isEmpty()
        // Join.md:27 — a cold launch builds a fresh draft: nothing is held.
        assertThat(JoinViewModel(Register(onboarding, tokens), JoinDraft()).state.value.handle).isEmpty()
    }

    // ----------------------------------------------------------------
    // The key ceremony
    // ----------------------------------------------------------------

    private fun flow(scope: CoroutineScope = loopScope): RegistrationFlow = RegistrationFlow(
        RegistrationSigner(
            onboarding,
            WriteSigner(ThrowingWriteRepository(), identity),
            identity,
            ceremony,
        ),
        scope,
        FakeTokenStore(),
    )

    @Test
    fun acceptingTheBackupMintsAttachesSealsAndUploads() = runTest(dispatcher) {
        val vm = KeyCeremonyViewModel(ceremony, flow())
        vm.onAcceptBackup()
        dispatcher.scheduler.advanceUntilIdle()
        val code = checkNotNull(vm.state.value.recoveryCode)
        assertThat(code).matches("[-0-9A-Z]{30}")
        assertThat(identity.seed).isNotNull()
        assertThat(onboarding.attachedKeys).hasSize(1)
        // The blob uploaded immediately after the attach and is no
        // longer parked.
        assertThat(account.uploaded).isNotNull()
        assertThat(identity.pendingBlob).isNull()

        vm.onCodeSaved()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.done).isTrue()
        // Finishing kicked the app-scoped flow into an immediate poll.
        assertThat(onboarding.statusPolls).isAtLeast(1)
    }

    @Test
    fun aFailedUploadKeepsTheBlobParkedAndStillShowsTheCode() = runTest(dispatcher) {
        account.failUpload = true
        val vm = KeyCeremonyViewModel(ceremony, flow())
        vm.onAcceptBackup()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.recoveryCode).isNotNull()
        assertThat(identity.pendingBlob).isNotNull()
    }

    @Test
    fun aFailedAttachSurfacesAndTheRetrySucceeds() = runTest(dispatcher) {
        onboarding.attachOutcome = Outcome.Failed(IOException("offline"))
        val vm = KeyCeremonyViewModel(ceremony, flow())
        vm.onAcceptBackup()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.attachError).isEqualTo(AttachError.NETWORK)
        assertThat(vm.state.value.recoveryCode).isNull()

        onboarding.attachOutcome = Outcome.Success(Unit)
        vm.onAcceptBackup()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.attachError).isNull()
        assertThat(vm.state.value.recoveryCode).isNotNull()
    }

    @Test
    fun aKeyBoundElsewhereIsItsOwnRefusal() = runTest(dispatcher) {
        onboarding.attachOutcome = Outcome.Refused(
            listOf(
                UserError(
                    code = ErrorCode.ACTOR_KEY_IN_USE,
                    message = "the key already belongs to another account",
                    field = listOf("actorPubkey"),
                ),
            ),
        )
        val vm = KeyCeremonyViewModel(ceremony, flow())
        vm.onAcceptBackup()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.attachError).isEqualTo(AttachError.KEY_IN_USE)
        assertThat(vm.state.value.recoveryCode).isNull()

        // Any other refusal stays the transient story.
        onboarding.attachOutcome = Outcome.Refused(
            listOf(UserError(code = ErrorCode.BAD_INPUT, message = "bad", field = null)),
        )
        vm.onAcceptBackup()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.attachError).isEqualTo(AttachError.NETWORK)
    }

    @Test
    fun decliningRequiresTheStatedPrice() = runTest(dispatcher) {
        val vm = KeyCeremonyViewModel(ceremony, flow())
        vm.onDeclineBackup()
        assertThat(vm.state.value.confirmingDecline).isTrue()
        vm.onCancelDecline()
        assertThat(vm.state.value.confirmingDecline).isFalse()

        vm.onDeclineBackup()
        vm.onConfirmDecline()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.done).isTrue()
        // A key exists and is attached, but no code and no blob.
        assertThat(identity.seed).isNotNull()
        assertThat(onboarding.attachedKeys).hasSize(1)
        assertThat(identity.pendingBlob).isNull()
        assertThat(vm.state.value.recoveryCode).isNull()
    }
}
