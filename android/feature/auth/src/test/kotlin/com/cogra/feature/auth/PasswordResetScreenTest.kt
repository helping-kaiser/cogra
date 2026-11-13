package com.cogra.feature.auth

import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Reset.md against the drawn screen, bound to the registered `reset.*`
 * paths. Assertions bind to nodes and their order, never to text widths.
 */
@RunWith(RobolectricTestRunner::class)
class PasswordResetScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun show(
        state: ResetUiState = ResetUiState(),
        onRequest: () -> Unit = {},
        onBack: () -> Unit = {},
    ) {
        compose.setContent {
            PasswordResetScreen(state = state, onEmailChange = {}, onRequest = onRequest, onBack = onBack)
        }
    }

    private fun tag(path: String) = compose.onNodeWithTag(path, useUnmergedTree = true)

    private fun top(path: String): Float = tag(path).fetchSemanticsNode().positionInRoot.y

    private fun absent(path: String) =
        assertThat(compose.onAllNodesWithTag(path, useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()

    @Test
    fun theScreenReadsAsDrawn() {
        show()
        tag("reset.title").assertTextEquals("Reset your password")
        tag("reset.body").assertTextEquals(
            "Enter the email you signed up with and we send a reset link. " +
                "Resetting the password signs out every device.",
        )
        tag("reset.email.label").assertTextEquals("Email")
        compose.onNodeWithTag("reset.commit.action").assertTextEquals("Send reset link")
        // Reset.md:15 — the reset restores the sign-in only, never the key.
        tag("reset.note").assertTextEquals(
            "This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, " +
                "with your recovery code.",
        )
        assertThat(top("reset.header")).isLessThan(top("reset.title"))
        assertThat(top("reset.body")).isLessThan(top("reset.email"))
        assertThat(top("reset.email")).isLessThan(top("reset.commit"))
        assertThat(top("reset.commit")).isLessThan(top("reset.note"))
    }

    @Test
    fun theFieldIsTheEmailKind() {
        show()
        assertThat(tag("reset.email.input").fetchSemanticsNode().config.getOrNull(SemanticsProperties.ContentType))
            .isEqualTo(ContentType.EmailAddress)
    }

    @Test
    fun theHeadersBackArrowIsTheWayOut() {
        // Reset.md:3.
        var backs = 0
        show(onBack = { backs++ })
        tag("reset.header.back").performClick()
        assertThat(backs).isEqualTo(1)
    }

    @Test
    fun anEmptyEmailWaitsUnderItsLine() {
        // Reset.md:35.
        show()
        tag("reset.commit.action").assertIsNotEnabled()
        tag("reset.commit.reason").assertTextEquals("Waiting for your email")
    }

    @Test
    fun aTypedEmailWakesTheCommitAndTheLineGoes() {
        // Reset.md:37.
        var presses = 0
        show(ResetUiState(email = "a"), onRequest = { presses++ })
        tag("reset.commit.action").assertIsEnabled()
        absent("reset.commit.reason")
        compose.onNodeWithTag("reset.commit.action").performScrollTo().performClick()
        assertThat(presses).isEqualTo(1)
    }

    @Test
    fun theCommitWaitsWithoutDimmingOrASpinnerAndReadsItsParticiple() {
        // Reset.md:5-7, :21, :23.
        var presses = 0
        var backs = 0
        compose.mainClock.autoAdvance = false
        show(ResetUiState(email = "a@b.c", inFlight = true), onRequest = { presses++ }, onBack = { backs++ })
        compose.mainClock.advanceTimeBy(100)
        compose.onNode(hasText("Send reset link"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(150)
        compose.onNode(hasText("Sending reset link…"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(5_000)
        compose.onNode(hasText("Sending reset link…"), useUnmergedTree = true).assertExists()
        compose.mainClock.autoAdvance = true
        compose.onNodeWithTag("reset.commit.action").assertIsEnabled().performScrollTo().performClick()
        assertThat(presses).isEqualTo(0)
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertDoesNotExist()
        // :25 — the ways out stay live while the commit waits.
        tag("reset.header.back").performClick()
        assertThat(backs).isEqualTo(1)
    }

    @Test
    fun theStatusLineNeverStandsAtRest() {
        // Reset.md:31.
        show(ResetUiState(email = "a@b.c"))
        absent(RESET_STATUS_TAG)
    }

    @Test
    fun theAnsweredStatusLineNeverSaysWhetherTheEmailHasAnAccount() {
        // Reset.md:11, :15 — under the commit, the quiet note under it.
        show(ResetUiState(email = "a@b.c", requested = true))
        tag(RESET_STATUS_TAG).assertTextEquals(
            "If that email has an account, a reset link is on its way. " +
                "The link works once and expires after 15 minutes.",
        )
        assertThat(top("reset.commit")).isLessThan(top(RESET_STATUS_TAG))
        assertThat(top(RESET_STATUS_TAG)).isLessThan(top("reset.note"))
    }

    @Test
    fun noAnswerStandsAboveTheCommitWhichStaysTheRetry() {
        // Reset.md:19.
        show(ResetUiState(email = "a@b.c", fault = R.string.reset_no_answer))
        tag("reset.fault").assertTextEquals("That didn't send. Try again.")
        assertThat(top("reset.fault")).isLessThan(top("reset.commit.action"))
        tag("reset.commit.action").assertIsEnabled()
        absent(RESET_STATUS_TAG)
    }

    @Test
    fun thePageScrolls() {
        // Reset.md:33.
        show()
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.ScrollBy)).assertExists()
    }

    // The new password is never set here: it is set where the mailed link
    // lands (ResetNew), asked for twice (seam 275-1).
    @Test
    fun theRequestStepSetsNoPassword() {
        show()
        absent("reset.password")
        absent("reset.confirm")
    }
}
