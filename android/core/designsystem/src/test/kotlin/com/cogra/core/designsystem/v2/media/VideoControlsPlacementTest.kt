package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.media3.common.util.UnstableApi
import com.cogra.core.designsystem.v2.token.Space
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Where the sound disc sits on the frame.
 *
 * The design master (`design/components/media/MediaAttachment.jsx:105`)
 * gives `MediaDisc` a default corner of bottom-right — "the tile's
 * lower-right corner, the thumb's side while scrolling" (jakob,
 * 2026-09-15; PR #774, commit a12e911c moved it there from bottom-left).
 * Every board that draws it (`FeedCover`, `FeedShapes`, `ReplyMedia`)
 * inherits that default with no override. This pins Android's mute disc
 * to the same corner and geometry (G1): a bottom-right 36dp disc, inset
 * 8dp from both edges, so the two platforms read as one design instead
 * of mirror images of each other.
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoControlsPlacementTest {

    @get:Rule
    val compose = createComposeRule()

    private val clip = "https://media/clip.mp4"

    @After
    fun tearDown() {
        VideoStage.release()
        VideoSound.reset()
    }

    @Test
    fun theMuteDiscSitsAtTheEndCornerOfTheFrame() {
        compose.setContent { Clip() }

        val frame = compose.onNodeWithTag(FRAME_TAG).getUnclippedBoundsInRoot()
        val mute = compose.onNodeWithTag("video_mute").getUnclippedBoundsInRoot()

        // Bottom-right, per the master's default corner: 8dp in from both
        // edges, and a 36dp disc.
        assertThat((frame.right - mute.right).value).isWithin(TOLERANCE).of(Space.x2.value)
        assertThat((frame.bottom - mute.bottom).value).isWithin(TOLERANCE).of(Space.x2.value)
        assertThat((mute.right - mute.left).value).isWithin(TOLERANCE).of(DISC_SIZE_DP)
        assertThat((mute.left - frame.left).value).isGreaterThan(Space.x2.value)
    }

    @Composable
    private fun Clip() {
        VideoPlayer(
            url = clip,
            posterUrl = null,
            autoplay = false,
            modifier = Modifier.size(FRAME),
            testTag = FRAME_TAG,
        )
    }

    private companion object {
        val FRAME = 200.dp
        const val FRAME_TAG = "frame"
        const val TOLERANCE = 0.5f

        // design/components/media/MediaAttachment.jsx:123-124 — the
        // MediaDisc master's disc is 36px square.
        const val DISC_SIZE_DP = 36f
    }
}
