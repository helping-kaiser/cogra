package com.cogra.feature.auth

import android.content.Context
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import com.cogra.domain.ErrorCode
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LoginScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        state: LoginUiState,
        onForgetOnSignOutChange: (Boolean) -> Unit = {},
        onJoin: () -> Unit = {},
        onBrowse: () -> Unit = {},
    ) {
        compose.setContent {
            LoginScreen(
                state = state,
                onEmailChange = {},
                onPasswordChange = {},
                onForgetOnSignOutChange = onForgetOnSignOutChange,
                onSubmit = {},
                onForgotPassword = {},
                onJoin = onJoin,
                onBrowse = onBrowse,
            )
        }
    }

    @Test
    fun submitEnablesOnlyWithBothFields() {
        render(LoginUiState(email = "a@b.c", password = ""))
        compose.onNodeWithTag("login_submit").assertIsNotEnabled()
    }

    @Test
    fun aRefusalRendersItsMessage() {
        render(LoginUiState(email = "a@b.c", password = "x", error = ErrorCode.INVALID_CREDENTIALS))
        compose.onNodeWithTag("login_error").assertExists()
        compose.onNodeWithTag("login_submit").assertIsEnabled()
    }

    @Test
    fun aRateLimitedRefusalRendersTheBackoffCopy() {
        val context: Context = ApplicationProvider.getApplicationContext()
        render(LoginUiState(email = "a@b.c", password = "x", error = ErrorCode.RATE_LIMITED))
        compose.onNodeWithTag("login_error")
            .assertTextEquals(context.getString(R.string.error_rate_limited))
    }

    @Test
    fun thePasswordFieldCarriesItsVisibilityToggle() {
        render(LoginUiState())
        compose.onNodeWithTag("login_password_toggle").assertExists()
    }

    @Test
    fun progressDisablesTheForm() {
        render(LoginUiState(email = "a@b.c", password = "x", inProgress = true))
        compose.onNodeWithTag("login_progress").assertExists()
        compose.onNodeWithTag("login_submit").assertIsNotEnabled()
    }

    @Test
    fun theDontRememberRowIsOneAccessibleToggle() {
        // The row carries the toggle semantics (checkbox role, off by
        // default) and tapping it reports the flip — the documented
        // checkbox-with-label pattern.
        var reported: Boolean? = null
        render(LoginUiState(), onForgetOnSignOutChange = { reported = it })
        compose.onNodeWithTag("login_dont_remember").assertIsOff()
        compose.onNodeWithTag("login_dont_remember").performClick()
        assertThat(reported).isTrue()
    }

    @Test
    fun theDontRememberRowRendersItsState() {
        render(LoginUiState(forgetOnSignOut = true))
        compose.onNodeWithTag("login_dont_remember").assertIsOn()
    }

    @Test
    fun theEntryCarriesTheInviteAndBrowsePaths() {
        // Login is the signed-out entry (design.md §6): the other two
        // paths — apply with an invite, read without an account — hang
        // off it.
        var joined = false
        var browsed = false
        render(LoginUiState(), onJoin = { joined = true }, onBrowse = { browsed = true })
        compose.onNodeWithTag("login_join").performScrollTo().performClick()
        compose.onNodeWithTag("login_browse").performScrollTo().performClick()
        assertThat(joined).isTrue()
        assertThat(browsed).isTrue()
    }
}
