// CoGra's signature interaction (design.md §8), as pure UI.
//
// The shape of the thing: a single tap target at rest, a plain tap
// commits the modest positive default, and a press-and-hold blooms a
// pad — at one fixed spot, the lower centre of the viewport, whichever
// control opened it — that the reader drifts across. Releasing leaves
// the pick standing and the pad open, and the field goes on taking
// drags for as long as it stands; an explicit Set is what signs.
// Horizontal is valence, vertical is connection, the pad opens at the
// origin, and the whole square stays reachable — corners included,
// because someone dragging to the far corner means it. The drawn field
// IS the value space; its geometry lives in StanceFieldGeometry.kt.
//
// The control owns its touches: nothing it is given may also reach the
// surface underneath it (design.md §8.3).
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
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
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
import com.cogra.core.designsystem.v2.token.Space
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import java.util.Locale
import kotlin.math.roundToInt
import kotlinx.coroutines.flow.filterNotNull

/**
 * Which surface the control offers for picking (design.md §8.6), as the
 * design system's own vocabulary — `core:designsystem` holds no domain
 * types, so the feature module maps the stored preference onto this.
 */
enum class StanceInputSurface { PAD, SLIDERS, ENTRY }

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
    /**
     * The RAW sums the batch has to walk back, before the clip. This is
     * what the confirmation states: the count of signed acts is sized by
     * the raw history, so quoting the clipped fold beside it — `+1.00`
     * next to "6 actions" — makes the price unexplainable (design.md
     * §8.3 "Clipped is not hidden").
     */
    val raw: StancePoint,
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
    /** The reader's chosen input surface (design.md §8.6). */
    val inputMode: StanceInputSurface = StanceInputSurface.PAD,
    val severance: SeverancePrompt? = null,
    /** The one-time teaching mark for the held gesture (design.md §8.7). */
    val coachMark: Boolean = false,
    /**
     * A stance just signed, as the standing it left the reader at — the
     * transient confirmation of design.md §8.3. A one-shot: the control
     * shows it once and reports it back through `onConfirmationShown`.
     */
    val confirmation: StancePoint? = null,
)

/** The resting target keeps the platform's minimum (design.md §4, §10). */
private val TARGET_MIN = 48.dp

/**
 * The face an unauthored target wears (design.md §8.3). Deliberately a
 * face the readout table never produces, so an empty control can never
 * be misread as a standing the reader already holds — it is the shape of
 * a face with nothing in it yet, which is exactly the state it reports.
 */
private const val RESTING_FACE = "😐"

/** Muted and translucent: M3's own disabled-content opacity. */
private const val RESTING_FACE_ALPHA = 0.38f

/** How far an overlay stands off the target it belongs to. */
private val PAD_GAP = 8.dp

/** How close to the viewport's edge an overlay is allowed to sit. */
private val PAD_MARGIN = 12.dp

/**
 * The pad's standoff from the viewport's lower edge — enough that the
 * card clears the gesture-navigation strip and sits in the thumb's
 * comfortable arc rather than at the very bottom of the reach.
 */
private val PAD_BOTTOM = 24.dp

/** The pad's card, wide enough for the field and its lines of text. */
private val PAD_WIDTH = 288.dp

