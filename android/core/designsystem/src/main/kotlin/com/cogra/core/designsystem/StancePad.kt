// CoGra's signature interaction (design.md §8), as pure UI.
//
// The shape of the thing: a single tap target at rest, a plain tap
// commits the modest positive default, and a press-and-hold blooms a
// soft pad under the thumb that the reader drifts across and releases to
// commit. Horizontal is valence, vertical is connection, the pad opens
// at the origin, and the whole square stays reachable — corners
// included, because someone dragging to the far corner means it.
//
// Two numbers are kept apart on purpose. The FACE is a lossy readout of
// the edge being authored — this pick — and moves with the thumb. WHERE
// THE PICK LEAVES YOU is the bundle's fold and arrives from the caller;
// this file never derives it, because a stance record carries the picked
// values verbatim and the client computes no delta (design.md §8.1).
//
// Everything here takes doubles and lambdas: `core:designsystem` holds
// no domain types, so [StancePoint] is the field's own coordinate and
// the feature module maps it.

package com.cogra.core.designsystem

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.PointerEventTimeoutCancellationException
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import java.util.Locale

/** Where the pad is: shut, following a thumb, or parked open. */
enum class StancePadMode {
    CLOSED,

    /** Bloomed under a thumb that is still down. */
    DRAGGING,

    /**
     * Parked open after a hold that never drifted. The alternates and
     * the severance route live here — they need a surface that outlasts
     * the gesture to be reachable at all (design.md §8.5, §8.6).
     */
    STICKY,
}

/**
 * Where a pick leaves the bundle, as the caller was told by the fold
 * (design.md §8.2). Never computed here.
 */
@Immutable
data class StanceLanding(
    val net: StancePoint,
    val inertDirected: Boolean,
    val inertInterest: Boolean,
    val severance: Boolean,
)

/**
 * The severance confirmation's content: what the reader stands at, and
 * what reaching zero takes — one signed act per counter-record
 * (design.md §8.5).
 */
@Immutable
data class SeverancePrompt(
    val standing: StancePoint,
    val records: Int,
    val alreadySevered: Boolean,
    /** Arrived as the result of an ordinary pick rather than the route. */
    val fromPick: Boolean,
    val working: Boolean = false,
    val failed: Boolean = false,
)

@Immutable
data class StanceControlState(
    val pick: StancePoint = StancePoint.Origin,
    val pad: StancePadMode = StancePadMode.CLOSED,
    /** The viewer's folded standing; null while unknown or unauthored. */
    val standing: StancePoint? = null,
    /** Where [pick] leaves the bundle; null while the fold is in flight. */
    val landing: StanceLanding? = null,
    val busy: Boolean = false,
    val failed: Boolean = false,
    /** The failure was a husk device: the key has to come back first. */
    val needsKey: Boolean = false,
    val exactValues: Boolean = false,
    val severance: SeverancePrompt? = null,
    /** The one-time teaching mark for the held gesture (design.md §8.7). */
    val coachMark: Boolean = false,
)

/** The pad's drawn diameter; its radius is the whole `[-1, +1]` range. */
private val PAD_SIZE = 240.dp

/** The resting target keeps the platform's minimum (design.md §4, §10). */
private val TARGET_MIN = 48.dp

/**
 * The stance control: the resting target, the pad it blooms, and the
 * severance confirmation either can reach.
 *
 * [onHold] fires when a hold is released without drifting — the pad
 * parks open instead of committing an origin pick that would carry
 * nothing, which is what makes the alternates and the severance route
 * reachable by touch at all.
 */
