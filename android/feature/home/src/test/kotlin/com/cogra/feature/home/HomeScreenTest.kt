package com.cogra.feature.home

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.AccountState
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

    private fun render(
        state: HomeUiState,
        onActorRestoredShown: () -> Unit = {},
        onOpenInvites: () -> Unit = {},
        onOpenSettings: () -> Unit = {},
    ) {
        compose.setContent {
            HomeScreen(
                state = state,
                onPullRefresh = {},
                onTokenChange = {}, onVerify = {}, onResendEmailChange = {}, onResend = {},
                onRearmInputChange = {}, onRearm = {},
                onDismissWaitingHint = {}, onApprovedShown = {}, onWelcomeShown = {},
                onPDirectedChange = {}, onPInterestChange = {},
                onReciprocate = {}, onDismissReciprocation = {}, onResumePending = {},
                onActorRestoredShown = onActorRestoredShown,
                onOpenInvites = onOpenInvites, onOpenSettings = onOpenSettings, onRestoreActor = {},
                onStartKeyCeremony = {},
            )
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
    fun anApplicantAwaitingVerificationGetsTheTokenCardAndTheShellButtons() {
        render(applicant(awaiting(emailVerified = false)))
        compose.onNodeWithTag("verify_token").assertExists()
        compose.onNodeWithTag("verify_submit").assertIsNotEnabled()
        // Only acting is gated (auth.md "Application"): the shell buttons
        // stay — Settings live, Invites visible but locked.
        compose.onNodeWithTag("home_invites").assertExists()
        compose.onNodeWithTag("home_settings").assertExists()
    }

    @Test
    fun anApplicantsSettingsButtonNavigates() {
        var opened = false
        render(applicant(awaiting()), onOpenSettings = { opened = true })
        compose.onNodeWithTag("home_settings").performScrollTo().performClick()
        assertThat(opened).isTrue()
    }

    @Test
    fun anApplicantsInvitesTapExplainsInsteadOfNavigating() {
        var opened = false
        render(applicant(awaiting()), onOpenInvites = { opened = true })
        compose.onNodeWithTag("home_invites").performScrollTo().performClick()
        assertThat(opened).isFalse()
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun aMembersInvitesTapNavigates() {
        var opened = false
        render(HomeUiState(loading = false), onOpenInvites = { opened = true })
        compose.onNodeWithTag("home_invites").performScrollTo().performClick()
        assertThat(opened).isTrue()
        compose.onNodeWithTag("home_snackbar").assertDoesNotExist()
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
    fun aKeyAttachedElsewhereOffersRestoreInstead() {
        render(applicant(awaiting(keyAttached = true, keyOnDevice = false)))
        compose.onNodeWithTag("home_restore").assertExists()
        compose.onNodeWithTag("home_create_key").assertDoesNotExist()
    }

    @Test
    fun theWaitingHintShowsAndDismisses() {
        render(applicant(awaiting()))
        compose.onNodeWithTag("home_waiting").assertExists()
        compose.onNodeWithTag("home_waiting_dismiss").assertExists()
    }

    @Test
    fun aDismissedWaitingHintLeavesTheShellButtons() {
        render(applicant(awaiting(), dismissed = true))
        compose.onNodeWithTag("home_waiting").assertDoesNotExist()
        compose.onNodeWithTag("home_invites").assertExists()
        compose.onNodeWithTag("home_settings").assertExists()
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
                rearmError = com.cogra.domain.ErrorCode.INVITE_UNUSABLE,
            ),
        )
        compose.onNodeWithTag("rearm_error").assertExists()
    }

    @Test
    fun applicantErrorsRender() {
        render(applicant(RegistrationProgress.RejectedByDevice("seal mismatch")))
        compose.onNodeWithTag("home_application_rejected").assertExists()
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
