package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * THE HOLD'S WAIT TAKES NO ROOM (jakob via the design session, seam 355 "Your
 * 354"; his round 3 A23 — "the card just gets a bit more hight … for a brief
 * moment when it loads"): after a press-and-hold the ring that filled stays
 * closed around the face while the signing runs, no `Signing…` line stands
 * under the face, so the card never grows for the wait, and `Signing…` is
 * still spoken. A failure keeps its line — that growth is intended.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class HoldWaitTest {

    @get:Rule
    val compose = createComposeRule()

    private val standing = StancePoint(0.6, 0.35)
    private lateinit var settle: (StanceControlState.() -> StanceControlState) -> Unit

    private fun show() {
        compose.setContent {
            var state by remember { mutableStateOf(StanceControlState(standing = standing)) }
            settle = { change -> state = state.change() }
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
                    // What the holder does with a hold: the signing runs.
                    onHoldDefault = { state = state.copy(busy = true) },
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
                    modifier = Modifier.testTag(CONTROL),
                )
            }
        }
    }

    private fun height() = compose.onNodeWithTag(CONTROL, useUnmergedTree = true).fetchSemanticsNode().size.height

    private fun holdAndWait() {
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { longClick() }
        compose.mainClock.advanceTimeBy(PAST_THE_QUIET_MS)
    }

    @Test
    fun theHoldsWaitDrawsNoLineAndTheControlKeepsItsHeight() {
        show()
        val atRest = height()
        holdAndWait()
        compose.onNodeWithTag("${TAG}_stance_row").assertDoesNotExist()
        assertThat(height()).isEqualTo(atRest)
    }

    @Test
    fun theHoldsWaitIsStillSpoken() {
        show()
        holdAndWait()
        compose.onNodeWithContentDescription("Signing…", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theRingStaysClosedWhileTheHoldSignsAndGoesWhenItIsTaken() {
        show()
        holdAndWait()
        compose.onNodeWithTag("${TAG}_stance_ring", useUnmergedTree = true).assertExists()
        settle { copy(busy = false, standing = StancePoint(0.1, 0.1)) }
        compose.waitForIdle()
        compose.onNodeWithTag("${TAG}_stance_ring", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun aHoldThatFailsKeepsItsLineUnderTheFace() {
        show()
        holdAndWait()
        settle { copy(busy = false, failed = true) }
        compose.waitForIdle()
        compose.onNodeWithTag("${TAG}_stance_row").assertExists()
        compose.onNodeWithTag("${TAG}_stance_ring", useUnmergedTree = true).assertDoesNotExist()
    }

    private companion object {
        const val TAG = "card"
        const val CONTROL = "control"

        /** Well past the 200ms the row line waits before it speaks (RowSigning.md:5). */
        const val PAST_THE_QUIET_MS = 400L
    }
}