@Composable
fun StanceControl(
    state: StanceControlState,
    onTapDefault: () -> Unit,
    onOpenPad: () -> Unit,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onHold: () -> Unit,
    onDismissPad: () -> Unit,
    onToggleExactValues: () -> Unit,
    onOpenSeverance: () -> Unit,
    onConfirmSeverance: () -> Unit,
    onDismissSeverance: () -> Unit,
    onCoachMarkDismissed: () -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
) {
    val radiusPx = with(LocalDensity.current) { (PAD_SIZE / 2).toPx() }
    val padPx = with(LocalDensity.current) { PAD_SIZE.roundToPx() }
    val tapLabel = stringResource(R.string.stance_target)
    val exactLabel = stringResource(R.string.stance_pick_exactly)
    val severLabel = stringResource(R.string.stance_severance_open)
    val description = stringResource(R.string.stance_target_action)

    Column(modifier) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .sizeIn(minWidth = TARGET_MIN, minHeight = TARGET_MIN)
                .clip(RoundedCornerShape(50))
                .stanceGesture(
                    enabled = !state.busy,
                    radiusPx = radiusPx,
                    onTapDefault = onTapDefault,
                    onOpenPad = onOpenPad,
                    onPick = onPick,
                    onCommit = onCommit,
                    onHold = onHold,
                    onCancel = onDismissPad,
                )
                // Colour never carries meaning alone, and a drag gesture
                // always has a non-drag equivalent (design.md §10): the
                // node reads as a button, double-tap commits the
                // default, and the alternates ride custom actions.
                .semantics {
                    role = Role.Button
                    contentDescription = description
                    onClick(label = tapLabel) {
                        onTapDefault()
                        true
                    }
                    customActions = listOf(
                        CustomAccessibilityAction(exactLabel) {
                            onOpenPad()
                            onHold()
                            if (!state.exactValues) onToggleExactValues()
                            true
                        },
                        CustomAccessibilityAction(severLabel) {
                            onOpenSeverance()
                            true
                        },
                    )
                }
                .testTag("${testTagPrefix}_stance"),
        ) {
            Text(
                text = tapLabel,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }

        // A refusal has to be visible even when the pad is shut, which is
        // where a plain tap fails.
        if (state.failed && state.pad == StancePadMode.CLOSED) {
            StanceFailure(state.needsKey, testTagPrefix)
        }

        if (state.coachMark) {
            StanceCoachMark(
                onDismissed = onCoachMarkDismissed,
                testTagPrefix = testTagPrefix,
            )
        }

        if (state.pad != StancePadMode.CLOSED) {
            val sticky = state.pad == StancePadMode.STICKY
            Popup(
                popupPositionProvider = remember(padPx) { PadCentredOnTarget(padPx) },
                onDismissRequest = onDismissPad.takeIf { sticky },
                properties = PopupProperties(focusable = sticky),
            ) {
                StancePadOverlay(
                    state = state,
                    sticky = sticky,
                    onPick = onPick,
                    onCommit = onCommit,
                    onCancel = onDismissPad,
                    onToggleExactValues = onToggleExactValues,
                    onOpenSeverance = onOpenSeverance,
                    testTagPrefix = testTagPrefix,
                )
            }
        }

        state.severance?.let { prompt ->
            SeveranceConfirm(
                prompt = prompt,
                onConfirm = onConfirmSeverance,
                onDismiss = onDismissSeverance,
                testTagPrefix = testTagPrefix,
            )
        }
    }
}

/**
 * Tap versus hold, on one pointer stream. A tap that lands before the
 * platform's long-press threshold commits the default; past it the pad
 * blooms and the accumulated drag becomes the pick, clamped per axis so
 * the corners of the square stay reachable (design.md §8.2, §8.3).
 */
