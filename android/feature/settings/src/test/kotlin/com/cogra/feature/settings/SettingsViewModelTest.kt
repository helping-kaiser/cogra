package com.cogra.feature.settings

import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.openKeyBackup
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.UserError
import com.cogra.domain.identity.BackupManager
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.identity.SignOut
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingSessionRepository
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val identity = FakeIdentityStore().apply { seed = ActorKey.generate().seed() }
    private val tokens = FakeTokenStore()

    private val account = object : ThrowingAccountRepository() {
        var uploaded: ByteArray? = null
        var passwordOutcome: Outcome<Unit> = Outcome.Success(Unit)
        var emailRequestOutcome: Outcome<Unit> = Outcome.Success(Unit)
        var emailRequestPassword: String? = null

        override suspend fun keyBackupChallenge(): Outcome<ByteArray> = Outcome.Success(ByteArray(32) { 0x71 })

        override suspend fun uploadKeyBackup(
            blob: ByteArray,
            challenge: ByteArray,
            signature: ByteArray,
        ): Outcome<Unit> {
            uploaded = blob
            return Outcome.Success(Unit)
        }

        override suspend fun changePassword(currentPassword: String, newPassword: String): Outcome<Unit> =
            passwordOutcome

        override suspend fun changeHandle(handle: String): Outcome<Unit> = Outcome.Success(Unit)

        override suspend fun requestEmailChange(newEmail: String, currentPassword: String): Outcome<Unit> {
            emailRequestPassword = currentPassword
            return emailRequestOutcome
        }

        override suspend fun confirmEmailChange(code: String): Outcome<Unit> = Outcome.Success(Unit)
    }

    private val sessionRepo = object : ThrowingSessionRepository() {
        val sessions = mutableListOf(
            SessionInfo("s1", "phone", Instant.EPOCH, null, Instant.MAX, isCurrent = true),
            SessionInfo("s2", "old tablet", Instant.EPOCH, null, Instant.MAX, isCurrent = false),
        )
        var revoked: String? = null

        override suspend fun sessions(): Outcome<List<SessionInfo>> = Outcome.Success(sessions.toList())

        override suspend fun revokeSession(id: String?): Outcome<Unit> {
            revoked = id
            sessions.removeAll { it.id == id }
            return Outcome.Success(Unit)
        }

        override suspend fun revokeOtherSessions(): Outcome<Int> {
            val count = sessions.count { !it.isCurrent }
            sessions.removeAll { !it.isCurrent }
            return Outcome.Success(count)
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

    private fun viewModel() = SettingsViewModel(
        sessionRepo,
        account,
        BackupManager(identity, account),
        SignOut(sessionRepo, EndLocalSession(identity, tokens)),
        identity,
    )

    @Test
    fun theNewBackupCodeOpensTheUploadedBlob() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onCreateBackup()
        dispatcher.scheduler.advanceUntilIdle()
        val code = checkNotNull(vm.state.value.newBackupCode)
        val opened = openKeyBackup(checkNotNull(account.uploaded), RecoveryCode.fromInput(code))
        assertThat(opened).isEqualTo(identity.seed)
        vm.onBackupCodeSaved()
        assertThat(vm.state.value.newBackupCode).isNull()
    }

    @Test
    fun sessionsListAndRevoke() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.sessions).hasSize(2)
        vm.onRevokeSession("s2")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(sessionRepo.revoked).isEqualTo("s2")
        assertThat(vm.state.value.sessions).hasSize(1)
        assertThat(vm.state.value.feedback)
            .isEqualTo(SettingsFeedback.Done(SettingsAction.SESSION_REVOKED))
    }

    @Test
    fun aWrongCurrentPasswordSurfaces() = runTest(dispatcher) {
        account.passwordOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.INVALID_CREDENTIALS, "no match")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onCurrentPasswordChange("wrong")
        vm.onNewPasswordChange("a new strong password")
        vm.onChangePassword()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.feedback)
            .isEqualTo(SettingsFeedback.Error(ErrorCode.INVALID_CREDENTIALS))
        vm.onFeedbackShown()
        assertThat(vm.state.value.feedback).isNull()
    }

    @Test
    fun aSuccessfulPasswordChangeClearsTheFields() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onCurrentPasswordChange("old password!")
        vm.onNewPasswordChange("a new strong password")
        vm.onChangePassword()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.feedback)
            .isEqualTo(SettingsFeedback.Done(SettingsAction.PASSWORD_CHANGED))
        assertThat(vm.state.value.currentPassword).isEmpty()
        assertThat(vm.state.value.newPassword).isEmpty()
    }

    @Test
    fun aRefusedEmailChangeRequestSurfacesAndStaysClosed() = runTest(dispatcher) {
        account.emailRequestOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.INVALID_CREDENTIALS, "no match")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNewEmailChange("new@example.org")
        vm.onEmailChangePasswordChange("wrong")
        vm.onRequestEmailChange()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.feedback)
            .isEqualTo(SettingsFeedback.Error(ErrorCode.INVALID_CREDENTIALS))
        assertThat(vm.state.value.emailChangeRequested).isFalse()
    }

    @Test
    fun anEmailChangeRequestUsesItsOwnPasswordAndOpensTheConfirmStep() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNewEmailChange("new@example.org")
        vm.onEmailChangePasswordChange("the password")
        vm.onRequestEmailChange()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(account.emailRequestPassword).isEqualTo("the password")
        assertThat(vm.state.value.emailChangeRequested).isTrue()
        assertThat(vm.state.value.emailChangePassword).isEmpty()
        assertThat(vm.state.value.feedback)
            .isEqualTo(SettingsFeedback.Done(SettingsAction.EMAIL_CHANGE_REQUESTED))
    }

    @Test
    fun aConfirmedEmailChangeResetsTheFlow() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onNewEmailChange("new@example.org")
        vm.onEmailChangePasswordChange("the password")
        vm.onRequestEmailChange()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onEmailChangeCodeChange("123456")
        vm.onConfirmEmailChange()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.feedback)
            .isEqualTo(SettingsFeedback.Done(SettingsAction.EMAIL_CONFIRMED))
        assertThat(vm.state.value.emailChangeRequested).isFalse()
        assertThat(vm.state.value.newEmail).isEmpty()
        assertThat(vm.state.value.emailChangeCode).isEmpty()
    }

    @Test
    fun signOutClearsTokensButKeepsTheActor() = runTest(dispatcher) {
        tokens.save(AuthTokens("a", "r", "u1"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSignOut()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(tokens.current()).isNull()
        assertThat(identity.seed).isNotNull()
    }

    @Test
    fun signOutPurgesAnAccountThatOptedOutOfBeingRemembered() = runTest(dispatcher) {
        tokens.save(AuthTokens("a", "r", "u1"))
        identity.forgetOnSignOut = true
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSignOut()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(tokens.current()).isNull()
        assertThat(identity.seed).isNull()
    }

    // -- The stance input preference (design.md §8.6) --

    @Test
    fun thePadIsTheStoredDefault() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.stanceInputMode).isEqualTo(StanceInputMode.PAD)
    }

    @Test
    fun pickingAnAlternateStoresItAndShowsItAsChosen() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onStanceInputMode(StanceInputMode.ENTRY)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.stanceInputMode).isEqualTo(StanceInputMode.ENTRY)
        // Stored, not screen state: the choice replaces the pad on every
        // other surface too.
        assertThat(identity.stanceInputMode.first()).isEqualTo(StanceInputMode.ENTRY)
    }

    // -- The multi-action confirm (F4) --

    @Test
    fun theConfirmIsOnUntilTheReaderSaysOtherwise() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.confirmMultiActionSubmits).isTrue()
    }

    @Test
    fun turningTheConfirmOffAndOnAgainIsStored() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()

        vm.onConfirmMultiActionSubmits(false)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.confirmMultiActionSubmits).isFalse()
        assertThat(identity.confirmMultiActionSubmits.first()).isFalse()

        vm.onConfirmMultiActionSubmits(true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.confirmMultiActionSubmits.first()).isTrue()
    }
}
