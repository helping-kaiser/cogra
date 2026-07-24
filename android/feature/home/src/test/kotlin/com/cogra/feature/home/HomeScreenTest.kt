package com.cogra.feature.home

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.ActorRef
import com.cogra.domain.UserProfile
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class HomeScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(state: HomeUiState) {
        compose.setContent {
            HomeScreen(
                state = state,
                onPDirectedChange = {}, onPInterestChange = {},
                onReciprocate = {}, onDismissReciprocation = {}, onResumePending = {},
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
    fun parkedHandshakesOfferResume() {
        render(HomeUiState(loading = false, pendingHandshakes = 2))
        compose.onNodeWithTag("home_pending").assertExists()
        compose.onNodeWithTag("home_resume").assertExists()
    }
}
