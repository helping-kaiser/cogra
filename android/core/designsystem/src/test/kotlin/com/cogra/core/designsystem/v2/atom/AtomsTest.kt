package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertTouchHeightIsEqualTo
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The 2.0 atoms' interactive branches and their accessibility guarantees. */
@RunWith(RobolectricTestRunner::class)
class AtomsTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aChipAnnouncesSelectionRatherThanOnlyDrawingIt() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column {
                    CograChip("Tall 4:5", selected = true, onClick = {}, testTag = "tall")
                    CograChip("Square 1:1", selected = false, onClick = {}, testTag = "square")
                }
            }
        }

        // Colour never carries meaning alone (design/readme.md §10).
        compose.onNodeWithTag("tall").assertIsSelected()
        compose.onNodeWithTag("square").assertIsNotSelected()
    }

    @Test
    fun aChipsRemoveAffordanceIsSeparatelyReachable() {
        var removed = false
        compose.setContent {
            Cogra2PreviewTheme {
                CograChip("#coastroad", selected = true, onRemove = { removed = true }, testTag = "topic")
            }
        }

        compose.onNodeWithTag("topic_remove").performClick()

        assertThat(removed).isTrue()
    }

    @Test
    fun everyChipClearsTheMinimumTouchTarget() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograChip("Square 1:1", onClick = {}, testTag = "square")
            }
        }

        // Drawn at 32dp, tapped at 48dp — the target is expanded by hit area
        // rather than by growing the ink, so it is the touch bounds that
        // carry the guarantee.
        compose.onNodeWithTag("square").assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun aCompactPillStillClearsTheMinimumTouchTarget() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograButton("Next", {}, size = ButtonSize.Compact, testTag = "next")
            }
        }

        compose.onNodeWithTag("next").assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun aDisabledPillDoesNotFire() {
        var clicked = false
        compose.setContent {
            Cogra2PreviewTheme {
                CograButton("Next", { clicked = true }, enabled = false, testTag = "next")
            }
        }

        compose.onNodeWithTag("next").assertIsNotEnabled().performClick()

        assertThat(clicked).isFalse()
    }

    @Test
    fun theWizardHeaderWiresItsTwoWaysOut() {
        var back = false
        var left = false
        compose.setContent {
            Cogra2PreviewTheme {
                WizardHeader(
                    title = "New post",
                    onBack = { back = true },
                    backContentDescription = "Back",
                    onLeave = { left = true },
                    testTag = "header",
                )
            }
        }

        compose.onNodeWithTag("header_back").performClick()
        compose.onNodeWithTag("header_leave").performClick()

        assertThat(back).isTrue()
        assertThat(left).isTrue()
    }

    @Test
    fun theHeaderCarriesNoForwardActionOnAnyStage() {
        // The forward action lives at the bottom of the stage, so the
        // top-right corner means one thing — leave — for the whole flow.
        // It used to mean Next on the early stages, and an author trained
        // on that corner left the flow by reaching for it
        // (jakob 2026-09-01).
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    WizardHeader(title = "Crop", onBack = {}, onLeave = {}, testTag = "header")
                }
            }
        }

        compose.onNodeWithTag("header_action").assertDoesNotExist()
        compose.onNodeWithText("Next").assertDoesNotExist()
    }

    @Test
    fun theLeaveControlKeepsTheCornerWhateverTheTitle() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    WizardHeader(title = "Crop", onBack = {}, onLeave = {}, testTag = "header")
                }
            }
        }

        // Nothing actionable follows the X, so a short title must not pull
        // it back toward the middle: the corner is what the author aims at.
        val header = compose.onNodeWithTag("header").getUnclippedBoundsInRoot()
        val leave = compose.onNodeWithTag("header_leave").getUnclippedBoundsInRoot()
        assertThat((header.right - leave.right).value).isWithin(TOLERANCE).of(0f)
    }

    @Test
    fun theSealsTrailingNoteIsANoteRatherThanAControl() {
        compose.setContent {
            Cogra2PreviewTheme {
                WizardHeader(title = "What you sign", onBack = {}, trailingNote = "Last step")
            }
        }

        // Wizard screens carry no step numbers; the seal carries this instead.
        compose.onNodeWithText("Last step").assertExists()
        compose.onNodeWithTag("wizard_action").assertDoesNotExist()
    }

    @Test
    fun anOptionalFieldSaysSoInItsAccessibleName() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograTextField(
                    value = "",
                    onValueChange = {},
                    label = "Title",
                    optional = true,
                    testTag = "title",
                )
            }
        }

        // "Title, optional" rather than two unrelated fragments.
        compose.onNodeWithTag("title").assertExists()
        compose.onNodeWithText("Optional").assertExists()
    }

    @Test
    fun aSettingRowsActionFires() {
        var changed = false
        compose.setContent {
            Cogra2PreviewTheme {
                SettingRow(
                    label = "License",
                    value = "Public domain — your default",
                    actionText = "Change",
                    onAction = { changed = true },
                    testTag = "license",
                )
            }
        }

        compose.onNodeWithTag("license_action").performClick()

        assertThat(changed).isTrue()
    }

    @Test
    fun anInlineActionIsReachableAtTheMinimumTarget() {
        var clicked = false
        compose.setContent {
            Cogra2PreviewTheme {
                InlineAction("Write words instead", { clicked = true }, testTag = "words")
            }
        }

        compose.onNodeWithTag("words").assertTouchHeightIsEqualTo(48.dp).performClick()

        assertThat(clicked).isTrue()
    }
}

/** Layout arithmetic lands on whole pixels, not whole dp. */
private const val TOLERANCE = 1f
