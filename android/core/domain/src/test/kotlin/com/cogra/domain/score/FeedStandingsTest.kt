// The standing store's laws (FeedKinds.md:7-15; History.md:29; PostDetail.md:19;
// score-readout CD-SR5, CD-9): the latest fetch of a thing names its figure,
// the trace adopts, and only the next feed fetch replaces the adoptions.

package com.cogra.domain.score

import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.testing.entry
import com.cogra.domain.testing.settling
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class FeedStandingsTest {

    private val ranking = FeedRanking(
        asOfEpoch = 3,
        entries = listOf(entry("a", newestIndex = 0, score = 15.2), entry("b", newestIndex = 1, score = -0.5)),
        settling = listOf(settling("s", ranked = 2, newest = 2)),
    )

    private fun held(): FeedStandings = FeedStandings().apply { hold("reader", ranking, viewer = "reader") }

    @Test
    fun `a card's figure is the one its reader's last feed fetch computed`() {
        val store = held()
        assertThat(store.state.value.of("reader", "a", pending = false)).isEqualTo(Standing.Figure(15.2))
        assertThat(store.state.value.of("reader", "b", pending = false)).isEqualTo(Standing.Figure(-0.5))
    }

    @Test
    fun `a thing the fetch did not reach reads the dash`() {
        assertThat(held().state.value.of("reader", "elsewhere", pending = false)).isEqualTo(Standing.Dash)
    }

    @Test
    fun `a thing still settling stands settling, by its own row or the held answer`() {
        val store = held()
        assertThat(store.state.value.of("reader", "s", pending = false)).isEqualTo(Standing.Settling)
        assertThat(store.state.value.of("reader", "a", pending = true)).isEqualTo(Standing.Settling)
    }

    @Test
    fun `the trace's fetch is adopted — a number, or the dash where it found no paths`() {
        val store = held()
        store.adopt("a", 9.1)
        store.adopt("b", null)
        assertThat(store.state.value.of("reader", "a", pending = false)).isEqualTo(Standing.Figure(9.1))
        assertThat(store.state.value.of("reader", "b", pending = false)).isEqualTo(Standing.Dash)
    }

    @Test
    fun `a trace can answer a lookup miss`() {
        val store = held()
        store.adopt("elsewhere", 2.0)
        assertThat(store.state.value.of("reader", "elsewhere", pending = false)).isEqualTo(Standing.Figure(2.0))
    }

    @Test
    fun `the next feed fetch replaces every adoption`() {
        val store = held()
        store.adopt("a", null)
        store.hold("reader", ranking, viewer = "reader")
        assertThat(store.state.value.of("reader", "a", pending = false)).isEqualTo(Standing.Figure(15.2))
    }

    @Test
    fun `another reader's figures are never shown`() {
        val store = held()
        store.adopt("a", 3.0)
        assertThat(store.state.value.of("someone", "a", pending = false)).isEqualTo(Standing.Dash)
        assertThat(store.state.value.viewerFor("someone")).isNull()
    }

    @Test
    fun `the held view is the one the ranking walked from`() {
        val store = FeedStandings().apply { hold(reader = null, ranking, viewer = "lender") }
        assertThat(store.state.value.viewerFor(null)).isEqualTo("lender")
    }

    @Test
    fun `a fetch with no rankable view holds nothing`() {
        val store = held()
        store.hold("reader", null, null)
        assertThat(store.state.value.of("reader", "a", pending = false)).isEqualTo(Standing.Dash)
        assertThat(store.state.value.viewerFor("reader")).isNull()
    }
}
