package com.cogra.feature.onboarding

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * JoinInvalid.md line by line against the door's unusable reading, and the
 * door's own heads (InviteEntry.md's drawn words) beside it. Tags are the
 * boards' evident `joinInvalid.*` / `inviteEntry.*` paths.
 */
@RunWith(RobolectricTestRunner::class)
class InviteEntryScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val link = "https://cogra.social/join/0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1"

    private fun show(
        state: InviteEntryUiState,
        onContinue: () -> Unit = {},
        onSignIn: () -> Unit = {},
        onBrowseFeed: () -> Unit = {},
        onBack: () -> Unit = {},
    ) {
        compose.setContent {
            InviteEntryScreen(state, {}, onContinue, onSignIn, onBrowseFeed, onBack)
        }
    }

    private fun tag(path: String) = compose.onNodeWithTag(path, useUnmergedTree = true)

    private fun top(path: String): Float = tag(path).fetchSemanticsNode().positionInRoot.y

    // JoinInvalid.md:3, 13 — the heading says the link can't be used; the
    // paragraph promises nothing about an account made earlier; the field and
    // the ways out stand as the door's.
    @Test
    fun theUnusableReadingSaysSoAndKeepsTheDoorsFieldAndWaysOut() {
        show(InviteEntryUiState(invalid = true))
        tag("joinInvalid.title").assertTextEquals("This invite can't be used anymore")
        tag("joinInvalid.body").assertTextEquals(
            "It may have expired or already been used. Ask the person who invited you for a new link.",
        )
        tag("joinInvalid.link.label").assertTextEquals("Invite link")
        tag("joinInvalid.signIn").assertTextEquals("Already have an account? Sign in")
        tag("joinInvalid.browse").assertTextEquals("Just looking? Browse the feed →")
        assertThat(top("joinInvalid.link")).isLessThan(top("joinInvalid.commit.action"))
        assertThat(top("joinInvalid.commit.action")).isLessThan(top("joinInvalid.signIn"))
        assertThat(top("joinInvalid.signIn")).isLessThan(top("joinInvalid.browse"))
    }

    // InviteEntry.jsx — the door's own head, the same field and ways out.
    @Test
    fun theDoorReadsItsOwnHead() {
        show(InviteEntryUiState())
        tag("inviteEntry.title").assertTextEquals("Enter your invite")
        tag("inviteEntry.body").assertTextEquals("CoGra is invite-only. Paste your invite link to get started.")
        tag("joinInvalid.title").assertDoesNotExist()
    }

    // JoinInvalid.md:15 — the header's arrow reads Back.
    @Test
    fun theHeadersArrowReadsBack() {
        var back = 0
        show(InviteEntryUiState(invalid = true), onBack = { back++ })
        compose.onNode(hasContentDescription("Back") and SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick))
            .assertExists()
        tag("joinInvalid.header.back").performClick()
        assertThat(back).isEqualTo(1)
    }

    // JoinInvalid.md:19-21, 33 — Continue refuses a second press, never dims,
    // reads Continuing… past 200ms and still at 5s, with no spinner.
    @Test
    fun continueWaitsWithoutDimmingOrASpinner() {
        var presses = 0
        compose.mainClock.autoAdvance = false
        show(InviteEntryUiState(input = link, invalid = true, inFlight = true), onContinue = { presses++ })
        compose.mainClock.advanceTimeBy(100)
        compose.onNode(hasText("Continue"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(150)
        compose.onNode(hasText("Continuing…"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(5_000)
        compose.onNode(hasText("Continuing…"), useUnmergedTree = true).assertExists()
        tag("joinInvalid.commit.action").assertIsEnabled().performClick()
        assertThat(presses).isEqualTo(0)
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertDoesNotExist()
    }

    // JoinInvalid.md:27 — no answer: the field keeps the paste, the line stands
    // above Continue, and Continue is the retry.
    @Test
    fun noAnswerStandsAboveContinueWhichIsTheRetry() {
        var presses = 0
        show(InviteEntryUiState(input = link, invalid = true, noAnswer = true), onContinue = { presses++ })
        tag("joinInvalid.fault").assertTextEquals("That didn't send. Try again.")
        tag("joinInvalid.link.input").assertTextEquals(link)
        assertThat(top("joinInvalid.fault")).isLessThan(top("joinInvalid.commit.action"))
        tag("joinInvalid.commit.action").performClick()
        assertThat(presses).isEqualTo(1)
    }

    // JoinInvalid.md:29, 31, 35 — the ways out open SignIn and the bare feed,
    // and stay live while Continue waits.
    @Test
    fun theWaysOutStayLiveWhileContinueWaits() {
        var signIn = 0
        var browse = 0
        show(
            InviteEntryUiState(input = link, invalid = true, inFlight = true),
            onSignIn = { signIn++ },
            onBrowseFeed = { browse++ },
        )
        tag("joinInvalid.signIn").performClick()
        tag("joinInvalid.browse").performClick()
        assertThat(signIn to browse).isEqualTo(1 to 1)
    }

    // InviteEntry.md (the door's field): a press finding nothing that reads as
    // a link says so on the field.
    @Test
    fun aFieldThatHoldsNoLinkSaysSo() {
        show(InviteEntryUiState(input = "garbage", notALink = true))
        tag("inviteEntry.link.support").assertTextEquals("That doesn't look like an invite link.")
        tag("inviteEntry.title").assertTextEquals("Enter your invite")
    }

    // JoinInvalid.md:37 — the page scrolls.
    @Test
    fun thePageScrolls() {
        show(InviteEntryUiState(invalid = true))
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.ScrollBy)).assertExists()
    }

    // JoinInvalid.md:41-43 — Continue stands disabled with its waiting line
    // while Invite link is empty; the first character wakes it.
    @Test
    fun continueWaitsOnAnEmptyFieldThenWakes() {
        var state by mutableStateOf(InviteEntryUiState(invalid = true))
        compose.setContent { InviteEntryScreen(state, {}, {}, {}, {}) }
        tag("joinInvalid.commit.action").assertIsNotEnabled()
        tag("joinInvalid.commit.reason").assertTextEquals("Waiting for your invite link")
        state = state.copy(input = "h")
        compose.waitForIdle()
        tag("joinInvalid.commit.action").assertIsEnabled()
        tag("joinInvalid.commit.reason").assertDoesNotExist()
    }
}
