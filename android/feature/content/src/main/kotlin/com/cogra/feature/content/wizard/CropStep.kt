package com.cogra.feature.content.wizard

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.cogra.core.designsystem.v2.media.CropShapeChips
import com.cogra.core.designsystem.v2.media.CropState
import com.cogra.core.designsystem.v2.media.MediaCrop
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.rememberCropState
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.CropWindow

/**
 * `ComposeCrop` — one shape for the whole post, framed per picture
 * (D17).
 *
 * The framing lives here rather than in the ViewModel, in the design
 * system's own `CropState`: it is `rememberSaveable`, so a half-framed
 * crop survives rotation and process death, and keeping it out of the
 * ViewModel is what lets the wizard's state machine be tested on the
 * JVM with no viewport anywhere near it. The committed framings are
 * handed up when the stage advances.
 *
 * **The non-drag route is not optional, and it is invisible.** D17
 * requires the stage to be completable without a gesture; `MediaCrop`
 * carries that in the semantics tree alone, because the board draws no
 * controls under the crop.
 */
@Composable
internal fun ColumnScope.CropStepBody(
    state: ComposeWizardState,
    onShapeChange: (DraftShape) -> Unit,
    onFrameAsset: (Int) -> Unit,
    onCropsChanged: (Map<String, CropSpec>) -> Unit,
) {
    val shape = state.shape.toMediaShape()

    // One framing per pick, keyed by the asset so re-ordering or
    // dropping a pick cannot hand its framing to a different picture.
    val framings: Map<String, CropState> = state.picked.associate { asset ->
        asset.uri to key(asset.uri) { rememberCropState() }
    }

    // Reported after every composition rather than only on `Next`: a
    // process death between the last nudge and the next tap would
    // otherwise upload a framing the author never saw. It rides a
    // `SideEffect` because writing outside composition is exactly what
    // that exists for — a bare call would run during composition.
    val specs = framings.mapValues { (_, crop) -> crop.toSpec(shape.ratio) }
    SideEffect { onCropsChanged(specs) }

    CropShapeChips(
        selected = shape,
        onSelect = { onShapeChange(it.toDraftShape()) },
        modifier = Modifier.testTag("wizard_crop_shapes"),
    )

    val framed = state.picked.getOrNull(state.framingIndex) ?: return
    MediaCrop(
        // A ratio of zero means "not read yet", and the crop falls back
        // to the frame's own ratio rather than claiming the picture is
        // square — guessing here would clamp the author out of the very
        // slack the shape switch exists to give them.
        item = MediaItem(framed.uri, framed.sourceRatio ?: 0f, framed.altText.ifBlank { null }),
        shape = shape,
        state = framings.getValue(framed.uri),
        testTag = "wizard_crop",
    )

    // No description field here: **never from the crop step** — a geometry
    // step is no place for a keyboard
    // (`design/components/compose/DescribeSheet.prompt.md`). Descriptions
    // are authored on the details stage, in `DescribeSheet`.

    if (state.picked.size > 1) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            state.picked.forEachIndexed { index, asset ->
                MediaThumb(
                    item = MediaItem(asset.uri, asset.sourceRatio ?: 1f, null),
                    selected = index == state.framingIndex,
                    dimmed = index != state.framingIndex,
                    onClick = { onFrameAsset(index) },
                    contentDescription = "Frame picture ${index + 1}",
                    testTag = "wizard_filmstrip_$index",
                )
            }
        }
    }
}

/** The framing as the pipeline takes it, plus the post's own shape. */
private fun CropState.toSpec(targetRatio: Float): CropSpec = CropSpec(
    targetRatio = targetRatio,
    window = CropWindow(framing.left, framing.top, framing.right, framing.bottom),
)

internal fun DraftShape.toMediaShape(): MediaShape = when (this) {
    DraftShape.Tall -> MediaShape.Tall
    DraftShape.Square -> MediaShape.Square
    DraftShape.Wide -> MediaShape.Wide
}

internal fun MediaShape.toDraftShape(): DraftShape = when (this) {
    MediaShape.Tall -> DraftShape.Tall
    MediaShape.Square -> DraftShape.Square
    MediaShape.Wide -> DraftShape.Wide
}
