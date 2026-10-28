// The walk-back confirmation — the master `SeveranceConfirm`
// (design/components/stance/SeveranceConfirm.jsx; SeveranceConfirm.md).
//
// It is the only gate in the stance flow, and it CONFIRMS RATHER THAN
// REFUSES. One dialog serves both ways to (0, 0): the reader who pressed
// `Walk it back`, and the reader whose ordinary pick happens to net the
// bundle there — the second distinguished only by the pick line it adds.
//
// THE ORDER IS FIXED: title · the pick line when a pick raised it · the
// consequences · the raw total of everything said · the cap, only when the
// total exceeds it · the cost in things · the fault line when one stands.
// THE RAW TOTAL LEADS: stated after the fold it reads as broken arithmetic
// ("my opinion is +1.00, so why does walking it back take +1.40?").
//
// THE DESTRUCTIVE-DIALOG RULE (readme §11, *Dialogs*): the SAFE answer,
// `Keep it`, is the filled one in the right-hand slot; `Walk it back` stays a
// text button on the left. Severance is still one tap away — the control
// never prevents a choice — it just stops being the default-looking one. No
// error colour: severance is a deliberate act, not a failure.
//
// THE ONE EXEMPTION FROM GEEK MODE (readme §13): the raw sum and the fold
// paint in both modes — the dialog exists to show their difference.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Space
import kotlinx.coroutines.delay

@Composable
fun SeveranceConfirm(
    prompt: SeverancePrompt,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    testTagPrefix: String,
    /** The family's words, so the dialog speaks the pick the pad spoke. */
    axes: StanceAxes = StanceAxes.Opinion,
    /** The family's words for reaching zero — a topic disconnects (jakob's I2 ruling). */
    zeroWords: StanceZeroWords = StanceZeroWords.Severed,
    /** The dialog names its target the way the pad names it (SeveranceConfirm.md); null reads `this post`. */
    targetLabel: String? = null,
) {
    val target = targetWords(targetLabel)
    val busy = prompt.working && rememberSlowSignature(prompt.working)
    // THE WAYS OUT ARE LOCKED WHILE IT SIGNS: `Keep it`, the scrim and Back
    // wait for the answer — locked, never dimmed.
    val keep = { if (!prompt.working) onDismiss() }
    AlertDialog(
        onDismissRequest = keep,
        modifier = Modifier.testTag("${testTagPrefix}_severance"),
        title = {
            Text(
                text = stringResource(zeroWords.title, target),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.testTag("${testTagPrefix}_severance_title"),
            )
        },
        text = {
            // DialogSurface's body: paragraphs `--space-4` apart.
            Column(verticalArrangement = Arrangement.spacedBy(Space.x4)) {
                prompt.pick?.takeIf { prompt.fromPick }?.let { pick -> PickLine(pick, axes, testTagPrefix) }
                Text(
                    text = stringResource(zeroWords.body, target),
                    modifier = Modifier.testTag("${testTagPrefix}_severance_body"),
                )
                RawTotal(prompt, target, zeroWords, testTagPrefix)
                Text(
                    text = if (prompt.alreadySevered) {
                        stringResource(R.string.stance_severance_already)
                    } else {
                        pluralStringResource(R.plurals.stance_severance_cost, prompt.records, prompt.records)
                    },
                    modifier = Modifier.testTag(
                        "${testTagPrefix}_severance_" + if (prompt.alreadySevered) "already" else "cost",
                    ),
                )
                // A FAILED SIGNING RE-RAISES ITS OWN SURFACE WITH RETRY: the
                // dialog never closed, so the fault stands above the pair and
                // the commitment's own slot reads `Retry`.
                if (prompt.failed) {
                    Text(
                        text = stringResource(R.string.stance_pad_failed),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier
                            .semantics { liveRegion = LiveRegionMode.Assertive }
                            .testTag("${testTagPrefix}_severance_failed"),
                    )
                }
                if (prompt.writeRule) WriteRuleDialogLine("${testTagPrefix}_severance_write_rule")
            }
        },
        // Material's `confirmButton` slot draws last — the right-hand one —
        // so the safe answer sits there (`DiscardConfirm`'s arrangement).
        confirmButton = {
            CograButton(
                text = stringResource(R.string.stance_severance_keep),
                onClick = keep,
                testTag = "${testTagPrefix}_severance_keep",
            )
        },
        dismissButton = {
            // IN FLIGHT THE LABEL SAYS WHAT IS HAPPENING: the family's own
            // present participle, inert and never dimmed. Dimming is kept for
            // the true refusals: a bundle already at nothing, and the write
            // rule's no (round 21, ask 15).
            CograButton(
                text = when {
                    busy -> stringResource(zeroWords.busy)
                    prompt.failed && !prompt.working -> stringResource(R.string.stance_retry)
                    else -> stringResource(zeroWords.open)
                },
                onClick = { if (!prompt.working) onConfirm() },
                kind = ButtonKind.Text,
                enabled = !prompt.alreadySevered && !prompt.writeRule,
                testTag = "${testTagPrefix}_severance_confirm",
            )
        },
    )
}

