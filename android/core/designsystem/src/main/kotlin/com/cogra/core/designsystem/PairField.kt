// THE RANGED PAIR FIELD — the master `StancePad` with `ranges` and `axes`
// (StancePad.jsx). One field, three families: the opinion pad over a
// stance's signed square (`StanceControl`'s `field`), and the composer's
// pair sheets — `TagPadCompose` over a staged tag and `RefPair` over a
// staged citation.
//
// THE DRAWN FIELD IS THE VALUE SPACE, whatever the census gives the family:
// a stance's and a citation's two signed slots fill the square from −1 to +1
// on both axes, and a tag's fill it from its +0.01 relevance floor to 1
// across and from 0 to 1 up — so the knob can never stand on a value the
// record cannot carry (TagPadCompose.md: "NEVER relevance goes below
// +0.01"). The pole words sit OUTSIDE the field in the gutters the component
// reserves (the 2026-09-15 ruling); the dead-ground hairline marks an axis's
// zero only where the range crosses it — a tag's field has none.
//
// THE PICK IS ACCUMULATED TRAVEL from where the value stood, one rule for
// both axes: `perPixel` is the range's span over the knob's whole travel,
// and the sum is clamped once, per axis. Release lands it on the hundredths
// grid ([hundredth]), clamped back into the reach.
//
// THE KNOB TICKS, ON ANDROID ONLY (readme §4, *Haptics*; PadStanding.md:71):
// crossing either zero line, and meeting the field's edge where the pick
// clamps, gives one `SEGMENT_TICK` each (`CLOCK_TICK` below API 34).
// Nothing else in the drag vibrates.

package com.cogra.core.designsystem

import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
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
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** One axis's census range. */
@Immutable
data class PairRange(val min: Double, val max: Double) {
    fun clamp(value: Double): Double = (if (value.isNaN()) 0.0 else value).coerceIn(min, max) + 0.0

    /** Where [value] sits along the range, 0 at its low end and 1 at its high end. */
    fun fractionOf(value: Double): Double = (clamp(value) - min) / (max - min)

    /** Where zero sits along the range, or null when the range never crosses it. */
    val zeroFraction: Double? get() = if (min < 0.0 && max > 0.0) (0.0 - min) / (max - min) else null
}

/** The two ranges a family's census gives its pair: `pDirected` across, `pInterest` up. */
@Immutable
data class PairRanges(val directed: PairRange, val interest: PairRange) {
    companion object {
        /** A stance's — and a citation's — signed square (`STANCE_RANGES`). */
        val Signed = PairRanges(PairRange(-1.0, 1.0), PairRange(-1.0, 1.0))

        /** The relevance floor a tag can carry (`TAG_RELEVANCE_FLOOR`). */
        const val TAG_RELEVANCE_FLOOR = 0.01

        /** A tag's field: relevance from its floor to 1, confidence from 0 to 1 (`TAG_RANGES`). */
        val Tag = PairRanges(PairRange(TAG_RELEVANCE_FLOOR, 1.0), PairRange(0.0, 1.0))
    }
}

/** A pick in a ranged field: `pDirected` across, `pInterest` up. */
@Immutable
data class PairPoint(val directed: Double, val interest: Double)

/** The six words a family names its field with — the two questions and the four poles. */
@Immutable
data class PairAxes(
    val directed: String,
    val interest: String,
    val left: String,
    val right: String,
    val bottom: String,
    val top: String,
) {
    companion object {
        /** A tag's (`TagPadCompose.jsx`'s `TAG_AXES`). */
        val Tag = PairAxes(
            directed = "How much it is about this",
            interest = "How sure you are",
            left = "Barely",
            right = "Entirely",
            bottom = "Guessing",
            top = "Certain",
        )

        /** A citation's (`RefPair.jsx`'s `CITATION_AXES`). */
        val Citation = PairAxes(
            directed = "How much it leans on this",
            interest = "For or against",
            left = "Barely",
            right = "Entirely",
            bottom = "Against",
            top = "For",
        )
    }
}

