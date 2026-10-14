package com.cogra.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * `sentiment_neutral`, the line face: the unset stance face wherever the
 * muted 🫥 cannot read (design/guidelines/iconography.md, stance-control.md).
 * Over media it is the stream's unset state; on the vouch card it is drawn in
 * the card's own ink (`onTertiaryContainer`), because the emoji's fixed pale
 * greys cannot be tinted and never read on the card's olive ground.
 *
 * The geometry is the master's, verbatim — the four paths of
 * `design/components/navigation/Icon.jsx` `PATHS.sentiment_neutral` (mouth,
 * two eyes, ring) in its 24×24 viewport — drawn as a [Canvas] the way
 * [com.cogra.core.designsystem.v2.atom.CograMark] draws the master's mark,
 * so the web and Android faces are one drawing. Always full opacity: the line
 * face says "no opinion yet" by being the empty face, not by being faint.
 *
 * Decorative: it contributes no semantics node, so the anchor's own
 * accessible name is the only thing announced.
 */
@Composable
internal fun LineFace(
    ink: Color,
    modifier: Modifier = Modifier,
    size: Dp = LINE_FACE_SIZE,
) {
    val paths = remember { LINE_FACE_PATHS.map { PathParser().parsePathString(it).toPath() } }
    Canvas(modifier = modifier.size(size)) {
        scale(this.size.minDimension / LINE_FACE_VIEWPORT, pivot = Offset.Zero) {
            paths.forEach { drawPath(it, color = ink) }
        }
    }
}

/** The vouch card's face size, matching the emoji's 24px line (the master's 24). */
internal val LINE_FACE_SIZE = 24.dp

private const val LINE_FACE_VIEWPORT = 24f

/** `Icon.jsx` `PATHS.sentiment_neutral`, character for character. */
internal val LINE_FACE_PATHS = listOf(
    "M9 15.5h6v1H9v-1z",
    "M15.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 1 1 0-3z",
    "M8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 1 1 0-3z",
    "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z",
)