/**
 * The stance control: the resting target, the pad it blooms, and the
 * severance confirmation either can reach.
 *
 * [onHold] fires when a held gesture ends — drifted or not. The pad
 * parks open with the pick standing rather than committing it, which is
 * what makes Set the only signature and keeps the alternates and the
 * severance route reachable by touch at all (design.md §8.3, §8.5).
 * [onCommit] therefore reaches this file from the pad's own Set button
 * and from nowhere else.
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
    onConfirmationShown: () -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
) {
    val extentPx = with(LocalDensity.current) { FIELD_EXTENT.toPx() }
    val gapPx = with(LocalDensity.current) { PAD_GAP.roundToPx() }
    val marginPx = with(LocalDensity.current) { PAD_MARGIN.roundToPx() }
    val bottomPx = with(LocalDensity.current) { PAD_BOTTOM.roundToPx() }
    // Two placements, because the two overlays mean different things: the
    // coach mark points at one target, the pad is the same surface
    // wherever it was opened from (design.md §8.3, §8.7).
    val besideTarget = remember(gapPx, marginPx) { PadBesideTarget(gapPx, marginPx) }
    val lowerCentre = remember(bottomPx, marginPx) { PadAtLowerCentre(bottomPx, marginPx) }
    val tapLabel = stringResource(R.string.stance_target)
    val exactLabel = stringResource(R.string.stance_pick_exactly)
    val severLabel = stringResource(R.string.stance_severance_open)
    val action = stringResource(R.string.stance_target_action)
    val standingLabel = stringResource(R.string.stance_standing)
    // A target that already carries a standing says so before it says
    // what a touch does (design.md §8.3).
    val description = state.standing?.let {
        stringResource(R.string.stance_target_with_standing, standingLabel, it.reading(), action)
    } ?: action

    StanceConfirmation(state.confirmation, standingLabel, onConfirmationShown)

    Column(modifier) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .sizeIn(minWidth = TARGET_MIN, minHeight = TARGET_MIN)
                .clip(RoundedCornerShape(50))
                .stanceGesture(
                    enabled = !state.busy,
                    // An alternate replaces the pad, so the hold has no
                    // field to drift across: it parks the chosen surface
                    // open instead (design.md §8.6).
                    drifts = state.inputMode == StanceInputSurface.PAD,
                    extentPx = extentPx,
                    onTapDefault = onTapDefault,
                    onOpenPad = onOpenPad,
                    onPick = onPick,
                    onHold = onHold,
                    onCancel = onDismissPad,
                )
                // Colour never carries meaning alone, and a drag gesture
                // always has a non-drag equivalent (design.md §10): the
                // node reads as a button, double-tap commits the
                // default, and the alternates ride custom actions.
                // One node for the whole target: the face and the pair
                // inside it are a readout of what this description
                // already says in words, so they are absorbed rather
                // than announced again — an emoji read out by its own
                // name is noise (design.md §10).
                .semantics(mergeDescendants = true) {
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
            StanceRestingFace(state.standing, testTagPrefix)

            // Both overlays are children of the TARGET, not siblings of
            // it: that is what ties their lifetime to the control's, so
            // neither can outlive the surface that owns it. The coach
            // mark also takes its POSITION from the target; the pad
            // takes only its lifetime (design.md §8.3, §8.7).
            if (state.coachMark) {
                StanceCoachMark(
                    positionProvider = besideTarget,
                    onDismissed = onCoachMarkDismissed,
                    testTagPrefix = testTagPrefix,
                )
            }

            if (state.pad != StancePadMode.CLOSED) {
                val sticky = state.pad == StancePadMode.STICKY
                Popup(
                    popupPositionProvider = lowerCentre,
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
        }

        // A refusal has to be visible even when the pad is shut, which is
        // where a plain tap fails.
        if (state.failed && state.pad == StancePadMode.CLOSED) {
            StanceFailure(state.needsKey, testTagPrefix)
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
 *
 * **The control owns its touches** (design.md §8.3). The down is
 * consumed the moment it arrives, which is what stops the surface
 * underneath — a post card whose whole body opens the post — from
 * reading the same gesture: `Modifier.clickable` takes its down with
 * `awaitFirstDown(requireUnconsumed = true)` and skips one already
 * spoken for. Consuming the down does NOT cost the enclosing list its
 * scroll: a scroll container claims the drag on pointer slop, and the
 * movement inside the long-press window is left unconsumed for exactly
 * that, so a finger that starts here and travels still scrolls the feed
 * — and this gesture then reads the cancellation and stages nothing.
 *
 * **Releasing never commits** (design.md §8.3). A release leaves the
 * pick standing and the pad parked open; only Set signs. An accidental
 * lift must never sign a priced act, so no path here reaches
 * [onCommit] — the pad's own button is the only way in.
 */