/** The gutters the pole words stand in (`AXIS_GUTTER_X_PX`, `AXIS_GUTTER_Y_PX`). */
internal val PAIR_GUTTER_X = 56.dp
internal val PAIR_GUTTER_Y = 20.dp

/** The knob's pressed layer while a finger holds it (`KNOB_LAYER_PX`). */
private val PAIR_KNOB_LAYER_RADIUS = 20.dp

/** `--state-press`. */
private const val PAIR_PRESS_ALPHA = 0.1f

/** How far the knob's centre travels from the field's centre to its edge, for a field [sidePx] across. */
internal fun pairHalfExtent(sidePx: Float, insetPx: Float): Float = (sidePx / 2f - insetPx).coerceAtLeast(0f)

/**
 * The pick this much travel makes STARTING FROM [base] (`padPairFrom` with
 * `ranges`). Screen y grows downward and `pInterest` grows upward, so the
 * vertical inverts. Clamped once, per axis, on the sum; a zero extent keeps
 * the base.
 */
internal fun pairFrom(base: PairPoint, travel: Offset, halfExtentPx: Float, ranges: PairRanges): PairPoint {
    if (halfExtentPx <= 0f) return PairPoint(ranges.directed.clamp(base.directed), ranges.interest.clamp(base.interest))
    val perX = (ranges.directed.max - ranges.directed.min) / (2 * halfExtentPx)
    val perY = (ranges.interest.max - ranges.interest.min) / (2 * halfExtentPx)
    return PairPoint(
        directed = ranges.directed.clamp(base.directed + travel.x * perX),
        interest = ranges.interest.clamp(base.interest - travel.y * perY),
    )
}

/** Where a drag of this much travel PARKS once the finger lifts: [pairFrom] on the hundredths grid. */
internal fun pairReleased(base: PairPoint, travel: Offset, halfExtentPx: Float, ranges: PairRanges): PairPoint =
    ranges.snap(pairFrom(base, travel, halfExtentPx, ranges))

/** The knob's centre for [point], from the field's top-left, in a field [sidePx] across. */
internal fun pairKnobAt(point: PairPoint, sidePx: Float, insetPx: Float, ranges: PairRanges): Offset {
    val travel = (sidePx - 2 * insetPx).coerceAtLeast(0f)
    return Offset(
        x = insetPx + ranges.directed.fractionOf(point.directed).toFloat() * travel,
        y = insetPx + (1f - ranges.interest.fractionOf(point.interest).toFloat()) * travel,
    )
}

/**
 * Whether one step of the knob along an axis earns the platform's tick
 * (readme §4, *Haptics*): it crossed the axis's zero line — or landed on it
 * from either side — or it met the field's edge where the pick clamps. A
 * step that stays on a line or an edge it already stood on ticks nothing,
 * so a finger pressing past the edge is not a buzz.
 */
internal fun ticksAlong(from: Double, to: Double, range: PairRange): Boolean {
    if (from == to) return false
    val crossesZero = range.zeroFraction != null && from != 0.0 && (to == 0.0 || (from < 0.0) != (to < 0.0))
    val meetsEdge = (to == range.min || to == range.max) && from != to
    return crossesZero || meetsEdge
}

/** One short platform tick — `SEGMENT_TICK`, documented for discrete points on a slider (`CLOCK_TICK` below API 34). */
internal fun View.knobTick() {
    performHapticFeedback(
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            HapticFeedbackConstants.SEGMENT_TICK
        } else {
            HapticFeedbackConstants.CLOCK_TICK
        },
    )
}

