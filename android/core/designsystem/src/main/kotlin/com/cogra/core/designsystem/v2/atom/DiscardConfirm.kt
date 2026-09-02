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
 * One shared dialog serves the reply composer and the comment edit
 * (design/readme.md §13); only the question changes, so the surfaces
 * cannot drift into two dialogs that ask the same thing differently.
 */
enum class DiscardSubject(val question: String) {
    Reply("Discard this reply?"),
    Edit("Discard this edit?"),
}

/**
 * The think-twice before a composer that keeps nothing is left
 * (`DiscardConfirm` board).
 *
 * **It belongs only to the surfaces that keep no draft.** The post
 * wizard, the post edit and the profile picture each keep a local draft,
 * "and there the draft is the safety, so nothing asks on the way out"
 * (design/readme.md §13). The reply wizard and the comment edit keep
 * none: leaving them discards, which is the whole reason this asks.
 *
 * **An empty composer is never asked.** A confirm with nothing to lose
 * is noise, so the caller shows this only when something has been
 * written — the dialog itself has no opinion about emptiness, because
 * what counts as written differs per surface.
 *
 * `Discard` is the filled action and `Keep writing` the quiet one: the
 * board fills the button that ends the writing, so the destructive
 * choice is the deliberate one rather than the easy one.
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
                text = "Discard",
                onClick = onDiscard,
                testTag = testTag?.let { "${it}_discard" },
            )
        },
        dismissButton = {
            CograButton(
                text = "Keep writing",
                onClick = onKeepWriting,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_keep" },
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
