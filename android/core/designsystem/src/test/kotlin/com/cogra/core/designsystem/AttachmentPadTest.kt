package com.cogra.core.designsystem

import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeRight
import androidx.compose.ui.unit.dp
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import kotlin.math.abs

/**
 * The one-axis strip, pinned to its master (`StancePad.jsx`'s
 * `AttachmentPad`): the travel rule it shares with the square, the
 * geometry numbers read from the master rather than transcribed, and the
 * announcement that makes its drag reachable without a drag.
 */
@RunWith(RobolectricTestRunner::class)
class AttachmentPadTest {

    @get:Rule
    val compose = createComposeRule()

    private val master = File("../../../design/components/stance/StancePad.jsx").readText()

    private fun masterPx(name: String): Int {
        val found = Regex("export const $name = (\\d+);").find(master)
        assertThat(found).isNotNull()
        return found!!.groupValues[1].toInt()
    }

    /** An extent of 100px: one unit of value is 100px of travel. */
    private val extent = 100f

    @Test
    fun theStripsNumbersAreTheMasters() {
        assertThat(ATTACHMENT_FIELD_HEIGHT).isEqualTo(masterPx("ATTACHMENT_FIELD_HEIGHT_PX").dp)
        assertThat(ATTACHMENT_GUTTER).isEqualTo(masterPx("AXIS_GUTTER_X_PX").dp)
        assertThat(KNOB_RADIUS * 2).isEqualTo(masterPx("KNOB_DIAMETER_PX").dp)
        assertThat(FIELD_CORNER).isEqualTo(masterPx("FIELD_CORNER_RADIUS_PX").dp)
    }

    @Test
    fun theTravelIsHalfTheStripLessTheSquaresInset() {
        assertThat(attachmentExtent(300f, 10f)).isEqualTo(140f)
        assertThat(attachmentExtent(10f, 10f)).isEqualTo(0f)
    }

    @Test
    fun oneExtentOfTravelIsOneUnitOfValue() {
        assertThat(attachmentFrom(0.0, extent, extent)).isEqualTo(1.0)
        assertThat(attachmentFrom(0.0, -extent, extent)).isEqualTo(-1.0)
        assertThat(attachmentFrom(0.0, extent / 2, extent)).isEqualTo(0.5)
    }

    @Test
    fun aSecondDragAdjustsThePickAlreadyStanding() {
        assertThat(attachmentFrom(-0.5, extent / 2, extent)).isEqualTo(0.0)
    }

    @Test
    fun theValueIsClampedOnTheSumSoAnOffCentreBaseStillReachesTheEnd() {
        assertThat(attachmentFrom(0.9, extent * 10, extent)).isEqualTo(1.0)
        assertThat(attachmentFrom(-0.9, -extent * 10, extent)).isEqualTo(-1.0)
    }

    @Test
    fun anUnmeasuredFieldKeepsTheBaseRatherThanDividingByZero() {
        assertThat(attachmentFrom(0.4, 999f, 0f)).isEqualTo(0.4)
    }

    // ComposePad.md / EditPad.md, built on the master in round 20: the zero
    // hairline is the no-side-yet detent — within the knob's own radius the
    // knob holds on it and the pick reads exactly 0.00; past it, it follows.
    @Test
    fun theZeroHairlineHoldsTheKnobWithinItsRadius() {
        val radius = 10f
        val inside = attachmentFrom(0.1, ((-0.1 + 9.5 / extent) * extent).toFloat(), extent, radius)
        val outside = attachmentFrom(0.1, ((-0.1 + 11.0 / extent) * extent).toFloat(), extent, radius)
        assertThat(inside).isEqualTo(0.0)
        assertThat(outside).isWithin(1e-6).of(11.0 / extent)
        assertThat(attachmentReleased(0.1, ((-0.1 - 9.5 / extent) * extent).toFloat(), extent, radius)).isEqualTo(0.0)
    }

    @Test
    fun negativeZeroIsAuthoredAsZero() {
        val picked = attachmentFrom(-0.0, 0f, extent)
        assertThat(1.0 / picked).isPositiveInfinity()
    }

    // ── RELEASE LANDS THE PICK ON THE NEAREST HUNDREDTH (ComposePad.md, EditPad.md) ──

    @Test
    fun theReleaseLandsANearZeroPickOnExactlyPositiveZero() {
        // From the compose pad's +0.10, float travel can carry the pick to
        // 0.0031 or −0.0042 but never to 0.0 itself; the release can.
        val above = attachmentReleased(0.1, ((0.0031 - 0.1) * extent).toFloat(), extent)
        val below = attachmentReleased(0.1, ((-0.0042 - 0.1) * extent).toFloat(), extent)
        assertThat(above).isEqualTo(0.0)
        assertThat(1.0 / above).isPositiveInfinity()
        assertThat(1.0 / below).isPositiveInfinity()
    }

