package com.cogra.feature.onboarding

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.signing.RegistrationProgress
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class OnboardingScreensTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun anUnusableInviteShowsTheRefusalAndNoContinue() {
        compose.setContent {
            InviteEntryScreen(
                state = InviteEntryUiState(
                    input = "x",
                    check = com.cogra.domain.InviteCheck(false, "inviter", java.time.Instant.MAX),
                ),
                onInputChange = {},
                onCheck = {},
                onContinue = {},
                onLogInInstead = {},
            )
        }
        compose.onNodeWithTag("invite_error").assertExists()
        compose.onNodeWithTag("invite_continue").assertDoesNotExist()
    }

    @Test
    fun theBackupStepShowsTheCodeExactlyWhenCreated() {
        compose.setContent {
            ApplyScreen(
                state = ApplyUiState(step = ApplyStep.BACKUP, recoveryCode = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE"),
                onHandleChange = {}, onEmailChange = {}, onPasswordChange = {},
                onContinueToBackup = {}, onAcceptBackup = {}, onCodeSaved = {},
                onDeclineBackup = {}, onCancelDecline = {}, onConfirmDecline = {},
            )
        }
        compose.onNodeWithTag("backup_code").assertExists()
        compose.onNodeWithTag("backup_accept").assertDoesNotExist()
    }

    @Test
    fun decliningSurfacesTheConsequenceDialog() {
        compose.setContent {
            ApplyScreen(
                state = ApplyUiState(step = ApplyStep.BACKUP, confirmingDecline = true),
                onHandleChange = {}, onEmailChange = {}, onPasswordChange = {},
                onContinueToBackup = {}, onAcceptBackup = {}, onCodeSaved = {},
                onDeclineBackup = {}, onCancelDecline = {}, onConfirmDecline = {},
            )
        }
        compose.onNodeWithTag("backup_decline_consequence").assertExists()
        compose.onNodeWithTag("backup_decline_confirm").assertExists()
    }

    @Test
    fun theFormBlocksAnInvalidSubmit() {
        compose.setContent {
            ApplyScreen(
                state = ApplyUiState(handle = "ab", email = "a@b.c", password = "short"),
                onHandleChange = {}, onEmailChange = {}, onPasswordChange = {},
                onContinueToBackup = {}, onAcceptBackup = {}, onCodeSaved = {},
                onDeclineBackup = {}, onCancelDecline = {}, onConfirmDecline = {},
            )
        }
        compose.onNodeWithTag("apply_continue").assertIsNotEnabled()
    }

    @Test
    fun statusRendersEachStage() {
        compose.setContent {
            StatusScreen(
                state = StatusUiState(progress = RegistrationProgress.AwaitingEmailVerification),
                onTokenChange = {}, onVerify = {}, onResendEmailChange = {}, onResend = {},
            )
        }
        compose.onNodeWithTag("verify_token").assertExists()
        compose.onNodeWithTag("verify_submit").assertIsNotEnabled()
    }

    @Test
    fun statusShowsApprovalWaitAndLanding() {
        compose.setContent {
            StatusScreen(
                state = StatusUiState(progress = RegistrationProgress.AwaitingApproval),
                onTokenChange = {}, onVerify = {}, onResendEmailChange = {}, onResend = {},
            )
        }
        compose.onNodeWithTag("status_waiting").assertExists()
    }
}
