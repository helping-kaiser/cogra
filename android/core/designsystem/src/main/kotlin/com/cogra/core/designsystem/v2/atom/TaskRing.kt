package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.border
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.LinearGradientShader
import androidx.compose.ui.graphics.Shader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * THE RING THE SYSTEM WEARS ON A CARD IT PUT IN FRONT OF A READER
 * (`design/tokens/semantic.css` `--ring-task`, `--ring-task-width`): a 2dp
 * edge in a 140° gradient — `primary` → `primaryContainer` at 46% →
 * `secondaryContainer` — so the reason a screen is held is legible before a
 * word of it is read (`TaskCard`, `ComposeDraftBody`).
 *
 * [colors] are the theme's three roles, read by [taskRingColors].
 */
fun Modifier.taskRing(colors: List<Color>, shape: Shape): Modifier =
    border(TASK_RING_WIDTH, AngledGradientBrush(colors, TASK_RING_STOPS), shape)

/** The ring's three roles, from the theme. */
@Composable
fun taskRingColors(): List<Color> = MaterialTheme.colorScheme.let {
    listOf(it.primary, it.primaryContainer, it.secondaryContainer)
}

/** `--ring-task-width`. */
private val TASK_RING_WIDTH = 2.dp

/**
 * CSS's `linear-gradient(140deg, …)` on the box it is painted on: the line
 * runs through the centre at 140° clockwise from "to top", long enough that
 * the box's corners sit on its ends — `|w·sinθ| + |h·cosθ|` (CSS Images 3,
 * the gradient line). The ring and the hero wash (`ComingSoonCard`) both
 * draw at the system's one angle, 140°.
 */
internal class AngledGradientBrush(
    private val colors: List<Color>,
    private val stops: List<Float>,
    private val degrees: Double = GRADIENT_ANGLE,
) : ShaderBrush() {
    override fun createShader(size: Size): Shader {
        val angle = Math.toRadians(degrees)
        val dx = sin(angle).toFloat()
        val dy = -cos(angle).toFloat()
        val half = (abs(size.width * dx) + abs(size.height * dy)) / 2f
        val centre = Offset(size.width / 2f, size.height / 2f)
        return LinearGradientShader(
            from = Offset(centre.x - dx * half, centre.y - dy * half),
            to = Offset(centre.x + dx * half, centre.y + dy * half),
            colors = colors,
            colorStops = stops,
        )
    }

    override fun equals(other: Any?): Boolean =
        other is AngledGradientBrush && other.colors == colors && other.stops == stops && other.degrees == degrees

    override fun hashCode(): Int = (colors.hashCode() * 31 + stops.hashCode()) * 31 + degrees.hashCode()
}

private const val GRADIENT_ANGLE = 140.0

private val TASK_RING_STOPS = listOf(0f, 0.46f, 1f)