/**
 * The ranged pair field, its four pole words outside it.
 *
 * [exactValuesLabel] is the field's non-drag route (audit K10.1): a custom
 * accessibility action that asks the host for the alternates — `Set exact
 * values for #coastroad` on a sheet, `Choose your opinion on this post` on
 * the opinion pad — since a two-axis drag is not an input a reader who never
 * touches the drawing can perform.
 *
 * [held] draws the knob's pressed layer for a board, as the master's `held`
 * does; a live drag draws it on its own. [node] is the placer's name for the
 * whole field (the open pad's `field`); its value space wears `square`.
 */
@Composable
fun PairField(
    value: PairPoint,
    onValueChange: (PairPoint) -> Unit,
    ranges: PairRanges,
    axes: PairAxes,
    exactValuesLabel: String,
    onExactValues: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String = "pair_field",
    enabled: Boolean = true,
    held: Boolean = false,
    node: DataNode? = null,
) {
    val pressed = remember { mutableStateOf(false) }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .padding(horizontal = PAIR_GUTTER_X, vertical = PAIR_GUTTER_Y),
    ) {
        PairSquare(
            value = value,
            onValueChange = onValueChange,
            ranges = ranges,
            axes = axes,
            exactValuesLabel = exactValuesLabel,
            onExactValues = onExactValues,
            pressed = pressed,
            layered = held || pressed.value,
            enabled = enabled,
            testTag = node?.div("square")?.tag ?: testTag,
        )
    }
}

@Composable
private fun PairSquare(
    value: PairPoint,
    onValueChange: (PairPoint) -> Unit,
    ranges: PairRanges,
    axes: PairAxes,
    exactValuesLabel: String,
    onExactValues: () -> Unit,
    pressed: MutableState<Boolean>,
    layered: Boolean,
    enabled: Boolean,
    testTag: String,
) {
    val ground = MaterialTheme.colorScheme.surfaceContainerHighest
    val dead = MaterialTheme.colorScheme.outlineVariant
    val knob = MaterialTheme.colorScheme.primaryContainer
    val standing = rememberUpdatedState(value)
    val report = rememberUpdatedState(onValueChange)
    val view = LocalView.current
    val reading = "${axes.directed} ${twoPlaces(value.directed)}, ${axes.interest} ${twoPlaces(value.interest)}"
    Box(Modifier.fillMaxWidth().aspectRatio(1f)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .then(
                    if (enabled) {
                        Modifier.pairGesture(knobTravelInset(), standing, report, pressed, ranges, view)
                    } else {
                        Modifier
                    },
                )
                .semantics {
                    contentDescription = "${axes.directed}, ${axes.interest}"
                    stateDescription = reading
                    customActions = listOf(
                        CustomAccessibilityAction(exactValuesLabel) {
                            onExactValues()
                            true
                        },
                    )
                }
                .testTag(testTag),
        ) {
            drawPairField(value, layered, ranges, ground, dead, knob, knobTravelInset().toPx())
        }
        PairPole(axes.left, Alignment.CenterStart, -PAIR_GUTTER_X, TextAlign.End)
        PairPole(axes.right, Alignment.CenterEnd, PAIR_GUTTER_X, TextAlign.Start)
        PairPole(axes.top, Alignment.TopCenter, 0.dp, TextAlign.Center, dy = -PAIR_GUTTER_Y)
        PairPole(axes.bottom, Alignment.BottomCenter, 0.dp, TextAlign.Center, dy = PAIR_GUTTER_Y)
    }
}

/** One pole word, held in its own gutter outside the field and pushed against the edge it names. */
@Composable
private fun BoxScope.PairPole(text: String, at: Alignment, dx: Dp, align: TextAlign, dy: Dp = 0.dp) {
    val sideways = dx != 0.dp
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = align,
        maxLines = 1,
        softWrap = false,
        modifier = Modifier
            .align(at)
            .then(if (sideways) Modifier.width(PAIR_GUTTER_X - 6.dp) else Modifier)
            // Measured inside the field's box, so its alignment is the
            // field's own edge, then drawn shifted out into its gutter.
            .offset(x = dx, y = dy)
            .clearAndSetSemantics { },
    )
}

