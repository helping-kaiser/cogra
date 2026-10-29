package com.cogra.feature.content

import androidx.activity.ComponentDialog
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.text.TextLayoutResult
import com.cogra.domain.ActorRef
import com.cogra.domain.CommentView
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.removal.RemoveContent
import com.cogra.domain.removal.RemovedMarks
import com.cogra.domain.testing.ScriptedRemovalRepository
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowDialog
import java.io.IOException
import java.time.Duration
import java.time.Instant

private const val AUTHOR_MARK = "Removed by its author"
private const val POST_DETAIL_LINE =
    "The words and pictures are gone. The post's place in the thread, and every response, remain."
private const val COMMENT_LINE = "The comment's place in the thread, and every response, remain."
private const val NOT_SENT = "That didn't send. Try again."

/**
 * Content removal, the client half, compiled from its sidecars:
 * RemoveConfirm.md, Removed.md, RemoveMenu.md:19, CommentMenuOwn.md,
 * CommentRemoveConfirm.md and CommentRemoved.md — and the own menu hosted off
 * the detail (RM-G9's build word: the card stands as its mark in place). The
 * removal runs through the real [RemoveViewModel] and [RemoveContent] over a
 * scripted contract.
 */
@RunWith(RobolectricTestRunner::class)
class RemovalScreensTest {

    @get:Rule
    val compose = createComposeRule()

    private val repo = ScriptedRemovalRepository().apply {
        // Two hours and a little before the read: the mark's `when` reads `2h`.
        removedAt = Instant.now().minus(Duration.ofMinutes(125))
    }
    private val marks = RemovedMarks()
    private val removal = RemoveViewModel(RemoveContent(repo, marks), marks)
    private var colors: ColorScheme? = null

    private val ownPost: PostView = testPost("p1").copy(genesisRecordId = "rec:p1", commentCount = 2)

    private fun renderDetail(
        post: PostView = ownPost,
        comments: List<CommentView> = emptyList(),
        replies: Map<String, ReplyThread> = emptyMap(),
        viewerId: String? = "author-1",
        backDescription: String? = null,
    ) {
        compose.setContent {
            colors = MaterialTheme.colorScheme
            CompositionLocalProvider(LocalRemoval provides removal) {
                PostDetailScreen(
                    state = PostDetailUiState(loading = false, post = post),
                    viewerId = viewerId,
                    onRefresh = {},
                    onReveal = { _, _ -> },
                    onEdit = {},
                    onOpenActor = {},
                    onOpenPost = {},
                    onOpenTopic = {},
                    onReference = {},
                    onShare = {},
                    onBack = {},
                    backDescription = backDescription,
                    stanceControl = { target, _, _ -> Box(Modifier.testTag("stance_$target")) },
                    commentsSheet = { onDismiss ->
                        CommentsSheet(
                            state = CommentsUiState(
                                loading = false,
                                comments = comments,
                                total = comments.size,
                                replyThreads = replies,
                            ),
                            viewerId = viewerId,
                            signedIn = true,
                            onDismiss = onDismiss,
                            onLoadMoreComments = {},
                            onAddComment = {},
                            onReplyTo = {},
                            onEditComment = {},
                            onCommentSignedShown = {},
                            onLoadMoreReplies = {},
                            onReveal = { _, _ -> },
                            onOpenActor = {},
                            onOpenTopic = {},
                            onReference = {},
                            onLicense = {},
                            onSignInOrJoin = {},
                            stanceControl = { target, _, _ -> Box(Modifier.testTag("stance_$target")) },
                        )
                    },
                )
            }
        }
    }

    private fun openPostConfirm() {
        compose.onNodeWithTag("postDetail.header.menu").performClick()
        compose.onNodeWithTag("postDetail.menuSheet.remove").performClick()
        compose.waitForIdle()
    }

    private fun press(part: String) = compose.onNodeWithTag("postDetail.dialog.$part").performClick()

    /** The colour a text was laid out in — what the reader sees, whatever role named it. */
    private fun inkOf(text: String): Color {
        val node = compose.onNode(
            hasText(text) and hasAnyAncestor(hasTestTag("postDetail.dialog")),
            useUnmergedTree = true,
        ).fetchSemanticsNode()
        val results = mutableListOf<TextLayoutResult>()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        return results.single().layoutInput.style.color
    }

