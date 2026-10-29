// The thin route that binds the design system's stance control to its
// state holder (android/CLAUDE.md "Stateless screens"). Host surfaces —
// post cards, comments, profiles — drop this in and pass the target.

package com.cogra.feature.stance

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EmptySignPrompt
import com.cogra.core.designsystem.SeverancePrompt
import com.cogra.core.designsystem.StanceAxes
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StanceControlState
import com.cogra.core.designsystem.StanceInputSurface
import com.cogra.core.designsystem.StanceLanding
import com.cogra.core.designsystem.StancePadMode
import com.cogra.core.designsystem.StancePadVariant
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.StanceZeroWords
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.stance.isEmptySign

/**
 * The stance control for one [target]. The view model is scoped to the
 * destination, so every control on a screen shares one holder and one
 * map of per-target state.
 *
 * [onRequireAccount] is the guest gate: non-null means the reader is
 * signed out, and every gesture that would stage a priced act raises it
 * instead — ask, never bounce (design.md §6). The FACE is not gated,
 * because a signed-out reader has no bundle and so wears the same
 * no-standing affordance a signed-in reader with nothing said wears;
 * what a guest must not reach is the signing, not the page.
 */
@Composable
fun StanceControlRoute(
    target: StanceTarget,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    axes: StanceAxes = StanceAxes.Opinion,
    /**
     * The family's words for reaching zero — every kind but a topic
     * severs; a topic disconnects (jakob's I2 ruling, copy-voice.md "the
     * topic disconnects").
     */
    zeroWords: StanceZeroWords = StanceZeroWords.Severed,
    targetLabel: String? = null,
    wide: Boolean = false,
    onRequireAccount: (() -> Unit)? = null,
    /** The control's data-node on a registered screen; see [StanceControl]. */
    node: DataNode? = null,
    /** The pad opened as something in particular (the vouch-back); see [StancePadVariant]. */
    variant: StancePadVariant? = null,
    /**
     * The host is the opening gesture (the vouch card's `Vouch back`): the
     * pad opens with the route, no resting target is drawn, and
     * [onPadClosed] hears it close with nothing taken.
     */
    padOnly: Boolean = false,
    onPadClosed: (() -> Unit)? = null,
    /**
     * A signing on [target] was taken — by Set or by the hold. The host
     * routes on (the ceremony), so the control's own confirmation does not
     * also answer: the ceremony replaces it (VouchBackPad.md:33).
     */
    onTaken: (() -> Unit)? = null,
    /** The vouch card's empty face is a line face in this ink; see [StanceControl]. */
    lineFaceInk: Color? = null,
    /**
     * The opinion vouches its target in (approving, a vouch asked for): an
     * empty sign's ask warns that they start out cut off, and `Set it anyway`
     * still vouches them in. See [StanceControl].
     */
    vouchesIn: Boolean = false,
    viewModel: StanceViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    // A guest has no bundle to read, and asking for one costs a refused
    // round trip plus the guard's wasted token refresh on every control
    // the page holds.
    LaunchedEffect(target, onRequireAccount) {
        if (onRequireAccount == null) viewModel.observe(target)
    }
    // Leaving the screen dismisses the pad and stages nothing
    // (design.md §8.3). The pad is a popup — its own window, drawn over
    // whatever the app navigates to — and the holder outlives the
    // composition, so without this a pad left open bleeds over the next
    // destination and is still open on the way back. The lifecycle here
    // is the destination's own back-stack entry, so this fires when the
    // screen is covered, not when a card scrolls out of view.
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        viewModel.onDismissPad(target)
    }
    val entry = state.targets[target] ?: TargetStance()
    if (padOnly) {
        LaunchedEffect(target) { viewModel.onOpenPad(target) }
        // Closed once it has been open: Cancel, the wash, or a taken
        // signing — the host stops drawing the pad either way.
        var opened by remember(target) { mutableStateOf(false) }
        LaunchedEffect(entry.pad) {
            if (entry.pad != PadMode.CLOSED) {
                opened = true
            } else if (opened) {
                onPadClosed?.invoke()
            }
        }
    }
    if (onTaken != null) TakenEffect(entry.taken, target, viewModel, onTaken)
    val controlState = entry.toControlState(
        coaching = state.coachingTarget == target,
        inputMode = state.inputMode,
        borrowed = state.borrowed,
        keyAbsent = state.keyAbsent,
    )
    StanceControl(
        state = if (onTaken != null) controlState.copy(confirmation = null) else controlState,
        // Every gesture that ENTERS the ceremony, so a guest meets the
        // gate at the first touch rather than inside a pad whose Set
        // button can only fail — bounced by a longer road is still
        // bounced. The tap and the hold each raise it, as a tap raises it
        // (`VouchAsk`: "press and hold … GIVEN a guest -> the guest gate
        // rises"). Picking and dismissing are left alone: neither is
        // reachable without the tap first.
        onHoldDefault = onRequireAccount ?: { viewModel.onHoldDefault(target) },
        onOpenPad = onRequireAccount ?: { viewModel.onOpenPad(target) },
        onPick = { viewModel.onPick(target, it.toPair()) },
        onCommit = { viewModel.onCommit(target) },
        onDismissPad = { viewModel.onDismissPad(target) },
        onOpenAlternates = onRequireAccount ?: { viewModel.onOpenAlternates(target) },
        onOpenSeverance = { viewModel.onOpenSeverance(target) },
        onConfirmSeverance = { viewModel.onConfirmSeverance(target) },
        onDismissSeverance = { viewModel.onDismissSeverance(target) },
        onConfirmationShown = { viewModel.onConfirmationShown(target) },
        testTagPrefix = testTagPrefix,
        modifier = modifier,
        axes = axes,
        zeroWords = zeroWords,
        targetLabel = targetLabel,
        wide = wide,
        node = node,
        variant = variant,
        padOnly = padOnly,
        lineFaceInk = lineFaceInk,
        onConfirmEmptySign = { viewModel.onConfirmEmptySign(target) },
        onDismissEmptySign = { viewModel.onDismissEmptySign(target) },
        vouchesIn = vouchesIn,
        onRetrySigning = { viewModel.onRetrySigning(target) },
    )
}

