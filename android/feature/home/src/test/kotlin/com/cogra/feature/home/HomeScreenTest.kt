package com.cogra.feature.home

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.ActorRef
import com.cogra.domain.UserProfile
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
                onPDirectedChange = {}, onPInterestChange = {},
                onReciprocate = {}, onDismissReciprocation = {}, onResumePending = {},
                onActorRestoredShown = onActorRestoredShown,
                onOpenInvites = {}, onOpenSettings = {}, onRestoreActor = {},
            )
        }
    }

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
}
