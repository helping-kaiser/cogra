// CoGra's signature interaction (design.md §8), as pure UI.
//
// The shape of the thing (design/guidelines/stance-control.md "The
// gesture"): a single target at rest. A tap blooms the pad — at one
// fixed spot, the lower centre of the viewport, whichever control
// opened it — and stages nothing; a press-and-hold of the platform's
// long-press timeout commits the modest positive default outright. The
// light gesture costs nothing and the held one spends: a tap is what a
// thumb gives by accident, so it opens the surface where a reader
// chooses. On the open pad the reader drags the field, a release leaves
// the pick standing and the pad open, and an explicit Set is what signs.
// Horizontal is valence, vertical is connection, the pad opens at the
// default (+0.10, +0.10), and the whole square stays reachable — corners
// included, because someone dragging to the far corner means it. The
// drawn field IS the value space; its geometry lives in
// StanceFieldGeometry.kt.
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
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
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoversSurface
import com.cogra.core.designsystem.v2.token.Space
import kotlinx.coroutines.flow.filterNotNull
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Which surface the control offers for picking (design.md §8.6), as the
 * design system's own vocabulary — `core:designsystem` holds no domain
 * types, so the feature module maps the stored preference onto this.
 */
enum class StanceInputSurface { PAD, SLIDERS, ENTRY }

/** Where the pad is: shut, or parked open. */
enum class StancePadMode {
    CLOSED,

