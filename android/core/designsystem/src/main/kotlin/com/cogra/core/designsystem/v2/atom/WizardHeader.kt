package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
 * **No step numbers.** design/readme.md §13 rules them out — the paths differ
 * in length, so the title names the stage and only the seal says "Last step".
 * (The superseded ideation boards under `design/designs/compose/` still draw
 * a "Step 1 of 4" counter; the canonical boards do not.)
 *
 * The back glyph is `automirrored` so a right-to-left locale gets the arrow
 * pointing the way that locale reads.
 */
@Composable
fun WizardHeader(
    title: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    backContentDescription: String? = null,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
    actionEnabled: Boolean = true,
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

        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )

        Box(Modifier.weight(1f))

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
                backContentDescription = "Back",
                actionText = "Next",
                onAction = {},
            )
            WizardHeader(title = "Crop", onBack = {}, actionText = "Next", onAction = {})
            WizardHeader(title = "Details", onBack = {})
            WizardHeader(
                title = "New post",
                onBack = {},
                actionText = "Next",
                onAction = {},
                actionEnabled = false,
            )
        }
    }
}
