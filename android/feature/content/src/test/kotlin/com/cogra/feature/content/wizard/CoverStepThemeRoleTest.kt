package com.cogra.feature.content.wizard

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.VideoFrame
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * `ComposeCover.jsx` cites `MediaThumb`'s anatomy for both badges here — the
 * play disc and the duration both read `inverseSurface`/`inverseOnSurface`,
 * jakob's F8 ruling (2026-09-17), never a literal scrim.
 *
 * This is structural coverage only: `captureToImage()`'s real-pixel path
 * never completes under this repo's Robolectric/Compose-BOM combination —
 * see `MediaThumbBadgeThemeRoleTest`'s doc comment for what was tried. The
 * colour role itself is pinned by `ColorSchemeTest`/`PreviewThemeTokensTest`
 * against `design-tokens.json`; a diff review confirms both badges here
 * read `MaterialTheme.colorScheme.inverseSurface`/`.inverseOnSurface`.
 */
@RunWith(RobolectricTestRunner::class)
class CoverStepThemeRoleTest {

    @get:Rule
    val compose = createComposeRule()

    private val videoState = ComposeWizardState(
        picked = listOf(PickedAsset("clip", 0.5625f, durationMs = 42_000)),
        coverFrames = List(3) { VideoFrame(it * 1_000, ProcessedPicture(ByteArray(4), 108, 192)) },
    )

    @Test
    fun thePlayDiscRendersInLightMode() {
        compose.setContent {
            Cogra2PreviewTheme(darkTheme = false) {
                CoverStepBody(state = videoState, onPickFrame = {}, onPickPicture = {})
            }
        }
        compose.onNodeWithTag("wizard_cover_play_disc").assertExists()
    }

    @Test
    fun thePlayDiscRendersInDarkMode() {
        compose.setContent {
            Cogra2PreviewTheme(darkTheme = true) {
                CoverStepBody(state = videoState, onPickFrame = {}, onPickPicture = {})
            }
        }
        compose.onNodeWithTag("wizard_cover_play_disc").assertExists()
    }

    @Test
    fun theDurationBadgeRendersInLightMode() {
        compose.setContent {
            Cogra2PreviewTheme(darkTheme = false) {
                CoverStepBody(state = videoState, onPickFrame = {}, onPickPicture = {})
            }
        }
        compose.onNodeWithTag("wizard_cover_duration").assertExists()
    }

    @Test
    fun theDurationBadgeRendersInDarkMode() {
        compose.setContent {
            Cogra2PreviewTheme(darkTheme = true) {
                CoverStepBody(state = videoState, onPickFrame = {}, onPickPicture = {})
            }
        }
        compose.onNodeWithTag("wizard_cover_duration").assertExists()
    }
}