    /**
     * Parked open by the tap that bloomed it. The field, the alternates
     * and the severance route live here — a surface that outlasts the
     * gesture, so every one of them is reachable by touch (design.md
     * §8.5, §8.6).
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
    /**
     * This open is the account's first-ever pad open, so the pad carries
     * the two coaching lines (stance-control.md "Teaching it").
     */
    val coaching: Boolean = false,
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
private const val RESTING_FACE = "🫥"

/**
 * Muted and translucent (`--opacity-resting-face`, design/readme.md §4 —
 * "the resting stance face at 40% opacity"). Deliberately NOT the 0.38
 * disabled opacity it looks like: the resting face is not a disabled
 * control, and the 2026-09-09 ruling that retired the second disabled
 * token kept this one for exactly that reason.
 */
private const val RESTING_FACE_ALPHA = 0.4f

/** How close to the viewport's edge an overlay is allowed to sit. */
private val PAD_MARGIN = 12.dp

/**
 * The pad's standoff from the viewport's lower edge — the bar where
 * one exists, the viewport edge otherwise; one number everywhere
 * (design/readme.md "Fixed elements", ruled 2026-09-10).
 */
private val PAD_BOTTOM = 16.dp

/** The pad's card, wide enough for the field and its lines of text. */
private val PAD_WIDTH = 288.dp

/**
 * What the resting target announces, in the order the reader needs it:
 * what it stances toward, where they stand on it, and only then what a
 * touch does (design.md §8.3; `TagPage` for the label).
 */
@Composable
private fun targetDescription(
    standing: StancePoint?,
    axes: StanceAxes,
    targetLabel: String?,
): String {
    val action = stringResource(R.string.stance_target_action)
    val withStanding = standing?.let {
        stringResource(
            R.string.stance_target_with_standing,
            stringResource(R.string.stance_standing),
            it.reading(axes),
            action,
        )
    } ?: action
    return targetLabel?.let { stringResource(R.string.stance_target_labelled, it, withStanding) }
        ?: withStanding
}

/**
 * The stance control: the resting target, the pad it blooms, and the
 * severance confirmation either can reach.
 *
 * [onOpenPad] is the tap: it parks the pad open and stages nothing.
 * [onHoldDefault] is the press-and-hold: it commits the low default
 * without opening anything. [onCommit] is the pad's own Set button and
 * reaches this file from nowhere else — a release never signs
 * (design/guidelines/stance-control.md "The gesture").
 */
@Composable
fun StanceControl(
    state: StanceControlState,
    onHoldDefault: () -> Unit,
    onOpenPad: () -> Unit,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onDismissPad: () -> Unit,
    onToggleExactValues: () -> Unit,
    onOpenSeverance: () -> Unit,
    onConfirmSeverance: () -> Unit,
    onDismissSeverance: () -> Unit,
    onConfirmationShown: () -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    /**
     * The record family's own words for the two slots it fills. The
     * control owns the geometry; the family owns the words, and they
     * are passed through unchanged to every readout and to the
     * alternates alike, so the drawn route and the accessible one never
     * name the same axis two ways.
     */
    axes: StanceAxes = StanceAxes.Opinion,
    /**
     * The family's words for reaching zero — every kind but a topic
     * severs; a topic disconnects (jakob's I2 ruling, copy-voice.md "the
     * topic disconnects").
     */
    zeroWords: StanceZeroWords = StanceZeroWords.Severed,
    /**
     * What this control stances toward, in the reader's own words —
     * `#saltmaps`, hash and all. Named because a page may carry more
     * than one stance control and the face's accessible name is what
     * says which is which (`TagPage`: "AND IT NAMES WHAT IT STANCES").
     * Null where the surrounding context already says it, which is
     * every control that sits inside the thing it stances toward.
     */
    targetLabel: String? = null,
    /**
     * Stretched to the column, as a page's one primary action rather
     * than an anchor inside a card (`TagPage`: "THE ROW IS THE PAGE'S
     * ONE ACTION"). Only the resting target widens — the pad is the
     * same surface wherever it was opened from.
     */
    wide: Boolean = false,
    /**
     * The control's data-node on a registered screen
     * (`feed.card.actionRow.stance`): the control, its resting target and
     * the target's face and pair then wear the registered paths. The pad
     * and the severance confirmation are not drawn on any registered
     * board, so they keep their [testTagPrefix] tags.
     */
    node: DataNode? = null,
) {
    val marginPx = with(LocalDensity.current) { PAD_MARGIN.roundToPx() }
    val bottomPx = with(LocalDensity.current) { PAD_BOTTOM.roundToPx() }
    // The pad is the same surface wherever it was opened from
    // (design.md §8.3), so it is placed by the window, not the target.
    val lowerCentre = remember(bottomPx, marginPx) { PadAtLowerCentre(bottomPx, marginPx) }
    val tapLabel = stringResource(R.string.stance_target)
    val holdLabel = stringResource(R.string.stance_target_hold)
    val exactLabel = stringResource(R.string.stance_pick_exactly)
    val severLabel = stringResource(zeroWords.open)
    val standingLabel = stringResource(R.string.stance_standing)
    val description = targetDescription(state.standing, axes, targetLabel)
    // THE WALK-AWAY NEEDS SOMETHING TO WALK BACK (`TagPageHeldPad`: the
    // pad over a topic nobody holds has three controls, the pad over a
    // held one has four). With nothing said there is no relationship to
    // leave, and the route led only to a confirmation saying so.
    //
    // A null standing IS the whole test, and it is the same test the web
    // control spells as `records > 0` (#760): the holder publishes the
    // fold's net only once the bundle covers a record, so unread and
    // unauthored both arrive here as null — and a bundle that HAS
    // records and nets to zero is severance, which stays reachable.
    val severable = state.standing != null

    StanceConfirmation(state.confirmation, standingLabel, axes, onConfirmationShown)
    // THE PAD AND THE SEVERANCE DIALOG SAY THEY ARE UP, wherever the control
    // stands — no surface that hosts one can forget to (the web's
    // `stance-control.tsx` and `severance-confirm.tsx` do the same). Over a
    // post's detail the pad PAUSES its clip and its closing resumes it
    // (PostDetailVideo.md:49/51); the dialog is a dialog over the post (:41).
    CoversSurface(open = state.pad != StancePadMode.CLOSED, kind = CoverKind.Pause)
    CoversSurface(open = state.severance != null, kind = CoverKind.Suspend)
    val anchor = node?.div("anchor")

    Column(modifier.dataNode(node)) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .sizeIn(minWidth = TARGET_MIN, minHeight = TARGET_MIN)
                .then(if (wide) Modifier.fillMaxWidth() else Modifier)
                .clip(RoundedCornerShape(50))
                .stanceGesture(
                    enabled = !state.busy,
                    onHoldDefault = onHoldDefault,
                    onOpenPad = onOpenPad,
                )
                // Colour never carries meaning alone, and a drag gesture
                // always has a non-drag equivalent (design.md §10): the
                // node reads as a button, double-tap opens the pad as a
                // tap does, double-tap-and-hold signs the default as a
                // hold does, and the alternates ride custom actions.
                // One node for the whole target: the face and the pair
                // inside it are a readout of what this description
                // already says in words, so they are absorbed rather
                // than announced again — an emoji read out by its own
                // name is noise (design.md §10).
                .semantics(mergeDescendants = true) {
                    role = Role.Button
                    contentDescription = description
                    onClick(label = tapLabel) {
                        onOpenPad()
                        true
                    }
                    onLongClick(label = holdLabel) {
                        onHoldDefault()
                        true
                    }
                    customActions = listOfNotNull(
                        CustomAccessibilityAction(exactLabel) {
                            onOpenPad()
                            if (!state.exactValues) onToggleExactValues()
                            true
                        },
                        // Offered on the same terms as the drawn route:
                        // an action that can only open a dialog saying
                        // there is nothing to walk back is not an action.
                        CustomAccessibilityAction(severLabel) {
                            onOpenSeverance()
                            true
                        }.takeIf { severable },
                    )
                }
                .testTag(anchor?.tag ?: "${testTagPrefix}_stance"),
        ) {
            StanceRestingFace(state.standing, testTagPrefix, anchor)

            // The pad is a child of the TARGET, not a sibling of it: that
            // is what ties its lifetime to the control's, so it cannot
            // outlive the surface that owns it. It takes only its
            // lifetime from the target, never its position (design.md
            // §8.3).
            if (state.pad != StancePadMode.CLOSED) {
                Popup(
                    popupPositionProvider = lowerCentre,
                    onDismissRequest = onDismissPad,
                    properties = PopupProperties(focusable = true),
                ) {
                    StancePadOverlay(
                        state = state,
                        onPick = onPick,
                        onCommit = onCommit,
                        onCancel = onDismissPad,
                        onToggleExactValues = onToggleExactValues,
                        onOpenSeverance = onOpenSeverance,
                        testTagPrefix = testTagPrefix,
                        axes = axes,
                        zeroWords = zeroWords,
                        targetLabel = targetLabel,
                        severable = severable,
                    )
                }
            }
        }