private fun DrawScope.drawPairField(
    value: PairPoint,
    layered: Boolean,
    ranges: PairRanges,
    ground: Color,
    dead: Color,
    knob: Color,
    insetPx: Float,
) {
    drawRoundRect(color = ground, cornerRadius = CornerRadius(FIELD_CORNER.toPx()))
    val stroke = 1.dp.toPx()
    // Dead ground marks an axis's zero, so only where the range crosses it.
    ranges.interest.zeroFraction?.let { f ->
        val y = (1f - f.toFloat()) * size.height
        drawLine(dead, Offset(0f, y), Offset(size.width, y), strokeWidth = stroke)
    }
    ranges.directed.zeroFraction?.let { f ->
        val x = f.toFloat() * size.width
        drawLine(dead, Offset(x, 0f), Offset(x, size.height), strokeWidth = stroke)
    }
    val at = pairKnobAt(value, size.width, insetPx, ranges)
    // The pressed state layer (the K13 round): a 40dp disc in the knob's own
    // colour at the press opacity, for as long as the pointer is down — a
    // layer, never a scale.
    if (layered) {
        drawCircle(color = knob.copy(alpha = PAIR_PRESS_ALPHA), radius = PAIR_KNOB_LAYER_RADIUS.toPx(), center = at)
    }
    drawCircle(color = knob, radius = KNOB_RADIUS.toPx(), center = at)
}

/**
 * **The field owns its pointers**: the down and every move are consumed,
 * so a drag on the field moves the knob and never the sheet — or the
 * scrolling pad — it stands on.
 */
private fun Modifier.pairGesture(
    inset: Dp,
    value: State<PairPoint>,
    onValueChange: State<(PairPoint) -> Unit>,
    held: MutableState<Boolean>,
    ranges: PairRanges,
    view: View,
): Modifier = pointerInput(inset, ranges) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        down.consume()
        held.value = true
        val base = value.value
        val half = pairHalfExtent(size.width.toFloat(), inset.toPx())
        var travel = Offset.Zero
        var travelled = false
        var last = base
        try {
            drag(down.id) { change ->
                travel += change.positionChange()
                change.consume()
                travelled = true
                val next = pairFrom(base, travel, half, ranges)
                if (ticksAlong(last.directed, next.directed, ranges.directed) ||
                    ticksAlong(last.interest, next.interest, ranges.interest)
                ) {
                    view.knobTick()
                }
                last = next
                onValueChange.value(next)
            }
            // The lift lands the pair on the hundredths grid inside the
            // field's reach (the value domain, jakob 2026-10-20) — a tag's
            // relevance never below its floor. A tap moves nothing.
            if (travelled) onValueChange.value(pairReleased(base, travel, half, ranges))
        } finally {
            held.value = false
        }
    }
}

/**
 * The field's non-drag route (audit K10.1; `StanceAlternates` at
 * `host="sheet"`): the two tracks, each named by its family's question and
 * bounded by the same ranges the field is — so a tag's relevance track stops
 * at its +0.01 floor too.
 */
@Composable
fun PairSliders(
    value: PairPoint,
    onValueChange: (PairPoint) -> Unit,
    ranges: PairRanges,
    axes: PairAxes,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LabeledSlider(
            label = axes.directed,
            value = value.directed,
            onChange = { onValueChange(value.copy(directed = ranges.directed.clamp(it))) },
            testTag = "${testTagPrefix}_directed",
            valueRange = ranges.directed.min.toFloat()..ranges.directed.max.toFloat(),
        )
        LabeledSlider(
            label = axes.interest,
            value = value.interest,
            onChange = { onValueChange(value.copy(interest = ranges.interest.clamp(it))) },
            testTag = "${testTagPrefix}_interest",
            valueRange = ranges.interest.min.toFloat()..ranges.interest.max.toFloat(),
        )
    }
}
