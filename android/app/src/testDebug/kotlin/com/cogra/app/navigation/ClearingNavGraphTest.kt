// Clearing data through the real NavHost (Settings.md "Clearing data";
// EraseConfirm.md): the erase lands on sign-in with nothing remembered and
// no snackbar, and the system's "Manage space" door opens settings at the
// group with nothing cleared.

package com.cogra.app.navigation

import android.content.Intent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.ExperimentalTestApi
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
import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.UserProfile
import com.cogra.domain.testing.FakeDeviceData
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

@OptIn(ExperimentalTestApi::class)
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
class ClearingNavGraphTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Inject lateinit var tokens: FakeTokenStore

    @Inject lateinit var identity: FakeIdentityStore

    @Inject lateinit var account: ScriptedAccountRepository

    @Inject lateinit var deviceData: FakeDeviceData

    private lateinit var navController: TestNavHostController

    @Before
    fun inject() {
        hilt.inject()
    }

    private fun signIn() {
        runBlocking { tokens.save(AuthTokens(accessToken = "access", refreshToken = "refresh", accountId = "u1")) }
        identity.seed = ActorKey.generate().seed()
        account.profile = UserProfile("u1", "jakob", null, AccountState.MEMBER, true, invitedBy = null)
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

    private inline fun <reified T : Any> waitForRoute() {
        compose.waitUntil(timeoutMillis = 30_000) {
            navController.currentBackStackEntry?.destination?.hasRoute<T>() == true
        }
    }

    private fun waitForTag(tag: String) {
        compose.waitUntil(timeoutMillis = 30_000) {
            compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun `the_erase_lands_on_sign_in_with_nothing_kept`() {
        signIn()
        render()
        waitForRoute<Feed>()
        compose.runOnUiThread { navController.navigate(Settings) }
        waitForTag("settings.clearing.erase")
        compose.onNodeWithTag("settings.clearing.erase", useUnmergedTree = true).performScrollTo().performClick()
        waitForTag("settings.dialog")
        // Nothing before an answer (EraseConfirm.md:3).
        assertThat(deviceData.erases).isEqualTo(0)
        compose.onAllNodesWithTag("settings.dialog.erase:none", useUnmergedTree = true)[0].performClick()
        waitForRoute<Login>()
        assertThat(deviceData.erases).isEqualTo(1)
        assertThat(runBlocking { tokens.current() }).isNull()
        assertThat(identity.seed).isNull()
    }

    @Test
    fun `manage_space_opens_settings_at_clearing_data_and_clears_nothing`() {
        signIn()
        compose.runOnUiThread { compose.activity.intent = Intent(ACTION_MANAGE_SPACE) }
        render()
        waitForRoute<Settings>()
        waitForTag("settings.clearing")
        assertThat(deviceData.erases).isEqualTo(0)
        assertThat(runBlocking { tokens.current() }).isNotNull()
    }
}
