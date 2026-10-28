package com.cogra.core.designsystem.v2.media

import com.cogra.core.designsystem.v2.token.MediaShape
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The window shapes the cropper is held to: the post's three, written out,
 * and a locked crop's — a clip's own ratio for its cover (CoverCrop.md) —
 * read off a float.
 */
class CropAspectTest {

    @Test
    fun thePostShapesKeepTheirWrittenPairs() {
        assertThat(MediaShape.Tall.cropAspect).isEqualTo(CropAspect(4, 5))
        assertThat(MediaShape.Square.cropAspect).isEqualTo(CropAspect(1, 1))
        assertThat(MediaShape.Wide.cropAspect).isEqualTo(CropAspect(191, 100))
    }

    @Test
    fun aClipsRatioBecomesItsLowestPair() {
        assertThat(CropAspect.of(16f / 9f).ratio).isWithin(RATIO_TOLERANCE).of(16f / 9f)
        assertThat(CropAspect.of(0.5625f)).isEqualTo(CropAspect(9, 16))
        assertThat(CropAspect.of(1f)).isEqualTo(CropAspect(1, 1))
    }

    @Test
    fun aRatioNothingMeasuredReservesTheSquare() {
        assertThat(CropAspect.of(0f)).isEqualTo(CropAspect(1, 1))
        assertThat(CropAspect.of(Float.NaN)).isEqualTo(CropAspect(1, 1))
        assertThat(CropAspect.of(-2f)).isEqualTo(CropAspect(1, 1))
    }

    private companion object {
        const val RATIO_TOLERANCE = 0.002f
    }
}
