package com.cogra.core.designsystem

import android.content.ClipDescription
import android.content.ClipboardManager
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.Clipboard
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val CODE = "ABCDE-FGHJK-MNPQR-STVWX-YZ0123"

private class FakeClipboard : Clipboard {
    var entry: ClipEntry? = null

    override suspend fun getClipEntry(): ClipEntry? = entry

    override suspend fun setClipEntry(clipEntry: ClipEntry?) {
        entry = clipEntry
    }

    override val nativeClipboard: ClipboardManager
        get() = error("the fake clipboard fronts no platform manager")
}

@RunWith(RobolectricTestRunner::class)
class RecoveryCodeConfirmTest {

    @get:Rule
    val compose = createComposeRule()

    private val clipboard = FakeClipboard()
    private var confirmed = 0

    private fun show(matches: (String) -> Boolean = { it.trim() == CODE }) {
        compose.setContent {
            CompositionLocalProvider(LocalClipboard provides clipboard) {
                RecoveryCodeConfirm(
                    code = CODE,
                    explainer = "keep it",
                    matches = matches,
                    onConfirmed = { confirmed++ },
                )
            }
        }
    }

    @Test
    fun theCodeShowsAndTheConfirmationIsClosedUntilItIsAnswered() {
        show()

        compose.onNodeWithTag("recovery_code").assertExists()
        compose.onNodeWithTag("recovery_code_saved").assertIsNotEnabled()
    }

    @Test
    fun aWrongAnswerLeavesTheConfirmationClosed() {
        show()

        compose.onNodeWithTag("recovery_code_typed_back").performTextInput("ABCDE")

        compose.onNodeWithTag("recovery_code_saved").assertIsNotEnabled()
        assertThat(confirmed).isEqualTo(0)
    }

    @Test
    fun theCodeTypedBackOpensTheConfirmation() {
        show()

        compose.onNodeWithTag("recovery_code_typed_back").performTextInput(CODE)

        compose.onNodeWithTag("recovery_code_saved").assertIsEnabled()
        compose.onNodeWithTag("recovery_code_saved").performClick()
        assertThat(confirmed).isEqualTo(1)
    }

    @Test
    fun copyingPutsTheCodeOnTheClipboardFlaggedSensitive() {
        show()

        compose.onNodeWithTag("recovery_code_copy").performClick()
        compose.waitForIdle()

        val clip = requireNotNull(clipboard.entry).clipData
        assertThat(clip.getItemAt(0).text.toString()).isEqualTo(CODE)
        assertThat(clip.description.extras?.getBoolean(ClipDescription.EXTRA_IS_SENSITIVE)).isTrue()
    }

    @Test
    fun copyingAloneDoesNotOpenTheConfirmation() {
        // The copy fills the clipboard; pasting it back is what answers.
        show()

        compose.onNodeWithTag("recovery_code_copy").performClick()
        compose.waitForIdle()

        compose.onNodeWithTag("recovery_code_saved").assertIsNotEnabled()
    }

    @Test
    @Config(sdk = [33])
    fun theSystemsOwnCopyConfirmationIsNotDoubled() {
        show()

        compose.onNodeWithTag("recovery_code_copy").performClick()
        compose.waitForIdle()

        compose.onNodeWithTag("recovery_code_copied").assertDoesNotExist()
    }

    @Test
    @Config(sdk = [32])
    fun belowAndroid13TheCopyIsConfirmedInline() {
        show()

        compose.onNodeWithTag("recovery_code_copied").assertDoesNotExist()
        compose.onNodeWithTag("recovery_code_copy").performClick()
        compose.waitForIdle()

        compose.onNodeWithTag("recovery_code_copied").assertExists()
    }
}
