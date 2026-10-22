package com.cogra.core.designsystem

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private const val TAG = "post"

/** The walk-back confirmation against its master (SeveranceConfirm.jsx; behavior/SeveranceConfirm.md). */
@RunWith(RobolectricTestRunner::class)
class SeveranceConfirmTest {

    @get:Rule
    val compose = createComposeRule()

    private var confirmed = 0
    private var dismissed = 0

    private fun show(
        prompt: SeverancePrompt,
        zeroWords: StanceZeroWords = StanceZeroWords.Severed,
        targetLabel: String? = "@ada",
    ) {
        compose.setContent {
            SeveranceConfirm(
                prompt = prompt,
                onConfirm = { confirmed++ },
                onDismiss = { dismissed++ },
                testTagPrefix = TAG,
                zeroWords = zeroWords,
                targetLabel = targetLabel,
            )
        }
    }

    private fun prompt(
        records: Int = 1,
        alreadySevered: Boolean = false,
        fromPick: Boolean = false,
        working: Boolean = false,
        failed: Boolean = false,
        standing: StancePoint = StancePoint(1.0, 1.0),
        raw: StancePoint = StancePoint(1.0, 1.0),
        pick: StancePoint? = null,
        bundleRecords: Int = 1,
    ) = SeverancePrompt(
        standing = standing,
        raw = raw,
        records = records,
        alreadySevered = alreadySevered,
        fromPick = fromPick,
        working = working,
        failed = failed,
        pick = pick,
        bundleRecords = bundleRecords,
    )

    /** Every line a tagged block draws, itself and its children, in order. */
    private fun text(tag: String) = compose
        .onAllNodes(hasTestTag(tag) or hasAnyAncestor(hasTestTag(tag)), useUnmergedTree = true)
        .fetchSemanticsNodes()
        .flatMap { it.config.getOrElse(SemanticsProperties.Text) { emptyList() } }
        .joinToString(" ") { it.text }

    @Test
    fun theDialogIsTitledWalkItAllBack() {
        show(prompt())
        compose.onNodeWithTag("${TAG}_severance_title").assertTextEquals("Walk it all back?")
    }

    @Test
    fun theConsequencesNameTheTarget() {
        show(prompt())
        compose.onNodeWithTag("${TAG}_severance_body").assertTextEquals(
            "Your opinion of @ada drops to nothing. It stops reaching your feed, you stop earning from it, " +
                "and nothing passes on through you.",
        )
    }

    @Test
    fun theRawTotalLeadsAndTheCapFollowsOnlyWhenTheTotalExceedsIt() {
        show(prompt(records = 2, standing = StancePoint(1.0, 0.85), raw = StancePoint(1.4, 0.85)))
        assertThat(text("${TAG}_severance_standing")).contains(
            "Everything you've said about @ada adds up to +1.40 / +0.85, and that is what this walks back.",
        )
        compose.onNodeWithTag("${TAG}_severance_capped", useUnmergedTree = true)
            .assertTextEquals("Your feed reads it capped at +1.00 / +0.85.")
    }

