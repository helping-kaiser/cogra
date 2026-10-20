package com.cogra.core.designsystem

import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

/**
 * The one-axis readouts, pinned to their masters (`StanceReadout.jsx`'s
 * `AttachmentReadout`, `AttachmentStanding`, `AttachmentLandingLine`,
 * `attachmentLanding`) and to EditPad.md's walk-back law.
 */
@RunWith(RobolectricTestRunner::class)
class AttachmentReadoutsTest {

    @get:Rule
    val compose = createComposeRule()

    private val master = File("../../../design/components/stance/StanceReadout.jsx").readText()
    private val strings = File("src/main/res/values/strings.xml").readText()

    private fun masterLabel(name: String): String {
        val found = Regex("export const $name = \"([^\"]+)\";").find(master)
        assertThat(found).isNotNull()
        return found!!.groupValues[1]
    }

    @Test
    fun theLabelsAreTheMasters() {
        fun entry(name: String, master: String) = "<string name=\"$name\">${masterLabel(master)}</string>"
        assertThat(strings).contains(entry("backing_current", "CURRENT_BACKING_LABEL"))
        assertThat(strings).contains(entry("backing_after", "BACKING_AFTER_LABEL"))
        assertThat(strings).contains(entry("backing_pick", "PICK_LABEL"))
    }

    @Test
    fun theCapLineIsTheMasters() {
        assertThat(master).contains(
            "`Adds up to \${formatDimension(raw)}; your feed reads it capped at \${formatDimension(landing)}.`",
        )
        assertThat(strings).contains(
            "<string name=\"backing_capped\">Adds up to %1\$s; your feed reads it capped at %2\$s.</string>",
        )
    }

    @Test
    fun theLandingIsTheClipOfTheRawSumPlusThePick() {
        val within = attachmentLanding(0.1, 0.3)
        assertThat(within.landing).isWithin(1e-9).of(0.4)
        assertThat(within.capped).isFalse()
        val past = attachmentLanding(1.2, 0.2)
        assertThat(past.raw).isWithin(1e-9).of(1.4)
        assertThat(past.landing).isEqualTo(1.0)
        assertThat(past.capped).isTrue()
        val below = attachmentLanding(-0.9, -0.5)
        assertThat(below.landing).isEqualTo(-1.0)
        assertThat(below.capped).isTrue()
    }

    @Test
    fun exactlyOneIsNotCapped() {
        assertThat(attachmentLanding(0.5, 0.5).capped).isFalse()
    }

    @Test
    fun walkingItAllBackLandsAtZeroWithinTheAxis() {
        val pick = walkBackPick(0.4)
        assertThat(pick).isEqualTo(-0.4)
        assertThat(attachmentLanding(0.4, pick).landing).isEqualTo(0.0)
    }

    @Test
    fun walkingItAllBackPastTheAxisReachesAsFarAsOneRecordDoes() {
        assertThat(walkBackPick(1.6)).isEqualTo(-1.0)
        assertThat(attachmentLanding(1.6, walkBackPick(1.6)).landing).isWithin(1e-9).of(0.6)
        assertThat(walkBackPick(-2.0)).isEqualTo(1.0)
    }

    @Test
    fun walkingBackNothingAuthorsPositiveZero() {
        assertThat(1.0 / walkBackPick(0.0)).isPositiveInfinity()
    }

    @Test
    fun theRowReadsOneNumberAndThinksAtZero() {
        compose.setContent { AttachmentReadout(pDirected = 0.0, testTag = "row") }
        compose.onNodeWithTag("row").assertContentDescriptionEquals("No side taken, For or against +0.00")
    }

    @Test
    fun aComposePadReadsYourPickAlone() {
        compose.setContent { AttachmentStanding(pick = 0.1) }
        compose.onNodeWithTag("attachment_current").assertDoesNotExist()
        compose.onNodeWithTag("attachment_pick").assertExists()
        compose.onNodeWithTag("attachment_pick")
            .assertContentDescriptionContains("For or against +0.10", substring = true)
    }

    @Test
    fun anEditsPadReadsCurrentBackingOverThePick() {
        compose.setContent { AttachmentStanding(pick = 0.3, current = BackingValue.Read(0.1)) }
        compose.onNodeWithTag("attachment_current")
            .assertContentDescriptionContains("For or against +0.10", substring = true)
        compose.onNodeWithTag("attachment_pick")
            .assertContentDescriptionContains("For or against +0.30", substring = true)
    }

    @Test
    fun anUnreadBackingIsADashNeverAFace() {
        compose.setContent { AttachmentStanding(pick = 0.3, current = BackingValue.Unread) }
        compose.onNodeWithTag("attachment_current_unread", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("attachment_current_exact", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun backingAfterStatesTheTotalAndTheCapPastOne() {
        compose.setContent { AttachmentLandingLine(rawSum = BackingValue.Read(1.2), pick = 0.2) }
        compose.onNodeWithTag("attachment_after")
            .assertContentDescriptionContains("For or against +1.00", substring = true)
        compose.onNodeWithTag("attachment_after_cap")
            .assertTextEquals("Adds up to +1.40; your feed reads it capped at +1.00.")
    }

    @Test
    fun backingAfterHasNoCapLineWithinTheAxis() {
        compose.setContent { AttachmentLandingLine(rawSum = BackingValue.Read(0.1), pick = 0.3) }
        compose.onNodeWithTag("attachment_after")
            .assertContentDescriptionContains("For or against +0.40", substring = true)
        compose.onNodeWithTag("attachment_after_cap").assertDoesNotExist()
    }
}