private fun Modifier.stanceGesture(
    enabled: Boolean,
    drifts: Boolean,
    extentPx: Float,
    onTapDefault: () -> Unit,
    onOpenPad: () -> Unit,
    onPick: (StancePoint) -> Unit,
    onHold: () -> Unit,
    onCancel: () -> Unit,
): Modifier = if (!enabled) this else pointerInput(extentPx, drifts) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        down.consume()
        var held = false
        val up = try {
            withTimeout(viewConfiguration.longPressTimeoutMillis) {
                waitForUpOrCancellation()
            }
        } catch (_: PointerEventTimeoutCancellationException) {
            held = true
            null
        }
        up?.consume()
        when {
            held && !drifts -> {
                onOpenPad()
                onHold()
            }
            held -> {
                onOpenPad()
                var travel = Offset.Zero
                val completed = drag(down.id) { change ->
                    travel += change.positionChange()
                    change.consume()
                    onPick(stancePointFromTravel(travel, extentPx))
                }
                // A release parks the pad with the pick standing; only a
                // genuine cancellation stages nothing.
                if (completed) onHold() else onCancel()
            }
            up != null -> onTapDefault()
            else -> Unit
        }
    }
}

/**
 * The open pad's own drag, on the field itself.
 *
 * The pad outlives the gesture that opened it — release parks it with the
 * pick standing and only Set signs (design.md §8.3) — so the field has to
 * accept drags of its own, as many as the reader likes, or the knob is
 * frozen the moment the finger lifts. The launching gesture and this one
 * are the same rule with a different starting point: **accumulated
 * travel**, here from the pick already standing rather than from the
 * origin, so the knob never jumps to the finger and one dp of travel is
 * one dp of knob either way.
 *
 * **The control owns its touches** (design.md §8.3), on this path too:
 * the down is consumed as it arrives and every move with it, so a drag
 * meant for the field can reach neither the surface behind the pad nor
 * the scrolling column the field sits in — the field IS the value space,
 * and a vertical drag across it is connection, not a scroll.
 */
private fun Modifier.fieldGesture(
    enabled: Boolean,
    extentPx: Float,
    pick: State<StancePoint>,
    onPick: State<(StancePoint) -> Unit>,
): Modifier = if (!enabled) this else pointerInput(extentPx) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        down.consume()
        // Read once, at the down: the base is what was standing when this
        // drag began, and the picks it reports must not feed back into it.
        val base = pick.value
        var travel = Offset.Zero
        drag(down.id) { change ->
            travel += change.positionChange()
            change.consume()
            onPick.value(stancePointFrom(base, travel, extentPx))
        }
    }
}

/**
 * The pad's one fixed spot: **the lower centre of the viewport**
 * (design.md §8.3), the same place every time regardless of which
 * control opened it.
 *
 * Muscle memory is part of the control. A pad that appears somewhere new
 * on every press cannot be operated without looking, and the thumb
 * cannot learn a target that moves — so the anchor is deliberately
 * ignored here, and only the window matters.
 *
 * `windowSize` is the window's visible frame, so the clamp already keeps
 * clear of the system bars; [bottomPx] is the thumb-comfort standoff
 * from its lower edge.
 */
internal class PadAtLowerCentre(
    private val bottomPx: Int,
    private val marginPx: Int,
) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset = IntOffset(
        x = clamp(
            (windowSize.width - popupContentSize.width) / 2,
            popupContentSize.width,
            windowSize.width,
        ),
        y = clamp(
            windowSize.height - popupContentSize.height - bottomPx,
            popupContentSize.height,
            windowSize.height,
        ),
    )

    /** Fully inside, margin included — unless the content is bigger than the window. */
    private fun clamp(value: Int, contentSize: Int, windowSize: Int): Int =
        value.coerceIn(marginPx, maxOf(marginPx, windowSize - contentSize - marginPx))
}

/**
 * Places an overlay BESIDE the resting target rather than over it, and
 * fully inside the viewport (design.md §8.7). The coach mark's
 * placement: it explains one particular target, so it has to point at
 * it — unlike the pad, which is the same surface wherever it was opened
 * from.
 *
 * So: horizontally centred on the target, vertically in whichever gap
 * holds it — above by preference, below when the target sits near the
 * top — and clamped into the window with a margin either way.
 *
 * `windowSize` is the window's visible frame, so the clamp already keeps
 * clear of the system bars.
 */