    @Test
    fun aTotalInsideTheCapCarriesNoCapLine() {
        show(prompt())
        compose.onNodeWithTag("${TAG}_severance_capped", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theCostIsCountedInThings() {
        show(prompt(records = 3))
        compose.onNodeWithTag("${TAG}_severance_cost").assertTextEquals("It signs 3 things, each paid separately.")
    }

    @Test
    fun aSingleThingIsCountedInTheSingular() {
        show(prompt(records = 1))
        compose.onNodeWithTag("${TAG}_severance_cost").assertTextEquals("It signs 1 thing, paid on its own.")
    }

    @Test
    fun aPickThatNetsToZeroCarriesItsPickLine() {
        show(prompt(fromPick = true, pick = StancePoint(-1.0, -1.0), standing = StancePoint(1.0, 1.0)))
        compose.onNodeWithTag("${TAG}_severance_from_pick")
            .assertTextEquals("Your pick: 💀 −1.00 / −1.00")
            .assertContentDescriptionEquals(
                "Your pick: Absolutely not, For or against −1.00, How much reaches you −1.00",
            )
    }

    // Faces follow the value (seam 243): the pick line wears the face every
    // pair wears, never the table at a zero.
    @Test
    fun aPickWithOneNumberAtZeroThinksAndNamesItsState() {
        show(prompt(fromPick = true, pick = StancePoint(0.0, 0.4), standing = StancePoint(0.0, -0.4)))
        compose.onNodeWithTag("${TAG}_severance_from_pick")
            .assertTextEquals("Your pick: 🤔 +0.00 / +0.40")
            .assertContentDescriptionEquals(
                "Your pick: Interested, no side taken, For or against +0.00, How much reaches you +0.40",
            )
    }

    @Test
    fun aPickOfNothingOverAnEmptySignsStandingSaysNothing() {
        // The one way a (0, 0) pick reaches this dialog: over a standing an
        // empty sign left at (0, 0). It says nothing, never `Walked back`.
        show(
            prompt(
                fromPick = true,
                pick = StancePoint.Origin,
                standing = StancePoint.Origin,
                raw = StancePoint.Origin,
                bundleRecords = 1,
            ),
        )
        compose.onNodeWithTag("${TAG}_severance_from_pick")
            .assertTextEquals("Your pick: 🤷 +0.00 / +0.00")
            .assertContentDescriptionEquals(
                "Your pick: Says nothing, For or against +0.00, How much reaches you +0.00",
            )
    }

    @Test
    fun anEmptySignsStandingStatesItsZeroTotalNeverNoOpinionYet() {
        // `severanceParts`: the sentence is for a bundle with no record, decided
        // by the count — an empty sign's (0, 0) is still something said.
        show(prompt(standing = StancePoint.Origin, raw = StancePoint.Origin, bundleRecords = 1))
        assertThat(text("${TAG}_severance_standing")).isEqualTo(
            "Everything you've said about @ada adds up to +0.00 / +0.00, and that is what this walks back.",
        )
    }

    @Test
    fun theBodysParagraphsStandTheDialogSurfacesSixteenApart() {
        // DialogSurface's body gap is `--space-4`.
        show(prompt())
        val body = compose.onNodeWithTag("${TAG}_severance_body").fetchSemanticsNode().boundsInRoot
        val total = compose.onNodeWithTag("${TAG}_severance_standing").fetchSemanticsNode().boundsInRoot
        val gap = with(compose.density) { (total.top - body.bottom).toDp() }
        assertThat(gap.value).isWithin(0.5f).of(16f)
    }

    @Test
    fun theRouteAloneShowsNoPickLine() {
        show(prompt(fromPick = false))
        compose.onNodeWithTag("${TAG}_severance_from_pick").assertDoesNotExist()
    }

    @Test
    fun theSafeAnswerIsKeepItAndTheWayOutIsWalkItBack() {
        show(prompt())
        compose.onNodeWithTag("${TAG}_severance_confirm").assertTextEquals("Walk it back").performClick()
        assertThat(confirmed).isEqualTo(1)
        compose.onNodeWithTag("${TAG}_severance_keep").assertTextEquals("Keep it").performClick()
        assertThat(dismissed).isEqualTo(1)
        // The safe answer holds the right-hand slot.
        val walk = compose.onNodeWithTag("${TAG}_severance_confirm").fetchSemanticsNode().boundsInRoot
        val keep = compose.onNodeWithTag("${TAG}_severance_keep").fetchSemanticsNode().boundsInRoot
        assertThat(keep.left).isAtLeast(walk.right)
    }

    @Test
    fun aBundleAlreadyAtNothingIsSaidSoAndCannotBeWalkedBackAgain() {
        show(
            prompt(
                records = 0,
                alreadySevered = true,
                standing = StancePoint.Origin,
                raw = StancePoint.Origin,
                bundleRecords = 0,
            ),
        )
        compose.onNodeWithTag("${TAG}_severance_already").assertTextEquals("You are already at nothing here.")
        compose.onNodeWithTag("${TAG}_severance_cost").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_severance_confirm").assertIsNotEnabled()
        assertThat(text("${TAG}_severance_standing")).isEqualTo("🤷 No opinion on @ada yet.")
    }

    @Test
    fun aWalkBackInFlightReadsWalkingItBackAndLocksTheWaysOutWithoutDimming() {
        compose.mainClock.autoAdvance = false
        show(prompt(working = true))
        compose.mainClock.advanceTimeBy(SETTING_AFTER_MS + 50)
        compose.onNodeWithTag("${TAG}_severance_confirm").assertTextEquals("Walking it back…").assertIsEnabled()
            .performClick()
        compose.onNodeWithTag("${TAG}_severance_keep").assertIsEnabled().performClick()
        assertThat(confirmed).isEqualTo(0)
        assertThat(dismissed).isEqualTo(0)
    }

    @Test
    fun aFailedWalkBackKeepsTheDialogWithTheFaultAndRetry() {
        show(prompt(failed = true))
        compose.onNodeWithTag("${TAG}_severance_failed").assertTextEquals("That didn't send. Try again.")
        compose.onNodeWithTag("${TAG}_severance_confirm").assertTextEquals("Retry").performClick()
        assertThat(confirmed).isEqualTo(1)
    }

    @Test
    fun theNumbersPaintInBothModes() {
        // The one exemption from geek mode (readme §13): no provider here, so
        // the reading is the default one — and the raw total is still drawn.
        show(prompt(raw = StancePoint(1.4, 0.85), standing = StancePoint(1.0, 0.85)))
        assertThat(text("${TAG}_severance_standing")).contains("+1.40 / +0.85")
    }

    // jakob's I2 ruling: a topic disconnects, never walks back.
    @Test
    fun aTopicSpeaksItsOwnFamilysWords() {
        show(prompt(raw = StancePoint(1.4, 0.95)), zeroWords = StanceZeroWords.Disconnected, targetLabel = "#saltmaps")
        compose.onNodeWithTag("${TAG}_severance_title").assertTextEquals("Disconnect from #saltmaps?")
        compose.onNodeWithTag("${TAG}_severance_body").assertTextEquals(
            "You end up with no opinion towards #saltmaps. It stops reaching your feed, " +
                "you stop earning from it, and nothing passes on through you.",
        )
        assertThat(text("${TAG}_severance_standing")).contains(
            "Everything you've said about #saltmaps adds up to +1.40 / +0.95, and disconnecting clears all of it.",
        )
        compose.onNodeWithTag("${TAG}_severance_confirm").assertTextContains("Disconnect")
    }

    @Test
    fun theDialogsWordsAreTheMasters() {
        val readout = java.io.File("../../../design/components/stance/StanceReadout.jsx").readText()
        val master = java.io.File("../../../design/components/stance/SeveranceConfirm.jsx").readText()
        assertThat(readout).contains("title: () => \"Walk it all back?\"")
        assertThat(readout).contains("busy: \"Walking it back…\"")
        assertThat(readout).contains("control: \"Walk it back\"")
        assertThat(master).contains("\"It signs 1 thing, paid on its own.\"")
        assertThat(master).contains("`It signs \${records} things, each paid separately.`")
        assertThat(master).contains("Your feed reads it capped at {read.folded}.")
        assertThat(master).contains("Keep it")
        assertThat(master).contains("bundleReadout(pick, EMPTY_PICK_LABEL)")
        assertThat(readout).contains("if (bundle === null || bundle.records === 0) {")
    }
}
