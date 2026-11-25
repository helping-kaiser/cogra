package com.cogra.feature.home

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.AccountState
import com.cogra.domain.UserProfile
import com.cogra.domain.signing.RegistrationProgress
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The app's lines name the platform as `this app`, never `this phone`, each
 * noun with its own preposition (copy-voice, *Platform nouns* and *Sign out*).
 */
@RunWith(RobolectricTestRunner::class)
class AppLineCopyTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aRejectedApplicationSaysThisApp() {
        compose.setContent {
            StatusBanners(
                state = HomeUiState(
                    loading = false,
                    applicant = true,
                    profile = UserProfile("u", "joiner", null, AccountState.APPLICANT, false, null),
                    progress = RegistrationProgress.RejectedByDevice("seal mismatch"),
                ),
                onResendEmailChange = {},
                onResend = {},
                onResumePending = {},
                onStartKeyCeremony = {},
                application = ApplicationCardActions(surface = ApplicationSurface.FEED, onPutAway = {}),
            )
        }
        compose.onNodeWithTag("home_application_rejected").assertTextEquals(REJECTED)
    }

    private companion object {
        const val REJECTED =
            "Something didn't verify in this app, so nothing was signed. Try again from a fresh approval."
    }
}
