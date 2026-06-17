package com.cogra.feature.auth.login

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class LoginScreenTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun submitIsDisabledWhenFieldsAreEmpty() {
        composeRule.setContent {
            LoginScreen(
                state = LoginUiState(),
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
            )
        }

        composeRule.onNodeWithTag(LoginTestTags.SUBMIT).assertIsNotEnabled()
    }

    @Test
    fun submitIsEnabledAndFiresWhenFieldsAreFilled() {
        var submitted = false
        composeRule.setContent {
            LoginScreen(
                state = LoginUiState(email = "a@b.com", password = "pw"),
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = { submitted = true },
            )
        }

        composeRule.onNodeWithTag(LoginTestTags.SUBMIT).assertIsEnabled().performClick()

        assertThat(submitted).isTrue()
    }

    @Test
    fun errorMessageIsShownWhenPresent() {
        composeRule.setContent {
            LoginScreen(
                state = LoginUiState(
                    email = "a@b.com",
                    password = "pw",
                    errorMessage = "Email or password is incorrect.",
                ),
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
            )
        }

        composeRule.onNodeWithTag(LoginTestTags.ERROR).assertIsDisplayed()
    }
}
