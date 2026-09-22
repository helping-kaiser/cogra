package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Dp
import com.cogra.core.designsystem.v2.compose.DescribeSheet
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * THE SHEET CEILING AND THE GROWTH LAW (jakob's ruling, the sheets-and-video
 * round, 2026-09-22 — design/readme.md §13; the master is
 * `design/components/core/BottomSheet.jsx`, whose `SHEET_CEILING` is the same
 * `calc(100% - 72px - env(safe-area-inset-top, 0px))`).
 *
 * The bug these pin: a describe sheet given a long description grew to the
 * physical top of the device, so Done was off the screen with nothing to
 * scroll to reach it.
 *
 * Structural assertions only — `captureToImage()` hangs under Robolectric
 * 4.16.1 with Compose BOM 2025.10.01, so what is checked is geometry read
 * from the semantics tree, never pixels.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class SheetCeilingTest {

    @get:Rule
    val compose = createComposeRule()

    /** Longer than any screen: the length that used to take Done with it. */
    private val enormous = List(200) { "line $it of a description nobody asked for" }
        .joinToString("\n")

    /**
     * The sheet where a sheet stands — at the bottom edge it rose from — with
     * its value held so a test can write into it and measure the difference.
     */
    private fun describeSheet(initial: String): MutableState<String> {
        val value = mutableStateOf(initial)
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
                    DescribeSheet(
                        item = MediaItem(null, 1f),
                        value = value.value,
                        onValueChange = { value.value = it },
                        onDone = {},
                        testTag = "sheet",
                    )
                }
            }
        }
        return value
    }

    private fun rootHeight(): Dp =
        compose.onRoot().getUnclippedBoundsInRoot().let { it.bottom - it.top }

    private fun heightOf(tag: String): Float =
        compose.onNodeWithTag(tag).getUnclippedBoundsInRoot().let { (it.bottom - it.top).value }

    // (a) The ceiling itself: whatever it carries, the surface's top edge
    // stays at least a 72dp sliver below the top of the safe area — which in
    // the sandbox, with no status bar drawn, is the top of the window.
    @Test
    fun theSheetNeverRisesAboveTheSliverHoweverMuchItCarries() {
        describeSheet(enormous)

        val sheet = compose.onNodeWithTag("sheet").getUnclippedBoundsInRoot()
        assertThat(sheet.top.value).isAtLeast(SheetCeilingSliver.value)
        assertThat(heightOf("sheet")).isAtMost((rootHeight() - SheetCeilingSliver).value)
    }

    // The ceiling CAPS rather than sets: a sheet with little to carry is
    // content-sized and stands well short of it.
    @Test
    fun aSheetWithLittleToCarryIsShorterThanTheCeiling() {
        describeSheet("")

        assertThat(heightOf("sheet")).isLessThan((rootHeight() - SheetCeilingSliver).value)
    }

    // (c) The point of the ceiling: Done is on the screen at every content
    // size, so an author who wrote too much can still leave the sheet.
    @Test
    fun doneStaysOnTheScreenUnderEnormousContent() {
        describeSheet(enormous)

        compose.onNodeWithTag("sheet_done").assertIsDisplayed()
    }

    // (b) The field takes a line at a time as the writing needs one…
    @Test
    fun theFieldGrowsWithTheWriting() {
        val value = describeSheet("")
        val opened = heightOf("sheet_field")

        compose.runOnUiThread { value.value = "one\ntwo\nthree\nfour\nfive" }
        compose.waitForIdle()

        assertThat(heightOf("sheet_field")).isGreaterThan(opened)
    }

    // …and stops at the room the sheet's own chrome left, from where it
    // scrolls inside itself rather than carrying the sheet past the ceiling.
    @Test
    fun theFieldStopsAtTheRoomTheSheetHasLeft() {
        val value = describeSheet("one\ntwo\nthree\nfour\nfive")
        val fiveLines = heightOf("sheet_field")

        compose.runOnUiThread { value.value = enormous }
        compose.waitForIdle()

        val capped = heightOf("sheet_field")
        val sheet = compose.onNodeWithTag("sheet").getUnclippedBoundsInRoot()
        val done = compose.onNodeWithTag("sheet_done").getUnclippedBoundsInRoot()

        // Forty times the words, nothing like forty times the box.
        assertThat(capped).isLessThan(fiveLines * 40)
        assertThat(capped).isLessThan(heightOf("sheet"))
        assertThat(compose.onNodeWithTag("sheet_field").getUnclippedBoundsInRoot().bottom.value)
            .isAtMost(done.top.value)
    }

    // (d) The drawn minimum. The describe field opens at TWO lines
    // (`DescribeSheet.jsx` `rows={2}`), measured against a one-line field of
    // the same atom drawn in the same composition — a line count, not a
    // transcribed pixel height.
    @Test
    fun theDescribeFieldOpensAtItsDrawnTwoLines() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.fillMaxSize()) {
                    ReferenceField(lines = 1, tag = "one_line")
                    Spacer(Modifier.weight(1f))
                    DescribeSheet(
                        item = MediaItem(null, 1f),
                        value = "",
                        onValueChange = {},
                        onDone = {},
                        testTag = "sheet",
                    )
                }
            }
        }

        assertThat(heightOf("sheet_field")).isGreaterThan(heightOf("one_line"))
    }
}

/** The field atom at a known line count, to measure a drawn minimum against. */
@Composable
private fun ReferenceField(lines: Int, tag: String) {
    CograTextField(
        value = "",
        onValueChange = {},
        label = "Reference",
        singleLine = false,
        minLines = lines,
        testTag = tag,
    )
}
