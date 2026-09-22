package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowLog

/**
 * HOW OFTEN A SCROLLING CLIP RE-DECIDES WHETHER IT IS PLAYING.
 *
 * A video frame reports its visible fraction so autoplay can follow it,
 * and that fraction changes on every layout pass — which, while a list
 * is scrolling, is every frame. Anything downstream of that number runs
 * at the same rate, on the thread that owes the compositor its next
 * frame.
 *
 * **The instrument is the app's own log.** `VideoTrace.autoplay` fires
 * once per autoplay decision, so counting its lines counts decisions,
 * with nothing added to production code to count them with. What a
 * healthy card looks like: a handful of lines per clip — it arrived, it
 * crossed the bar, it left. What a card burning the frame budget looks
 * like: a line per frame, times every clip on screen.
 *
 * `MediaGallery` is measured here rather than the feed card, because the
 * churn lives inside the gallery and Compose's invalidation correctly
 * keeps it there: a card-level probe sits beside it and sees nothing.
 *
 * **The count is the assertion, never a duration.** A JVM's wall clock
 * over Robolectric moved by half on repeat runs of the same case, so a
 * timing pin here would fail on the weather. A decision count does not
 * move: it is the work itself, and it is what the fix changed.
 */
@RunWith(RobolectricTestRunner::class)
class GalleryVisibilityChurnTest {

    @get:Rule
    val compose = createComposeRule()

    @Before
    fun captureLogs() {
        ShadowLog.clear()
        ShadowLog.stream = null
    }

    @Test
    fun aScrollingClipDecidesAutoplayOnlyWhenItsVisibilityMeaningfullyChanges() {
        val clips = List(CELLS) { index ->
            MediaItem(
                url = null,
                aspectRatio = 1f,
                videoUrl = "https://example.invalid/$index.mp4",
                durationMs = 5_000,
            )
        }
        compose.setContent {
            Cogra2PreviewTheme {
                LazyColumn(modifier = Modifier.fillMaxSize().testTag(LIST)) {
                    items(clips) { clip -> MediaGallery(items = listOf(clip)) }
                }
            }
        }
        compose.waitForIdle()
        ShadowLog.clear()
        repeat(SWIPES) {
            compose.onNodeWithTag(LIST).performTouchInput { swipeUp() }
            compose.waitForIdle()
        }

        val decisions = ShadowLog.getLogsForTag(VideoTrace.TAG).count { it.msg.startsWith("autoplay") }
        println("[gallery-visibility-churn] autoplay decisions over $SWIPES swipes: $decisions")
        assertThat(decisions).isAtMost(MAX_DECISIONS)
    }

    private companion object {
        const val LIST = "churn_list"
        const val CELLS = 40
        const val SWIPES = 6

        /**
         * A generous ceiling on real decisions: every clip the scroll
         * passes may legitimately announce itself arriving, starting and
         * leaving. Anything above this is the layout pass talking, not
         * the reader.
         */
        const val MAX_DECISIONS = CELLS * 3
    }
}