private fun Modifier.stanceGesture(
    enabled: Boolean,
    radiusPx: Float,
    onTapDefault: () -> Unit,
    onOpenPad: () -> Unit,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onHold: () -> Unit,
    onCancel: () -> Unit,
): Modifier = if (!enabled) this else pointerInput(radiusPx) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        var held = false
        val up = try {
            withTimeout(viewConfiguration.longPressTimeoutMillis) {
                waitForUpOrCancellation()
            }
        } catch (_: PointerEventTimeoutCancellationException) {
            held = true
            null
        }
        when {
            held -> {
                onOpenPad()
                var travel = Offset.Zero
                var drifted = false
                val completed = drag(down.id) { change ->
                    travel += change.positionChange()
                    change.consume()
                    if (travel.getDistance() > viewConfiguration.touchSlop) drifted = true
                    onPick(travel.toStancePoint(radiusPx))
                }
                when {
                    !completed -> onCancel()
                    drifted -> onCommit()
                    else -> onHold()
                }
            }
            up != null -> onTapDefault()
            else -> Unit
        }
    }
}

/** Screen travel to a field position: y inverted, each axis clamped. */
private fun Offset.toStancePoint(radiusPx: Float): StancePoint = StancePoint(
    directed = (x / radiusPx).coerceIn(-1f, 1f).toDouble(),
    interest = (-y / radiusPx).coerceIn(-1f, 1f).toDouble(),
)

/**
 * Puts the field's centre on the target's centre — the pad blooms under
 * the thumb, and the readout rides above it clear of the finger
 * (design.md §8.3, §8.4).
 */
private class PadCentredOnTarget(private val padPx: Int) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val x = anchorBounds.center.x - popupContentSize.width / 2
        val y = anchorBounds.center.y - popupContentSize.height + padPx / 2
        return IntOffset(
            x = x.coerceIn(0, maxOf(0, windowSize.width - popupContentSize.width)),
            y = y.coerceIn(0, maxOf(0, windowSize.height - popupContentSize.height)),
        )
    }
}

@Composable
private fun StancePadOverlay(
    state: StanceControlState,
    sticky: Boolean,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onToggleExactValues: () -> Unit,
    onOpenSeverance: () -> Unit,
    testTagPrefix: String,
) {
    Card(modifier = Modifier.width(288.dp).testTag("${testTagPrefix}_stance_pad")) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StanceStandingLine(state.standing, testTagPrefix)
            StanceReadout(state.pick, testTagPrefix)
            StanceField(state.pick)
            StanceLandingLine(state.landing, testTagPrefix)
            if (sticky) {
                if (state.exactValues) {
                    StanceExactValues(state.pick, onPick, testTagPrefix)
                }
                if (state.failed) {
                    StanceFailure(state.needsKey, testTagPrefix)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onCommit,
                        enabled = !state.busy,
                        modifier = Modifier.testTag("${testTagPrefix}_stance_set"),
                    ) {
                        Text(stringResource(R.string.stance_set))
                    }
                    TextButton(
                        onClick = onCancel,
                        modifier = Modifier.testTag("${testTagPrefix}_stance_cancel"),
                    ) {
                        Text(stringResource(R.string.stance_cancel))
                    }
                }
                TextButton(
                    onClick = onToggleExactValues,
                    modifier = Modifier.testTag("${testTagPrefix}_stance_exact"),
                ) {
                    Text(
                        stringResource(
                            if (state.exactValues) {
                                R.string.stance_exact_values_hide
                            } else {
                                R.string.stance_exact_values_show
                            },
                        ),
                    )
                }
                // The route for the reader who came here to sever: it has
                // to be findable from the open pad (design.md §8.5).
                TextButton(
                    onClick = onOpenSeverance,
                    modifier = Modifier.testTag("${testTagPrefix}_stance_sever"),
                ) {
                    Text(stringResource(R.string.stance_severance_open))
                }
            }
        }
    }
}

@Composable
private fun StanceFailure(needsKey: Boolean, testTagPrefix: String) {
    ErrorLine(
        if (needsKey) R.string.stance_failed_no_key else R.string.stance_failed,
        "${testTagPrefix}_stance_failed",
    )
}

/**
 * Where the reader stands now — the first of the two numbers the control
 * keeps apart, and read-side throughout (design.md §8.1).
 */
