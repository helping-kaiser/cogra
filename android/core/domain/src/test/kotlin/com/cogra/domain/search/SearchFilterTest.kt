// The search filter's reading and the recents' list law (ExploreFilter.md,
// ExploreSearch.md:15-17, ExploreUnscoped.md:9; Explore.md:27; nodes.json's
// `explore.recent` key rule).

package com.cogra.domain.search

import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SearchFilterTest {

    @Test
    fun `the default reads Everything with nothing after it`() {
        assertThat(READER_SEARCH_DEFAULT.reading(READER_SEARCH_DEFAULT))
            .isEqualTo(SearchFilterReading(KindsHead.Everything, order = null))
    }

    @Test
    fun `the head names one kind, counts some, and says All kinds for four`() {
        assertThat(SearchFilter(kinds = setOf(FeedKind.COMMENT)).reading(READER_SEARCH_DEFAULT).head)
            .isEqualTo(KindsHead.One(FeedKind.COMMENT))
        assertThat(SearchFilter(kinds = setOf(FeedKind.COMMENT, FeedKind.POST)).reading(READER_SEARCH_DEFAULT).head)
            .isEqualTo(KindsHead.Some(2))
        assertThat(SearchFilter(kinds = SEARCH_KINDS.toSet()).reading(READER_SEARCH_DEFAULT).head)
            .isEqualTo(KindsHead.All)
    }

    @Test
    fun `the trigger speaks only the deviations from the reader's default`() {
        val reading = SearchFilter(order = SearchOrder.NEWEST).reading(READER_SEARCH_DEFAULT)
        assertThat(reading.order).isEqualTo(SearchOrder.NEWEST)
    }

    // Seam 296 (jakob, 2026-11-11): search never looks at the seen-list, so the
    // reader's saved default gives it the order and nothing else.
    @Test
    fun `the saved default gives search its order alone, whatever its seen toggle`() {
        val saved = FeedFilter.DEFAULT.copy(kinds = setOf(FeedKind.TAG), order = FeedOrder.NEWEST, showSeen = true)
        assertThat(saved.searchDefault()).isEqualTo(SearchFilter(order = SearchOrder.NEWEST))
    }

    @Test
    fun `a guest's search reads newest, and its default deviates nowhere`() {
        val guest = guestSearchFilter()
        assertThat(guest.order).isEqualTo(SearchOrder.NEWEST)
        assertThat(guest.reading(guestSearchFilter()).order).isNull()
    }

    @Test
    fun `a chip toggles and Profiles alone is its own reading`() {
        val on = SearchFilter().toggle(FeedKind.PROFILE)
        assertThat(on.profilesAlone).isTrue()
        assertThat(on.toggle(FeedKind.PROFILE).kinds).isEmpty()
    }

    @Test
    fun `recents keep ten newest first, deduped case-insensitively`() {
        val ten = (1..10).map { "q$it" }
        val next = withRecent(ten, "Q5")
        assertThat(next.first()).isEqualTo("Q5")
        assertThat(next).hasSize(10)
        assertThat(next.count { it.equals("q5", ignoreCase = true) }).isEqualTo(1)
        assertThat(withRecent(ten, "new").last()).isEqualTo("q9")
        assertThat(withRecent(ten, "   ")).isSameInstanceAs(ten)
    }

    @Test
    fun `a recent's key is its words lowercased, other characters one dash`() {
        assertThat(recentNodeKey("@sol salt")).isEqualTo("sol-salt")
        assertThat(recentNodeKey("#saltmaps")).isEqualTo("saltmaps")
        assertThat(recentNodeKey("Coast  Road!")).isEqualTo("coast-road")
    }
}
