// NavHost tests per the documented Navigation Compose pattern: a
// TestNavHostController drives the real graph, real destinations, and
// real Hilt ViewModels over the fake DI graph (FakeBindingsModule).

package com.cogra.app.navigation

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
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

@OptIn(ExperimentalTestApi::class)
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

    private fun member() = UserProfile("u1", "jakob", null, AccountState.MEMBER, invitedBy = null)

    private fun applicant() = UserProfile("u1", "joiner", null, AccountState.APPLICANT, invitedBy = null)

    private fun applicantStatus(keyAttached: Boolean) = ApplicationStatus(
        accountState = AccountState.APPLICANT,
        application = ApplicationView(
            handle = "joiner",
            emailVerified = true,
            keyAttached = keyAttached,
            approvedAt = null,
            landedAt = null,
            expiresAt = Instant.MAX,
        ),
        stagedRegistration = null,
    )

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
        account.profile = member()
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
        account.profile = member()
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
    fun aChangedHandleRefreshesTheHomeGreeting() {
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = member()
        render()

        waitForTag("home_greeting")
        compose.onNodeWithTag("home_settings").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Settings>()).isTrue()

        compose.onNodeWithTag("settings_new_handle").performScrollTo().performTextInput("renamed")
        compose.onNodeWithTag("settings_change_handle").performScrollTo().performClick()
        compose.waitForIdle()

        // Home outlives the push/pop; only the nav result re-reads the
        // profile, so the greeting must show the new handle on return.
        compose.onNodeWithTag("settings_back").performClick()
        compose.waitUntilAtLeastOneExists(
            hasTestTag("home_greeting") and hasText("renamed", substring = true),
            timeoutMillis = 30_000,
        )
    }

    @Test
    fun anApplicantLandsInTheHomeShellWithTheWaitingHint() {
        // Registration returned an ordinary session: the applicant is
        // simply signed in, and Home is the root — never a wall.
        signIn()
        identity.seed = ActorKey.generate().seed()
        account.profile = applicant()
        onboarding.status = applicantStatus(keyAttached = true)
        render()

        waitForTag("home_waiting")
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Home>()).isTrue()
        // Acting surfaces stay hidden until landing.
        assertThat(compose.onAllNodesWithTag("home_invites").fetchSemanticsNodes()).isEmpty()
    }

    @Test
    fun theCeremonyCardRunsTheKeyCeremonyAndReturns() {
        signIn()
        identity.seed = null
        account.profile = applicant()
        onboarding.status = applicantStatus(keyAttached = false)
        render()

        // The missing key proof surfaces as a card; take it.
        waitForTag("home_create_key")
        compose.onNodeWithTag("home_create_key").performClick()
        compose.waitForIdle()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<KeyCeremony>()).isTrue()

        // Accept the backup: mint, attach, seal, show the code once.
        compose.onNodeWithTag("backup_accept").performClick()
        waitForTag("backup_code")
        assertThat(identity.seed).isNotNull()
        assertThat(onboarding.attachedKeys).hasSize(1)
        assertThat(account.uploadedBackup).isNotNull()

        // Confirming the code pops back into the Home shell.
        compose.onNodeWithTag("backup_code_saved").performClick()
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<Home>() == true
        }
    }
}