@Composable
private fun StanceStandingLine(standing: StancePoint?, testTagPrefix: String) {
    val text = when {
        standing == null -> stringResource(R.string.stance_standing_none)
        else -> "${stringResource(R.string.stance_standing)}: ${standing.reading()}"
    }
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("${testTagPrefix}_stance_standing"),
    )
}

/**
 * The face and its words, sitting above the pad rather than under the
 * knob — a thumb on the control covers exactly the spot where feedback
 * would otherwise appear (design.md §8.4).
 */
@Composable
private fun StanceReadout(pick: StancePoint, testTagPrefix: String) {
    val anchor = nearestStanceAnchor(pick)
    val words = stringResource(anchor.label)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        // One readout, announced once.
        modifier = Modifier
            .semantics(mergeDescendants = true) { }
            .testTag("${testTagPrefix}_stance_readout"),
    ) {
        // Stance is always accompanied by words (design.md §10), and the
        // face rides on top of them: reading out an emoji's own name
        // would be noise, so it leaves the semantics tree.
        Text(
            text = anchor.emoji,
            style = MaterialTheme.typography.displaySmall,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Text(words, style = MaterialTheme.typography.titleMedium)
    }
}

/**
 * The field: a soft round ground with its inert centre-lines drawn as
 * visibly dead rather than hidden, and the knob at the pick. No numbers,
 * axes, or gridlines — those are the alternates' job (design.md §8.3).
 */
@Composable
private fun StanceField(pick: StancePoint) {
    val ground = MaterialTheme.colorScheme.surfaceVariant
    val dead = MaterialTheme.colorScheme.outlineVariant
    val knob = MaterialTheme.colorScheme.primary
    val knobRing = MaterialTheme.colorScheme.onPrimary
    // The bloom: M3 standard easing over a short duration. Compose scales
    // every animation by the platform's own animator duration scale, so
    // "remove animations" is honoured without a branch here (design.md §4).
    val bloom = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        bloom.animateTo(1f, tween(durationMillis = 200, easing = FastOutSlowInEasing))
    }
    Canvas(modifier = Modifier.size(PAD_SIZE)) {
        drawStanceField(pick, ground, dead, knob, knobRing, bloom.value)
    }
}

private fun DrawScope.drawStanceField(
    pick: StancePoint,
    ground: Color,
    dead: Color,
    knob: Color,
    knobRing: Color,
    scale: Float,
) {
    val radius = size.minDimension / 2f
    val centre = Offset(size.width / 2f, size.height / 2f)
    drawCircle(color = ground, radius = radius * scale, center = centre)
    // Dead ground: a bundle whose folded parameter is zero carries
    // nothing, so the centre-lines are drawn rather than hidden.
    val band = radius * 0.04f
    drawLine(dead, Offset(0f, centre.y), Offset(size.width, centre.y), strokeWidth = band)
    drawLine(dead, Offset(centre.x, 0f), Offset(centre.x, size.height), strokeWidth = band)
    val at = Offset(
        x = centre.x + (pick.directed.toFloat() * radius),
        y = centre.y - (pick.interest.toFloat() * radius),
    )
    drawCircle(color = knobRing, radius = radius * 0.11f, center = at)
    drawCircle(color = knob, radius = radius * 0.08f, center = at)
}

/**
 * The second number: where the pick leaves the bundle. Inertness and
 * severance are named in words, never left to the reader to infer from a
 * value (design.md §8.2).
 */
@Composable
private fun StanceLandingLine(landing: StanceLanding?, testTagPrefix: String) {
    val text = when {
        landing == null -> stringResource(R.string.stance_landing_working)
        landing.severance -> stringResource(R.string.stance_severance_reached)
        landing.inertDirected && landing.inertInterest -> stringResource(R.string.stance_carries_nothing)
        landing.inertDirected -> stringResource(R.string.stance_carries_nothing_directed)
        landing.inertInterest -> stringResource(R.string.stance_carries_nothing_interest)
        else -> "${stringResource(R.string.stance_landing)}: ${landing.net.reading()}"
    }
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("${testTagPrefix}_stance_landing"),
    )
}

