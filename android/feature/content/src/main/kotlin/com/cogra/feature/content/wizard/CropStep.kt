package com.cogra.feature.content.wizard

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.bleedHorizontally
import com.cogra.core.designsystem.v2.media.CropFraming
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
import com.cogra.feature.content.R

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
 * **The non-drag route is not optional** (D17): `MediaCrop` draws the zoom
 * slider under the cut, pans the focused cut by key, and keeps its TalkBack
 * custom actions — the board's `CropZoom` and `CropViewport` name.
 */
@Composable
internal fun ColumnScope.CropStepBody(
    state: ComposeWizardState,
    onShapeChange: (DraftShape) -> Unit,
    onFrameAsset: (Int) -> Unit,
    onCropsChanged: (Map<String, CropSpec>) -> Unit,
) = CropFrames(
    picked = state.picked,
    crops = state.crops,
    shape = state.shape,
    framingIndex = state.framingIndex,
    onShapeChange = onShapeChange,
    onFrameAsset = onFrameAsset,
    onCropsChanged = onCropsChanged,
    node = COMPOSE_CROP,
)

/**
 * The crop's body for any set of picks: the shape chips — or none where the
 * post's one shape already stands ([locked]: an edit's added pictures are cut
 * to the shape the post was published at, ComposeCrop.md "locked to the
 * post's one shape") — the framed pick's cut, and the filmstrip.
 */
@Composable
internal fun ColumnScope.CropFrames(
    picked: List<PickedAsset>,
    crops: Map<String, CropSpec>,
    shape: DraftShape,
    framingIndex: Int,
    onShapeChange: (DraftShape) -> Unit,
    onFrameAsset: (Int) -> Unit,
    onCropsChanged: (Map<String, CropSpec>) -> Unit,
    locked: Boolean = false,
    testTagPrefix: String = "wizard",
    /**
     * The crop's data-node on a registered screen (`composeCrop`): the chips
     * `shapes`, the cut's `viewport`, `zoom` and `howTo`, and the filmstrip
     * `pictures` (its `thumb` keyed by place from 1).
     */
    node: DataNode? = null,
) {
    val mediaShape = shape.toMediaShape()

    // One framing per pick, keyed by the asset so re-ordering or
    // dropping a pick cannot hand its framing to a different picture.
    //
    // Each starts from the framing the wizard remembers for that pick.
    // The holder itself cannot carry it: leaving the stage tears this
    // composition down and takes its saveable state with it, so an
    // author who stepped on to the details stage and came back — or who
    // walked forward into the stage a second time — would find their
    // crop reset (jakob 2026-09-01).
    val framings: Map<String, CropState> = picked.associate { asset ->
        asset.uri to key(asset.uri) {
            rememberCropState(
                initial = crops[asset.uri].toFraming(),
                sourceRatio = asset.sourceRatio,
                frameRatio = mediaShape.ratio,
            )
        }
    }
    // The picker reads each pick's upright ratio from its header; one that
    // arrives after the stage opened reaches the framing here.
    SideEffect { picked.forEach { asset -> asset.sourceRatio?.let { framings[asset.uri]?.learnSource(it) } } }

    // Reported after every composition rather than only on `Next`: a
    // process death between the last nudge and the next tap would
    // otherwise upload a framing the author never saw. It rides a
    // `SideEffect` because writing outside composition is exactly what
    // that exists for — a bare call would run during composition.
    val specs = framings.mapValues { (_, crop) -> crop.toSpec(mediaShape.ratio) }
    SideEffect { onCropsChanged(specs) }

    // A locked crop offers no chips: the shape is the post's, already chosen.
    if (!locked) {
        CropShapeChips(
            selected = mediaShape,
            onSelect = { next ->
                // EVERY picture takes the new shape, the ones off the stage
                // too, each keeping its scale and position and rising only to
                // the new fill (ComposeCrop.md:17-23) — the web twin's rule
                // (web/src/lib/compose/wizard.ts:796-806). A picture left at
                // the old shape would upload and preview a different section.
                framings.values.forEach { it.reshape(next.ratio) }
                onShapeChange(next.toDraftShape())
            },
            modifier = if (node == null) Modifier.testTag("${testTagPrefix}_crop_shapes") else Modifier,
            node = node?.div("shapes"),
        )
    }

    val framed = picked.getOrNull(framingIndex) ?: return
    MediaCrop(
        // The ratio is the upright picture's, as the picker read it from the
        // header (EXIF applied): the frame's geometry and the upload's cut
        // are measured against the same shape.
        item = MediaItem(framed.uri, framed.sourceRatio ?: 0f, framed.altText.ifBlank { null }),
        shape = mediaShape,
        state = framings.getValue(framed.uri),
        testTag = "${testTagPrefix}_crop",
        node = node,
    )

    // No description field here: **never from the crop step** — a geometry
    // step is no place for a keyboard
    // (`design/components/compose/DescribeSheet.prompt.md`). Descriptions
    // are authored on the details stage, in `DescribeSheet`. The line under
    // the zoom, `One shape for the whole post.`, is `MediaCrop`'s own caption.

    if (picked.size > 1) {
        // The framed tile's ring stands OUTSIDE it (`outline 2px`, offset 1),
        // so the scrolling strip reaches 3dp past the gutter and pads back in —
        // a scroll container clips along its axis, and the ring must not be cut.
        Row(
            modifier = Modifier
                // The node wears the strip as the board lays it out, the gutter's width;
                // the ring room it bleeds into is the scroll's, not the strip's.
                .dataNode(node?.div("pictures"))
                .bleedHorizontally(RING_ROOM)
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = RING_ROOM),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            picked.forEachIndexed { index, asset ->
                MediaThumb(
                    // The filmstrip shows each pick as it currently
                    // stands, so the one being framed is the only one
                    // that ever looks unframed.
                    item = MediaItem(
                        asset.uri,
                        asset.sourceRatio ?: 1f,
                        null,
                        framings[asset.uri]?.framing ?: CropFraming.Whole,
                    ),
                    selected = index == framingIndex,
                    dimmed = index != framingIndex,
                    onClick = { onFrameAsset(index) },
                    contentDescription = stringResource(R.string.content_frame_picture_at, index + 1),
                    testTag = node?.div("pictures")?.div("thumb")?.keyed("${index + 1}")?.tag
                        ?: "${testTagPrefix}_filmstrip_$index",
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

/**
 * The remembered framing as the crop viewport takes it.
 *
 * A pick with no framing yet opens on the whole picture, which is the
 * cropper's cue to place its own largest window for the shape.
 */
internal fun CropSpec?.toFraming(): CropFraming = this?.window?.let {
    CropFraming.of(it.left, it.top, it.right, it.bottom)
} ?: CropFraming.Whole

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

/** The selection ring's reach past its tile: 1dp offset + 2dp stroke. */
private val RING_ROOM = 3.dp

/** `ComposeCrop`'s registered prefix: the wizard's crop stage, and the crop an edit raises for added pictures. */
internal val COMPOSE_CROP = DataNode("composeCrop")
