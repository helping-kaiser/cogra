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
 * The design master (`design/components/media/MediaAttachment.jsx`)
 * gives every reading surface's disc the same default corner —
 * bottom-left — and web's reading disc conforms. This pins Android's
 * mute disc to the same corner (FE-31): the two platforms read as one
 * design instead of mirror images of each other.
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
    fun theMuteDiscSitsAtTheStartCornerOfTheFrame() {
        compose.setContent { Clip() }

        val frame = compose.onNodeWithTag(FRAME_TAG).getUnclippedBoundsInRoot()
        val mute = compose.onNodeWithTag("video_mute").getUnclippedBoundsInRoot()

        // Bottom-left, at the same inset the Row's own padding sets —
        // not bottom-right, which is what FE-31 reported.
        assertThat((mute.left - frame.left).value).isWithin(TOLERANCE).of(Space.x2.value)
        assertThat((frame.bottom - mute.bottom).value).isWithin(TOLERANCE).of(Space.x2.value)
        assertThat((frame.right - mute.right).value).isGreaterThan(Space.x2.value)
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
    }
}
