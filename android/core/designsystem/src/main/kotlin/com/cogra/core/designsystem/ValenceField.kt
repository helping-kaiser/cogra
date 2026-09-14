// THE ONE-AXIS FIELD — `ComposePad.jsx`'s 260×72 line.
//
// The two-axis [StancePadField] is a square because the square IS the
// value space: Against/For across, Less/More up, both parameters the
// author's to choose. On one's own post the second is not — a post
// always reaches its author in full — so what is left is a line, and a
// line is drawn as one. The board says as much in its own header: the
// system had no one-axis pad and this is the surface that wants one.
//
// EVERYTHING IT SHARES WITH THE SQUARE IS SHARED IN FACT, not by
// resemblance: the same accumulated-travel rule, the same structural
// containment (the knob's CENTRE travels a box inset from the drawn
// field, so a knob outside its own drawing is not a bug this file can
// have), the same dead centre-lines drawn rather than hidden.
//
// The vertical axis is not a value here, so the field carries one
// centre-line across it and one down it: the cross is the drawing the
// board makes, and the vertical stroke marks the zero the knob passes
// through rather than an axis to drag along.

package com.cogra.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Space

/** The drawn field, `ComposePad.jsx:79`: 260 across, 72 down. */
private val VALENCE_FIELD_WIDTH = 260.dp
private val VALENCE_FIELD_HEIGHT = 72.dp

/** The board's knob — 24 across, one rung larger than the square's. */
private val VALENCE_KNOB_RADIUS = 12.dp

/** How far the knob's centre travels for one unit of the one parameter. */
private val VALENCE_EXTENT =
    VALENCE_FIELD_WIDTH / 2 - knobTravelInset(knob = VALENCE_KNOB_RADIUS)

/**
 * The one-axis field: the drawn line is the value space, `Against` at
 * one end and `For` at the other, the knob at the pick and never outside
 * the drawing.
 *
 * It takes drags of its own, because the pad outlives the gesture that
 * opened it: release parks the pad with the pick standing, and the knob
 * stays repositionable until Set commits or Cancel dismisses.
 *
 * The gesture is a drag, and a drag nobody can perform is not an input —
 * so the field is also a settable progress to the accessibility layer,
 * which is what lets a reader who never touches the drawing move the
 * pick and hear where it landed.
 */
@Composable
fun ValenceField(
    value: Double,
    onValueChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    testTag: String = "valence_field",
) {
    val ground = MaterialTheme.colorScheme.surfaceContainerHighest
    val dead = MaterialTheme.colorScheme.outlineVariant
    val knob = MaterialTheme.colorScheme.primary
    val knobRing = MaterialTheme.colorScheme.onPrimary
    val extentPx = with(LocalDensity.current) { VALENCE_EXTENT.toPx() }
    // Read through a holder so the gesture survives every pick it
    // reports — the documented way to hold a changing lambda inside
    // `pointerInput`.
    val standing = rememberUpdatedState(value)
    val report = rememberUpdatedState(onValueChange)
    val axis = stringResource(R.string.valence_axis)
    val reading = valenceExact(value)

    Box(
        modifier = modifier
            .width(VALENCE_FIELD_WIDTH)
            .height(VALENCE_FIELD_HEIGHT),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(
            modifier = Modifier
                .width(VALENCE_FIELD_WIDTH)
                .height(VALENCE_FIELD_HEIGHT)
                .valenceGesture(enabled, extentPx, standing, report)
                .semantics {
                    contentDescription = axis
                    stateDescription = reading
                    progressBarRangeInfo = ProgressBarRangeInfo(value.toFloat(), -1f..1f)
                    setProgress { target ->
                        report.value(target.toDouble().coerceIn(-1.0, 1.0))
                        true
                    }
                }
                .testTag(testTag),
        ) {
            drawValenceField(
                value = value,
                ground = ground,
                dead = dead,
                knob = knob,
                knobRing = knobRing,
                cornerPx = FIELD_CORNER.toPx(),
                knobPx = VALENCE_KNOB_RADIUS.toPx(),
                dotPx = KNOB_DOT_RADIUS.toPx(),
                extentPx = extentPx,
            )
        }
        // The poles sit on the field's own ground so they read as part of
        // it rather than as two labels floating over a line.
        ValencePole(stringResource(R.string.valence_pole_against), Alignment.CenterStart, ground)
        ValencePole(stringResource(R.string.valence_pole_for), Alignment.CenterEnd, ground)
    }
}

@Composable
private fun BoxScope.ValencePole(text: String, at: Alignment, ground: Color) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .align(at)
            .padding(Space.x2)
            .background(ground)
            .padding(horizontal = 2.dp),
    )
}

private fun DrawScope.drawValenceField(
    value: Double,
    ground: Color,
    dead: Color,
    knob: Color,
    knobRing: Color,
    cornerPx: Float,
    knobPx: Float,
    dotPx: Float,
    extentPx: Float,
) {
    val centre = Offset(size.width / 2f, size.height / 2f)
    drawRoundRect(
        color = ground,
        topLeft = Offset.Zero,
        size = Size(size.width, size.height),
        cornerRadius = CornerRadius(cornerPx),
    )
    // Dead ground, drawn rather than hidden: a parameter at zero carries
    // nothing, and the board draws both strokes inset from the edge so
    // the poles have their own ground to sit on.
    val inset = size.height * 0.11f
    val hairline = size.height * 0.02f
    drawLine(
        dead,
        Offset(inset, centre.y),
        Offset(size.width - inset, centre.y),
        strokeWidth = hairline,
    )
    drawLine(
        dead,
        Offset(centre.x, inset),
        Offset(centre.x, size.height - inset),
        strokeWidth = hairline,
    )
    val at = Offset(centre.x + valenceKnobOffset(value, extentPx), centre.y)
    drawCircle(color = knobRing, radius = knobPx, center = at)
    drawCircle(color = knob, radius = dotPx, center = at)
}

/**
 * The value this much accumulated travel picks STARTING FROM [base] —
 * the square's rule with one axis in it. Clamped once, on the sum:
 * clamping the travel first would stop the knob short whenever the base
 * already sat off centre. A zero extent — an unmeasured field — keeps
 * the base rather than dividing by zero.
 */
internal fun valenceFrom(base: Double, travelX: Float, extentPx: Float): Double {
    if (extentPx <= 0f) return base.coerceIn(-1.0, 1.0)
    return (base + travelX / extentPx).coerceIn(-1.0, 1.0)
}

/** Where the knob's centre sits for [value], offset from the field's centre. */
internal fun valenceKnobOffset(value: Double, extentPx: Float): Float =
    value.toFloat().coerceIn(-1f, 1f) * extentPx

/**
 * **The control owns its touches**: the down is consumed as it arrives
 * and every move with it, so a drag meant for the field reaches neither
 * the wash behind the pad nor the column the pad is parked over.
 */
private fun Modifier.valenceGesture(
    enabled: Boolean,
    extentPx: Float,
    value: State<Double>,
    onValueChange: State<(Double) -> Unit>,
): Modifier {
    if (!enabled) return this
    return pointerInput(extentPx) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            down.consume()
            // Read once, at the down: the base is what was standing when
            // this drag began, and the picks it reports must not feed
            // back into it.
            val base = value.value
            var travelX = 0f
            drag(down.id) { change ->
                travelX += change.positionChange().x
                change.consume()
                onValueChange.value(valenceFrom(base, travelX, extentPx))
            }
        }
    }
}
