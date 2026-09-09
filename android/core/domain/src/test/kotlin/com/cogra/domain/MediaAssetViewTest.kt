package com.cogra.domain

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The layout hint the contract serves, read the way the contract states
 * it: `MediaOptions.aspectRatio` is `"W:H"` in lowest terms (api-spec.md
 * `MediaOptions`).
 */
class MediaAssetViewTest {

    @Test
    fun aShapeIsReadAsARatio() {
        assertThat(MediaAssetView.ratioOf("4:5")).isEqualTo(4f / 5f)
        assertThat(MediaAssetView.ratioOf("1:1")).isEqualTo(1f)
        assertThat(MediaAssetView.ratioOf("9:16")).isEqualTo(9f / 16f)
        assertThat(MediaAssetView.ratioOf("540:283")).isWithin(0.0001f).of(540f / 283f)
        assertThat(MediaAssetView.ratioOf(" 16 : 9 ")).isWithin(0.0001f).of(16f / 9f)
    }

    /**
     * A DECIMAL IS NOT A SHAPE. Reading the field as one is what made
     * every asset square: a portrait clip's surface was then stretched to
     * a shape the clip does not have, and a framed picture was cropped to
     * one.
     */
    @Test
    fun aDecimalIsNotAShape() {
        assertThat(MediaAssetView.ratioOf("1.91")).isEqualTo(MediaAssetView.FALLBACK_RATIO)
        assertThat(MediaAssetView.ratioOf("0.5625")).isEqualTo(MediaAssetView.FALLBACK_RATIO)
    }

    /**
     * Everything else reserves the square rather than collapsing: the
     * field holds a tile open before the load, and a zero would collapse
     * exactly what it is there to reserve.
     */
    @Test
    fun anythingElseReservesTheSquare() {
        // Three parts would silently accept a shape nobody stated.
        assertThat(MediaAssetView.ratioOf("4:5:6")).isEqualTo(MediaAssetView.FALLBACK_RATIO)
        assertThat(MediaAssetView.ratioOf("4:0")).isEqualTo(MediaAssetView.FALLBACK_RATIO)
        assertThat(MediaAssetView.ratioOf("-4:5")).isEqualTo(MediaAssetView.FALLBACK_RATIO)
        assertThat(MediaAssetView.ratioOf("wide")).isEqualTo(MediaAssetView.FALLBACK_RATIO)
        assertThat(MediaAssetView.ratioOf("")).isEqualTo(MediaAssetView.FALLBACK_RATIO)
        assertThat(MediaAssetView.ratioOf(null)).isEqualTo(MediaAssetView.FALLBACK_RATIO)
    }
}