/**
 * A host that routes on a taken signing (the vouch-back's ceremony) consumes
 * the one-shot here, and the control's own confirmation with it: the
 * ceremony replaces it (VouchBackPad.md:33).
 */
@Composable
private fun TakenEffect(taken: Boolean, target: StanceTarget, viewModel: StanceViewModel, onTaken: () -> Unit) {
    LaunchedEffect(taken) {
        if (taken) {
            viewModel.onTakenShown(target)
            viewModel.onConfirmationShown(target)
            onTaken()
        }
    }
}

internal fun TargetStance.toControlState(
    coaching: Boolean,
    inputMode: StanceInputMode,
    borrowed: Boolean = false,
    keyAbsent: Boolean = false,
) = StanceControlState(
    pick = pick.toPoint(),
    pad = when (pad) {
        PadMode.CLOSED -> StancePadMode.CLOSED
        PadMode.STICKY -> StancePadMode.STICKY
        PadMode.ALTERNATES -> StancePadMode.ALTERNATES
    },
    standing = standing?.toPoint(),
    severed = standingSevered,
    landing = landing?.let {
        StanceLanding(
            net = it.net.toPoint(),
            inertDirected = it.inertDirected,
            inertInterest = it.inertInterest,
            severance = it.severance,
            // The trigger split's own reading (`isEmptySign`): the landing
            // routes the line exactly as Set routes the ask.
            empty = isEmptySign(it, standingRecords, standingSevered),
        )
    },
    busy = busy,
    failed = failed,
    needsKey = needsKey,
    inputMode = when (inputMode) {
        StanceInputMode.PAD -> StanceInputSurface.PAD
        StanceInputMode.SLIDERS -> StanceInputSurface.SLIDERS
        StanceInputMode.ENTRY -> StanceInputSurface.ENTRY
    },
    severance = severance?.let {
        SeverancePrompt(
            standing = it.quote.standing.toPoint(),
            raw = it.quote.raw.toPoint(),
            // The pick route signs exactly one record, the pick (P5).
            records = if (it.fromPick) 1 else it.quote.records,
            alreadySevered = it.quote.alreadySevered,
            fromPick = it.fromPick,
            working = it.working,
            failed = it.failed,
            pick = pick.toPoint().takeIf { _ -> it.fromPick },
            bundleRecords = it.quote.bundleRecords,
            writeRule = it.writeRule,
        )
    },
    emptySign = emptySign?.let {
        EmptySignPrompt(working = it.working, failed = it.failed, writeRule = it.writeRule)
    },
    coaching = coaching,
    confirmation = confirmation?.toPoint(),
    walkedBack = walkedBack,
    borrowed = borrowed,
    writeRule = writeRule,
    keyAbsent = keyAbsent,
)

internal fun StancePair.toPoint() = StancePoint(pDirected, pInterest)

internal fun StancePoint.toPair() = StancePair(directed, interest)
