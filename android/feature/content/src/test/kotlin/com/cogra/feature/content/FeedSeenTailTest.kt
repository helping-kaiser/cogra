package com.cogra.feature.content

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The seen tail on the feed (FeedSeenTail.md; ranked-feed packet §21,
 * PR-80): `feed.seenSeparator` stands between the last unseen card and the
 * first seen one, reads "Already seen", and with nothing unseen the feed
 * opens at it rather than at the empty state. The derive's half is
 * `FeedDeriveTest`; recording is `FeedViewModelTest.readingTheTailRecordsNothing`.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class FeedSeenTailTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(posts: List<String>, seenTail: Set<String>) {
        compose.setContent {
            FeedScreen(
                state = FeedUiState(loading = false, posts = posts.map { testPost(it) }, seenTail = seenTail),
                onRefresh = {},
                onLoadMore = {},
                onOpenPost = {},
                onOpenActor = {},
                onOpenTopic = {},
            )
        }
        compose.waitForIdle()
    }

    private fun top(tag: String) = compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInRoot.top

    private fun bottom(tag: String) = compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInRoot.bottom

    /** FeedSeenTail.md: the separator reads Already seen and stands under the last unseen row. */
    @Test
    fun the_separator_stands_under_the_last_unseen_card() {
        render(posts = listOf("u1", "s1"), seenTail = setOf("s1"))

        compose.onNodeWithTag(SEPARATOR_LABEL).assertTextEquals("Already seen")
        assertThat(top(SEPARATOR)).isAtLeast(bottom(feedCard("u1")))
        assertThat(bottom(SEPARATOR)).isAtMost(top(feedCard("s1")))
    }

    /**
     * PR-80's named device test (FeedSeenTail.md "WHEN the feed loads GIVEN …
     * nothing the filter admits is unseen …"): the feed opens at the
     * separator, the seen cards under it, and the empty state never stands.
     */
    @Test
    fun nothing_unseen_opens_the_feed_at_the_separator() {
        render(posts = listOf("s1", "s2"), seenTail = setOf("s1", "s2"))

        compose.onNodeWithTag(SEPARATOR).assertExists()
        compose.onNodeWithTag("feed_empty").assertDoesNotExist()
        assertThat(bottom(SEPARATOR)).isAtMost(top(feedCard("s1")))
        assertThat(top(feedCard("s1"))).isLessThan(top(feedCard("s2")))
    }

    /** FeedSeenTail.md: no row the reader has seen, no separator. */
    @Test
    fun no_separator_stands_without_a_seen_row() {
        render(posts = listOf("u1", "u2"), seenTail = emptySet())

        compose.onNodeWithTag(SEPARATOR).assertDoesNotExist()
    }

    private companion object {
        const val SEPARATOR = "feed.seenSeparator"
        const val SEPARATOR_LABEL = "feed.seenSeparator.label"
    }
}
