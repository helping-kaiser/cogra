// NavHost tests per the documented Navigation Compose pattern: a
// TestNavHostController drives the real graph, real destinations, and
// real Hilt ViewModels over the fake DI graph (FakeBindingsModule).

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.ComposeNavigator
import androidx.navigation.testing.TestNavHostController
import com.cogra.app.HiltTestActivity
import com.cogra.app.di.ScriptedAccountRepository
import com.cogra.app.di.ScriptedOnboardingRepository
import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.sealKeyBackup
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.UserProfile
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import java.time.Instant
import com.google.common.truth.Truth.assertThat
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import javax.inject.Inject
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class CograNavGraphTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var onboarding: ScriptedOnboardingRepository

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
            CograNavGraph(deepLinkedInviteId = null, navController = navController)
        }
        compose.waitForIdle()
    }

    private fun signIn() = runBlocking {
        tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh"))
    }

    private fun waitForTag(tag: String) {
        // Generous: the first Robolectric + Hilt test in a JVM pays a
        // multi-second class-loading warmup that once tripped 5s.
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun aSignedOutUserLandsOnTheInviteEntry() {
        render()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<InviteEntry>())
            .isTrue()
    }

    @Test
    fun aSignedInSessionLandsOnHome() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = UserProfile("u1", "jakob", null, invitedBy = null)
        render()
        waitForTag("home_greeting")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Home>()).isTrue()
    }

    @Test
    fun aRestoredActorRefreshesHomeAndConfirms() {
        val actor = ActorKey.generate()
        val code = RecoveryCode.generate()
        signIn()
        identity.seed = null
        account.profile = UserProfile("u1", "jakob", null, invitedBy = null)
        account.backupBlob = sealKeyBackup(actor.seed(), code)
        render()

        // The husk state offers restore; take it.
        waitForTag("home_restore")
        compose.onNodeWithTag("home_restore").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Restore>()).isTrue()

        // A real restore: the typed code opens the sealed blob.
        compose.onNodeWithTag("restore_code").performTextInput(code.display())
        compose.onNodeWithTag("restore_submit").performClick()

        // Back on Home with the husk banner gone — no process death.
        // (The snackbar itself is asserted in HomeScreenTest; under
        // Robolectric's fast-forwarded clock it auto-dismisses before a
        // poll can catch it here.)
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Home>() == true &&
                compose.onAllNodesWithTag("home_restore").fetchSemanticsNodes().isEmpty()
        }
        assertThat(identity.seed).isEqualTo(actor.seed())
    }

    @Test
    fun anApplicantLandsInTheHomeShellWithTheWaitingHint() {
        // A parked applicant token, verified email, approval pending —
        // the ONBOARDING phase roots at Home, never at a wall.
        identity.token = "applicant-token"
        onboarding.status = ApplicationStatus(
            handle = "joiner",
            emailVerified = true,
            approvedAt = null,
            landedAt = null,
            expiresAt = Instant.MAX,
            stagedRegistration = null,
        )
        render()

        waitForTag("home_waiting")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Home>()).isTrue()
        // Acting surfaces stay hidden until landing.
        assertThat(compose.onAllNodesWithTag("home_invites").fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun aLandedApplicationClaimsItsSessionAndBecomesTheMemberShell() {
        identity.token = "applicant-token"
        identity.seed = ActorKey.generate().seed()
        onboarding.status = ApplicationStatus(
            handle = "joiner",
            emailVerified = true,
            approvedAt = Instant.now(),
            landedAt = Instant.now(),
            expiresAt = Instant.MAX,
            stagedRegistration = null,
        )
        onboarding.claimTokens = AuthTokens(accessToken = "access", refreshToken = "refresh")
        account.profile = UserProfile("u1", "joiner", null, invitedBy = null)
        render()

        // The app-scoped flow claims on its first pass; the phase flips
        // and Home is recreated in its member shape.
        waitForTag("home_invites")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Home>()).isTrue()
        assertThat(tokens.tokens.value).isNotNull()
        assertThat(identity.token).isNull()
    }
}
