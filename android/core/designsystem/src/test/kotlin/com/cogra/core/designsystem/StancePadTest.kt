package com.cogra.core.designsystem

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
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
    private var confirmationsShown = 0
    private var underneath = 0
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
                    onConfirmationShown = { confirmationsShown++ },
                    testTagPrefix = TAG,
                )
            }
        }
    }

    // -- What the resting target reads as (design.md §8.3) --

    @Test
    fun aTargetWithAStandingShowsItsFaceAndFoldedPairAtRest() {
        // (+0.55, +0.20) is 😊 "Like this". The reader sees where they
        // stand without opening anything.
        show(StanceControlState(standing = StancePoint(0.55, 0.20)))

        compose.onNodeWithTag("${TAG}_stance_standing_face", useUnmergedTree = true)
            .assertExists()
        compose.onNodeWithText("😊", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("+0.55 / +0.20", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true)
            .assertDoesNotExist()
    }

    @Test
    fun aTargetWithNoStandingShowsAMutedFaceAndNeverTheWord() {
        // A bare word is a mystery button and says the same thing
        // whatever the reader has already told it (design.md §8.3).
        show(StanceControlState(standing = null))

        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Stance", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_standing_face", useUnmergedTree = true)
            .assertDoesNotExist()
    }

    @Test
    fun theEmptyFaceIsMutedAndKeepsTheTargetsAccessibleLabel() {
        // Muted and translucent on screen, fully labelled to a screen
        // reader: the affordance keeps its label either way.
        show(StanceControlState(standing = null))

        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionContains(
            "Tap for a light yes, or press and hold to pick exactly",
        )
        // One node, one announcement: the face is a readout of what the
        // description already says, so it is never read out by its own
        // emoji name on top of it (design.md §10).
        val spoken = compose.onNodeWithTag("${TAG}_stance")
            .fetchSemanticsNode()
            .config[SemanticsProperties.ContentDescription]
            .joinToString(" ")
        assertThat(spoken).doesNotContain("😐")
    }

    @Test
    fun aStandingAtZeroShrugsInsteadOfReadingAsNice() {
        // The zero bundle never speaks through the anchor table: its
        // nearest neighbour is 🙂 "Nice", and calling the absence of a
        // feeling that is a lie (design.md §8.4).
        show(StanceControlState(standing = StancePoint.Origin))

        compose.onNodeWithText("🤷", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("🙂", useUnmergedTree = true).assertDoesNotExist()
        // It is still a standing, and it still shows its pair.
        compose.onNodeWithText("+0.00 / +0.00", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theRestingTargetAnnouncesTheStandingBeforeWhatATouchDoes() {
        show(StanceControlState(standing = StancePoint(0.55, 0.20)))

        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionContains(
            "Where you stand now: How you stand +0.55, In your world +0.20. " +
                "Tap for a light yes, or press and hold to pick exactly",
        )
    }

    // -- The control owns its touches (design.md §8.3) --
    //
    // The post card that carries this control is clickable across its
    // whole body — that is how a feed opens a post — so every gesture
    // the control is given lands on a surface that would also act on it.
    // These pin the rule that none of them ever does: on the device it
    // showed up as a hold that opened the post detail instead of the
    // pad, and as a pad flashing over the screen it had just navigated
    // to.

    /** The control inside a clickable card, exactly as a feed builds it. */
    private fun showInsideAClickableCard(state: StanceControlState) {
        compose.setContent {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { underneath++ }
                    .testTag("card"),
                contentAlignment = Alignment.Center,
            ) {
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
                    onConfirmationShown = { confirmationsShown++ },
                    testTagPrefix = TAG,
                )
            }
        }
    }

    /**
     * The control inside a clickable card merges into it — which is
     * exactly the arrangement under test — so the target is reached
     * through the unmerged tree.
     */
    private fun theTarget() = compose.onNodeWithTag("${TAG}_stance", useUnmergedTree = true)

    @Test
    fun aTapOnTheControlNeverAlsoReachesTheSurfaceUnderneath() {
        showInsideAClickableCard(StanceControlState())

        theTarget().performClick()

        assertThat(tapped).isEqualTo(1)
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun aHoldAndReleaseNeverOpensTheSurfaceUnderneath() {
        // The reported bug: hold, let go, and the post detail opened
        // instead of the pad staying parked.
        showInsideAClickableCard(StanceControlState())

        theTarget().performTouchInput { longClick() }

        assertThat(opened).isEqualTo(1)
        assertThat(held).isEqualTo(1)
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun aDragAndReleaseNeverOpensTheSurfaceUnderneath() {
        showInsideAClickableCard(StanceControlState(pad = StancePadMode.DRAGGING))
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        theTarget().performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveTo(center + Offset(extent / 2f, -extent / 3f))
            up()
        }

        assertThat(picks).isNotEmpty()
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun anAlternateInputModeAlsoOwnsItsTouches() {
        // Same bug, same root, reported separately for the sliders and
        // the typed entry: a long press navigated instead of opening.
        showInsideAClickableCard(StanceControlState(inputMode = StanceInputSurface.SLIDERS))

        theTarget().performTouchInput { longClick() }

        assertThat(opened).isEqualTo(1)
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun theCardUnderneathStillOpensWhenItIsTheThingTouched() {
        // The control owns ITS touches, not the card's: a tap anywhere
        // else on the post still opens the post.
        showInsideAClickableCard(StanceControlState())

        compose.onNodeWithTag("card").performTouchInput { click(topLeft + Offset(4f, 4f)) }

        assertThat(underneath).isEqualTo(1)
        assertThat(tapped).isEqualTo(0)
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
    fun driftingMapsValenceAcrossAndConnectionUp() {
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
    }

    @Test
    fun releasingADriftedThumbParksThePadAndSignsNothing() {
        // An accidental lift must never sign a priced act (design.md
        // §8.3): the pad is a considered surface, and Set is the
        // signature. This is the autocommit the device kept doing.
        show(StanceControlState(pad = StancePadMode.DRAGGING))
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveTo(center + Offset(extent / 2f, -extent / 4f))
            up()
        }

        assertThat(committed).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
        assertThat(held).isEqualTo(1)
    }

    @Test
    fun theReleasedPickIsStillStandingOnTheParkedPad() {
        // Release keeps the pick, it does not reset it: the reader
        // looks at what they chose and then decides to sign it.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveTo(center + Offset(extent / 2f, 0f))
            up()
        }

        compose.exactPair().assertTextEquals("+0.50 / +0.00")
        // And the pad it stands on is parked, not shut.
        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        compose.onNodeWithTag("${TAG}_stance_set").assertExists()
    }

    @Test
    fun theQuestionMarkExplainsTheControlOnDemand() {
        // The coach mark is spent on the first hold; the `?` is how
        // anyone who arrived after that asks (design.md §8.3).
        show(StanceControlState(pad = StancePadMode.STICKY))

        compose.onNodeWithTag("${TAG}_stance_explanation").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_explain").performScrollTo().performClick()

        compose.onNodeWithTag("${TAG}_stance_explanation")
            .assertTextContains("Set", substring = true)
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
                    // What the holder does: park the pad, keep the pick.
                    onHold = {
                        held++
                        state = state.copy(pad = StancePadMode.STICKY)
                    },
                    onDismissPad = { dismissed++ },
                    onToggleExactValues = { exactToggled++ },
                    onOpenSeverance = { severOpened++ },
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onCoachMarkDismissed = { coachDismissed++ },
                    onConfirmationShown = { confirmationsShown++ },
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
    fun aBloomedPadExistsWithoutDisplacingItsTarget() {
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

    // -- The alternates as the chosen input (design.md §8.6) --

    @Test
    fun choosingSlidersReplacesTheFieldWithThem() {
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                inputMode = StanceInputSurface.SLIDERS,
            ),
        )

        compose.onNodeWithTag("stance_field").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_slider_directed").assertExists()
        compose.onNodeWithTag("${TAG}_stance_slider_interest").assertExists()
        compose.onNodeWithTag("${TAG}_stance_entry_directed").assertDoesNotExist()
        // The toggle belongs to the pad; the chosen surface is not a
        // panel to open and shut.
        compose.onNodeWithTag("${TAG}_stance_exact").assertDoesNotExist()
    }

    @Test
    fun choosingTypedValuesReplacesTheFieldWithThem() {
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                inputMode = StanceInputSurface.ENTRY,
            ),
        )

        compose.onNodeWithTag("stance_field").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_entry_directed").assertExists()
        compose.onNodeWithTag("${TAG}_stance_entry_interest").assertExists()
        compose.onNodeWithTag("${TAG}_stance_slider_directed").assertDoesNotExist()
    }

    @Test
    fun thePadIsStillDrawnWhenThePadIsTheChosenInput() {
        show(StanceControlState(pad = StancePadMode.DRAGGING))

        compose.onNodeWithTag("stance_field").assertExists()
    }

    @Test
    fun anAlternateParksOnTheHoldRatherThanDriftingAField() {
        // There is no field to drift across, so the hold opens the
        // chosen surface and a release commits nothing by accident.
        show(StanceControlState(inputMode = StanceInputSurface.SLIDERS))

        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }

        assertThat(opened).isEqualTo(1)
        assertThat(held).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
        assertThat(picks).isEmpty()
    }

    @Test
    fun anAlternateStillCommitsThroughItsOwnButton() {
        show(StanceControlState(pad = StancePadMode.STICKY, inputMode = StanceInputSurface.ENTRY))

        compose.onNodeWithTag("${TAG}_stance_set").performScrollTo().performClick()

        assertThat(committed).isEqualTo(1)
    }

    @Test
    fun anAlternateKeepsTheSeveranceRouteFindable() {
        // The pad never opens for this reader, so severance has to be
        // reachable from the surface that replaced it (design.md §8.5).
        show(StanceControlState(pad = StancePadMode.STICKY, inputMode = StanceInputSurface.SLIDERS))

        compose.onNodeWithTag("${TAG}_stance_sever").performScrollTo().performClick()

        assertThat(severOpened).isEqualTo(1)
    }

    @Test
    fun aTapStillCommitsTheDefaultWhateverTheChosenInput() {
        show(StanceControlState(inputMode = StanceInputSurface.ENTRY))

        compose.onNodeWithTag("${TAG}_stance").performClick()

        assertThat(tapped).isEqualTo(1)
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
    fun theCoachMarkOutlivesTheTouchesAroundIt() {
        // It used to vanish before it could be read: a popup that
        // dismisses on any outside click counts the very touch that
        // spawned it (design.md §8.7).
        show(StanceControlState(coachMark = true))

        compose.onNodeWithTag("${TAG}_stance").performClick()
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { swipeUp() }

        compose.onNodeWithTag("${TAG}_stance_coach").assertExists()
        assertThat(coachDismissed).isEqualTo(0)
    }

    @Test
    fun theCoachMarkAndThePadShareOneAnchoredSurface() {
        // Both belong to the target: the mark explains it and the pad
        // edits it, so neither is a sibling floating over the feed.
        show(StanceControlState(coachMark = true, pad = StancePadMode.DRAGGING))

        compose.onNodeWithTag("${TAG}_stance_coach").assertExists()
        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        compose.onNodeWithTag("${TAG}_stance").assertIsDisplayed()
    }

    // -- The transient confirmation (design.md §8.3) --

    /**
     * The confirmation, wired the way a real screen wires it: consuming
     * the one-shot CLEARS it, because the state holder is the thing
     * being told it has been shown.
     *
     * That round trip is the whole test. A version that held the state
     * still passed while the device stayed silent — consuming used to
     * restart the effect and cancel the snackbar it had just posted, and
     * only a state that actually changes can catch it.
     */
    private fun showLiveConfirmation(host: SnackbarHostState, signed: StancePoint) {
        compose.setContent {
            var confirmation by remember { mutableStateOf<StancePoint?>(signed) }
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                Box(Modifier.fillMaxSize()) {
                    StanceControl(
                        state = StanceControlState(
                            standing = signed,
                            confirmation = confirmation,
                        ),
                        onTapDefault = {}, onOpenPad = {}, onPick = {}, onCommit = {},
                        onHold = {}, onDismissPad = {}, onToggleExactValues = {},
                        onOpenSeverance = {}, onConfirmSeverance = {}, onDismissSeverance = {},
                        onCoachMarkDismissed = {},
                        onConfirmationShown = {
                            confirmationsShown++
                            confirmation = null
                        },
                        testTagPrefix = TAG,
                    )
                    SnackbarHost(host, modifier = Modifier.testTag("host"))
                }
            }
        }
    }

    @Test
    fun aSignedStanceConfirmsOnTheSurfacesSnackbarHost() {
        val host = SnackbarHostState()
        showLiveConfirmation(host, StancePoint(0.1, 0.1))

        compose.waitForIdle()

        assertThat(host.currentSnackbarData?.visuals?.message)
            .isEqualTo(
                "Signed, still settling. " +
                    "Where you stand now: How you stand +0.10, In your world +0.10",
            )
        // The one-shot is spent, so a recomposition cannot repeat it.
        assertThat(confirmationsShown).isEqualTo(1)
    }

    @Test
    fun consumingTheOneShotDoesNotTearDownTheSnackbarItJustPosted() {
        // The device bug, isolated: the confirmation is consumed the
        // moment it is shown, which clears the state describing it. The
        // snackbar has to survive that and keep standing.
        val host = SnackbarHostState()
        showLiveConfirmation(host, StancePoint(0.1, 0.1))

        compose.waitForIdle()
        // Let every pending recomposition and effect restart settle.
        compose.mainClock.advanceTimeBy(500)
        compose.waitForIdle()

        assertThat(confirmationsShown).isEqualTo(1)
        assertThat(host.currentSnackbarData).isNotNull()
        compose.onNodeWithTag("host").assertExists()
    }

    @Test
    fun aSeveredStandingConfirmsAsAShrugRatherThanAsNice() {
        // (0, 0) is where severance leaves the reader, and the anchor
        // table's nearest neighbour to it is 🙂 "Nice" (design.md §8.4).
        val host = SnackbarHostState()
        showLiveConfirmation(host, StancePoint.Origin)

        compose.waitForIdle()

        compose.onNodeWithText("🤷", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("🙂", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun noConfirmationMeansNoSnackbarAndNothingConsumed() {
        show(StanceControlState(standing = StancePoint(0.1, 0.1)))

        assertThat(confirmationsShown).isEqualTo(0)
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
