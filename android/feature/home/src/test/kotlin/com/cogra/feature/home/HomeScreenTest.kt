package com.cogra.feature.home

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.ActorRef
import com.cogra.domain.UserProfile
import com.cogra.domain.signing.RegistrationProgress
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class HomeScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(state: HomeUiState, onActorRestoredShown: () -> Unit = {}) {
        compose.setContent {
            HomeScreen(
                state = state,
                onTokenChange = {}, onVerify = {}, onResendEmailChange = {}, onResend = {},
                onDismissWaitingHint = {}, onApprovedShown = {}, onWelcomeShown = {},
                onPDirectedChange = {}, onPInterestChange = {},
                onReciprocate = {}, onDismissReciprocation = {}, onResumePending = {},
                onActorRestoredShown = onActorRestoredShown,
                onOpenInvites = {}, onOpenSettings = {}, onRestoreActor = {},
            )
        }
    }

    private fun applicant(progress: RegistrationProgress?, dismissed: Boolean = false) =
        HomeUiState(
            loading = false,
            applicant = true,
            progress = progress,
            waitingHintDismissed = dismissed,
        )

    @Test
    fun theHuskStateOffersRestore() {
        render(HomeUiState(loading = false, huskWarning = true))
        compose.onNodeWithTag("home_restore").assertExists()
        compose.onNodeWithTag("home_reciprocation").assertDoesNotExist()
    }

    @Test
    fun theReciprocationPromptRendersWithSliders() {
        render(
            HomeUiState(
                loading = false,
                profile = UserProfile("u", "joiner", null, ActorRef("i", "inviter")),
                reciprocationTarget = ActorRef("i", "inviter"),
            ),
        )
        compose.onNodeWithTag("home_reciprocation").assertExists()
        compose.onNodeWithTag("home_p_directed").assertExists()
        compose.onNodeWithTag("home_reciprocate_skip").assertExists()
    }

    @Test
    fun aFreshRestoreShowsTheConfirmationSnackbar() {
        render(HomeUiState(loading = false, actorRestored = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun theSnackbarConsumesItsOneShotAfterShowing() {
        var shown = false
        render(
            HomeUiState(loading = false, actorRestored = true),
            onActorRestoredShown = { shown = true },
        )
        compose.onNodeWithTag("home_snackbar").assertExists()
        // Consumption happens only after the snackbar's display run ends.
        assertThat(shown).isFalse()
        compose.mainClock.advanceTimeBy(10_000)
        assertThat(shown).isTrue()
    }

    @Test
    fun parkedHandshakesOfferResume() {
        render(HomeUiState(loading = false, pendingHandshakes = 2))
        compose.onNodeWithTag("home_pending").assertExists()
        compose.onNodeWithTag("home_resume").assertExists()
    }

    @Test
    fun anApplicantAwaitingVerificationGetsTheTokenCardAndNoMemberChrome() {
        render(applicant(RegistrationProgress.AwaitingEmailVerification))
        compose.onNodeWithTag("verify_token").assertExists()
        compose.onNodeWithTag("verify_submit").assertIsNotEnabled()
        // Acting surfaces stay out of the applicant shell.
        compose.onNodeWithTag("home_invites").assertDoesNotExist()
        compose.onNodeWithTag("home_settings").assertDoesNotExist()
    }

    @Test
    fun theWaitingHintShowsAndDismisses() {
        render(applicant(RegistrationProgress.AwaitingApproval))
        compose.onNodeWithTag("home_waiting").assertExists()
        compose.onNodeWithTag("home_waiting_dismiss").assertExists()
    }

    @Test
    fun aDismissedWaitingHintIsGoneButNothingElseAppears() {
        render(applicant(RegistrationProgress.AwaitingApproval, dismissed = true))
        compose.onNodeWithTag("home_waiting").assertDoesNotExist()
        compose.onNodeWithTag("home_invites").assertDoesNotExist()
    }

    @Test
    fun landingRendersItsStatusLine() {
        render(applicant(RegistrationProgress.AwaitingLanding))
        compose.onNodeWithTag("home_landing").assertExists()
    }

    @Test
    fun applicantErrorsRender() {
        render(applicant(RegistrationProgress.ApplicationGone))
        compose.onNodeWithTag("home_application_gone").assertExists()
    }

    @Test
    fun theApprovalOneShotShowsTheSnackbar() {
        render(applicant(RegistrationProgress.AwaitingLanding).copy(approved = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun theWelcomeOneShotShowsTheSnackbarInTheMemberShell() {
        render(HomeUiState(loading = false, welcome = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }
}
