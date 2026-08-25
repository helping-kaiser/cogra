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
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StanceControlState
import com.cogra.core.designsystem.StanceInputSurface
import com.cogra.core.designsystem.StanceLanding
import com.cogra.core.designsystem.StancePadMode
import com.cogra.core.designsystem.StancePoint
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair

/**
 * The stance control for one [target]. The view model is scoped to the
 * destination, so every control on a screen shares one holder and one
 * map of per-target state.
 */
@Composable
fun StanceControlRoute(
    target: String,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    viewModel: StanceViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(target) { viewModel.observe(target) }
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
        onTapDefault = { viewModel.onTapDefault(target) },
        onOpenPad = { viewModel.onOpenPad(target) },
        onPick = { viewModel.onPick(target, it.toPair()) },
        onCommit = { viewModel.onCommit(target) },
        onHold = { viewModel.onHold(target) },
        onDismissPad = { viewModel.onDismissPad(target) },
        onToggleExactValues = { viewModel.onToggleExactValues(target) },
        onOpenSeverance = { viewModel.onOpenSeverance(target) },
        onConfirmSeverance = { viewModel.onConfirmSeverance(target) },
        onDismissSeverance = { viewModel.onDismissSeverance(target) },
        onCoachMarkDismissed = viewModel::onCoachMarkDismissed,
        onConfirmationShown = { viewModel.onConfirmationShown(target) },
        testTagPrefix = testTagPrefix,
        modifier = modifier,
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
