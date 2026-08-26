package com.cogra.feature.topics

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView
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
        onOpenPost: (String) -> Unit = {},
    ) {
        compose.setContent {
            TopicScreen(
                name = "rust",
                state = state,
                onRefresh = {},
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

    /** Follow is a slice-3 surface (F5): the screen offers no stance control. */
    @Test
    fun theScreenCarriesNoFollowControl() {
        render(TopicUiState(loading = false, hashtag = testHashtag("rust")))
        compose.onNodeWithTag("topic_follow").assertDoesNotExist()
        compose.onNodeWithTag("topic_following").assertDoesNotExist()
        compose.onNodeWithTag("topic_severance").assertDoesNotExist()
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
}
