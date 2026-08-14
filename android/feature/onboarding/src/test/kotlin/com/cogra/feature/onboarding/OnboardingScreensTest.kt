package com.cogra.feature.onboarding

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private const val CEREMONY_CODE = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE"

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
                onBrowseFeed = {},
            )
        }
        compose.onNodeWithTag("invite_error").assertExists()
        compose.onNodeWithTag("invite_continue").assertDoesNotExist()
    }

    @Test
    fun theFrontDoorOffersBrowsingBeforeAnyCommitment() {
        var browsing = false
        compose.setContent {
            InviteEntryScreen(
                state = InviteEntryUiState(),
                onInputChange = {},
                onCheck = {},
                onContinue = {},
                onLogInInstead = {},
                onBrowseFeed = { browsing = true },
            )
        }
        compose.onNodeWithTag("invite_browse").performClick()
        assertThat(browsing).isTrue()
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
        showCeremonyCode()
        compose.onNodeWithTag("recovery_code").assertExists()
        compose.onNodeWithTag("backup_accept").assertDoesNotExist()
    }

    @Test
    fun theCeremonyCodeIsDismissedOnlyByTypingItBack() {
        var saved = false
        showCeremonyCode(onCodeSaved = { saved = true })

        compose.onNodeWithTag("recovery_code_saved").assertIsNotEnabled()
        compose.onNodeWithTag("recovery_code_typed_back").performTextInput(CEREMONY_CODE)
        compose.onNodeWithTag("recovery_code_saved").performClick()

        assertThat(saved).isTrue()
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
                state = KeyCeremonyUiState(attachError = AttachError.NETWORK),
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

    @Test
    fun aKeyBoundElsewhereRendersItsOwnError() {
        compose.setContent {
            KeyCeremonyScreen(
                state = KeyCeremonyUiState(attachError = AttachError.KEY_IN_USE),
                onAcceptBackup = {},
                onCodeSaved = {},
                onDeclineBackup = {},
                onCancelDecline = {},
                onConfirmDecline = {},
            )
        }
        compose.onNodeWithTag("ceremony_key_in_use").assertExists()
        compose.onNodeWithTag("ceremony_attach_error").assertDoesNotExist()
    }

    private fun showCeremonyCode(onCodeSaved: () -> Unit = {}) {
        compose.setContent {
            KeyCeremonyScreen(
                state = KeyCeremonyUiState(recoveryCode = CEREMONY_CODE),
                onAcceptBackup = {},
                onCodeSaved = onCodeSaved,
                onDeclineBackup = {},
                onCancelDecline = {},
                onConfirmDecline = {},
            )
        }
    }
}
