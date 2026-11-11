package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "vouch_back"
private val PAD = DataNode("feed") / "vouchCard" / "stance" / "pad"

/**
 * The vouch-back pad variant (VouchBackPad.md) over the master control —
 * the web's twin is `feed/vouch-card.test.tsx`'s "the vouch-back pad".
 */
// A phone tall enough for the open pad whole, parked 80dp above the bar.
@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class StancePadVariantTest {

    @get:Rule
    val compose = createComposeRule()

    private var committed = 0
    private var dismissed = 0

    private val variant = StancePadVariant(
        title = "Your vouch back",
        help = listOf(
            "Vouching back signs your opinion of the person who vouched you in, and your feed grows from it.",
            "The pad is how you shape what reaches you — for or against, and how much. Nothing is signed until Set.",
        ),
        note = "Your vouch back. The pad is how you shape what reaches you — for or against, and how much.",
        padNode = PAD,
    )

    private fun show(state: StanceControlState, padOnly: Boolean = true) {
        compose.setContent {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
                    onHoldDefault = {},
                    onOpenPad = {},
                    onPick = {},
                    onCommit = { committed++ },
                    onDismissPad = { dismissed++ },
                    onOpenAlternates = {},
                    onOpenSeverance = {},
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onConfirmationShown = {},
                    testTagPrefix = TAG,
                    variant = variant,
                    padOnly = padOnly,
                )
            }
        }
    }

    private val open = StanceControlState(
        pad = StancePadMode.STICKY,
        pick = StancePoint(0.1, 0.1),
        standing = StancePoint(0.3, 0.2),
    )

    // VouchBackPad.md:9 — the pad and its ? are named Your vouch back.
    @Test
    fun theVouchBackPadIsTitledYourVouchBack() {
        show(open)
        compose.onNodeWithTag(PAD.tag)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.PaneTitle, "Your vouch back"))
        compose.onNodeWithTag((PAD / "help").tag).assertContentDescriptionEquals("Your vouch back")
    }

    // VouchBackPad.md:13 — the line on every open; :15 the coaching only first-ever.
    @Test
    fun theOpenerLineStandsOnEveryVouchBackOpen() {
        show(open)
        compose.onNodeWithTag((PAD / "note").tag).assertExists()
        compose.onNodeWithText(variant.note).assertExists()
        compose.onNodeWithTag("${TAG}_stance_coaching").assertDoesNotExist()
    }

    @Test
    fun theFirstEverOpenCarriesTheCoachingUnderTheLine() {
        show(open.copy(coaching = true))
        compose.onNodeWithText(variant.note).assertExists()
        compose.onNodeWithTag("${TAG}_stance_coaching", useUnmergedTree = true).assertExists()
    }

    // VouchBackPad.md:21 — help in place, Set disabled, never a dialog.
    @Test
    fun theVouchBackPadsHelpReadsInPlace() {
        show(open)
        compose.onNodeWithTag((PAD / "help").tag).performClick()
        compose.onNodeWithText(variant.help[0]).assertExists()
        compose.onNodeWithText(variant.help[1]).assertExists()
        compose.onNodeWithTag((PAD / "set").tag).assertIsNotEnabled()
    }

    // VouchBackPad.md:11 — no Walk it back, even over a held standing.
    @Test
    fun theVouchBackPadCarriesNoWalkItBack() {
        show(open)
        compose.onNodeWithTag("${TAG}_stance_sever").assertDoesNotExist()
    }

    // VouchBackPad.md:5, :49 — the wash covers the shell; a press closes onto the host.
    @Test
    fun theShellIsInertUnderTheVouchBackPad() {
        show(open)
        // A press on the wash itself, clear of the parked pad.
        compose.onNodeWithTag("${TAG}_stance_scrim").performTouchInput { click(Offset(8f, 8f)) }
        assertThat(dismissed).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
    }

    // VouchBackPad.md:45 — Cancel closes, nothing staged.
    @Test
    fun cancelClosesWithNothingStaged() {
        show(open)
        compose.onNodeWithTag((PAD / "cancel").tag).performClick()
        assertThat(dismissed).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
    }

    // VouchBackPad.md:31 — K4.2: Setting… past 200ms, inert, no spinner.
    @Test
    fun setReadsSettingAfter200ms() {
        compose.mainClock.autoAdvance = false
        show(open.copy(busy = true))
        compose.mainClock.advanceTimeBy(SETTING_AFTER_MS - 50)
        compose.onNodeWithTag((PAD / "set").tag).assertTextEquals("Set")
        compose.mainClock.advanceTimeBy(100)
        compose.onNodeWithTag((PAD / "set").tag).assertTextEquals("Setting…")
        compose.onNodeWithTag((PAD / "set").tag).performClick()
        assertThat(committed).isEqualTo(0)
    }

    // VouchBackPad.md:37 — PadFailed: open at the pick, the fault, Retry in Set's slot.
    @Test
    fun aVouchBackThatDidntSignKeepsThePadAtThePick() {
        show(open.copy(failed = true))
        compose.onNodeWithTag(PAD.tag).assertExists()
        compose.onNodeWithText("That didn't send. Try again.").assertExists()
        compose.onNodeWithTag((PAD / "set").tag).assertTextEquals("Retry").performClick()
        assertThat(committed).isEqualTo(1)
    }

    // The pad-only host draws no resting target of its own.
    @Test
    fun aPadOnlyHostDrawsNoAnchor() {
        show(open)
        compose.onNodeWithTag("${TAG}_stance").assertDoesNotExist()
        compose.onNodeWithTag(PAD.tag).assertExists()
    }

    // Ruling 40 (the pad tails): every part the master names wears its path —
    // the four pole words, the square's hairlines and knob, the readouts' parts.
    @Test
    fun everyNamedPartOfThePadWearsItsPath() {
        show(open.copy(landing = StanceLanding(StancePoint(0.4, 0.3), inertDirected = false, inertInterest = false, severance = false)))
        val field = PAD / "field"
        val parts = listOf("left", "right", "top", "bottom").map { field / it } +
            listOf("zeroAcross", "zeroDown", "knob").map { field / "square" / it } +
            listOf("label", "face").flatMap { listOf(PAD / "standing" / "pick" / it, PAD / "landing" / it) }
        for (part in parts) compose.onNodeWithTag(part.tag, useUnmergedTree = true).assertExists()
    }

    // The named knob IS the drawn knob: its box centres on the pick, inside the square.
    @Test
    fun theNamedKnobStandsWhereThePickIs() {
        show(open)
        val square = compose.onNodeWithTag((PAD / "field" / "square").tag, useUnmergedTree = true).fetchSemanticsNode()
        val knob = compose.onNodeWithTag((PAD / "field" / "square" / "knob").tag, useUnmergedTree = true).fetchSemanticsNode()
        val side = square.size.width.toFloat()
        val inset = with(compose.density) { knobTravelInset().toPx() }
        val expected = pairKnobAt(PairPoint(0.1, 0.1), side, inset, PairRanges.Signed)
        val centre = knob.boundsInRoot.center - square.boundsInRoot.topLeft
        assertThat(centre.x).isWithin(1f).of(expected.x)
        assertThat(centre.y).isWithin(1f).of(expected.y)
        assertThat(knob.boundsInRoot.width).isWithin(1f).of(with(compose.density) { (KNOB_RADIUS * 2).toPx() })
    }

    // The readouts are blocks the pad's whole content wide (StanceStanding's div).
    @Test
    fun theStandingIsTheWholeContentWide() {
        show(open)
        val width = compose.onNodeWithTag((PAD / "standing").tag, useUnmergedTree = true).fetchSemanticsNode().size.width
        assertThat(width.toFloat()).isWithin(1f).of(with(compose.density) { PAD_CONTENT_WIDTH.toPx() })
    }
}
