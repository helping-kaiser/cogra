package com.cogra.feature.onboarding

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
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

    // A real activity, because the code screen's trap is asserted against
    // the back dispatcher the system would actually hand the gesture to.
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

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
    fun theCodeScreensTrapClosesTheBandsDoorToo() {
        compose.setContent {
            KeyCeremonyScreen(
                state = KeyCeremonyUiState(recoveryCode = CEREMONY_CODE),
                onAcceptBackup = {},
                onCodeSaved = {},
                onDeclineBackup = {},
                onCancelDecline = {},
                onConfirmDecline = {},
                onBack = {},
            )
        }

        // The code is shown once and never stored, so a way out that is
        // not the typed-back confirmation takes the actor with it — and
        // the band's arrow is the same door the gesture is.
        compose.onNodeWithTag("key_ceremony_header_back").assertDoesNotExist()
    }

    @Test
    fun anEntryScreenOpensWithTheBandsWayBack() {
        var back = false
        compose.setContent {
            InviteEntryScreen(
                state = InviteEntryUiState(),
                onInputChange = {},
                onCheck = {},
                onContinue = {},
                onLogInInstead = {},
                onBrowseFeed = {},
                onBack = { back = true },
            )
        }

        // Every entry board draws the header band; without it the drawn
        // back edges had no control at all (EK-01).
        compose.onNodeWithTag("invite_header_back").performClick()

        assertThat(back).isTrue()
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

    @Test
    fun theCodeOnScreenRefusesTheSystemBackGesture() {
        showCeremony(KeyCeremonyUiState(recoveryCode = CEREMONY_CODE))

        // A code shown once and never stored cannot survive a back gesture,
        // so the screen holds an enabled callback that answers with nothing.
        assertThat(compose.activity.onBackPressedDispatcher.hasEnabledCallbacks()).isTrue()
    }

    @Test
    fun theBackupOfferBeforeTheCodeIsNotATrap() {
        showCeremony(KeyCeremonyUiState())

        assertThat(compose.activity.onBackPressedDispatcher.hasEnabledCallbacks()).isFalse()
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

    private fun showCeremony(state: KeyCeremonyUiState) {
        compose.setContent {
            KeyCeremonyScreen(
                state = state,
                onAcceptBackup = {},
                onCodeSaved = {},
                onDeclineBackup = {},
                onCancelDecline = {},
                onConfirmDecline = {},
            )
        }
        compose.waitForIdle()
    }
}
