package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Layout

/**
 * THE 48dp PROMISE, KEPT WITHOUT INFLATING DENSE ROWS — the design's `cg-hit`
 * (`design/tokens/states.css`; readme §10, *A card's header answers at 48dp*).
 * The control's INK keeps its drawn box in the layout, and its TARGET answers
 * at [min], an invisible margin centred on the ink that overflows into the
 * space around it rather than growing the row: the card header stays its
 * drawn 24dp, the share pill its 30dp, and each still answers at 48.
 *
 * [interactive] — the control's `clickable` and whatever should answer across
 * the whole target — is applied to the grown box; the modifiers after this
 * one shape the ink. A null side of [drawnWidth]/[drawnHeight] is not grown.
 *
 * The grown box is measured against widened constraints and placed back over
 * the margin, the way [bleedHorizontally] escapes a gutter, so the parent's
 * own layout is untouched. Compose hit-tests a child outside its parent's
 * bounds unless something on the way clips it.
 */
fun Modifier.hitTarget(
    interactive: Modifier,
    drawnWidth: Dp? = null,
    drawnHeight: Dp? = null,
    min: Dp = Layout.TouchTargetMin,
): Modifier {
    val slopX = drawnWidth?.let { ((min - it) / 2).coerceAtLeast(0.dp) } ?: 0.dp
    val slopY = drawnHeight?.let { ((min - it) / 2).coerceAtLeast(0.dp) } ?: 0.dp
    return this
        .layout { measurable, constraints ->
            val sx = slopX.roundToPx()
            val sy = slopY.roundToPx()
            val grown = Constraints(
                minWidth = constraints.minWidth + 2 * sx,
                maxWidth = if (constraints.hasBoundedWidth) constraints.maxWidth + 2 * sx else constraints.maxWidth,
                minHeight = constraints.minHeight + 2 * sy,
                maxHeight = if (constraints.hasBoundedHeight) constraints.maxHeight + 2 * sy else constraints.maxHeight,
            )
            val placeable = measurable.measure(grown)
            layout((placeable.width - 2 * sx).coerceAtLeast(0), (placeable.height - 2 * sy).coerceAtLeast(0)) {
                placeable.place(-sx, -sy)
            }
        }
        .then(interactive)
        .padding(horizontal = slopX, vertical = slopY)
}
