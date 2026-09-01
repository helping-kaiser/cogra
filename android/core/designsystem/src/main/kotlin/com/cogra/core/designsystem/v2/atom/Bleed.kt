package com.cogra.core.designsystem.v2.atom

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp

/**
 * Lets one child run to the screen's edges out of a gutter-padded column
 * — the boards' `margin: 0 -24px`.
 *
 * A padded parent hands its children narrowed constraints, so a child
 * cannot reach the edges by asking: it has to be measured against the
 * wider space and then placed back over the padding. That is what this
 * does, and it reports the *unbled* width upward so the column's own
 * layout is untouched — a sibling still sits in the gutter, and the
 * parent's width does not grow by the bleed.
 *
 * [edge] is the padding being escaped on each side.
 */
fun Modifier.bleedHorizontally(edge: Dp): Modifier = layout { measurable, constraints ->
    val extra = edge.roundToPx() * 2
    val widened = Constraints(
        minWidth = constraints.minWidth + extra,
        maxWidth = if (constraints.hasBoundedWidth) constraints.maxWidth + extra else constraints.maxWidth,
        minHeight = constraints.minHeight,
        maxHeight = constraints.maxHeight,
    )
    val placeable = measurable.measure(widened)
    layout((placeable.width - extra).coerceAtLeast(0), placeable.height) {
        placeable.place(-edge.roundToPx(), 0)
    }
}
