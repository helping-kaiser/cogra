package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.compose.LocalPlatformContext
import coil3.request.ImageRequest
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.atom.HouseSlider
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.bleedHorizontally
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The post's crop (`ComposeCrop`): one shape for the whole post, framed per
 * picture (design/readme.md §13, D17) — and, with [kind] [CropKind.Avatar],
 * the profile picture's circle (`AvatarCrop`).
 *
 * **ONE CROP MODEL** (jakob 2026-11-11, seam 301; ComposeCrop.md): the stage
 * never changes size with the shape, the FRAME stands still at the chosen
 * shape inside it, and the PICTURE is what moves (one finger, the arrow keys)
 * and zooms (two fingers, the zoom track) under the frame. Outside the frame
 * the picture stays in view under a 45 % black. The geometry is
 * [CropGeometry], the web twin's own; the framing is [CropState].
 *
 * Under the stage stands the zoom track, its thumb at the zoom as a share of
 * the fill; under that the [caption] (`One shape for the whole post.`).
 */
@Composable
fun MediaCrop(
    item: MediaItem,
    shape: MediaShape,
    state: CropState,
    modifier: Modifier = Modifier,
    caption: String? = "One shape for the whole post.",
    /**
     * The gutter the stage escapes. Every crop board runs the stage to the
     * screen's edges (`margin: 0 -24px`) while the line under it stays in the
     * gutter, so the default is the gutter the column is padded by; a caller
     * with no padding to escape passes `0.dp`.
     */
    bleed: Dp = Layout.ScreenGutter,
    testTag: String? = null,
    /**
     * The crop's data-node on a registered screen (`composeCrop`): its
     * `viewport`, `zoom` (with its `input`) and `howTo` line wear its parts.
     */
    node: DataNode? = null,
    /** The post's crop, or the profile picture's circle — whose frame is always 1:1. */
    kind: CropKind = CropKind.Post,
) {
    val ratio = if (kind == CropKind.Avatar) 1f else shape.ratio
    SyncFrame(state, item, ratio)
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        CropViewport(item, state, bleed, node?.div("viewport")?.tag ?: testTag)

        CropZoom(state = state, testTag = testTag?.let { "${it}_zoom" }, node = node?.div("zoom"))

        // `QuietNote` (ComposeCrop.jsx:123): what the crop decides.
        if (caption != null) {
            QuietNote(text = caption, modifier = Modifier.fillMaxWidth().dataNode(node?.div("howTo")))
        }
    }
}

/**
 * A crop whose shape is LOCKED to how the result will be seen (`CoverCrop`):
 * a clip's cover is cut at the clip's shape in a post and at the comment
 * pager's square in a comment, so there are no shape chips — choosing a shape
 * here would let the cover disagree with the thing it is the face of
 * (CoverCrop.md). The stage is the post crop's 390 × 488, the frame [ratio]
 * between the gutters (CoverCrop.md:11).
 */
@Composable
fun LockedCrop(
    item: MediaItem,
    ratio: Float,
    state: CropState,
    notes: List<String>,
    modifier: Modifier = Modifier,
    bleed: Dp = Layout.ScreenGutter,
    testTag: String? = null,
    /**
     * The crop's data-node on a registered screen (`coverCrop`): its
     * `viewport` and `zoom` (with its `input`) wear its parts, and each of
     * [notes] the part [noteParts] names in its place.
     */
    node: DataNode? = null,
    noteParts: List<String> = listOf("howTo", "shapeNote"),
) {
    SyncFrame(state, item, ratio)
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        CropViewport(item, state, bleed, node?.div("viewport")?.tag ?: testTag)

        CropZoom(state = state, testTag = testTag?.let { "${it}_zoom" }, node = node?.div("zoom"))

        notes.forEachIndexed { index, note ->
            QuietNote(
                text = note,
                modifier = Modifier.fillMaxWidth().dataNode(noteParts.getOrNull(index)?.let { node?.div(it) }),
            )
        }
    }
}

