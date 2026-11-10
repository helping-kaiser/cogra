package com.cogra.feature.auth

import android.text.InputType
import android.view.inputmethod.EditorInfo
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.platform.InterceptPlatformTextInput
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.awaitCancellation
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RestoreScreenTest {

    @get:Rule
    val compose = createComposeRule()

    // What the IME is told when the field takes focus: the editor info is the
    // only place the keyboard type and autocorrect choice are observable.
    @OptIn(ExperimentalComposeUiApi::class)
    @Test
    fun theCodeFieldAsksTheKeyboardForPasswordInputWithoutAutocorrect() {
        var editor: EditorInfo? = null
        compose.setContent {
            InterceptPlatformTextInput(
                interceptor = { request, _ ->
                    editor = EditorInfo().also { request.createInputConnection(it) }
                    awaitCancellation()
                },
            ) {
                RestoreScreen(
                    state = RestoreUiState(),
                    onCodeChange = {},
                    onForgetOnSignOutChange = {},
                    onSubmit = {},
                )
            }
        }

        compose.onNodeWithTag("restore_code").performClick()
        compose.waitForIdle()

        val info = requireNotNull(editor)
        assertThat(info.inputType and InputType.TYPE_MASK_VARIATION)
            .isEqualTo(InputType.TYPE_TEXT_VARIATION_PASSWORD)
        assertThat(info.inputType and InputType.TYPE_TEXT_FLAG_AUTO_CORRECT).isEqualTo(0)
    }
}
