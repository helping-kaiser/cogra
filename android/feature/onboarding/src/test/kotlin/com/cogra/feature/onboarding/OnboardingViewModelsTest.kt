package com.cogra.feature.onboarding

import com.cogra.crypto.PreSignedProposal
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.InviteCheck
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.store.IdentityStore
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class FakeIdentity : IdentityStore {
    var seed: ByteArray? = null
    var token: String? = null
    var pendingBlob: ByteArray? = null

    override suspend fun actorSeed(): ByteArray? = seed
    override suspend fun saveActorSeed(seed: ByteArray) {
        this.seed = seed
    }
    override suspend fun applicantToken(): String? = token
    override suspend fun saveApplicantToken(token: String) {
        this.token = token
    }
    override suspend fun clearApplicantToken() {
        token = null
    }
    override suspend fun pendingBackupBlob(): ByteArray? = pendingBlob
    override suspend fun savePendingBackupBlob(blob: ByteArray) {
        pendingBlob = blob
    }
    override suspend fun clearPendingBackupBlob() {
        pendingBlob = null
    }
    override suspend fun handshake(stagedWriteId: String): PreSignedProposal? = null
    override suspend fun saveHandshake(stagedWriteId: String, pre: PreSignedProposal) = Unit
    override suspend fun clearHandshake(stagedWriteId: String) = Unit
    override suspend fun handshakeIds(): Set<String> = emptySet()
    override suspend fun reciprocationHandled(): Boolean = false
    override suspend fun markReciprocationHandled() = Unit
}

private class ScriptedOnboarding : OnboardingRepository {
    var check: Outcome<InviteCheck?> =
        Outcome.Success(InviteCheck(usable = true, inviterHandle = "inviter", expiresAt = Instant.MAX))
    var submit: Outcome<String> = Outcome.Success("applicant-token")
    var lastSubmitPubkey: String? = null
    var lastSubmitAddress: String? = null
    var verify: Outcome<Unit> = Outcome.Success(Unit)

    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> = check

    override suspend fun submitApplication(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        actorPubkeyBase64: String,
        l0Address: String,
    ): Outcome<String> {
        lastSubmitPubkey = actorPubkeyBase64
        lastSubmitAddress = l0Address
        return submit
    }

    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = verify
    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = Outcome.Success(Unit)
    override suspend fun application(applicantToken: String): Outcome<ApplicationStatus?> =
        throw UnsupportedOperationException()
    override suspend fun submitRegistration(applicantToken: String, signatureBase64: String): Outcome<StagedWriteView> =
        throw UnsupportedOperationException()
    override suspend fun approveRegistration(applicantToken: String, signatureBase64: String): Outcome<StagedWriteView> =
        throw UnsupportedOperationException()
    override suspend fun claimLandedSession(applicantToken: String, deviceLabel: String?): Outcome<AuthTokens> =
        throw UnsupportedOperationException()
}

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingViewModelsTest {

    private val dispatcher = StandardTestDispatcher()
    private val onboarding = ScriptedOnboarding()
    private val identity = FakeIdentity()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun inviteIdsExtractFromUrlsAndBareIds() {
        val id = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1"
        assertThat(InviteEntryViewModel.extractId("https://cogra.example/join/$id")).isEqualTo(id)
        assertThat(InviteEntryViewModel.extractId("  $id  ")).isEqualTo(id)
        assertThat(InviteEntryViewModel.extractId(id.uppercase())).isEqualTo(id)
        assertThat(InviteEntryViewModel.extractId("no id here")).isNull()
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

    private fun applyViewModel(): ApplyViewModel =
        ApplyViewModel(onboarding, KeyCeremony(identity), identity).also {
            it.inviteId = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1"
        }

    private fun ApplyViewModel.fillForm() {
        onHandleChange("Joiner")
        onEmailChange("joiner@example.com")
        onPasswordChange("a strong password")
    }

    @Test
    fun acceptingTheBackupCreatesKeyCodeAndPendingBlob() = runTest(dispatcher) {
        val vm = applyViewModel()
        vm.fillForm()
        // The handle field folds case (auth.md "Handle and email format").
        assertThat(vm.state.value.handle).isEqualTo("joiner")
        vm.onContinueToBackup()
        vm.onAcceptBackup()
        dispatcher.scheduler.advanceUntilIdle()
        val code = checkNotNull(vm.state.value.recoveryCode)
        assertThat(code).matches("[-0-9A-Z]{30}")
        assertThat(identity.seed).isNotNull()
        assertThat(identity.pendingBlob).isNotNull()

        vm.onCodeSaved()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.submitted).isTrue()
        assertThat(identity.token).isEqualTo("applicant-token")
        // The submit carried the ceremony's outputs.
        assertThat(onboarding.lastSubmitAddress).hasLength(40)
    }

    @Test
    fun decliningRequiresTheStatedPrice() = runTest(dispatcher) {
        val vm = applyViewModel()
        vm.fillForm()
        vm.onContinueToBackup()
        vm.onDeclineBackup()
        assertThat(vm.state.value.confirmingDecline).isTrue()
        vm.onCancelDecline()
        assertThat(vm.state.value.confirmingDecline).isFalse()

        vm.onDeclineBackup()
        vm.onConfirmDecline()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.submitted).isTrue()
        // A key exists, but no code and no pending blob.
        assertThat(identity.seed).isNotNull()
        assertThat(identity.pendingBlob).isNull()
        assertThat(vm.state.value.recoveryCode).isNull()
    }

    @Test
    fun aRefusedSubmitReturnsToTheFormWithTheField() = runTest(dispatcher) {
        onboarding.submit = Outcome.Refused(
            listOf(UserError(ErrorCode.HANDLE_TAKEN, "taken", listOf("input", "handle"))),
        )
        val vm = applyViewModel()
        vm.fillForm()
        vm.onContinueToBackup()
        vm.onDeclineBackup()
        vm.onConfirmDecline()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.step).isEqualTo(ApplyStep.FORM)
        assertThat(vm.state.value.error).isEqualTo(ErrorCode.HANDLE_TAKEN)
        assertThat(vm.state.value.errorField).isEqualTo("handle")
        assertThat(identity.token).isNull()
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
}
