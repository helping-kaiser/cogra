package com.cogra.feature.content

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.TouchInjectionScope
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipe
import androidx.compose.ui.test.swipeUp
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.PostView
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * WHAT ONE SCREEN OF FEED COSTS TO SCROLL.
 *
 * The scroll jank jakob reported on the device (2026-09-22) has no
 * device to measure it on in CI, so what this harness pins is what a JVM
 * can see: how many times a card subtree is composed while a scripted
 * scroll runs, and **how far the list actually travels** under a gesture.
 *
 * The probe for the first is [FeedScreen]'s own `stanceControl` slot — a
 * composable the screen calls exactly once per drawn card, already
 * hoisted for DI, so counting its invocations counts card compositions
 * without a single instrument inside production code.
 *
 * The probe for the second is the count of cards a scroll newly reveals.
 * That one matters because a media card's body is a horizontal pager
 * inside a vertical list: the number is how much of a leaning thumb's
 * drag the list still receives.
 */
@RunWith(RobolectricTestRunner::class)
class FeedScrollCostTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun feedOfWordsPostsScrollsAtOneCompositionPerCard() {
        val cost = measure(List(POSTS) { wordsPost(it) }, listOf { swipeUp() }).single()
        println("[feed-scroll-cost] words: $cost")
        assertThat(cost.compositionsPerCard()).isAtMost(MAX_COMPOSITIONS_PER_CARD)
    }

    @Test
    fun feedOfMediaPostsScrollsAtOneCompositionPerCard() {
        val cost = measure(List(POSTS) { mediaPost(it) }, listOf { swipeUp() }).single()
        println("[feed-scroll-cost] media: $cost")
        assertThat(cost.compositionsPerCard()).isAtMost(MAX_COMPOSITIONS_PER_CARD)
    }

    /**
     * A CLIP ON SCREEN MUST NOT COST A COMPOSITION PER FRAME.
     *
     * A video frame reports how much of itself is showing so autoplay can
     * follow it. That number changes continuously while a list scrolls,
     * so anything that recomposes on it recomposes on every frame of
     * every scroll — for every clip on screen at once, on the same thread
     * that has to draw the next frame.
     *
     * This is the one card the harness can see doing it, because
     * `onGloballyPositioned` fires under Robolectric exactly as it does
     * on a device.
     */
    @Test
    fun feedOfVideoPostsScrollsAtOneCompositionPerCard() {
        val cost = measure(List(POSTS) { videoPost(it) }, listOf { swipeUp() }).single()
        println("[feed-scroll-cost] video: $cost")
        assertThat(cost.compositionsPerCard()).isAtMost(MAX_COMPOSITIONS_PER_CARD)
    }

    /**
     * A FEED THAT ONLY SCROLLS WHEN THE THUMB GOES STRAIGHT UP IS NOT
     * SCROLLING.
     *
     * A media card's body is a `HorizontalPager` — a horizontal drag
     * target sitting inside a vertical one. A real thumb never travels
     * straight up, so every such drag is arbitrated between the two
     * orientations first, and whatever the pager claims the list does
     * not get.
     *
     * The measurement is distance, not time: the same gesture with a
     * modest sideways lean, over the same cards, has to reveal about as
     * many of them. Where it reveals materially fewer, the pager is
     * eating the scroll — which is what a reader feels as a list that
     * will not move.
     */
    @Test
    fun mediaFeedScrollsAsFarWhenTheThumbLeans() {
        val (straight, leaning) = measure(
            posts = List(POSTS) { mediaPost(it) },
            gestures = listOf({ swipeUp() }, { swipeUpLeaning() }),
        )
        println("[feed-scroll-cost] media straight: $straight")
        println("[feed-scroll-cost] media leaning:  $leaning")
        assertThat(leaning.cardsTouched.toDouble())
            .isAtLeast(straight.cardsTouched * MIN_LEANING_TRAVEL)
    }

    /**
     * Composes a feed once, scrolls it through a warm-up pass, then
     * times one pass per gesture in [gestures].
     *
     * **The warm-up is not optional.** Whichever case runs first in a
     * JVM otherwise carries the cost of loading Compose, warming the JIT
     * and booting Robolectric's sandbox — on this harness's first run
     * that startup was eleven times the difference it was trying to
     * measure, and it read as the case rather than as the clock.
     *
     * Every pass scrolls further into the same list, so each one composes
     * fresh cards and none of them measures a second look at cards the
     * previous pass already built.
     */
    private fun measure(
        posts: List<PostView>,
        gestures: List<TouchInjectionScope.() -> Unit>,
    ): List<ScrollCost> {
        val compositions = mutableMapOf<String, Int>()
        compose.setContent {
            FeedScreen(
                state = FeedUiState(loading = false, posts = posts),
                onRefresh = {},
                onLoadMore = {},
                onOpenPost = {},
                onOpenActor = {},
                onOpenTopic = {},
                stanceControl = { target, _ ->
                    compositions[target] = (compositions[target] ?: 0) + 1
                },
            )
        }
        compose.waitForIdle()
        repeat(SWIPES) { scroll(gestures.first()) }
        return gestures.map { gesture ->
            val cardsBefore = compositions.size
            val compositionsBefore = compositions.values.sum()
            val startedAt = System.nanoTime()
            repeat(SWIPES) { scroll(gesture) }
            ScrollCost(
                cardsTouched = compositions.size - cardsBefore,
                compositions = compositions.values.sum() - compositionsBefore,
                elapsedMs = (System.nanoTime() - startedAt) / NANOS_PER_MILLI,
            )
        }
    }

    private fun scroll(gesture: TouchInjectionScope.() -> Unit) {
        compose.onNodeWithTag("feed_list").performTouchInput(gesture)
        compose.waitForIdle()
    }

    private data class ScrollCost(
        /** Cards the timed pass newly revealed — how far the list travelled. */
        val cardsTouched: Int,
        /** Every composition the timed pass ran, across all cards. */
        val compositions: Int,
        val elapsedMs: Long,
    ) {
        /**
         * The ratio that matters: compositions divided by the cards that
         * earned them. One means every card composed once and never
         * again — the scroll paid only for cards it newly revealed.
         */
        fun compositionsPerCard(): Double =
            if (cardsTouched == 0) 0.0 else compositions.toDouble() / cardsTouched

        override fun toString(): String =
            "cards=$cardsTouched compositions=$compositions " +
                "per-card=${"%.2f".format(compositionsPerCard())} ${elapsedMs}ms"
    }

    private fun wordsPost(index: Int): PostView = testPost("post-$index")

    /**
     * A picture post: words cleared, one still attached. Words XOR media
     * (D16) is the record's own rule, so a media card is not a words
     * card with a picture added — it is the other card.
     */
    private fun mediaPost(index: Int): PostView = testPost("post-$index").copy(
        content = testModeratedField(null),
        attachments = listOf(
            MediaAssetView(
                id = "asset-$index",
                url = "https://example.invalid/$index.jpg",
                altText = null,
                status = FieldStatus.NORMAL,
                aspectRatio = 1f,
                mimeType = "image/jpeg",
            ),
        ),
    )

    /**
     * A clip post: the same card, with a cover standing in for the first
     * frame. The cover is what the gallery draws until autoplay decides
     * the reader is looking at this one.
     */
    private fun videoPost(index: Int): PostView = testPost("post-$index").copy(
        content = testModeratedField(null),
        attachments = listOf(
            MediaAssetView(
                id = "asset-$index",
                url = "https://example.invalid/$index.mp4",
                altText = null,
                status = FieldStatus.NORMAL,
                aspectRatio = 1f,
                mimeType = "video/mp4",
                durationMs = 5_000,
                cover = MediaAssetView(
                    id = "cover-$index",
                    url = "https://example.invalid/$index.jpg",
                    altText = null,
                    status = FieldStatus.NORMAL,
                    aspectRatio = 1f,
                    mimeType = "image/jpeg",
                ),
            ),
        ),
    )

    private companion object {
        /** Long enough that no pass over the list reaches the end of it. */
        const val POSTS = 120
        const val SWIPES = 6

        /**
         * One composition per card, plus the slack a lazy list legitimately
         * takes: an item at the edge of the viewport can compose, leave and
         * come back within one fling. Above this the cards are recomposing
         * for reasons the scroll did not ask for.
         */
        const val MAX_COMPOSITIONS_PER_CARD = 2.0

        /**
         * How much of a straight thumb's travel a leaning one has to keep.
         * A lean costs a little distance on any list — the gesture is
         * shorter in the scrolled axis — but not most of it.
         */
        const val MIN_LEANING_TRAVEL = 0.75

        const val NANOS_PER_MILLI = 1_000_000
    }
}

/**
 * A swipe up with the sideways lean a real thumb has.
 *
 * The arc is what a hand actually draws: the thumb pivots from its
 * joint, so a "vertical" flick carries a steady horizontal component.
 * [androidx.compose.ui.test.swipeUp] draws the line a hand never draws,
 * which is exactly why a pager nested in a list survives it.
 */
private fun TouchInjectionScope.swipeUpLeaning() {
    val lean = width * LEAN_FRACTION
    swipe(
        start = Offset(centerX - lean / 2, bottom - EDGE_INSET),
        end = Offset(centerX + lean / 2, top + EDGE_INSET),
    )
}

/**
 * How far sideways the lean runs, as a share of the list's width. A
 * fifth is a gentle arc — well inside what a thumb produces, and well
 * under the half-width a deliberate sideways page would take.
 */
private const val LEAN_FRACTION = 0.2f

/** Keeps both ends of the gesture off the very edge of the node. */
private const val EDGE_INSET = 1f