/**
 * Keeps the framing on the frame the host shows and the picture it names:
 * the picture's upright ratio as the picker read it, and the frame's shape —
 * a shape chip re-shapes every picture of the post in its own handler
 * ([CropState.reshape]); this catches a frame changed from anywhere else.
 * A [SideEffect], because the framing is written after composition, never
 * during it.
 */
@Composable
private fun SyncFrame(state: CropState, item: MediaItem, ratio: Float) {
    SideEffect {
        state.learnSource(item.aspectRatio)
        state.reshape(ratio)
    }
}

@Composable
private fun CropViewport(item: MediaItem, state: CropState, bleed: Dp, testTag: String?) {
    val actions = remember(state) { cropActions(state) }
    val gutter = with(LocalDensity.current) { Layout.ScreenGutter.toPx() }
    Box(
        modifier = Modifier
            .bleedHorizontally(bleed)
            .fillMaxWidth()
            // ONE STAGE PER CROP, whatever the shape (ComposeCrop.md:7,
            // CoverCrop.md:11, AvatarCrop.md:7), scaled with the screen.
            .aspectRatio(CropGeometry.stageRatio(state.kind))
            .clipToBounds()
            .onSizeChanged { state.onStage(it.width.toFloat(), gutter) }
            .cropGestures(state)
            .onPreviewKeyEvent { event -> panByKey(event, state) }
            .focusable()
            .semantics {
                // `CROP_PAN_NAME` (CropViewport.jsx; blessed 2026-10-05).
                contentDescription = CROP_PAN_NAME
                // Not drawn on any board, kept: the non-gesture route
                // (design/readme.md §10) reads the framing back and moves it.
                stateDescription = state.framingDescription()
                customActions = actions
            }
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        CropPicture(item, state)
        CropFrameLayer(state, gutter)
    }
}

/**
 * The gestures: ONE owner for every finger.
 *
 * `detectTransformGestures` is Compose's documented detector for panning and
 * zooming together (developer.android.com/develop/ui/compose/touch-input/
 * pointer-input/multi-touch). Each step it reports is the centroid of the
 * fingers, the centroid's travel and the spread's ratio, and it counts only
 * the fingers that were down both before and after the event
 * (`calculateCentroid` / `calculatePan` / `calculateZoom`) — so a finger
 * landing or lifting mid-gesture never makes the picture jump, and one finger
 * left down keeps panning. The step itself is [CropGeometry.transformed]:
 * the point under the fingers stays under the fingers, the zoom held to its
 * bounds before the anchor is computed, the picture held to the frame after.
 */
private fun Modifier.cropGestures(state: CropState): Modifier = pointerInput(state) {
    detectTransformGestures { centroid, pan, zoom, _ ->
        if (centroid.isSpecified) state.transform(centroid.x, centroid.y, pan.x, pan.y, zoom)
    }
}

/**
 * The picture, laid whole in the stage at 1× and moved and scaled by one
 * graphics layer: the placement is read inside the layer block, so a gesture
 * re-draws the layer without recomposing anything.
 *
 * Drawn with `FillBounds` over the stage and scaled to the picture's laid size
 * on each axis, so the drawn picture is exactly [CropGeometry]'s — no
 * rounding of a measured size between what is shown and what is cut.
 */
@Composable
private fun BoxScope.CropPicture(item: MediaItem, state: CropState) {
    val context = LocalPlatformContext.current
    val request = remember(item.url, context) {
        // Decoded large enough to stay sharp toward the ceiling, and no
        // larger: Coil samples the source down to this edge (coil-kt.github.io/coil/image_requests).
        ImageRequest.Builder(context).data(item.url).size(DECODE_EDGE_PX, DECODE_EDGE_PX).build()
    }
    AsyncImage(
        model = request,
        contentDescription = null,
        contentScale = ContentScale.FillBounds,
        onSuccess = { success ->
            val size = success.painter.intrinsicSize
            if (size.isSpecified && size.height > 0f) state.learnSource(size.width / size.height)
        },
        modifier = Modifier
            .matchParentSize()
            .graphicsLayer {
                val layout = state.geometry()
                if (layout == null || !state.isMeasured) {
                    alpha = 0f
                    return@graphicsLayer
                }
                alpha = 1f
                val placement = state.placement(layout)
                scaleX = layout.picture.width * placement.zoom / layout.stage.width
                scaleY = layout.picture.height * placement.zoom / layout.stage.height
                translationX = placement.x
                translationY = placement.y
            },
    )
}

