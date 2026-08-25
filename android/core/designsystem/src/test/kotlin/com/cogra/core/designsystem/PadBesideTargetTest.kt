package com.cogra.core.designsystem

import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Where the pad opens (design.md §8.3): beside the resting target, never
 * under the press, and never off the screen. The rules are arithmetic, so
 * they are checked as arithmetic — including with the target parked
 * against each edge of the viewport, which is where the old centred-on-
 * the-press placement walked off screen.
 */
class PadBesideTargetTest {

    private val gap = 8
    private val margin = 12
    private val provider = PadBesideTarget(gapPx = gap, marginPx = margin)

    private val window = IntSize(1080, 2000)
    private val pad = IntSize(600, 800)

    private fun place(target: IntRect, content: IntSize = pad): IntRect {
        val at = provider.calculatePosition(target, window, LayoutDirection.Ltr, content)
        return IntRect(at.x, at.y, at.x + content.width, at.y + content.height)
    }

    private fun target(centreX: Int, centreY: Int, size: Int = 120) = IntRect(
        left = centreX - size / 2,
        top = centreY - size / 2,
        right = centreX + size / 2,
        bottom = centreY + size / 2,
    )

    private fun IntRect.insideViewport(): Boolean =
        left >= margin && top >= margin &&
            right <= window.width - margin && bottom <= window.height - margin

    private fun IntRect.overlaps(other: IntRect): Boolean =
        left < other.right && other.left < right && top < other.bottom && other.top < bottom

    @Test
    fun aTargetInTheMiddleGetsThePadAboveIt() {
        // Above by preference: the thumb comes from below on a phone.
        val placed = place(target(540, 1000))

        assertThat(placed.bottom).isEqualTo(target(540, 1000).top - gap)
        assertThat(placed.left).isEqualTo(540 - pad.width / 2)
    }

    @Test
    fun aTargetNearTheTopGetsThePadBelowItInstead() {
        val above = target(540, 200)
        val placed = place(above)

        assertThat(placed.top).isEqualTo(above.bottom + gap)
        assertThat(placed.insideViewport()).isTrue()
    }

    @Test
    fun thePadNeverOverlapsTheTargetItBelongsTo() {
        // The readout has to be readable while the finger is on the
        // target, which means the pad cannot sit on top of it.
        for (y in listOf(60, 200, 500, 1000, 1500, 1800, 1960)) {
            val at = target(540, y)

            assertThat(place(at).overlaps(at)).isFalse()
        }
    }

    @Test
    fun thePadStaysOnScreenWithTheTargetAgainstEveryEdge() {
        val edges = listOf(
            target(20, 20),
            target(540, 20),
            target(1060, 20),
            target(20, 1000),
            target(1060, 1000),
            target(20, 1980),
            target(540, 1980),
            target(1060, 1980),
        )

        for (at in edges) {
            assertThat(place(at).insideViewport()).isTrue()
        }
    }

    @Test
    fun aPadTallerThanEitherGapTakesTheRoomierSideAndStaysOnScreen() {
        // It scrolls inside its own card, so on-screen beats beside-the-
        // target when the screen simply has no room for both.
        val tall = IntSize(600, 1900)
        val low = target(540, 1700)

        val placed = place(low, tall)

        assertThat(placed.insideViewport()).isTrue()
        assertThat(placed.top).isLessThan(low.top)
    }

    @Test
    fun contentWiderThanTheViewportStillStartsAtTheMargin() {
        // Degrade, never crash: an oversized pad pins to the margin
        // rather than producing a negative coordinate.
        val huge = IntSize(2000, 400)

        val at = provider.calculatePosition(target(540, 1000), window, LayoutDirection.Ltr, huge)

        assertThat(at).isEqualTo(IntOffset(margin, 1000 - 60 - gap - 400))
    }
}
