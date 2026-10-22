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
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
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
import androidx.compose.ui.unit.dp
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "post"

/** The pick's exact pair — painted only in geek mode, read unmerged inside its block. */
private fun ComposeContentTestRule.exactPair() =
    onNodeWithTag("${TAG}_stance_exact_pair", useUnmergedTree = true)

/** The field's value space. */
private fun ComposeContentTestRule.field() = onNodeWithTag("${TAG}_stance_field")

/**
 * The opinion pad against its masters (StanceControl.jsx, StancePad.jsx,
 * StanceReadout.jsx; behavior/PadStanding.md, the acceptance lines quoted
 * beside each test).
 */
// A phone tall enough for the parked pad whole.
@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class StancePadTest {

    @get:Rule
    val compose = createComposeRule()

    private var holdSigned = 0
    private var opened = 0
    private var committed = 0
    private var dismissed = 0
    private var alternatesOpened = 0
    private var severOpened = 0
    private var confirmationsShown = 0
    private var emptySigned = 0
    private var emptyKept = 0
    private var underneath = 0
    private val picks = mutableListOf<StancePoint>()

    /** What the pad was standing at when Set was pressed, on the live holder. */
    private var committedPick: StancePoint? = null

    /** A bundle with something in it: the walk-away stands only over one. */
    private val heldStanding = StancePoint(0.6, 0.35)

    private val extent get() = with(compose.density) { FIELD_EXTENT.toPx() }

    private fun show(
        state: StanceControlState,
        axes: StanceAxes = StanceAxes.Opinion,
        targetLabel: String? = null,
        zeroWords: StanceZeroWords = StanceZeroWords.Severed,
        lineFaceInk: Color? = null,
        geek: Boolean = false,
        wide: Boolean = false,
        vouchesIn: Boolean = false,
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides geek) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    StanceControl(
                        state = state,
                        onConfirmEmptySign = { emptySigned++ },
                        onDismissEmptySign = { emptyKept++ },
                        vouchesIn = vouchesIn,
                        lineFaceInk = lineFaceInk,
                        onHoldDefault = { holdSigned++ },
                        onOpenPad = { opened++ },
                        onPick = { picks += it },
                        onCommit = { committed++ },
                        onDismissPad = { dismissed++ },
                        onOpenAlternates = { alternatesOpened++ },
                        onOpenSeverance = { severOpened++ },
                        onConfirmSeverance = {},
                        onDismissSeverance = {},
                        onConfirmationShown = { confirmationsShown++ },
                        testTagPrefix = TAG,
                        axes = axes,
                        zeroWords = zeroWords,
                        targetLabel = targetLabel,
                        wide = wide,
                    )
                }
            }
        }
    }

    /** [show], for a state a test changes after the first frame. */
    private fun showLive(geek: Boolean = false, state: () -> StanceControlState) {
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides geek) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    StanceControl(
                        state = state(),
                        onHoldDefault = {},
                        onOpenPad = {},
                        onPick = {},
                        onCommit = {},
                        onDismissPad = {},
                        onOpenAlternates = {},
                        onOpenSeverance = {},
                        onConfirmSeverance = {},
                        onDismissSeverance = {},
                        onConfirmationShown = {},
                        testTagPrefix = TAG,
                    )
                }
            }
        }
    }

    /** The same control holding its own pick, so a drag moves it — geek mode on, so the pair can be read. */
    private fun showHolding(initial: StanceControlState = StanceControlState()) {
        compose.setContent {
            var state by remember { mutableStateOf(initial) }
            CompositionLocalProvider(LocalShowExactValues provides true) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    StanceControl(
                        state = state,
                        onHoldDefault = { holdSigned++ },
                        // What the holder does: park the pad open at the
                        // default, +0.10 / +0.10.
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
                        onOpenAlternates = { alternatesOpened++ },
                        onOpenSeverance = { severOpened++ },
                        onConfirmSeverance = {},
                        onDismissSeverance = {},
                        onConfirmationShown = { confirmationsShown++ },
                        testTagPrefix = TAG,
                    )
                }
            }
        }
    }

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
                    onOpenAlternates = { alternatesOpened++ },
                    onOpenSeverance = { severOpened++ },
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onConfirmationShown = { confirmationsShown++ },
                    testTagPrefix = TAG,
                )
            }
        }
    }

    private fun theTarget() = compose.onNodeWithTag("${TAG}_stance", useUnmergedTree = true)

    private fun dragTheField(by: Offset) {
        compose.field().performTouchInput {
            down(center)
            moveTo(center + by)
            up()
        }
    }

    private val open = StanceControlState(pad = StancePadMode.STICKY, pick = StancePoint(0.1, 0.1))

    // -- At rest (StanceControl.prompt.md "At rest it shows the current opinion") --

    @Test
    fun atRestTheFaceStandsAlone() {
        // (+0.55, +0.20) is 😊 "Like this". The face is the default reading;
        // the pair is the geek one (readme §13, "One markup, two paintings").
        show(StanceControlState(standing = StancePoint(0.55, 0.20)))
        compose.onNodeWithText("😊", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("+0.55 / +0.20", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun atRestThePairPaintsInGeekMode() {
        show(StanceControlState(standing = StancePoint(0.55, 0.20)), geek = true)
        compose.onNodeWithText("+0.55 / +0.20", useUnmergedTree = true).assertExists()
    }

    private val likeThisSpoken =
        "Your opinion on this post: Like this, +0.55 / +0.20. Press and hold to add a positive one."

    @Test
    fun theFacesNameCarriesThePairInTheDefaultPainting() {
        // "Nothing spoken depends on the mode" (readme §13).
        show(StanceControlState(standing = StancePoint(0.55, 0.20)))
        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionEquals(likeThisSpoken)
    }

    @Test
    fun theFacesNameIsTheSameInGeekMode() {
        show(StanceControlState(standing = StancePoint(0.55, 0.20)), geek = true)
        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionEquals(likeThisSpoken)
    }

    @Test
    fun anUnauthoredFaceIsTheMutedFaceAndIsNamedGiveYourOpinion() {
        show(StanceControlState(standing = null))

        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("🫥", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionEquals("Give your opinion on this post")
    }

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
    fun aStandingAtZeroShrugsInsteadOfReadingAsNice() {
        show(StanceControlState(standing = StancePoint.Origin))
        compose.onNodeWithText("🤷", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("🙂", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theWideAnchorSaysYourOpinionWhereThereIsNoPairToShow() {
        show(StanceControlState(standing = null), wide = true)
        compose.onNodeWithText("Your opinion", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theWideAnchorDropsItsWordsOnceAnOpinionStands() {
        show(StanceControlState(standing = heldStanding), wide = true)
        compose.onNodeWithText("Your opinion", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun aLabelledTargetNamesWhatItStances() {
        show(StanceControlState(standing = heldStanding), targetLabel = "#saltmaps")
        compose.onNodeWithTag("${TAG}_stance")
            .assertContentDescriptionContains("Your opinion on #saltmaps:", substring = true)
    }

    // -- The control owns its touches --

    @Test
    fun aTapOnTheControlNeverAlsoReachesTheSurfaceUnderneath() {
        showInsideAClickableCard(StanceControlState())
        theTarget().performClick()
        assertThat(opened).isEqualTo(1)
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun aHoldAndReleaseNeverOpensTheSurfaceUnderneath() {
        showInsideAClickableCard(StanceControlState())
        theTarget().performTouchInput { longClick() }
        assertThat(holdSigned).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
        assertThat(underneath).isEqualTo(0)
    }

    @Test
    fun aHoldThatWobblesBeforeItsLiftNeverReachesTheSurfaceUnderneath() {
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
    fun theCardUnderneathStillOpensWhenItIsTheThingTouched() {
        showInsideAClickableCard(StanceControlState())
        compose.onNodeWithTag("card").performTouchInput { click(topLeft + Offset(4f, 4f)) }
        assertThat(underneath).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
    }

    // -- The gesture --

    @Test
    fun aPlainTapOpensThePadAndSignsNothing() {
        show(StanceControlState())
        compose.onNodeWithTag("${TAG}_stance").performClick()
        assertThat(opened).isEqualTo(1)
        assertThat(holdSigned).isEqualTo(0)
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun holdingSignsTheDefaultWithoutOpeningThePad() {
        show(StanceControlState())
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }
        assertThat(holdSigned).isEqualTo(1)
        assertThat(opened).isEqualTo(0)
        assertThat(committed).isEqualTo(0)
        compose.onNodeWithTag("${TAG}_stance_pad").assertDoesNotExist()
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

    // RowSigning.md / StanceControl.jsx: the hold's row line.
    @Test
    fun aHoldPast200msSaysSigningUnderTheFace() {
        compose.mainClock.autoAdvance = false
        show(StanceControlState(standing = heldStanding, busy = true))
        compose.mainClock.advanceTimeBy(SETTING_AFTER_MS - 50)
        compose.onNodeWithTag("${TAG}_stance_row").assertDoesNotExist()
        compose.mainClock.advanceTimeBy(100)
        compose.onNodeWithTag("${TAG}_stance_row").assertTextEquals("Signing…")
    }

    @Test
    fun aHoldThatDidNotSignSaysSoWithRetryAndRetryHoldsAgain() {
        show(StanceControlState(standing = heldStanding, failed = true))
        compose.onNodeWithText("That didn't sign.", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("${TAG}_stance_row_retry", useUnmergedTree = true).performClick()
        assertThat(holdSigned).isEqualTo(1)
    }

    @Test
    fun aHuskDeviceIsToldToRestoreItsKeyRatherThanToRetryBlindly() {
        show(StanceControlState(failed = true, needsKey = true))
        compose.onNodeWithTag("${TAG}_stance_failed")
            .assertTextContains("Restore your key", substring = true)
    }

    // -- The non-drag door (StanceControl.jsx:587-614) --

    @Test
    fun theDragGestureHasNonDragEquivalents() {
        show(StanceControlState(standing = heldStanding))
        val node = compose.onNodeWithTag("${TAG}_stance")
        node.performSemanticsAction(SemanticsActions.OnClick)
        assertThat(opened).isEqualTo(1)
        node.performSemanticsAction(SemanticsActions.OnLongClick)
        assertThat(holdSigned).isEqualTo(1)

        val actions = node.fetchSemanticsNode().config[SemanticsActions.CustomActions]
        assertThat(actions.map { it.label }).containsExactly("Choose your opinion on this post")
        compose.runOnUiThread { actions.single().action() }
        compose.waitForIdle()
        assertThat(alternatesOpened).isEqualTo(1)
    }

    // -- The open pad's shell (PadStanding.md:15-19) --

    @Test
    fun thePadCarriesAWashAndAPressOnItClosesWithNothingStaged() {
        show(open)
        compose.onNodeWithTag("${TAG}_stance_scrim").performTouchInput { click(Offset(8f, 8f)) }
        assertThat(dismissed).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun thePadIsAPaneNamedForItsTarget() {
        show(open, targetLabel = "@ada")
        compose.onNodeWithTag("${TAG}_stance_pad")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.PaneTitle, "Opinion pad for @ada"))
    }

    @Test
    fun thePadIsTheMastersWidth() {
        show(open)
        val width = compose.onNodeWithTag("${TAG}_stance_pad").fetchSemanticsNode().size.width
        assertThat(width.toFloat()).isWithin(1f).of(with(compose.density) { PAD_WIDTH.toPx() })
    }

    // -- The three readouts (PadStanding.md:21; StanceReadout.prompt.md) --

    @Test
    fun thePadReadsCurrentOpinionAndYourPickAboveTheFieldAndResultingOpinionBelow() {
        show(
            open.copy(
                pick = StancePoint(-0.55, -0.15),
                standing = StancePoint(1.0, 1.0),
                landing = StanceLanding(StancePoint(0.45, 0.85), false, false, false),
            ),
        )
        val current = compose.onNodeWithTag("${TAG}_stance_standing").fetchSemanticsNode().boundsInRoot
        val pick = compose.onNodeWithTag("${TAG}_stance_readout").fetchSemanticsNode().boundsInRoot
        val field = compose.field().fetchSemanticsNode().boundsInRoot
        val landing = compose.onNodeWithTag("${TAG}_stance_landing").fetchSemanticsNode().boundsInRoot
        assertThat(pick.top).isAtLeast(current.bottom)
        assertThat(field.top).isAtLeast(pick.bottom)
        assertThat(landing.top).isAtLeast(field.bottom)
        compose.onNodeWithText("Current opinion", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Your pick", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Resulting opinion", useUnmergedTree = true).assertExists()
    }

    @Test
    fun eachReadoutIsSpokenAsLabelWordAndBothAxes() {
        // copy-voice *The readouts, spoken* — PadStanding's fixture.
        show(
            open.copy(
                pick = StancePoint(-0.55, -0.15),
                standing = StancePoint(1.0, 1.0),
                landing = StanceLanding(StancePoint(0.45, 0.85), false, false, false),
            ),
        )
        compose.onNodeWithTag("${TAG}_stance_standing").assertContentDescriptionEquals(
            "Current opinion: All in, For or against +1.00, How much reaches you +1.00",
        )
        compose.onNodeWithTag("${TAG}_stance_readout").assertContentDescriptionEquals(
            "Your pick: Dislike, keep away, For or against −0.55, How much reaches you −0.15",
        )
        compose.onNodeWithTag("${TAG}_stance_landing").assertContentDescriptionEquals(
            "Resulting opinion: Tell me everything, For or against +0.45, How much reaches you +0.85",
        )
    }

    @Test
    fun theAnchorsWordsAreNeverDrawn() {
        // "Face and pair — never the anchor's words as well."
        show(open.copy(pick = StancePoint(0.9, 0.25), standing = heldStanding), geek = true)
        compose.onNodeWithText("Love this", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithText("Really into this", useUnmergedTree = true).assertDoesNotExist()
    }

    private val threeReadouts = open.copy(
        pick = StancePoint(0.4, 0.2),
        standing = heldStanding,
        landing = StanceLanding(StancePoint(1.0, 0.55), false, false, false),
    )

    @Test
    fun theReadoutPairsAreNotPaintedByDefault() {
        show(threeReadouts)
        compose.exactPair().assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_standing_pair", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_landing_pair", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theReadoutPairsPaintInGeekMode() {
        show(threeReadouts, geek = true)
        compose.exactPair().assertTextEquals("+0.40 / +0.20")
        compose.onNodeWithTag("${TAG}_stance_standing_pair", useUnmergedTree = true).assertTextEquals("+0.60 / +0.35")
        compose.onNodeWithTag("${TAG}_stance_landing_pair", useUnmergedTree = true).assertTextEquals("+1.00 / +0.55")
    }

    @Test
    fun nothingSignedReadsAsTheShrugSentence() {
        show(open.copy(standing = null))
        compose.onNodeWithTag("${TAG}_stance_standing").assertTextEquals("🤷 No opinion on this post yet.")
    }

    @Test
    fun aWalkedBackBundleReadsAsItsSentence() {
        show(open.copy(standing = StancePoint.Origin, severed = true), targetLabel = "@ada")
        compose.onNodeWithTag("${TAG}_stance_standing").assertTextEquals("🤷 You've walked @ada back to nothing.")
    }

    @Test
    fun aTopicsZeroStandingNamesItInTheSentenceRuledForIt() {
        show(
            open.copy(standing = StancePoint.Origin, severed = true),
            zeroWords = StanceZeroWords.Disconnected,
            targetLabel = "#saltmaps",
        )
        compose.onNodeWithTag("${TAG}_stance_standing").assertTextEquals("🤷 No opinion towards #saltmaps.")
    }

    // -- Faces follow the value (PadStanding.md:23-31; seam 243) --

    @Test
    fun anEmptySignsStandingIsAReadoutThatSaysNothingNeverTheWalkBackSentence() {
        // Records > 0, not severed, at (0, 0): `standingParts`' block, 🤷.
        show(open.copy(standing = StancePoint.Origin, severed = false), targetLabel = "@ada")
        compose.onNodeWithText("You've walked @ada back to nothing.", substring = true, useUnmergedTree = true)
            .assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_standing").assertContentDescriptionEquals(
            "Current opinion: Says nothing, For or against +0.00, How much reaches you +0.00",
        )
        compose.onNodeWithText("Current opinion", useUnmergedTree = true).assertExists()
    }

    @Test
    fun aStandingWithOneNumberAtZeroThinksAndSpeaksItsState() {
        show(open.copy(standing = StancePoint(0.0, 0.35)))
        compose.onNodeWithTag("${TAG}_stance_standing").assertContentDescriptionEquals(
            "Current opinion: Interested, no side taken, For or against +0.00, How much reaches you +0.35",
        )
    }

    @Test
    fun aPickWithOneNumberAtZeroThinksNeverReadsNice() {
        // The bug: the big face read 🙂 "Nice" at (+0.10, 0.00) while the
        // landing beneath it thought.
        show(open.copy(pick = StancePoint(0.1, 0.0), standing = heldStanding))
        compose.onNodeWithTag("${TAG}_stance_readout").assertContentDescriptionEquals(
            "Your pick: For it, no interest either way, For or against +0.10, How much reaches you +0.00",
        )
    }

    @Test
    fun aPickOfNothingSaysNothing() {
        show(open.copy(pick = StancePoint.Origin, standing = null))
        compose.onNodeWithTag("${TAG}_stance_readout").assertContentDescriptionEquals(
            "Your pick: Says nothing, For or against +0.00, How much reaches you +0.00",
        )
    }

    @Test
    fun theFaceOnTheTargetNamesWhichZeroItIs() {
        show(StanceControlState(standing = StancePoint.Origin, severed = true), targetLabel = "@ada")
        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionContains(
            "Your opinion on @ada: Walked back, +0.00 / +0.00.",
            substring = true,
        )
    }

    @Test
    fun theFaceOnTheTargetOverAnEmptySignSaysNothing() {
        show(StanceControlState(standing = StancePoint.Origin, severed = false), targetLabel = "@ada")
        compose.onNodeWithText("🤷", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionContains(
            "Your opinion on @ada: Says nothing, +0.00 / +0.00.",
            substring = true,
        )
    }

    @Test
    fun aTopicsWalkedBackFaceSpeaksItsFamilysWord() {
        show(
            StanceControlState(standing = StancePoint.Origin, severed = true),
            zeroWords = StanceZeroWords.Disconnected,
            targetLabel = "#saltmaps",
        )
        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionContains(
            "Your opinion on #saltmaps: No opinion, +0.00 / +0.00.",
            substring = true,
        )
    }

    @Test
    fun theFaceOnTheTargetThinksAtOneZero() {
        show(StanceControlState(standing = StancePoint(-0.4, 0.0)), targetLabel = "@ada")
        compose.onNodeWithText("🤔", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("${TAG}_stance").assertContentDescriptionContains(
            "Your opinion on @ada: Against it, no interest either way, −0.40 / +0.00.",
            substring = true,
        )
    }

    // -- The empty sign's ask (PadStanding.md:71; EmptySignConfirm) --

    @Test
    fun theEmptySignsAskStandsOverTheParkedPadAndAnswersBothWays() {
        show(open.copy(pick = StancePoint.Origin, emptySign = EmptySignPrompt()), targetLabel = "@ada")
        compose.onNodeWithTag("${TAG}_empty_sign_title").assertTextEquals("Sign an empty opinion?")
        compose.onNodeWithTag("${TAG}_severance").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_empty_sign_body")
            .assertTextEquals("This says nothing about @ada, shapes no feed, and leaves you where you are.")
        compose.onNodeWithTag("${TAG}_empty_sign_confirm").performClick()
        assertThat(emptySigned).isEqualTo(1)
        compose.onNodeWithTag("${TAG}_empty_sign_keep").performClick()
        assertThat(emptyKept).isEqualTo(1)
    }

    @Test
    fun aControlThatVouchesInWarnsHarderOnItsEmptySign() {
        show(
            open.copy(pick = StancePoint.Origin, emptySign = EmptySignPrompt()),
            targetLabel = "@rafa",
            vouchesIn = true,
        )
        compose.onNodeWithTag("${TAG}_empty_sign_body").assertTextEquals(
            "@rafa would be vouched in but start out cut off: no feed can carry them, and community funds " +
                "stay closed to them, until someone gives them an opinion that says something.",
        )
    }

    @Test
    fun anUnknownLandingSaysAddingItUp() {
        show(open.copy(landing = null))
        compose.onNodeWithTag("${TAG}_stance_landing").assertTextEquals("Adding it up…")
    }

    @Test
    fun aLandingOnZeroReadsTakesYouBackToZero() {
        show(open.copy(landing = StanceLanding(StancePoint.Origin, true, true, true)))
        compose.onNodeWithTag("${TAG}_stance_landing").assertTextEquals("This takes you back to zero.")
    }

    @Test
    fun aTopicsLandingOnZeroReadsAsNoOpinion() {
        show(
            open.copy(landing = StanceLanding(StancePoint.Origin, true, true, true)),
            zeroWords = StanceZeroWords.Disconnected,
        )
        compose.onNodeWithTag("${TAG}_stance_landing").assertTextEquals("This leaves you with no opinion towards it.")
    }

    // PadStanding.md:53, :55.
    @Test
    fun aOneZeroLandingReadsItsStateUnderTheThinkingFaceAndTheFaceExplainsInPlace() {
        show(open.copy(landing = StanceLanding(StancePoint(0.0, 0.4), true, false, false)), targetLabel = "@mira")
        compose.onNodeWithText(
            "Interested, no side taken — this won't shape anyone's feed.",
            useUnmergedTree = true,
        ).assertExists()
        compose.onNodeWithText("🤷", useUnmergedTree = true).assertDoesNotExist()

        compose.onNodeWithTag("${TAG}_stance_landing_zero", useUnmergedTree = true)
            .assertContentDescriptionEquals("Interested, no side taken")
            .performClick()
        compose.onNodeWithText("It still counts among your opinions — @mira stays under Your people.").assertExists()
        compose.onNodeWithText("It shapes no one's feed, earns nothing, and nothing passes on through you.")
            .assertExists()
        compose.onNodeWithText(
            "Walk it back is different: its own act, confirmed and paid for, that leaves a clean slate.",
        )
            .assertExists()
        compose.field().assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_set").assertIsNotEnabled()
        compose.onNodeWithTag("${TAG}_stance_explain_back").performScrollTo().performClick()
        compose.field().assertExists()
    }

    @Test
    fun theUnreachableHeadFollowsTheSignOfTheNumberThatStands() {
        val heads = listOf(
            StanceLanding(StancePoint(0.0, -0.4), true, false, false) to "Rather not see it, no side taken",
            StanceLanding(StancePoint(0.4, 0.0), false, true, false) to "For it, no interest either way",
            StanceLanding(StancePoint(-0.4, 0.0), false, true, false) to "Against it, no interest either way",
        )
        var landing by mutableStateOf(heads.first().first)
        showLive { open.copy(landing = landing) }
        for ((next, head) in heads) {
            landing = next
            compose.onNodeWithText("$head — this won't shape anyone's feed.", useUnmergedTree = true).assertExists()
        }
    }

    @Test
    fun aBorrowingReaderIsWarnedUnderAnUnreachableOrSeveredLandingOnly() {
        val unreachable = StanceLanding(StancePoint(0.0, 0.4), true, false, false)
        val severed = StanceLanding(StancePoint.Origin, true, true, true)
        val live = StanceLanding(StancePoint(0.3, 0.4), false, false, false)
        var landing by mutableStateOf(unreachable)
        showLive { open.copy(landing = landing, borrowed = true) }
        compose.onNodeWithTag("${TAG}_stance_landing_borrowed")
            .assertTextEquals("You'd keep your borrowed view — no feed of your own yet.")
        landing = severed
        compose.onNodeWithTag("${TAG}_stance_landing_borrowed").assertExists()
        landing = live
        compose.onNodeWithTag("${TAG}_stance_landing_borrowed").assertDoesNotExist()
    }

    // -- The field (StancePad.jsx; PadStanding.md:27-33) --

    @Test
    fun theFourPoleWordsStandOutsideTheField() {
        show(open)
        val square = compose.field().fetchSemanticsNode().boundsInRoot
        for (word in listOf("Against", "For", "Less", "More")) {
            val bounds = compose.onNodeWithText(word, useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
            assertThat(square.overlaps(bounds)).isFalse()
        }
    }

    @Test
    fun theAffinityFieldNamesItsOwnFourEnds() {
        show(open, axes = StanceAxes.Affinity)
        for (word in listOf("Dislike", "Like", "Far away", "Close to me")) {
            compose.onNodeWithText(word, useUnmergedTree = true).assertExists()
        }
        compose.onNodeWithText("Against", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theFieldIsTheMastersSquareInsideItsGutters() {
        show(open)
        val side = compose.field().fetchSemanticsNode().size
        val expected = with(compose.density) { FIELD_SIZE.toPx() }
        // Laid out in whole pixels: within one of the derived side.
        assertThat(side.width.toFloat()).isWithin(1f).of(expected)
        assertThat(side.height.toFloat()).isWithin(1f).of(expected)
    }

    @Test
    fun theFieldNamesItsAxesAndReadsThePickToAScreenReader() {
        show(open.copy(pick = StancePoint(0.4, 0.2)))
        compose.field().assertContentDescriptionEquals("For or against, How much reaches you")
            .assert(
                SemanticsMatcher.expectValue(
                    SemanticsProperties.StateDescription,
                    "For or against +0.40, How much reaches you +0.20",
                ),
            )
    }

    @Test
    fun theTappedPadOpensAtTheDefault() {
        showHolding()
        compose.onNodeWithTag("${TAG}_stance").performClick()
        compose.exactPair().assertTextEquals("+0.10 / +0.10")
        compose.onNodeWithTag("${TAG}_stance_set").performScrollTo().performClick()
        assertThat(committedPick).isEqualTo(StancePoint(0.1, 0.1))
    }

    @Test
    fun driftingMapsValenceAcrossAndConnectionUp() {
        showHolding()
        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent / 2f, -extent / 4f))
        val last = picks.last()
        assertThat(last.directed).isWithin(0.02).of(0.6)
        assertThat(last.interest).isWithin(0.02).of(0.35)
    }

    @Test
    fun theReleaseParksThePickOnTheNearestHundredth() {
        showHolding()
        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(((0.4371 - 0.1) * extent).toFloat(), ((0.1 + 0.003) * extent).toFloat()))
        assertThat(picks.last()).isEqualTo(StancePoint(0.44, 0.0))
        compose.exactPair().assertTextEquals("+0.44 / +0.00")
    }

    @Test
    fun releasingADriftedThumbParksThePadAndSignsNothing() {
        showHolding()
        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent / 2f, -extent / 4f))
        assertThat(committed).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
        compose.onNodeWithTag("${TAG}_stance_pad").assertExists()
    }

    @Test
    fun aFreshDragOnTheParkedFieldMovesTheKnobFromWhereItStood() {
        showHolding()
        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent / 2f, 0f))
        compose.exactPair().assertTextEquals("+0.60 / +0.10")
        dragTheField(Offset(-extent / 4f, -extent / 2f))
        compose.exactPair().assertTextEquals("+0.35 / +0.60")
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun aTapOnTheFieldWithoutDraggingNeverMovesThePick() {
        showHolding()
        compose.onNodeWithTag("${TAG}_stance").performClick()
        compose.field().performTouchInput { click(center + Offset(extent / 2f, extent / 2f)) }
        assertThat(picks).isEmpty()
    }

    @Test
    fun theSquareStaysReachableAndTravelBeyondItClamps() {
        showHolding()
        compose.onNodeWithTag("${TAG}_stance").performClick()
        dragTheField(Offset(extent * 1.4f, -extent * 1.4f))
        assertThat(picks.last()).isEqualTo(StancePoint(1.0, 1.0))
    }

    @Test
    fun noDragAnywhereEverPutsTheKnobOutsideTheDrawnField() {
        showHolding()
        val half = with(compose.density) { (FIELD_SIZE / 2).toPx() }
        val corner = with(compose.density) { FIELD_CORNER.toPx() }
        val knob = with(compose.density) { KNOB_RADIUS.toPx() }
        compose.onNodeWithTag("${TAG}_stance").performClick()
        compose.field().performTouchInput {
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
    fun aFreshDragOnTheParkedFieldNeverReachesTheSurfaceUnderneath() {
        showInsideAClickableCard(open)
        dragTheField(Offset(extent / 3f, -extent / 3f))
        assertThat(picks).isNotEmpty()
        assertThat(underneath).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
    }

    @Test
    fun aPadMidSignatureTakesNoFurtherDrags() {
        show(open.copy(busy = true))
        dragTheField(Offset(extent / 3f, -extent / 3f))
        assertThat(picks).isEmpty()
    }

    // -- The commit row (PadStanding.md:23-25; StanceControl.jsx:784-828) --

    @Test
    fun withSomethingStandingTheRowIsWalkItBackLeftThenCancelAndSetRight() {
        show(open.copy(standing = heldStanding))
        val sever = compose.onNodeWithTag("${TAG}_stance_sever").fetchSemanticsNode().boundsInRoot
        val cancel = compose.onNodeWithTag("${TAG}_stance_cancel").fetchSemanticsNode().boundsInRoot
        val set = compose.onNodeWithTag("${TAG}_stance_set").fetchSemanticsNode().boundsInRoot
        // One row: the three share a line.
        assertThat(sever.center.y).isWithin(2f).of(set.center.y)
        assertThat(cancel.center.y).isWithin(2f).of(set.center.y)
        // Walk it back on the left, pushed away; Cancel then Set on the right.
        assertThat(sever.right).isLessThan(cancel.left)
        assertThat(cancel.right).isAtMost(set.left)
        compose.onNodeWithTag("${TAG}_stance_sever").assertTextEquals("Walk it back")
        compose.onNodeWithTag("${TAG}_stance_cancel").assertTextEquals("Cancel")
        compose.onNodeWithTag("${TAG}_stance_set").assertTextEquals("Set")
    }

    @Test
    fun withNothingSignedThereIsNoWalkItBack() {
        show(open.copy(standing = null))
        compose.onNodeWithTag("${TAG}_stance_sever").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_cancel").assertExists()
        compose.onNodeWithTag("${TAG}_stance_set").assertExists()
    }

    @Test
    fun theRowsThreeControlsActAndNothingElseIsDrawn() {
        show(open.copy(standing = heldStanding))
        compose.onNodeWithTag("${TAG}_stance_sever").performScrollTo().performClick()
        assertThat(severOpened).isEqualTo(1)
        compose.onNodeWithTag("${TAG}_stance_cancel").performScrollTo().performClick()
        assertThat(dismissed).isEqualTo(1)
        compose.onNodeWithTag("${TAG}_stance_set").performScrollTo().performClick()
        assertThat(committed).isEqualTo(1)
        // The retired in-pad toggle is gone: the non-drag door is the action.
        compose.onNodeWithText("Set exact values").assertDoesNotExist()
    }

    @Test
    fun aTopicsWayOutReadsDisconnect() {
        show(open.copy(standing = heldStanding), zeroWords = StanceZeroWords.Disconnected)
        compose.onNodeWithTag("${TAG}_stance_sever").assertTextEquals("Disconnect")
    }

    // PadStanding.md:45-47.
    @Test
    fun setWaitsWithoutDimmingAndReadsSettingPast200ms() {
        compose.mainClock.autoAdvance = false
        show(open.copy(busy = true))
        compose.mainClock.advanceTimeBy(SETTING_AFTER_MS - 50)
        compose.onNodeWithTag("${TAG}_stance_set").assertTextEquals("Set").assertIsEnabled()
        compose.mainClock.advanceTimeBy(100)
        compose.onNodeWithTag("${TAG}_stance_set").assertTextEquals("Setting…").assertIsEnabled().performClick()
        assertThat(committed).isEqualTo(0)
    }

    // PadStanding.md:63; PadFailed.md.
    @Test
    fun aSigningThatDidNotGoThroughKeepsThePadWithTheFaultAndRetry() {
        show(open.copy(failed = true))
        compose.onNodeWithTag("${TAG}_stance_failed").assertTextEquals("That didn't send. Try again.")
        compose.onNodeWithTag("${TAG}_stance_set").assertTextEquals("Retry").performScrollTo().performClick()
        assertThat(committed).isEqualTo(1)
        val fault = compose.onNodeWithTag("${TAG}_stance_failed").fetchSemanticsNode().boundsInRoot
        val set = compose.onNodeWithTag("${TAG}_stance_set").fetchSemanticsNode().boundsInRoot
        assertThat(fault.bottom).isAtMost(set.top)
    }

    // -- The `?` (PadStanding.md:41-43) --

    @Test
    fun theQuestionMarkIsNamedHowOpinionsWork() {
        show(open)
        compose.onNodeWithTag("${TAG}_stance_explain").assertContentDescriptionEquals("How opinions work")
        val ring = compose.onNodeWithTag("${TAG}_stance_explain").fetchSemanticsNode().size
        assertThat(ring.width).isEqualTo(with(compose.density) { 48.dp.roundToPx() })
    }

    @Test
    fun theHelpReplacesTheBodyInPlaceAndSetIsDisabledWhileItShows() {
        show(open.copy(standing = heldStanding))
        compose.onNodeWithTag("${TAG}_stance_explain").performClick()
        compose.onNodeWithText(
            "Drag the knob. Left to right is against to for; bottom to top is how much more of it you want " +
                "reaching you.",
        ).assertExists()
        compose.onNodeWithText("Letting go changes nothing. Set signs it, Cancel leaves without signing.")
            .assertExists()
        compose.onNodeWithText("Your pick adds to what you've said before — that's why the two faces can differ.")
            .assertExists()
        compose.onNodeWithText(
            "Walk it back takes everything you've said to nothing. It has its own confirmation, and each thing " +
                "you've said is walked back by its own signature.",
        ).assertExists()
        // The readouts above stay; the field and the landing give way.
        compose.onNodeWithTag("${TAG}_stance_readout").assertExists()
        compose.field().assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_set").assertIsNotEnabled()

        compose.onNodeWithTag("${TAG}_stance_explain_back").performScrollTo().assertTextEquals("Back to the pad")
            .performClick()
        compose.field().assertExists()
        compose.onNodeWithTag("${TAG}_stance_set").assertIsEnabled()
    }

    @Test
    fun aTopicsFourthHelpLineIsItsOwn() {
        show(open, zeroWords = StanceZeroWords.Disconnected)
        compose.onNodeWithTag("${TAG}_stance_explain").performClick()
        compose.onNodeWithText(
            "Disconnect takes everything you've said about the topic to nothing. It has its own confirmation, " +
                "and each thing you've said is cleared by its own signature.",
        ).assertExists()
    }

    // -- Teaching (VouchBackPad.md:15-19) --

    @Test
    fun theFirstOpenCarriesTheTwoCoachingLinesBetweenTheFieldAndTheLanding() {
        show(open.copy(coaching = true))
        compose.onNodeWithText(
            "Later, tap the small face under a post to open this — press and hold it instead and a gentle 🙂 " +
                "is signed on the spot.",
            useUnmergedTree = true,
        ).assertContentDescriptionEquals(
            "Later, tap the small face under a post to open this — press and hold it instead and a gentle " +
                "Nice, For or against +0.10, How much reaches you +0.10 is signed on the spot.",
        )
        compose.onNodeWithText(
            "Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.",
            useUnmergedTree = true,
        ).assertExists()
        val field = compose.field().fetchSemanticsNode().boundsInRoot
        val coaching = compose.onNodeWithTag("${TAG}_stance_coaching", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        val landing = compose.onNodeWithTag("${TAG}_stance_landing").fetchSemanticsNode().boundsInRoot
        assertThat(coaching.top).isAtLeast(field.bottom)
        assertThat(landing.top).isAtLeast(coaching.bottom)
    }

    @Test
    fun theCoachingsExactPairShowsOnlyInGeekMode() {
        show(open.copy(coaching = true), geek = true)
        compose.onNodeWithText(
            "Later, tap the small face under a post to open this — press and hold it instead and a gentle 🙂 " +
                "(+0.10 / +0.10) is signed on the spot.",
            useUnmergedTree = true,
        ).assertExists()
    }

    @Test
    fun aLaterOpenCarriesNoCoaching() {
        show(open.copy(coaching = false))
        compose.onNodeWithTag("${TAG}_stance_coaching", useUnmergedTree = true).assertDoesNotExist()
    }

    // -- The transient confirmation (PadStanding.md:51) --

    private fun showLiveConfirmation(host: SnackbarHostState, signed: StancePoint?, walkedBack: Int? = null) {
        compose.setContent {
            var confirmation by remember { mutableStateOf(signed) }
            var gone by remember { mutableStateOf(walkedBack) }
            CompositionLocalProvider(LocalSnackbarHostState provides host) {
                Box(Modifier.fillMaxSize()) {
                    StanceControl(
                        state = StanceControlState(
                            standing = signed,
                            confirmation = confirmation,
                            walkedBack = gone,
                        ),
                        onHoldDefault = {}, onOpenPad = {}, onPick = {}, onCommit = {},
                        onDismissPad = {}, onOpenAlternates = {},
                        onOpenSeverance = {}, onConfirmSeverance = {}, onDismissSeverance = {},
                        onConfirmationShown = {
                            confirmationsShown++
                            confirmation = null
                            gone = null
                        },
                        testTagPrefix = TAG,
                        targetLabel = "@ada",
                    )
                    SnackbarHost(host, modifier = Modifier.testTag("host"))
                }
            }
        }
    }

    @Test
    fun aSignedOpinionConfirmsWithItsFaceAndSpeaksItsWords() {
        val host = SnackbarHostState()
        showLiveConfirmation(host, StancePoint(0.1, 0.1))
        compose.waitForIdle()
        val visuals = host.currentSnackbarData?.visuals as SpokenSnackbarVisuals
        assertThat(visuals.message).isEqualTo("Signed, still settling. Current opinion 🙂")
        assertThat(visuals.spoken).isEqualTo(
            "Signed, still settling. Current opinion: Nice, For or against +0.10, How much reaches you +0.10",
        )
        assertThat(confirmationsShown).isEqualTo(1)
    }

    @Test
    fun consumingTheOneShotDoesNotTearDownTheSnackbarItJustPosted() {
        val host = SnackbarHostState()
        showLiveConfirmation(host, StancePoint(0.1, 0.1))
        compose.waitForIdle()
        compose.mainClock.advanceTimeBy(500)
        compose.waitForIdle()
        assertThat(confirmationsShown).isEqualTo(1)
        assertThat(host.currentSnackbarData).isNotNull()
    }

    @Test
    fun aWalkBackConfirmsInItsSentence() {
        val host = SnackbarHostState()
        showLiveConfirmation(host, null, walkedBack = 3)
        compose.waitForIdle()
        assertThat(host.currentSnackbarData?.visuals?.message)
            .isEqualTo("Signed 3 things, still settling. You've walked @ada back to nothing.")
    }

    @Test
    fun aPickThatWalkedTheBundleBackConfirmsAsTheWalkBackOfOneThing() {
        val host = SnackbarHostState()
        showLiveConfirmation(host, null, walkedBack = 1)
        compose.waitForIdle()
        assertThat(host.currentSnackbarData?.visuals?.message)
            .isEqualTo("Signed, still settling. You've walked @ada back to nothing.")
    }

    @Test
    fun anEmptySignConfirmsWithTheOrdinaryLineNeverTheWalkBack() {
        // jakob 2026-10-21: "the snackbar must not be something special."
        val host = SnackbarHostState()
        showLiveConfirmation(host, StancePoint.Origin)
        compose.waitForIdle()
        val visuals = host.currentSnackbarData?.visuals as SpokenSnackbarVisuals
        assertThat(visuals.message).isEqualTo("Signed, still settling. Current opinion 🤷")
        assertThat(visuals.spoken).isEqualTo(
            "Signed, still settling. Current opinion: Says nothing, For or against +0.00, How much reaches you +0.00",
        )
    }

    @Test
    fun aConfirmationWithOneNumberAtZeroThinks() {
        val host = SnackbarHostState()
        showLiveConfirmation(host, StancePoint(0.0, 0.2))
        compose.waitForIdle()
        val visuals = host.currentSnackbarData?.visuals as SpokenSnackbarVisuals
        assertThat(visuals.message).isEqualTo("Signed, still settling. Current opinion 🤔")
        assertThat(visuals.spoken).isEqualTo(
            "Signed, still settling. Current opinion: Interested, no side taken, For or against +0.00, " +
                "How much reaches you +0.20",
        )
    }

    @Test
    fun noConfirmationMeansNoSnackbarAndNothingConsumed() {
        show(StanceControlState(standing = StancePoint(0.1, 0.1)))
        assertThat(confirmationsShown).isEqualTo(0)
    }

    // -- The notices (PadWriteRule.md, PadKeyAbsent.md) --

    @Test
    fun theWriteRulesNoticeStandsWhereTheLandingAndCommitRowWere() {
        show(open.copy(writeRule = true, standing = heldStanding))
        compose.onNodeWithText("You can't sign right now").assertExists()
        compose.onNodeWithText(
            "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent.",
        ).assertExists()
        compose.onNodeWithTag("${TAG}_stance_set").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_cancel").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_sever").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_landing").assertDoesNotExist()
        compose.field().assertExists()
        compose.onNodeWithTag("${TAG}_stance_not_now").assertTextEquals("Not now").performScrollTo().performClick()
        assertThat(dismissed).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
    }

    @Test
    fun theWriteRulesQuestionMarkOpensWhySigningWaits() {
        show(open.copy(writeRule = true))
        compose.onNodeWithTag("${TAG}_stance_write_rule_help").performScrollTo().performClick()
        compose.onNodeWithText("Why signing waits").assertExists()
        compose.onNodeWithText("Nothing was signed or spent. Try again in a little while.").assertExists()
    }

    @Test
    fun aRefusedHoldSaysSoQuietlyWithNoRetry() {
        show(StanceControlState(standing = heldStanding, writeRule = true))
        compose.onNodeWithTag("${TAG}_stance_row").assertTextEquals("You can't sign right now.")
        compose.onNodeWithTag("${TAG}_stance_row_retry", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun withTheKeyElsewhereThePadCarriesTheKeyNoticeAndNoActions() {
        var restored = 0
        compose.setContent {
            CompositionLocalProvider(LocalOnRestoreKey provides { restored++ }) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    StanceControl(
                        state = open.copy(keyAbsent = true, standing = heldStanding),
                        onHoldDefault = {}, onOpenPad = {}, onPick = {}, onCommit = { committed++ },
                        onDismissPad = {}, onOpenAlternates = {},
                        onOpenSeverance = {}, onConfirmSeverance = {}, onDismissSeverance = {},
                        onConfirmationShown = {},
                        testTagPrefix = TAG,
                    )
                }
            }
        }
        compose.onNodeWithText("Your key isn't in this app").assertExists()
        compose.onNodeWithText("Signing needs your key, which isn't in this app — the write waits as pending.")
            .assertExists()
        compose.onNodeWithText("Restore the key with your recovery code to finish.").assertExists()
        compose.onNodeWithTag("${TAG}_stance_set").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_cancel").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_sever").assertDoesNotExist()
        compose.field().assertExists()
        compose.onNodeWithTag("${TAG}_stance_restore_key").performScrollTo().performClick()
        assertThat(restored).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
    }

    // -- The alternates (StanceAlternates.jsx; stance-control.md *Alternate and accessible inputs*) --

    private val alternates = StanceControlState(pad = StancePadMode.ALTERNATES, pick = StancePoint(0.1, 0.1))

    @Test
    fun theAlternatesAreTheirOwnDialogNotThePad() {
        show(alternates.copy(standing = heldStanding))
        compose.onNodeWithTag("${TAG}_stance_alternates").assertExists()
        compose.onNodeWithText("Choose your opinion").assertExists()
        compose.onNodeWithTag("${TAG}_stance_pad").assertDoesNotExist()
        compose.field().assertDoesNotExist()
    }

    @Test
    fun slidersLeadWithTheirPolesAndTypedValuesAreOneTapAway() {
        show(alternates)
        compose.onNodeWithTag("${TAG}_stance_slider_directed").assertContentDescriptionEquals("For or against")
        compose.onNodeWithTag("${TAG}_stance_slider_interest").assertContentDescriptionEquals("How much reaches you")
        for (word in listOf("Against", "For", "Less", "More")) {
            compose.onNodeWithText(word, useUnmergedTree = true).assertExists()
        }
        compose.onNodeWithTag("${TAG}_stance_entry_directed").assertDoesNotExist()

        compose.onNodeWithTag("${TAG}_stance_alternates_swap").assertTextEquals("Type exact values").performClick()
        compose.onNodeWithTag("${TAG}_stance_entry_directed").assertExists()
        compose.onNodeWithTag("${TAG}_stance_slider_directed").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_alternates_swap").assertTextEquals("Use sliders")
    }

    @Test
    fun aReaderWhoChoseTypedValuesMeetsTheFieldsFirst() {
        show(alternates.copy(inputMode = StanceInputSurface.ENTRY))
        compose.onNodeWithTag("${TAG}_stance_entry_directed").assertExists()
        compose.onNodeWithTag("${TAG}_stance_slider_directed").assertDoesNotExist()
    }

    @Test
    fun theAlternatesRowIsWalkItBackCancelAndSignIt() {
        show(alternates.copy(standing = heldStanding))
        compose.onNodeWithTag("${TAG}_stance_set").assertTextEquals("Sign it").performClick()
        assertThat(committed).isEqualTo(1)
        compose.onNodeWithTag("${TAG}_stance_sever").assertTextEquals("Walk it back").performClick()
        assertThat(severOpened).isEqualTo(1)
        compose.onNodeWithTag("${TAG}_stance_cancel").performClick()
        assertThat(dismissed).isEqualTo(1)
    }

    @Test
    fun theAlternatesHelpTeachesTwoValuesNotOne() {
        show(alternates)
        compose.onNodeWithTag("${TAG}_stance_alternates_help").assertContentDescriptionEquals("How opinions work")
            .performClick()
        compose.onNodeWithText(
            "Two values, not one. The first is whether you're for or against it; the second is how much more " +
                "of it you want reaching you.",
        ).assertExists()
        compose.onNodeWithText("Nothing is signed until you press Sign it.").assertExists()
    }

    @Test
    fun theAffinityAlternatesAskTheirOwnQuestions() {
        show(alternates, axes = StanceAxes.Affinity)
        compose.onNodeWithTag("${TAG}_stance_slider_directed").assertContentDescriptionEquals("How much you like it")
        compose.onNodeWithTag("${TAG}_stance_slider_interest")
            .assertContentDescriptionEquals("How close you want to be")
    }

    // -- The masters' words are the strings (design-master parity) --

    @Test
    fun thePadsWordsAreTheMasters() {
        val readout = java.io.File("../../../design/components/stance/StanceReadout.jsx").readText()
        val control = java.io.File("../../../design/components/stance/StanceControl.jsx").readText()
        val strings = java.io.File("src/main/res/values/strings.xml").readText().replace("\\'", "'")
        fun string(name: String) =
            Regex("<string name=\"$name\">([^<]+)</string>").find(strings)!!.groupValues[1]
        assertThat(readout).contains("\"${string("stance_resulting")}\"")
        assertThat(readout).contains("\"${string("stance_current")}\"")
        assertThat(readout).contains("export const PICK_LABEL = \"${string("stance_pick")}\";")
        assertThat(readout).contains("export const DIRECTED_LABEL = \"${string("stance_axis_directed")}\";")
        assertThat(readout).contains("export const INTEREST_LABEL = \"${string("stance_axis_interest")}\";")
        assertThat(readout).contains("\"${string("stance_explain_field")}\"")
        assertThat(readout).contains("\"${string("stance_explain_commit")}\"")
        assertThat(readout).contains("\"${string("stance_explain_adds")}\"")
        assertThat(readout).contains("help: \"${string("stance_severance_help")}\"")
        assertThat(readout).contains("landing: \"${string("stance_severance_reached")}\"")
        assertThat(readout).contains("return { sentence: \"${string("stance_landing_working")}\" }")
        // The commit's own words: Set, and Retry in its slot after a failure.
        assertThat(control).contains("\"${string("stance_retry")}\" : \"${string("stance_set")}\"}")
        assertThat(control).contains("helpLabel = \"${string("stance_explain")}\"")
        assertThat(control).contains("\"${string("stance_pad_failed")}\"")
        for (head in listOf(
            "Interested, no side taken",
            "Rather not see it, no side taken",
            "For it, no interest either way",
            "Against it, no interest either way",
        )) {
            assertThat(readout).contains("\"$head\"")
            assertThat(strings).contains(">$head</string>")
        }
        val tail = Regex("export const UNREACHABLE_TAIL = \"([^\"]+)\";").find(readout)!!.groupValues[1]
        assertThat(string("stance_unreachable_tail")).isEqualTo(tail)
        val kept = Regex("export const BORROWED_KEPT_LINE = \"([^\"]+)\";").find(readout)!!.groupValues[1]
        assertThat(string("stance_borrowed_kept")).isEqualTo(kept)
    }

    @Test
    fun thePadsGeometryIsTheMasters() {
        val pad = java.io.File("../../../design/components/stance/StancePad.jsx").readText()
        val control = java.io.File("../../../design/components/stance/StanceControl.jsx").readText()
        assertThat(pad).contains("export const AXIS_GUTTER_X_PX = ${PAIR_GUTTER_X.value.toInt()};")
        assertThat(pad).contains("export const AXIS_GUTTER_Y_PX = ${PAIR_GUTTER_Y.value.toInt()};")
        assertThat(pad).contains("export const KNOB_DIAMETER_PX = ${(KNOB_RADIUS * 2).value.toInt()};")
        assertThat(pad).contains("export const FIELD_CORNER_RADIUS_PX = ${FIELD_CORNER.value.toInt()};")
        // 17rem at the 16px root.
        assertThat(control).contains("width: \"17rem\"")
        assertThat(PAD_WIDTH.value).isEqualTo(17f * 16f)
    }
}
