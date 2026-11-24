// THE KEY CARD'S `attach` VALUE (ApplicantFeed.md:19-21, 37-39; the board's
// `keyCard` chip): the applicant's own key, in this app, that did not reach the
// application. Its own class beside StatusBannersTest, which tests the rest of
// the stack.

package com.cogra.feature.home

import android.content.Context
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import com.cogra.domain.AccountState
import com.cogra.domain.UserProfile
import com.cogra.domain.signing.AttachFault
import com.cogra.domain.signing.RegistrationProgress
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class KeyAttachCardTest {

    @get:Rule
    val compose = createComposeRule()

    private val context = ApplicationProvider.getApplicationContext<Context>()

    private fun render(
        fault: AttachFault?,
        keyAttached: Boolean = false,
        surface: ApplicationSurface = ApplicationSurface.FEED,
        onRetry: () -> Unit = {},
    ) {
        val state = HomeUiState(
            loading = false,
            applicant = true,
            profile = UserProfile("u", "joiner", null, AccountState.APPLICANT, false, null),
            progress = RegistrationProgress.AwaitingApproval(
                emailVerified = true,
                keyAttached = keyAttached,
                keyOnDevice = true,
                attachFault = fault,
            ),
        )
        compose.setContent {
            StatusBanners(
                state = state,
                onResendEmailChange = {},
                onResend = {},
                onResumePending = {},
                onStartKeyCeremony = {},
                application = ApplicationCardActions(surface = surface),
                onRetryAttach = onRetry,
            )
        }
    }

    @Test
    fun theOwnKeyThatDidNotAttachReadsAttachYourKeyInTheAppsWords() {
        render(AttachFault.FAILED)
        compose.onNodeWithTag("feed.keyCard").assertExists()
        compose.onNodeWithTag("feed.keyCard.title", useUnmergedTree = true).assertTextEquals("Attach your key")
        compose.onNodeWithTag("feed.keyCard.body", useUnmergedTree = true)
            .assertTextEquals("Your key is in this app. It hasn't reached your application yet.")
    }

    @Test
    fun theFaultLineWithRetryStandsInCreateMyKeysPlace() {
        render(AttachFault.FAILED)
        compose.onNodeWithTag("feed.keyCard.attachFault:attach").assertExists()
        compose.onNodeWithTag("home_attach_fault", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("home_attach_fault_retry", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("home_create_key").assertDoesNotExist()
    }

    @Test
    fun neverAFreshKeyAndNeverAnotherAccount() {
        render(AttachFault.FAILED)
        compose.onNodeWithTag("home_fresh_key").assertDoesNotExist()
        compose.onNodeWithTag("home_key_elsewhere").assertDoesNotExist()
        compose.onNodeWithTag("feed.application").assertDoesNotExist()
    }

    @Test
    fun retryAsksTheAttachAgain() {
        var retries = 0
        render(AttachFault.FAILED, onRetry = { retries += 1 })
        compose.onNodeWithTag("home_attach_fault_retry", useUnmergedTree = true).performClick()
        assertThat(retries).isEqualTo(1)
    }

    @Test
    fun theCardLeavesOnceTheKeyIsAttached() {
        render(fault = null, keyAttached = true)
        compose.onNodeWithTag("feed.keyCard").assertDoesNotExist()
        compose.onNodeWithTag("home_attach_fault", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun aKeyTheServerRefusesAsAnotherAccountsKeepsTodaysCard() {
        render(AttachFault.KEY_IN_USE)
        compose.onNodeWithTag("home_key_elsewhere").assertExists()
        compose.onNodeWithTag("home_fresh_key").assertExists()
        compose.onNodeWithTag("home_attach_fault", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun onTheProfileTheCardStandsUnnamedByTheFeedsNode() {
        render(AttachFault.FAILED, surface = ApplicationSurface.PROFILE)
        compose.onNodeWithTag("home_attach_fault", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("feed.keyCard").assertDoesNotExist()
        assertThat(context.getString(R.string.home_attach_key_title)).isEqualTo("Attach your key")
    }
}
