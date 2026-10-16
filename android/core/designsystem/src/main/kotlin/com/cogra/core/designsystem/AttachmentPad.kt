// THE ONE-AXIS FIELD — the master `AttachmentPad` (StancePad.jsx, jakob
// 2026-10-16, PR-101): the pad an author meets when they sign their own
// content.
//
// Publish — Owner for a listing, Send for a message — is a
// single-parameter family: the author's attachment, their BACKING, rides
// `p_d`, and the census pins `p_i` at 1, never a choice. So the value
// space is a line, and it is drawn as one: offering the square here would
// offer a second axis the record cannot carry.
//
// IT IS THE SQUARE'S OWN LANGUAGE, CUT TO ONE AXIS — not a slider and not
// a second drawing. The same field (`surfaceContainerHighest` at the 16dp
// rung), the same 20dp knob of the loudest surface and its pressed layer,
// the same dead-ground hairline at zero, the same pole words held OUTSIDE
// the field in the same gutters (the 2026-09-15 ruling: a word inside the
// value space is a word the knob covers). The strip takes the width the
// square would. What it leaves out is everything the second axis owned:
// no vertical travel, no `Less`/`More`, and no hairline across — a
// crossing line would draw a zero for an axis that is not there.
//
// THE PICK IS ACCUMULATED TRAVEL, as on the square: the knob starts where
// the value is, wherever the press lands, and only horizontal travel moves
// it. The knob's centre travels the strip inset by the square's own inset
// ([knobTravelInset]), so it never leaves the drawn shape.

package com.cogra.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The strip's height: the knob's pressed layer with the square's breathing room (`ATTACHMENT_FIELD_HEIGHT_PX`). */
internal val ATTACHMENT_FIELD_HEIGHT = 56.dp

/** The gutter each pole word sits in, outside the field (`AXIS_GUTTER_X_PX`). */
internal val ATTACHMENT_GUTTER = 56.dp

/** The pole word's own box inside its gutter — the gutter less 6, as the master draws it. */
private val ATTACHMENT_POLE_WIDTH = ATTACHMENT_GUTTER - 6.dp

/** The knob's pressed layer while a finger holds it (`KNOB_LAYER_PX`). */
private val ATTACHMENT_KNOB_LAYER_RADIUS = 20.dp

/** `--state-press`: the pressed layer's opacity. */
private const val PRESS_ALPHA = 0.1f

/**
 * How far the knob's centre travels for one unit of the attachment on a
 * strip [widthPx] wide: half the strip less the square's own inset, so one
 * pixel of finger travel is one pixel of knob travel.
 */
internal fun attachmentExtent(widthPx: Float, insetPx: Float): Float = (widthPx / 2f - insetPx).coerceAtLeast(0f)

/**
 * The attachment this much accumulated travel picks STARTING FROM [base]
 * (`attachmentFrom`). Clamped once, on the sum: clamping the travel first
 * would stop the knob short whenever the base already sat off centre. A
 * zero extent — an unmeasured field — keeps the base rather than dividing
 * by zero. A negative zero normalizes to zero (the PR-91 rider: clients
 * normalize −0 → +0 at authoring), so a drag that never moved authors +0.
 */
internal fun attachmentFrom(base: Double, travelX: Float, extentPx: Float): Double {
    val picked = if (extentPx <= 0f) base else base + travelX / extentPx
    return picked.coerceIn(-1.0, 1.0) + 0.0
}

/** Where the knob's centre sits for [value], offset from the strip's centre. */
internal fun attachmentKnobOffset(value: Double, extentPx: Float): Float =
    value.toFloat().coerceIn(-1f, 1f) * extentPx

/**
 * The one-axis field: `Against` · `For` in the gutters, the strip between
 * them the value space, the knob at the pick and never outside the
 * drawing.
 *
 * It takes drags of its own, because the pad outlives the gesture that
 * opened it: release parks the pad with the pick standing, and the knob
 * stays repositionable until Set commits or Cancel dismisses. A tap that
 * never travels moves nothing.
 *
 * The gesture is a drag, and a drag nobody can perform is not an input —
 * so the strip is also a settable progress to the accessibility layer,
 * which is what lets a reader who never touches the drawing move the
 * pick and hear where it landed. The pole words leave the semantics tree:
 * the strip already names its axis.
 */
