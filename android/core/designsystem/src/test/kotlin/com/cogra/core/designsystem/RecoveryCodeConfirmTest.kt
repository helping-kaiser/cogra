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
import androidx.compose.ui.test.performTextClearance
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

    private fun show(
        matches: (String) -> Boolean = { it.trim() == CODE },
        diverged: (String) -> Boolean = { typed -> typed.isNotEmpty() && !CODE.startsWith(typed) },
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalClipboard provides clipboard) {
                RecoveryCodeConfirm(
                    code = CODE,
                    explainer = "keep it",
                    matches = matches,
                    diverged = diverged,
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

    // The line is the field's own supporting text, so it merges into the
    // field's node — which is what has TalkBack read it with the field.
    private fun mismatchLine() =
        compose.onNodeWithTag("recovery_code_mismatch", useUnmergedTree = true)

    // A diverging character — CODE's fifth character is 'E', not 'Z' —
    // fires the line at once; the earlier characters were a correct
    // partial right up to that point.
    @Test
    fun aDivergingCharacterSaysSoRatherThanOnlyClosingTheButton() {
        show()

        compose.onNodeWithTag("recovery_code_typed_back").performTextInput("ABCDZ")

        mismatchLine().assertExists()
    }

    @Test
    fun anUntouchedFieldIsNotYetAMistake() {
        show()

        mismatchLine().assertDoesNotExist()
    }

    // Ruling 41.2: a correct-so-far partial is still on its way to being
    // right, not a mistake — "ABCDE" is CODE's own first five characters.
    @Test
    fun aCorrectPartialShowsNoMismatchLine() {
        show()

        compose.onNodeWithTag("recovery_code_typed_back").performTextInput("ABCDE")

        mismatchLine().assertDoesNotExist()
    }

    @Test
    fun theMismatchLineGoesWhenTheCodeIsAnswered() {
        show()

        compose.onNodeWithTag("recovery_code_typed_back").performTextInput("ABCDZ")
        mismatchLine().assertExists()

        compose.onNodeWithTag("recovery_code_typed_back").performTextClearance()
        compose.onNodeWithTag("recovery_code_typed_back").performTextInput(CODE)

        mismatchLine().assertDoesNotExist()
    }

    // Backspacing a diverged character off the end lands back on a
    // valid prefix, and the line clears the instant it does.
    @Test
    fun backspacingOffTheDivergedCharacterClearsTheMismatchLine() {
        show()

        compose.onNodeWithTag("recovery_code_typed_back").performTextInput("ABCDZ")
        mismatchLine().assertExists()

        compose.onNodeWithTag("recovery_code_typed_back").performTextClearance()
        compose.onNodeWithTag("recovery_code_typed_back").performTextInput("ABCD")

        mismatchLine().assertDoesNotExist()
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
