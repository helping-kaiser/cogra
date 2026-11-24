package com.cogra.feature.content

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.domain.CommentView
import com.cogra.domain.Outcome
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testContentTarget
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.cogra.feature.content.edit.SLOW_ANSWER_MS
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException

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

    private val reads = ScriptedReferenceReads()

    private fun thread(
        comment: CommentView = testComment("c1").copy(
            topics = listOf(testTopicClaim("saltmaps")),
            references = listOf(testReferenceClaim(testContentTarget("p7"))),
        ),
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalReferenceReads provides reads.reads) {
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

    // -- The thread's card carries the count; the sheet reads the rows by id --

    /** A thread comment read off a page: the count, no list (api-spec.md "Query budgets"). */
    private fun counted(count: Int) = testComment("c1", references = null).copy(
        topics = listOf(testTopicClaim("saltmaps")),
        referenceCount = count,
    )

    @Test
    fun theThreadsLinePrintsTheCountItsReadCarried() {
        thread(counted(3))
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 3 references")
        // Nothing is read until the sheet rises.
        assertThat(reads.asked).isEmpty()
    }

    @Test
    fun theSheetReadsTheCommentsRowsByIdAsItRises() {
        reads.answer = Outcome.Success(listOf(testReferenceClaim(testContentTarget("p7"))))
        thread(counted(1))
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").assertExists()
        assertThat(reads.asked).containsExactly(ReferenceContentKind.COMMENT to "c1")
    }

    @Test
    fun everyRiseReadsAfresh() {
        reads.answer = Outcome.Success(listOf(testReferenceClaim(testContentTarget("p7"))))
        thread(counted(1))
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        // A row leaves and drops the sheet; the count raises it again.
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").performClick()
        compose.onNodeWithTag("comment_c1_refs_sheet").assertDoesNotExist()
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").assertExists()
        assertThat(reads.asked).hasSize(2)
    }

    @Test
    fun theRowsWaitBehindTheHouseLoadingLine() {
        val gate = CompletableDeferred<Unit>()
        reads.gate = gate
        reads.answer = Outcome.Success(listOf(testReferenceClaim(testContentTarget("p7"))))
        thread(counted(1))
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.mainClock.advanceTimeBy(SLOW_ANSWER_MS * 2)
        compose.onNodeWithTag("comment_c1_refs_loading").assertTextEquals("Loading…")
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").assertDoesNotExist()
        // The tags are on the card already and never wait.
        compose.onNodeWithTag("comment_c1_refs_topic_saltmaps").assertExists()
        gate.complete(Unit)
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").assertExists()
        compose.onNodeWithTag("comment_c1_refs_loading").assertDoesNotExist()
    }

    @Test
    fun aReadWithNoAnswerSaysTheHouseLineOverRetry() {
        reads.answer = Outcome.Failed(IOException("offline"))
        thread(counted(1))
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_error")
            .assertTextEquals("Can't reach the server. Check the connection and retry.")
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").assertDoesNotExist()
        reads.answer = Outcome.Success(listOf(testReferenceClaim(testContentTarget("p7"))))
        compose.onNodeWithTag("comment_c1_refs_retry").performClick()
        compose.onNodeWithTag("comment_c1_refs_reference_l1-p7").assertExists()
        compose.onNodeWithTag("comment_c1_refs_error").assertDoesNotExist()
        assertThat(reads.asked).hasSize(2)
    }

    @Test
    fun aCountOfZeroReadsNothing() {
        // Three tags: two chips and `· 1 tag`, the door the sheet rises from.
        thread(
            counted(0).copy(
                topics = listOf(testTopicClaim("saltmaps"), testTopicClaim("coast"), testTopicClaim("roads")),
            ),
        )
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_topic_roads").assertExists()
        compose.onNodeWithTag("comment_c1_refs_loading").assertDoesNotExist()
        compose.onNodeWithTag("comment_c1_refs_error").assertDoesNotExist()
        assertThat(reads.asked).isEmpty()
    }
}