    private val aSpinner = SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo)

    // ---- RemoveMenu.md:19 · the own menu's Remove ---------------------

    /** WHEN tap Remove -> the think-twice dialog opens (RED before: the row's dialog changed nothing). */
    @Test
    fun removeOpensTheThinkTwiceDialogOverThePost() {
        renderDetail()
        openPostConfirm()

        compose.onNodeWithTag("postDetail.dialog").assertExists()
        compose.onNodeWithTag("postDetail.dialog.title").assertExists()
        compose.onNodeWithText("Remove this post?").assertExists()
        compose.onNodeWithText("This is immediate and permanent.").assertExists()
        assertThat(repo.records).isEmpty()
    }

    // ---- RemoveConfirm.md --------------------------------------------

    /** ALWAYS Keep it is the filled answer and Remove the quiet one; ALWAYS Remove carries no error colour. */
    @Test
    fun keepItIsFilledOnTheRightAndRemoveCarriesNoErrorColour() {
        renderDetail()
        openPostConfirm()

        val remove = compose.onNodeWithTag("postDetail.dialog.remove").getUnclippedBoundsInRoot()
        val keep = compose.onNodeWithTag("postDetail.dialog.keep").getUnclippedBoundsInRoot()
        assertThat(keep.left).isAtLeast(remove.right)
        val scheme = checkNotNull(colors)
        assertThat(inkOf("Remove")).isNotEqualTo(scheme.error)
        assertThat(inkOf("Remove")).isEqualTo(scheme.primary)
        assertThat(inkOf("Keep it")).isEqualTo(scheme.onPrimary)
    }

    /**
     * WHEN press Remove -> the dialog stays up on Remove until the removal answers
     * AND Remove refuses a second press AND NEVER Remove dims; past 200ms it reads
     * Removing… AND NEVER a spinner appears.
     */
    @Test
    fun pressedRemoveHoldsRefusesASecondPressAndReadsRemovingAfter200ms() {
        val hold = CompletableDeferred<Unit>()
        repo.hold = hold
        renderDetail()
        openPostConfirm()
        compose.mainClock.autoAdvance = false

        press("remove")
        compose.mainClock.advanceTimeBy(100)
        compose.onNodeWithTag("postDetail.dialog.remove").assertTextEquals("Remove").assertIsEnabled()
        compose.mainClock.advanceTimeBy(150)
        compose.onNodeWithTag("postDetail.dialog.remove").assertTextEquals("Removing…").assertIsEnabled()
        compose.onNode(aSpinner).assertDoesNotExist()
        press("remove")
        compose.mainClock.advanceTimeBy(100)

        assertThat(repo.records).containsExactly("rec:p1")
        compose.onNodeWithTag("postDetail.dialog").assertExists()
        // The ways out hold while it is in flight: Keep it does nothing.
        press("keep")
        compose.mainClock.advanceTimeBy(100)
        compose.onNodeWithTag("postDetail.dialog").assertExists()

        hold.complete(Unit)
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        compose.onNodeWithTag("postDetail.dialog").assertDoesNotExist()
    }

    /**
     * WHEN the removal is taken -> the post stands as its mark, Removed by its
     * author AND NEVER the post leaves without a mark (Removed.md:3, :7, :11).
     */
    @Test
    fun aTakenRemovalStandsTheDetailAsRemoved() {
        renderDetail()
        openPostConfirm()
        press("remove")
        compose.waitForIdle()

        compose.onNodeWithTag("postDetail.dialog").assertDoesNotExist()
        compose.onNode(isDetailCard()).assertExists()
        compose.onNodeWithText(AUTHOR_MARK).assertExists()
        compose.onNodeWithText(POST_DETAIL_LINE).assertExists()
        compose.onNodeWithText("2h").assertExists()
        // The words, the pictures and the title went with the payload.
        compose.onNodeWithText("Body p1").assertDoesNotExist()
        compose.onNodeWithTag("postDetail.card.title").assertDoesNotExist()
        assertThat(repo.reads.single().second).isEqualTo("p1")
    }

    /**
     * ALWAYS the header carries the way back alone and no menu; ALWAYS the post
     * keeps its author chip, its opinion, its comment count and its share; WHEN
     * tap the comment count -> the thread opens (Removed.md:11-15).
     */
    @Test
    fun removedKeepsItsSkeletonAndBackIsTheWholeHeader() {
        renderDetail(backDescription = "Back to Saved")
        openPostConfirm()
        press("remove")
        compose.waitForIdle()

        compose.onNodeWithTag("postDetail.header.menu").assertDoesNotExist()
        // RM-G8's build word: the label the detail arrived with stands.
        compose.onNodeWithContentDescription("Back to Saved").assertExists()
        compose.onNodeWithTag("postDetail.card.authorChip").assertExists()
        compose.onNodeWithTag("stance_p1").assertExists()
        compose.onNodeWithTag("postDetail.card.actionRow.comments").assertExists().performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("postDetail.threadSheet").assertExists()
    }

    /** ALWAYS the mark reads Removed by its author GIVEN its author's account sweep took the post (Removed.md:5). */
    @Test
    fun anAccountSweepReadsTheAuthorsWordsAndOnlyAVerdictReadsThePlatforms() {
        val at = Instant.now().minus(Duration.ofDays(3))
        renderDetail(post = ownPost.copy(removal = Removal(at, RemovalAgent.ACCOUNT)))
        compose.onNodeWithText(AUTHOR_MARK).assertExists()
        compose.onNodeWithText("3d").assertExists()
        compose.onNodeWithText("Removed under the platform's rules").assertDoesNotExist()
    }

    /** ALWAYS the author's mark never reads like Removed under the platform's rules; MODERATION alone does. */
    @Test
    fun onlyAModerationRemovalReadsThePlatformsRules() {
        renderDetail(post = ownPost.copy(removal = Removal(Instant.now(), RemovalAgent.MODERATION)))
        compose.onNodeWithText("Removed under the platform's rules").assertExists()
        compose.onNodeWithText(AUTHOR_MARK).assertDoesNotExist()
    }

    /**
     * WHEN the removal does not go through -> the dialog stays up with its pair
     * AND the line That didn't send. Try again. stands in it AND Remove reads
     * Retry AND the post is not removed.
     */
    @Test
    fun aRemovalThatDoesNotGoThroughKeepsTheDialogWithTheLineAndRetry() {
        repo.answers += Outcome.Failed(IOException("offline"))
        renderDetail()
        openPostConfirm()
        press("remove")
        compose.waitForIdle()

        compose.onNodeWithTag("postDetail.dialog").assertExists()
        compose.onNodeWithTag("postDetail.dialog.line:failed").assertTextEquals(NOT_SENT)
        compose.onNodeWithTag("postDetail.dialog.remove").assertTextEquals("Retry")
        compose.onNodeWithTag("postDetail.dialog.keep").assertExists()
        // The line stands above the pair (SeveranceConfirm's placement).
        val line = compose.onNodeWithTag("postDetail.dialog.line:failed").getUnclippedBoundsInRoot()
        val keep = compose.onNodeWithTag("postDetail.dialog.keep").getUnclippedBoundsInRoot()
        assertThat(line.bottom).isAtMost(keep.top)
        assertThat(marks.marks.value).isEmpty()

        // Retry sends again, and a taken retry stands the post as its mark.
        press("remove")
        compose.waitForIdle()
        assertThat(repo.records).hasSize(2)
        compose.onNodeWithText(AUTHOR_MARK).assertExists()
    }

    /** WHEN press Keep it -> the dialog closes AND nothing is removed. */
    @Test
    fun keepItClosesAndRemovesNothing() {
        renderDetail()
        openPostConfirm()
        press("keep")
        compose.waitForIdle()

        compose.onNodeWithTag("postDetail.dialog").assertDoesNotExist()
        compose.onNodeWithText("Body p1").assertExists()
        assertThat(repo.records).isEmpty()
    }

    /**
     * WHEN tap the scrim -> the dialog closes AND nothing is removed. The scrim
     * and Back are one dismissal (`onDismissRequest`); Back is the one a JVM
     * test can raise on the dialog's own window.
     */
    @Test
    fun theDialogsDismissalClosesItAndRemovesNothing() {
        renderDetail()
        openPostConfirm()
        compose.runOnUiThread {
            (ShadowDialog.getLatestDialog() as ComponentDialog).onBackPressedDispatcher.onBackPressed()
        }
        compose.waitForIdle()

        compose.onNodeWithTag("postDetail.dialog").assertDoesNotExist()
        assertThat(repo.records).isEmpty()
    }

    // ---- CommentMenuOwn.md -------------------------------------------

    private val ownComment = testComment("c1", author = ActorRef("author-1", "author"))
        .copy(genesisRecordId = "rec:c1", replyCount = 1)
    private val reply = testComment("r1", body = "A reply that stays")

    private fun openThread(comments: List<CommentView> = listOf(ownComment)) {
        renderDetail(comments = comments, replies = mapOf("c1" to ReplyThread(items = listOf(reply))))
        compose.onNodeWithTag("postDetail.card.actionRow.comments").performClick()
        compose.waitForIdle()
    }

    /**
     * ALWAYS the reader's own comment's menu reads Save or Unsave, then Cite,
     * then Remove, then Cited by, then Opinions on this, then License terms;
     * ALWAYS no Report row.
     */
    @Test
    fun theOwnCommentsMenuReadsItsRowsInTheirOrder() {
        openThread()
        compose.onNodeIn(threadCard("c1"), threadPart("menu")).performClick()

        val rows = listOf("save", "cite", "remove", "citedBy", "opinions", "license").map { row ->
            compose.onNodeWithTag("postDetail.menuSheet.$row").getUnclippedBoundsInRoot().top
        }
        assertThat(rows).isInStrictOrder()
        compose.onNodeWithTag("postDetail.menuSheet.report").assertDoesNotExist()
        compose.onNodeWithTag("postDetail.menuSheet.edit").assertDoesNotExist()
    }

    @Test
    fun someoneElsesCommentCarriesNoRemoveRow() {
        openThread(listOf(testComment("c1")))
        compose.onNodeIn(threadCard("c1"), threadPart("menu")).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.citedBy").assertExists()
        compose.onNodeWithTag("postDetail.menuSheet.remove").assertDoesNotExist()
    }

    /** WHEN tap Remove -> the menu closes AND the think-twice dialog comes up over the thread. */
    @Test
    fun theOwnCommentsRemoveRaisesTheCommentsConfirmOverTheThread() {
        openThread()
        compose.onNodeIn(threadCard("c1"), threadPart("menu")).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.remove").performClick()
        compose.waitForIdle()

        compose.onNodeWithTag("postDetail.menuSheet").assertDoesNotExist()
        compose.onNodeWithTag("postDetail.threadSheet").assertExists()
        compose.onNodeWithText("Remove this comment?").assertExists()
        compose.onNodeWithText(
            "The words and pictures leave every reader's view, along with every earlier version's. " +
                "A visible mark stays in their place — \"Removed by its author\" — and the comment's spot in " +
                "its thread stays with it.",
        ).assertExists()
    }

    // ---- CommentRemoveConfirm.md + CommentRemoved.md ------------------

    private fun removeOwnComment() {
        compose.onNodeIn(threadCard("c1"), threadPart("menu")).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.remove").performClick()
        compose.waitForIdle()
        press("remove")
        compose.waitForIdle()
    }

    /**
     * WHEN the removal is taken -> the dialog closes AND the comment's words and
     * pictures give way to the mark in the comment's own place; a removed
     * comment keeps its author and its time, carries no ⋮ and no Edit, keeps
     * its opinion and its Reply, and its replies stay under it.
     */
    @Test
    fun aTakenCommentRemovalSwapsTheOneNodeForItsMark() {
        openThread()
        val before = compose.onNodeWithTag(threadCard("c1")).getUnclippedBoundsInRoot().top
        removeOwnComment()

        compose.onNodeWithTag("postDetail.dialog").assertDoesNotExist()
        compose.onNodeWithText(AUTHOR_MARK).assertExists()
        compose.onNodeWithText(COMMENT_LINE).assertExists()
        compose.onNodeWithText("Comment c1").assertDoesNotExist()
        compose.onNodeIn(threadCard("c1"), threadPart("authorChip")).assertExists()
        compose.onNodeIn(threadCard("c1"), threadPart("menu")).assertDoesNotExist()
        compose.onNodeIn(threadCard("c1"), threadPart("actionRow.edit")).assertDoesNotExist()
        compose.onNodeIn(threadCard("c1"), threadPart("actionRow.reply")).assertExists()
        compose.onNodeWithTag("stance_c1").assertExists()
        // The branch is untouched: its reply still reads, in its place.
        compose.onNodeWithText("A reply that stays").assertExists()
        // ALWAYS the thread holds the reader's offset: the comment did not move.
        assertThat(compose.onNodeWithTag(threadCard("c1")).getUnclippedBoundsInRoot().top).isEqualTo(before)
        assertThat(repo.records).containsExactly("rec:c1")
        assertThat(repo.reads.single().second).isEqualTo("c1")
    }

    /**
     * WHEN the removal does not go through -> the dialog stays up with its pair
     * AND its commitment reads Retry AND NEVER the comment is marked removed;
     * the line stands as the post's does (RM-G7's build word).
     */
    @Test
    fun aCommentRemovalThatDoesNotGoThroughReadsRetryAndMarksNothing() {
        repo.answers += Outcome.Failed(IOException("offline"))
        openThread()
        removeOwnComment()

        compose.onNodeWithTag("postDetail.dialog").assertExists()
        compose.onNodeWithTag("postDetail.dialog.remove").assertTextEquals("Retry")
        compose.onNodeWithTag("postDetail.dialog.line:failed").assertTextEquals(NOT_SENT)
        compose.onNodeWithText("Comment c1").assertExists()
        compose.onNodeWithText(AUTHOR_MARK).assertDoesNotExist()
    }

    /** WHEN tap Keep it -> the dialog closes AND the thread stands as it was. */
    @Test
    fun keepingTheCommentLeavesTheThreadAsItWas() {
        openThread()
        compose.onNodeIn(threadCard("c1"), threadPart("menu")).performClick()
        compose.onNodeWithTag("postDetail.menuSheet.remove").performClick()
        compose.waitForIdle()
        press("keep")
        compose.waitForIdle()

        compose.onNodeWithTag("postDetail.dialog").assertDoesNotExist()
        compose.onNodeWithText("Comment c1").assertExists()
        compose.onNodeIn(threadCard("c1"), threadPart("menu")).assertExists()
        assertThat(repo.records).isEmpty()
    }

    // ---- RM-G9 · the own menu off the detail -------------------------

    /** A post removed from its feed card stands as its mark in place, its ⋮ gone with the payload. */
    @Test
    fun aFeedCardRemovedFromItsOwnMenuStandsAsItsMarkInPlace() {
        compose.setContent {
            CompositionLocalProvider(LocalRemoval provides removal) {
                FeedScreen(
                    state = FeedUiState(loading = false, posts = listOf(ownPost, testPost("p2"))),
                    onRefresh = {},
                    onLoadMore = {},
                    onOpenPost = {},
                    onOpenActor = {},
                    onOpenTopic = {},
                    viewerId = "author-1",
                )
            }
        }
        compose.onNodeIn(feedCard("p1"), "feed.card.menu").performClick()
        compose.onNodeWithTag("feed.menuSheet.remove").performClick()
        compose.waitForIdle()
        compose.onNodeWithTag("feed.dialog.remove").performClick()
        compose.waitForIdle()

        compose.onNodeWithTag(feedCard("p1")).assertExists()
        compose.onNodeWithText(AUTHOR_MARK).assertExists()
        compose.onNodeIn(feedCard("p1"), "feed.card.menu").assertDoesNotExist()
        // The card beside it is untouched.
        compose.onNodeWithText("Body p2").assertExists()
        assertThat(repo.records).containsExactly("rec:p1")
    }

    /** A mark taken elsewhere reaches a card held from before: the remembered page picks it up. */
    @Test
    fun aRememberedFeedPagePicksUpAMarkTakenElsewhere() {
        marks.record("p1", Removal(repo.removedAt, RemovalAgent.AUTHOR))
        compose.setContent {
            CompositionLocalProvider(LocalRemoval provides removal) {
                FeedScreen(
                    state = FeedUiState(loading = false, posts = listOf(ownPost)),
                    onRefresh = {},
                    onLoadMore = {},
                    onOpenPost = {},
                    onOpenActor = {},
                    onOpenTopic = {},
                    viewerId = "author-1",
                )
            }
        }

        compose.onNodeWithText(AUTHOR_MARK).assertExists()
        compose.onNodeWithText("Body p1").assertDoesNotExist()
    }
}
