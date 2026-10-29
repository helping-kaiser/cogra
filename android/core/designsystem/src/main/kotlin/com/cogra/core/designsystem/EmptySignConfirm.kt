// The empty sign's ask — the master `EmptySignConfirm`
// (design/components/stance/EmptySignConfirm.jsx; PadStanding.md:71,
// ApprovePad.md, VouchAskPad.md; copy-voice *The empty sign*).
//
// A pick whose landing is exactly (0, 0) while NOTHING STANDS — no record
// ever signed toward the target, or a bundle already walked back — is not a
// walk-back: there is nothing to walk back. It is a priced record that says
// nothing, so it gets its own ask, never `SeveranceConfirm`, and never a
// block: `Set it anyway` is always one tap away. Signed, it joins the bundle
// like any other record — the ordinary snackbar, the fold at (0, 0), never
// severed.
//
// THE SHAPE IS `SeveranceConfirm`'s, because it is the same moment on the
// same pad: the dialog with the pad parked beneath it, and the
// destructive-dialog rule — the SAFE action, `Keep it`, filled in the
// right-hand slot; the act a text button on the left. No error colour: an
// empty sign is a choice, not a fault.
//
// TWO LINES, EACH ONE NEW: what the record does, and its cost in things.
// Where the opinion vouches someone in, the first line becomes the harder
// warning — they start out cut off — and the vouch-in still proceeds.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Space

@Composable
fun EmptySignConfirm(
    prompt: EmptySignPrompt,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    testTagPrefix: String,
    /** The pad's own target, in the reader's words; null reads `this post`. */
    targetLabel: String? = null,
    /** The opinion vouches its target in: the first line warns that they start out cut off. */
    vouchIn: Boolean = false,
) {
    val target = targetWords(targetLabel)
    val busy = prompt.working && rememberSlowSignature(prompt.working)
    // The scrim, Back and `Keep it` take the safe answer — and wait, as it
    // does, while the act signs.
    val keep = { if (!prompt.working) onDismiss() }
    AlertDialog(
        onDismissRequest = keep,
        modifier = Modifier.testTag("${testTagPrefix}_empty_sign"),
        title = {
            Text(
                text = stringResource(R.string.stance_empty_sign_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.testTag("${testTagPrefix}_empty_sign_title"),
            )
        },
        text = { EmptySignBody(prompt, target, vouchIn, testTagPrefix) },
        // Material's `confirmButton` slot draws last — the right-hand one —
        // so the safe answer sits there.
        confirmButton = {
            CograButton(
                text = stringResource(R.string.stance_severance_keep),
                onClick = keep,
                testTag = "${testTagPrefix}_empty_sign_keep",
            )
        },
        dismissButton = {
            // Past 200ms the act reads Set's own participle and goes inert,
            // never dimmed.
            CograButton(
                text = when {
                    busy -> stringResource(R.string.stance_setting)
                    prompt.failed && !prompt.working -> stringResource(R.string.stance_retry)
                    else -> stringResource(R.string.stance_empty_sign_confirm)
                },
                onClick = { if (!prompt.working) onConfirm() },
                kind = ButtonKind.Text,
                // Dimmed only for the write rule's no: asking again at once
                // meets the same answer, so no Retry is offered.
                enabled = !prompt.writeRule,
                testTag = "${testTagPrefix}_empty_sign_confirm",
            )
        },
    )
}

/** The ask's body: what the record does, its cost, and the fault or the write rule's no when one stands. */
@Composable
private fun EmptySignBody(prompt: EmptySignPrompt, target: String, vouchIn: Boolean, testTagPrefix: String) {
    // DialogSurface's body: paragraphs `--space-4` apart.
    Column(verticalArrangement = Arrangement.spacedBy(Space.x4)) {
        Text(
            text = if (vouchIn) {
                stringResource(R.string.stance_empty_sign_vouch_in, target)
            } else {
                stringResource(R.string.stance_empty_sign_effect, target)
            },
            modifier = Modifier.testTag("${testTagPrefix}_empty_sign_body"),
        )
        Text(
            text = stringResource(R.string.stance_empty_sign_cost),
            modifier = Modifier.testTag("${testTagPrefix}_empty_sign_cost"),
        )
        // A signing that did not go through keeps the dialog up: the fault
        // line, and `Retry` in the act's slot.
        if (prompt.failed) {
            Text(
                text = stringResource(R.string.stance_pad_failed),
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .semantics { liveRegion = LiveRegionMode.Assertive }
                    .testTag("${testTagPrefix}_empty_sign_failed"),
            )
        }
        // The write rule's no is `SeveranceConfirm`'s (round 21, ask 15).
        if (prompt.writeRule) WriteRuleDialogLine("${testTagPrefix}_empty_sign_write_rule")
    }
}
