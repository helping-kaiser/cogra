package com.cogra.core.designsystem.v2.atom

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * What the dialog is asking about, which is the only thing that varies.
 *
 * One shared dialog serves the reply composer, the comment edit and the
 * post edit (DiscardConfirm.md); only the question changes, so the
 * surfaces cannot drift into dialogs that ask the same thing differently.
 * Both edits ask the same question: the post edit reuses the comment
 * edit's sibling.
 */
enum class DiscardSubject(val question: String) {
    Reply("Discard this reply?"),
    Edit("Discard the changes?"),
}

/**
 * The think-twice before a composer that keeps nothing is left
 * (`DiscardConfirm` board).
 *
 * **It belongs only to the surfaces that keep no draft.** The post
 * wizard and the profile picture each keep a local draft, and there the
 * draft is the safety, so nothing asks on the way out. The reply wizard,
 * the comment edit and the post edit keep none: leaving them discards,
 * which is the whole reason this asks.
 *
 * **An empty composer is never asked.** A confirm with nothing to lose
 * is noise, so the caller shows this only when something has been
 * written — the dialog itself has no opinion about emptiness, because
 * what counts as written differs per surface.
 *
 * `Keep writing` is the filled action and `Discard` the quiet one: the
 * board fills the way back, so the heaviest control on the screen never
 * belongs to the answer the dialog was raised to slow down. Material's
 * `confirmButton` slot draws last, which is why the way back sits
 * there.
 */
@Composable
fun DiscardConfirm(
    subject: DiscardSubject,
    onKeepWriting: () -> Unit,
    onDiscard: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    AlertDialog(
        // Tapping the scrim is the same answer as Keep writing: leaving
        // by accident is exactly what this dialog exists to prevent.
        onDismissRequest = onKeepWriting,
        modifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        title = {
            Text(text = subject.question, style = MaterialTheme.typography.headlineSmall)
        },
        text = {
            Text(text = "Nothing is kept.", style = MaterialTheme.typography.bodyMedium)
        },
        confirmButton = {
            CograButton(
                text = "Keep writing",
                onClick = onKeepWriting,
                testTag = testTag?.let { "${it}_keep" },
            )
        },
        dismissButton = {
            CograButton(
                text = "Discard",
                onClick = onDiscard,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_discard" },
            )
        },
    )
}

/**
 * A think-twice that names both answers (`DialogSurface` with the
 * `DiscardConfirm` weighting): the board's title and body, the KEEP answer
 * filled in the right-hand slot the thumb goes to by habit, the destructive
 * one quiet — and no `error` colour, because a reader discarding what they no
 * longer want is doing what they meant to. The scrim and Back are the keep
 * answer (`ComposeDraftDiscard`, `ComposeBodyDiscard`, `SealDiscardConfirm`).
 */
@Composable
fun AskDialog(
    title: String,
    body: String,
    keepLabel: String,
    discardLabel: String,
    onKeep: () -> Unit,
    onDiscard: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    AlertDialog(
        onDismissRequest = onKeep,
        modifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        title = { Text(text = title, style = MaterialTheme.typography.headlineSmall) },
        text = { Text(text = body, style = MaterialTheme.typography.bodyMedium) },
        confirmButton = {
            CograButton(text = keepLabel, onClick = onKeep, testTag = testTag?.let { "${it}_keep" })
        },
        dismissButton = {
            CograButton(
                text = discardLabel,
                onClick = onDiscard,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_discard" },
            )
        },
    )
}

@ThemePreviews
@Composable
private fun DiscardConfirmPreview() {
    Cogra2PreviewTheme {
        DiscardConfirm(
            subject = DiscardSubject.Reply,
            onKeepWriting = {},
            onDiscard = {},
        )
    }
}
