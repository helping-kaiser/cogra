package com.cogra.core.designsystem.v2.media

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaShape
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The bar under the crop (jakob 2026-11-11: "the bar below the image does
 * have a vertical line instead of the dot from the designs"). `CropZoom` is
 * the house range input: as `ComposeCrop` renders it, a 16 px dot on an
 * 8 px track, in a 48 px tall input.
 */
@RunWith(RobolectricTestRunner::class)
@Config(shadows = [ShadowBitmapLoadingWorkerJob::class], instrumentedPackages = ["com.canhub.cropper"])
class CropZoomSliderTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun theZoomSliderDrawsTheBoardsDotOnItsTrack() {
        compose.setContent {
            Cogra2PreviewTheme {
                MediaCrop(
                    item = MediaItem("content://cogra.test/zoom", 1f, "a picture"),
                    shape = MediaShape.Tall,
                    state = rememberCropState(),
                    modifier = Modifier.width(300.dp),
                    bleed = 0.dp,
                    testTag = "crop",
                )
            }
        }

        compose.onNodeWithTag("crop_zoom").assertHeightIsEqualTo(48.dp)
        compose.onNodeWithTag("crop_zoom_thumb", useUnmergedTree = true)
            .assertWidthIsEqualTo(16.dp)
            .assertHeightIsEqualTo(16.dp)
        compose.onNodeWithTag("crop_zoom_track", useUnmergedTree = true).assertHeightIsEqualTo(8.dp)
    }
}
