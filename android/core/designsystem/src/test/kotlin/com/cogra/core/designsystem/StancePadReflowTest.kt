package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The pad is parked by its bottom edge, so any growth of its card moves its
 * top edge UP while Set is answering. Pressing Set puts the pad into
 * [StanceControlState.busy] and swaps Set's label; neither may change the
 * pad's height, or the pad lurches the instant the reader presses (jakob,
 * PR-57). The standing itself no longer moves while Set waits — the opinion
 * moves once the signature is taken (`StanceViewModelTest`) — but a holder
 * that did move it would still meet the same card.
 */
@RunWith(RobolectricTestRunner::class)
// A window tall enough that the pad is never clamped to it: a clamped card
// would measure the same height whatever its content did.
@Config(qualifiers = "w411dp-h891dp")
class StancePadReflowTest {

    @get:Rule
    val compose = createComposeRule()

    private val open = StanceControlState(pad = StancePadMode.STICKY, pick = StancePoint(0.1, 0.1))

    /** The pad's height before and after the reader presses Set. */
    private fun heights(
        before: StanceControlState,
        after: StanceControlState,
        axes: StanceAxes = StanceAxes.Opinion,
    ): Pair<Int, Int> {
        var state by mutableStateOf(before)
        compose.setContent {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
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
                    testTagPrefix = "post",
                    axes = axes,
                )
            }
        }
        compose.waitForIdle()
        val h0 = compose.onNodeWithTag("post_stance_pad").fetchSemanticsNode().size.height
        state = after
        compose.waitForIdle()
        val h1 = compose.onNodeWithTag("post_stance_pad").fetchSemanticsNode().size.height
        return h0 to h1
    }

    @Test
    fun pressingSetOnAHeldStandingDoesNotMoveThePad() {
        val held = open.copy(standing = StancePoint(0.6, 0.35))
        val (before, after) = heights(held, held.copy(standing = StancePoint(0.7, 0.45), busy = true))
        assertThat(after).isEqualTo(before)
    }

    @Test
    fun pressingSetOnANegativeFoldDoesNotMoveThePad() {
        val held = open.copy(standing = StancePoint(0.6, 0.35))
        val (before, after) = heights(held, held.copy(standing = StancePoint(-0.7, -0.45), busy = true))
        assertThat(after).isEqualTo(before)
    }

    @Test
    fun pressingSetUnderTheLongestAxisWordsDoesNotMoveThePad() {
        val held = open.copy(standing = StancePoint(0.6, 0.35))
        val (before, after) = heights(
            held,
            held.copy(standing = StancePoint(-0.7, -0.45), busy = true),
            axes = StanceAxes.Affinity,
        )
        assertThat(after).isEqualTo(before)
    }

    @Test
    fun theBusyLabelSwapAloneDoesNotMoveThePad() {
        val held = open.copy(standing = StancePoint(0.6, 0.35))
        val (before, after) = heights(held, held.copy(busy = true))
        assertThat(after).isEqualTo(before)
    }

    @Test
    fun theFirstOpinionLeavesTheRestingTargetItsHeight() {
        // The resting face swaps from the hollow face to the folded one in
        // the same frame; it may change width, never the row's height.
        var state by mutableStateOf(open.copy(pad = StancePadMode.CLOSED))
        compose.setContent {
            StanceControl(
                state = state,
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
                testTagPrefix = "post",
            )
        }
        compose.waitForIdle()
        val h0 = compose.onNodeWithTag("post_stance").fetchSemanticsNode().size.height
        state = state.copy(standing = StancePoint(0.1, 0.1), busy = true)
        compose.waitForIdle()
        val h1 = compose.onNodeWithTag("post_stance").fetchSemanticsNode().size.height
        assertThat(h1).isEqualTo(h0)
    }

    @Test
    fun theFirstOpinionLeavesTheVouchCardsLineFaceItsHeight() {
        // The vouch card's hollow face is the line face, a drawn glyph rather
        // than text: it must stand exactly as tall as the folded face that
        // replaces it, or the card's row jumps on the first stance.
        var state by mutableStateOf(open.copy(pad = StancePadMode.CLOSED))
        compose.setContent {
            StanceControl(
                state = state,
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
                testTagPrefix = "post",
                lineFaceInk = Color.Black,
            )
        }
        compose.waitForIdle()
        val h0 = compose.onNodeWithTag("post_stance").fetchSemanticsNode().size.height
        state = state.copy(standing = StancePoint(0.1, 0.1), busy = true)
        compose.waitForIdle()
        val h1 = compose.onNodeWithTag("post_stance").fetchSemanticsNode().size.height
        assertThat(h1).isEqualTo(h0)
    }

    @Test
    fun aHeldPadKeepsItsWalkAwayWhileSetIsAnswering() {
        val held = open.copy(standing = StancePoint(0.6, 0.35))
        heights(held, held.copy(standing = StancePoint(0.7, 0.45), busy = true))
        compose.onNodeWithTag("post_stance_sever").assertExists()
    }

    @Test
    fun theFirstOpinionGainsItsWalkAwayOnlyOnceSetHasAnswered() {
        val pending = open.copy(standing = StancePoint(0.1, 0.1), busy = true)
        var state by mutableStateOf(open)
        compose.setContent {
            StanceControl(
                state = state,
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
                testTagPrefix = "post",
            )
        }
        compose.waitForIdle()
        state = pending
        compose.waitForIdle()
        compose.onNodeWithTag("post_stance_sever").assertDoesNotExist()
        state = pending.copy(busy = false)
        compose.waitForIdle()
        compose.onNodeWithTag("post_stance_sever").assertExists()
    }

    @Test
    fun theMeasurementSeesGrowthWhenThereIsSome() {
        // The control: a fault line above the commit row DOES grow the
        // card, so the equalities above are not a measurement that cannot fail.
        val held = open.copy(standing = StancePoint(0.6, 0.35))
        val (before, after) = heights(held, held.copy(failed = true))
        assertThat(after).isGreaterThan(before)
    }
}
