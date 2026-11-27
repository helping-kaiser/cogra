package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * THE STATUS BANNERS' SLOT STANDS FULL WIDTH (seam 464, 472): the applicant's
 * task cards are cards of the feed's list — `ApplicantFeed.jsx:64-114` inside
 * `FeedList` (`_shared.jsx:531-537`: no side padding, 8 to the first post) —
 * so the feed hands the stack the list's whole width in every branch that
 * carries it, and the stack keeps the gutter for its rows that are no card
 * (`ApplicantStackLayoutTest`). A probe stands in for the stack here.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class FeedBannersSlotTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(state: FeedUiState) {
        compose.setContent {
            FeedScreen(
                state = state,
                onRefresh = {},
                onLoadMore = {},
                onOpenPost = {},
                onOpenActor = {},
                onOpenTopic = {},
                banners = { Box(Modifier.fillMaxWidth().height(40.dp).testTag(PROBE)) },
            )
        }
        compose.waitForIdle()
    }

    private fun bounds(tag: String): Rect =
        compose.onAllNodes(hasTestTag(tag), useUnmergedTree = true).fetchSemanticsNodes().first().boundsInRoot

    private fun px(dp: Dp): Float = with(compose.density) { dp.toPx() }

    private fun assertFullWidth() {
        val screen = compose.onRoot().fetchSemanticsNode().boundsInRoot
        val probe = bounds(PROBE)
        assertThat(probe.left).isEqualTo(screen.left)
        assertThat(probe.width).isEqualTo(screen.width)
    }

    @Test
    fun inTheListTheSlotSpansTheListAndTheFirstPostStandsEightUnderIt() {
        render(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        val list = bounds("feed_list")
        val probe = bounds(PROBE)
        assertThat(probe.left).isEqualTo(list.left)
        assertThat(probe.width).isEqualTo(list.width)
        // The list's 8dp seam above the slot (`FeedList`'s 8 px top), 8 to the first post.
        assertThat(probe.top - list.top).isWithin(0.5f).of(px(8.dp))
        assertThat(bounds("feed.card:p1").top - probe.bottom).isWithin(0.5f).of(px(8.dp))
    }

    @Test
    fun onTheEmptyFeedTheSlotSpansTheScreen() {
        render(FeedUiState(loading = false, posts = emptyList()))
        compose.onNodeWithTag("feed_empty").assertExists()
        assertFullWidth()
    }

    @Test
    fun onFeedNothingTheSlotSpansTheScreen() {
        render(FeedUiState(loading = false, posts = emptyList(), filter = FeedFilter.DEFAULT.copy(kinds = emptySet())))
        assertFullWidth()
    }

    @Test
    fun onTheTransportFaultTheSlotSpansTheScreen() {
        render(FeedUiState(loading = false, posts = emptyList(), transportFault = TransportFault.REFRESH))
        compose.onNodeWithTag("feed_transport_error").assertExists()
        assertFullWidth()
    }

    private companion object {
        const val PROBE = "probe_banners"
    }
}