/**
 * THE WRITE RULE'S NO IN A DIALOG RAISED OVER THE PAD (round 21, seam 245 ask
 * 15; SeveranceConfirm.md, EmptySignConfirm.md): a notice, not a fault —
 * its pre-check staged and spent nothing — so the row's quiet words stand
 * where the fault line would, in the pending marker's secondary ink,
 * announced politely, never the error colour and never as an alert.
 */
@Composable
internal fun WriteRuleDialogLine(testTag: String) {
    Text(
        text = stringResource(R.string.stance_write_rule_dialog),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .semantics { liveRegion = LiveRegionMode.Polite }
            .testTag(testTag),
    )
}

/** Whether a dialog's signing has stayed unanswered past [SETTING_AFTER_MS] — the walk-back's and the empty sign's. */
@Composable
internal fun rememberSlowSignature(working: Boolean): Boolean {
    var slow by remember { mutableStateOf(false) }
    LaunchedEffect(working) {
        slow = false
        if (working) {
            delay(SETTING_AFTER_MS)
            slow = true
        }
    }
    return slow
}

/**
 * `Your pick: 🙂 +0.40 / +0.20` — the pick that nets the bundle to nothing,
 * its face and pair painted in both modes, its word spoken. The pick wears
 * the face every pair wears: one number at zero thinks, as it does on the
 * pad. A pick of (0, 0) reaches this dialog only over a standing already at
 * (0, 0) — an empty sign's — and there it says nothing, as it does on the pad.
 */
@Composable
private fun PickLine(pick: StancePoint, axes: StanceAxes, testTagPrefix: String) {
    val anchor = bundleReadout(pick, EMPTY_PICK_LABEL)
    val spoken = stringResource(R.string.stance_severance_pick_spoken, stringResource(anchor.label), pick.reading(axes))
    Text(
        text = stringResource(R.string.stance_severance_pick, anchor.emoji, pick.pair()),
        modifier = Modifier
            .semantics { contentDescription = spoken }
            .testTag("${testTagPrefix}_severance_from_pick"),
    )
}

/**
 * Everything said, raw, then the cap only when the total exceeds it — one
 * statement in two lines, a tight 4dp apart, in `body-small`. With nothing
 * signed there is no total: `🤷 No opinion on this post yet.` — decided by
 * the bundle's records (`severanceParts`), never by the sum, since an empty
 * sign's standing sums to (0, 0) and still is something said.
 */
@Composable
private fun RawTotal(prompt: SeverancePrompt, target: String, zeroWords: StanceZeroWords, testTagPrefix: String) {
    val tag = "${testTagPrefix}_severance_standing"
    if (prompt.bundleRecords == 0) {
        Text(
            text = "${ZERO_BUNDLE_READOUT.emoji} ${stringResource(R.string.stance_standing_none, target)}",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.testTag(tag),
        )
        return
    }
    val raw = prompt.raw.pair()
    val folded = prompt.standing.pair()
    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.testTag(tag)) {
        Text(
            text = stringResource(zeroWords.sum, target, raw),
            style = MaterialTheme.typography.bodySmall,
        )
        if (raw != folded) {
            Text(
                text = stringResource(R.string.stance_severance_capped, folded),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.testTag("${testTagPrefix}_severance_capped"),
            )
        }
    }
}
