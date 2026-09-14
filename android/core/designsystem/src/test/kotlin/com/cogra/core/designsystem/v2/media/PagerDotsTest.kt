package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaFrame
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Item 67's windowed row, against the drawn numbers in
 * `design/components/media/MediaAttachment.jsx:296-394`.
 */
@RunWith(RobolectricTestRunner::class)
class PagerDotsTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun `a set inside the window draws every slot`() {
        val at = dotWindow(count = 4, current = 1)
        assertThat(at.start).isEqualTo(0)
        assertThat(at.window).isEqualTo(4)
        assertThat(at.moreBefore).isFalse()
        assertThat(at.moreAfter).isFalse()
    }

    @Test
    fun `the window parks at the head until the reader reaches the middle`() {
        assertThat(listOf(0, 1, 2).map { dotWindow(10, it).start }).containsExactly(0, 0, 0).inOrder()
    }

    @Test
    fun `the window then slides one step per page`() {
        assertThat(listOf(3, 4, 5, 6).map { dotWindow(10, it).start }).containsExactly(0, 1, 2, 3).inOrder()
    }

    @Test
    fun `the window parks at the tail so the last dot can be reached`() {
        assertThat(listOf(7, 8, 9).map { dotWindow(10, it).start }).containsExactly(3, 3, 3).inOrder()
    }

    @Test
    fun `the active dot is never the shrunk one`() {
        for (current in 0 until 10) {
            val at = dotWindow(10, current)
            val offset = current - at.start
            val onShrunkEdge = (offset == 0 && at.moreBefore) ||
                (offset == at.window - 1 && at.moreAfter)
            assertThat(onShrunkEdge).isFalse()
        }
    }

    @Test
    fun `a lone picture has no position to mark`() {
        compose.setContent { Cogra2PreviewTheme { PagerDots(count = 1, current = 0, testTag = "dots") } }
        compose.onNodeWithTag("dots").assertDoesNotExist()
    }

    @Test
    fun `the count is spoken and never drawn`() {
        compose.setContent { Cogra2PreviewTheme { PagerDots(count = 10, current = 4, testTag = "dots") } }
        compose.onNodeWithContentDescription("Picture 5 of 10").assertExists()
    }

    /**
     * What a row of [slots] measures: every slot is a FULL dot wide whatever
     * the dot inside it does (`MediaAttachment.jsx:326-328`), with the gap
     * between them — so the row's own width is the one number that says both
     * how many slots were drawn and that none of them reflowed.
     */
    private fun rowWidth(slots: Int) = MediaFrame.Dot * slots + MediaFrame.DotGap * (slots - 1)

    @Test
    fun `a four-set is drawn whole`() {
        compose.setContent { Cogra2PreviewTheme { PagerDots(count = 4, current = 1, testTag = "dots") } }
        compose.onNodeWithTag("dots").assertWidthIsEqualTo(rowWidth(4))
        compose.onNodeWithTag("dots").assertHeightIsEqualTo(MediaFrame.Dot)
    }

    @Test
    fun `a seven-set is drawn whole — the window is the ceiling, not a cut`() {
        compose.setContent { Cogra2PreviewTheme { PagerDots(count = 7, current = 3, testTag = "dots") } }
        compose.onNodeWithTag("dots").assertWidthIsEqualTo(rowWidth(7))
    }

    @Test
    fun `a ten-set caps at seven slots, and the shrunk edge moves nothing`() {
        compose.setContent { Cogra2PreviewTheme { PagerDots(count = 10, current = 0, testTag = "dots") } }
        // Seven slots, not ten — and the same width as a seven-set, because a
        // shrunk edge dot stays centred in a full-size slot.
        compose.onNodeWithTag("dots").assertWidthIsEqualTo(rowWidth(MediaFrame.DotWindow))
    }

    @Test
    fun `the row keeps its width with the window mid-set, both edges shrunk`() {
        compose.setContent { Cogra2PreviewTheme { PagerDots(count = 10, current = 5, testTag = "dots") } }
        // Two shrunk dots and the row is still exactly seven pitches wide:
        // nothing reflows under a swipe.
        compose.onNodeWithTag("dots").assertWidthIsEqualTo(rowWidth(MediaFrame.DotWindow))
    }

    @Test
    fun `the viewer tone draws the same row`() {
        compose.setContent {
            Cogra2PreviewTheme {
                PagerDots(count = 10, current = 5, tone = DotTone.Viewer, testTag = "dots")
            }
        }
        compose.onNodeWithTag("dots").assertWidthIsEqualTo(rowWidth(MediaFrame.DotWindow))
        compose.onNodeWithContentDescription("Picture 6 of 10").assertExists()
    }
}
