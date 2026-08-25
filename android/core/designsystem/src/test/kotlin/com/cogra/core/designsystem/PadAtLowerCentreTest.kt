package com.cogra.core.designsystem

import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Where the pad opens (design.md §8.3): **the lower centre of the
 * viewport, the same place every time**.
 *
 * Muscle memory is part of the control, so the thing worth pinning is
 * not just the arithmetic but the INVARIANCE — whichever control was
 * pressed, and wherever on the screen it sits, the pad lands in exactly
 * the same place. The previous placement followed the target, which is
 * what made the pad impossible to operate without looking.
 */
class PadAtLowerCentreTest {

    private val bottom = 24
    private val margin = 12
    private val provider = PadAtLowerCentre(bottomPx = bottom, marginPx = margin)

    private val window = IntSize(1080, 2000)
    private val pad = IntSize(600, 800)

    private fun placeFor(target: IntRect, content: IntSize = pad): IntOffset =
        provider.calculatePosition(target, window, LayoutDirection.Ltr, content)

    private fun target(centreX: Int, centreY: Int, size: Int = 120) = IntRect(
        left = centreX - size / 2,
        top = centreY - size / 2,
        right = centreX + size / 2,
        bottom = centreY + size / 2,
    )

    @Test
    fun thePadSitsCentredAgainstTheLowerEdge() {
        val at = placeFor(target(540, 1000))

        assertThat(at.x).isEqualTo((window.width - pad.width) / 2)
        assertThat(at.y + pad.height).isEqualTo(window.height - bottom)
    }

    @Test
    fun everyTargetOnTheScreenOpensThePadInTheSamePlace() {
        // The whole point: the pad does not follow the control. A reader
        // learns one spot and their thumb finds it without looking.
        val anywhere = listOf(
            target(20, 20),
            target(540, 20),
            target(1060, 20),
            target(20, 1000),
            target(540, 1000),
            target(1060, 1000),
            target(20, 1980),
            target(540, 1980),
            target(1060, 1980),
        )

        val places = anywhere.map { placeFor(it) }.toSet()

        assertThat(places).hasSize(1)
    }

    @Test
    fun aTargetPressedRightWhereThePadWillOpenChangesNothing() {
        // Including the degenerate case the old provider had to dodge:
        // the pad no longer cares whether it would cover its own target.
        val underneath = target(540, window.height - bottom - pad.height / 2)

        assertThat(placeFor(underneath)).isEqualTo(placeFor(target(540, 100)))
    }

    @Test
    fun aPadTallerThanTheViewportStillStartsInsideIt() {
        // Degrade, never crash: the card scrolls inside itself, so a
        // huge pad pins to the margin rather than to a negative
        // coordinate that would put its top off the top of the screen.
        val tall = IntSize(600, 2400)

        val at = placeFor(target(540, 1000), tall)

        assertThat(at.y).isEqualTo(margin)
    }

    @Test
    fun contentWiderThanTheViewportStillStartsAtTheMargin() {
        val wide = IntSize(2000, 400)

        val at = placeFor(target(540, 1000), wide)

        assertThat(at.x).isEqualTo(margin)
    }

    @Test
    fun thePadNeverStartsAboveTheTopMargin() {
        for (height in listOf(100, 800, 1900, 1976, 2000, 3000)) {
            val at = placeFor(target(540, 1000), IntSize(600, height))

            assertThat(at.y).isAtLeast(margin)
        }
    }
}
