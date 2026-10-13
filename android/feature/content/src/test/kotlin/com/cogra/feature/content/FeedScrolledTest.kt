package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The feed's way back up (FeedScrolled.md:3-15) and the bar's re-tap rungs
 * (Feed.md:85-91), over a list of tall rows on a phone-sized window — so
 * three viewport-heights is a few rows down.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class FeedScrolledTest {

    @get:Rule
    val compose = createComposeRule()

    private var bandShown by mutableStateOf(false)
    private var reselects by mutableIntStateOf(0)
    private var refreshes = 0
    private lateinit var list: LazyListState

    private fun render(initialReselects: Int = 0) {
        reselects = initialReselects
        compose.setContent {
            list = rememberLazyListState()
            FeedReselectEffect(signal = reselects, listState = list, onRefresh = { refreshes += 1 })
            Box(Modifier.fillMaxSize()) {
                LazyColumn(state = list, modifier = Modifier.fillMaxSize()) {
                    items(ROWS) { index ->
                        Text("row $index", Modifier.fillMaxWidth().height(ROW_HEIGHT.dp))
                    }
                }
                FeedBackToTop(
                    bandShown = bandShown,
                    listState = list,
                    modifier = Modifier.align(Alignment.TopCenter),
                )
            }
        }
    }

    private fun scrollTo(index: Int) {
        compose.runOnIdle { runBlocking { list.scrollToItem(index) } }
        compose.waitForIdle()
    }

    private fun summonBand() {
        compose.runOnIdle { bandShown = true }
        compose.waitForIdle()
    }

    /** FeedScrolled.md:3 */
    @Test
    fun the_back_to_top_pill_rides_in_with_the_band_three_screens_deep() {
        render()
        scrollTo(DEEP_ROW)
        compose.onNodeWithTag(BACK_TO_TOP_TAG).assertDoesNotExist()
        summonBand()
        compose.onNodeWithTag(BACK_TO_TOP_TAG).assertTextEquals("Back to top")
    }

    /** FeedScrolled.md:5 */
    @Test
    fun never_the_pill_appears_shallower_than_three_viewport_heights() {
        render()
        scrollTo(SHALLOW_ROW)
        summonBand()
        compose.onNodeWithTag(BACK_TO_TOP_TAG).assertDoesNotExist()
    }

    /** FeedScrolled.md:7 */
    @Test
    fun the_pill_leaves_with_the_band() {
        render()
        scrollTo(DEEP_ROW)
        summonBand()
        compose.onNodeWithTag(BACK_TO_TOP_TAG).assertExists()
        compose.runOnIdle { bandShown = false }
        compose.waitForIdle()
        compose.onNodeWithTag(BACK_TO_TOP_TAG).assertDoesNotExist()
    }

    /** FeedScrolled.md:11 */
    @Test
    fun tapping_back_to_top_goes_to_the_top_and_never_refreshes() {
        render()
        scrollTo(DEEP_ROW)
        summonBand()
        compose.onNodeWithTag(BACK_TO_TOP_TAG).performClick()
        compose.waitForIdle()
        assertThat(list.firstVisibleItemIndex).isEqualTo(0)
        assertThat(list.firstVisibleItemScrollOffset).isEqualTo(0)
        assertThat(refreshes).isEqualTo(0)
    }

    /** FeedScrolled.md:15 — at the hard top there is nothing left to go up to. */
    @Test
    fun at_the_hard_top_the_pill_is_gone() {
        render()
        scrollTo(DEEP_ROW)
        summonBand()
        scrollTo(0)
        compose.onNodeWithTag(BACK_TO_TOP_TAG).assertDoesNotExist()
    }

    /** FeedScrolled.md:13; Feed.md:85-91 */
    @Test
    fun a_feed_re_tap_while_scrolled_goes_to_the_top_and_never_refreshes() {
        render()
        scrollTo(DEEP_ROW)
        compose.runOnIdle { reselects += 1 }
        compose.waitForIdle()
        assertThat(list.firstVisibleItemIndex).isEqualTo(0)
        assertThat(refreshes).isEqualTo(0)
    }

    /** Feed.md:87 */
    @Test
    fun a_feed_re_tap_at_the_top_refreshes() {
        render()
        compose.runOnIdle { reselects += 1 }
        compose.waitForIdle()
        assertThat(refreshes).isEqualTo(1)
    }

    /** A feed coming back from another tab is not being re-tapped. */
    @Test
    fun the_re_taps_already_counted_when_the_feed_arrives_are_not_answered() {
        render(initialReselects = 5)
        compose.waitForIdle()
        assertThat(refreshes).isEqualTo(0)
    }

    private companion object {
        const val ROWS = 60
        const val ROW_HEIGHT = 300

        // 891dp tall: three screens is ~2673dp, about nine rows.
        const val DEEP_ROW = 20
        const val SHALLOW_ROW = 4
    }
}
