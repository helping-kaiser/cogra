package com.cogra.feature.settings

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.KeyGate
import com.cogra.core.designsystem.KeyGateResult
import com.cogra.domain.ErrorCode
import com.cogra.domain.SessionInfo
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private const val BACKUP_CODE = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE"

@RunWith(RobolectricTestRunner::class)
class SettingsScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        state: SettingsUiState,
        onFeedbackShown: () -> Unit = {},
        onBack: () -> Unit = {},
        onCreateBackup: () -> Unit = {},
        onBackupCodeSaved: () -> Unit = {},
        onExportKey: () -> Unit = {},
        keyGate: KeyGate = FakeKeyGate(KeyGateResult.Granted),
        keyBanner: @Composable () -> Unit = {},
    ) {
        compose.setContent {
            SettingsScreen(
                state = state,
                onBack = onBack,
                onCreateBackup = onCreateBackup, onBackupCodeSaved = onBackupCodeSaved,
                onExportKey = onExportKey,
                onRevokeSession = {}, onRevokeOthers = {},
                onCurrentPasswordChange = {}, onNewPasswordChange = {}, onChangePassword = {},
                onNewHandleChange = {}, onChangeHandle = {},
                onNewEmailChange = {}, onEmailChangePasswordChange = {}, onRequestEmailChange = {},
                onEmailChangeCodeChange = {}, onConfirmEmailChange = {},
                onFeedbackShown = onFeedbackShown,
                onSignOut = {},
                keyGate = keyGate,
                keyBanner = keyBanner,
            )
        }
    }

    // Settings hosts the key-banner slot on its collapsing top like
    // every main surface (design.md §6).
    @Test
    fun settingsHostsTheKeyBannerSlot() {
        render(
            SettingsUiState(),
            keyBanner = {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("key_banner"),
                )
            },
        )
        compose.onNodeWithTag("key_banner").assertExists()
    }

    @Test
    fun aCompletedActionShowsTheConfirmationSnackbar() {
        render(SettingsUiState(feedback = SettingsFeedback.Done(SettingsAction.HANDLE_CHANGED)))
        compose.onNodeWithTag("settings_snackbar").assertExists()
    }

    @Test
    fun aRefusalShowsTheErrorSnackbar() {
        render(SettingsUiState(feedback = SettingsFeedback.Error(ErrorCode.INVALID_CREDENTIALS)))
        compose.onNodeWithTag("settings_snackbar").assertExists()
    }

    @Test
    fun theSnackbarConsumesItsOneShotAfterShowing() {
        var shown = false
        render(
            SettingsUiState(feedback = SettingsFeedback.Transport),
            onFeedbackShown = { shown = true },
        )
        compose.onNodeWithTag("settings_snackbar").assertExists()
        // Consumption happens only after the snackbar's display run ends.
        assertThat(shown).isFalse()
        compose.mainClock.advanceTimeBy(10_000)
        assertThat(shown).isTrue()
    }

    @Test
    fun theEmailChangeRequestNeedsItsOwnPasswordField() {
        // The password-change card's field must not arm the request.
        render(SettingsUiState(newEmail = "new@example.org", currentPassword = "pw"))
        compose.onNodeWithTag("settings_email_password").assertExists()
        compose.onNodeWithTag("settings_request_email").assertIsNotEnabled()
    }

    @Test
    fun anEmailChangePasswordArmsTheRequest() {
        render(SettingsUiState(newEmail = "new@example.org", emailChangePassword = "pw"))
        compose.onNodeWithTag("settings_request_email").assertIsEnabled()
    }

    @Test
    fun everyPasswordFieldCarriesItsVisibilityToggle() {
        render(SettingsUiState())
        compose.onNodeWithTag("settings_current_password_toggle").assertExists()
        compose.onNodeWithTag("settings_new_password_toggle").assertExists()
        compose.onNodeWithTag("settings_email_password_toggle").assertExists()
    }

    @Test
    fun noPendingFeedbackMeansNoSnackbar() {
        render(SettingsUiState())
        compose.onNodeWithTag("settings_snackbar").assertDoesNotExist()
    }

    @Test
    fun theTopBarBackArrowReportsUp() {
        var back = false
        render(SettingsUiState(), onBack = { back = true })
        compose.onNodeWithTag("settings_back").performClick()
        assertThat(back).isTrue()
    }

    @Test
    fun aFreshBackupCodeShowsOnceWithItsWarning() {
        render(SettingsUiState(actorPresent = true, newBackupCode = BACKUP_CODE))
        compose.onNodeWithTag("recovery_code").assertExists()
        compose.onNodeWithTag("settings_backup_create").assertDoesNotExist()
    }

    @Test
    fun aFreshBackupCodeIsDismissedOnlyByTypingItBack() {
        var saved = false
        render(
            SettingsUiState(actorPresent = true, newBackupCode = BACKUP_CODE),
            onBackupCodeSaved = { saved = true },
        )

        compose.onNodeWithTag("recovery_code_saved").assertIsNotEnabled()
        compose.onNodeWithTag("recovery_code_typed_back").performTextInput(BACKUP_CODE)
        compose.onNodeWithTag("recovery_code_saved").performClick()

        assertThat(saved).isTrue()
    }

    @Test
    fun noActorMeansNoBackupButton() {
        render(SettingsUiState(actorPresent = false))
        compose.onNodeWithTag("settings_backup_create").assertIsNotEnabled()
        compose.onNodeWithTag("settings_export_key").assertDoesNotExist()
    }

    // ------------------------------------------------------- the key gate

    @Test
    fun replacingTheCodeRunsOnlyAfterTheDeviceConfirms() {
        var replaced = false
        render(
            SettingsUiState(actorPresent = true),
            onCreateBackup = { replaced = true },
            keyGate = FakeKeyGate(KeyGateResult.Granted),
        )
        compose.onNodeWithTag("settings_backup_create").performClick()
        compose.waitForIdle()
        assertThat(replaced).isTrue()
    }

    @Test
    fun aRefusedConfirmationLeavesTheBackupAlone() {
        var replaced = false
        render(
            SettingsUiState(actorPresent = true),
            onCreateBackup = { replaced = true },
            keyGate = FakeKeyGate(KeyGateResult.Denied),
        )
        compose.onNodeWithTag("settings_backup_create").performClick()
        compose.waitForIdle()
        assertThat(replaced).isFalse()
        compose.onNodeWithTag("key_gate_no_lock").assertDoesNotExist()
    }

    @Test
    fun aPhoneThatCannotAskWarnsInsteadOfBlocking() {
        var replaced = false
        render(
            SettingsUiState(actorPresent = true),
            onCreateBackup = { replaced = true },
            keyGate = FakeKeyGate(KeyGateResult.Unavailable),
        )
        compose.onNodeWithTag("settings_backup_create").performClick()
        compose.waitForIdle()
        assertThat(replaced).isFalse()

        compose.onNodeWithTag("key_gate_continue").performClick()
        compose.waitForIdle()
        assertThat(replaced).isTrue()
    }

    @Test
    fun theWarningsOtherAnswerLeavesTheActionUnrun() {
        var replaced = false
        render(
            SettingsUiState(actorPresent = true),
            onCreateBackup = { replaced = true },
            keyGate = FakeKeyGate(KeyGateResult.Unavailable),
        )
        compose.onNodeWithTag("settings_backup_create").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("key_gate_set_lock").performClick()
        compose.waitForIdle()
        assertThat(replaced).isFalse()
        compose.onNodeWithTag("key_gate_no_lock").assertDoesNotExist()
    }

    @Test
    fun theExportEntryNavigatesWithoutAGate() {
        var exported = false
        render(
            SettingsUiState(actorPresent = true),
            onExportKey = { exported = true },
            keyGate = FakeKeyGate(KeyGateResult.Denied),
        )
        compose.onNodeWithTag("settings_export_key").performClick()
        compose.waitForIdle()
        // Arriving reveals nothing — the export screen carries its own gate.
        assertThat(exported).isTrue()
    }

    @Test
    fun theCurrentSessionHasNoRevokeButton() {
        render(
            SettingsUiState(
                actorPresent = true,
                sessions = listOf(
                    SessionInfo("s1", "phone", Instant.EPOCH, null, Instant.MAX, isCurrent = true),
                    SessionInfo("s2", "tablet", Instant.EPOCH, null, Instant.MAX, isCurrent = false),
                ),
            ),
        )
        compose.onNodeWithTag("revoke_s1").assertDoesNotExist()
        compose.onNodeWithTag("revoke_s2").assertExists()
    }
}
