// The intro's routes through the real graph (OnboardingSteps.md and its
// four sibling sidecars): it opens by itself over the first feed entry while
// the account's flag is unset, never once it is set, and Settings' `Watch
// the intro again` re-opens it — and every way out lands back on what it
// opened over.

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
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
import com.cogra.app.di.ScriptedIntroRepository
import com.cogra.app.di.ScriptedProfileRepository
import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.UserProfile
import com.cogra.domain.intro.IntroAccount
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
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
class IntroNavTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var profiles: ScriptedProfileRepository

    @Inject lateinit var intro: ScriptedIntroRepository

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

    private fun signInAsMember() {
        runBlocking { tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1")) }
        identity.seed = ActorKey.generate().seed()
        profiles.profile = com.cogra.domain.testing.testProfile(id = "u1", handle = "jakob")
        account.profile = UserProfile("u1", "jakob", null, AccountState.MEMBER, true, invitedBy = null)
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun onIntro(): Boolean = navController.currentBackStackEntry?.destination?.hasRoute<Intro>() == true

    private fun waitForRoute(check: () -> Boolean) {
        compose.waitUntil(timeoutMillis = 30_000) { check() }
    }

    @Test
    fun theIntroOpensOverTheFirstFeedEntryAndSetsTheFlagAtOnce() {
        signInAsMember()
        intro.account = IntroAccount(hasSeen = false, inviter = null)
        render()

        waitForRoute(::onIntro)
        waitForTag("onboarding.skip")
        // OnboardingSteps.md:29 — set on the show, before any button.
        compose.waitUntil(timeoutMillis = 30_000) { intro.marks == 1 }
        // OnboardingSteps.md:9 — the card carries no bottom bar.
        assertThat(compose.onAllNodesWithTag("feed.bottomBar").fetchSemanticsNodes()).isEmpty()

        // OnboardingSteps.md:21 — Skip leaves for the feed it opened over.
        compose.onNodeWithTag("onboarding.skip").performClick()
        waitForRoute { navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true }
    }

    @Test
    fun theIntroNeverOpensByItselfOnceTheFlagIsSet() {
        signInAsMember()
        intro.account = IntroAccount(hasSeen = true, inviter = null)
        render()

        waitForRoute { navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true }
        compose.waitForIdle()
        assertThat(onIntro()).isFalse()
        assertThat(intro.marks).isEqualTo(0)
    }

    @Test
    fun startReadingOnTheLastCardLandsOnTheFeed() {
        signInAsMember()
        intro.account = IntroAccount(hasSeen = false, inviter = null)
        render()

        waitForRoute(::onIntro)
        waitForTag("onboarding.next")
        repeat(5) { compose.onNodeWithTag("onboarding.next").performClick() }
        waitForRoute { navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true }
        // Back on the feed, the intro does not come back by itself.
        compose.waitForIdle()
        assertThat(onIntro()).isFalse()
    }

    @Test
    fun backWalksTheCardsBackAndOnTheFirstLeavesLikeSkip() {
        signInAsMember()
        intro.account = IntroAccount(hasSeen = false, inviter = null)
        render()

        waitForRoute(::onIntro)
        waitForTag("onboarding.next")
        compose.onNodeWithTag("onboarding.next").performClick()
        // OnboardingShape.md:21 — Back on the second card opens the first.
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
        assertThat(onIntro()).isTrue()
        // OnboardingSteps.md:25 — Back on the first card leaves the way Skip does.
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        waitForRoute { navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true }
    }

    @Test
    fun settingsReOpensTheIntroAndSkipLandsBackOnSettings() {
        signInAsMember()
        render()
        waitForRoute { navController.currentBackStackEntry?.destination?.hasRoute<Feed>() == true }
        compose.runOnUiThread { navController.navigate(Settings) }
        waitForTag("settings.about.intro")

        // OnboardingSteps.md:5 — Watch the intro again opens it at the first card.
        compose.onNodeWithTag("settings.about.intro").performScrollTo().performClick()
        waitForRoute(::onIntro)
        waitForTag("onboarding.skip")
        // OnboardingSteps.md:27 — Skip from a re-watch: Settings comes back.
        compose.onNodeWithTag("onboarding.skip").performClick()
        waitForRoute { navController.currentBackStackEntry?.destination?.hasRoute<Settings>() == true }
        assertThat(intro.marks).isEqualTo(0)
    }
}
