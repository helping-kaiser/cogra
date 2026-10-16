package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The seal's settings row (`FactRow`, `seal` emphasis): a name, the value it
 * currently reads, and the one word that changes it — `License · Public
 * domain — nobody owes you a name, and uses go unlogged. · Change`.
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
    SettingRow(
        label = label,
        modifier = modifier,
        actionText = actionText,
        onAction = onAction,
        showDivider = showDivider,
        testTag = testTag,
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = if (testTag != null) Modifier.testTag("${testTag}_value") else Modifier,
        )
    }
}

/**
 * The same row with a value that draws its own line — a readout is a face
 * and a number, not a sentence, so it takes no voice from the row
 * (`FactRow.jsx`: "A node in the seal's value slot draws its own line").
 *
 * THE LABEL NEVER COLLAPSES (finding F3, jakob's round-4 hand test). The
 * board's row is a flex line whose label is `flex: 1` and `nowrap`: it takes
 * whatever the value and the action leave, but never less than its own
 * word, so a long value — the license's whole reading — wraps beside an
 * intact label. A weighted label in a `Row` measures LAST, after the value
 * has already taken the width, and a long value left it nothing: "License"
 * stood one letter per line, top to bottom. [FactRowLayout] measures the
 * way the board lays out instead.
 */
@Composable
fun SettingRow(
    label: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
    showDivider: Boolean = true,
    testTag: String? = null,
    value: @Composable () -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (showDivider) Hairline()
        FactRowLayout(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = FACT_ROW_MIN_HEIGHT)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
            label = {
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    softWrap = false,
                    modifier = if (testTag != null) Modifier.testTag("${testTag}_label") else Modifier,
                )
            },
            value = value,
            action = {
                if (actionText != null && onAction != null) {
                    InlineAction(
                        text = actionText,
                        onClick = onAction,
                        testTag = testTag?.let { "${it}_action" },
                    )
                }
            },
        )
    }
}

/** The row's own minimum, `FactRow.jsx`'s 44px — not a tap target; the action word brings its own. */
private val FACT_ROW_MIN_HEIGHT = 44.dp

/**
 * The fact row's line, laid out as the board's flex row is: the action at
 * its own width, the label never narrower than its word, the value taking
 * at most what those two leave (and wrapping inside it), and the label
 * growing into whatever the value does not use — so a short value sits
 * beside its action, as drawn. Every child is centred on the line.
 */
@Composable
private fun FactRowLayout(
    label: @Composable () -> Unit,
    value: @Composable () -> Unit,
    action: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    Layout(
        contents = listOf(label, value, action),
        modifier = modifier,
    ) { (labelM, valueM, actionM), constraints ->
        val gap = Space.x2.roundToPx()
        val width = constraints.maxWidth
        val loose = Constraints(maxWidth = width)
        val actions = actionM.map { it.measure(loose) }
        val actionWidth = actions.sumOf { it.width }
        val present = 1 + (if (valueM.isNotEmpty()) 1 else 0) + (if (actions.any { it.width > 0 }) 1 else 0)
        val gaps = gap * (present - 1)
        val labelFloor = labelM.maxOf { it.maxIntrinsicWidth(constraints.maxHeight) }
        val valueRoom = (width - labelFloor - actionWidth - gaps).coerceAtLeast(0)
        val values = valueM.map { it.measure(Constraints(maxWidth = valueRoom)) }
        val valueWidth = values.sumOf { it.width }
        val labelWidth = (width - valueWidth - actionWidth - gaps).coerceAtLeast(0)
        val labels = labelM.map { it.measure(Constraints.fixedWidth(labelWidth)) }
        val height = maxOf(
            constraints.minHeight,
            (labels + values + actions).maxOfOrNull { it.height } ?: 0,
        )
        layout(width, height) {
            var x = 0
            labels.forEach { it.placeRelative(x, (height - it.height) / 2) }
            x += labelWidth + gap
            values.forEach { it.placeRelative(x, (height - it.height) / 2) }
            if (values.isNotEmpty()) x += valueWidth + gap
            actions.forEach { it.placeRelative(width - actionWidth, (height - it.height) / 2) }
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