internal class PadBesideTarget(
    private val gapPx: Int,
    private val marginPx: Int,
) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val above = anchorBounds.top - gapPx - popupContentSize.height
        val below = anchorBounds.bottom + gapPx
        val roomAbove = anchorBounds.top - gapPx - marginPx
        val roomBelow = windowSize.height - anchorBounds.bottom - gapPx - marginPx
        val y = when {
            popupContentSize.height <= roomAbove -> above
            popupContentSize.height <= roomBelow -> below
            // Taller than either gap: take the roomier side and clamp.
            // The pad scrolls, so on-screen beats beside-the-target.
            roomAbove >= roomBelow -> above
            else -> below
        }
        return IntOffset(
            x = clamp(
                anchorBounds.center.x - popupContentSize.width / 2,
                popupContentSize.width,
                windowSize.width,
            ),
            y = clamp(y, popupContentSize.height, windowSize.height),
        )
    }

    /** Fully inside, margin included — unless the content is wider than the window. */
    private fun clamp(value: Int, contentSize: Int, windowSize: Int): Int =
        value.coerceIn(marginPx, maxOf(marginPx, windowSize - contentSize - marginPx))
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
    val explainLabel = stringResource(R.string.stance_explain)
    Card(modifier = Modifier.width(PAD_WIDTH).testTag("${testTagPrefix}_stance_pad")) {
        Column(
            // A parked pad carries its alternates and the severance
            // route, which is more than a short screen holds upright.
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // The coach mark is a one-time thing and it is spent on the
            // first hold; the `?` is how anyone who met the control after
            // that — or forgot — asks again (design.md §8.3, §8.7).
            var explaining by rememberSaveable { mutableStateOf(false) }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    StanceStandingLine(state.standing, testTagPrefix)
                }
                TextButton(
                    onClick = { explaining = !explaining },
                    modifier = Modifier
                        .semantics { contentDescription = explainLabel }
                        .testTag("${testTagPrefix}_stance_explain"),
                ) {
                    Text("?", style = MaterialTheme.typography.titleMedium)
                }
            }
            if (explaining) {
                Text(
                    text = stringResource(R.string.stance_explain_body),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.testTag("${testTagPrefix}_stance_explanation"),
                )
            }
            StanceReadout(state.pick, testTagPrefix)
            // The chosen surface replaces the pad, it does not sit beside
            // it: an alternate is the input, not a second opinion
            // (design.md §8.6).
            if (state.inputMode == StanceInputSurface.PAD) {
                StancePadField(state.pick, onPick = onPick, enabled = !state.busy)
            }
            StanceLandingLine(state.landing, testTagPrefix)
            if (sticky) {
                // The alternates are the accessible path, so the way into
                // them is present whatever the stored preference is.
                if (state.exactValues || state.inputMode != StanceInputSurface.PAD) {
                    StanceExactValues(state.inputMode, state.pick, onPick, testTagPrefix)
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
                if (state.inputMode == StanceInputSurface.PAD) {
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

/**
 * What the resting target reads as (design.md §8.3). A viewer with a
 * bundle toward the thing sees its face and folded pair right there; a
 * viewer without one sees a **muted, translucent face** — the same
 * control at rest, visibly waiting to be given a value.
 *
 * Never a bare word. A button that says "Stance" says the same thing
 * whatever you have already told it, which is a mystery button — and the
 * bundle is already loaded by the read that rendered the surface, so
 * showing it costs nothing. The empty face is the same shape as the full
 * one, so the control does not change identity the moment it is used.
 *
 * The whole target is one semantics node carrying the label, so no half
 * of this is announced separately and nothing here is read out as an
 * emoji's own name.
 */
@Composable
private fun StanceRestingFace(standing: StancePoint?, testTagPrefix: String) {
    if (standing == null) {
        Text(
            text = RESTING_FACE,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .alpha(RESTING_FACE_ALPHA)
                .testTag("${testTagPrefix}_stance_empty_face"),
        )
        return
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .testTag("${testTagPrefix}_stance_standing_face"),
    ) {
        Text(
            text = standingReadout(standing).emoji,
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            text = standing.pair(),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

/**
 * The transient signed-confirmation of design.md §8.3, on the platform's
 * standard surface. A gesture that stages a priced act must never be
 * silent — silence reads as failure and invites the same act again.
 *
 * The one-shot has to be CONSUMED so a recomposition cannot repeat it,
 * and consuming it clears the very state that describes it. Keying the
 * effect on that state is therefore a trap: consuming would restart the
 * effect and cancel the suspending `showSnackbar` call that had only
 * just begun, so the snackbar is torn down in the same frame it was
 * posted and nothing is ever seen. That is not visible in a test that
 * holds the state still — only where the consume actually round-trips
 * through the state holder, which is every real screen.
 *
 * So the effect is keyed on the HOST, which outlives any one
 * confirmation, and the confirmations arrive through a snapshot flow.
 * Consuming inside it cannot cancel it.
 */
@Composable
private fun StanceConfirmation(
    confirmation: StancePoint?,
    standingLabel: String,
    onShown: () -> Unit,
) {
    val host = LocalSnackbarHostState.current
    val message = rememberUpdatedState(
        confirmation?.let { stringResource(R.string.stance_signed, standingLabel, it.reading()) },
    )
    val consume = rememberUpdatedState(onShown)
    LaunchedEffect(host) {
        snapshotFlow { message.value }
            .filterNotNull()
            .collect { text ->
                // Spent before the wait: a surface with no host still
                // consumes it, and a snackbar that lingers never fires
                // the same confirmation twice.
                consume.value()
                host?.showSnackbar(text)
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
        // The zero bundle never speaks through the anchor table
        // (design.md §8.4): it is named, not read as a near neighbour.
        standing.isZeroBundle -> stringResource(R.string.stance_standing_zero)
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
 * The face, its words, and the exact pair, sitting above the pad rather
 * than under the knob — a thumb on the control covers exactly the spot
 * where feedback would otherwise appear (design.md §8.4).
 *
 * All three are the default reading (design.md §8.3): the face carries
 * the feel and the pair carries the fact, and hiding either makes the
 * other harder to trust. The pair is written compactly, because the
 * field itself is what names the axes — but it is ANNOUNCED with them
 * in words, so no reader is handed a bare pair to decode.
 */
@Composable
private fun StanceReadout(pick: StancePoint, testTagPrefix: String) {
    val anchor = nearestStanceAnchor(pick)
    val words = stringResource(anchor.label)
    val spoken = pick.reading()
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
        Text(
            text = pick.pair(),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .semantics { contentDescription = spoken }
                .testTag("${testTagPrefix}_stance_exact_pair"),
        )
    }
}

/**
 * The four words the field's edges carry, where a surface teaches the
 * axes on the field itself rather than beside it.
 *
 * `ReplyPad` draws them — the seal has no anchors row to learn the axes
 * from, so the field says which way is which — and the bloomed stance
 * control does not, because its readout, anchors and landing line
 * already name both axes in words.
 */
@Immutable
data class StanceFieldLabels(
    val start: String,
    val end: String,
    val top: String,
    val bottom: String,
)

/**
 * The stance field, as every surface that offers a two-axis pick draws
 * it: 240dp at the 16dp rung, the inert centre-lines visible, the knob
 * at the pick.
 *
 * One field, two callers — the bloomed [StanceControl] and the reply
 * seal's `ReplyPad`. They differ only in whether the edges carry
 * [labels]: a second field drawn to a second knob would be exactly the
 * drift a design system exists to prevent.
 */
@Composable
fun StancePadField(
    pick: StancePoint,
    onPick: (StancePoint) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    labels: StanceFieldLabels? = null,
    testTag: String = "stance_field",
) {
    val ground = MaterialTheme.colorScheme.surfaceVariant
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        StanceFieldCanvas(pick = pick, enabled = enabled, onPick = onPick, testTag = testTag)
        if (labels != null) {
            // The edge words sit on the field's own ground so they read as
            // part of it rather than as four labels floating over a square.
            StanceEdgeLabel(labels.start, Alignment.CenterStart, ground)
            StanceEdgeLabel(labels.end, Alignment.CenterEnd, ground)
            StanceEdgeLabel(labels.top, Alignment.TopCenter, ground)
            StanceEdgeLabel(labels.bottom, Alignment.BottomCenter, ground)
        }
    }
}

@Composable
private fun BoxScope.StanceEdgeLabel(text: String, at: Alignment, ground: Color) {
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

/**
 * The field: a soft rounded square whose own box is the value space,
 * with its inert centre-lines drawn as visibly dead rather than hidden,
 * and the knob at the pick — never outside the drawing (design.md §8.3).
 *
 * It takes drags of its own, because the pad outlives the gesture that
 * opened it: release parks the pad with the pick standing, and the knob
 * stays repositionable until Set signs or Cancel dismisses (design.md
 * §8.3). A field that only moved under the launching gesture would freeze
 * the moment the finger lifted.
 */
@Composable
private fun StanceFieldCanvas(
    pick: StancePoint,
    enabled: Boolean,
    onPick: (StancePoint) -> Unit,
    testTag: String,
) {
    val ground = MaterialTheme.colorScheme.surfaceVariant
    val dead = MaterialTheme.colorScheme.outlineVariant
    val knob = MaterialTheme.colorScheme.primary
    val knobRing = MaterialTheme.colorScheme.onPrimary
    val extentPx = with(LocalDensity.current) { FIELD_EXTENT.toPx() }
    // The gesture is keyed on the extent alone, so it survives every pick
    // it reports; these are what let it read the current pick and the
    // current callback without being restarted mid-drag — the documented
    // way to hold a changing lambda inside `pointerInput`.
    val standing = rememberUpdatedState(pick)
    val report = rememberUpdatedState(onPick)
    // The bloom: M3 standard easing over a short duration. Compose scales
    // every animation by the platform's own animator duration scale, so
    // "remove animations" is honoured without a branch here (design.md §4).
    val bloom = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        bloom.animateTo(1f, tween(durationMillis = 200, easing = FastOutSlowInEasing))
    }
    Canvas(
        modifier = Modifier
            .size(FIELD_SIZE)
            // Outside the bloom's layer: the drag is measured in travel,
            // and a half-grown field would otherwise scale that travel.
            .fieldGesture(enabled, extentPx, standing, report)
            // The bloom scales the whole field, knob included, so the
            // knob is inside the drawing at every frame of it and not
            // only once it has finished growing.
            .graphicsLayer {
                scaleX = bloom.value
                scaleY = bloom.value
            }
            .testTag(testTag),
    ) {
        drawStanceField(
            pick = pick,
            ground = ground,
            dead = dead,
            knob = knob,
            knobRing = knobRing,
            cornerPx = FIELD_CORNER.toPx(),
            knobPx = KNOB_RADIUS.toPx(),
            dotPx = KNOB_DOT_RADIUS.toPx(),
            extentPx = FIELD_EXTENT.toPx(),
        )
    }
}

private fun DrawScope.drawStanceField(
    pick: StancePoint,
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
    val side = size.minDimension
    drawRoundRect(
        color = ground,
        topLeft = Offset(centre.x - side / 2f, centre.y - side / 2f),
        size = Size(side, side),
        cornerRadius = CornerRadius(cornerPx),
    )
    // Dead ground: a bundle whose folded parameter is zero carries
    // nothing, so the centre-lines are drawn rather than hidden. They
    // stop at the field's edge, because the field is the value space.
    val band = side * 0.02f
    val half = side / 2f
    drawLine(
        dead,
        Offset(centre.x - half, centre.y),
        Offset(centre.x + half, centre.y),
        strokeWidth = band,
    )
    drawLine(
        dead,
        Offset(centre.x, centre.y - half),
        Offset(centre.x, centre.y + half),
        strokeWidth = band,
    )
    val at = centre + knobOffset(pick, extentPx)
    drawCircle(color = knobRing, radius = knobPx, center = at)
    drawCircle(color = knob, radius = dotPx, center = at)
}

/**
 * The second number: where the pick leaves the bundle. It carries the
 * same three things the readout above it does — **face, words, and the
 * exact pair** (design.md §8.3) — because the landing is what the
 * reader is actually deciding about, and a bare number is not a reading.
 *
 * Inertness and severance are named in words, never left to the reader
 * to infer from a value (design.md §8.2), and a landing on the zero
 * bundle takes the shrug rather than the table's nearest neighbour
 * (design.md §8.4).
 *
 * It updates under the drag with no round trip: the fold is local
 * arithmetic on numbers the surface was already served, so there is
 * nothing here to wait for and no spinner to show.
 */
@Composable
private fun StanceLandingLine(landing: StanceLanding?, testTagPrefix: String) {
    if (landing == null) {
        Text(
            text = stringResource(R.string.stance_landing_working),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("${testTagPrefix}_stance_landing"),
        )
        return
    }
    val readout = standingReadout(landing.net)
    val words = when {
        landing.severance -> stringResource(R.string.stance_severance_reached)
        landing.inertDirected && landing.inertInterest ->
            stringResource(R.string.stance_carries_nothing)
        landing.inertDirected -> stringResource(R.string.stance_carries_nothing_directed)
        landing.inertInterest -> stringResource(R.string.stance_carries_nothing_interest)
        else -> stringResource(readout.label)
    }
    val caption = stringResource(R.string.stance_landing)
    // One node, announced once and in words: the face is a readout of a
    // pair that is spoken in full beside it, so its own emoji name would
    // be noise (design.md §10).
    val spoken = "$caption: ${landing.net.reading()}. $words"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .semantics(mergeDescendants = true) { contentDescription = spoken }
            .testTag("${testTagPrefix}_stance_landing"),
    ) {
        Text(text = readout.emoji, style = MaterialTheme.typography.titleMedium)
        Column {
            Text(
                text = words,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "$caption: ${landing.net.pair()}",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.testTag("${testTagPrefix}_stance_landing_pair"),
            )
        }
    }
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

/**
 * The bare pair, `+0.40 / +0.20`-style (design.md §8.3). Compact because
 * it sits under a face and a field that already say which axis is which;
 * every place it is shown names the axes in its accessibility text.
 */
@Composable
internal fun StancePoint.pair(): String =
    stringResource(R.string.stance_pair, twoPlaces(directed), twoPlaces(interest))

/**
 * A dimension as the reader reads numbers: always signed, two decimals.
 * The sign carries the direction, so it is shown even at zero — but a
 * value that ROUNDS to zero has no direction to report, and `-0.00`
 * reads as a broken control rather than as a precise one.
 */
internal fun twoPlaces(value: Double): String {
    val rounded = (value * 100).roundToInt() / 100.0
    return String.format(Locale.getDefault(), "%+.2f", if (rounded == 0.0) 0.0 else rounded)
}

/**
 * The direct-entry field's text. Root locale, not the reader's: this one
 * has to survive a round trip through [String.toDoubleOrNull], and a
 * decimal comma would not.
 */
private fun entryText(value: Double): String = String.format(Locale.ROOT, "%.2f", value)

/**
 * The alternates (design.md §8.6): paired sliders and direct entry, the
 * same machinery on a surface a screen-reader or switch user can drive.
 *
 * Which of the two shows follows the reader's chosen input: an alternate
 * they picked is the input, so it stands alone. While the pad is still
 * the chosen input neither has been picked, so both are offered.
 */
@Composable
private fun StanceExactValues(
    mode: StanceInputSurface,
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
        if (mode != StanceInputSurface.ENTRY) {
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
        }
        if (mode != StanceInputSurface.SLIDERS) {
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
 * The teaching mark of design.md §8.7: the FIRST tap on a stance target
 * opens it instead of acting, and it stays until the reader dismisses it
 * or completes their first hold.
 *
 * Two things it must not do. It must not vanish on the next touch — a
 * popup that dismisses on any outside click is gone before the sentence
 * is read, and the touch that spawned it counts as one — so nothing but
 * the explicit dismissal closes it. And it must not sit over the feed:
 * it is anchored beside the target it explains, clamped on-screen, by
 * the same provider the pad uses.
 */
@Composable
private fun StanceCoachMark(
    positionProvider: PopupPositionProvider,
    onDismissed: () -> Unit,
    testTagPrefix: String,
) {
    Popup(
        popupPositionProvider = positionProvider,
        properties = PopupProperties(dismissOnBackPress = false, dismissOnClickOutside = false),
    ) {
        Card(
            modifier = Modifier
                .widthIn(max = PAD_WIDTH)
                .testTag("${testTagPrefix}_stance_coach"),
        ) {
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
