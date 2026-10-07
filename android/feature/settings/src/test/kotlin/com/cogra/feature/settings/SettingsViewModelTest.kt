package com.cogra.feature.settings

import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.openKeyBackup
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.identity.BackupManager
import com.cogra.domain.identity.SignOut
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.store.ThemeChoice
import com.cogra.domain.testing.FakeDevicePreferences
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
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
class SettingsViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val identity = FakeIdentityStore().apply { seed = ActorKey.generate().seed() }
    private val tokens = FakeTokenStore()
    private val device = FakeDevicePreferences()
    private val settings = ScriptedSettings()
    private val sessions = ScriptedSessions()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private suspend fun signedIn() = tokens.save(AuthTokens("a", "r", "u1"))

    private fun viewModel() = SettingsViewModel(
        settings,
        sessions,
        SignOut(sessions, identity, tokens),
        identity,
        device,
    ).also {
        it.clock = { NOW }
        it.refresh()
    }

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    // ------------------------------------------------------------ device

    @Test
    fun `theme_choice_repaints_and_stays_on_this_device`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.theme).isEqualTo(ThemeChoice.AUTO)
        vm.onTheme(ThemeChoice.DARK)
        idle()
        // The device's store, never the account's.
        assertThat(device.theme.first()).isEqualTo(ThemeChoice.DARK)
        assertThat(vm.state.value.theme).isEqualTo(ThemeChoice.DARK)
    }

    @Test
    fun `exactly_one_opinion_input_stands_selected`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        vm.onStanceInputMode(StanceInputMode.SLIDERS)
        idle()
        assertThat(vm.state.value.stanceInputMode).isEqualTo(StanceInputMode.SLIDERS)
    }

    @Test
    fun `multi_action_switch_flips_without_a_dialog`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.confirmMultiActionSubmits).isTrue()
        vm.onConfirmMultiActionSubmits()
        idle()
        assertThat(identity.confirmMultiAction.value).isFalse()
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()
    }

    @Test
    fun `exact_values_switch_is_device_local`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        vm.onShowExactValues()
        idle()
        assertThat(device.showExactValues.value).isTrue()
        assertThat(vm.state.value.showExactValues).isTrue()
    }

    @Test
    fun `forget_switch_flips_without_signing_out`() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onForgetOnSignOut()
        idle()
        assertThat(identity.forgetOnSignOut).isTrue()
        assertThat(tokens.current()).isNotNull()
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()
    }

    // --------------------------------------------------- default license

    @Test
    fun `done_saves_and_the_row_reads_it`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        vm.onOpenLicense()
        assertThat(vm.state.value.licenseSheet).isEqualTo(LicenseChoice.PublicDomain)
        vm.onStageLicense(LicenseChoice(1.0, 0.0))
        // Staged, not saved: nothing reaches the account before Done.
        assertThat(settings.savedLicenses).isEmpty()
        vm.onLicenseDone()
        // Optimistic: the row reads it at once.
        assertThat(vm.state.value.defaultLicense).isEqualTo(LicenseChoice(1.0, 0.0))
        idle()
        assertThat(settings.savedLicenses).containsExactly(LicenseChoice(1.0, 0.0))
        assertThat(vm.state.value.licenseSheet).isNull()
        assertThat(vm.state.value.defaultLicense).isEqualTo(LicenseChoice(1.0, 0.0))
    }

    @Test
    fun `scrim_swipe_back_escape_discard`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        vm.onOpenLicense()
        vm.onStageLicense(LicenseChoice(0.5, 0.5))
        vm.onDismissLicense()
        idle()
        assertThat(settings.savedLicenses).isEmpty()
        assertThat(vm.state.value.defaultLicense).isEqualTo(LicenseChoice.PublicDomain)
    }

    @Test
    fun `failed_save_reverts_with_that_didnt_go_through_and_retry`() = runTest(dispatcher) {
        settings.saveLicense = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        idle()
        vm.onOpenLicense()
        vm.onStageLicense(LicenseChoice(1.0, 1.0))
        vm.onLicenseDone()
        idle()
        // It reverts, and the row carries the failure with Retry.
        assertThat(vm.state.value.defaultLicense).isEqualTo(LicenseChoice.PublicDomain)
        assertThat(vm.state.value.licenseFailed).isEqualTo(LicenseChoice(1.0, 1.0))

        settings.saveLicense = null
        vm.onRetryLicense()
        idle()
        assertThat(vm.state.value.licenseFailed).isNull()
        assertThat(vm.state.value.defaultLicense).isEqualTo(LicenseChoice(1.0, 1.0))
    }

    @Test
    fun publicDomainIsSavedAsTheDefaultsOwnNull() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(defaultLicense = LicenseChoice(1.0, 0.0)))
        val vm = viewModel()
        idle()
        vm.onOpenLicense()
        vm.onStageLicense(LicenseChoice.PublicDomain)
        vm.onLicenseDone()
        idle()
        assertThat(settings.savedLicenses).containsExactly(null)
        assertThat(vm.state.value.defaultLicense).isEqualTo(LicenseChoice.PublicDomain)
    }

    // ---------------------------------------------------------- sessions

    @Test
    fun `revoke_removes_the_row_and_names_the_device`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        assertThat(vm.state.value.sessions.map { it.id }).containsExactly("s1", "s2", "s3").inOrder()
        vm.onRevokeSession("s2")
        idle()
        assertThat(sessions.revoked).containsExactly("s2")
        assertThat(vm.state.value.sessions.map { it.id }).containsExactly("s1", "s3").inOrder()
        assertThat(events).contains(
            SettingsEvent.Snackbar(R.string.settings_session_revoked, "Pixel 8", R.string.settings_session_unnamed),
        )
        // Focus moves to the next row.
        assertThat(events).contains(SettingsEvent.FocusSession("s3"))
        collecting.cancel()
    }

    @Test
    fun `revoke_moves_focus_to_the_next_row`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        // The last row has no next one: focus falls back to the previous.
        vm.onRevokeSession("s3")
        idle()
        assertThat(events).contains(SettingsEvent.FocusSession("s2"))
        collecting.cancel()
    }

    @Test
    fun `revoke_offline_opens_network_error_and_keeps_the_row`() = runTest(dispatcher) {
        sessions.offline = true
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onRevokeSession("s2")
        idle()
        assertThat(vm.state.value.sessions.map { it.id }).contains("s2")
        assertThat(vm.state.value.revokingSessionId).isNull()
        assertThat(events).contains(SettingsEvent.Snackbar(R.string.network_error))
        collecting.cancel()
    }

    @Test
    fun `sign_out_everywhere_else_keeps_this_device`() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onRevokeOthers()
        idle()
        assertThat(sessions.othersRevoked).isEqualTo(1)
        assertThat(vm.state.value.sessions.map { it.id }).containsExactly("s1")
        assertThat(tokens.current()).isNotNull()
        assertThat(events).contains(SettingsEvent.Snackbar(R.string.settings_sessions_elsewhere_done))
        collecting.cancel()
    }

    // ---------------------------------------------------------- the email row

    @Test
    fun `email_row_opens_the_confirmation_on_the_owed_side`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.pendingEmailChange).isNotNull()
        assertThat(vm.state.value.emailDoor).isEqualTo(EmailDoor.CONFIRM)
    }

    @Test
    fun `email_row_opens_the_request_after_a_change_ran_out`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(pendingEmailChange = pending(expiresAt = NOW.minusSeconds(1))))
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.pendingEmailChange).isNull()
        assertThat(vm.state.value.emailDoor).isEqualTo(EmailDoor.REQUEST)
    }

    @Test
    fun `email_row_opens_the_applicant_change_for_an_unverified_applicant`() = runTest(dispatcher) {
        // G2: even with the carve-out pending, the applicant's own change opens.
        settings.read = Outcome.Success(
            account(
                state = AccountState.APPLICANT,
                emailVerified = false,
                pendingEmailChange = pending(requiresCode = false),
            ),
        )
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.emailDoor).isEqualTo(EmailDoor.APPLICANT)
    }

    // ---------------------------------------------------------- sign out

    @Test
    fun `sign_out_remembered_keeps_the_key_and_offers_the_account`() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onSignOut()
        idle()
        assertThat(tokens.current()).isNull()
        assertThat(identity.seed).isNotNull()
        assertThat(identity.custodyPurges).isEqualTo(0)
        assertThat(sessions.revoked).containsExactly(null)
    }

    @Test
    fun `sign_out_forgotten_with_a_backup_clears_without_asking`() = runTest(dispatcher) {
        signedIn()
        identity.forgetOnSignOut = true
        val vm = viewModel()
        idle()
        vm.onSignOut()
        idle()
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()
        assertThat(identity.custodyPurges).isEqualTo(1)
        assertThat(identity.seed).isNull()
        assertThat(tokens.current()).isNull()
    }

    @Test
    fun signOutForgottenWithNoKeyHereClearsWithoutAsking() = runTest(dispatcher) {
        signedIn()
        identity.seed = null
        identity.forgetOnSignOut = true
        settings.read = Outcome.Success(account(keyBackupCreatedAt = null))
        val vm = viewModel()
        idle()
        vm.onSignOut()
        idle()
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()
        assertThat(tokens.current()).isNull()
    }

    @Test
    fun `sign_out_forgotten_with_the_only_key_asks_first`() = runTest(dispatcher) {
        signedIn()
        identity.forgetOnSignOut = true
        settings.read = Outcome.Success(account(keyBackupCreatedAt = null))
        val vm = viewModel()
        idle()
        vm.onSignOut()
        idle()
        assertThat(vm.state.value.signOutConfirmOpen).isTrue()
        // Nothing ends and nothing is cleared before an answer.
        assertThat(tokens.current()).isNotNull()
        assertThat(identity.seed).isNotNull()
        assertThat(identity.custodyPurges).isEqualTo(0)
    }

    @Test
    fun anUnknownBackupStateAsksFirstToo() = runTest(dispatcher) {
        signedIn()
        identity.forgetOnSignOut = true
        settings.read = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        idle()
        vm.onSignOut()
        idle()
        assertThat(vm.state.value.signOutConfirmOpen).isTrue()
        assertThat(tokens.current()).isNotNull()
    }

    @Test
    fun `erase_purges_and_signs_out`() = runTest(dispatcher) {
        signedIn()
        identity.forgetOnSignOut = true
        settings.read = Outcome.Success(account(keyBackupCreatedAt = null))
        val vm = viewModel()
        idle()
        vm.onSignOut()
        idle()
        vm.onEraseAndSignOut()
        idle()
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()
        assertThat(identity.custodyPurges).isEqualTo(1)
        assertThat(identity.seed).isNull()
        assertThat(tokens.current()).isNull()
    }

    @Test
    fun `make_a_recovery_code_stays_signed_in`() = runTest(dispatcher) {
        signedIn()
        identity.forgetOnSignOut = true
        settings.read = Outcome.Success(account(keyBackupCreatedAt = null))
        val vm = viewModel()
        idle()
        vm.onSignOut()
        idle()
        vm.onMakeRecoveryCode()
        idle()
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()
        assertThat(tokens.current()).isNotNull()
        assertThat(identity.seed).isNotNull()
    }

    @Test
    fun `scrim_and_back_close_still_signed_in_focus_on_sign_out`() = runTest(dispatcher) {
        signedIn()
        identity.forgetOnSignOut = true
        settings.read = Outcome.Success(account(keyBackupCreatedAt = null))
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onSignOut()
        idle()
        vm.onDismissSignOutConfirm()
        idle()
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()
        assertThat(tokens.current()).isNotNull()
        assertThat(identity.seed).isNotNull()
        assertThat(events).contains(SettingsEvent.FocusSignOut)
        collecting.cancel()
    }

    // ------------------------------------------------- the interim backup

    @Test
    fun theNewBackupCodeOpensTheUploadedBlob() = runTest(dispatcher) {
        signedIn()
        val account = object : ThrowingAccountRepository() {
            var uploaded: ByteArray? = null

            override suspend fun keyBackupChallenge(): Outcome<ByteArray> = Outcome.Success(ByteArray(32) { 0x71 })

            override suspend fun uploadKeyBackup(blob: ByteArray, challenge: ByteArray, signature: ByteArray) =
                Outcome.Success(Unit).also { uploaded = blob }
        }
        val vm = BackupViewModel(BackupManager(identity, account), identity)
        idle()
        assertThat(vm.state.value.actorPresent).isTrue()
        vm.onCreateBackup()
        idle()
        val code = checkNotNull(vm.state.value.newBackupCode)
        assertThat(openKeyBackup(checkNotNull(account.uploaded), RecoveryCode.fromInput(code))).isEqualTo(identity.seed)
        vm.onBackupCodeSaved()
        assertThat(vm.state.value.newBackupCode).isNull()
    }
}
