// The thin route that binds the design system's stance control to its
// state holder (android/CLAUDE.md "Stateless screens"). Host surfaces —
// post cards, comments, profiles — drop this in and pass the target.

package com.cogra.feature.stance

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.SeverancePrompt
import com.cogra.core.designsystem.StanceAxes
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StanceControlState
import com.cogra.core.designsystem.StanceInputSurface
import com.cogra.core.designsystem.StanceLanding
import com.cogra.core.designsystem.StancePadMode
import com.cogra.core.designsystem.StancePoint
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget

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
    targetLabel: String? = null,
    wide: Boolean = false,
    onRequireAccount: (() -> Unit)? = null,
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
    // The coach mark is a popup on the same terms, and it is already
    // spent by the time it is shown, so it goes with the pad.
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        viewModel.onDismissPad(target)
        viewModel.onCoachMarkDismissed()
    }
    val entry = state.targets[target] ?: TargetStance()
    StanceControl(
        state = entry.toControlState(
            coachMark = state.coachTarget == target,
            inputMode = state.inputMode,
        ),
        // Every gesture that ENTERS the ceremony, so a guest meets the
        // gate at the first touch rather than inside a pad whose Set
        // button can only fail — bounced by a longer road is still
        // bounced. A hold fires open-then-hold and would raise the gate
        // twice; the gate is a flag the shell sets, so the second raise
        // is the same raise. Picking and dismissing are left alone:
        // neither is reachable without one of these first.
        onTapDefault = onRequireAccount ?: { viewModel.onTapDefault(target) },
        onOpenPad = onRequireAccount ?: { viewModel.onOpenPad(target) },
        onPick = { viewModel.onPick(target, it.toPair()) },
        onCommit = { viewModel.onCommit(target) },
        onHold = onRequireAccount ?: { viewModel.onHold(target) },
        onDismissPad = { viewModel.onDismissPad(target) },
        onToggleExactValues = { viewModel.onToggleExactValues(target) },
        onOpenSeverance = { viewModel.onOpenSeverance(target) },
        onConfirmSeverance = { viewModel.onConfirmSeverance(target) },
        onDismissSeverance = { viewModel.onDismissSeverance(target) },
        onCoachMarkDismissed = viewModel::onCoachMarkDismissed,
        onConfirmationShown = { viewModel.onConfirmationShown(target) },
        testTagPrefix = testTagPrefix,
        modifier = modifier,
        axes = axes,
        targetLabel = targetLabel,
        wide = wide,
    )
}

internal fun TargetStance.toControlState(
    coachMark: Boolean,
    inputMode: StanceInputMode,
) = StanceControlState(
    pick = pick.toPoint(),
    pad = when (pad) {
        PadMode.CLOSED -> StancePadMode.CLOSED
        PadMode.DRAGGING -> StancePadMode.DRAGGING
        PadMode.STICKY -> StancePadMode.STICKY
    },
    standing = standing?.toPoint(),
    landing = landing?.let {
        StanceLanding(
            net = it.net.toPoint(),
            inertDirected = it.inertDirected,
            inertInterest = it.inertInterest,
            severance = it.severance,
        )
    },
    busy = busy,
    failed = failed,
    needsKey = needsKey,
    exactValues = exactValues,
    inputMode = when (inputMode) {
        StanceInputMode.PAD -> StanceInputSurface.PAD
        StanceInputMode.SLIDERS -> StanceInputSurface.SLIDERS
        StanceInputMode.ENTRY -> StanceInputSurface.ENTRY
    },
    severance = severance?.let {
        SeverancePrompt(
            standing = it.quote.standing.toPoint(),
            raw = it.quote.raw.toPoint(),
            records = it.quote.records,
            alreadySevered = it.quote.alreadySevered,
            fromPick = it.fromPick,
            working = it.working,
            failed = it.failed,
        )
    },
    coachMark = coachMark,
    confirmation = confirmation?.toPoint(),
)

internal fun StancePair.toPoint() = StancePoint(pDirected, pInterest)

internal fun StancePoint.toPair() = StancePair(directed, interest)
