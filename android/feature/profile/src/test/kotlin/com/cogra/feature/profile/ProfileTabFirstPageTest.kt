// A profile card tab's first page, not yet in or not coming (`_shared.jsx`
// `ProfileTabFirstPage`; ProfilePosts.md:21-27, ProfilePostsOwn.md:31-37,
// ProfileComments.md:25-31, ProfileCommentsOwn.md:31-37): the wait on the
// view's `loading` once 200ms late, the first-page line on its `moreFault`
// with the inline Retry, and Everything's tail as it was.

package com.cogra.feature.profile

import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
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
import org.robolectric.annotation.Config
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class ProfileTabFirstPageTest {

    @get:Rule
    val compose = createComposeRule()

    private var state by mutableStateOf(ProfileUiState())
    private var retried = 0

    /** The shell's cards, stood in: a line wearing the node the screen hands it. */
    private val cardsDrawn: ProfileCardsHost = { _, content ->
        content(
            ProfileCards(
                post = { post, node -> Text(post.id, Modifier.dataNode(node.keyed(post.id))) },
                comment = { listed, node, _, _ ->
                    Text(listed.comment.id, Modifier.dataNode(node.keyed(listed.comment.id)))
                },
            ),
        )
    }

    private fun loaded(tab: ProfileTab, own: Boolean = false) = ProfileUiState(
        loading = false,
        profile = testProfile(id = "u1", handle = "ada", displayName = "Ada L"),
        own = own,
        tab = tab,
    )

    private fun render(initial: ProfileUiState) {
        state = initial
        compose.setContent {
            ProfileScreen(
                state = state,
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onTabChange = {},
                onLoadMore = {},
                onRetryPage = { retried++ },
                onRetry = {},
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = {},
                onBack = null,
                cardsHost = cardsDrawn,
                now = Instant.parse("2026-11-24T12:00:00Z"),
            )
        }
    }

    private fun withCards(s: ProfileUiState): ProfileUiState = when (s.tab) {
        ProfileTab.POSTS -> s.copy(posts = listOf(testPost("p1")))
        ProfileTab.COMMENTS -> s.copy(comments = listOf(ProfileComment(testComment("c1"), null, "p1")))
        ProfileTab.EVERYTHING -> s.copy(rows = listOf(RecordRow("r", Family.PUBLISH, true, "x", null)))
    }

    private fun card(tab: ProfileTab) = when (tab) {
        ProfileTab.POSTS -> "profile.posts.card:p1"
        else -> "profile.comments.commentCard:c1"
    }

    private fun faultLine(tab: ProfileTab) = when (tab) {
        ProfileTab.POSTS -> "Can't reach the server — posts can't load right now."
        else -> "Can't reach the server — comments can't load right now."
    }

    /**
     * Exactly [ms] of virtual time, never rounded up to a whole frame: a
     * wait of 199ms must stay 199ms.
     */
    private fun upTo(ms: Long) {
        compose.mainClock.advanceTimeBy(ms, ignoreFrameDuration = true)
    }

    /** One frame: a changed state composes, and a read it starts starts its clock here. */
    private fun frame() {
        compose.mainClock.advanceTimeByFrame()
    }

    /**
     * The screen is handed [next]: the write is announced to the composition
     * (the clock is held, so nothing else would) and the next frame draws it.
     */
    private fun hand(next: ProfileUiState) {
        state = next
        Snapshot.sendApplyNotifications()
        frame()
    }

    /** Up to [ms] since the read's frame, the last frame drawn at exactly [ms]. */
    private fun drawnAt(ms: Long) {
        upTo(ms - FRAME_MS)
        frame()
    }

    /** The wait's last millisecond passes, and the frame that follows draws what it brought. */
    private fun theWaitEnds() {
        upTo(1)
        frame()
    }

    // ProfilePosts.md:23, :25, :27 (ProfileComments.md:27, :29, :31; the own
    // twins :33-37): the first-page line on `moreFault`, never `Couldn't load
    // more`, never the empty line; Retry asks again, its own wait 200ms; the
    // cards arrive and the line goes.
    private fun aFirstPageThatDidNotArriveOffersRetry(tab: ProfileTab, own: Boolean) {
        val view = "profile.${tab.id}"
        compose.mainClock.autoAdvance = false
        render(loaded(tab, own).copy(pageFailed = true))
        frame()
        compose.onNodeWithTag("$view.moreFault").performScrollTo().assertTextEquals(faultLine(tab))
        compose.onAllNodesWithText("Couldn't load more").assertCountEquals(0)
        compose.onAllNodesWithTag("$view.empty").assertCountEquals(0)
        compose.onAllNodesWithTag("profile_rows_failed").assertCountEquals(0)

        compose.onNodeWithTag("$view.moreFault.retry").assertTextEquals("Retry").performClick()
        assertThat(retried).isEqualTo(1)

        // The retried read is asked: its own wait starts on the frame that draws it.
        hand(state.copy(pageFailed = false, rowsLoading = true))
        drawnAt(LOADING_AFTER_MS / 2)
        compose.onAllNodesWithTag("$view.loading").assertCountEquals(0)
        compose.onAllNodesWithTag("$view.moreFault").assertCountEquals(0)
        compose.onAllNodesWithTag("$view.empty").assertCountEquals(0)
        drawnAt(LOADING_AFTER_MS / 2 + FRAME_MS)
        compose.onNodeWithTag("$view.loading").performScrollTo().assertTextEquals("Loading…")

        hand(withCards(state).copy(rowsLoading = false))
        compose.onNodeWithTag(card(tab)).performScrollTo()
        compose.onAllNodesWithTag("$view.moreFault").assertCountEquals(0)
        compose.onAllNodesWithTag("$view.loading").assertCountEquals(0)
    }

    @Test
    fun anothersPostsTabsFirstPageThatDidNotArriveOffersRetry() =
        aFirstPageThatDidNotArriveOffersRetry(ProfileTab.POSTS, own = false)

    @Test
    fun yourPostsTabsFirstPageThatDidNotArriveOffersRetry() =
        aFirstPageThatDidNotArriveOffersRetry(ProfileTab.POSTS, own = true)

    @Test
    fun anothersCommentsTabsFirstPageThatDidNotArriveOffersRetry() =
        aFirstPageThatDidNotArriveOffersRetry(ProfileTab.COMMENTS, own = false)

    @Test
    fun yourCommentsTabsFirstPageThatDidNotArriveOffersRetry() =
        aFirstPageThatDidNotArriveOffersRetry(ProfileTab.COMMENTS, own = true)

    // ProfilePosts.md:21 / ProfileComments.md:25: nothing at 199ms — never the
    // empty line meanwhile — then `Loading…` on the view's `loading`.
    private fun theFirstPageWaitsItsOwn200ms(tab: ProfileTab) {
        val view = "profile.${tab.id}"
        compose.mainClock.autoAdvance = false
        render(loaded(tab).copy(rowsLoading = true))
        drawnAt(LOADING_AFTER_MS - 1)
        compose.onNodeWithTag("profile.tabRow.postsTab").assertExists()
        compose.onAllNodesWithTag("$view.loading").assertCountEquals(0)
        compose.onAllNodesWithTag("$view.empty").assertCountEquals(0)
        compose.onAllNodesWithTag("profile_rows_loading").assertCountEquals(0)
        theWaitEnds()
        compose.onNodeWithTag("$view.loading").performScrollTo().assertTextEquals("Loading…")
        compose.onAllNodesWithTag("profile_rows_loading").assertCountEquals(0)
        compose.onAllNodesWithTag("$view.empty").assertCountEquals(0)
    }

    @Test
    fun thePostsTabsFirstPageWaits200msBeforeLoading() = theFirstPageWaitsItsOwn200ms(ProfileTab.POSTS)

    @Test
    fun theCommentsTabsFirstPageWaits200msBeforeLoading() = theFirstPageWaitsItsOwn200ms(ProfileTab.COMMENTS)

    // A first page answered inside the 200ms never shows `Loading…`.
    @Test
    fun aFirstPageAnsweredInTimeNeverShowsLoading() {
        compose.mainClock.autoAdvance = false
        render(loaded(ProfileTab.POSTS).copy(rowsLoading = true))
        drawnAt(LOADING_AFTER_MS / 2)
        hand(withCards(state).copy(rowsLoading = false))
        drawnAt(LOADING_AFTER_MS)
        compose.onAllNodesWithTag("profile.posts.loading").assertCountEquals(0)
        compose.onAllNodesWithTag("profile_rows_loading").assertCountEquals(0)
        compose.onNodeWithTag("profile.posts.card:p1").performScrollTo()
    }

    // A tab switched mid-read times its 200ms from its own ask, never from the
    // old tab's.
    @Test
    fun aTabSwitchedMidReadTimesItsOwnWait() {
        compose.mainClock.autoAdvance = false
        render(loaded(ProfileTab.POSTS).copy(rowsLoading = true))
        upTo(LOADING_AFTER_MS - 50)
        // The switch's frame starts the Comments read's clock; the Posts read's
        // 200ms run out 50ms in and must not draw it.
        hand(state.copy(tab = ProfileTab.COMMENTS, rowsLoading = true))
        drawnAt(100)
        compose.onAllNodesWithTag("profile.comments.loading").assertCountEquals(0)
        compose.onAllNodesWithTag("profile.posts.loading").assertCountEquals(0)
        drawnAt(LOADING_AFTER_MS)
        compose.onNodeWithTag("profile.comments.loading").performScrollTo().assertTextEquals("Loading…")
    }

    // `Couldn't load more` is a failed NEXT page's line alone: under the cards
    // already on screen, never the first-page line.
    private fun aFailedLaterPageStillReadsCouldntLoadMore(tab: ProfileTab) {
        render(withCards(loaded(tab)).copy(pageFailed = true))
        compose.onNodeWithTag("profile_rows_failed").performScrollTo().assertTextEquals("Couldn't load more")
        compose.onAllNodesWithTag("profile.${tab.id}.moreFault").assertCountEquals(0)
        compose.onAllNodesWithText(faultLine(tab)).assertCountEquals(0)
        compose.onNodeWithTag(card(tab)).performScrollTo()
    }

    @Test
    fun aPostsTabsFailedLaterPageStillReadsCouldntLoadMore() =
        aFailedLaterPageStillReadsCouldntLoadMore(ProfileTab.POSTS)

    @Test
    fun aCommentsTabsFailedLaterPageStillReadsCouldntLoadMore() =
        aFailedLaterPageStillReadsCouldntLoadMore(ProfileTab.COMMENTS)

    // Everything's first page is drawn by no board (seam 462): its wait and
    // its failure stay the next page's tail, as they were.
    @Test
    fun everythingsFirstPageKeepsTheTailItHad() {
        compose.mainClock.autoAdvance = false
        render(loaded(ProfileTab.EVERYTHING).copy(rowsLoading = true))
        drawnAt(LOADING_AFTER_MS - 1)
        compose.onNodeWithTag("profile.tabRow.postsTab").assertExists()
        compose.onAllNodesWithTag("profile_rows_loading").assertCountEquals(0)
        theWaitEnds()
        compose.onNodeWithTag("profile_rows_loading").performScrollTo().assertTextEquals("Loading…")
        compose.onAllNodesWithTag("profile.chronicle.loading").assertCountEquals(0)

        hand(state.copy(rowsLoading = false, pageFailed = true))
        compose.onNodeWithTag("profile_rows_failed").performScrollTo().assertTextEquals("Couldn't load more")
        compose.onNodeWithTag("profile_rows_retry").performClick()
        assertThat(retried).isEqualTo(1)
        compose.onAllNodesWithTag("profile.chronicle.moreFault").assertCountEquals(0)
    }
}

/** The test clock's frame, as `MainTestClock` draws it. */
private const val FRAME_MS = 16L
