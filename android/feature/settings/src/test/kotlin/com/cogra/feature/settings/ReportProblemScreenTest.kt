// The report page under Robolectric, its behaviour lines compiled one to one
// (ReportProblem.md, ReportProblemEmpty.md), and the handoff to the system's
// own send. The board is not registered in nodes.json; the tags are its
// evident `reportProblem.*` path.

package com.cogra.feature.settings

import android.app.Activity
import android.content.Intent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.AnnotatedString
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
class ReportProblemScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private var sends = 0
    private var backs = 0

    private fun render(words: String = "") {
        compose.setContent {
            var held by remember { mutableStateOf(words) }
            ReportProblemScreen(
                state = ReportProblemUiState(words = held, version = "0.1.2", time = "01.10.2026, 14:32"),
                runningOn = "Pixel 6",
                onWords = { held = it },
                onSend = { sends++ },
                onBack = { backs++ },
            )
        }
    }

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    private fun field() = node("reportProblem.whatHappened.input")

    private fun commit() = node("reportProblem.commit")

    /** What the field holds — its editable text, never its label. */
    private fun editable(text: String) =
        SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(text))

    @Test
    fun thePageReadsItsTitleLeadAndOneField() {
        render()
        node("reportProblem.title").assertTextEquals("Report a problem")
        node("reportProblem.body").assertTextEquals(
            "Sending opens your email with everything below filled in — nothing goes until you send it there.",
        )
        node("reportProblem.whatHappened.label").assertTextEquals("What happened")
    }

    // ReportProblem.md:9 — the four facts stand read back: To, Version, Running on, Time.
    @Test
    fun theFourFactsStandReadBack() {
        render()
        listOf(
            "to" to ("To" to "reports@cogra.local"),
            "version" to ("Version" to "0.1.2"),
            "runningOn" to ("Running on" to "Pixel 6"),
            "time" to ("Time" to "01.10.2026, 14:32"),
        ).forEach { (name, fact) ->
            node("reportProblem.facts.$name.label").assertTextEquals(fact.first)
            node("reportProblem.facts.$name.value").assertTextEquals(fact.second)
        }
    }

    // ReportProblem.md:11 — the line under the facts says nothing else travels.
    @Test
    fun theNoteSaysNothingElseTravels() {
        render()
        node("reportProblem.note").assertTextEquals(
            "That's all that goes with your words — no account, no key, nothing you've posted.",
        )
    }

    // ReportProblemEmpty.md:36, :38, :40 — empty, Send by email is enabled and the facts stand.
    @Test
    fun anEmptyReportStillOffersTheSend() {
        render()
        field().assert(editable(""))
        node("reportProblem.facts.time.value").assertExists()
        // The button merges its label: read it on the merged tree.
        compose.onNodeWithTag("reportProblem.commit").performScrollTo().assertIsEnabled()
            .assertTextEquals("Send by email")
        commit().performClick()
        assertThat(sends).isEqualTo(1)
    }

    // ReportProblemEmpty.md:38 — only spaces, still enabled.
    @Test
    fun onlySpacesKeepTheSendEnabled() {
        render(words = "   ")
        commit().performScrollTo().assertIsEnabled()
    }

    // ReportProblem.md:15, :17; ReportProblemEmpty.md:44 — typing and deleting never disable it.
    @Test
    fun typingAndClearingKeepTheSendEnabled() {
        render()
        field().performTextInput("I")
        commit().performScrollTo().assertIsEnabled()
        field().performTextClearance()
        commit().performScrollTo().assertIsEnabled()
    }

    // ReportProblem.md:29 — the words kept from an earlier visit stand in the field.
    @Test
    fun keptWordsStandInTheField() {
        render(words = "Try again said the same thing.")
        field().assert(editable("Try again said the same thing."))
    }

    // ReportProblem.md:31 — the header back arrow returns to the opener, sending nothing.
    @Test
    fun theBackArrowLeavesAndSendsNothing() {
        render(words = "kept")
        node("reportProblem.header.back").performClick()
        assertThat(backs).isEqualTo(1)
        assertThat(sends).isEqualTo(0)
    }

    // ReportProblem.md:13 — a task page: no bottom bar, its back arrow kept.
    @Test
    fun thePageCarriesNoBottomBar() {
        render()
        node("reportProblem.header.back").assertExists()
        assertThat(
            compose.onAllNodes(hasTestTag("reportProblem.bottomBar")).fetchSemanticsNodes(),
        ).isEmpty()
        assertThat(compose.onAllNodes(hasText("Send")).fetchSemanticsNodes()).isEmpty()
    }
}

/** The press's handoff: the system's own send, prefilled, never a send from CoGra. */
@RunWith(RobolectricTestRunner::class)
class ReportMailHandoffTest {

    private val activity: Activity = Robolectric.buildActivity(Activity::class.java).setup().get()

    private val mail = ReportMail(to = REPORT_ADDRESS, body = "Words.\n\nVersion: 0.1.2")

    // ReportProblem.md:25 — ACTION_SENDTO on mailto:, the address and the body filled in.
    @Test
    fun thePressOpensTheSystemsOwnSendPrefilled() {
        openReportMail(activity, mail)

        val opened = shadowOf(activity).nextStartedActivity
        assertThat(opened.action).isEqualTo(Intent.ACTION_SENDTO)
        assertThat(opened.data.toString()).isEqualTo("mailto:")
        assertThat(opened.getStringArrayExtra(Intent.EXTRA_EMAIL)).asList().containsExactly("reports@cogra.local")
        assertThat(opened.getStringExtra(Intent.EXTRA_TEXT)).isEqualTo("Words.\n\nVersion: 0.1.2")
    }

    // Undrawn: with no mail app the press opens nothing, and nothing breaks.
    @Test
    fun withNoMailAppNothingOpensAndNothingBreaks() {
        shadowOf(activity.application).checkActivities(true)

        openReportMail(activity, mail)

        assertThat(shadowOf(activity).nextStartedActivity).isNull()
    }
}
