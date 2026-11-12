package com.cogra.feature.auth

import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasTestTag
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
 * ResetNew.md against the drawn screen, bound to the registered `reset.*`
 * paths. Assertions bind to nodes and their order, never to text widths.
 */
@RunWith(RobolectricTestRunner::class)
class ResetNewScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val filled = ResetNewUiState(password = "a strong password", confirm = "a strong password")

    private fun show(state: ResetNewUiState = ResetNewUiState(), onSubmit: () -> Unit = {}) {
        compose.setContent { ResetNewScreen(state, onPasswordChange = {}, onConfirmChange = {}, onSubmit = onSubmit) }
    }

    private fun tag(path: String) = compose.onNodeWithTag(path, useUnmergedTree = true)

    private fun top(path: String): Float = tag(path).fetchSemanticsNode().positionInRoot.y

    private fun reveal(field: String, name: String) = compose.onNode(
        hasContentDescription(name) and hasAnyAncestor(hasTestTag("$field.reveal")),
        useUnmergedTree = true,
    )

    private fun masked(path: String): Boolean =
        tag(path).fetchSemanticsNode().config.contains(SemanticsProperties.Password)

    @Test
    fun theScreenReadsAsDrawn() {
        show()
        tag("reset.title").assertTextEquals("Set a new password")
        tag("reset.body").assertTextEquals(
            "Setting a new password signs out every device. You sign in again with the new one.",
        )
        // ResetNew.md:13 — the quiet note, in Reset's own words.
        tag("reset.note").assertTextEquals(
            "This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, " +
                "with your recovery code.",
        )
        assertThat(top("reset.title")).isLessThan(top("reset.password"))
        assertThat(top("reset.commit")).isLessThan(top("reset.note"))
    }

    @Test
    fun theScreenCarriesNoHeaderAndNoBackArrow() {
        // ResetNew.md:5.
        show()
        compose.onNode(hasContentDescription("Back")).assertDoesNotExist()
        assertThat(compose.onAllNodesWithTag("reset.header", useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun twoPasswordFieldsMaskedAlikeEachWithItsOwnReveal() {
        // ResetNew.md:7-11.
        show(filled)
        tag("reset.password.label").assertTextEquals("New password")
        tag("reset.confirm.label").assertTextEquals("Repeat password")
        assertThat(top("reset.confirm")).isGreaterThan(top("reset.password.support"))
        tag("reset.password.support").assertTextEquals("At least 12 characters.")
        assertThat(compose.onAllNodesWithTag("reset.confirm.support", useUnmergedTree = true).fetchSemanticsNodes())
            .isEmpty()
        assertThat(masked("reset.password.input")).isTrue()
        assertThat(masked("reset.confirm.input")).isTrue()
        for (path in listOf("reset.password.input", "reset.confirm.input")) {
            assertThat(tag(path).fetchSemanticsNode().config.getOrNull(SemanticsProperties.ContentType))
                .isEqualTo(ContentType.NewPassword)
        }
    }

    @Test
    fun eachRevealShowsOnlyItsOwnFieldAndIsNamedForWhatItDoes() {
        // ResetNew.md:15-17.
        show(filled)
        reveal("reset.confirm", "Show password").assertExists()
        compose.onNodeWithTag("reset.confirm.reveal").performScrollTo().performClick()
        reveal("reset.confirm", "Hide password").assertExists()
        reveal("reset.password", "Show password").assertExists()
        compose.onNodeWithTag("reset.confirm.reveal").performScrollTo().performClick()
        reveal("reset.confirm", "Show password").assertExists()
    }

    @Test
    fun theCommitWaitsOnBothFieldsUnderItsLineThenWakes() {
        // ResetNew.md:49-51.
        show(ResetNewUiState(password = "a strong password"))
        tag("reset.commit.action").assertIsNotEnabled()
        tag("reset.commit.reason").assertTextEquals("Waiting for a new password")
    }

    @Test
    fun aFilledFormWakesTheCommitAndTheLineGoes() {
        var presses = 0
        show(filled, onSubmit = { presses++ })
        tag("reset.commit.action").assertIsEnabled()
        assertThat(compose.onAllNodesWithTag("reset.commit.reason", useUnmergedTree = true).fetchSemanticsNodes())
            .isEmpty()
        compose.onNodeWithTag("reset.commit.action").performScrollTo().performClick()
        assertThat(presses).isEqualTo(1)
    }

    @Test
    fun theMismatchLineIsRepeatPasswordsOnlyLineInItsErrorState() {
        // ResetNew.md:11, 27.
        show(filled.copy(confirm = "other", confirmLine = R.string.reset_new_differ))
        tag("reset.confirm.support").assertTextEquals("The two passwords don't match.")
        tag("reset.confirm.input").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
        tag("reset.password.support").assertTextEquals("At least 12 characters.")
    }

    @Test
    fun anErroredNewPasswordReadsItsLineInPlaceOfTheHint() {
        // ResetNew.md:25, 31.
        show(filled.copy(breachLine = R.string.reset_new_breached))
        tag("reset.password.support")
            .assertTextEquals("That password has turned up in a data breach — pick another one.")
        compose.onNode(hasText("At least 12 characters."), useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theCommitWaitsWithoutDimmingOrASpinnerAndReadsItsParticiple() {
        // ResetNew.md:19-21, 37.
        var presses = 0
        compose.mainClock.autoAdvance = false
        show(filled.copy(inFlight = true), onSubmit = { presses++ })
        compose.mainClock.advanceTimeBy(100)
        compose.onNode(hasText("Set the new password"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(150)
        compose.onNode(hasText("Setting the new password…"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(5_000)
        compose.onNode(hasText("Setting the new password…"), useUnmergedTree = true).assertExists()
        compose.mainClock.autoAdvance = true
        compose.onNodeWithTag("reset.commit.action").assertIsEnabled().performScrollTo().performClick()
        assertThat(presses).isEqualTo(0)
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertDoesNotExist()
    }

    @Test
    fun noAnswerStandsAboveTheCommitWhichStaysTheRetry() {
        // ResetNew.md:33.
        show(filled.copy(fault = R.string.reset_new_no_answer))
        tag("reset.fault").assertTextEquals("That didn't send. Try again.")
        assertThat(top("reset.fault")).isLessThan(top("reset.commit.action"))
        tag("reset.commit.action").assertIsEnabled()
    }

    @Test
    fun thePageScrolls() {
        // ResetNew.md:45.
        show()
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.ScrollBy)).assertExists()
    }
}
