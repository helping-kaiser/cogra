package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * THE HOUSE SLIDER (`CropViewport.jsx` `CropZoom`: "The house slider
 * (`StanceSlider`'s range input in `primary`)"): a range input with its
 * accent in `primary`, drawn as the board renders it — a **16dp dot** for
 * the thumb on an **8dp, fully rounded track**, `primary` from the start to
 * the thumb's centre and the track's ground beyond it.
 *
 * Material 3's own `Slider` draws a 4dp vertical handle since 1.3 (the
 * expressive slider), which is the "vertical line instead of the dot" jakob
 * saw (2026-11-11); its `thumb` and `track` slots are the documented way to
 * draw another one (developer.android.com/develop/ui/compose/components/slider,
 * "Advanced implementation"), keeping its range, keyboard, drag and
 * semantics.
 *
 * The ground's colour is the one thing the board does not give: the range
 * input leaves it to the browser, which paints a neutral grey (#efefef on
 * light, #3b3b3b on dark, with a 1px darker rim). The nearest role on both
 * themes is `surfaceContainerHighest` (#f5ded4 / #373433), with no rim.
 *
 * [thumbTag] and [trackTag] name the two drawn parts for tests and the
 * conformance harness.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HouseSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    valueRange: ClosedFloatingPointRange<Float> = 0f..1f,
    thumbTag: String? = null,
    trackTag: String? = null,
) {
    val accent = MaterialTheme.colorScheme.primary
    val ground = MaterialTheme.colorScheme.surfaceContainerHighest
    Slider(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        valueRange = valueRange,
        thumb = {
            // Material sizes the slider — and so the band that answers a
            // press — to its thumb. The thumb's box is therefore the full
            // 48dp the input stands (`--touch-target-min`), the dot drawn
            // in its middle.
            Box(Modifier.width(HOUSE_SLIDER_THUMB).height(Layout.TouchTargetMin), contentAlignment = Alignment.Center) {
                Box(
                    Modifier
                        .size(HOUSE_SLIDER_THUMB)
                        .clip(CircleShape)
                        .background(accent)
                        .then(if (thumbTag != null) Modifier.testTag(thumbTag) else Modifier),
                )
            }
        },
        track = { state ->
            val span = state.valueRange.endInclusive - state.valueRange.start
            val fraction = if (span > 0f) ((state.value - state.valueRange.start) / span).coerceIn(0f, 1f) else 0f
            Canvas(
                Modifier
                    .fillMaxWidth()
                    .height(HOUSE_SLIDER_TRACK)
                    .then(if (trackTag != null) Modifier.testTag(trackTag) else Modifier),
            ) {
                // Material hands the track the thumb centre's travel — the
                // slider's width less a thumb — while the board's track runs
                // the input's full width. So the ground reaches half a thumb
                // past either end (a Canvas does not clip), and the accent
                // runs from the input's start to the dot's centre.
                val corner = CornerRadius(size.height / 2f)
                val half = HOUSE_SLIDER_THUMB.toPx() / 2f
                drawRoundRect(
                    color = ground,
                    topLeft = Offset(-half, 0f),
                    size = Size(size.width + 2f * half, size.height),
                    cornerRadius = corner,
                )
                drawRoundRect(
                    color = accent,
                    topLeft = Offset(-half, 0f),
                    size = Size(half + fraction * size.width, size.height),
                    cornerRadius = corner,
                )
            }
        },
    )
}

/** The board's thumb: Chromium's range thumb, a 16px dot (measured on `ComposeCrop`). */
val HOUSE_SLIDER_THUMB = 16.dp

/** The board's track: 8px, fully rounded (measured on `ComposeCrop`). */
val HOUSE_SLIDER_TRACK = 8.dp

@ThemePreviews
@Composable
private fun HouseSliderPreview() {
    Cogra2PreviewTheme {
        HouseSlider(value = 1.15f, onValueChange = {}, valueRange = 1f..4f)
    }
}
