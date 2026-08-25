package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.semantics.SemanticsActions
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private const val TAG = "post"

/** The pair sits inside the readout's merged announcement, so it is read unmerged. */
private fun ComposeContentTestRule.exactPair() =
    onNodeWithTag("${TAG}_stance_exact_pair", useUnmergedTree = true)

@RunWith(RobolectricTestRunner::class)
class StancePadTest {

    @get:Rule
    val compose = createComposeRule()

    private var tapped = 0
    private var opened = 0
    private var committed = 0
    private var held = 0
    private var dismissed = 0
    private var exactToggled = 0
    private var severOpened = 0
    private var coachDismissed = 0
    private val picks = mutableListOf<StancePoint>()

    private fun show(state: StanceControlState) {
        compose.setContent {
            // Centred, so a drag has room on every side of the target.
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
                    onTapDefault = { tapped++ },
                    onOpenPad = { opened++ },
                    onPick = { picks += it },
                    onCommit = { committed++ },
                    onHold = { held++ },
                    onDismissPad = { dismissed++ },
                    onToggleExactValues = { exactToggled++ },
                    onOpenSeverance = { severOpened++ },
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onCoachMarkDismissed = { coachDismissed++ },
                    testTagPrefix = TAG,
                )
            }
        }
    }

    // -- The gesture (design.md §8.3) --

    @Test
    fun aPlainTapCommitsTheDefaultWithoutOpeningThePad() {
        show(StanceControlState())

        compose.onNodeWithTag("${TAG}_stance").performClick()

        assertThat(tapped).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
        compose.onNodeWithTag("${TAG}_stance_pad").assertDoesNotExist()
    }

    @Test
    fun holdingOpensThePad() {
        show(StanceControlState())

        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }

        assertThat(opened).isEqualTo(1)
        assertThat(tapped).isEqualTo(0)
    }

    @Test
    fun aHoldReleasedWithoutDriftingParksThePadInsteadOfCommitting() {
        show(StanceControlState())

        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }

        assertThat(held).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun driftingMapsValenceAcrossAndConnectionUpThenCommitsOnRelease() {
        show(StanceControlState(pad = StancePadMode.DRAGGING))
        // One unit of either parameter is FIELD_EXTENT of travel: half
        // of that to the right and a quarter of it up reads (+0.5, +0.25).
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveTo(center + Offset(extent / 2f, -extent / 4f))
            up()
        }

        val last = picks.last()
        assertThat(last.directed).isWithin(0.02).of(0.5)
        assertThat(last.interest).isWithin(0.02).of(0.25)
        assertThat(committed).isEqualTo(1)
    }

    @Test
    fun theSquareStaysReachableAndTravelBeyondItClamps() {
        show(StanceControlState(pad = StancePadMode.DRAGGING))
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            // Past the corner: the far corner is still expressible, and
            // nothing beyond it exists (design.md §8.2).
            moveTo(center + Offset(extent * 1.4f, -extent * 1.4f))
            up()
        }

        assertThat(picks.last()).isEqualTo(StancePoint(1.0, 1.0))
    }

    @Test
    fun noDragAnywhereEverPutsTheKnobOutsideTheDrawnField() {
        // The adversarial sweep, driven through the real gesture rather
        // than the mapping alone: whatever the thumb does, the picks it
        // reports keep the knob inside the drawing (design.md §8.3).
        show(StanceControlState(pad = StancePadMode.DRAGGING))
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }
        val half = with(compose.density) { (FIELD_SIZE / 2).toPx() }
        val corner = with(compose.density) { FIELD_CORNER.toPx() }
        val knob = with(compose.density) { KNOB_RADIUS.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            for (i in -3..3) {
                for (j in -3..3) {
                    moveTo(center + Offset(extent * i * 1.7f, extent * j * 1.7f))
                }
            }
            up()
        }

        assertThat(picks).isNotEmpty()
        for (pick in picks) {
            assertThat(knobInsideField(pick, half, corner, knob, extent)).isTrue()
        }
    }

    /** The same control, but holding its own pick, so a drag moves it. */
    private fun showLive(initial: StanceControlState = StanceControlState()) {
        compose.setContent {
            var state by remember { mutableStateOf(initial) }
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
                    onTapDefault = { tapped++ },
                    onOpenPad = {
                        opened++
                        state = state.copy(pad = StancePadMode.DRAGGING, pick = StancePoint.Origin)
                    },
                    onPick = {
                        picks += it
                        state = state.copy(pick = it)
                    },
                    onCommit = { committed++ },
                    onHold = { held++ },
                    onDismissPad = { dismissed++ },
                    onToggleExactValues = { exactToggled++ },
                    onOpenSeverance = { severOpened++ },
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onCoachMarkDismissed = { coachDismissed++ },
                    testTagPrefix = TAG,
                )
            }
        }
    }

    // -- The readout (design.md §8.4) --

    @Test
    fun theExactPairIsPartOfTheDefaultReading() {
        show(StanceControlState(pad = StancePadMode.DRAGGING, pick = StancePoint(0.4, 0.2)))

        compose.exactPair().assertTextEquals("+0.40 / +0.20")
    }

    @Test
    fun theExactPairFollowsTheDragLive() {
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveTo(center + Offset(extent / 2f, 0f))
        }
        compose.exactPair().assertTextEquals("+0.50 / +0.00")

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            moveTo(center + Offset(-extent, -extent / 4f))
            up()
        }
        compose.exactPair().assertTextEquals("-1.00 / +0.25")
    }

    @Test
    fun aValueThatRoundsToZeroIsWrittenWithoutANegativeSign() {
        // Travel straight along one axis leaves the other at negative
        // zero; "-0.00" reads as a broken control.
        show(StanceControlState(pad = StancePadMode.DRAGGING, pick = StancePoint(0.5, -0.0)))

        compose.exactPair().assertTextEquals("+0.50 / +0.00")
    }

    @Test
    fun theExactPairIsAnnouncedWithItsAxesNamed() {
        // Compact on screen, never a bare pair to a screen reader: the
        // readout is announced once, and the axes ride that announcement.
        show(StanceControlState(pad = StancePadMode.DRAGGING, pick = StancePoint(0.4, 0.2)))

        compose.onNodeWithTag("${TAG}_stance_readout")
            .assertContentDescriptionContains("How you stand +0.40, In your world +0.20")
    }

    @Test
    fun theReadoutSpeaksThePickInWordsNotTheBundle() {
        // The pick is (+0.9, +0.25) — 😍 "Love this" — while the bundle
        // sits somewhere else entirely. The face follows the pick.
        show(
            StanceControlState(
                pad = StancePadMode.DRAGGING,
                pick = StancePoint(0.9, 0.25),
                standing = StancePoint(-0.8, -0.8),
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_readout").assertTextContains("Love this")
    }

    @Test
    fun thePadShowsWhereTheReaderStandsNowAndWhereThePickLeavesThem() {
        show(
            StanceControlState(
                pad = StancePadMode.DRAGGING,
                pick = StancePoint(0.5, 0.5),
                standing = StancePoint(0.2, 0.1),
                landing = StanceLanding(StancePoint(0.7, 0.6), false, false, false),
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_standing").assertIsDisplayed()
        compose.onNodeWithTag("${TAG}_stance_landing").assertTextContains(
            "leaves you at",
            substring = true,
        )
    }

    @Test
    fun anUnknownLandingSaysSoRatherThanGuessing() {
        show(StanceControlState(pad = StancePadMode.DRAGGING, landing = null))

        compose.onNodeWithTag("${TAG}_stance_landing")
            .assertTextContains("Working out", substring = true)
    }

    @Test
    fun anInertLandingSaysTheStanceWillCarryNothing() {
        show(
            StanceControlState(
                pad = StancePadMode.DRAGGING,
                landing = StanceLanding(StancePoint(0.0, 0.4), inertDirected = true, inertInterest = false, severance = false),
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_landing")
            .assertTextContains("carry nothing", substring = true)
    }

    @Test
    fun aLandingOnZeroIsNamedAsSeverance() {
        show(
            StanceControlState(
                pad = StancePadMode.DRAGGING,
                landing = StanceLanding(StancePoint.Origin, inertDirected = true, inertInterest = true, severance = true),
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_landing")
            .assertTextContains("back to nothing", substring = true)
    }

    // -- Where the pad opens (design.md §8.3) --
    //
    // WHERE it lands is arithmetic, and PadBesideTargetTest is its
    // oracle: a popup lives in its own window, so its coordinates in a
    // Compose test are window-local and say nothing about the screen.
    // What is worth pinning here is that a pad which opened stays open
    // for the gesture that opened it.

    @Test
    fun aBloomedPadOpensBesideTheTargetItBelongsTo() {
        show(StanceControlState(pad = StancePadMode.DRAGGING))

        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        // The target itself keeps its place; the pad never replaces it.
        compose.onNodeWithTag("${TAG}_stance").assertIsDisplayed()
    }

    @Test
    fun aDrifitngThumbNeverDismissesItsOwnPad() {
        // The pad follows one continuous gesture; only a release or a
        // cancel ends it.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveTo(center + Offset(extent, -extent))
            moveTo(center + Offset(-extent, extent))
        }

        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        assertThat(dismissed).isEqualTo(0)
    }

    // -- The parked pad: alternates and the severance route --

    @Test
    fun theParkedPadCarriesTheAlternatesAndTheSeveranceRoute() {
        show(StanceControlState(pad = StancePadMode.STICKY))

        compose.onNodeWithTag("${TAG}_stance_exact").performScrollTo().performClick()
        assertThat(exactToggled).isEqualTo(1)

        compose.onNodeWithTag("${TAG}_stance_sever").performScrollTo().performClick()
        assertThat(severOpened).isEqualTo(1)

        compose.onNodeWithTag("${TAG}_stance_cancel").performScrollTo().performClick()
        assertThat(dismissed).isEqualTo(1)
    }

    @Test
    fun theExactValuesPanelOffersASliderAndAFieldPerParameter() {
        show(StanceControlState(pad = StancePadMode.STICKY, exactValues = true))

        compose.onNodeWithTag("${TAG}_stance_slider_directed").assertExists()
        compose.onNodeWithTag("${TAG}_stance_slider_interest").assertExists()
        compose.onNodeWithTag("${TAG}_stance_entry_directed").assertExists()
        compose.onNodeWithTag("${TAG}_stance_entry_interest").assertExists()
    }

    @Test
    fun theParkedPadCommitsThroughItsOwnButton() {
        show(StanceControlState(pad = StancePadMode.STICKY))

        compose.onNodeWithTag("${TAG}_stance_set").performScrollTo().performClick()

        assertThat(committed).isEqualTo(1)
    }

    // -- Failure, teaching, accessibility --

    @Test
    fun aFailedTapIsReportedEvenThoughNoPadIsOpen() {
        show(StanceControlState(failed = true))

        compose.onNodeWithTag("${TAG}_stance_failed").assertExists()
    }

    @Test
    fun aHuskDeviceIsToldToRestoreItsKeyRatherThanToRetryBlindly() {
        show(StanceControlState(failed = true, needsKey = true))

        compose.onNodeWithTag("${TAG}_stance_failed")
            .assertTextContains("Restore your key", substring = true)
    }

    @Test
    fun theCoachMarkTeachesTheHeldGestureOnce() {
        show(StanceControlState(coachMark = true))

        compose.onNodeWithTag("${TAG}_stance_coach").assertExists()
        compose.onNodeWithTag("${TAG}_stance_coach_dismiss").performClick()

        assertThat(coachDismissed).isEqualTo(1)
    }

    @Test
    fun theDragGestureHasNonDragEquivalents() {
        // Every drag gesture has a non-drag equivalent (design.md §10):
        // the click action commits the default, and the alternates and
        // the severance route ride custom accessibility actions.
        show(StanceControlState())

        val node = compose.onNodeWithTag("${TAG}_stance")
        node.performSemanticsAction(SemanticsActions.OnClick)
        assertThat(tapped).isEqualTo(1)

        val actions = node.fetchSemanticsNode().config[SemanticsActions.CustomActions]
        assertThat(actions.map { it.label }).containsExactly("Pick exactly", "Sever this")

        compose.runOnUiThread { actions.first { it.label == "Sever this" }.action() }
        compose.waitForIdle()
        assertThat(severOpened).isEqualTo(1)
    }
}
