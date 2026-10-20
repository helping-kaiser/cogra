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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertContentDescriptionContains
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
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

    /** The press-and-hold's own signature: the low default, nothing opened. */
    private var holdSigned = 0
    private var opened = 0
    private var committed = 0
    private var dismissed = 0
    private var exactToggled = 0
    private var severOpened = 0
    private var confirmationsShown = 0
    private var underneath = 0
    private val picks = mutableListOf<StancePoint>()

    /** What the pad was standing at when Set was pressed, on the live holder. */
    private var committedPick: StancePoint? = null

    /**
     * A bundle with something in it. The walk-away stands only where
     * there is something to walk back (`TagPageHeldPad`: the pad over a
     * topic nobody holds has three controls, the held one four), so
     * every test about the severance route opens from a held standing.
     */
    private val heldStanding = StancePoint(0.6, 0.35)

    private fun show(
        state: StanceControlState,
        axes: StanceAxes = StanceAxes.Opinion,
        targetLabel: String? = null,
        zeroWords: StanceZeroWords = StanceZeroWords.Severed,
        lineFaceInk: Color? = null,
    ) {
        compose.setContent {
            // Centred, so a drag has room on every side of the target.
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
                    lineFaceInk = lineFaceInk,
                    onHoldDefault = { holdSigned++ },
                    onOpenPad = { opened++ },
                    onPick = { picks += it },
                    onCommit = { committed++ },
                    onDismissPad = { dismissed++ },
                    onToggleExactValues = { exactToggled++ },
                    onOpenSeverance = { severOpened++ },
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onConfirmationShown = { confirmationsShown++ },
                    testTagPrefix = TAG,
                    axes = axes,
                    zeroWords = zeroWords,
                    targetLabel = targetLabel,
                )
            }
        }
    }

    /** [show], for a state a test changes after the first frame. */
    private fun showLive(state: () -> StanceControlState) {
        compose.setContent {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state(),
                    onHoldDefault = {},
                    onOpenPad = {},
                    onPick = {},
                    onCommit = {},
                    onDismissPad = {},
                    onToggleExactValues = {},
                    onOpenSeverance = {},
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onConfirmationShown = {},
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

    // stance-control.md "The vouch card's empty face is a line face in the
    // card's ink" (jakob 2026-10-14). The ink is a draw colour no semantics
    // node exposes (and captureToImage never completes under Robolectric
    // here), so the treatment is pinned at its single source and the host's
    // ink at the control: a host handing none keeps the muted emoji, a host
    // handing an ink gets the line face in exactly that ink — full opacity
    // by construction, the line face carrying no alpha of its own.
    @Test
    fun theEmptyFaceIsTheMutedEmojiByDefaultAndTheLineFaceInTheHostsInkWhenHandedOne() {
        assertThat(emptyFaceFor(null)).isEqualTo(EmptyFace.MutedEmoji)
        assertThat(RESTING_FACE_ALPHA).isEqualTo(0.4f)
        val ink = Color(0xFF3A4A1B)
        assertThat(emptyFaceFor(ink)).isEqualTo(EmptyFace.Line(ink))
    }

    @Test
    fun theLineFaceDrawsTheMastersSentimentNeutralAndTheEmojiGoesAway() {
        assertThat(LINE_FACE_PATHS).hasSize(4)

        show(StanceControlState(standing = null), lineFaceInk = Color(0xFF3A4A1B))

        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("🫥", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun aSetStanceKeepsItsOwnEmojiEvenWhereTheHostHandsALineFaceInk() {
        show(StanceControlState(standing = StancePoint(0.55, 0.20)), lineFaceInk = Color(0xFF3A4A1B))

        compose.onNodeWithText("😊", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true)
            .assertDoesNotExist()
    }

    @Test
    fun theOtherHostsKeepTheMutedEmojiAsTheEmptyFace() {
        show(StanceControlState(standing = null))

        compose.onNodeWithText("🫥", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theEmptyFaceIsMutedAndKeepsTheTargetsAccessibleLabel() {
        // Muted and translucent on screen, fully labelled to a screen
        // reader: the affordance keeps its label either way.
        show(StanceControlState(standing = null))

        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionContains(
            "Tap to pick exactly, or press and hold for a light yes",
        )
        // One node, one announcement: the face is a readout of what the
        // description already says, so it is never read out by its own
        // emoji name on top of it (design.md §10).
        val spoken = compose.onNodeWithTag("${TAG}_stance")
            .fetchSemanticsNode()
            .config[SemanticsProperties.ContentDescription]
            .joinToString(" ")
        assertThat(spoken).doesNotContain("🫥")
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
                "Tap to pick exactly, or press and hold for a light yes",
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
                    onHoldDefault = { holdSigned++ },
                    onOpenPad = { opened++ },
                    onPick = { picks += it },
                    onCommit = { committed++ },
                    onDismissPad = { dismissed++ },
                    onToggleExactValues = { exactToggled++ },
                    onOpenSeverance = { severOpened++ },
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
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

        assertThat(opened).isEqualTo(1)
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun aHoldAndReleaseNeverOpensTheSurfaceUnderneath() {
        // The reported bug's shape: hold, let go, and the post detail
        // opened. The hold signs; its lift must reach nothing else.
        showInsideAClickableCard(StanceControlState())

        theTarget().performTouchInput { longClick() }

        assertThat(holdSigned).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun aHoldThatWobblesBeforeItsLiftNeverReachesTheSurfaceUnderneath() {
        // The thumb that signed keeps moving a little before it lifts:
        // the rest of that touch is the control's too, and it opens
        // nothing — no pad on top of the signature, no post behind it.
        showInsideAClickableCard(StanceControlState())

        theTarget().performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveTo(center + Offset(2f, -2f))
            up()
        }

        assertThat(holdSigned).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
        assertThat(picks).isEmpty()
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun anAlternateInputModeAlsoOwnsItsTouches() {
        // Same bug, same root, reported separately for the sliders and
        // the typed entry: a long press navigated instead of acting.
        showInsideAClickableCard(StanceControlState(inputMode = StanceInputSurface.SLIDERS))

        theTarget().performTouchInput { longClick() }
        theTarget().performClick()

        assertThat(holdSigned).isEqualTo(1)
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
        assertThat(opened).isEqualTo(0)
        assertThat(holdSigned).isEqualTo(0)
    }

    // -- The gesture (design.md §8.3) --

    @Test
    fun aPlainTapOpensThePadAndSignsNothing() {
        // stance-control.md "The gesture": a tap blooms the pad and
        // stages nothing.
        show(StanceControlState())

        compose.onNodeWithTag("${TAG}_stance").performClick()

        assertThat(opened).isEqualTo(1)
        assertThat(holdSigned).isEqualTo(0)
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun holdingSignsTheDefaultWithoutOpeningThePad() {
        // The shortcut that signs without opening anything takes a held
        // finger (stance-control.md "The gesture").
        show(StanceControlState())

        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }

        assertThat(holdSigned).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
        compose.onNodeWithTag("${TAG}_stance_pad").assertDoesNotExist()
    }

    @Test
    fun aHoldSignsThroughItsOwnRouteAndNeverThroughSet() {
        show(StanceControlState())

        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }

        assertThat(holdSigned).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun aPressLiftedBeforeTheTimeoutIsATapAndSignsNothing() {
        show(StanceControlState())

        compose.onNodeWithTag("${TAG}_stance").performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis - 100)
            up()
        }

        assertThat(holdSigned).isEqualTo(0)
        assertThat(opened).isEqualTo(1)
    }

    @Test
    fun theTappedPadOpensAtTheDefault() {
        // jakob 2026-10-05: the pad opens at +0.10 / +0.10, so Set on a
        // pick never moved signs exactly what the hold would.
        showLive()

        compose.onNodeWithTag("${TAG}_stance").performClick()

        compose.exactPair().assertTextEquals("+0.10 / +0.10")
        compose.onNodeWithTag("${TAG}_stance_set").performScrollTo().performClick()
        assertThat(committedPick).isEqualTo(StancePoint(0.1, 0.1))
    }

    @Test
    fun driftingMapsValenceAcrossAndConnectionUp() {
        // One unit of either parameter is FIELD_EXTENT of travel: half of
        // that to the right and a quarter of it up, from the default.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent / 2f, -extent / 4f))

        val last = picks.last()
        assertThat(last.directed).isWithin(0.02).of(0.6)
        assertThat(last.interest).isWithin(0.02).of(0.35)
    }

    @Test
    fun releasingADriftedThumbParksThePadAndSignsNothing() {
        // An accidental lift must never sign a priced act (design.md
        // §8.3): the pad is a considered surface, and Set is the
        // signature.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent / 2f, -extent / 4f))

        assertThat(committed).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
    }

    @Test
    fun theReleasedPickIsStillStandingOnTheParkedPad() {
        // Release keeps the pick, it does not reset it: the reader
        // looks at what they chose and then decides to sign it.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent / 2f, 0f))

        compose.exactPair().assertTextEquals("+0.60 / +0.10")
        // And the pad it stands on is parked, not shut.
        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        compose.onNodeWithTag("${TAG}_stance_set").assertExists()
    }

    // -- The parked pad still takes drags (design.md §8.3) --

    /** Tap, drift half a unit to the right, release: the pad parks at (+0.60, +0.10). */
    private fun tapAndDrift(extent: Float) {
        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent / 2f, 0f))
    }

    /** One fresh drag on the parked field, by the given travel. */
    private fun dragTheField(by: Offset) {
        compose.onNodeWithTag("stance_field").performTouchInput {
            down(center)
            moveTo(center + by)
            up()
        }
    }

    @Test
    fun aFreshDragOnTheParkedFieldMovesTheKnobAgain() {
        // The reported bug: once the finger lifted, the knob was frozen —
        // only the launching gesture could move it. Release never commits
        // (design.md §8.3), so the pad it leaves open has to stay usable.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        tapAndDrift(extent)
        compose.exactPair().assertTextEquals("+0.60 / +0.10")

        dragTheField(Offset(-extent / 4f, -extent / 2f))

        // Adjusted from where it stood, not restarted from the default.
        compose.exactPair().assertTextEquals("+0.35 / +0.60")
        // And a drag is still not a signature.
        assertThat(committed).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
    }

    @Test
    fun theParkedFieldTakesAsManyFreshDragsAsTheReaderLikes() {
        // No budget of one: the knob is repositionable until Set or
        // Cancel, however long the reader takes to decide.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        tapAndDrift(extent)
        repeat(4) { dragTheField(Offset(0f, extent / 8f)) }

        compose.exactPair().assertTextEquals("+0.60 / -0.40")
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun setCommitsTheLastOfTheFreshDragsRatherThanTheFirstPick() {
        // What Set signs is what the field last read, not what the
        // opening gesture happened to leave behind.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        tapAndDrift(extent)
        dragTheField(Offset(extent / 4f, -extent / 4f))
        dragTheField(Offset(0f, -extent / 4f))
        compose.onNodeWithTag("${TAG}_stance_set").performScrollTo().performClick()

        assertThat(committed).isEqualTo(1)
        assertThat(committedPick?.directed).isNotNull()
        assertThat(committedPick!!.directed).isWithin(0.02).of(0.85)
        assertThat(committedPick!!.interest).isWithin(0.02).of(0.6)
    }

    @Test
    fun aFreshDragOnTheParkedFieldNeverReachesTheSurfaceUnderneath() {
        // The #456 rule holds on this path too: the control owns its
        // touches, and a second drag is one of them (design.md §8.3).
        showInsideAClickableCard(StanceControlState(pad = StancePadMode.STICKY))
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        dragTheField(Offset(extent / 3f, -extent / 3f))

        assertThat(picks).isNotEmpty()
        assertThat(underneath).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun aPadMidSignatureTakesNoFurtherDrags() {
        // Set is in flight: the pick it is signing must not move under it.
        show(StanceControlState(pad = StancePadMode.STICKY, busy = true))
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        dragTheField(Offset(extent / 3f, -extent / 3f))

        assertThat(picks).isEmpty()
    }

    @Test
    fun noFreshDragEverPutsTheKnobOutsideTheDrawnField() {
        // The adversarial sweep again, driven through the SECOND gesture:
        // whatever the thumb does to a parked pad, the knob stays inside
        // the drawing (design.md §8.3).
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }
        val half = with(compose.density) { (FIELD_SIZE / 2).toPx() }
        val corner = with(compose.density) { FIELD_CORNER.toPx() }
        val knob = with(compose.density) { KNOB_RADIUS.toPx() }

        tapAndDrift(extent)
        compose.onNodeWithTag("stance_field").performTouchInput {
            down(center)
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

    @Test
    fun theQuestionMarkExplainsTheControlOnDemand() {
        // The coaching lines ride the first open only; the `?` is how
        // anyone who arrived after that asks (stance-control.md).
        show(StanceControlState(pad = StancePadMode.STICKY))

        compose.onNodeWithTag("${TAG}_stance_explanation").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_explain").performScrollTo().performClick()

        compose.onNodeWithTag("${TAG}_stance_explanation").assertExists()
        compose.onNodeWithTag("${TAG}_stance_explain_back").assertExists()
    }

    @Test
    fun theHelpTakesTheFieldsPlaceRatherThanGrowingBelowIt() {
        // StanceControl.jsx: the panel REPLACES the readouts and the
        // input. Appended, it grew the card past the window, where
        // PadAtLowerCentre's clamp abandons the lower anchor and snaps
        // the pad to the top — the jump (HT-9). Set is disabled while
        // it is up: the field it explains is not there to check.
        show(StanceControlState(pad = StancePadMode.STICKY))
        compose.onNodeWithTag("${TAG}_stance_readout").assertExists()

        compose.onNodeWithTag("${TAG}_stance_explain").performScrollTo().performClick()
        compose.onNodeWithTag("${TAG}_stance_readout").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_set").assertIsNotEnabled()

        compose.onNodeWithTag("${TAG}_stance_explain_back").performScrollTo().performClick()
        compose.onNodeWithTag("${TAG}_stance_readout").assertExists()
        compose.onNodeWithTag("${TAG}_stance_explanation").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_set").assertIsEnabled()
    }

    @Test
    fun theSquareStaysReachableAndTravelBeyondItClamps() {
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performClick()
        // Past the corner: the far corner is still expressible, and
        // nothing beyond it exists (design.md §8.2).
        dragTheField(Offset(extent * 1.4f, -extent * 1.4f))

        assertThat(picks.last()).isEqualTo(StancePoint(1.0, 1.0))
    }

    @Test
    fun noDragAnywhereEverPutsTheKnobOutsideTheDrawnField() {
        // The adversarial sweep, driven through the real gesture rather
        // than the mapping alone: whatever the thumb does to the pad the
        // tap opened, the picks it reports keep the knob inside the
        // drawing (design.md §8.3).
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }
        val half = with(compose.density) { (FIELD_SIZE / 2).toPx() }
        val corner = with(compose.density) { FIELD_CORNER.toPx() }
        val knob = with(compose.density) { KNOB_RADIUS.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performClick()
        compose.onNodeWithTag("stance_field").performTouchInput {
            down(center)
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
                    onHoldDefault = { holdSigned++ },
                    // What the holder does: park the pad open at the
                    // default, +0.10 / +0.10 (stance-control.md "The gesture").
                    onOpenPad = {
                        opened++
                        state = state.copy(pad = StancePadMode.STICKY, pick = StancePoint(0.1, 0.1))
                    },
                    onPick = {
                        picks += it
                        state = state.copy(pick = it)
                    },
                    onCommit = {
                        committed++
                        committedPick = state.pick
                    },
                    onDismissPad = { dismissed++ },
                    onToggleExactValues = { exactToggled++ },
                    onOpenSeverance = { severOpened++ },
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onConfirmationShown = { confirmationsShown++ },
                    testTagPrefix = TAG,
                )
            }
        }
    }

    // -- The readout (design.md §8.4) --

    @Test
    fun theExactPairIsPartOfTheDefaultReading() {
        show(StanceControlState(pad = StancePadMode.STICKY, pick = StancePoint(0.4, 0.2)))

        compose.exactPair().assertTextEquals("+0.40 / +0.20")
    }

    @Test
    fun theExactPairFollowsTheDragLive() {
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performClick()
        compose.onNodeWithTag("stance_field").performTouchInput {
            down(center)
            moveTo(center + Offset(extent / 2f, 0f))
        }
        compose.exactPair().assertTextEquals("+0.60 / +0.10")

        compose.onNodeWithTag("stance_field").performTouchInput {
            moveTo(center + Offset(-extent, -extent / 4f))
            up()
        }
        compose.exactPair().assertTextEquals("-0.90 / +0.35")
    }

    @Test
    fun aValueThatRoundsToZeroIsWrittenWithoutANegativeSign() {
        // Travel straight along one axis leaves the other at negative
        // zero; "-0.00" reads as a broken control.
        show(StanceControlState(pad = StancePadMode.STICKY, pick = StancePoint(0.5, -0.0)))

        compose.exactPair().assertTextEquals("+0.50 / +0.00")
    }

    @Test
    fun theExactPairIsAnnouncedWithItsAxesNamed() {
        // Compact on screen, never a bare pair to a screen reader: the
        // readout is announced once, and the axes ride that announcement.
        show(StanceControlState(pad = StancePadMode.STICKY, pick = StancePoint(0.4, 0.2)))

        compose.onNodeWithTag("${TAG}_stance_readout")
            .assertContentDescriptionContains("How you stand +0.40, In your world +0.20")
    }

    @Test
    fun theReadoutSpeaksThePickInWordsNotTheBundle() {
        // The pick is (+0.9, +0.25) — 😍 "Love this" — while the bundle
        // sits somewhere else entirely. The face follows the pick.
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
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
                pad = StancePadMode.STICKY,
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
        show(StanceControlState(pad = StancePadMode.STICKY, landing = null))

        compose.onNodeWithTag("${TAG}_stance_landing")
            .assertTextContains("Working out", substring = true)
    }

    @Test
    fun aOneZeroLandingReadsItsStateUnderTheThinkingFace() {
        // Round 18 (jakob 2026-10-20): one number at zero is unreachable,
        // never severance — 🤔, the state, then the one consequence.
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                landing = StanceLanding(
                    StancePoint(0.0, 0.4),
                    inertDirected = true,
                    inertInterest = false,
                    severance = false,
                ),
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_landing")
            .assertTextContains("Interested, no side taken — this won't shape anyone's feed.")
        compose.onNodeWithText(UNREACHABLE_EMOJI, useUnmergedTree = true).assertExists()
        compose.onNodeWithText("🤷", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_landing_borrowed").assertDoesNotExist()
    }

    @Test
    fun theUnreachableHeadFollowsTheSignOfTheNumberThatStands() {
        val heads = listOf(
            StanceLanding(StancePoint(0.0, -0.4), true, false, false) to "Rather not see it, no side taken",
            StanceLanding(StancePoint(0.4, 0.0), false, true, false) to "For it, no interest either way",
            StanceLanding(StancePoint(-0.4, 0.0), false, true, false) to "Against it, no interest either way",
        )
        var landing by mutableStateOf(heads.first().first)
        showLive { StanceControlState(pad = StancePadMode.STICKY, landing = landing) }
        for ((next, head) in heads) {
            landing = next
            compose.onNodeWithTag("${TAG}_stance_landing")
                .assertTextContains("$head — this won't shape anyone's feed.")
        }
    }

    @Test
    fun theMastersZeroStateWordsAreTheStrings() {
        val master = java.io.File("../../../design/components/stance/StanceReadout.jsx").readText()
        val strings = java.io.File("src/main/res/values/strings.xml").readText().replace("\\'", "'")
        for (head in listOf(
            "Interested, no side taken",
            "Rather not see it, no side taken",
            "For it, no interest either way",
            "Against it, no interest either way",
        )) {
            assertThat(master).contains("\"$head\"")
            assertThat(strings).contains(">$head</string>")
        }
        val tail = Regex("export const UNREACHABLE_TAIL = \"([^\"]+)\";").find(master)!!.groupValues[1]
        assertThat(strings).contains("<string name=\"stance_unreachable_tail\">$tail</string>")
        val kept = Regex("export const BORROWED_KEPT_LINE = \"([^\"]+)\";").find(master)!!.groupValues[1]
        assertThat(strings).contains("<string name=\"stance_borrowed_kept\">$kept</string>")
    }

    @Test
    fun aBorrowingReaderIsWarnedUnderAnUnreachableOrSeveredLandingOnly() {
        val unreachable = StanceLanding(StancePoint(0.0, 0.4), true, false, false)
        val severed = StanceLanding(StancePoint.Origin, true, true, true)
        val live = StanceLanding(StancePoint(0.3, 0.4), false, false, false)
        var landing by mutableStateOf(unreachable)
        showLive { StanceControlState(pad = StancePadMode.STICKY, landing = landing, borrowed = true) }
        compose.onNodeWithTag("${TAG}_stance_landing_borrowed")
            .assertTextEquals("You'd keep your borrowed view — no feed of your own yet.")
        landing = severed
        compose.onNodeWithTag("${TAG}_stance_landing_borrowed").assertExists()
        landing = live
        compose.onNodeWithTag("${TAG}_stance_landing_borrowed").assertDoesNotExist()
    }

    @Test
    fun aLandingOnZeroIsNamedAsSeverance() {
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                landing = StanceLanding(
                    StancePoint.Origin,
                    inertDirected = true,
                    inertInterest = true,
                    severance = true,
                ),
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_landing")
            .assertTextContains("back to nothing", substring = true)
    }

    // jakob's I2 ruling (copy-voice.md "Awaiting blessing — the topic
    // disconnects", 2026-09-15): a topic disconnects, never severs. The
    // test above (default `StanceZeroWords.Severed`) is untouched — the
    // split is by record family, not by surface.
    @Test
    fun aTopicsLandingOnZeroReadsAsNoOpinionRatherThanSeverance() {
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                landing = StanceLanding(
                    StancePoint.Origin,
                    inertDirected = true,
                    inertInterest = true,
                    severance = true,
                ),
            ),
            zeroWords = StanceZeroWords.Disconnected,
        )

        compose.onNodeWithTag("${TAG}_stance_landing")
            .assertTextContains("This leaves you with no opinion towards it.")
    }

    @Test
    fun aTopicsZeroStandingNamesItInTheSentenceRuledForIt() {
        show(
            StanceControlState(pad = StancePadMode.STICKY, standing = StancePoint.Origin),
            zeroWords = StanceZeroWords.Disconnected,
            targetLabel = "#saltmaps",
        )

        compose.onNodeWithTag("${TAG}_stance_standing")
            .assertTextContains("No opinion towards #saltmaps.")
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
        show(StanceControlState(pad = StancePadMode.STICKY))

        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        // The target itself keeps its place; the pad never replaces it.
        compose.onNodeWithTag("${TAG}_stance").assertIsDisplayed()
    }

    @Test
    fun aDrifitngThumbNeverDismissesItsOwnPad() {
        // A drag on the field is the pad's own touch: however far it
        // travels, it never reads as a press outside.
        showLive()
        val extent = with(compose.density) { FIELD_EXTENT.toPx() }

        compose.onNodeWithTag("${TAG}_stance").performClick()
        compose.onNodeWithTag("stance_field").performTouchInput {
            down(center)
            moveTo(center + Offset(extent, -extent))
            moveTo(center + Offset(-extent, extent))
        }

        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        assertThat(dismissed).isEqualTo(0)
    }

    // -- The parked pad: alternates and the severance route --

    @Test
    fun theParkedPadCarriesTheAlternatesAndTheSeveranceRoute() {
        // Held, because the walk-away only stands where there is
        // something to walk back (`TagPageHeldPad`, ruled 2026-09-15).
        show(StanceControlState(pad = StancePadMode.STICKY, standing = heldStanding))

        compose.onNodeWithTag("${TAG}_stance_exact").performScrollTo().performClick()
        assertThat(exactToggled).isEqualTo(1)

        compose.onNodeWithTag("${TAG}_stance_sever").performScrollTo().performClick()
        assertThat(severOpened).isEqualTo(1)

        compose.onNodeWithTag("${TAG}_stance_cancel").performScrollTo().performClick()
        assertThat(dismissed).isEqualTo(1)
    }

    @Test
    fun aTopicsWayOutReadsDisconnectNeverWalkItBack() {
        show(
            StanceControlState(pad = StancePadMode.STICKY, standing = heldStanding),
            zeroWords = StanceZeroWords.Disconnected,
        )

        compose.onNodeWithTag("${TAG}_stance_sever")
            .performScrollTo()
            .assertTextContains("Disconnect")
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
        show(StanceControlState(pad = StancePadMode.STICKY))

        compose.onNodeWithTag("stance_field").assertExists()
    }

    @Test
    fun anAlternateOpensOnTheTapAndSignsNothing() {
        // The chosen surface replaces the pad everywhere (design.md §8.6),
        // the tap that opens it included.
        show(StanceControlState(inputMode = StanceInputSurface.SLIDERS))

        compose.onNodeWithTag("${TAG}_stance").performClick()

        assertThat(opened).isEqualTo(1)
        assertThat(holdSigned).isEqualTo(0)
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
        // Held, per the walk-away's own rule (`TagPageHeldPad`).
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                standing = heldStanding,
                inputMode = StanceInputSurface.SLIDERS,
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_sever").performScrollTo().performClick()

        assertThat(severOpened).isEqualTo(1)
    }

    @Test
    fun aHoldStillSignsTheDefaultWhateverTheChosenInput() {
        show(StanceControlState(inputMode = StanceInputSurface.ENTRY))

        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }

        assertThat(holdSigned).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
    }

    @Test
    fun theParkedPadCommitsThroughItsOwnButton() {
        show(StanceControlState(pad = StancePadMode.STICKY))

        compose.onNodeWithTag("${TAG}_stance_set").performScrollTo().performClick()

        assertThat(committed).isEqualTo(1)
    }

    // -- Failure, teaching, accessibility --

    @Test
    fun aFailedHoldIsReportedEvenThoughNoPadIsOpen() {
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
    fun theFirstOpenCarriesTheTwoCoachingLines() {
        // stance-control.md "Teaching it"; copy-voice.md "The first-ever
        // pad teaches in two coaching lines".
        show(StanceControlState(pad = StancePadMode.STICKY, coaching = true))

        val coaching = compose.onNodeWithTag("${TAG}_stance_coaching", useUnmergedTree = true)
        coaching.assertExists()
        compose.onNodeWithText(
            "Later, tap the small face under a post to open this — press and hold it " +
                "instead and a gentle 🙂 is signed on the spot.",
            useUnmergedTree = true,
        ).assertExists()
        compose.onNodeWithText(
            "Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.",
            useUnmergedTree = true,
        ).assertExists()
    }

    @Test
    fun theCoachingFaceIsSpokenWithItsPair() {
        // The face is drawn; its spoken twin says the face and the pair.
        show(StanceControlState(pad = StancePadMode.STICKY, coaching = true))

        compose.onNodeWithText(
            "Later, tap the small face under a post to open this — press and hold it " +
                "instead and a gentle 🙂 is signed on the spot.",
            useUnmergedTree = true,
        ).assertContentDescriptionEquals(
            "Later, tap the small face under a post to open this — press and hold it " +
                "instead and a gentle Nice, For or against +0.10, How much reaches you +0.10 " +
                "is signed on the spot.",
        )
    }

    @Test
    fun theCoachingLinesSitBetweenTheFieldAndTheLandingLine() {
        // The master's `padNote` slot.
        show(StanceControlState(pad = StancePadMode.STICKY, coaching = true))

        val field = compose.onNodeWithTag("stance_field", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        val coaching = compose.onNodeWithTag("${TAG}_stance_coaching", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        val landing = compose.onNodeWithTag("${TAG}_stance_landing", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        assertThat(coaching.top).isAtLeast(field.bottom)
        assertThat(landing.top).isAtLeast(coaching.bottom)
    }

    @Test
    fun aLaterOpenCarriesNoCoaching() {
        show(StanceControlState(pad = StancePadMode.STICKY, coaching = false))

        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
        compose.onNodeWithTag("${TAG}_stance_coaching", useUnmergedTree = true).assertDoesNotExist()
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
                        onHoldDefault = {}, onOpenPad = {}, onPick = {}, onCommit = {},
                        onDismissPad = {}, onToggleExactValues = {},
                        onOpenSeverance = {}, onConfirmSeverance = {}, onDismissSeverance = {},
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
        // the click action opens the pad as a tap does, the long-click
        // action signs the default as a hold does, and the alternates
        // and the severance route ride custom accessibility actions.
        // Held, because the walk-away is offered on the same terms it is
        // drawn on (`TagPageHeldPad`).
        show(StanceControlState(standing = heldStanding))

        val node = compose.onNodeWithTag("${TAG}_stance")
        node.performSemanticsAction(SemanticsActions.OnClick)
        assertThat(opened).isEqualTo(1)
        assertThat(holdSigned).isEqualTo(0)
        node.performSemanticsAction(SemanticsActions.OnLongClick)
        assertThat(holdSigned).isEqualTo(1)

        val actions = node.fetchSemanticsNode().config[SemanticsActions.CustomActions]
        assertThat(actions.map { it.label }).containsExactly("Pick exactly", "Walk it back")

        compose.runOnUiThread { actions.first { it.label == "Walk it back" }.action() }
        compose.waitForIdle()
        assertThat(severOpened).isEqualTo(1)
    }

    // -- The walk-away, the family's words, and what the control names --

    @Test
    fun withNothingSaidThereIsNoWalkAwayToOffer() {
        // The pad over a topic nobody holds has three controls; the pad
        // over a held one has four (`TagPageHeldPad`, ruled 2026-09-15;
        // the web control spells the same test as `records > 0`, #760).
        // A button whose only destination is a dialog saying there is
        // nothing to walk back is not a button.
        show(StanceControlState(pad = StancePadMode.STICKY, standing = null))

        compose.onNodeWithTag("${TAG}_stance_sever").assertDoesNotExist()
        val actions = compose.onNodeWithTag("${TAG}_stance")
            .fetchSemanticsNode().config[SemanticsActions.CustomActions]
        assertThat(actions.map { it.label }).containsExactly("Pick exactly")
    }

    @Test
    fun theAffinityFamilyAsksItsOwnTwoQuestions() {
        // One gesture, one face table, one ceremony — what belongs to
        // the family is the words at the axes (jakob 2026-09-14, the
        // six ruled 2026-09-15). The questions reach the sliders, the
        // typed fields and every spoken readout, so the accessible
        // route asks what the drawn one asks.
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                standing = heldStanding,
                inputMode = StanceInputSurface.SLIDERS,
            ),
            axes = StanceAxes.Affinity,
        )

        compose.onNodeWithTag("${TAG}_stance_slider_directed")
            .assertContentDescriptionEquals("How much you like it")
        compose.onNodeWithTag("${TAG}_stance_slider_interest")
            .assertContentDescriptionEquals("How close you want to be")
        // And nothing of the opinion's wording survives on the surface.
        compose.onNodeWithTag("${TAG}_stance_standing", useUnmergedTree = true)
            .assertTextContains("How much you like it", substring = true)
    }

    @Test
    fun anOpinionKeepsItsOwnWordsWhenNoFamilyNamesTheAxes() {
        // The default is what every surface had before families named
        // theirs: the axes are a parameter, not a replacement.
        show(
            StanceControlState(
                pad = StancePadMode.STICKY,
                standing = heldStanding,
                inputMode = StanceInputSurface.SLIDERS,
            ),
        )

        compose.onNodeWithTag("${TAG}_stance_slider_directed")
            .assertContentDescriptionEquals("How you stand")
        compose.onNodeWithTag("${TAG}_stance_slider_interest")
            .assertContentDescriptionEquals("In your world")
    }

    @Test
    fun aLabelledTargetNamesWhatItStances() {
        // More than one stance control can stand on a page, and the
        // face's accessible name is what says which is which
        // (`TagPage`: "AND IT NAMES WHAT IT STANCES").
        show(StanceControlState(standing = heldStanding), targetLabel = "#saltmaps")

        compose.onNodeWithTag("${TAG}_stance")
            .assertContentDescriptionContains("#saltmaps", substring = true)
    }
}
