package com.cogra.feature.auth.profile

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class EditProfileScreenTest {

    @get:Rule
    val composeRule = createComposeRule()

    private fun setScreen(
        state: EditProfileUiState,
        onSave: () -> Unit = {},
        onCancel: () -> Unit = {},
        onRetry: () -> Unit = {},
    ) {
        composeRule.setContent {
            EditProfileScreen(
                state = state,
                onHandleChange = {},
                onDisplayNameChange = {},
                onBioChange = {},
                onWebsiteUrlChange = {},
                onSave = onSave,
                onCancel = onCancel,
                onRetry = onRetry,
            )
        }
    }

    @Test
    fun saveIsDisabledWhenCannotSave() {
        setScreen(EditProfileUiState(isLoading = false, displayName = "Alice", canSave = false))
        composeRule.onNodeWithTag(EditProfileTestTags.SAVE).assertIsNotEnabled()
    }

    @Test
    fun saveIsEnabledAndFiresWhenAllowed() {
        var saved = false
        setScreen(
            EditProfileUiState(isLoading = false, displayName = "Alice", canSave = true),
            onSave = { saved = true },
        )
        composeRule.onNodeWithTag(EditProfileTestTags.SAVE)
            .performScrollTo().assertIsEnabled().performClick()
        assertThat(saved).isTrue()
    }

    @Test
    fun cancelFiresTheCallback() {
        var cancelled = false
        setScreen(
            EditProfileUiState(isLoading = false, displayName = "Alice"),
            onCancel = { cancelled = true },
        )
        composeRule.onNodeWithTag(EditProfileTestTags.CANCEL).performScrollTo().performClick()
        assertThat(cancelled).isTrue()
    }

    @Test
    fun errorMessageIsShownWhenPresent() {
        setScreen(
            EditProfileUiState(
                isLoading = false,
                displayName = "Alice",
                errorMessage = "That handle is already taken.",
            ),
        )
        composeRule.onNodeWithTag(EditProfileTestTags.ERROR).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun loadErrorOffersRetry() {
        var retried = false
        setScreen(
            EditProfileUiState(isLoading = false, loadError = true),
            onRetry = { retried = true },
        )
        composeRule.onNodeWithTag(EditProfileTestTags.RETRY).performClick()
        assertThat(retried).isTrue()
    }
}
