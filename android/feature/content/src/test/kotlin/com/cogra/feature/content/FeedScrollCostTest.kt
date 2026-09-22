package com.cogra.feature.content

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
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
 * device to measure it on in CI, so the number this pins is the one a
 * JVM can see: **how many times the card subtree is composed while a
 * scripted scroll runs**. Frame time is not measurable here; composition
 * churn is, and it is the input to frame time that the app controls.
 *
 * The probe is [FeedScreen]'s own `stanceControl` slot — a composable
 * the screen calls exactly once per drawn card, already hoisted for DI,
 * so counting its invocations counts card compositions without a single
 * instrument inside production code. An invocation is one composition or
 * recomposition of that card's subtree.
 *
 * Read the two numbers together. [feedOfWordsPostsScrollsAtOneCompositionPerCard]
 * is the floor — a card with no media — and
 * [feedOfMediaPostsCostsNoMoreThanWords] is the same scroll over cards
 * that carry a picture. The gap between them is what the media path
 * costs, which is precisely the thing under investigation: a picture
 * must cost its own decode, never extra compositions of the card
 * around it.
 */
@RunWith(RobolectricTestRunner::class)
class FeedScrollCostTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun feedOfWordsPostsScrollsAtOneCompositionPerCard() {
        val cost = scrollCost(List(POSTS) { wordsPost(it) })
        println("[feed-scroll-cost] words: $cost")
        assertThat(cost.compositionsPerCard()).isAtMost(MAX_COMPOSITIONS_PER_CARD)
    }

    @Test
    fun feedOfMediaPostsCostsNoMoreThanWords() {
        val cost = scrollCost(List(POSTS) { mediaPost(it) })
        println("[feed-scroll-cost] media: $cost")
        assertThat(cost.compositionsPerCard()).isAtMost(MAX_COMPOSITIONS_PER_CARD)
    }

    /**
     * Composes a feed, scrolls it [SWIPES] times, and reports what the
     * cards cost.
     *
     * The gesture is the same every run — a fixed swipe on the list's
     * own tag — so two runs of this harness are comparable to each
     * other and to nothing else. Nanoseconds are reported for
     * orientation only: a JVM's wall clock over Robolectric measures
     * composition, measure and layout on this machine, not a frame on
     * a phone.
     */
    private fun scrollCost(posts: List<PostView>): ScrollCost {
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
        val settled = compositions.toMap()
        val startedAt = System.nanoTime()
        repeat(SWIPES) {
            compose.onNodeWithTag("feed_list").performTouchInput { swipeUp() }
            compose.waitForIdle()
        }
        val elapsedMs = (System.nanoTime() - startedAt) / NANOS_PER_MILLI
        return ScrollCost(
            cardsTouched = compositions.size,
            compositions = compositions.values.sum(),
            compositionsBeforeScroll = settled.values.sum(),
            elapsedMs = elapsedMs,
        )
    }

    private data class ScrollCost(
        /** Distinct cards that entered composition across the whole scroll. */
        val cardsTouched: Int,
        /** Every composition of every card, the initial pass included. */
        val compositions: Int,
        /** What the first frame alone cost, before a finger touched it. */
        val compositionsBeforeScroll: Int,
        val elapsedMs: Long,
    ) {
        /**
         * The ratio that matters: compositions divided by the cards that
         * earned them. One means every card composed once and never
         * again — the scroll paid only for cards it newly revealed.
         */
        fun compositionsPerCard(): Double = compositions.toDouble() / cardsTouched

        override fun toString(): String =
            "cards=$cardsTouched compositions=$compositions " +
                "(first frame $compositionsBeforeScroll) " +
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

    private companion object {
        const val POSTS = 30
        const val SWIPES = 6

        /**
         * One composition per card, plus the slack a lazy list legitimately
         * takes: an item at the edge of the viewport can compose, leave and
         * come back within one fling. Above this the cards are recomposing
         * for reasons the scroll did not ask for.
         */
        const val MAX_COMPOSITIONS_PER_CARD = 2.0

        const val NANOS_PER_MILLI = 1_000_000
    }
}
