package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.exactSpans
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
            val showExact = LocalShowExactValues.current
            Column(verticalArrangement = Arrangement.spacedBy(Space.x4)) {
                paragraphs.forEach { paragraph ->
                    // A `cg-exact` tail paints in geek mode only; its
                    // screen-reader twin says it either way.
                    val (painted, spoken) = exactSpans(paragraph, showExact)
                    Text(
                        text = painted,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = if (painted == spoken) {
                            Modifier
                        } else {
                            Modifier.semantics { contentDescription = spoken }
                        },
                    )
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
            title = HelpTopic.HowSigningWorks.title,
            paragraphs = HelpTopic.HowSigningWorks.paragraphs,
            onClose = {},
        )
    }
}
