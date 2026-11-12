// The profile's Posts and Comments tabs through the real NavHost, the real
// destinations and the shell's card host (ProfilePosts.md, ProfileComments.md):
// each tab lists the feed's own cards, never chronicle entries; a card's door
// opens in the profile's stack with the back arrow naming the profile; and
// Back returns to the profile on the tab it was left on (ProfilePosts.md:51).

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.ComposeNavigator
import androidx.navigation.testing.TestNavHostController
import androidx.navigation.toRoute
import com.cogra.app.HiltTestActivity
import com.cogra.app.di.ScriptedAccountRepository
import com.cogra.app.di.ScriptedContentRepository
import com.cogra.app.di.ScriptedProfileRepository
import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.Page
import com.cogra.domain.ProfileComment
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
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

@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class ProfileTabsNavigationTest {

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

    /**
     * A signed-in member whose own profile carries one post, p1, as a
     * chronicle act on Everything and as a post card on Posts, and one comment
     * on it on Comments; `author`'s profile carries the same post.
     */
    private fun memberOnTheFeed() {
        runBlocking {
            tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1"))
        }
        identity.seed = ActorKey.generate().seed()
        profiles.profile = testProfile(id = "u1", handle = "jakob")
        account.profile = UserProfile("u1", "jakob", null, AccountState.MEMBER, true, invitedBy = null)
        profiles.others["author"] = testProfile(id = "author-1", handle = "author")
        profiles.records = listOf(RecordRow("r1", Family.PUBLISH, true, "Hello", RecordLink.ToPost("p1")))
        profiles.posts["u1"] = listOf(testPost("p1"))
        profiles.posts["author-1"] = listOf(testPost("p1"))
        profiles.comments["u1"] = listOf(ProfileComment(testComment("c1"), target = null, threadPostId = "p1"))
        content.listing = listOf(testPost("p1"))
        content.details["p1"] = com.cogra.domain.PostDetail(
            post = testPost("p1"),
            comments = Page(emptyList(), endCursor = null, hasNextPage = false),
        )
        compose.setContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            CograNavGraph(navController = navController)
        }
        waitForTag("feed.card:p1")
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitUntilOn(predicate: () -> Boolean) {
        compose.waitUntil(timeoutMillis = 30_000) { predicate() }
        compose.waitForIdle()
    }

    private inline fun <reified T : Any> onTop(): Boolean =
        navController.currentBackStackEntry?.destination?.hasRoute<T>() == true

    private fun openOwnProfile() {
        compose.onNodeWithTag("feed.bottomBar.profileSlot").performClick()
        waitUntilOn { onTop<Profile>() && navController.currentBackStackEntry?.toRoute<Profile>()?.handle == null }
        waitForTag("profile.identity.name")
    }

    private fun openTab(tab: String) {
        compose.onNodeWithTag("profile.tabRow.$tab").performScrollTo().performClick()
        compose.waitForIdle()
    }

    /** Scrolls the profile's list to [tag], waiting for its read to land first. */
    private fun scrollTo(list: String, tag: String) {
        waitForTag(list)
        compose.waitUntil(timeoutMillis = 30_000) {
            runCatching { compose.onNodeWithTag(list).performScrollToNode(hasTestTag(tag)) }.isSuccess
        }
    }

    // ProfilePosts.md:3 — "the posts view lists the person's posts as post
    // cards, never as chronicle entries": red on main, whose Posts tab read
    // the chronicle filtered to Publish and drew its acts.
    @Test
    fun thePostsTabDrawsTheFeedsPostCardsNeverChronicleActs() {
        memberOnTheFeed()
        openOwnProfile()
        openTab("postsTab")
        scrollTo("profile.posts", "profile.posts.card:p1")

        assertThat(compose.onAllNodesWithTag(CHRONICLE_ROW, useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()
        assertThat(compose.onAllNodesWithTag("profile.chronicle.act:1").fetchSemanticsNodes()).isEmpty()
    }

    // ProfilePosts.md:49, :51 — the card's door opens the post, its back
    // arrow reading Back to your profile, and Back returns to the profile on
    // the Posts tab, its card where it stood.
    @Test
    fun aPostCardOpensThePostAndBackReturnsToThePostsTab() {
        memberOnTheFeed()
        openOwnProfile()
        openTab("postsTab")
        scrollTo("profile.posts", "profile.posts.card:p1")
        compose.onNodeWithTag("profile.posts.card:p1").performClick()
        waitUntilOn { onTop<PostDetail>() }

        assertThat(navController.currentBackStackEntry?.toRoute<PostDetail>()?.from).isEqualTo("profile")
        compose.onNodeWithTag("postDetail.header.back").assertContentDescriptionEquals("Back to your profile")
        compose.onNodeWithTag("postDetail.header.back").performClick()
        waitUntilOn { onTop<Profile>() }

        waitForTag("profile.posts.card:p1")
        compose.onNodeWithTag("profile.tabRow.postsTab").assertIsSelected()
    }

    // ProfilePosts.md:47 — on another's profile the back arrow reads Back to
    // the profile.
    @Test
    fun anothersPostCardNamesTheProfileOnTheWayBack() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card.authorChip").performClick()
        waitUntilOn { onTop<Profile>() }
        waitForTag("profile.identity.name")
        openTab("postsTab")
        scrollTo("profile.posts", "profile.posts.card:p1")
        compose.onNodeWithTag("profile.posts.card:p1").performClick()
        waitUntilOn { onTop<PostDetail>() }

        assertThat(navController.currentBackStackEntry?.toRoute<PostDetail>()?.from).isEqualTo("u:author")
        compose.onNodeWithTag("postDetail.header.back").assertContentDescriptionEquals("Back to the profile")
    }

    // ProfileComments.md:3, :25 — the Comments tab lists comment cards, and a
    // card's Reply opens the thread it lives in, aimed at the comment; Back
    // returns to the Comments tab.
    @Test
    fun aCommentCardsReplyOpensItsThreadAndBackReturnsToTheCommentsTab() {
        memberOnTheFeed()
        openOwnProfile()
        openTab("commentsTab")
        scrollTo("profile.comments", "profile.comments.commentCard:c1")
        assertThat(compose.onAllNodesWithTag(CHRONICLE_ROW, useUnmergedTree = true).fetchSemanticsNodes()).isEmpty()

        compose.onNodeWithTag("profile.comments.commentCard.actionRow.reply").performClick()
        waitUntilOn { onTop<PostDetail>() }
        val route = navController.currentBackStackEntry?.toRoute<PostDetail>()
        assertThat(route?.postId).isEqualTo("p1")
        assertThat(route?.commentId).isEqualTo("c1")
        assertThat(route?.aimReply).isTrue()
        assertThat(route?.from).isEqualTo("profile")

        compose.onNodeWithTag("postDetail.header.back").performClick()
        waitUntilOn { onTop<Profile>() }
        waitForTag("profile.comments.commentCard:c1")
        compose.onNodeWithTag("profile.tabRow.commentsTab").assertIsSelected()
    }

    // Profile.md: a chronicle card for a published post opens the post with
    // its back arrow reading Back to your profile.
    @Test
    fun aChronicleActNamesYourProfileOnTheWayBack() {
        memberOnTheFeed()
        openOwnProfile()
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(CHRONICLE_ROW, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag(CHRONICLE_ROW, useUnmergedTree = true).performScrollTo().performClick()
        waitUntilOn { onTop<PostDetail>() }
        compose.onNodeWithTag("postDetail.header.back").assertContentDescriptionEquals("Back to your profile")
    }

    private companion object {
        const val CHRONICLE_ROW = "chronicle_row_open"
    }
}
