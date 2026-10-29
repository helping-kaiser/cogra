package com.cogra.feature.invites

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The ask link's landing as drawn (VouchAsk.md, VouchAskInvalid.md, VouchAskUnusable.md). */
@RunWith(RobolectricTestRunner::class)
class VouchAskScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(landing: AskLanding, onBack: () -> Unit = {}, onOpenProfile: (String) -> Unit = {}) {
        compose.setContent { VouchAskScreen(landing = landing, onBack = onBack, onOpenProfile = onOpenProfile) }
    }

    @Test
    fun theAskNamesThePersonAskingAndGivesNoReason() {
        // VouchAsk.md:5, :7, :39.
        var back = 0
        render(AskLanding.Ask("noor"), onBack = { back++ })
        compose.onNodeWithTag("vouchAsk.header.title").assertTextEquals("A vouch, asked for")
        compose.onNodeWithTag("vouchAsk.ask.title").assertTextEquals("@noor is asking to be vouched in")
        compose.onNodeWithTag("vouchAsk.ask.avatar").assertExists()
        // :41 — Not now returns to the state the link opened over.
        compose.onNodeWithTag("vouchAsk.ask.later").assertTextEquals("Not now").performClick()
        compose.onNodeWithContentDescription("Back").performClick()
        assertThat(back).isEqualTo(2)
    }

    @Test
    fun theInvalidPageNamesNoCauseAndHasOnlyItsWayBack() {
        // VouchAskInvalid.md:5, :9.
        render(AskLanding.Invalid)
        compose.onNodeWithTag("vouchAsk.title").assertTextEquals("This ask link doesn't work")
        compose.onNodeWithTag("vouchAsk.body")
            .assertTextEquals("Check that the whole link came through, or ask the person who sent it for it again.")
        compose.onNodeWithTag("vouchAsk.profileDoor").assertDoesNotExist()
    }

    @Test
    fun aLandedAskerIsAlreadyInWithTheDoorToTheirProfile() {
        // VouchAskUnusable.md:15, :17.
        var opened: String? = null
        render(AskLanding.Landed("noor"), onOpenProfile = { opened = it })
        compose.onNodeWithTag("vouchAsk.title").assertTextEquals("@noor is already in")
        compose.onNodeWithTag("vouchAsk.profileDoor").assertTextEquals("See @noor's profile").performClick()
        assertThat(opened).isEqualTo("noor")
        // :11 — names nobody but the person asking.
        compose.onAllNodesWithText("@", substring = true).assertCountEquals(2)
    }
}
