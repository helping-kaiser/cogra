package com.cogra.core.designsystem

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PasswordTextFieldTest {

    @get:Rule
    val compose = createComposeRule()

    private val secret = "hunter2secret"
    private val masked = "•".repeat(secret.length)

    private fun render() {
        compose.setContent {
            var value by remember { mutableStateOf("") }
            PasswordTextField(
                value = value,
                onValueChange = { value = it },
                label = "Password",
                testTag = "field",
            )
        }
    }

    @Test
    fun typedTextStaysMaskedUntilTheToggleRevealsIt() {
        render()
        compose.onNodeWithTag("field").performTextInput(secret)
        compose.onNodeWithTag("field").assertTextContains(masked)
        compose.onNodeWithTag("field_toggle").performClick()
        compose.onNodeWithTag("field").assertTextContains(secret)
    }

    @Test
    fun aSecondToggleMasksAgain() {
        render()
        compose.onNodeWithTag("field").performTextInput(secret)
        compose.onNodeWithTag("field_toggle").performClick()
        compose.onNodeWithTag("field_toggle").performClick()
        compose.onNodeWithTag("field").assertTextContains(masked)
    }
}
