package com.cogra.feature.home

import android.content.Context
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ApplicationProvider
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.ErrorCode
import com.cogra.domain.UserProfile
import com.cogra.domain.signing.RegistrationProgress
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class StatusBannersTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(state: HomeUiState) {
        compose.setContent {
            StatusBanners(
                state = state,
                onTokenChange = {}, onVerify = {}, onResendEmailChange = {}, onResend = {},
                onRearmInputChange = {}, onRearm = {},
                onDismissWaitingHint = {},
                onPDirectedChange = {}, onPInterestChange = {},
                onReciprocate = {}, onDismissReciprocation = {}, onResumePending = {},
                onStartKeyCeremony = {},
            )
        }
    }

    /** The one-shots ride the shell's host; the harness stands in for it. */
    private fun renderOneShots(state: HomeUiState, onShown: () -> Unit = {}) {
        compose.setContent {
            val host = remember { SnackbarHostState() }
            StatusBannerOneShots(
                state = state,
                snackbarHostState = host,
                onActorRestoredShown = onShown,
                onApprovedShown = onShown,
                onWelcomeShown = onShown,
            )
            SnackbarHost(host, modifier = Modifier.testTag("home_snackbar"))
        }
    }

    private fun applicant(progress: RegistrationProgress?, dismissed: Boolean = false) =
        HomeUiState(
            loading = false,
            applicant = true,
            profile = UserProfile("u", "joiner", null, AccountState.APPLICANT, false, null),
            progress = progress,
            waitingHintDismissed = dismissed,
        )

    private fun awaiting(
        emailVerified: Boolean = true,
        keyAttached: Boolean = true,
        keyOnDevice: Boolean = true,
    ) = RegistrationProgress.AwaitingApproval(emailVerified, keyAttached, keyOnDevice)

    @Test
    fun aLoadingStateRendersNothing() {
        render(HomeUiState(loading = true, huskWarning = true))
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
    }

    @Test
    fun theHuskWarningRidesTheCollapsingTopNotTheStack() {
        render(HomeUiState(loading = false, huskWarning = true))
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
        compose.onNodeWithTag("home_reciprocation").assertDoesNotExist()
    }

    @Test
    fun theKeyRestoreBannerShowsForAMemberHusk() {
        compose.setContent {
            KeyRestoreBanner(HomeUiState(loading = false, huskWarning = true), onRestoreActor = {})
        }
        compose.onNodeWithTag("home_restore").assertExists()
    }

    @Test
    fun theKeyRestoreBannerShowsForAnApplicantKeyAttachedElsewhere() {
        compose.setContent {
            KeyRestoreBanner(
                applicant(awaiting(keyAttached = true, keyOnDevice = false)),
                onRestoreActor = {},
            )
        }
        compose.onNodeWithTag("home_restore").assertExists()
    }

    @Test
    fun theKeyRestoreBannerShowsWhileTheSigningKeyBlocksLanding() {
        compose.setContent {
            KeyRestoreBanner(
                applicant(RegistrationProgress.AwaitingSigningKey),
                onRestoreActor = {},
            )
        }
        compose.onNodeWithTag("home_restore").assertExists()
    }

    @Test
    fun theKeyRestoreBannerStaysQuietPreCeremonyAndOnKeyedDevices() {
        compose.setContent {
            Column {
                // No key anywhere yet: the ask is the ceremony, never
                // a restore with nothing to restore.
                KeyRestoreBanner(
                    applicant(awaiting(keyAttached = false, keyOnDevice = false)),
                    onRestoreActor = {},
                )
                KeyRestoreBanner(applicant(awaiting()), onRestoreActor = {})
                KeyRestoreBanner(
                    HomeUiState(loading = false, huskWarning = false),
                    onRestoreActor = {},
                )
            }
        }
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
    }

    @Test
    fun theReciprocationPromptRendersWithSliders() {
        render(
            HomeUiState(
                loading = false,
                profile = UserProfile("u", "joiner", null, AccountState.MEMBER, false, ActorRef("i", "inviter")),
                reciprocationTarget = ActorRef("i", "inviter"),
            ),
        )
        compose.onNodeWithTag("home_reciprocation").assertExists()
        compose.onNodeWithTag("home_p_directed").assertExists()
        compose.onNodeWithTag("home_reciprocate_skip").assertExists()
    }

    @Test
    fun aFreshRestoreShowsTheConfirmationSnackbar() {
        renderOneShots(HomeUiState(loading = false, actorRestored = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun theSnackbarConsumesItsOneShotAfterShowing() {
        var shown = false
        renderOneShots(
            HomeUiState(loading = false, actorRestored = true),
            onShown = { shown = true },
        )
        // Consumption happens only after the snackbar's display run ends.
        assertThat(shown).isFalse()
        compose.mainClock.advanceTimeBy(10_000)
        assertThat(shown).isTrue()
    }

    @Test
    fun theApprovalAndWelcomeOneShotsShowTheSnackbar() {
        renderOneShots(HomeUiState(loading = false, approved = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun parkedHandshakesOfferResume() {
        render(HomeUiState(loading = false, pendingHandshakes = 2))
        compose.onNodeWithTag("home_pending").assertExists()
        compose.onNodeWithTag("home_resume").assertExists()
    }

    @Test
    fun anApplicantAwaitingVerificationGetsTheTokenCard() {
        render(applicant(awaiting(emailVerified = false)))
        compose.onNodeWithTag("verify_token").assertExists()
        compose.onNodeWithTag("verify_submit").assertIsNotEnabled()
    }

    @Test
    fun aRateLimitedVerifyShowsTheDeliberateRefusalCopy() {
        // Never the connectivity copy: the server refused on purpose.
        val context: Context = ApplicationProvider.getApplicationContext()
        render(
            applicant(awaiting(emailVerified = false))
                .copy(verifyError = ErrorCode.RATE_LIMITED),
        )
        compose.onNodeWithTag("verify_error")
            .assertTextEquals(context.getString(R.string.error_rate_limited))
    }

    @Test
    fun anUnknownVerifyRefusalFallsBackToTheTokenCopy() {
        val context: Context = ApplicationProvider.getApplicationContext()
        render(
            applicant(awaiting(emailVerified = false))
                .copy(verifyError = ErrorCode.INTERNAL),
        )
        compose.onNodeWithTag("verify_error")
            .assertTextEquals(context.getString(R.string.home_verify_failed))
    }

    @Test
    fun aRateLimitedResendShowsTheDeliberateRefusalCopy() {
        val context: Context = ApplicationProvider.getApplicationContext()
        render(
            applicant(awaiting(emailVerified = false))
                .copy(resendError = ErrorCode.RATE_LIMITED),
        )
        compose.onNodeWithTag("resend_error")
            .assertTextEquals(context.getString(R.string.error_rate_limited))
        compose.onNodeWithTag("verify_resent").assertDoesNotExist()
    }

    @Test
    fun aForeignDeviceKeyGetsItsOwnCardNotTheWaitingHint() {
        // keyOnDevice without keyAttached: this account's slot holds a
        // key the server refused to accept on the repair-attach.
        render(applicant(awaiting(keyAttached = false, keyOnDevice = true)))
        compose.onNodeWithTag("home_key_elsewhere").assertExists()
        compose.onNodeWithTag("home_fresh_key").assertExists()
        compose.onNodeWithTag("home_waiting").assertDoesNotExist()
        compose.onNodeWithTag("home_create_key").assertDoesNotExist()
    }

    @Test
    fun aMissingKeyShowsTheCeremonyCardAlongsideTheVerifyCard() {
        // The two proofs are independent (auth.md "Application"): both
        // cards can show at once.
        render(applicant(awaiting(emailVerified = false, keyAttached = false, keyOnDevice = false)))
        compose.onNodeWithTag("verify_token").assertExists()
        compose.onNodeWithTag("home_create_key").assertExists()
    }

    @Test
    fun aKeyAttachedElsewhereLeavesRestoreToTheCollapsingTop() {
        render(applicant(awaiting(keyAttached = true, keyOnDevice = false)))
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
        compose.onNodeWithTag("home_create_key").assertDoesNotExist()
        compose.onNodeWithTag("home_waiting").assertDoesNotExist()
    }

    @Test
    fun theWaitingHintShowsAndDismisses() {
        render(applicant(awaiting()))
        compose.onNodeWithTag("home_waiting").assertExists()
        compose.onNodeWithTag("home_waiting_dismiss").assertExists()
    }

    @Test
    fun aDismissedWaitingHintLeavesTheBannerAreaQuiet() {
        render(applicant(awaiting(), dismissed = true))
        compose.onNodeWithTag("home_waiting").assertDoesNotExist()
    }

    @Test
    fun landingRendersItsStatusLine() {
        render(applicant(RegistrationProgress.AwaitingLanding))
        compose.onNodeWithTag("home_landing").assertExists()
    }

    @Test
    fun aDeadApplicationRendersTheRearmCard() {
        render(applicant(RegistrationProgress.NeedsInvite))
        compose.onNodeWithTag("home_rearm").assertExists()
        compose.onNodeWithTag("rearm_input").assertExists()
        compose.onNodeWithTag("rearm_submit").assertIsNotEnabled()
    }

    @Test
    fun aRearmRefusalRendersItsMessage() {
        render(
            applicant(RegistrationProgress.NeedsInvite).copy(
                rearmInput = "x",
                rearmError = ErrorCode.INVITE_UNUSABLE,
            ),
        )
        compose.onNodeWithTag("rearm_error").assertExists()
    }

    @Test
    fun applicantErrorsRender() {
        render(applicant(RegistrationProgress.RejectedByDevice("seal mismatch")))
        compose.onNodeWithTag("home_application_rejected").assertExists()
    }
}
