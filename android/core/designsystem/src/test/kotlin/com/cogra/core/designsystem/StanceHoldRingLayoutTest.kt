// THE HOLD'S RING TAKES NO ROOM (`StanceControl.jsx` `withHoldRing`: "the ring
// centred on it, the face's own box unchanged, so nothing beside it moves";
// hand test A18-1/2): a press or a hold on a card's face must not step the
// row's graph glyph and comment icon. Positions, never text widths.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "post"

@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class StanceHoldRingLayoutTest {

    @get:Rule
    val compose = createComposeRule()

    /** A card's action row as the feed lays it: the face, then the glyph and the comment icon. */
    private fun row(state: StanceControlState = StanceControlState()) {
        compose.setContent {
            Row {
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
                    testTagPrefix = TAG,
                )
                Box(Modifier.size(24.dp).testTag("glyph"))
                Box(Modifier.size(24.dp).testTag("comment"))
            }
        }
        compose.waitForIdle()
    }

    private fun siblings(): List<Rect> = listOf("${TAG}_stance", "glyph", "comment").map {
        compose.onNodeWithTag(it).fetchSemanticsNode().boundsInRoot
    }

    // A press under way: the ring is drawn from the first moment of the touch.
    @Test
    fun aPressOnTheFaceMovesNothingBesideIt() {
        row()
        val before = siblings()
        compose.mainClock.autoAdvance = false
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { down(center) }
        compose.mainClock.advanceTimeBy(HALF_A_HOLD_MS)
        assertThat(siblings()).isEqualTo(before)
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { up() }
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        assertThat(siblings()).isEqualTo(before)
    }

    // A hold run to its end, the ring full, then released: still nothing moved.
    @Test
    fun aHoldOnTheFaceMovesNothingBesideIt() {
        row()
        val before = siblings()
        compose.mainClock.autoAdvance = false
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { down(center) }
        compose.mainClock.advanceTimeBy(HALF_A_HOLD_MS)
        assertThat(siblings()).isEqualTo(before)
        compose.mainClock.advanceTimeBy(PAST_A_HOLD_MS)
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { up() }
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        assertThat(siblings()).isEqualTo(before)
    }

    // The same with a face standing, as on a card the reader has an opinion on.
    @Test
    fun aPressOnAStandingFaceMovesNothingBesideIt() {
        row(StanceControlState(standing = StancePoint(0.5, 0.5)))
        val before = siblings()
        compose.mainClock.autoAdvance = false
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { down(center) }
        compose.mainClock.advanceTimeBy(HALF_A_HOLD_MS)
        assertThat(siblings()).isEqualTo(before)
        compose.onNodeWithTag("${TAG}_stance").performTouchInput { up() }
        compose.mainClock.autoAdvance = true
    }

    private companion object {
        const val HALF_A_HOLD_MS = 200L
        const val PAST_A_HOLD_MS = 600L
    }
}