/**
 * The frame over the picture: the 45 % black outside it (one even-odd path,
 * the stage less the frame — `CropViewport`'s box shadow), and on it the
 * post's rule of thirds (white 0.55, ComposeCrop.jsx:55-76) or the cover's and
 * the circle's 1px white 0.7 hairline (CropViewport.jsx:91-102).
 */
@Composable
private fun BoxScope.CropFrameLayer(state: CropState, gutter: Float) {
    val corner = MaterialTheme.shapes.small
    Canvas(Modifier.matchParentSize()) {
        val frame = CropGeometry.frameOf(state.kind, state.frameRatio, size.width, gutter)
        // Centred on the stage as laid out, exactly where the picture's
        // layer is centred: the stage's height is a whole pixel.
        val rect = Rect(
            offset = Offset((size.width - frame.width) / 2f, (size.height - frame.height) / 2f),
            size = Size(frame.width, frame.height),
        )
        val radius = corner.topStart.toPx(rect.size, this)
        val hole = Path().apply {
            when (state.kind) {
                CropKind.Post -> addRect(rect)
                CropKind.Cover -> addRoundRect(RoundRect(rect, CornerRadius(radius)))
                CropKind.Avatar -> addOval(rect)
            }
        }
        val stage = Path().apply { addRect(Rect(Offset.Zero, size)) }
        drawPath(Path.combine(PathOperation.Difference, stage, hole), MediaOverlay.CropScrim)
        when (state.kind) {
            CropKind.Post -> drawThirds(rect)
            CropKind.Cover -> drawHairline(rect, radius, oval = false)
            CropKind.Avatar -> drawHairline(rect, radius, oval = true)
        }
    }
}

private fun DrawScope.drawThirds(frame: Rect) {
    val rule = 1.dp.toPx()
    for (share in listOf(1f / 3f, 2f / 3f)) {
        val x = frame.left + frame.width * share
        val y = frame.top + frame.height * share
        drawLine(MediaOverlay.CropRule, Offset(x, frame.top), Offset(x, frame.bottom), rule)
        drawLine(MediaOverlay.CropRule, Offset(frame.left, y), Offset(frame.right, y), rule)
    }
}

/** The hairline inside the frame's edge (`box-sizing: border-box`). */
private fun DrawScope.drawHairline(frame: Rect, radius: Float, oval: Boolean) {
    val width = 1.dp.toPx()
    val inset = frame.deflate(width / 2f)
    if (oval) {
        drawOval(MediaOverlay.CropHairline, inset.topLeft, inset.size, style = Stroke(width))
    } else {
        drawRoundRect(
            MediaOverlay.CropHairline,
            inset.topLeft,
            inset.size,
            CornerRadius((radius - width / 2f).coerceAtLeast(0f)),
            style = Stroke(width),
        )
    }
}

/** The non-gesture route as TalkBack custom actions: nudge, zoom, reset. Not drawn; kept (readme §10). */
private fun cropActions(state: CropState): List<CustomAccessibilityAction> {
    fun action(label: String, run: () -> Unit) = CustomAccessibilityAction(label) {
        run()
        true
    }
    return listOf(
        action("Nudge left") { state.nudge(NudgeDirection.Left) },
        action("Nudge right") { state.nudge(NudgeDirection.Right) },
        action("Nudge up") { state.nudge(NudgeDirection.Up) },
        action("Nudge down") { state.nudge(NudgeDirection.Down) },
        action("Zoom in") { state.stepZoom(inward = true) },
        action("Zoom out") { state.stepZoom(inward = false) },
        action("Reset framing") { state.reset() },
    )
}

