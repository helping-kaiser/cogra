package com.cogra.core.designsystem.v2.media

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The viewer's close X is chrome over media, and chrome over media takes a
 * drop-shadow, never a plate (design-confirmed 2026-09-18;
 * `design/components/media/MediaViewer.jsx:195`,
 * `filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6))` — the same literal web's
 * `media-viewer.tsx:237` draws). This is the F8 lane's conformance gap: the
 * close button had a tint but no shadow modifier at all.
 *
 * This is structural coverage only, for the same reason
 * [MediaThumbBadgeThemeRoleTest] gives: `captureToImage()`'s real-pixel path
 * does not complete under this repo's Robolectric/Compose-BOM combination, so
 * a pixel-level check that the drop-shadow actually paints is not available
 * here. What IS pinned: the [OVER_MEDIA_SHADOW] spec's values against the
 * master's CSS numbers (so a value regressing back toward "no shadow" — e.g.
 * `alpha = 0f` or `radius = 0.dp` — fails), and that the close button still
 * composes with the modifier attached (so a broken `dropShadow` call fails
 * the suite instead of silently no-oping).
 */
@RunWith(RobolectricTestRunner::class)
class MediaViewerCloseShadowTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun `the shadow spec matches the drawn master`() {
        assertThat(OVER_MEDIA_SHADOW.radius).isEqualTo(3.dp)
        assertThat(OVER_MEDIA_SHADOW.offset).isEqualTo(DpOffset(0.dp, 1.dp))
        assertThat(OVER_MEDIA_SHADOW.color).isEqualTo(Color.Black)
        assertThat(OVER_MEDIA_SHADOW.alpha).isEqualTo(0.6f)
    }

    @Test
    fun `the close button still composes with the shadow modifier attached`() {
        val item = MediaItem(url = null, aspectRatio = 1f, altText = "A picture")
        compose.setContent {
            Cogra2PreviewTheme { MediaViewer(items = listOf(item), onClose = {}) }
        }
        compose.onNodeWithTag("${VIEWER_TAG}_close").assertExists()
    }
}
