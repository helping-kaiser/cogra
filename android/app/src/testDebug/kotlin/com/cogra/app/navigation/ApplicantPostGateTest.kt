// AN APPLICANT CANNOT POST, AND EVERY DOOR SAYS SO IN PLACE (ApplicantFeed.md:49,
// ProfileApplicant.md:26, ProfileMenu.md:19; copy-voice "The applicant-foot
// family"): the bar's New post and the menus' Cite answer `You can post once
// you're in.`, and the wizard never opens. A guest meets the join prompt at the
// same doors. Driven through the real NavHost, as CograNavGraphTest does; the
// member's open doors stay pinned there (`theComposerOpensFromTheBarsCenterAction`,
// `theReferenceAffordanceOpensTheComposerCarryingTheNode`).

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
class ApplicantPostGateTest {

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

    /** The one answer every posting door reads. */
    @Inject lateinit var standing: ReaderStanding

    private lateinit var navController: TestNavHostController

    @Before
    fun inject() {
        hilt.inject()
    }

    private fun render() {
        compose.setContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            CograNavGraph(navController = navController)
        }
        compose.waitForIdle()
    }

    /** A signed-in applicant on their feed, one post on it, the shell's read answered. */
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
        servePost()
        render()
        waitFor(barSlot("compose"))
        compose.waitUntil(timeoutMillis = 30_000) { standing.applicant }
    }

    private fun servePost() {
        val post = testPost("p1")
        content.listing = listOf(post)
        content.details["p1"] = PostDetailView(post = post, comments = Page(emptyList(), null, hasNextPage = false))
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForText(text: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithText(text, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitFor(matcher: SemanticsMatcher) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty()
        }
    }

    /** One of the bar's slots, under a registered screen's name or the shell's own. */
    private fun barSlot(slot: String) = SemanticsMatcher("is the bar's $slot slot") { node ->
        node.config.getOrNull(SemanticsProperties.TestTag)
            ?.let { it == "bar_$slot" || it.endsWith(".bottomBar.${slot}Slot") } == true
    }

    private fun composerOnTheStack(): Boolean =
        navController.currentBackStack.value.any { it.destination.hasRoute<ComposePost>() }

    /** The post's own ⋮ on its detail, raised. */
    private fun openThePostsMenu() {
        waitForTag("feed.card:p1")
        compose.onNodeWithTag("feed.card:p1").performClick()
        waitForTag("postDetail.header.menu")
        compose.onNodeWithTag("postDetail.header.menu").performClick()
        waitForTag("postDetail.menuSheet.cite")
    }

    // ApplicantFeed.md:49 — WHEN tap New post on the bar -> the snackbar reads
    // You can post once you're in. AND NEVER the wizard opens.
    @Test
    fun anApplicantsNewPostOnTheFeedsBarSaysTheLineAndTheWizardNeverOpens() {
        applicantOnTheFeed()
        compose.onNode(barSlot("compose")).performClick()
        waitForText(POST_LOCKED)
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
        assertThat(composerOnTheStack()).isFalse()
    }

    // ProfileApplicant.md:26 — the same answer on the applicant's own profile's bar.
    @Test
    fun anApplicantsNewPostOnTheirProfilesBarSaysTheLine() {
        applicantOnTheFeed()
        compose.onNode(barSlot("profile")).performClick()
        waitForTag("profile.bottomBar.composeSlot")
        compose.onNodeWithTag("profile.bottomBar.composeSlot").performClick()
        waitForText(POST_LOCKED)
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Profile>()).isTrue()
        assertThat(composerOnTheStack()).isFalse()
    }

    // copy-voice "The applicant-foot family": the menus' `Cite in a new post`
    // answers as the bar does, and the wizard never opens.
    @Test
    fun anApplicantsCiteOnAPostsMenuSaysTheLine() {
        applicantOnTheFeed()
        openThePostsMenu()
        compose.onNodeWithTag("postDetail.menuSheet.cite").performClick()
        waitForText(POST_LOCKED)
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<PostDetail>()).isTrue()
        assertThat(composerOnTheStack()).isFalse()
    }

    // NEVER the wizard opens — not even for an entry that reached the stack by
    // another way than a door (a restored stack): it leaves, saying the line.
    @Test
    fun aComposerEntryAnApplicantReachesAnotherWayLeavesTheStack() {
        applicantOnTheFeed()
        compose.runOnUiThread { navController.navigate(ComposePost()) }
        waitForText(POST_LOCKED)
        compose.waitUntil(timeoutMillis = 30_000) { !composerOnTheStack() }
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
        assertThat(compose.onAllNodesWithTag("wizard_pick_grid").fetchSemanticsNodes()).isEmpty()
    }

    // A guest gets the join prompt at the same controls (copy-voice, *The
    // applicant-foot family*) — the menus' door family; the bar's is pinned by
    // CograNavGraphTest's `aGuestsComposeSlotAsksAndSignInPushesTheLogin`.
    @Test
    fun aGuestsCiteOnAPostsMenuAsksThemToJoin() {
        servePost()
        render()
        waitForTag("login_browse")
        compose.onNodeWithTag("login_browse").performScrollTo().performClick()
        openThePostsMenu()
        compose.onNodeWithTag("postDetail.menuSheet.cite").performClick()
        waitForTag("join_prompt")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<PostDetail>()).isTrue()
        assertThat(composerOnTheStack()).isFalse()
    }

    private companion object {
        const val POST_LOCKED = "You can post once you're in."
    }
}
