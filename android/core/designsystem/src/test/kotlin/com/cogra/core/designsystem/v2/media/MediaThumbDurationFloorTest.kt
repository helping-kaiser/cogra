package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The duration pill's own floor and corner (jakob's ruling, 2026-09-22:
 * design/readme.md §13, "the composer's, and the detail has one reading").
 *
 * **The regression this pins.** `PickedRow` (the wizard's Details-step
 * summary, `PickedPictures.kt`) draws a video's tile at `Layout.ThumbSize`
 * (48dp) with no size override — under the ruling's 80dp floor, so the
 * pill outweighed the tile it sat on (jakob's hand test, 2026-09-22). The
 * pick grid's own tile (`BodyStep.kt`'s `PickStage`, 125dp, `size = null`
 * — measured by the grid's own column rather than a literal `Dp`) is the
 * surface the pill was actually drawn for, and it must keep showing it.
 *
 * `useUnmergedTree = true`: `MediaThumb`'s outer Box merges its
 * descendants into one semantics node, so a badge's own testTag only
 * survives in the unmerged tree.
 */
@RunWith(RobolectricTestRunner::class)
class MediaThumbDurationFloorTest {

    @get:Rule
    val compose = createComposeRule()

    private val item = MediaItem(null, 1f, "A clip")

    @Test
    fun theBadgeDoesNotExistAtTheDefaultSummaryRowSize() {
        // `PickedRow`'s own call shape: no `size` override, so the default
        // `Layout.ThumbSize` (48dp) applies — the exact tile the regression
        // was found on.
        compose.setContent {
            Cogra2PreviewTheme { MediaThumb(item, duration = "0:42") }
        }
        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theBadgeDoesNotExistBelowTheFloorViaTheBadgeParameter() {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaThumb(item, size = 48.dp, badge = ThumbBadge.Duration("0:42"))
            }
        }
        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theBadgeExistsAtExactlyTheFloor() {
        compose.setContent {
            Cogra2PreviewTheme { MediaThumb(item, size = FLOOR, duration = "0:42") }
        }
        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theBadgeExistsOnAnUnmeasuredTileTheGridSizeItself() {
        // `size = null` is the pick grid's own shape (`PickStage`'s 125dp
        // fill-width column) — unknown to `MediaThumb` at composition time,
        // so the floor must not silently hide it there.
        compose.setContent {
            Cogra2PreviewTheme {
                Box(modifier = Modifier.size(GRID_TILE)) {
                    MediaThumb(item, size = null, duration = "0:42")
                }
            }
        }
        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theBadgeSitsAtTheBottomEndCornerOnceItFits() {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaThumb(item, size = TILE, duration = "0:42", testTag = TILE_TAG)
            }
        }

        val tile = compose.onNodeWithTag(TILE_TAG).getUnclippedBoundsInRoot()
        val badge = compose
            .onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true)
            .getUnclippedBoundsInRoot()

        // Bottom-right: closer to the tile's right edge than its left, and
        // closer to the bottom than the top — the corner the ruling names
        // (design/readme.md §13), never `CoverBadge`'s bottom-left.
        assertThat((tile.right - badge.right).value)
            .isLessThan((badge.left - tile.left).value)
        assertThat((tile.bottom - badge.bottom).value)
            .isLessThan((badge.top - tile.top).value)
    }

    private companion object {
        val FLOOR = 80.dp
        val TILE = 96.dp
        val GRID_TILE = 125.dp
        const val TILE_TAG = "duration_floor_tile"
    }
}
