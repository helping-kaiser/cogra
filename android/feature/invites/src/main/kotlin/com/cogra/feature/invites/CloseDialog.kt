// THE TWO CLOSING DIALOGS (RejectConfirm, RejectAllConfirm; behavior
// RejectConfirm.md, RejectAllConfirm.md), over the Invites page. One drawing
// serves both — a row's close and a group's `Close all` — and they differ only
// in their words. web's twin is `web/src/app/(app)/invites/close-dialog.tsx`.
//
// THE QUIET ANSWER COMMITS, THE FILLED ONE KEEPS: `Keep it` / `Keep them` is
// the filled answer in the right-hand slot and `Close it` / `Close them` the
// text button on its left (RejectConfirm.md:9). No error colour and no
// deletion language: closing removes nothing from the record (:11, :21).
//
// THE CLOSING WAITS FOR ITS ANSWER (:15-17): pressed, the dialog stays up and
// locked — the scrim and Back do nothing — the commit refuses a second press
// and is never dimmed, and past 200ms it reads `Closing it…`. A closing that
// did not go through keeps the dialog with its pair, says `That didn't send.
// Try again.` and the commit reads `Retry` (:23).

package com.cogra.feature.invites

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.DialogSurface
import com.cogra.core.designsystem.v2.atom.rememberParticiple

private val DIALOG = DataNode("invites.dialog")

/** The words one closing dialog says. */
private data class CloseWords(
    val title: String,
    val body: List<String>,
    val commit: String,
    val busy: String,
    val keep: String,
)

@Composable
private fun wordsFor(target: CloseTarget): CloseWords = when (target) {
    is CloseTarget.One -> {
        val handle = "@${target.application.handle}"
        CloseWords(
            title = stringResource(R.string.reject_title, handle),
            body = listOf(
                stringResource(R.string.reject_body_told, handle),
                stringResource(R.string.reject_body_call, handle),
            ),
            commit = stringResource(R.string.reject_close_it),
            busy = stringResource(R.string.reject_closing_it),
            keep = stringResource(R.string.reject_keep_it),
        )
    }
    is CloseTarget.All -> {
        // The count counts only applications still waiting on the link
        // (RejectAllConfirm.md:5) — the group holds only those.
        val count = target.group.rows.size
        val words = stringArrayResource(R.array.reject_count_words)
        val spelled = words.getOrNull(count) ?: count.toString()
        CloseWords(
            title = stringResource(R.string.reject_all_title, count),
            body = listOf(
                stringResource(R.string.reject_all_body_told, spelled),
                stringResource(R.string.reject_all_body_call),
            ),
            commit = stringResource(R.string.reject_close_them),
            busy = stringResource(R.string.reject_closing_them),
            keep = stringResource(R.string.reject_keep_them),
        )
    }
}

@Composable
internal fun CloseDialog(closing: ClosingState, onConfirm: () -> Unit, onKeep: () -> Unit) {
    val words = wordsFor(closing.target)
    val slow = rememberParticiple(closing.working)
    val keep = { if (!closing.working) onKeep() }
    // The house shell (`DialogSurface`): one width, the title, the body's
    // paragraphs, the fault line above the pair, the pair end-aligned.
    DialogSurface(
        title = words.title,
        paragraphs = words.body,
        onScrimPress = keep,
        node = DIALOG,
        extra = {
            if (closing.failed && !closing.working) {
                // The failure voice inside the dialog, never a snackbar (:23).
                Text(
                    text = stringResource(R.string.reject_didnt_send),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .semantics { liveRegion = LiveRegionMode.Assertive }
                        .testTag("invites_dialog_failed"),
                )
            }
        },
        actions = {
            // The quiet commit on the left, the filled keep in the right-hand slot (:9).
            CograButton(
                text = when {
                    slow -> words.busy
                    closing.failed && !closing.working -> stringResource(R.string.reject_retry)
                    else -> words.commit
                },
                onClick = { if (!closing.working) onConfirm() },
                kind = ButtonKind.Text,
                testTag = (DIALOG / "close").tag,
            )
            CograButton(text = words.keep, onClick = keep, testTag = (DIALOG / "keep").tag)
        },
    )
}
