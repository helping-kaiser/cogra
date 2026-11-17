package com.cogra.feature.content

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testContentTarget
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * A COMMENT'S COUNT IS A DOOR IN THE THREAD TOO (TopicsLine.jsx:202-212; the
 * design session, seam 352 — round 51 writes the line): the tags-and-references
 * sheet comes up stacked over the thread, and a row that leaves the surface
 * leaves the thread's place behind, as every door out of it does.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class ThreadRefsSheetTest {

    @get:Rule
    val compose = createComposeRule()

    private val opened = mutableListOf<String>()
    private var departed = 0

    private fun thread() {
        val comment = testComment("c1").copy(
            topics = listOf(testTopicClaim("saltmaps")),
            references = listOf(testReferenceClaim(testContentTarget("p7"))),
        )
        compose.setContent {
            CommentsSheet(
                state = CommentsUiState(loading = false, comments = listOf(comment)),
                viewerId = null,
                signedIn = true,
                onDismiss = {},
                onLoadMoreComments = {},
                onAddComment = {},
                onReplyTo = {},
                onEditComment = {},
                onCommentSignedShown = {},
                onLoadMoreReplies = {},
                onReveal = { _, _ -> },
                onOpenActor = { opened += "actor:$it" },
                onOpenTopic = { opened += "topic:$it" },
                onOpenPost = { opened += "post:$it" },
                onReference = {},
                onLicense = {},
                onSignInOrJoin = {},
                onDepart = { departed++ },
            )
        }
    }

    @Test
    fun theCountRaisesTheSheetOverTheThread() {
        thread()
        compose.onNodeWithTag("comment_c1_refs_sheet").assertDoesNotExist()
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_sheet").assertExists()
        // The thread stands beneath it.
        compose.onNodeWithTag("detail_add_comment").assertExists()
    }

    @Test
    fun aCitedPostsRowOpensThePostAndLeavesTheThreadsPlace() {
        thread()
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").performClick()
        compose.onNodeWithTag("comment_c1_refs_sheet").assertDoesNotExist()
        assertThat(opened).containsExactly("post:p7")
        assertThat(departed).isEqualTo(1)
    }

    @Test
    fun aTagRowOpensTheTagsPage() {
        thread()
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_topic_saltmaps").performClick()
        assertThat(opened).containsExactly("topic:saltmaps")
    }
}
