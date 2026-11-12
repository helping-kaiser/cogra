package com.cogra.feature.auth

import android.content.Context
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ApplicationProvider
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
            PasswordResetScreen(state = state, onEmailChange = {}, onRequest = {})
        }
    }

    @Test
    fun aRateLimitedRequestShowsItsOwnMessage() {
        render(ResetUiState(email = "a@b.c", error = ErrorCode.RATE_LIMITED))
        compose.onNodeWithTag("reset_error")
            .assertTextEquals(context.getString(R.string.error_rate_limited))
    }

    @Test
    fun anUnmappedRefusalFallsBackToTheGenericMessage() {
        render(ResetUiState(email = "a@b.c", error = ErrorCode.INTERNAL))
        compose.onNodeWithTag("reset_error")
            .assertTextEquals(context.getString(R.string.error_generic))
    }

    @Test
    fun aRequestedResetShowsTheCheckMailNote() {
        render(ResetUiState(email = "a@b.c", requested = true))
        compose.onNodeWithTag("reset_requested").assertExists()
    }

    @Test
    fun progressDisablesTheRequest() {
        render(ResetUiState(email = "a@b.c", inProgress = true))
        compose.onNodeWithTag("reset_request").assertIsNotEnabled()
    }

    // The new password is never set here: it is set where the mailed link
    // lands (ResetNew), asked for twice (seam 275-1).
    @Test
    fun theRequestStepSetsNoPassword() {
        render(ResetUiState())
        compose.onNodeWithTag("reset_password").assertDoesNotExist()
        compose.onNodeWithTag("reset_confirm").assertDoesNotExist()
    }
}
