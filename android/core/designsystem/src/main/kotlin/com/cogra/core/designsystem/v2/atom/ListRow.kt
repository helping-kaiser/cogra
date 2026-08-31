package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The seal's settings row: a name, the value it currently reads, and the one
 * word that changes it — `License · Public domain — your default · Change`.
 *
 * The rows are separated by the one hairline weight in `outlineVariant`
 * (design/readme.md §4), drawn as a top border so a stack of rows shares its
 * seams rather than doubling them.
 */
@Composable
fun SettingRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
    showDivider: Boolean = true,
    testTag: String? = null,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (showDivider) Hairline()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 40.dp)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (actionText != null && onAction != null) {
                InlineAction(
                    text = actionText,
                    onClick = onAction,
                    testTag = testTag?.let { "${it}_action" },
                )
            }
        }
    }
}

/**
 * The seal's summary block: what the signature covers, and the all-or-nothing
 * line beside it. `surfaceContainerHighest` at the medium rung — a filled
 * block, no border and no shadow.
 */
@Composable
fun SummaryRow(
    headline: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    testTag: String? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(vertical = 6.dp)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
    ) {
        Text(
            text = headline,
            // `ActsCard`'s total: body-medium size at label-large weight.
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = MaterialTheme.typography.labelLarge.fontWeight,
            ),
            color = MaterialTheme.colorScheme.onSurface,
        )
        // The all-or-nothing subline sits UNDER the total rather than beside
        // it, and only on a seal that commits more than one act.
        if (detail != null) {
            Text(
                text = detail,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** The one hairline weight, for structural separation. */
@Composable
fun Hairline(modifier: Modifier = Modifier) {
    Spacer(
        modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(MaterialTheme.colorScheme.outlineVariant),
    )
}

@ThemePreviews
@Composable
private fun RowVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            SummaryRow("4 signed actions", detail = "they land together, or none does")
            // A single-act seal has nothing for the subline to be true of.
            SummaryRow("1 signed action")
            Column {
                SettingRow(
                    label = "License",
                    value = "Public domain — your default",
                    actionText = "Change",
                    onAction = {},
                )
                SettingRow(
                    label = "Sensitive",
                    value = "Not marked",
                    actionText = "Mark",
                    onAction = {},
                )
                Hairline()
            }
        }
    }
}
