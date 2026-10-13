// The account deletion's flows through the real NavHost (the documented
// Navigation Compose pattern, as CograNavGraphTest): request-account-
// deletion, the applicant's immediate case, confirm-the-account-deletion
// through the App Link, and cancel-the-deletion-from-the-feed.

package com.cogra.app.navigation

import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.ComposeNavigator
import androidx.navigation.testing.TestNavHostController
import androidx.navigation.toRoute
import com.cogra.app.BuildConfig
import com.cogra.app.HiltTestActivity
import com.cogra.app.di.ScriptedAccountRepository
import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.DeletionStanding
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ScriptedAccountDeletionRepository
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

@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class DeletionNavGraphTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var deletions: ScriptedAccountDeletionRepository

    private lateinit var navController: TestNavHostController

    /** Six days and a bit out: far enough that the count is stable while the test runs. */
    private val grace = AccountDeletion(Instant.now().plusSeconds(6 * 86_400 + 600), includesContent = false)

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

    private fun signInAs(state: AccountState) {
        runBlocking { tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1")) }
        identity.seed = ActorKey.generate().seed()
        account.profile = UserProfile("u1", "jakob", null, state, true, invitedBy = null)
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private inline fun <reified T : Any> waitForRoute() {
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<T>() == true
        }
    }

    private fun open(route: Any) {
        compose.runOnUiThread { navController.navigate(route) }
        compose.waitForIdle()
    }

    @Test
    fun `the_members_request_mails_the_link_and_back_reaches_settings`() {
        signInAs(AccountState.MEMBER)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, null))
        render()
        waitForRoute<Feed>()
        open(Settings)
        waitForTag("settings.ending.delete")
        compose.onNodeWithTag("settings.ending.delete", useUnmergedTree = true).performScrollTo().performClick()
        waitForRoute<DeleteAccount>()

        waitForTag("deleteAccount.commit:member")
        compose.onNodeWithTag("deleteAccount.sweep", useUnmergedTree = true).performScrollTo().performClick()
        compose.onNodeWithTag("deleteAccount.commit:member", useUnmergedTree = true).performScrollTo().performClick()
        waitForRoute<DeleteAccountMail>()
        assertThat(deletions.requests).containsExactly(true)
        assertThat(navController.currentBackStackEntry?.toRoute<DeleteAccountMail>()?.includeContent).isTrue()

        // The request left the stack: Back from the mail reaches settings.
        compose.onNodeWithTag("deleteAccount.header.back", useUnmergedTree = true).performClick()
        waitForRoute<Settings>()
    }

    @Test
    fun `a_locked_row_answers_on_settings_and_opens_nothing`() {
        signInAs(AccountState.APPLICANT)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.LOCKED, null))
        render()
        waitForRoute<Feed>()
        open(Settings)
        waitForTag("settings.ending.delete")
        compose.onNodeWithTag("settings.ending.delete", useUnmergedTree = true).performScrollTo().performClick()
        compose.waitUntilAtLeastOneExists(
            hasText("You can delete your account once your registration lands."),
            timeoutMillis = 30_000,
        )
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Settings>()).isTrue()
    }

    @Test
    fun `an_applicants_deletion_lands_signed_out_on_the_bare_feed_with_one_snackbar`() {
        signInAs(AccountState.APPLICANT)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.IMMEDIATE, null))
        render()
        waitForRoute<Feed>()
        open(DeleteAccount)
        waitForTag("deleteAccount.commit:applicant")
        compose.onNodeWithTag("deleteAccount.commit:applicant", useUnmergedTree = true).performClick()

        compose.waitUntilAtLeastOneExists(hasText("Your account is deleted."), timeoutMillis = 30_000)
        assertThat(deletions.applicantDeletes).isEqualTo(1)
        assertThat(runBlocking { tokens.current() }).isNull()
        // The bare view, never sign-in.
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Login>()).isFalse()
    }

    @Test
    fun `the_link_confirms_signed_in_and_the_feed_wears_the_band_until_canceled`() {
        signInAs(AccountState.MEMBER)
        deletions.confirm = Outcome.Success(grace)
        render()
        waitForRoute<Feed>()

        // Confirmed now: the account's own read answers the grace.
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        val handled = navController.handleDeepLink(
            Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.WEB_ORIGIN}/delete-account?token=link-token")),
        )
        assertThat(handled).isTrue()
        waitForRoute<DeleteAccountConfirmed>()
        waitForTag("deleteAccount.onward")
        assertThat(deletions.confirms).containsExactly("link-token" to false)

        compose.onNodeWithTag("deleteAccount.onward", useUnmergedTree = true).performScrollTo().performClick()
        waitForRoute<Feed>()
        waitForTag("feed.deletionBand.line")

        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, null))
        compose.onNodeWithTag("feed.deletionBand.cancel", useUnmergedTree = true).performClick()
        compose.waitUntilAtLeastOneExists(
            hasText("Canceled — your account stays, and nothing was deleted."),
            timeoutMillis = 30_000,
        )
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodes(hasTestTag("feed.deletionBand"), useUnmergedTree = true)
                .fetchSemanticsNodes().isEmpty()
        }
        assertThat(deletions.cancels).isEqualTo(1)
    }

    @Test
    fun `a_dead_link_signed_in_lands_on_the_dead_landing_and_goes_back_to_settings`() {
        signInAs(AccountState.MEMBER)
        deletions.confirm = Outcome.Refused(
            listOf(UserError(ErrorCode.DELETION_TOKEN_INVALID, "dead", listOf("deletionToken"))),
        )
        render()
        waitForRoute<Feed>()
        navController.handleDeepLink(
            Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.WEB_ORIGIN}/delete-account?token=spent")),
        )
        waitForRoute<DeleteAccountConfirmed>()
        // DeleteLinkExpired.md:5-13 — one landing, never saying which happened.
        compose.waitUntilAtLeastOneExists(hasText("This link doesn't work anymore"), timeoutMillis = 30_000)
        compose.onNodeWithTag("deleteAccount.onward", useUnmergedTree = true).performScrollTo().performClick()
        waitForRoute<Settings>()
    }

    @Test
    fun `the_band_rides_the_inner_surfaces_too`() {
        signInAs(AccountState.MEMBER)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        render()
        waitForRoute<Feed>()
        waitForTag("feed.deletionBand.line")
        // Two inner surfaces whose reads the fakes answer; the rest are covered by their screens' slots.
        for (route in listOf(ChangePassword, About)) {
            open(route)
            waitForTag("home_deletion_band")
            compose.runOnUiThread { navController.popBackStack() }
            compose.waitForIdle()
        }
    }

    @Test
    fun `the_deadline_met_with_a_session_here_lands_on_the_bare_feed_never_sign_in`() {
        signInAs(AccountState.MEMBER)
        val passed = AccountDeletion(Instant.now().minusSeconds(1), includesContent = false)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, passed))
        render()
        waitForRoute<Feed>()
        waitForTag("feed.deletionBand")

        // The execution ended every session: this device's ends too.
        runBlocking { tokens.clear() }
        compose.waitUntilAtLeastOneExists(hasText("Your account is deleted."), timeoutMillis = 30_000)
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Feed>()).isTrue()
        assertThat(navController.currentBackStackEntry?.destination?.hasRoute<Login>()).isFalse()
    }

    @Test
    fun `a_session_ending_inside_the_grace_signs_in_again_as_ever`() {
        signInAs(AccountState.MEMBER)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        render()
        waitForRoute<Feed>()
        waitForTag("feed.deletionBand")
        runBlocking { tokens.clear() }
        waitForRoute<Login>()
    }

    @Test
    fun `the_grace_page_cancels_back_to_settings_with_the_snackbar`() {
        signInAs(AccountState.MEMBER)
        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        render()
        waitForRoute<Feed>()
        open(Settings)
        waitForTag("settings.deletionBand.line")
        compose.onNodeWithTag("settings.ending.delete", useUnmergedTree = true).performScrollTo().performClick()
        waitForRoute<DeleteAccountPending>()
        waitForTag("deleteAccount.cancel")

        deletions.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, null))
        compose.onNodeWithTag("deleteAccount.cancel", useUnmergedTree = true).performClick()
        waitForRoute<Settings>()
        compose.waitUntilAtLeastOneExists(
            hasText("Canceled — your account stays, and nothing was deleted."),
            timeoutMillis = 30_000,
        )
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodes(hasTestTag("settings.deletionBand"), useUnmergedTree = true)
                .fetchSemanticsNodes().isEmpty()
        }
    }
}
