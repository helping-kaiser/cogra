// AN APPLICANT CANNOT COMMENT, AND EVERY DOOR SAYS SO IN PLACE (ReplyEntry.md:25-29;
// copy-voice "The applicant-foot family"; hand test A18-3): the thread raised
// over the feed or over a post answers `Add a comment` and Reply with `You can
// comment once you're in.`, and the composer never opens. Driven through the real
// NavHost and the real thread holder, which is where the lock was lost.

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.ComposeNavigator
import androidx.navigation.testing.TestNavHostController
import com.cogra.app.HiltTestActivity
import com.cogra.app.di.ScriptedAccountRepository
import com.cogra.app.di.ScriptedContentRepository
import com.cogra.app.di.ScriptedOnboardingRepository
import com.cogra.app.di.ScriptedProfileRepository
import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.AuthTokens
import com.cogra.domain.Page
import com.cogra.domain.ReaderStanding
import com.cogra.domain.UserProfile
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import javax.inject.Inject
import com.cogra.domain.PostDetail as PostDetailView

@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class ApplicantCommentGateTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var onboarding: ScriptedOnboardingRepository

    @Inject lateinit var content: ScriptedContentRepository

    @Inject lateinit var profiles: ScriptedProfileRepository

    @Inject lateinit var standing: ReaderStanding

    private lateinit var navController: TestNavHostController

    @Before
    fun inject() {
        hilt.inject()
    }

    /** A signed-in applicant on their feed, one post with one comment on it, the shell's read answered. */
    private fun applicantOnTheFeed() {
        runBlocking { tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1")) }
        identity.seed = ActorKey.generate().seed()
        profiles.profile = testProfile(id = "u1", handle = "joiner")
        account.profile = UserProfile("u1", "joiner", null, AccountState.APPLICANT, false, invitedBy = null)
        onboarding.status = ApplicationStatus(
            accountState = AccountState.APPLICANT,
            application = ApplicationView(
                handle = "joiner",
                emailVerified = true,
                keyAttached = true,
                approvedAt = null,
                landedAt = null,
            ),
            stagedRegistration = null,
            actorPubkey = null,
        )
        val post = testPost("p1")
        content.listing = listOf(post)
        content.details["p1"] = PostDetailView(
            post = post,
            comments = Page(listOf(testComment("c1")), null, hasNextPage = false),
        )
        compose.setContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            CograNavGraph(navController = navController)
        }
        compose.waitForIdle()
        waitForTag("feed.card:p1")
        compose.waitUntil(timeoutMillis = 30_000) { standing.applicant }
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForLine() {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithText(COMMENT_LOCKED, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun composerOnTheStack(): Boolean =
        navController.currentBackStack.value.any { it.destination.hasRoute<ReplyWizard>() }

    // ReplyEntry.md:25 — the thread a feed card's count raises: Add a comment
    // GIVEN an applicant -> the line AND NEVER the composer opens.
    @Test
    fun anApplicantsAddACommentOverTheFeedSaysTheLine() {
        applicantOnTheFeed()
        compose.onNodeWithTag("feed.card.actionRow.comments").performClick()
        waitForTag("detail_add_comment")
        compose.onNodeWithTag("detail_add_comment").performClick()
        waitForLine()
        compose.waitForIdle()
        assertThat(composerOnTheStack()).isFalse()
    }

    // ReplyEntry.md:25 — the thread over the post's own page, both doors.
    @Test
    fun anApplicantsDoorsInTheThreadOverAPostSayTheLine() {
        applicantOnTheFeed()
        compose.onNodeWithTag("feed.card:p1").performClick()
        waitForTag("postDetail.card.actionRow.comments")
        compose.onNodeWithTag("postDetail.card.actionRow.comments").performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(REPLY, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag(REPLY, useUnmergedTree = true).performClick()
        waitForLine()
        compose.waitForIdle()
        assertThat(composerOnTheStack()).isFalse()
        compose.onNodeWithTag("detail_add_comment").performClick()
        compose.waitForIdle()
        assertThat(composerOnTheStack()).isFalse()
    }

    // NEVER the composer opens — not even for an entry that reached the stack
    // past the thread's doors: it leaves, saying the line, as the post wizard's does.
    @Test
    fun aReplyEntryAnApplicantReachesAnotherWayLeavesTheStack() {
        applicantOnTheFeed()
        compose.runOnUiThread {
            navController.navigate(
                ReplyWizard(
                    targetId = "p1",
                    isComment = false,
                    title = "t",
                    snippet = "s",
                    authorHandle = "ada",
                    avatarUrl = null,
                ),
            )
        }
        waitForLine()
        compose.waitUntil(timeoutMillis = 30_000) { !composerOnTheStack() }
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
    }

    private companion object {
        const val COMMENT_LOCKED = "You can comment once you're in."

        /** The one comment's Reply in the thread (`postDetail.threadSheet`). */
        const val REPLY = "postDetail.threadSheet.commentCard.actionRow.reply"
    }
}