    @Test
    fun theReleaseLandsAnyOtherPickOnTheNearestHundredth() {
        assertThat(attachmentReleased(0.0, (0.4371 * extent).toFloat(), extent)).isEqualTo(0.44)
        assertThat(attachmentReleased(0.0, (-0.4371 * extent).toFloat(), extent)).isEqualTo(-0.44)
        assertThat(attachmentReleased(0.9, extent * 10, extent)).isEqualTo(1.0)
    }

    @Test
    fun aDragFollowsTheFingerAndTheLiftParksThePickOnTheGrid() {
        val picked = mutableListOf<Double>()
        compose.setContent {
            var value by remember { mutableDoubleStateOf(0.1) }
            AttachmentPad(
                value = value,
                onValueChange = {
                    value = it
                    picked += it
                },
                modifier = Modifier.width(360.dp),
            )
        }
        val strip = compose.onNodeWithTag("attachment_pad")
        strip.performTouchInput {
            down(center)
            moveBy(Offset(10f, 0f))
        }
        // Measure the strip's own extent from what ten pixels picked, then
        // carry the pick to +0.002 — a float that prints +0.00.
        val measured = 10.0 / (picked.last() - 0.1)
        val toNearZero = ((0.002 - picked.last()) * measured).toFloat()
        strip.performTouchInput {
            moveBy(Offset(toNearZero, 0f))
        }
        assertThat(picked.last()).isWithin(1e-4).of(0.002)
        assertThat(picked.last()).isNotEqualTo(0.0)
        strip.performTouchInput { up() }
        assertThat(picked.last()).isEqualTo(0.0)
        assertThat(1.0 / picked.last()).isPositiveInfinity()
        strip.assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "+0.00"))
    }

    @Test
    fun theKnobNeverLeavesTheDrawnStrip() {
        for (value in listOf(-4.0, -1.0, -0.5, 0.0, 0.5, 1.0, 4.0)) {
            assertThat(abs(attachmentKnobOffset(value, extent))).isAtMost(extent)
        }
    }

    @Test
    fun onlyAgainstAndForAreDrawn() {
        compose.setContent { AttachmentPad(value = 0.1, onValueChange = {}) }
        // The words are drawn and kept out of the reading — the strip names its axis.
        compose.onNodeWithTag("attachment_pad_against", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("attachment_pad_for", useUnmergedTree = true).assertExists()
        val strings = File("src/main/res/values/strings.xml").readText()
        assertThat(strings).contains("<string name=\"valence_pole_against\">Against</string>")
        assertThat(strings).contains("<string name=\"valence_pole_for\">For</string>")
        compose.onNodeWithText("Less", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithText("More", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theStripNamesItsAxisAndSaysWhereTheKnobSits() {
        compose.setContent { AttachmentPad(value = 0.1, onValueChange = {}) }
        compose.onNodeWithTag("attachment_pad")
            .assertContentDescriptionContains("For or against")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "+0.10"))
    }

    @Test
    fun aDragMovesThePickAndATapDoesNot() {
        val picked = mutableListOf<Double>()
        compose.setContent {
            var value by remember { mutableDoubleStateOf(0.1) }
            AttachmentPad(
                value = value,
                onValueChange = {
                    value = it
                    picked += it
                },
                modifier = Modifier.width(360.dp),
            )
        }
        compose.onNodeWithTag("attachment_pad").performTouchInput { click(center) }
        assertThat(picked).isEmpty()
        compose.onNodeWithTag("attachment_pad").performTouchInput { swipeRight() }
        assertThat(picked).isNotEmpty()
        assertThat(picked.last()).isGreaterThan(0.1)
    }

    @Test
    fun theStripIsSettableWithoutADrag() {
        val picked = mutableListOf<Double>()
        compose.setContent {
            var value by remember { mutableDoubleStateOf(0.1) }
            AttachmentPad(
                value = value,
                onValueChange = {
                    value = it
                    picked += it
                },
            )
        }
        compose.onNodeWithTag("attachment_pad").assert(
            SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress),
        )
        compose.onNodeWithTag("attachment_pad").performSemanticsAction(SemanticsActions.SetProgress) {
            it(-0.6f)
        }
        // A set progress lands on the grid: −0.6f is −0.60000002384… as a Double.
        assertThat(picked.single()).isEqualTo(-0.6)
        compose.onNodeWithTag("attachment_pad")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "−0.60"))
    }
}
