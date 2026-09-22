package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * `MediaThumb`'s cover, remove, and duration badges draw the `MediaDisc`
 * plate (`design/components/compose/MediaThumb.jsx`) — jakob's F8 ruling
 * (2026-09-17) that this reads `inverseSurface`/`inverseOnSurface` in both
 * themes rather than a literal scrim, so Android and web agree in dark mode.
 *
 * This is structural coverage only: `captureToImage()`'s real-pixel path
 * (`androidx.compose.ui.test.android.WindowCapture_androidKt.forceRedraw`)
 * never completes under this repo's Robolectric/Compose-BOM combination —
 * confirmed with both a bare `createComposeRule()` and a
 * `createAndroidComposeRule<ComponentActivity>()`, and there is no other
 * `captureToImage()` use anywhere in this codebase to borrow a working
 * recipe from. The colour role itself is pinned by `ColorSchemeTest` /
 * `PreviewThemeTokensTest` against `design-tokens.json`; a diff review
 * confirms these badges read `MaterialTheme.colorScheme.inverseSurface` /
 * `.inverseOnSurface`. Automated pixel-level regression coverage is a
 * queued bite pending a working `captureToImage()` recipe for this repo.
 *
 * `useUnmergedTree = true`: `MediaThumb`'s outer Box merges its descendants
 * into one semantics node (`clearAndSetSemantics { ... }`), so a badge's
 * own testTag only survives in the unmerged tree.
 */
@RunWith(RobolectricTestRunner::class)
class MediaThumbBadgeThemeRoleTest {

    @get:Rule
    val compose = createComposeRule()

    private val item = MediaItem(null, 1f, "A picture")

    @Test
    fun theCoverBadgeRendersInLightMode() {
        compose.setContent { Cogra2PreviewTheme(darkTheme = false) { MediaThumb(item, badge = ThumbBadge.Cover) } }
        compose.onNodeWithTag("media_thumb_cover_badge", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theCoverBadgeRendersInDarkMode() {
        compose.setContent { Cogra2PreviewTheme(darkTheme = true) { MediaThumb(item, badge = ThumbBadge.Cover) } }
        compose.onNodeWithTag("media_thumb_cover_badge", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theRemoveBadgeRendersInLightMode() {
        compose.setContent { Cogra2PreviewTheme(darkTheme = false) { MediaThumb(item, badge = ThumbBadge.Remove {}) } }
        compose.onNodeWithTag("media_thumb_remove_badge", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theRemoveBadgeRendersInDarkMode() {
        compose.setContent { Cogra2PreviewTheme(darkTheme = true) { MediaThumb(item, badge = ThumbBadge.Remove {}) } }
        compose.onNodeWithTag("media_thumb_remove_badge", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theDurationBadgeRendersInLightMode() {
        compose.setContent {
            Cogra2PreviewTheme(darkTheme = false) { MediaThumb(item, badge = ThumbBadge.Duration("0:42")) }
        }
        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertExists()
    }

    @Test
    fun theDurationBadgeRendersInDarkMode() {
        compose.setContent {
            Cogra2PreviewTheme(darkTheme = true) { MediaThumb(item, badge = ThumbBadge.Duration("0:42")) }
        }
        compose.onNodeWithTag("media_thumb_duration_badge", useUnmergedTree = true).assertExists()
    }
}
