// The shell's navigation contract (roadmap.md "The MVP milestone"; design
// readme §13 "The bottom bar's re-tap ladder"; BottomNav.prompt.md): each
// tab keeps its own stack, a drill-in keeps the slot of the root it was
// opened from lit, a slot climbs its ladder, and system back pops within
// the stack, then from another tab's root to Feed's root, then leaves.
// Driven through the real NavHost, the real bar and the real destinations,
// as CograNavGraphTest does.

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
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
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.ProfileFigures
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.domain.UserProfile
import com.cogra.domain.search.SearchHit
import com.cogra.domain.search.SearchNode
import com.cogra.domain.search.SearchPage
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionDirection
import com.cogra.domain.stance.OpinionHolder
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ScriptedSearchRepository
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
import java.time.Instant
import javax.inject.Inject

@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class TabNavigationTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var content: ScriptedContentRepository

    @Inject lateinit var profiles: ScriptedProfileRepository

    @Inject lateinit var search: ScriptedSearchRepository

    private lateinit var navController: TestNavHostController

    @Before
    fun inject() {
        hilt.inject()
    }

    /**
     * A signed-in member on a feed carrying one post by `author`, whose
     * profile and the post's detail both read, and whose own chronicle
     * carries that same post — so one post is reachable from both tabs.
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

    /** One of the bar's slots, under whichever screen the bar stands (`feed.bottomBar.feedSlot`, `bar_feed`). */
    private fun barSlot(slot: String) = SemanticsMatcher("is the bar's $slot slot") { node ->
        node.config.getOrNull(SemanticsProperties.TestTag)
            ?.let { it == "bar_${FALLBACK_TAGS[slot] ?: slot}" || it.endsWith(".bottomBar.${slot}Slot") } == true
    }

    private fun tapSlot(slot: String) {
        compose.onNode(barSlot(slot)).performClick()
        compose.waitForIdle()
    }

    private fun assertLit(slot: String) {
        compose.onNode(barSlot(slot)).assertIsSelected()
        listOf("feed", "search", "wallet", "profile").filter { it != slot }.forEach {
            compose.onNode(barSlot(it)).assertIsNotSelected()
        }
    }

    private inline fun <reified T : Any> onTop(): Boolean =
        navController.currentBackStackEntry?.destination?.hasRoute<T>() == true

    private fun onOwnProfileRoot(): Boolean =
        onTop<Profile>() && navController.currentBackStackEntry?.toRoute<Profile>()?.handle == null

    private fun pressBack() {
        compose.runOnIdle { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    private fun openProfileTab() {
        tapSlot("profile")
        waitUntilOn(::onOwnProfileRoot)
        waitForTag("profile.identity.name")
    }

    /** The own chronicle's one act, the post p1 (ProfileOther.md: a chronicle card opens the post). */
    private fun openTheChroniclesPost() {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(CHRONICLE_ROW, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag(CHRONICLE_ROW, useUnmergedTree = true).performScrollTo().performClick()
    }

    // -- The lit slot is the stack's root, whatever the screen is about --

    @Test
    fun aPostOpenedFromTheFeedKeepsFeedLit() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card:p1").performClick()
        waitUntilOn { onTop<PostDetail>() }

        // PostDetail.md:57 — the slot of the root the post was opened from.
        assertLit("feed")
    }

    @Test
    fun theSamePostOpenedFromTheProfileChronicleKeepsProfileLit() {
        memberOnTheFeed()
        openProfileTab()
        openTheChroniclesPost()
        waitUntilOn { onTop<PostDetail>() }

        // The same screen in another tab's stack lights that tab
        // (design/readme.md §13: a stack is where a screen was opened FROM).
        assertLit("profile")
    }

    @Test
    fun anotherProfileOpenedFromTheFeedKeepsFeedLit() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card.authorChip").performClick()
        waitUntilOn { onTop<Profile>() }

        // ProfileOther.md:17.
        assertLit("feed")
    }

    @Test
    fun savedKeepsProfileLitOnItsOwnBarName() {
        memberOnTheFeed()
        openProfileTab()
        compose.onNodeWithTag("profile.identity.actionRow.menu").performScrollTo().performClick()
        waitForTag("profile.menuSheet.saved")
        compose.onNodeWithTag("profile.menuSheet.saved").performClick()
        waitUntilOn { onTop<Saved>() }

        // Saved.md:119 — and the bar wears the registered `saved.bottomBar`.
        assertLit("profile")
        waitForTag("saved.bottomBar")
    }

    // ProfileOwnMenu.md: the own ⋮'s History row opens History in the Profile
    // tab's stack. History.md:125 keeps the Profile slot lit, the bar wears the
    // registered `history.bottomBar`, and the back arrow brings the reader's
    // own profile back (History.md:121).
    @Test
    fun historyOpensFromTheOwnMenuKeepsProfileLitAndGoesBackToTheProfile() {
        memberOnTheFeed()
        openProfileTab()
        compose.onNodeWithTag("profile.identity.actionRow.menu").performScrollTo().performClick()
        waitForTag("profile.menuSheet.history")
        compose.onNodeWithTag("profile.menuSheet.history").performClick()
        waitUntilOn { onTop<History>() }

        assertLit("profile")
        waitForTag("history.bottomBar")
        waitForTag("history.header")

        compose.onNodeWithTag("history.header.back").performClick()
        waitUntilOn { onOwnProfileRoot() }
    }

    // -- Each tab keeps its own stack --

    @Test
    fun anotherTabComesBackWithItsWholeStack() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card:p1").performClick()
        waitUntilOn { onTop<PostDetail>() }

        openProfileTab()
        tapSlot("feed")

        // Feed.md:81 — the feed comes back in the state it was left.
        waitUntilOn { onTop<PostDetail>() }
        assertThat(navController.currentBackStackEntry?.toRoute<PostDetail>()?.postId).isEqualTo("p1")
        assertLit("feed")

        // ...and the profile tab, left at its root, comes back at its root.
        openProfileTab()
        assertLit("profile")
    }

    @Test
    fun theProfileSlotOverAFeedDrillInOpensTheOwnProfileNotTheDrillIn() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card.authorChip").performClick()
        waitUntilOn { onTop<Profile>() }

        // ProfileOther.md:69 — the reader's own profile opens.
        openProfileTab()
        assertThat(navController.currentBackStackEntry?.toRoute<Profile>()?.handle).isNull()
        assertLit("profile")
    }

    // -- The ladder: the tab you are on pops to its own root --

    @Test
    fun theFeedSlotDeepInTheFeedPopsToTheFeedsRoot() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card:p1").performClick()
        waitUntilOn { onTop<PostDetail>() }
        waitForTag("postDetail.card.authorChip")
        compose.onNodeWithTag("postDetail.card.authorChip").performClick()
        waitUntilOn { onTop<Profile>() }

        // Feed.md:85 — the feed's root comes back; nothing deeper survives.
        tapSlot("feed")
        waitUntilOn { onTop<Feed>() }
        assertThat(navController.currentBackStack.value.none { it.destination.hasRoute<PostDetail>() }).isTrue()
    }

    @Test
    fun theProfileSlotDeepInTheProfileTabPopsToTheProfilesRoot() {
        memberOnTheFeed()
        openProfileTab()
        openTheChroniclesPost()
        waitUntilOn { onTop<PostDetail>() }

        // Profile.md:65.
        tapSlot("profile")
        waitUntilOn(::onOwnProfileRoot)
        assertThat(navController.currentBackStack.value.none { it.destination.hasRoute<PostDetail>() }).isTrue()
    }

    @Test
    fun theProfileSlotAtTheProfilesRootStaysPut() {
        memberOnTheFeed()
        openProfileTab()
        val root = navController.currentBackStackEntry?.id

        // Profile.md:63 — at its top, nothing happens.
        tapSlot("profile")
        assertThat(navController.currentBackStackEntry?.id).isEqualTo(root)
    }

    // -- System back --

    @Test
    fun backPopsWithinTheTabThenFromItsRootToFeedsRootThenLeaves() {
        memberOnTheFeed()
        openProfileTab()
        openTheChroniclesPost()
        waitUntilOn { onTop<PostDetail>() }

        pressBack()
        waitUntilOn(::onOwnProfileRoot)

        pressBack()
        waitUntilOn { onTop<Feed>() }
        assertLit("feed")
        assertThat(compose.activity.isFinishing).isFalse()

        pressBack()
        assertThat(compose.activity.isFinishing).isTrue()
    }

    @Test
    fun backFromAnotherTabsRootLandsOnFeedsRootAndTheFeedForgetsTheStackItWasLeftWith() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card:p1").performClick()
        waitUntilOn { onTop<PostDetail>() }
        openProfileTab()

        // Back from another tab's root lands on Feed's ROOT, never on the
        // drill-in the feed was left at, and never a tab switch mid-stack.
        pressBack()
        waitUntilOn { onTop<Feed>() }

        // The reader left the feed at its root this time: that is the state
        // a later return finds, not the drill-in backed past.
        openProfileTab()
        tapSlot("feed")
        waitUntilOn { onTop<Feed>() }
        assertThat(navController.currentBackStack.value.none { it.destination.hasRoute<PostDetail>() }).isTrue()
    }

    @Test
    fun theWizardsBackStepsBackAStageBeforeLeaving() {
        memberOnTheFeed()
        tapSlot("compose")
        waitForTag("wizard_switch_words")
        compose.onNodeWithTag("wizard_switch_words").performClick()
        waitForTag("wizard_body")
        compose.onNodeWithTag("wizard_body").performTextInput("Something new")
        compose.onNodeWithTag("wizard_words_next").performClick()
        waitForTag("composeDetails.next")

        // The roadmap's flows-with-step-stacks clause: the platform back
        // goes through the wizard's own back first (jakob 2026-08-31).
        pressBack()
        waitForTag("wizard_body")
        assertThat(onTop<ComposePost>()).isTrue()
    }

    @Test
    fun theChatsPageFromTheProfilesBandNamesTheProfileAndKeepsItLit() {
        memberOnTheFeed()
        openProfileTab()
        compose.onNodeWithTag("profile.band.chats").performClick()
        waitUntilOn { onTop<ChatsComingSoon>() }

        // ChatsComingSoon.md:13 and :15.
        compose.onNodeWithTag("chats_back").assertContentDescriptionEquals("Back to your profile")
        assertLit("profile")
    }

    @Test
    fun theChatsPageFromAProfilesMessageNamesTheProfile() {
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card.authorChip").performClick()
        waitForTag("profile.identity.actionRow.message")
        compose.onNodeWithTag("profile.identity.actionRow.message").performScrollTo().performClick()
        waitUntilOn { onTop<ChatsComingSoon>() }

        // ChatsComingSoon.md:17 — and the page stands in the feed's stack.
        compose.onNodeWithTag("chats_back").assertContentDescriptionEquals("Back to the profile")
        assertLit("feed")
    }

    // -- Explore and the Wallet: V1.0's five slots (BottomNav.jsx) --

    private fun openExploreTab() {
        tapSlot("search")
        waitUntilOn { onTop<Explore>() }
        waitForTag("explore.searchField.input")
    }

    @Test
    fun theExploreSlotOpensExploreItsSlotLitAndBackLandsOnFeedsRoot() {
        memberOnTheFeed()
        openExploreTab()
        assertLit("search")
        waitForTag("explore.bottomBar")

        // Explore is another tab's root: Back lands on Feed's root.
        pressBack()
        waitUntilOn { onTop<Feed>() }
        assertLit("feed")
    }

    @Test
    fun aResultOpenedFromASearchKeepsExploreLitAndBackFindsTheSearchAsItWasLeft() {
        search.respond = { _, _ ->
            Outcome.Success(
                SearchPage(
                    hits = listOf(SearchHit(SearchNode.Post("p1", "Salt maps", Instant.EPOCH, null), score = null)),
                    endCursor = null,
                    hasNextPage = false,
                    hasMorePeople = false,
                ),
            )
        }
        memberOnTheFeed()
        openExploreTab()
        compose.onNodeWithTag("explore.searchField.input", useUnmergedTree = true).performTextInput("salt")
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag("explore.result:1", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).performClick()
        waitUntilOn { onTop<PostDetail>() }

        // PostDetail.md:57 — opened from Explore, Explore stays lit; the way
        // back names the search (ExploreSearch, the origin table).
        assertLit("search")
        assertThat(navController.currentBackStackEntry?.toRoute<PostDetail>()?.from).isEqualTo("search")

        pressBack()
        waitUntilOn { onTop<Explore>() }
        // Back from a standing search empties it and never leaves Explore (Explore.md:15).
        waitForTag("explore.result:1")
        pressBack()
        waitForTag("explore.skyCard")
        assertThat(onTop<Explore>()).isTrue()
    }

    @Test
    fun theReadersOwnResultOpensTheirProfileInExploresStackWithExploreLit() {
        search.respond = { _, _ ->
            Outcome.Success(
                SearchPage(
                    hits = listOf(SearchHit(SearchNode.Person("u1", "jakob", "Jakob", null), score = null)),
                    endCursor = null,
                    hasNextPage = false,
                    hasMorePeople = false,
                ),
            )
        }
        memberOnTheFeed()
        openExploreTab()
        compose.onNodeWithTag("explore.searchField.input", useUnmergedTree = true).performTextInput("jakob")
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag("explore.result:1", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).performClick()
        waitUntilOn { onTop<Profile>() }
        waitForTag("profile.identity.name")

        // A screen belongs to the stack it was opened from whatever its
        // subject; the originating root stays lit (BottomNav.prompt.md;
        // design/readme.md §13, jakob 2026-11-10).
        val route = navController.currentBackStackEntry?.toRoute<Profile>()
        assertThat(route?.handle).isEqualTo("jakob")
        assertThat(route?.from).isEqualTo("search")
        assertLit("search")

        pressBack()
        waitUntilOn { onTop<Explore>() }
        waitForTag("explore.result:1")
    }

    @Test
    fun theExploreSlotAtExploresTopStaysPut() {
        memberOnTheFeed()
        openExploreTab()
        val root = navController.currentBackStackEntry?.id
        tapSlot("search")
        assertThat(navController.currentBackStackEntry?.id).isEqualTo(root)
        assertLit("search")
    }

    @Test
    fun theWalletSlotOpensItsComingSoonRootLitAndNeverDoesNothing() {
        memberOnTheFeed()
        tapSlot("wallet")
        waitUntilOn { onTop<Wallet>() }
        assertLit("wallet")
        waitForTag("wallet.comingSoonCard")
        waitForTag("wallet.bottomBar")

        pressBack()
        waitUntilOn { onTop<Feed>() }
    }

    @Test
    fun yourTopicsOpensFromExploresDoorWithNoBarAndGoesBackToExplore() {
        memberOnTheFeed()
        openExploreTab()
        // The door sits under the Sky's card: scroll the rest view to it first.
        compose.onNodeWithTag("explore_rest").performScrollToNode(hasTestTag("explore.topics"))
        compose.onNodeWithTag("explore.topics_open").performClick()
        waitUntilOn { onTop<YourTopics>() }
        compose.onAllNodesWithTag("explore.bottomBar").fetchSemanticsNodes().let { assertThat(it).isEmpty() }
        compose.onNodeWithTag("yourTopics.header.back").performClick()
        waitUntilOn { onTop<Explore>() }
        assertLit("search")
    }

    // -- The opinions page (ProfileStances.md): the figures' door, its stack, its way back --

    private fun held(id: String, handle: String) = HeldOpinion(
        holderId = "addr-$handle",
        holder = OpinionHolder(id, handle, null, null, redacted = false),
        pair = StancePair(0.5, 0.2),
        severed = false,
    )

    private fun openTheFigures() {
        waitForTag(FIGURES)
        compose.onNodeWithTag(FIGURES).performScrollTo().performClick()
        waitUntilOn { onTop<ProfileStances>() }
    }

    private fun openTheRow(handle: String) {
        waitForTag("profileStances.list.row:$handle")
        compose.onNodeWithTag("profileStances.list.row:$handle").performClick()
        waitUntilOn { onTop<Profile>() }
    }

    @Test
    fun anothersFiguresOpenTheOpinionsPageInFeedsStackAndEveryWayBackUnwinds() {
        profiles.figures["author-1"] = ProfileFigures(posts = 1, opinionsOn = 1, opinionsBy = 0)
        profiles.opinions["author-1" to OpinionDirection.ON] = listOf(held("mira-1", "mira"))
        profiles.others["mira"] = testProfile(id = "mira-1", handle = "mira")
        memberOnTheFeed()
        compose.onNodeWithTag("feed.card.authorChip").performClick()
        waitUntilOn { onTop<Profile>() }
        openTheFigures()

        // ProfileStances.md:55 — the slot of the root the profile was opened from.
        assertLit("feed")
        waitForTag("profileStances.bottomBar")
        compose.onNodeWithTag("profileStances.header.back").assertContentDescriptionEquals("Back to the profile")

        // :47, :57 — a row's person opens in the same stack, its arrow naming the page.
        openTheRow("mira")
        val person = navController.currentBackStackEntry?.toRoute<Profile>()
        assertThat(person).isEqualTo(Profile("mira", from = "opinions"))
        assertLit("feed")
        compose.onNodeWithTag("profile.header.back").assertContentDescriptionEquals("Back to the opinions")

        // :49 — back returns to the page, then to the profile whose figures were tapped.
        pressBack()
        waitUntilOn { onTop<ProfileStances>() }
        pressBack()
        waitUntilOn { onTop<Profile>() }
        assertThat(navController.currentBackStackEntry?.toRoute<Profile>()?.handle).isEqualTo("author")
    }

    @Test
    fun aPersonOpenedFromTheOpinionsPageInExploresStackKeepsExploreLitNeverFeed() {
        search.respond = { _, _ ->
            Outcome.Success(
                SearchPage(
                    hits = listOf(SearchHit(SearchNode.Person("author-1", "author", "Author", null), score = null)),
                    endCursor = null,
                    hasNextPage = false,
                    hasMorePeople = false,
                ),
            )
        }
        profiles.figures["author-1"] = ProfileFigures(posts = 1, opinionsOn = 0, opinionsBy = 1)
        profiles.opinions["author-1" to OpinionDirection.BY] = listOf(held("mira-1", "mira"))
        profiles.others["mira"] = testProfile(id = "mira-1", handle = "mira")
        memberOnTheFeed()
        openExploreTab()
        compose.onNodeWithTag("explore.searchField.input", useUnmergedTree = true).performTextInput("author")
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag("explore.result:1", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag("explore.result:1", useUnmergedTree = true).performClick()
        waitUntilOn { onTop<Profile>() }
        openTheFigures()
        assertLit("search")

        compose.onNodeWithTag("profileStances.tabRow.byTab").performClick()
        openTheRow("mira")
        // ProfileStances.md:57 — the root the page's stack began in, never Feed by default.
        assertLit("search")
    }

    @Test
    fun theOwnRootsFiguresOpenTheOwnPageInTheProfileTab() {
        profiles.figures["u1"] = ProfileFigures(posts = 1, opinionsOn = 0, opinionsBy = 0)
        memberOnTheFeed()
        openProfileTab()
        openTheFigures()

        assertLit("profile")
        assertThat(navController.currentBackStackEntry?.toRoute<ProfileStances>()?.handle).isNull()
        // An own page with no one on it: the empty line in the list's place.
        waitForTag("profileStances.empty")
        compose.onNodeWithTag("profileStances.header.back").assertContentDescriptionEquals("Back to your profile")
        compose.onNodeWithTag("profileStances.tabRow.onTab").assertTextEquals("On you")

        compose.onNodeWithTag("profileStances.header.back").performClick()
        waitUntilOn(::onOwnProfileRoot)
    }

    private companion object {
        const val CHRONICLE_ROW = "chronicle_row_open"
        const val FIGURES = "profile.identity.figures"

        /** The bar's shell tags where a slot's key and its tag differ (`search` reads `bar_explore`). */
        val FALLBACK_TAGS = mapOf("search" to "explore")
    }
}
