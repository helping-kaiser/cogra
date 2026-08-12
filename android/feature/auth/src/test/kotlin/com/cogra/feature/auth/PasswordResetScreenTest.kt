package com.cogra.feature.auth

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ApplicationProvider
import android.content.Context
import com.cogra.domain.ErrorCode
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PasswordResetScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val context: Context = ApplicationProvider.getApplicationContext()

    private fun render(state: ResetUiState) {
        compose.setContent {
            PasswordResetScreen(
                state = state,
                onEmailChange = {},
                onTokenChange = {},
                onNewPasswordChange = {},
                onRequest = {},
                onConfirm = {},
            )
        }
    }

    @Test
    fun anInvalidTokenRefusalShowsItsSpecificMessage() {
        // The backend refuses a bad reset token with
        // RESET_TOKEN_INVALID (api-spec.md "confirmPasswordReset").
        render(ResetUiState(token = "stale", newPassword = "x", error = ErrorCode.RESET_TOKEN_INVALID))
        compose.onNodeWithTag("reset_error")
            .assertTextEquals(context.getString(R.string.reset_token_invalid))
    }

    @Test
    fun anUnmappedRefusalFallsBackToTheGenericMessage() {
        render(ResetUiState(token = "t", newPassword = "x", error = ErrorCode.INTERNAL))
        compose.onNodeWithTag("reset_error")
            .assertTextEquals(context.getString(R.string.error_generic))
    }

    @Test
    fun aRequestedResetShowsTheCheckMailNote() {
        render(ResetUiState(email = "a@b.c", requested = true))
        compose.onNodeWithTag("reset_requested").assertExists()
    }

    @Test
    fun progressDisablesBothSubmits() {
        render(ResetUiState(email = "a@b.c", token = "t", newPassword = "x", inProgress = true))
        compose.onNodeWithTag("reset_request").assertIsNotEnabled()
        compose.onNodeWithTag("reset_confirm").assertIsNotEnabled()
    }
}
