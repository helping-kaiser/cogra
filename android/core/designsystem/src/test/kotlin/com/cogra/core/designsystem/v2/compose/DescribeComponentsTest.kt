package com.cogra.core.designsystem.v2.compose

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The describe sheet's two shapes (CW-15/CW-16, 2026-09-08 UI audit) and the
 * counter's permanent reason line (CW-18) — every value cited against
 * `design/components/compose/DescribeSheet.jsx` and `PickedRow.jsx`.
 */
@RunWith(RobolectricTestRunner::class)
class DescribeComponentsTest {

    @get:Rule
    val compose = createComposeRule()

    // ---- DescribeSheet --------------------------------------------------

    @Test
    fun theSheetIsTitledForAPictureByDefault() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "",
                    onValueChange = {},
                    onDone = {},
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithText("Describe this picture").assertExists()
        compose.onNodeWithText("What's in the picture").assertExists()
        compose.onNodeWithTag("sheet_play_disc").assertDoesNotExist()
    }

    @Test
    fun theSheetBecomesTheVideoShapeWhenAsked() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "",
                    onValueChange = {},
                    onDone = {},
                    video = true,
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithText("Describe the video").assertExists()
        compose.onNodeWithText("What's in the video").assertExists()
        compose.onNodeWithTag("sheet_play_disc").assertExists()
    }

    @Test
    fun theReasonRidesUnderTheTitleOnBothShapes() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "",
                    onValueChange = {},
                    onDone = {},
                    video = true,
                    testTag = "sheet",
                )
            }
        }

        // Permanent, not an extended trailing line behind the field.
        compose.onNodeWithText("Read aloud to people who can't see it.").assertExists()
    }

    // Visible but disabled over the cap, never hidden (the caps-affordance
    // round's ruling, PR #755's pattern) — Done stays on screen so the
    // author can trim back under the cap, rather than losing the way out.
    @Test
    fun doneStaysVisibleButDisabledOverTheCap() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "x".repeat(1001),
                    onValueChange = {},
                    onDone = {},
                    cap = 1000,
                    tooLongMessage = TOO_LONG,
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithTag("sheet_done").assertExists().assertIsNotEnabled()
        // copy-voice's own sentence takes the hint's place.
        compose.onNodeWithText(TOO_LONG).assertExists()
    }

    // TYPING STAGES; DONE COMMITS (ComposeDescribe.md): nothing leaves the
    // sheet while the author types, and Done hands out what was typed.
    @Test
    fun typingStagesAndOnlyDoneHandsTheWordsOut() {
        val handed = mutableListOf<String>()
        var done = 0
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "Crates",
                    onValueChange = { handed += it },
                    onDone = { done++ },
                    cap = 1000,
                    tooLongMessage = TOO_LONG,
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithTag("sheet_field").performTextReplacement("Crates of strawberries")
        assertThat(handed).isEmpty()

        compose.onNodeWithTag("sheet_done").performClick()
        assertThat(handed).containsExactly("Crates of strawberries")
        assertThat(done).isEqualTo(1)
    }

    // A sheet torn down without Done (the scrim, a swipe, Back) handed nothing
    // out — and a fresh sheet starts from the description as it stands.
    @Test
    fun aDismissedSheetDropsWhatWasTyped() {
        val handed = mutableListOf<String>()
        var open by mutableStateOf(true)
        compose.setContent {
            Cogra2PreviewTheme {
                if (open) {
                    DescribeSheet(
                        item = MediaItem(null, 1f),
                        value = "Crates",
                        onValueChange = { handed += it },
                        onDone = {},
                        testTag = "sheet",
                    )
                }
            }
        }

        compose.onNodeWithTag("sheet_field").performTextReplacement("Crates of strawberries")
        open = false
        compose.waitForIdle()
        open = true
        compose.waitForIdle()

        assertThat(handed).isEmpty()
        compose.onNodeWithText("Crates", substring = false).assertExists()
    }

    @Test
    fun doneStaysEnabledAtTheCapTheWriteSideAllows() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "x".repeat(1000),
                    onValueChange = {},
                    onDone = {},
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithTag("sheet_done").assertExists().assertIsEnabled()
    }

    // Drawn truth, pinned against the master (jakob hand-test finding,
    // 2026-09-17: the strip rendered at ~2/3 of this): contain-whole media
    // strip, 180dp tall (`design/components/compose/DescribeSheet.jsx:61` —
    // `PreviewHeight` cites the same line).
    @Test
    fun theStripDrawsAtTheBoardsHeight() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeSheet(
                    item = MediaItem(null, 1f),
                    value = "",
                    onValueChange = {},
                    onDone = {},
                    testTag = "sheet",
                )
            }
        }

        compose.onNodeWithTag("sheet_strip").assertHeightIsEqualTo(180.dp)
    }

    // ---- DescribeCounter --------------------------------------------------

    @Test
    fun theCounterCarriesThePermanentReasonUnderTheRow() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeCounter(described = 0, total = 1, onDescribe = {}, testTag = "counter")
            }
        }

        compose.onNodeWithText("Read aloud to people who can't see it.").assertExists()
    }

    @Test
    fun theCounterReadsTheVideoSubjectWhenAsked() {
        compose.setContent {
            Cogra2PreviewTheme {
                DescribeCounter(
                    described = 0,
                    total = 1,
                    onDescribe = {},
                    subject = DescribeSubject.Video,
                    testTag = "counter",
                )
            }
        }

        compose.onNodeWithTag("counter").assertExists()
        compose.onNodeWithText("Read aloud to people who can't see it.").assertExists()
    }

    // ---- PickedRow --------------------------------------------------------

    @Test
    fun theRowBadgesItsFirstPictureTheCover() {
        compose.setContent {
            Cogra2PreviewTheme {
                PickedRow(
                    pictures = List(2) { PickedPicture(MediaItem(null, 1f)) },
                    caption = "2 pictures — the body",
                    onManage = {},
                    testTag = "row",
                )
            }
        }

        // PickedRow.jsx `cover={index === 0}` (round 22, seam 245 ask 13 F):
        // one badge, on the first tile.
        compose.onAllNodesWithTag("media_thumb_cover_badge", useUnmergedTree = true).assertCountEquals(1)
    }

    @Test
    fun aClipsRowIsNoSetAndWearsNoCover() {
        compose.setContent {
            Cogra2PreviewTheme {
                PickedRow(
                    pictures = listOf(PickedPicture(MediaItem(null, 1f), duration = "0:12")),
                    caption = "Video",
                    onManage = null,
                    onRemove = {},
                    testTag = "row",
                )
            }
        }

        compose.onAllNodesWithTag("media_thumb_cover_badge", useUnmergedTree = true).assertCountEquals(0)
    }

    private companion object {
        const val TOO_LONG = "A picture's description is at most 1,000 characters."
    }
}
