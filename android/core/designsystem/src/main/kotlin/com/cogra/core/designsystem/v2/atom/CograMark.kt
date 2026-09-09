package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The house mark, as `design/components/navigation/Icon.jsx` draws it: an open
 * ring, the descender that closes it, and one filled pick sitting inside the
 * ring.
 *
 * It is a [Canvas] rather than an `ImageVector` behind `Icon` because the mark
 * takes **two** colours — the strokes in [tint] and the pick in [pickColor] —
 * and `Icon` tints a vector with exactly one. The geometry is the master's
 * 100×100 viewport, scaled to the drawn size, so the mark on the band and the
 * mark on the canvas are the same drawing.
 *
 * Decorative: a [Canvas] contributes no semantics node, and the wordmark
 * beside it already names the product, so nothing is repeated to a screen
 * reader.
 */
@Composable
fun CograMark(
    modifier: Modifier = Modifier,
    size: Dp = 24.dp,
    tint: Color = MaterialTheme.colorScheme.primary,
    pickColor: Color = MaterialTheme.colorScheme.primaryContainer,
) {
    val ring = remember { PathParser().parsePathString(RING).toPath() }
    val descender = remember { PathParser().parsePathString(DESCENDER).toPath() }
    val pick = remember { PathParser().parsePathString(PICK).toPath() }

    Canvas(modifier = modifier.size(size)) {
        val scale = this.size.minDimension / VIEWPORT
        scale(scale) {
            val stroke = Stroke(
                width = STROKE_WIDTH,
                cap = StrokeCap.Round,
                join = StrokeJoin.Round,
            )
            drawPath(ring, color = tint, style = Stroke(width = STROKE_WIDTH))
            drawPath(descender, color = tint, style = stroke)
            drawPath(pick, color = pickColor)
        }
    }
}

private const val VIEWPORT = 100f
private const val STROKE_WIDTH = 15.66f

/** `circle cx=50 cy=38.35 r=22.52`, as two arcs — the ring the mark opens. */
private const val RING =
    "M27.48 38.35 A22.52 22.52 0 1 0 72.52 38.35 A22.52 22.52 0 1 0 27.48 38.35 Z"

/** The stroke that leaves the ring and curls back under it. */
private const val DESCENDER =
    "M72.520 17.220 L72.520 62.560 C72.450 63.280 72.340 65.460 72.090 66.870 " +
        "C71.830 68.290 71.480 69.710 70.980 71.050 C70.470 72.390 69.830 73.720 69.060 74.920 " +
        "C68.280 76.130 67.360 77.280 66.330 78.270 C65.300 79.270 64.110 80.150 62.880 80.890 " +
        "C61.660 81.620 60.310 82.210 58.950 82.690 C57.600 83.170 56.180 83.500 54.760 83.740 " +
        "C53.340 83.980 51.890 84.080 50.450 84.140 C49.010 84.200 47.560 84.170 46.120 84.090 " +
        "C44.680 84.020 42.520 83.760 41.810 83.690"

/** `circle cx=53.53 cy=34.82 r=8.52` — the one filled shape. */
private const val PICK =
    "M45.01 34.82 A8.52 8.52 0 1 0 62.05 34.82 A8.52 8.52 0 1 0 45.01 34.82 Z"

@ThemePreviews
@Composable
private fun CograMarkSizes() {
    Cogra2PreviewTheme {
        PreviewRow {
            CograMark(size = 24.dp)
            CograMark(size = 48.dp)
        }
    }
}
