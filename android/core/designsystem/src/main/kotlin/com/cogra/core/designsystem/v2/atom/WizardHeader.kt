package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The wizard's header band, as every canonical Compose board draws it: a 48dp
 * row with 12dp side padding, a 48dp square back target, the stage's name in
 * `titleLarge`, and an optional trailing action rendered as a Compact pill.
 *
 * **Two ways out, each doing one thing** (jakob 2026-08-31,
 * `design/components/compose/WizardHeader.prompt.md`):
 *
 * - **The arrow steps one stage back**, never out of the flow — Details
 *   reaches crop with it, and the platform back gesture does the same.
 * - **The X leaves the whole flow, from any stage, draft kept — no
 *   confirmation.** Nothing is lost, because every leave keeps the draft and
 *   the draft prompt is the return surface. Without it an author deep in the
 *   wizard was stuck backing out tap by tap.
 *
 * The X sits **between the title and the stage's trailing controls**, so the
 * Next pill keeps the right edge wherever it is the primary action.
 *
 * **No step numbers.** design/readme.md §13 rules them out — the paths differ
 * in length, so the title names the stage and only the seal says "Last step".
 *
 * The back glyph is `automirrored` so a right-to-left locale gets the arrow
 * pointing the way that locale reads. The X is not: a close glyph reads the
 * same in every direction.
 */
@Composable
fun WizardHeader(
    title: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    backContentDescription: String? = "Back a step",
    onLeave: (() -> Unit)? = null,
    leaveContentDescription: String = "Leave — your draft is kept",
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
    actionEnabled: Boolean = true,
    trailingNote: String? = null,
    onHelp: (() -> Unit)? = null,
    helpContentDescription: String = "What this means",
    testTag: String? = null,
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = Layout.TopBarHeight)
            .padding(horizontal = Layout.TopBarPadding)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (onBack != null) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(Layout.TouchTargetMin)
                    .testTag(testTag?.let { "${it}_back" } ?: "wizard_back"),
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    // An icon never carries meaning alone (design/readme.md §5):
                    // the label lives in the accessibility tree, never beside
                    // the glyph.
                    contentDescription = backContentDescription,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            Box(Modifier.size(Layout.TouchTargetMin))
        }

        // The board gives the title its natural width and lets a `flex: 1`
        // spacer absorb the rest, which puts the trailing pill hard against
        // the right edge. One filling weight does both jobs: the title draws
        // at the start of the space it is given, the leftover stays inside
        // it, and the pill is pushed flush right whatever the title's length.
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )

        // The X: out of the flow entirely, from any stage, with the draft
        // kept and nothing to confirm. It precedes the trailing controls so
        // the primary action keeps the right edge.
        if (onLeave != null) {
            IconButton(
                onClick = onLeave,
                modifier = Modifier
                    .size(Layout.TouchTargetMin)
                    .testTag(testTag?.let { "${it}_leave" } ?: "wizard_leave"),
            ) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = leaveContentDescription,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // The seal's "Last step" — the one place a wizard header states where
        // the reader is, and it is a plain note rather than a step count.
        if (trailingNote != null) {
            Text(
                text = trailingNote,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // The screen's one `?`, after the note the seal draws beside it.
        if (onHelp != null) {
            HelpDot(
                onHelp = onHelp,
                contentDescription = helpContentDescription,
                testTag = testTag?.let { "${it}_help" } ?: "wizard_help",
            )
        }

        if (actionText != null && onAction != null) {
            CograButton(
                text = actionText,
                onClick = onAction,
                size = ButtonSize.Compact,
                enabled = actionEnabled,
                testTag = testTag?.let { "${it}_action" } ?: "wizard_action",
            )
        }
    }
}

@ThemePreviews
@Composable
private fun WizardHeaderVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            WizardHeader(
                title = "New post",
                onBack = {},
                onLeave = {},
                actionText = "Next",
                onAction = {},
            )
            WizardHeader(
                title = "Crop",
                onBack = {},
                onLeave = {},
                actionText = "Next",
                onAction = {},
            )
            WizardHeader(title = "Details", onBack = {}, onLeave = {})
            WizardHeader(
                title = "What you sign",
                onBack = {},
                onLeave = {},
                trailingNote = "Last step",
            )
            WizardHeader(
                title = "New post",
                onBack = {},
                onLeave = {},
                actionText = "Next",
                onAction = {},
                actionEnabled = false,
            )
        }
    }
}
