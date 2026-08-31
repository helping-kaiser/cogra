package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The house explanation, behind a screen's one `?` (`HelpDialog` board).
 *
 * **At most one per screen** (design/readme.md §13): compose keeps captions
 * to one short line and the full explanation lives here — a plain dialog
 * with a title, at most two short paragraphs, and Close. Nothing else; a
 * help dialog that grows controls stops being help.
 *
 * It is a dialog rather than a sheet because it explains the screen behind
 * it rather than continuing it — the reader comes straight back.
 */
@Composable
fun HelpDialog(
    title: String,
    paragraphs: List<String>,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    AlertDialog(
        onDismissRequest = onClose,
        modifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        title = {
            Text(text = title, style = MaterialTheme.typography.headlineSmall)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Space.x4)) {
                paragraphs.forEach { paragraph ->
                    Text(text = paragraph, style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            CograButton(
                text = "Close",
                onClick = onClose,
                testTag = testTag?.let { "${it}_close" },
            )
        },
    )
}

@ThemePreviews
@Composable
private fun HelpDialogPreview() {
    Cogra2PreviewTheme {
        HelpDialog(
            title = "Signed actions",
            paragraphs = listOf(
                "Each piece of a post — the post itself, every topic, every " +
                    "citation — is its own signed action, written in your name. " +
                    "They sign together: all of them land, or none does.",
                "You don't pay for these — a shared community pool covers " +
                    "members' signings. The pool is real and finite, so each " +
                    "action still counts.",
            ),
            onClose = {},
        )
    }
}
