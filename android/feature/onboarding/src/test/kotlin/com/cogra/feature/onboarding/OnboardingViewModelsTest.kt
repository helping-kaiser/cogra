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
    var attachOutcome: Outcome<Unit> = Outcome.Success(Unit)
    val attachedKeys = mutableListOf<Pair<String, String>>()
    var statusPolls = 0

    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> = check

    override suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens> {
        lastRegisteredHandle = handle
        return registerOutcome
    }

    override suspend fun attachActorKey(actorPubkeyBase64: String, l0Address: String): Outcome<Unit> {
        attachedKeys += actorPubkeyBase64 to l0Address
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

    @Test
    fun aUsableCheckEnablesContinue() = runTest(dispatcher) {
        val vm = InviteEntryViewModel(onboarding)
        vm.onInputChange("0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1")
        vm.onCheck()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.canContinue).isTrue()
        assertThat(vm.state.value.check?.inviterHandle).isEqualTo("inviter")
    }

    @Test
    fun unknownAndUnusableLinksRefuse() = runTest(dispatcher) {
        onboarding.check = Outcome.Success(null)
        val vm = InviteEntryViewModel(onboarding)
        vm.onInputChange("0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1")
        vm.onCheck()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.notFound).isTrue()

        onboarding.check = Outcome.Success(InviteCheck(false, "inviter", Instant.MAX))
        vm.onCheck()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.canContinue).isFalse()

        vm.onInputChange("garbage")
        vm.onCheck()
        assertThat(vm.state.value.malformed).isTrue()
    }

    // ----------------------------------------------------------------
    // The registration form
    // ----------------------------------------------------------------

    private fun applyViewModel(): ApplyViewModel =
        ApplyViewModel(Register(onboarding, tokens)).also {
            it.inviteId = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1"
        }

    private fun ApplyViewModel.fillForm() {
        onHandleChange("Joiner")
        onEmailChange("joiner@example.com")
        onPasswordChange("a strong password")
    }

    @Test
    fun aSuccessfulRegisterStoresTheSessionPair() = runTest(dispatcher) {
        val vm = applyViewModel()
        vm.fillForm()
        // The handle field folds case (auth.md "Handle and email format").
        assertThat(vm.state.value.handle).isEqualTo("joiner")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(tokens.current()).isEqualTo(AuthTokens("access", "refresh", "u1"))
        assertThat(onboarding.lastRegisteredHandle).isEqualTo("joiner")
    }

    @Test
    fun aRefusedRegisterShowsTheFieldError() = runTest(dispatcher) {
        onboarding.registerOutcome = Outcome.Refused(
            listOf(UserError(ErrorCode.HANDLE_TAKEN, "taken", listOf("input", "handle"))),
        )
        val vm = applyViewModel()
        vm.fillForm()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.error).isEqualTo(ErrorCode.HANDLE_TAKEN)
        assertThat(vm.state.value.errorField).isEqualTo("handle")
        assertThat(tokens.current()).isNull()
    }

    @Test
    fun aTransportFaultSurfacesAtTheForm() = runTest(dispatcher) {
        onboarding.registerOutcome = Outcome.Failed(IOException("offline"))
        val vm = applyViewModel()
        vm.fillForm()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(tokens.current()).isNull()
    }

    @Test
    fun theFormGateHoldsUntilValid() {
        val vm = applyViewModel()
        vm.onHandleChange("ab")
        vm.onEmailChange("joiner@example.com")
        vm.onPasswordChange("a strong password")
        assertThat(vm.state.value.formValid).isFalse()
        vm.onHandleChange("abc")
        assertThat(vm.state.value.formValid).isTrue()
        vm.onPasswordChange("short")
        assertThat(vm.state.value.formValid).isFalse()
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
