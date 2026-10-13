package com.cogra.feature.settings

import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.openKeyBackup
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.deletion.DeletionStanding
import com.cogra.domain.identity.BackupManager
import com.cogra.domain.testing.ScriptedAccountDeletionRepository
import com.cogra.domain.identity.DeviceLock
import com.cogra.domain.identity.SignOut
import com.cogra.domain.settings.SensitiveContentChoice
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.store.ThemeChoice
import com.cogra.domain.testing.FakeDeviceData
import com.cogra.domain.testing.FakeDeviceLockRepository
import com.cogra.domain.testing.FakeDevicePreferences
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeLockCustodyStore
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
    private val sensitive = SensitiveContentChoice()
    private val deletions = ScriptedAccountDeletionRepository()
    private val deletionState = AccountDeletionState(deletions)
    private val deviceData = FakeDeviceData(tokens, identity, device)
    private val custody = FakeLockCustodyStore()
    private val locks = FakeDeviceLockRepository().apply { sessionAccount = "u1" }
    private val deviceLock = DeviceLock(custody, tokens, locks)

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
        SignOut(sessions, identity, tokens, deviceData, deviceLock),
        identity,
        device,
        sensitive,
        deletionState,
        deviceLock,
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

    // ------------------------------------------------- sensitive content

    @Test
    fun `unveil_switch_reads_off_by_default`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.alwaysUnveil).isFalse()
    }

    @Test
    fun `unveil_switch_flips_without_a_dialog_and_saves_to_the_account`() = runTest(dispatcher) {
        val vm = viewModel()
        idle()
        vm.onAlwaysUnveil()
        // Optimistic: every veil answers before the save does.
        assertThat(sensitive.alwaysUnveil.value).isTrue()
        idle()
        assertThat(vm.state.value.alwaysUnveil).isTrue()
        assertThat(settings.unveilSaves).containsExactly(true)
        assertThat(sensitive.level.value).isEqualTo(0)
        assertThat(vm.state.value.signOutConfirmOpen).isFalse()

        vm.onAlwaysUnveil()
        idle()
        // Off saves the explicit null that restores the veil.
        assertThat(settings.unveilSaves).containsExactly(true, false).inOrder()
        assertThat(sensitive.level.value).isNull()
        assertThat(vm.state.value.alwaysUnveil).isFalse()
    }

    @Test
    fun `a_choice_made_on_another_device_reads_here`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(contentFilteringSeverityLevel = 0))
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.alwaysUnveil).isTrue()
        assertThat(sensitive.alwaysUnveil.value).isTrue()
    }

    @Test
    fun `a level other than 0 reads off — the gradient is post-MVP`() = runTest(dispatcher) {
        settings.read = Outcome.Success(account(contentFilteringSeverityLevel = 4))
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.alwaysUnveil).isFalse()
    }

    @Test
    fun `unveil_save_without_an_answer_reverts_with_the_no_answer_snackbar`() = runTest(dispatcher) {
        settings.saveUnveil = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onAlwaysUnveil()
        assertThat(sensitive.alwaysUnveil.value).isTrue()
        idle()
        assertThat(vm.state.value.alwaysUnveil).isFalse()
        assertThat(sensitive.level.value).isNull()
        assertThat(events).containsExactly(SettingsEvent.Snackbar(R.string.network_error))
        collecting.cancel()
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

    @Test
    fun `forget_switch_on_obtains_a_lock_and_off_discards_it`() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onForgetOnSignOut()
        idle()
        val id = custody.lockId("u1")
        assertThat(id).isNotNull()
        assertThat(locks.rows).containsKey(id)
        vm.onForgetOnSignOut()
        idle()
        assertThat(custody.lockId("u1")).isNull()
        assertThat(locks.rows).doesNotContainKey(id)
    }

    @Test
    fun `the forget switch flips even when its lock gets no answer`() = runTest(dispatcher) {
        signedIn()
        locks.online = false
        val vm = viewModel()
        idle()
        vm.onForgetOnSignOut()
        idle()
        assertThat(vm.state.value.forgetOnSignOut).isTrue()
        assertThat(identity.forgetOnSignOut).isTrue()
        assertThat(custody.heldLock("u1")).isNull()
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

    // ----------------------------------------------------- clearing data (B6)

    @Test
    fun `the_erase_row_asks_first_and_nothing_is_erased_before_an_answer`() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onErase()
        idle()
        // EraseConfirm.md:3 — the dialog stands; the reader is still signed in.
        assertThat(vm.state.value.eraseConfirmOpen).isTrue()
        assertThat(deviceData.erases).isEqualTo(0)
        assertThat(tokens.current()).isNotNull()
        assertThat(identity.seed).isNotNull()
    }

    @Test
    fun `the_erase_clears_the_device_and_ends_the_session`() = runTest(dispatcher) {
        signedIn()
        device.setTheme(ThemeChoice.DARK)
        val vm = viewModel()
        idle()
        vm.onErase()
        vm.onEraseEverything()
        idle()
        // EraseConfirm.md:21 — key, draft, picks, the device's choices and the
        // seen record (one store, one edit) go; the session ends.
        assertThat(vm.state.value.eraseConfirmOpen).isFalse()
        assertThat(deviceData.erases).isEqualTo(1)
        assertThat(identity.seed).isNull()
        assertThat(device.theme.value).isEqualTo(ThemeChoice.AUTO)
        assertThat(tokens.current()).isNull()
    }

    @Test
    fun `dismissing_the_erase_keeps_everything_and_returns_focus_to_the_row`() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onErase()
        vm.onDismissEraseConfirm()
        idle()
        assertThat(vm.state.value.eraseConfirmOpen).isFalse()
        assertThat(deviceData.erases).isEqualTo(0)
        assertThat(tokens.current()).isNotNull()
        assertThat(events).contains(SettingsEvent.FocusErase)
        collecting.cancel()
    }

    @Test
    fun `make_a_recovery_code_from_the_erase_stays_signed_in`() = runTest(dispatcher) {
        signedIn()
        val vm = viewModel()
        idle()
        vm.onErase()
        vm.onMakeRecoveryCodeFromErase()
        idle()
        assertThat(vm.state.value.eraseConfirmOpen).isFalse()
        assertThat(deviceData.erases).isEqualTo(0)
        assertThat(tokens.current()).isNotNull()
    }

    @Test
    fun `the_backup_state_keys_the_clearing_words`() = runTest(dispatcher) {
        signedIn()
        settings.read = Outcome.Success(account(keyBackupCreatedAt = null))
        val none = viewModel()
        idle()
        assertThat(none.state.value.backupMade).isFalse()
        settings.read = Outcome.Success(account())
        val made = viewModel()
        idle()
        assertThat(made.state.value.backupMade).isTrue()
    }

    // ---------------------------------------------------- delete account

    private val grace = AccountDeletion(NOW.plusSeconds(6 * 86_400), includesContent = false)

    private fun kotlinx.coroutines.test.TestScope.rowOpens(
        standing: DeletionStanding,
    ): List<SettingsEvent> {
        deletions.standing = Outcome.Success(standing)
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onDeleteAccount()
        idle()
        collecting.cancel()
        return events
    }

    @Test
    fun `the_row_reads_the_servers_path_and_the_grace`() = runTest(dispatcher) {
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        val vm = viewModel()
        idle()
        assertThat(vm.state.value.deletion).isEqualTo(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        assertThat(vm.state.value.graceDeletion).isEqualTo(grace)
        assertThat(vm.state.value.deletionLocked).isFalse()
    }

    @Test
    fun `the_row_opens_the_request_screen_on_either_open_path`() = runTest(dispatcher) {
        assertThat(rowOpens(DeletionStanding(AccountDeletionPath.BY_LINK, null)))
            .containsExactly(SettingsEvent.OpenDeletion(DeletionDoor.REQUEST))
        assertThat(rowOpens(DeletionStanding(AccountDeletionPath.IMMEDIATE, null)))
            .containsExactly(SettingsEvent.OpenDeletion(DeletionDoor.REQUEST))
    }

    @Test
    fun `in_the_grace_the_row_opens_the_grace_page`() = runTest(dispatcher) {
        assertThat(rowOpens(DeletionStanding(AccountDeletionPath.BY_LINK, grace)))
            .containsExactly(SettingsEvent.OpenDeletion(DeletionDoor.PENDING))
    }

    @Test
    fun `a_locked_row_answers_with_the_snackbar_and_opens_nothing`() = runTest(dispatcher) {
        assertThat(rowOpens(DeletionStanding(AccountDeletionPath.LOCKED, null)))
            .containsExactly(SettingsEvent.Snackbar(R.string.settings_ending_locked))
        // A path this build cannot name is the weaker claim: locked.
        assertThat(rowOpens(DeletionStanding(AccountDeletionPath.UNKNOWN, null)))
            .containsExactly(SettingsEvent.Snackbar(R.string.settings_ending_locked))
    }

    @Test
    fun `the_bands_cancel_takes_the_deletion_away_and_says_so`() = runTest(dispatcher) {
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onCancelDeletion()
        idle()
        assertThat(deletions.cancels).isEqualTo(1)
        assertThat(vm.state.value.graceDeletion).isNull()
        assertThat(events).containsExactly(SettingsEvent.Snackbar(R.string.deletion_canceled))
        collecting.cancel()
    }

    @Test
    fun `a_cancel_with_no_answer_keeps_the_band_and_says_the_network_error`() = runTest(dispatcher) {
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        deletions.cancel = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        idle()
        val events = mutableListOf<SettingsEvent>()
        val collecting = launch { vm.events.toList(events) }
        vm.onCancelDeletion()
        idle()
        assertThat(vm.state.value.graceDeletion).isEqualTo(grace)
        assertThat(events).containsExactly(SettingsEvent.Snackbar(R.string.network_error))
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
