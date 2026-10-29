// The approval pad as both hosts draw it — a row on Invites (ApprovePad) and
// the ask's card (VouchAskPad): the design system's ordinary StanceControl,
// `vouchesIn`, its two lines on every open, its `?` named How vouching works,
// parked 16dp off the bottom edge since neither surface carries a bottom bar
// (ApprovePad.md:11). One binding, so the two pads cannot drift.

package com.cogra.feature.invites

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StancePadVariant
import com.cogra.domain.stance.StancePair

@Composable
internal fun ApprovalControl(
    pad: ApprovalPad,
    state: ApprovalPadState,
    /** The asker or applicant with its @. */
    handle: String,
    testTagPrefix: String,
    node: DataNode,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    /** The guest gate: non-null raises it in place of every gesture that would sign (VouchAsk.md:21, :37). */
    onRequireAccount: (() -> Unit)? = null,
) {
    StanceControl(
        // The host says the signed line itself — the row or the ask has gone
        // by the time it would show (ApprovePad.md:37, VouchAskPad.md:25).
        state = state.toControlState(),
        onHoldDefault = onRequireAccount ?: pad::hold,
        onOpenPad = onRequireAccount ?: pad::open,
        onPick = { pad.pick(StancePair(it.directed, it.interest)) },
        onCommit = pad::commit,
        onDismissPad = onDismiss,
        onOpenAlternates = onRequireAccount ?: pad::openAlternates,
        // No Walk it back stands on an approval pad (ApprovePad.md:9).
        onOpenSeverance = {},
        onConfirmSeverance = {},
        onDismissSeverance = {},
        onConfirmationShown = {},
        testTagPrefix = testTagPrefix,
        modifier = modifier,
        targetLabel = handle,
        node = node,
        variant = StancePadVariant(
            title = stringResource(R.string.approve_help_title),
            help = listOf(stringResource(R.string.approve_help_link), stringResource(R.string.approve_help_set)),
            note = stringResource(R.string.approve_note_act, handle),
            noteSecond = stringResource(R.string.approve_note_answer),
            padNode = node / "pad",
            padInset = 16.dp,
        ),
        onConfirmEmptySign = pad::confirmEmptySign,
        onDismissEmptySign = pad::dismissEmptySign,
        vouchesIn = true,
        // A vouch kept for the key waits on Invites as its own row (VouchAskPad.md:29).
        onKeepPending = onRequireAccount ?: pad::keep,
    )
}