@Composable
fun AttachmentPad(
    value: Double,
    onValueChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    testTag: String = "attachment_pad",
) {
    val held = remember { mutableStateOf(false) }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(ATTACHMENT_FIELD_HEIGHT),
    ) {
        val against = stringResource(R.string.valence_pole_against)
        val forIt = stringResource(R.string.valence_pole_for)
        AttachmentPole(against, Alignment.CenterStart, TextAlign.End, "${testTag}_against")
        AttachmentPole(forIt, Alignment.CenterEnd, TextAlign.Start, "${testTag}_for")
        AttachmentStrip(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            held = held,
            testTag = testTag,
        )
    }
}

@Composable
private fun BoxScope.AttachmentPole(text: String, at: Alignment, align: TextAlign, tag: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = align,
        maxLines = 1,
        softWrap = false,
        modifier = Modifier
            .align(at)
            .width(ATTACHMENT_POLE_WIDTH)
            // Out of the reading: the strip already names its axis.
            .clearAndSetSemantics { testTag = tag },
    )
}

@Composable
private fun AttachmentStrip(
    value: Double,
    onValueChange: (Double) -> Unit,
    enabled: Boolean,
    held: MutableState<Boolean>,
    testTag: String,
) {
    val ground = MaterialTheme.colorScheme.surfaceContainerHighest
    val dead = MaterialTheme.colorScheme.outlineVariant
    val knob = MaterialTheme.colorScheme.primaryContainer
    // Read through a holder so the gesture survives every pick it
    // reports — the documented way to hold a changing lambda inside
    // `pointerInput`.
    val standing = rememberUpdatedState(value)
    val report = rememberUpdatedState(onValueChange)
    val axis = stringResource(R.string.valence_axis)
    val reading = valenceExact(value)
    val pressed by held
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(ATTACHMENT_FIELD_HEIGHT)
            .padding(horizontal = ATTACHMENT_GUTTER)
            .attachmentGesture(enabled, knobTravelInset(), standing, report, held)
            .semantics {
                contentDescription = axis
                stateDescription = reading
                progressBarRangeInfo = ProgressBarRangeInfo(value.toFloat(), -1f..1f)
                setProgress { target ->
                    report.value(target.toDouble().coerceIn(-1.0, 1.0) + 0.0)
                    true
                }
            }
            .testTag(testTag),
    ) {
        drawAttachmentStrip(
            value = value,
            pressed = pressed,
            ground = ground,
            dead = dead,
            knob = knob,
            insetPx = knobTravelInset().toPx(),
        )
    }
}

private fun DrawScope.drawAttachmentStrip(
    value: Double,
    pressed: Boolean,
    ground: Color,
    dead: Color,
    knob: Color,
    insetPx: Float,
) {
    drawRoundRect(color = ground, cornerRadius = CornerRadius(FIELD_CORNER.toPx()))
    // Dead ground at zero, drawn rather than hidden: an attachment of zero
    // carries nothing. One stroke, full height — the strip has no second
    // axis for a crossing line to name.
    val centreX = size.width / 2f
    drawLine(dead, Offset(centreX, 0f), Offset(centreX, size.height), strokeWidth = 1.dp.toPx())
    val at = Offset(centreX + attachmentKnobOffset(value, attachmentExtent(size.width, insetPx)), size.height / 2f)
    if (pressed) {
        drawCircle(color = knob.copy(alpha = PRESS_ALPHA), radius = ATTACHMENT_KNOB_LAYER_RADIUS.toPx(), center = at)
    }
    drawCircle(color = knob, radius = KNOB_RADIUS.toPx(), center = at)
}

/**
 * **The control owns its touches**: the down is consumed as it arrives
 * and every move with it, so a drag meant for the strip reaches neither
 * the wash behind the pad nor the column the pad is parked over. Only
 * horizontal travel counts.
 */
private fun Modifier.attachmentGesture(
    enabled: Boolean,
    inset: Dp,
    value: State<Double>,
    onValueChange: State<(Double) -> Unit>,
    held: MutableState<Boolean>,
): Modifier {
    if (!enabled) return this
    return pointerInput(inset) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            down.consume()
            held.value = true
            // Read once, at the down: the base is what was standing when
            // this drag began, and the picks it reports must not feed
            // back into it.
            val base = value.value
            val extentPx = attachmentExtent(size.width.toFloat(), inset.toPx())
            var travelX = 0f
            try {
                drag(down.id) { change ->
                    travelX += change.positionChange().x
                    change.consume()
                    onValueChange.value(attachmentFrom(base, travelX, extentPx))
                }
            } finally {
                held.value = false
            }
        }
    }
}
