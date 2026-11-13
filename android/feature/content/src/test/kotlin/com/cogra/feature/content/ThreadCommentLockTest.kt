package com.cogra.feature.content

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.domain.testing.testComment
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * AN APPLICANT'S TWO DOORS INTO THE THREAD'S COMPOSER (ReplyEntry.md:25-29;
 * PR-103): `Add a comment` and a comment's Reply answer `You can comment once
 * you're in.` on the sheet's own snackbar and never open the composer. A
 * member's doors are unchanged; a guest's foot keeps its join entry.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class ThreadCommentLockTest {

    @get:Rule
    val compose = createComposeRule()

    private var added = 0
    private val repliedTo = mutableListOf<String>()

    @Composable
    private fun Thread(locked: Boolean, signedIn: Boolean? = true) {
        CommentsSheet(
            state = CommentsUiState(loading = false, comments = listOf(testComment("c1")), commentLocked = locked),
            viewerId = null,
            signedIn = signedIn,
            onDismiss = {},
            onLoadMoreComments = {},
            onAddComment = { added++ },
            onReplyTo = { repliedTo += it.id },
            onEditComment = {},
            onCommentSignedShown = {},
            onLoadMoreReplies = {},
            onReveal = { _, _ -> },
            onOpenActor = {},
            onOpenTopic = {},
            onReference = {},
            onLicense = {},
            onSignInOrJoin = {},
        )
    }

    private fun waitForLine() {
        compose.waitUntil(timeoutMillis = 10_000) {
            compose.onAllNodesWithText(LINE, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    // ReplyEntry.md:25 — Add a comment pressed GIVEN an applicant -> the line AND NEVER the composer opens
    @Test
    fun anApplicantsAddACommentSaysTheLineAndOpensNothing() {
        compose.setContent { Thread(locked = true) }
        compose.onNodeWithTag("detail_add_comment").performClick()
        waitForLine()
        assertThat(added).isEqualTo(0)
    }

    // ReplyEntry.md:25 — a comment's Reply pressed GIVEN an applicant -> the line AND NEVER the composer opens
    @Test
    fun anApplicantsReplySaysTheLineAndOpensNothing() {
        compose.setContent { Thread(locked = true) }
        compose.onNodeIn(threadCard("c1"), threadPart("actionRow.reply")).performClick()
        waitForLine()
        assertThat(repliedTo).isEmpty()
    }

    // A member's doors open the composer, with no line.
    @Test
    fun aMembersDoorsStillOpenTheComposer() {
        compose.setContent { Thread(locked = false) }
        compose.onNodeWithTag("detail_add_comment").performClick()
        compose.onNodeIn(threadCard("c1"), threadPart("actionRow.reply")).performClick()
        compose.waitForIdle()
        assertThat(added).isEqualTo(1)
        assertThat(repliedTo).containsExactly("c1")
        assertThat(compose.onAllNodesWithText(LINE, useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()
    }

    // A guest's foot keeps its join entry (ReplyEntry.md:23).
    @Test
    fun aGuestsFootStillJoins() {
        compose.setContent { Thread(locked = false, signedIn = false) }
        compose.onNodeWithTag("detail_comment_signin").assertExists()
        compose.onNodeWithTag("detail_add_comment").assertDoesNotExist()
    }

    private companion object {
        const val LINE = "You can comment once you're in."
    }
}
