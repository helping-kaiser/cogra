package com.cogra.feature.topics

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
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
        stanceControl: (@Composable () -> Unit)? = null,
    ) {
        compose.setContent {
            TopicScreen(
                name = "rust",
                state = state,
                onRefresh = {},
                onOpenPost = onOpenPost,
                onOpenActor = {},
                onBack = {},
                stanceControl = stanceControl,
            )
        }
    }

    /** A stand-in for the shell's row: this module never builds one. */
    private val row: @Composable () -> Unit = {
        Text("row", modifier = Modifier.testTag("stance_row_content"))
    }

    private fun taggedPost(id: String) = TaggedContentView(
        kind = TaggedContentKind.POST,
        id = id,
        title = "A post",
        snippet = "body",
        authorHandle = "alice",
        authorDisplayName = "Alice",
        relevance = 0.1,
        confidence = 1.0,
        pending = false,
    )

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

    /**
     * Following a topic IS the stance gesture (jakob 2026-09-14): one
     * gesture, one ceremony, one face table. So there is no toggle, no
     * one-tap follow, and no second severance surface of this screen's
     * own — and the row itself is the shell's, never this module's.
     */
    @Test
    fun theScreenBuildsNoFollowControlOfItsOwn() {
        render(TopicUiState(loading = false, hashtag = testHashtag("rust"), content = listOf(taggedPost("p1"))))
        compose.onNodeWithTag("topic_follow").assertDoesNotExist()
        compose.onNodeWithTag("topic_following").assertDoesNotExist()
        compose.onNodeWithTag("topic_severance").assertDoesNotExist()
        // Nothing was passed in, so nothing stands where the row goes.
        compose.onNodeWithTag("topic_stance_row").assertDoesNotExist()
    }

    @Test
    fun aPopulatedTopicCarriesTheStanceRowTheShellPassesIn() {
        render(
            TopicUiState(loading = false, hashtag = testHashtag("rust"), content = listOf(taggedPost("p1"))),
            stanceControl = row,
        )
        compose.onNodeWithTag("topic_stance_row").assertExists()
        compose.onNodeWithTag("stance_row_content").assertExists()
    }

    @Test
    fun theEmptyPageWiresNoFaceAtAll() {
        // Backlog item 81, ruled 2026-09-15: a page with nothing tagged
        // carries no stance control, which is why the row sits inside
        // the populated branch rather than under the title outright.
        render(
            TopicUiState(loading = false, hashtag = testHashtag("rust"), content = emptyList()),
            stanceControl = row,
        )
        compose.onNodeWithTag("topic_stance_row").assertDoesNotExist()
        compose.onNodeWithTag("topic_content_empty").assertExists()
    }

    @Test
    fun taggedPostsRenderAndOpenOnTap() {
        var opened: String? = null
        render(
            TopicUiState(loading = false, hashtag = testHashtag("rust"), content = listOf(taggedPost("p1"))),
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
