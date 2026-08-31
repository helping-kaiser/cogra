package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The crop step: one shape for the whole post, framed per picture
 * (design/readme.md §13, D17).
 *
 * The viewport is the chosen [shape]; the picture fills it and the reader
 * moves and zooms *within* it. The rule-of-thirds overlay is the canvas's,
 * drawn as hairlines over the picture.
 *
 * **The non-gesture route is required, and it is invisible.** D17 makes the
 * requirement explicit — "the crop step must be completable without a
 * gesture" — and design/readme.md §10 requires a non-drag equivalent for
 * every drag. The canonical board draws no controls under the crop, so the
 * equivalent is carried entirely in the semantics tree: named custom
 * accessibility actions for nudge, zoom and reset, plus a state description
 * that reads the current framing back. An assistive-technology user and a
 * keyboard user both reach every one of them; a reader looking at the board
 * sees exactly what the board draws.
 */
@Composable
fun MediaCrop(
    item: MediaItem,
    shape: MediaShape,
    state: CropState,
    modifier: Modifier = Modifier,
    caption: String = "One shape for the whole post. Drag to move, pinch to zoom.",
    mask: CropMask = CropMask.Thirds,
    testTag: String? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        CropViewport(item, shape, state, mask, testTag)

        Text(
            text = caption,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * What is drawn over the picture being framed.
 *
 * [Thirds] is the post composer's: hairline thirds over a rectangular
 * frame, because the whole frame is what gets stored. [Circle] is the
 * profile picture's (`AvatarCrop`): a circular aperture with everything
 * outside it dimmed, because a circle is how the avatar is *seen*
 * everywhere, and framing to a square you cannot see the edges of is
 * guesswork.
 */
enum class CropMask { Thirds, Circle }

@Composable
private fun CropViewport(
    item: MediaItem,
    shape: MediaShape,
    state: CropState,
    mask: CropMask,
    testTag: String?,
) {
    val nudgeActions = listOf(
        CustomAccessibilityAction("Nudge left") { state.nudge(NudgeDirection.Left); true },
        CustomAccessibilityAction("Nudge right") { state.nudge(NudgeDirection.Right); true },
        CustomAccessibilityAction("Nudge up") { state.nudge(NudgeDirection.Up); true },
        CustomAccessibilityAction("Nudge down") { state.nudge(NudgeDirection.Down); true },
        CustomAccessibilityAction("Zoom in") { state.stepZoom(inward = true); true },
        CustomAccessibilityAction("Zoom out") { state.stepZoom(inward = false); true },
        CustomAccessibilityAction("Reset framing") { state.reset(); true },
    )

    // The measurement is remembered rather than pushed straight into the
    // state, because `onSizeChanged` fires on a *change* of size: framing
    // the second picture of a gallery hands this same box a fresh
    // `CropState` at an unchanged size, and that state would never learn
    // its viewport — which is why every picture after the first used to
    // ignore drags and nudges entirely.
    var measured by remember { mutableStateOf(Size.Zero) }
    if (measured != Size.Zero) {
        SideEffect { state.measured(measured, item.aspectRatio) }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(shape.ratio)
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .onSizeChanged { measured = Size(it.width.toFloat(), it.height.toFloat()) }
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    if (zoom != 1f) state.zoomBy(zoom)
                    if (pan != Offset.Zero) state.panBy(pan)
                }
            }
            .semantics {
                contentDescription = item.altText ?: "The picture being framed"
                // The invisible half of the non-gesture route: what the
                // framing currently is, so the actions below are not fired
                // blind.
                stateDescription = state.framingDescription()
                customActions = nudgeActions
            }
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        AsyncImage(
            model = item.url,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = state.scale
                    scaleY = state.scale
                    translationX = state.offset.x
                    translationY = state.offset.y
                },
        )
        when (mask) {
            CropMask.Thirds -> RuleOfThirds()
            CropMask.Circle -> CircleAperture()
        }
    }
}

/**
 * The avatar's aperture: a clear circle, everything outside it dimmed, and
 * a hairline rim so the edge is visible against a light picture.
 *
 * Drawn rather than composed from shapes because "dim everything except
 * this circle" is one even-odd path, and stacking four dimming boxes round
 * a hole leaves seams at the corners.
 */
@Composable
private fun CircleAperture() {
    Box(
        Modifier
            .fillMaxSize()
            .drawWithContent {
                drawContent()
                val inset = size.minDimension * ApertureInset
                val radius = (size.minDimension - inset * 2) / 2f
                val centre = Offset(size.width / 2f, size.height / 2f)
                val scrim = Path().apply {
                    addRect(Rect(Offset.Zero, size))
                    addOval(Rect(centre, radius))
                    fillType = PathFillType.EvenOdd
                }
                drawPath(scrim, MediaOverlay.CropScrim)
                drawCircle(
                    color = MediaOverlay.CropRule,
                    radius = radius,
                    center = centre,
                    style = Stroke(width = 1.dp.toPx()),
                )
            },
    )
}

/** `21 / 342` on `AvatarCrop`: the ring of stage left around the circle. */
private const val ApertureInset = 0.0614f

/** The canvas's hairline thirds, drawn over the picture. */
@Composable
private fun RuleOfThirds() {
    Box(
        Modifier
            .fillMaxSize()
            .drawWithContent {
                drawContent()
                val stroke = 1.dp.toPx()
                for (i in 1..2) {
                    val x = size.width * i / 3f
                    val y = size.height * i / 3f
                    drawLine(
                        color = MediaOverlay.CropRule,
                        start = Offset(x, 0f),
                        end = Offset(x, size.height),
                        strokeWidth = stroke,
                    )
                    drawLine(
                        color = MediaOverlay.CropRule,
                        start = Offset(0f, y),
                        end = Offset(size.width, y),
                        strokeWidth = stroke,
                    )
                }
            },
    )
}

/** The three shapes, as the canonical board draws them. */
@Composable
fun CropShapeChips(
    selected: MediaShape,
    onSelect: (MediaShape) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        MediaShape.entries.forEach { shape ->
            CograChip(
                label = shape.label,
                selected = shape == selected,
                onClick = { onSelect(shape) },
                testTag = "crop_shape_${shape.name.lowercase()}",
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
                state = rememberCropState(),
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
                state = rememberCropState(),
            )
        }
    }
}
