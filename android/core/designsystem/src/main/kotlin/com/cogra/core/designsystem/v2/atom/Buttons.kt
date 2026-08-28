package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * Material's three buttons and no others (design/readme.md §7): [Filled] for
 * the one committing action on a surface, [Outlined] for a secondary action,
 * [Text] for a tertiary one. Both unfilled variants put `primary` on the
 * *label* — the label carries the emphasis, not the border.
 */
enum class ButtonKind { Filled, Outlined, Text }

/**
 * A pill's two sizes (design/readme.md §13).
 *
 * [Default] renders a true 40dp with 24dp side padding; [Compact] renders a
 * true 32dp with 16dp padding and is what a header's trailing action takes —
 * the size the canvas draws `Next` at on every wizard board.
 */
enum class ButtonSize { Default, Compact }

/**
 * The 2.0 pill.
 *
 * Every button is a pill at every size; a square corner should look like a
 * mistake (design/readme.md §4). The geometry is stated rather than left to
 * Material's defaults because the design system fixes it: Material's own
 * minimum width is 58dp and design/readme.md §13 sets 64dp.
 *
 * The touch target is not shrunk with the ink — Material's button composables
 * apply `minimumInteractiveComponentSize` themselves, so a 32dp Compact pill
 * still answers a 48dp tap (design/readme.md §10).
 */
@Composable
fun CograButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Filled,
    size: ButtonSize = ButtonSize.Default,
    enabled: Boolean = true,
    testTag: String? = null,
) {
    val height = when (size) {
        ButtonSize.Default -> Layout.ButtonHeight
        ButtonSize.Compact -> Layout.ButtonHeightCompact
    }
    val sidePadding = when (size) {
        ButtonSize.Default -> Layout.ButtonPadding
        ButtonSize.Compact -> Layout.ButtonPaddingCompact
    }
    val shared = modifier
        .defaultMinSize(minWidth = Layout.ButtonMinWidth, minHeight = height)
        .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
    val padding = PaddingValues(horizontal = sidePadding, vertical = 0.dp)
    val label: @Composable () -> Unit = {
        Text(text = text, style = MaterialTheme.typography.labelLarge)
    }

    when (kind) {
        ButtonKind.Filled -> Button(
            onClick = onClick,
            modifier = shared,
            enabled = enabled,
            shape = CircleShape,
            contentPadding = padding,
        ) { label() }

        ButtonKind.Outlined -> OutlinedButton(
            onClick = onClick,
            modifier = shared,
            enabled = enabled,
            shape = CircleShape,
            // One hairline weight, `outline` for a control the reader can
            // press (design/readme.md §4). Nothing carries a 2px border.
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.primary,
            ),
            contentPadding = padding,
        ) { label() }

        ButtonKind.Text -> TextButton(
            onClick = onClick,
            modifier = shared,
            enabled = enabled,
            shape = CircleShape,
            colors = ButtonDefaults.textButtonColors(
                contentColor = MaterialTheme.colorScheme.primary,
            ),
            contentPadding = padding,
        ) { label() }
    }
}

@ThemePreviews
@Composable
private fun CograButtonKinds() {
    Cogra2PreviewTheme {
        PreviewRow {
            CograButton("Sign and publish", {})
            CograButton("Keep browsing", {}, kind = ButtonKind.Outlined)
            CograButton("Cancel", {}, kind = ButtonKind.Text)
        }
    }
}

@ThemePreviews
@Composable
private fun CograButtonCompactAndDisabled() {
    Cogra2PreviewTheme {
        PreviewRow {
            CograButton("Next", {}, size = ButtonSize.Compact)
            CograButton("Next", {}, size = ButtonSize.Compact, enabled = false)
            CograButton("Set", {}, enabled = false)
        }
    }
}
