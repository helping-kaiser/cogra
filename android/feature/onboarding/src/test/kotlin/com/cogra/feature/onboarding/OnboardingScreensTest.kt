package com.cogra.feature.onboarding

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
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
    fun theFormBlocksAnInvalidSubmit() {
        compose.setContent {
            ApplyScreen(
                state = ApplyUiState(handle = "ab", email = "a@b.c", password = "short"),
                onHandleChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
            )
        }
        compose.onNodeWithTag("apply_continue").assertIsNotEnabled()
    }

    @Test
    fun theFormPasswordCarriesItsVisibilityToggle() {
        compose.setContent {
            ApplyScreen(
                state = ApplyUiState(),
                onHandleChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
            )
        }
        compose.onNodeWithTag("apply_password_toggle").assertExists()
    }

    @Test
    fun aRefusedRegisterRendersItsMessage() {
        compose.setContent {
            ApplyScreen(
                state = ApplyUiState(
                    handle = "joiner",
                    email = "a@b.c",
                    password = "a strong password",
                    error = com.cogra.domain.ErrorCode.EMAIL_IN_USE,
                    errorField = "email",
                ),
                onHandleChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
            )
        }
        compose.onNodeWithTag("apply_error").assertExists()
    }

    @Test
    fun theCeremonyShowsTheCodeExactlyWhenCreated() {
        compose.setContent {
            KeyCeremonyScreen(
                state = KeyCeremonyUiState(recoveryCode = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE"),
                onAcceptBackup = {},
                onCodeSaved = {},
                onDeclineBackup = {},
                onCancelDecline = {},
                onConfirmDecline = {},
            )
        }
        compose.onNodeWithTag("backup_code").assertExists()
        compose.onNodeWithTag("backup_accept").assertDoesNotExist()
    }

    @Test
    fun decliningSurfacesTheConsequenceDialog() {
        compose.setContent {
            KeyCeremonyScreen(
                state = KeyCeremonyUiState(confirmingDecline = true),
                onAcceptBackup = {},
                onCodeSaved = {},
                onDeclineBackup = {},
                onCancelDecline = {},
                onConfirmDecline = {},
            )
        }
        compose.onNodeWithTag("backup_decline_consequence").assertExists()
        compose.onNodeWithTag("backup_decline_confirm").assertExists()
    }

    @Test
    fun aFailedAttachRendersItsError() {
        compose.setContent {
            KeyCeremonyScreen(
                state = KeyCeremonyUiState(attachFailed = true),
                onAcceptBackup = {},
                onCodeSaved = {},
                onDeclineBackup = {},
                onCancelDecline = {},
                onConfirmDecline = {},
            )
        }
        compose.onNodeWithTag("ceremony_attach_error").assertExists()
        compose.onNodeWithTag("backup_accept").assertExists()
    }
}
