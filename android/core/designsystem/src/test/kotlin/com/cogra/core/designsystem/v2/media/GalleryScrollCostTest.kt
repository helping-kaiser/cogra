package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaFrame
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * WHERE A PICTURE CARD'S SCROLL COST ACTUALLY SITS.
 *
 * `FeedScrollCostTest` measured a media feed at roughly eleven times a
 * words feed per card with the composition count flat at one — so the
 * cost is measure and layout, not recomposition. This attributes it.
 *
 * Three runs, one scripted scroll each, same list and same gesture: the
 * gallery as it stands over one picture, the gallery over three, and the
 * frame the gallery wraps with nothing around it. The gap between the
 * first and the last is what the pager costs a card that has nothing to
 * page.
 *
 * Nothing here asserts a duration — a JVM's wall clock is not a phone's
 * frame budget, and the three numbers are only comparable to each other,
 * from one run, on one machine. They are printed and read. What the
 * suite pins is structure, in [MediaComponentsTest].
 */
@RunWith(RobolectricTestRunner::class)
class GalleryScrollCostTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun frameAlone() = report("frame only") { PlainFrame() }

    @Test
    fun gallerySinglePicture() {
        val one = listOf(MediaItem(url = null, aspectRatio = 1f))
        report("gallery, 1 item") { MediaGallery(items = one) }
    }

    @Test
    fun galleryThreePictures() {
        val three = List(3) { MediaItem(url = null, aspectRatio = 1f) }
        report("gallery, 3 items") { MediaGallery(items = three) }
    }

    private fun report(label: String, cell: @Composable () -> Unit) {
        println("[gallery-scroll-cost] $label ${scrollCost(cell)}ms")
    }

    /** What one page of the gallery draws, with no pager around it. */
    @Composable
    private fun PlainFrame() {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .heightIn(min = MediaFrame.MinHeight, max = mediaMaxHeight())
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            AsyncImage(
                model = null,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }

    /**
     * Scrolls the list twice and times only the second half.
     *
     * The first half is the price of admission and has to stay out of
     * the number: whichever variant runs first in a JVM otherwise pays
     * for loading Compose, warming the JIT and booting Robolectric's
     * sandbox, which on the first run of this harness was larger than
     * everything it was trying to measure. The warm-up scrolls through
     * its own cells, so the timed half still composes fresh ones and is
     * measuring the same work — just not the startup under it.
     */
    private fun scrollCost(cell: @Composable () -> Unit): Long {
        compose.setContent {
            Cogra2PreviewTheme {
                LazyColumn(modifier = Modifier.fillMaxSize().testTag(LIST)) {
                    items(List(CELLS) { it }, key = { it }) { cell() }
                }
            }
        }
        compose.waitForIdle()
        repeat(SWIPES) { swipe() }
        val startedAt = System.nanoTime()
        repeat(SWIPES) { swipe() }
        return (System.nanoTime() - startedAt) / NANOS_PER_MILLI
    }

    private fun swipe() {
        compose.onNodeWithTag(LIST).performTouchInput { swipeUp() }
        compose.waitForIdle()
    }

    private companion object {
        const val LIST = "cost_list"

        /** Long enough that neither the warm-up nor the timed half hits the end. */
        const val CELLS = 120
        const val SWIPES = 6
        const val NANOS_PER_MILLI = 1_000_000
    }
}
