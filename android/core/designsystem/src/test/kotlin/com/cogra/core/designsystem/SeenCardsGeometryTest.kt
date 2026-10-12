// The seen rule as pure geometry: an item is seen when it lies wholly within
// the viewport `LazyListLayoutInfo` reports (`isFullyInViewport`), or, taller
// than the viewport, by its edges (`isTopEdgeOnScreen`, `isBottomEdgeOnScreen`).

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
    fun `a card taller than the viewport never passes the whole-card gate`() {
        // Wherever the reader stops it — top edge in view, bottom edge in
        // view, or the card covering the whole screen — the whole-card rule
        // never takes it; its edges decide it (History.md:13).
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

    @Test
    fun `only an item taller than the viewport has edges to report`() {
        assertThat(isTallerThanViewport(size = 1001, viewportStart = 0, viewportEnd = 1000)).isTrue()
        // Exactly as tall fits flush, so the whole-card rule keeps it.
        assertThat(isTallerThanViewport(size = 1000, viewportStart = 0, viewportEnd = 1000)).isFalse()
        assertThat(isTallerThanViewport(size = 1000, viewportStart = -48, viewportEnd = 952)).isFalse()
    }

    @Test
    fun `a tall card's top edge is on screen by its first pixel row`() {
        assertThat(isTopEdgeOnScreen(offset = 0, viewportStart = 0, viewportEnd = 1000)).isTrue()
        assertThat(isTopEdgeOnScreen(offset = 999, viewportStart = 0, viewportEnd = 1000)).isTrue()
        // At the bottom line no row of it is drawn; above the top it is gone.
        assertThat(isTopEdgeOnScreen(offset = 1000, viewportStart = 0, viewportEnd = 1000)).isFalse()
        assertThat(isTopEdgeOnScreen(offset = -1, viewportStart = 0, viewportEnd = 1000)).isFalse()
    }

    @Test
    fun `a tall card's bottom edge is on screen by its last pixel row`() {
        assertThat(isBottomEdgeOnScreen(offset = -1001, size = 2001, viewportStart = 0, viewportEnd = 1000)).isTrue()
        assertThat(isBottomEdgeOnScreen(offset = -2000, size = 2001, viewportStart = 0, viewportEnd = 1000)).isTrue()
        assertThat(isBottomEdgeOnScreen(offset = -2001, size = 2001, viewportStart = 0, viewportEnd = 1000)).isFalse()
        assertThat(isBottomEdgeOnScreen(offset = -1000, size = 2001, viewportStart = 0, viewportEnd = 1000)).isFalse()
    }

    @Test
    fun `a tall card covering the screen shows neither edge`() {
        assertThat(isTopEdgeOnScreen(offset = -10, viewportStart = 0, viewportEnd = 1000)).isFalse()
        assertThat(isBottomEdgeOnScreen(offset = -10, size = 1020, viewportStart = 0, viewportEnd = 1000)).isFalse()
    }

    @Test
    fun `a tall card's edge scrolled into the content padding is on screen`() {
        assertThat(isTopEdgeOnScreen(offset = -40, viewportStart = -48, viewportEnd = 952)).isTrue()
        assertThat(isBottomEdgeOnScreen(offset = -1100, size = 2000, viewportStart = -48, viewportEnd = 952)).isTrue()
    }
}
