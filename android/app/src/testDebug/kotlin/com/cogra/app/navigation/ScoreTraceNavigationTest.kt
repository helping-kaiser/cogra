// The Feed score's door through the real NavHost (FeedKinds.md:7-13;
// FeedEntryKinds.md:13; FeedEntryMoved.md:3; score-readout CD-SR2, CD-SR5): a
// card's score opens the trace over the feed with the feed slot lit and its
// back arrow naming the feed, the trace makes its one live fetch in the view
// the figure came from, and what that fetch finds is the figure the card wears
// on the way back — the dash where it found no paths.

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
import com.cogra.domain.score.FeedStandings
import com.cogra.domain.score.TraceAnswer
import com.cogra.domain.score.TraceFetch
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.FakeTraceRepository
import com.cogra.domain.testing.TraceCast
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
class ScoreTraceNavigationTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var content: ScriptedContentRepository

    @Inject lateinit var profiles: ScriptedProfileRepository

    @Inject lateinit var traces: FakeTraceRepository

    @Inject lateinit var standings: FeedStandings

    private lateinit var navController: TestNavHostController

    @Before
    fun inject() {
        hilt.inject()
    }

    /** A signed-in member on a feed carrying one landed post, ranked at 1.00 (`ListingFeedRepository`). */
    private fun memberOnTheFeed() {
        runBlocking {
            tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1"))
        }
        identity.seed = ActorKey.generate().seed()
        profiles.profile = testProfile(id = "u1", handle = "jakob")
        account.profile = UserProfile("u1", "jakob", null, AccountState.MEMBER, true, invitedBy = null)
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
        waitForTag(SCORE)
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

    private fun onTheTrace() = navController.currentDestination?.hasRoute<ScoreTrace>() == true

    private fun tapTheScore() {
        compose.onNodeWithTag(SCORE).performScrollTo().performClick()
        waitUntilOn(::onTheTrace)
    }

    /** The bar's Feed slot under whichever screen it stands (`feedEntry.bottomBar.feedSlot`). */
    private val feedSlot = SemanticsMatcher("is the bar's feed slot") { node ->
        node.config.getOrNull(SemanticsProperties.TestTag)?.endsWith(".bottomBar.feedSlot") == true
    }

    @Test
    fun theCardsScoreOpensTheTraceOverTheFeed() {
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer(score = 1.0))
        memberOnTheFeed()
        compose.onNodeWithTag(SCORE).assertContentDescriptionEquals("Feed score 1.00")

        tapTheScore()

        // ONE LIVE FETCH, in the view the card's figure was computed in (CD-SR1,
        // CD-SR2) — the feed's own ranked view, the borrowed vantage here.
        val walked = standings.state.value.viewerFor("u1")
        assertThat(walked).isNotNull()
        assertThat(traces.traced).containsExactly(walked to "p1")
        compose.onNodeWithTag("feedEntry.header.back").assertContentDescriptionEquals("Back to feed")
        compose.onNodeWithTag("feedEntry.header.title", useUnmergedTree = true).assertTextEquals("Why this reached you")
        // THE ORIGINATING ROOT STAYS LIT on the drill-in (BottomNav.prompt.md).
        compose.onNode(feedSlot).assertIsSelected()
    }

    @Test
    fun theTracesFetchIsTheFigureTheCardWearsOnTheWayBack() {
        // The live read finds no paths: the moved-on state (FeedEntryMoved.md:3).
        traces.answers += TraceFetch.Answered(TraceAnswer(score = null, paths = emptyList()))
        memberOnTheFeed()
        compose.onNodeWithTag(SCORE).assertContentDescriptionEquals("Feed score 1.00")

        tapTheScore()
        compose.onNodeWithTag("feedEntry.note", useUnmergedTree = true)
            .assertTextEquals("The paths that carried it here have moved on.")
        compose.onNodeWithTag("feedEntry.header.back").performClick()
        waitUntilOn { !onTheTrace() }

        // THE CARD ADOPTS WHAT THE TRACE FOUND — the dash, still a door — and
        // never the figure it wore before (FeedKinds.md:11).
        compose.onNodeWithTag(SCORE).assertContentDescriptionEquals("Feed score —")
    }

    @Test
    fun reEnteringTheTraceIsANewLiveFetch() {
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer(score = 1.0))
        traces.answers += TraceFetch.Answered(TraceCast.ownAnswer(score = 1.0))
        memberOnTheFeed()

        tapTheScore()
        compose.onNodeWithTag("feedEntry.header.back").performClick()
        waitUntilOn { !onTheTrace() }
        tapTheScore()

        assertThat(traces.traced).hasSize(2)
    }

    private companion object {
        /** The feed card's score slot (nodes.json `feed.card.actionRow.score`). */
        const val SCORE = "feed.card.actionRow.score"
    }
}
