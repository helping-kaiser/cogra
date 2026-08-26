package com.cogra.feature.topics

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.testHashtag
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TopicScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        state: TopicUiState,
        onFollow: () -> Unit = {},
        onOpenUnfollow: () -> Unit = {},
        onDismissUnfollow: () -> Unit = {},
        onConfirmUnfollow: () -> Unit = {},
        onOpenPost: (String) -> Unit = {},
    ) {
        compose.setContent {
            TopicScreen(
                name = "rust",
                state = state,
                onRefresh = {},
                onFollow = onFollow,
                onOpenUnfollow = onOpenUnfollow,
                onDismissUnfollow = onDismissUnfollow,
                onConfirmUnfollow = onConfirmUnfollow,
                onOpenPost = onOpenPost,
                onOpenActor = {},
                onBack = {},
            )
        }
    }

    @Test
    fun aLoadingTopicShowsTheSpinner() {
        render(TopicUiState(loading = true))
        compose.onNodeWithTag("topic_loading").assertExists()
    }

    @Test
    fun aNameTheSubstrateCannotCarryIsReportedNotFound() {
        render(TopicUiState(loading = false, notFound = true))
        compose.onNodeWithTag("topic_not_found").assertExists()
    }

    @Test
    fun theTitleNamesTheCanonicalTopic() {
        render(TopicUiState(loading = false, hashtag = testHashtag("rust")))
        compose.onNodeWithTag("topic_title").assertExists()
    }

    @Test
    fun notFollowingShowsTheFollowButtonAndTappingItCallsBack() {
        var followed = false
        render(
            TopicUiState(loading = false, hashtag = testHashtag("rust"), following = false),
            onFollow = { followed = true },
        )
        compose.onNodeWithTag("topic_follow").assertExists()
        compose.onNodeWithTag("topic_following").assertDoesNotExist()
        compose.onNodeWithTag("topic_follow").performClick()
        assertThat(followed).isTrue()
    }

    @Test
    fun followingShowsTheFollowingButtonAndTappingItOpensUnfollow() {
        var opened = false
        render(
            TopicUiState(loading = false, hashtag = testHashtag("rust"), following = true),
            onOpenUnfollow = { opened = true },
        )
        compose.onNodeWithTag("topic_following").assertExists()
        compose.onNodeWithTag("topic_follow").assertDoesNotExist()
        compose.onNodeWithTag("topic_following").performClick()
        assertThat(opened).isTrue()
    }

    @Test
    fun aFollowFailureNamesTheHuskDeviceSeparately() {
        render(
            TopicUiState(
                loading = false,
                hashtag = testHashtag("rust"),
                followFailed = true,
                followNeedsKey = true,
            ),
        )
        compose.onNodeWithTag("topic_follow_failed").assertExists()
    }

    @Test
    fun taggedPostsRenderAndOpenOnTap() {
        var opened: String? = null
        render(
            TopicUiState(
                loading = false,
                hashtag = testHashtag("rust"),
                content = listOf(
                    TaggedContentView(
                        kind = TaggedContentKind.POST,
                        id = "p1",
                        title = "A post",
                        snippet = "body",
                        authorHandle = "alice",
                        authorDisplayName = "Alice",
                        relevance = 0.1,
                        confidence = 1.0,
                        pending = false,
                    ),
                ),
            ),
            onOpenPost = { opened = it },
        )
        compose.onNodeWithTag("topic_content_POST_p1").performClick()
        assertThat(opened).isEqualTo("p1")
    }

    @Test
    fun emptyContentShowsTheEmptyCopy() {
        render(TopicUiState(loading = false, hashtag = testHashtag("rust"), content = emptyList()))
        compose.onNodeWithTag("topic_content_empty").assertExists()
    }

    @Test
    fun theUnfollowConfirmRendersAndConfirmingCallsBack() {
        var confirmed = false
        render(
            TopicUiState(
                loading = false,
                hashtag = testHashtag("rust"),
                following = true,
                severance = SeveranceQuote(
                    target = "rust",
                    standing = StancePair(0.1, 0.1),
                    raw = StancePair(0.1, 0.1),
                    records = 1,
                    alreadySevered = false,
                ),
            ),
            onConfirmUnfollow = { confirmed = true },
        )
        compose.onNodeWithTag("topic_severance").assertExists()
        compose.onNodeWithTag("topic_severance_confirm").performClick()
        assertThat(confirmed).isTrue()
    }
}
