// The profile's tab views (ProfilePosts.md, ProfileComments.md, Profile.md:23):
// what stands below the tab row on each tab — the feed's post cards, its
// comment cards, the chronicle on Everything alone — their empty and failed
// states, and an applicant's locked Reply. The cards themselves are the feed's
// and are tested there (`HostedCardsTest`); here the shell's host is stood in.

package com.cogra.feature.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.dataNode
import com.cogra.crypto.Family
import com.cogra.domain.ProfileComment
import com.cogra.domain.RecordRow
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class ProfileTabsScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = Instant.parse("2026-10-22T12:00:00Z")

    /** Each locked Reply the comment slot was handed and tapped. */
    private var lockedTaps = 0

    /**
     * The shell's cards, stood in: each card a line wearing the node the
     * screen hands it, keyed by the thing's id. A comment's line answers a tap
     * with its locked Reply, when it was handed one.
     */
    private val cardsDrawn: ProfileCardsHost = { _, _, content ->
        content(
            ProfileCards(
                post = { post, node -> Text(post.id, Modifier.dataNode(node.keyed(post.id))) },
                comment = { listed, node, repliesNode, lockedReply ->
                    Column {
                        Text(
                            listed.comment.id,
                            Modifier
                                .dataNode(node.keyed(listed.comment.id))
                                .clickable {
                                    if (lockedReply != null) {
                                        lockedTaps++
                                        lockedReply()
                                    }
                                },
                        )
                        Text("replies", Modifier.dataNode(repliesNode.keyed(listed.comment.id)))
                    }
                },
            ),
        )
    }

    private fun loaded(own: Boolean = false, applicant: Boolean = false) = ProfileUiState(
        loading = false,
        profile = testProfile(id = "u1", handle = "ada", displayName = "Ada L"),
        own = own,
        applicant = applicant,
    )

    private fun act() = RecordRow("r", Family.PUBLISH, true, "x", null)

    private fun posts(vararg ids: String) = ids.map { testPost(it) }

    private fun comments(vararg ids: String) =
        ids.map { ProfileComment(testComment(it), target = null, threadPostId = "p1") }

    private fun render(
        state: ProfileUiState,
        onTabChange: (ProfileTab) -> Unit = {},
        onRetryPage: () -> Unit = {},
        onBack: (() -> Unit)? = null,
    ) {
        compose.setContent {
            ProfileScreen(
                state = state,
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onTabChange = onTabChange,
                onLoadMore = {},
                onRetryPage = onRetryPage,
                onRetry = {},
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = {},
                onBack = onBack,
                cardsHost = cardsDrawn,
                now = now,
            )
        }
    }

    // ProfilePosts.md:3 — "the posts view lists the person's posts as post
    // cards, never as chronicle entries", the view named `profile.posts`.
    @Test
    fun thePostsTabListsPostCardsNeverChronicleActs() {
        render(loaded().copy(tab = ProfileTab.POSTS, posts = posts("p1", "p2"), rows = listOf(act())))
        compose.onNodeWithTag("profile.tabRow.postsTab").assertIsSelected()
        compose.onNodeWithTag("profile.posts").assertExists()
        compose.onNodeWithTag("profile.posts.card:p1").performScrollTo().assertExists()
        compose.onNodeWithTag("profile.posts.card:p2").performScrollTo().assertExists()
        compose.onAllNodesWithTag("profile.chronicle.act:1").assertCountEquals(0)
        compose.onAllNodesWithTag("chronicle_row").assertCountEquals(0)
    }

    // ProfileComments.md:3, :5 — the comments view lists comment cards, each
    // carrying its replies line beside it (`profile.comments.viewReplies`),
    // never chronicle entries.
    @Test
    fun theCommentsTabListsCommentCardsWithTheirRepliesLine() {
        render(loaded().copy(tab = ProfileTab.COMMENTS, comments = comments("c1"), rows = listOf(act())))
        compose.onNodeWithTag("profile.comments").assertExists()
        compose.onNodeWithTag("profile.comments.commentCard:c1").performScrollTo().assertExists()
        compose.onNodeWithTag("profile.comments.viewReplies:c1").assertExists()
        compose.onAllNodesWithTag("chronicle_row").assertCountEquals(0)
    }

    // Profile.md:23 — the chronicle stands on Everything, the right-most tab, alone.
    @Test
    fun theChronicleStandsOnEverythingAlone() {
        render(loaded().copy(posts = posts("p1"), rows = listOf(act())))
        compose.onNodeWithTag("profile.chronicle").assertExists()
        compose.onNodeWithTag("profile.chronicle.act:1").performScrollTo().assertExists()
        compose.onAllNodesWithTag("profile.posts.card:p1").assertCountEquals(0)
    }

    // ProfilePosts.md:5, ProfileComments.md:9 — a tab with nothing in it reads
    // `Nothing here yet.` below the tab row, the line alone; even the
    // applicant's own posts and comments tabs (only their chronicle says more).
    @Test
    fun anEmptyCardTabReadsTheLineAlone() {
        render(loaded(own = true, applicant = true).copy(tab = ProfileTab.POSTS))
        compose.onNodeWithTag("profile.posts.empty").performScrollTo().assert(hasText("Nothing here yet."))
        compose.onNodeWithTag("profile.posts.empty.title", useUnmergedTree = true).assertExists()
    }

    @Test
    fun anEmptyCommentsTabReadsTheLineAlone() {
        render(loaded().copy(tab = ProfileTab.COMMENTS))
        compose.onNodeWithTag("profile.comments.empty").performScrollTo().assert(hasText("Nothing here yet."))
    }

    // An empty line never stands while the tab's first page is on its way.
    @Test
    fun noEmptyLineWhileTheFirstPageIsOnItsWay() {
        render(loaded().copy(tab = ProfileTab.POSTS, rowsLoading = true))
        compose.onAllNodesWithTag("profile.posts.empty").assertCountEquals(0)
    }

    // ProfileMoreFailed.md — a card tab's failed page stands the quiet row
    // with Retry under the cards already on screen, which stay.
    @Test
    fun aCardTabsFailedPageKeepsItsCardsAndOffersRetry() {
        var retried = 0
        render(
            loaded().copy(tab = ProfileTab.POSTS, posts = posts("p1"), pageFailed = true),
            onRetryPage = { retried++ },
        )
        compose.onNodeWithTag("profile.posts.card:p1").performScrollTo().assertExists()
        compose.onNodeWithTag("profile_rows_failed").performScrollTo().assertTextEquals("Couldn't load more")
        compose.onNodeWithTag("profile_rows_retry").performClick()
        assertThat(retried).isEqualTo(1)
    }

    // ProfileComments.md:29 — an applicant's Reply answers in the snackbar,
    // `You can comment once you're in.`, and the thread never opens; a
    // member's is handed no lock.
    @Test
    fun anApplicantsReplyAnswersInTheSnackbar() {
        render(loaded(own = true, applicant = true).copy(tab = ProfileTab.COMMENTS, comments = comments("c1")))
        compose.onNodeWithTag("profile.comments.commentCard:c1").performScrollTo().performClick()
        assertThat(lockedTaps).isEqualTo(1)
        compose.onNodeWithTag("profile.snackbar.message").assertTextEquals("You can comment once you're in.")
    }

    @Test
    fun aMembersReplyIsHandedNoLock() {
        render(loaded().copy(tab = ProfileTab.COMMENTS, comments = comments("c1")))
        compose.onNodeWithTag("profile.comments.commentCard:c1").performScrollTo().performClick()
        assertThat(lockedTaps).isEqualTo(0)
    }

    // ProfilePosts.md:13 — the header block above the tab row stands
    // unchanged in every tab view, and only the list below it changes.
    @Test
    fun theHeaderStandsInEveryTabView() {
        var shown by mutableStateOf(ProfileTab.EVERYTHING)
        compose.setContent {
            ProfileScreen(
                state = loaded().copy(tab = shown, posts = posts("p1"), comments = comments("c1")),
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onTabChange = { shown = it },
                onLoadMore = {},
                onRetry = {},
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = {},
                onBack = {},
                cardsHost = cardsDrawn,
                now = now,
            )
        }
        for (tab in listOf("postsTab", "commentsTab", "everythingTab")) {
            compose.onNodeWithTag("profile.tabRow.$tab").performClick()
            compose.onNodeWithTag("profile.identity.name").assertTextEquals("Ada L")
            compose.onNodeWithTag("profile.tabRow.$tab").assertIsSelected()
        }
    }
}
