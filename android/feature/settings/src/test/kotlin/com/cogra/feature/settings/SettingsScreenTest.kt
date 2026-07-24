package com.cogra.feature.settings

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.SessionInfo
import java.time.Instant
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SettingsScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(state: SettingsUiState) {
        compose.setContent {
            SettingsScreen(
                state = state,
                onCreateBackup = {}, onBackupCodeSaved = {},
                onRevokeSession = {}, onRevokeOthers = {},
                onCurrentPasswordChange = {}, onNewPasswordChange = {}, onChangePassword = {},
                onNewHandleChange = {}, onChangeHandle = {},
                onNewEmailChange = {}, onRequestEmailChange = {},
                onEmailChangeCodeChange = {}, onConfirmEmailChange = {},
                onSignOut = {},
            )
        }
    }

    @Test
    fun aFreshBackupCodeShowsOnceWithItsWarning() {
        render(SettingsUiState(actorPresent = true, newBackupCode = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE"))
        compose.onNodeWithTag("settings_backup_code").assertExists()
        compose.onNodeWithTag("settings_backup_create").assertDoesNotExist()
    }

    @Test
    fun noActorMeansNoBackupButton() {
        render(SettingsUiState(actorPresent = false))
        compose.onNodeWithTag("settings_backup_create").assertIsNotEnabled()
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