/**
 * A pair in the reader's own words plus its values. Numbers are in
 * scope, and every one shown is explainable (design.md §7).
 */
@Composable
internal fun StancePoint.reading(): String = stringResource(
    R.string.stance_reading,
    stringResource(R.string.stance_axis_directed),
    twoPlaces(directed),
    stringResource(R.string.stance_axis_interest),
    twoPlaces(interest),
)

internal fun twoPlaces(value: Double): String = String.format(Locale.getDefault(), "%+.2f", value)

/**
 * The direct-entry field's text. Root locale, not the reader's: this one
 * has to survive a round trip through [String.toDoubleOrNull], and a
 * decimal comma would not.
 */
private fun entryText(value: Double): String = String.format(Locale.ROOT, "%.2f", value)

/**
 * The alternates (design.md §8.6): paired sliders and direct entry, the
 * same machinery on a surface a screen-reader or switch user can drive.
 */
@Composable
private fun StanceExactValues(
    pick: StancePoint,
    onPick: (StancePoint) -> Unit,
    testTagPrefix: String,
) {
    val directedLabel = stringResource(R.string.stance_axis_directed)
    val interestLabel = stringResource(R.string.stance_axis_interest)
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        StanceSlider(
            label = directedLabel,
            value = pick.directed,
            onChange = { onPick(pick.copy(directed = it)) },
            testTag = "${testTagPrefix}_stance_slider_directed",
        )
        StanceSlider(
            label = interestLabel,
            value = pick.interest,
            onChange = { onPick(pick.copy(interest = it)) },
            testTag = "${testTagPrefix}_stance_slider_interest",
        )
        StanceEntry(
            label = directedLabel,
            value = pick.directed,
            onChange = { onPick(pick.copy(directed = it)) },
            testTag = "${testTagPrefix}_stance_entry_directed",
        )
        StanceEntry(
            label = interestLabel,
            value = pick.interest,
            onChange = { onPick(pick.copy(interest = it)) },
            testTag = "${testTagPrefix}_stance_entry_interest",
        )
    }
}

/**
 * Direct entry: a typed value, reported only once it parses inside the
 * closed range. The typed text is its own state — reformatting on every
 * keystroke would make a leading minus sign impossible to type.
 */
@Composable
private fun StanceEntry(
    label: String,
    value: Double,
    onChange: (Double) -> Unit,
    testTag: String,
) {
    var typed by rememberSaveable { mutableStateOf(entryText(value)) }
    // The sliders move the same value; the field follows them, but never
    // reformats what the reader is still typing.
    LaunchedEffect(value) {
        if (typed.toDoubleOrNull() != value) typed = entryText(value)
    }
    OutlinedTextField(
        value = typed,
        onValueChange = {
            typed = it
            it.toDoubleOrNull()?.takeIf { parsed -> parsed in -1.0..1.0 }?.let(onChange)
        },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier
            .fillMaxWidth()
            .testTag(testTag),
    )
}

/**
 * The one-time teaching mark: a held gesture is invisible until taught,
 * and a plain tap always works without it (design.md §8.7).
 */
@Composable
private fun StanceCoachMark(onDismissed: () -> Unit, testTagPrefix: String) {
    Popup(alignment = Alignment.BottomCenter, onDismissRequest = onDismissed) {
        Card(modifier = Modifier.testTag("${testTagPrefix}_stance_coach")) {
            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(stringResource(R.string.stance_coach))
                TextButton(
                    onClick = onDismissed,
                    modifier = Modifier.testTag("${testTagPrefix}_stance_coach_dismiss"),
                ) {
                    Text(stringResource(R.string.stance_coach_dismiss))
                }
            }
        }
    }
}