/** The stage's spoken name (`CROP_PAN_NAME`, CropViewport.jsx). */
const val CROP_PAN_NAME = "Move the picture"

/** The slider's spoken name (`CROP_ZOOM_NAME`). */
const val CROP_ZOOM_NAME = "Zoom"

/** ComposeCrop.md: an arrow moves the picture 1 % of itself a press, 10 % with Shift. */
private const val KEY_STEP = 0.01f
private const val KEY_STEP_SHIFTED = 0.1f

/** The longest edge the stage decodes a picture to. */
private const val DECODE_EDGE_PX = 3072

/** The arrow keys on the focused stage: the picture moves that way; anything else falls through. */
private fun panByKey(event: KeyEvent, state: CropState): Boolean {
    if (event.type != KeyEventType.KeyDown) return false
    val step = if (event.isShiftPressed) KEY_STEP_SHIFTED else KEY_STEP
    when (event.key) {
        Key.DirectionLeft -> state.panBy(-step, 0f)
        Key.DirectionRight -> state.panBy(step, 0f)
        Key.DirectionUp -> state.panBy(0f, -step)
        Key.DirectionDown -> state.panBy(0f, step)
        else -> return false
    }
    return true
}

/**
 * THE ZOOM, ON SCREEN (`CropViewport.jsx` `CropZoom`): the house slider at
 * the column's full width, 48dp tall so its thumb answers at the system
 * minimum, its value the zoom as a share of the fill — 1 at the floor, the
 * ceiling's share at the top. One value, two ways to set it: a pinch moves
 * the slider, the slider zooms the picture about the frame's centre.
 */
@Composable
private fun CropZoom(state: CropState, testTag: String?, node: DataNode? = null) {
    // The board's zoom is a box around its range input; the slider is both,
    // so the box wears the node and the slider its `input`.
    Box(Modifier.dataNode(node)) {
        val tag = node?.div("input")?.tag ?: testTag
        HouseSlider(
            value = state.zoomShare,
            onValueChange = state::zoomTo,
            valueRange = CropGeometry.MIN_ZOOM..state.zoomShareMax,
            modifier = Modifier
                .fillMaxWidth()
                .height(Layout.TouchTargetMin)
                .semantics { contentDescription = CROP_ZOOM_NAME }
                .then(if (tag != null) Modifier.testTag(tag) else Modifier),
            thumbTag = tag?.let { "${it}_thumb" },
            trackTag = tag?.let { "${it}_track" },
        )
    }
}

/** The three shapes, as the canonical board draws them. */
@Composable
fun CropShapeChips(
    selected: MediaShape,
    onSelect: (MediaShape) -> Unit,
    modifier: Modifier = Modifier,
    /** The chips' data-node on a registered screen (`composeCrop.shapes`): each chip its `<shape>Chip`. */
    node: DataNode? = null,
) {
    Row(
        // As wide as its chips (ComposeCrop.jsx:86: a flex row in the column).
        modifier = modifier.dataNode(node),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        MediaShape.entries.forEach { shape ->
            CograChip(
                label = shape.label,
                selected = shape == selected,
                onClick = { onSelect(shape) },
                testTag = node?.div("${shape.name.lowercase()}Chip")?.tag ?: "crop_shape_${shape.name.lowercase()}",
            )
        }
    }
}

@ThemePreviews
@Composable
private fun MediaCropShapes() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            CropShapeChips(selected = MediaShape.Tall, onSelect = {})
            MediaCrop(
                item = MediaItem(null, 1.5f, "A picture being framed"),
                shape = MediaShape.Tall,
                state = rememberCropState(sourceRatio = 1.5f),
            )
        }
    }
}

@ThemePreviews
@Composable
private fun MediaCropWide() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            CropShapeChips(selected = MediaShape.Wide, onSelect = {})
            MediaCrop(
                item = MediaItem(null, 1.5f, "A picture being framed"),
                shape = MediaShape.Wide,
                state = rememberCropState(sourceRatio = 1.5f, frameRatio = MediaShape.Wide.ratio),
            )
        }
    }
}