        // A refusal has to be visible even when the pad is shut, which is
        // where a hold fails.
        if (state.failed && state.pad == StancePadMode.CLOSED) {
            StanceFailure(state.needsKey, testTagPrefix)
        }

        state.severance?.let { prompt ->
            SeveranceConfirm(
                prompt = prompt,
                onConfirm = onConfirmSeverance,
                onDismiss = onDismissSeverance,
                testTagPrefix = testTagPrefix,
                axes = axes,
                zeroWords = zeroWords,
                targetLabel = targetLabel,
            )
        }
    }
}

/**
 * Tap versus hold, on one pointer stream (design/guidelines/
 * stance-control.md "The gesture"). A tap that lifts before the
 * platform's long-press timeout opens the pad and stages nothing; a
 * press held past it commits the low default without opening anything.
 * The timeout is the platform's own — 500ms on Android, the number the
 * table names — so the two clients ask the same of the same thumb.
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
 * **The hold signs once and owns the rest of its touch.** It fires under
 * the finger, so the lift that follows is consumed here too: the hold's
 * own release must never also reach the card, and must never read as a
 * tap that opens the pad on top of the signature. No path here reaches
 * [StanceControl]'s `onCommit` — the pad's own Set is the only way in.
 */
private fun Modifier.stanceGesture(
    enabled: Boolean,
    onHoldDefault: () -> Unit,
    onOpenPad: () -> Unit,
): Modifier = if (!enabled) {
    this
} else {
    pointerInput(Unit) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false).consume()
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
                held -> {
                    onHoldDefault()
                    waitForUpOrCancellation()?.consume()
                }
                up != null -> onOpenPad()
                else -> Unit
            }
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
): Modifier = if (!enabled) {
    this
} else {
    pointerInput(extentPx) {
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

@Composable
private fun StancePadOverlay(
    state: StanceControlState,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onToggleExactValues: () -> Unit,
    onOpenSeverance: () -> Unit,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    targetLabel: String?,
    severable: Boolean,
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
            // The coaching lines ride the first-ever open only; the `?` is
            // how anyone who opened the pad after that — or forgot — asks
            // again (stance-control.md "The gesture", "Teaching it").
            var explaining by rememberSaveable { mutableStateOf(false) }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    StanceStandingLine(state.standing, testTagPrefix, axes, zeroWords, targetLabel)
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
            // The help REPLACES the readouts and the input rather than
            // growing below them (StanceControl.jsx, StanceCoachMark.prompt.md):
            // the pad is parked and operated by muscle memory, and a panel
            // that pushes Set further from the thumb defeats the parking.
            // Appending it also grew the card past the window on a phone,
            // where PadAtLowerCentre's clamp gives up on the lower anchor
            // and snaps the whole pad to the top — the jump jakob saw.
            if (explaining) {
                StancePadHelp(
                    onBack = { explaining = false },
                    testTagPrefix = testTagPrefix,
                )
            } else {
                StanceReadout(state.pick, testTagPrefix, axes)
                // The chosen surface replaces the pad, it does not sit beside
                // it: an alternate is the input, not a second opinion
                // (design.md §8.6).
                if (state.inputMode == StanceInputSurface.PAD) {
                    StancePadField(state.pick, onPick = onPick, enabled = !state.busy)
                }
                // Between the field and the landing line, where the
                // master's `padNote` slot sits (`StanceControl.jsx`).
                if (state.coaching) StanceCoaching(testTagPrefix)
                StanceLandingLine(state.landing, testTagPrefix, axes, zeroWords)
            }
            // The alternates are the accessible path, so the way into
            // them is present whatever the stored preference is.
            if (!explaining && (state.exactValues || state.inputMode != StanceInputSurface.PAD)) {
                StanceExactValues(state.inputMode, state.pick, onPick, testTagPrefix, axes)
            }
            if (state.failed) {
                StanceFailure(state.needsKey, testTagPrefix)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    // Help can never be signed through: the field it
                    // explains is not on screen to check against.
                    onClick = onCommit,
                    enabled = !state.busy && !explaining,
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
            // to be findable from the open pad (design.md §8.5) —
            // and it stands only where there is something to walk
            // back, which is what makes the held pad's four controls
            // and the unheld pad's three (`TagPageHeldPad`).
            if (severable) {
                TextButton(
                    onClick = onOpenSeverance,
                    modifier = Modifier.testTag("${testTagPrefix}_stance_sever"),
                ) {
                    Text(stringResource(zeroWords.open))
                }
            }
        }
    }
}

/**
 * The pad's own help, standing in the field's place while it is up.
 *
 * Four lines, in the order a reader needs them
 * (`design/components/stance/StanceCoachMark.jsx`): what the field
 * means, what commits, why the three readouts differ, and what the way
 * out costs. The third is the one nobody can guess — that a pick ADDS
 * to what was said before — and it is why "Your pick" and the resulting
 * stance are two different numbers.
 */
@Composable
private fun StancePadHelp(onBack: () -> Unit, testTagPrefix: String) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("${testTagPrefix}_stance_explanation"),
    ) {
        listOf(
            R.string.stance_explain_field,
            R.string.stance_explain_commit,
            R.string.stance_explain_adds,
            R.string.stance_explain_sever,
        ).forEach { line ->
            Text(
                text = stringResource(line),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        TextButton(
            onClick = onBack,
            modifier = Modifier.testTag("${testTagPrefix}_stance_explain_back"),
        ) {
            Text(stringResource(R.string.stance_explain_back))
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
private fun StanceRestingFace(standing: StancePoint?, testTagPrefix: String, anchor: DataNode?) {
    if (standing == null) {
        Text(
            text = RESTING_FACE,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .alpha(RESTING_FACE_ALPHA)
                .testTag(anchor?.div("face")?.tag ?: "${testTagPrefix}_stance_empty_face"),
        )
        return
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
            .padding(horizontal = 12.dp, vertical = 8.dp)
            // The registered boards name the face and the pair, not the row
            // that holds them.
            .then(if (anchor == null) Modifier.testTag("${testTagPrefix}_stance_standing_face") else Modifier),
    ) {
        Text(
            text = standingReadout(standing).emoji,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.dataNode(anchor?.div("face")),
        )
        Text(
            text = standing.pair(),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.dataNode(anchor?.div("exact")),
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
    axes: StanceAxes,
    onShown: () -> Unit,
) {
    val host = LocalSnackbarHostState.current
    val message = rememberUpdatedState(
        confirmation?.let { stringResource(R.string.stance_signed, standingLabel, it.reading(axes)) },
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
private fun StanceStandingLine(
    standing: StancePoint?,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords = StanceZeroWords.Severed,
    targetLabel: String? = null,
) {
    val text = when {
        standing == null -> stringResource(R.string.stance_standing_none)
        // The zero bundle never speaks through the anchor table
        // (design.md §8.4): it is named, not read as a near neighbour.
        standing.isZeroBundle -> stringResource(zeroWords.standingZero, targetLabel.orEmpty())
        else -> "${stringResource(R.string.stance_standing)}: ${standing.reading(axes)}"
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
private fun StanceReadout(pick: StancePoint, testTagPrefix: String, axes: StanceAxes) {
    val anchor = nearestStanceAnchor(pick)
    val words = stringResource(anchor.label)
    val spoken = pick.reading(axes)
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
private fun StanceLandingLine(
    landing: StanceLanding?,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords = StanceZeroWords.Severed,
) {
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
        landing.severance -> stringResource(zeroWords.reached)
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
    val spoken = "$caption: ${landing.net.reading(axes)}. $words"
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
 *
 * Public because every surface that shows a pair owes the reader this
 * announcement, and the reply seal is outside this module — a second
 * copy of the wording there is exactly the drift a design system exists
 * to prevent.
 */
@Composable
fun StancePoint.reading(axes: StanceAxes = StanceAxes.Opinion): String = stringResource(
    R.string.stance_reading,
    stringResource(axes.directed),
    twoPlaces(directed),
    stringResource(axes.interest),
    twoPlaces(interest),
)

/**
 * The bare pair, `+0.40 / +0.20`-style (design.md §8.3). Compact because
 * it sits under a face and a field that already say which axis is which;
 * every place it is shown names the axes in its accessibility text.
 *
 * Public for the same reason [reading] is: the reply seal writes the
 * same pair, and one wording is what keeps two surfaces one language.
 */
@Composable
fun StancePoint.pair(): String =
    stringResource(R.string.stance_pair, twoPlaces(directed), twoPlaces(interest))

/**
 * A dimension as the reader reads numbers: always signed, two decimals.
 * The sign carries the direction, so it is shown even at zero — but a
 * value that ROUNDS to zero has no direction to report, and `-0.00`
 * reads as a broken control rather than as a precise one.
 *
 * Public for the same reason [pair] is: the references sheet spells the
 * same numbers in its rows' spoken readings, and one formatter is what
 * keeps two surfaces writing one number.
 */
fun twoPlaces(value: Double): String {
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
    axes: StanceAxes,
) {
    val directedLabel = stringResource(axes.directed)
    val interestLabel = stringResource(axes.interest)
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
 * THE PAD IS THE TEACHER (stance-control.md "Teaching it"; copy-voice.md
 * "The first-ever pad teaches in two coaching lines, and nothing else
 * teaches it"). The tap that opens the pad costs nothing, so the reader
 * finds the considered route on their own; what is left to teach is the
 * shortcut. The account's first-ever pad open carries these two lines,
 * between the field and the landing line (`StanceControl.jsx`'s
 * `padNote` slot); they close with the pad and never show again.
 *
 * The face is drawn and the digits are not: the coaching's exact pair
 * shows only for a reader who asked for exact values, and its spoken
 * twin says the face and the pair either way (`VouchBackPad`). Neither
 * client has that reading preference yet, so the drawn line is the
 * default reading's.
 */
@Composable
private fun StanceCoaching(testTagPrefix: String) {
    val shortcut = stringResource(R.string.stance_coaching_shortcut)
    val shortcutSpoken = stringResource(R.string.stance_coaching_shortcut_spoken)
    Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("${testTagPrefix}_stance_coaching"),
    ) {
        Text(
            text = shortcut,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.semantics { contentDescription = shortcutSpoken },
        )
        Text(
            text = stringResource(R.string.stance_coaching_set),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
