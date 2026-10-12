// H1's seen rule as pure geometry: an item is seen when it lies wholly
// within the viewport `LazyListLayoutInfo` reports (`isFullyInViewport`).

package com.cogra.core.designsystem

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SeenCardsGeometryTest {

    @Test
    fun `a card fully in the viewport is seen`() {
        assertThat(isFullyInViewport(offset = 100, size = 300, viewportStart = 0, viewportEnd = 1000)).isTrue()
    }

    @Test
    fun `a card flush with both viewport edges is seen`() {
        assertThat(isFullyInViewport(offset = 0, size = 1000, viewportStart = 0, viewportEnd = 1000)).isTrue()
    }

    @Test
    fun `a partly visible card is not seen`() {
        // One pixel past the top, one pixel past the bottom.
        assertThat(isFullyInViewport(offset = -1, size = 300, viewportStart = 0, viewportEnd = 1000)).isFalse()
        assertThat(isFullyInViewport(offset = 701, size = 300, viewportStart = 0, viewportEnd = 1000)).isFalse()
    }

    @Test
    fun `a card taller than the viewport never fires in H1`() {
        // Wherever the reader stops it — top edge in view, bottom edge in
        // view, or the card covering the whole screen.
        val fired = (-1200..1000).any { offset ->
            isFullyInViewport(offset = offset, size = 1001, viewportStart = 0, viewportEnd = 1000)
        }
        assertThat(fired).isFalse()
    }

    @Test
    fun `the content padding is part of the viewport`() {
        // `viewportStartOffset` goes negative by the leading padding: a card
        // scrolled up into the padding is still drawn, so still on screen.
        assertThat(isFullyInViewport(offset = -40, size = 300, viewportStart = -48, viewportEnd = 952)).isTrue()
        assertThat(isFullyInViewport(offset = -49, size = 300, viewportStart = -48, viewportEnd = 952)).isFalse()
    }

    @Test
    fun `an item of no size is never seen`() {
        assertThat(isFullyInViewport(offset = 10, size = 0, viewportStart = 0, viewportEnd = 1000)).isFalse()
    }
}
