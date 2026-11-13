// BACK FROM A SCREEN A CONTROL IN THE SHEET OPENED, THE THREAD STANDS AT THE
// OFFSET IT WAS LEFT (ReplyEntry.md, its last line; hand test A3): the reader
// scrolls the comments, opens a commenter's profile, comes back — and reads on
// from the same comment, not from the top. Driven through the real NavHost: the
// place rides the surface's back-stack entry, which is where it must survive.

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToIndex
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.ComposeNavigator
import androidx.navigation.testing.TestNavHostController
import com.cogra.app.HiltTestActivity
import com.cogra.app.di.ScriptedAccountRepository
import com.cogra.app.di.ScriptedContentRepository
import com.cogra.app.di.ScriptedProfileRepository
import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.Page
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
class ThreadPlaceReturnTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var content: ScriptedContentRepository

    @Inject lateinit var profiles: ScriptedProfileRepository

    private lateinit var navController: TestNavHostController

    @Before
    fun inject() {
        hilt.inject()
    }

    /** A member on a post's page, its thread of [COMMENTS] comments raised. */
    private fun aLongThreadRaised() {
        runBlocking { tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1")) }
        identity.seed = ActorKey.generate().seed()
        profiles.profile = testProfile(id = "u1", handle = "jakob")
        account.profile = UserProfile("u1", "jakob", null, AccountState.MEMBER, true, invitedBy = null)
        profiles.others["commenter"] = testProfile(id = "author-2", handle = "commenter")
        val post = testPost("p1")
        content.listing = listOf(post)
        content.details["p1"] = PostDetailView(
            post = post,
            comments = Page((0 until COMMENTS).map { testComment("c$it") }, null, hasNextPage = false),
        )
        compose.setContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            CograNavGraph(navController = navController)
        }
        waitForTag("feed.card:p1")
        compose.onNodeWithTag("feed.card:p1").performClick()
        waitForTag("postDetail.card.actionRow.comments")
        compose.onNodeWithTag("postDetail.card.actionRow.comments").performClick()
        waitForTag("$CARD:c0")
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private val aCommentCard = SemanticsMatcher("is a thread comment card") { node ->
        node.config.getOrNull(SemanticsProperties.TestTag)?.startsWith("$CARD:") == true
    }

    /** The comment card standing highest in the thread's list window: what the reader reads first. */
    private fun firstVisibleCard(): String {
        val list = compose.onNodeWithTag("comments_list").fetchSemanticsNode().boundsInRoot
        return compose.onAllNodes(aCommentCard).fetchSemanticsNodes()
            .filter { it.boundsInRoot.bottom > list.top && it.boundsInRoot.top < list.bottom }
            .minBy { it.boundsInRoot.top }
            .config[SemanticsProperties.TestTag]
    }

    /** The author chip standing in the list's window (every card's chip carries one tag). */
    private fun openAVisibleCommentersProfile() {
        val list = compose.onNodeWithTag("comments_list").fetchSemanticsNode().boundsInRoot
        val chips = compose.onAllNodesWithTag("$CARD.authorChip")
        val index = chips.fetchSemanticsNodes().indexOfFirst {
            it.boundsInRoot.top >= list.top && it.boundsInRoot.bottom <= list.bottom
        }
        chips[index].performClick()
        waitForTag("profile.identity.name")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Profile>()).isTrue()
    }

    // ReplyEntry.md — WHEN back returns from a screen a control in the sheet
    // opened -> the comments sheet stands open over the post at the offset it was left.
    @Test
    fun backFromACommentersProfileTheThreadStandsWhereItWasLeft() {
        aLongThreadRaised()
        compose.onNodeWithTag("comments_list").performScrollToIndex(SCROLLED_TO)
        compose.waitForIdle()
        val before = firstVisibleCard()
        assertThat(before).isNotEqualTo("$CARD:c0")

        openAVisibleCommentersProfile()
        compose.runOnIdle { compose.activity.onBackPressedDispatcher.onBackPressed() }
        waitForTag("comments_list")
        compose.waitForIdle()

        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<PostDetail>()).isTrue()
        assertThat(firstVisibleCard()).isEqualTo(before)
    }

    private companion object {
        const val CARD = "postDetail.threadSheet.commentCard"
        const val COMMENTS = 20
        const val SCROLLED_TO = 10
    }
}
