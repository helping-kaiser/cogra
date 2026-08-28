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
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material.icons.filled.ZoomOut
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
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
 * **The non-gesture route is required, not optional.** D17 makes it explicit
 * — "the crop step must be completable without a gesture" — and
 * design/readme.md §10 requires a non-drag equivalent for every drag. It is
 * provided twice over, because the two reach different people:
 *
 * - **Custom accessibility actions** on the viewport, so an assistive
 *   technology user gets nudge and zoom as named actions.
 * - **A visible control row**, for a reader who can see the screen but
 *   cannot pinch. The canonical board draws no such row — it is a required
 *   element the canvas is silent on — so it is placed in the empty space the
 *   board leaves below the caption, and [showFramingControls] can retire it
 *   if the design later draws something else there.
 */
@Composable
fun MediaCrop(
    item: MediaItem,
    shape: MediaShape,
    state: CropState,
    modifier: Modifier = Modifier,
    showFramingControls: Boolean = true,
    caption: String = "One shape for the whole post. Drag to move, pinch to zoom.",
    testTag: String? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        CropViewport(item, shape, state, testTag)

        Text(
            text = caption,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (showFramingControls) {
            FramingControls(state, testTag)
        }
    }
}

@Composable
private fun CropViewport(
    item: MediaItem,
    shape: MediaShape,
    state: CropState,
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

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(shape.ratio)
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .onSizeChanged { state.viewport = Size(it.width.toFloat(), it.height.toFloat()) }
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    if (zoom != 1f) state.zoomBy(zoom)
                    if (pan != Offset.Zero) state.panBy(pan)
                }
            }
            .semantics {
                contentDescription = item.altText ?: "The picture being framed"
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
        RuleOfThirds()
    }
}

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

/**
 * The visible non-drag route. Each control is a full 48dp target and carries
 * its own label — an icon never carries meaning alone (design/readme.md §5).
 */
@Composable
private fun FramingControls(state: CropState, testTag: String?) {
    val tag = testTag ?: "crop"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        NudgeButton(Icons.Filled.KeyboardArrowLeft, "Nudge left", "${tag}_left") {
            state.nudge(NudgeDirection.Left)
        }
        NudgeButton(Icons.Filled.KeyboardArrowRight, "Nudge right", "${tag}_right") {
            state.nudge(NudgeDirection.Right)
        }
        NudgeButton(Icons.Filled.KeyboardArrowUp, "Nudge up", "${tag}_up") {
            state.nudge(NudgeDirection.Up)
        }
        NudgeButton(Icons.Filled.KeyboardArrowDown, "Nudge down", "${tag}_down") {
            state.nudge(NudgeDirection.Down)
        }
        NudgeButton(
            Icons.Filled.ZoomIn,
            "Zoom in",
            "${tag}_zoom_in",
            enabled = state.canZoom(inward = true),
        ) { state.stepZoom(inward = true) }
        NudgeButton(
            Icons.Filled.ZoomOut,
            "Zoom out",
            "${tag}_zoom_out",
            enabled = state.canZoom(inward = false),
        ) { state.stepZoom(inward = false) }
    }
}

@Composable
private fun NudgeButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    tag: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .size(Layout.TouchTargetMin)
            .testTag(tag),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
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
                showFramingControls = false,
            )
        }
    }
}
