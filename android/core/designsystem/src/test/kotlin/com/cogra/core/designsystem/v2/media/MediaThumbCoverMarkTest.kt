package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * A clip's chosen cover, inset bottom-left rather than named by a word — a
 * cover is the clip's own property and never a second attachment (design
 * #781; `design/components/compose/MediaThumb.jsx:93,192-217`).
 *
 * `useUnmergedTree = true`: `MediaThumb`'s outer Box merges its descendants
 * into one semantics node (`clearAndSetSemantics { ... }`), so the mark's
 * own testTag only survives in the unmerged tree — the same reason
 * `MediaThumbBadgeThemeRoleTest` needs it.
 *
 * The ring's `outlineVariant` colour is not pixel-verified here for the same
 * reason `MediaThumbBadgeThemeRoleTest` documents: this repo's
 * `captureToImage()` never completes under Robolectric. A diff review
 * confirms `CoverMark` reads `MaterialTheme.colorScheme.outlineVariant`.
 */
@RunWith(RobolectricTestRunner::class)
class MediaThumbCoverMarkTest {

    @get:Rule
    val compose = createComposeRule()

    private val item = MediaItem(null, 1f, "A picture")

    @Test
    fun theMarkIsAbsentUntilACoverIsChosen() {
        compose.setContent { Cogra2PreviewTheme { MediaThumb(item, size = 48.dp) } }
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun theMarkAppearsOnceACoverIsChosen() {
        compose.setContent { Cogra2PreviewTheme { MediaThumb(item, size = 48.dp, coverSrc = "cover-bytes") } }
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theMarkNeverFallsUnderThe28dpFloor() {
        // min(114, 64) / 3 = 21.33dp, under the floor MediaThumb.jsx:93 sets —
        // the tray's own tile size on `ComposePickVideoCover`.
        compose.setContent {
            Cogra2PreviewTheme {
                MediaThumb(item, width = 114.dp, height = 64.dp, coverSrc = "cover-bytes")
            }
        }
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true)
            .assertWidthIsEqualTo(28.dp)
            .assertHeightIsEqualTo(28.dp)
    }

    @Test
    fun theMarkScalesToAThirdOfTheShortSidePastTheFloor() {
        compose.setContent { Cogra2PreviewTheme { MediaThumb(item, size = 150.dp, coverSrc = "cover-bytes") } }
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true)
            .assertWidthIsEqualTo(50.dp)
            .assertHeightIsEqualTo(50.dp)
    }

    @Test
    fun theMarkIsOmittedOnTheUnmeasuredFillWidthTile() {
        // `size = null` triggers the fillMaxWidth().aspectRatio(1f) branch,
        // where no edge is known at composition time (MediaThumb.kt's own
        // `coverMarkSize` doc comment) — no caller passes `coverSrc` there
        // today, so silent omission is the safe default rather than a crash.
        compose.setContent { Cogra2PreviewTheme { MediaThumb(item, size = null, coverSrc = "cover-bytes") } }
        compose.onNodeWithTag("media_thumb_cover_mark", useUnmergedTree = true).assertDoesNotExist()
    }
}
