package com.cogra.feature.auth

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.Outcome
import com.cogra.domain.testing.ThrowingAccountRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * ResetExpired.md against the drawn screen, and ResetNew's route reading the
 * link before its form stands. Assertions bind to nodes, never to widths.
 */
@RunWith(RobolectricTestRunner::class)
class ResetExpiredScreenTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private fun tag(path: String) = compose.onNodeWithTag(path, useUnmergedTree = true)

    private fun top(path: String): Float = tag(path).fetchSemanticsNode().positionInRoot.y

    private fun absent(path: String) =
        assertThat(compose.onAllNodesWithTag(path, useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()

    @Test
    fun oneScreenNeverSayingWhichHappenedOrWhose() {
        // ResetExpired.md:3, :7, :9.
        compose.setContent { ResetExpiredScreen(onReset = {}, onSignIn = {}) }
        tag("reset.title").assertTextEquals("This link doesn't work anymore")
        tag("reset.title").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        tag("reset.body").assertTextEquals(
            "It may have expired or already been used. A reset link works once and expires after 15 minutes — " +
                "ask for a fresh one.",
        )
    }

    @Test
    fun noHeaderNoBackArrowNoMark() {
        // ResetExpired.md:5.
        compose.setContent { ResetExpiredScreen(onReset = {}, onSignIn = {}) }
        compose.onNode(hasContentDescription("Back")).assertDoesNotExist()
        absent("reset.header")
        absent("reset.mark")
    }

    @Test
    fun resetYourPasswordStandsOverAPlainSignInBelowTheWords() {
        // ResetExpired.md:11-17.
        var resets = 0
        var signIns = 0
        compose.setContent { ResetExpiredScreen(onReset = { resets++ }, onSignIn = { signIns++ }) }
        tag("reset.again").assertTextEquals("Reset your password")
        tag("reset.onward").assertTextEquals("Sign in")
        assertThat(top("reset.body")).isLessThan(top("reset.again"))
        assertThat(top("reset.again")).isLessThan(top("reset.onward"))
        compose.onNodeWithTag("reset.again").performScrollTo().performClick()
        assertThat(resets to signIns).isEqualTo(1 to 0)
        compose.onNodeWithTag("reset.onward").performScrollTo().performClick()
        assertThat(resets to signIns).isEqualTo(1 to 1)
    }

    @Test
    fun systemBackLeavesAndOpensNoCograScreen() {
        // ResetExpired.md:21 — the route hands Back to the platform's way out.
        var leaves = 0
        compose.setContent { ResetExpiredRoute(onReset = {}, onSignIn = {}, onLeave = { leaves++ }) }
        compose.runOnIdle { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.runOnIdle { assertThat(leaves).isEqualTo(1) }
    }

    @Test
    fun resetNewStandsBareWhileItsLinkIsCheckedAndOpensNoFormOnASpentOne() {
        // ResetNew.md:43 — the form never stands for a spent link.
        val answer = CompletableDeferred<Outcome<Boolean>>()
        val account = object : ThrowingAccountRepository() {
            override suspend fun passwordResetLinkCheck(token: String): Outcome<Boolean> = answer.await()
        }
        var expired = 0
        val vm = ResetNewViewModel(account)
        compose.setContent {
            ResetNewRoute(token = "t", onSignIn = {}, onExpired = { expired++ }, onLeave = {}, viewModel = vm)
        }
        tag(RESET_CHECKING_TAG).assertExists()
        absent("reset.title")
        absent("reset.password")
        answer.complete(Outcome.Success(false))
        compose.waitUntil(timeoutMillis = 5_000) { expired == 1 }
        absent("reset.password")
    }

    @Test
    fun resetNewOpensItsFormOnALiveLink() {
        val account = object : ThrowingAccountRepository() {
            override suspend fun passwordResetLinkCheck(token: String): Outcome<Boolean> = Outcome.Success(true)
        }
        val vm = ResetNewViewModel(account)
        compose.setContent {
            ResetNewRoute(token = "t", onSignIn = {}, onExpired = {}, onLeave = {}, viewModel = vm)
        }
        compose.waitUntil(timeoutMillis = 5_000) {
            compose.onAllNodesWithTag("reset.password", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        absent(RESET_CHECKING_TAG)
    }
}
