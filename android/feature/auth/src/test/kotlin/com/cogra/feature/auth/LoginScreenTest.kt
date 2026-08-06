// Compose tests under Robolectric, bound to testTags (android/CLAUDE.md
// "Tests ship with the code").

package com.cogra.feature.auth

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.ErrorCode
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LoginScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(state: LoginUiState) {
        compose.setContent {
            LoginScreen(
                state = state,
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
                onForgotPassword = {},
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
}
