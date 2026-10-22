package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * Material's three buttons (design/readme.md §7) plus [Inverse]: [Filled] for
 * the one committing action on a surface, [Outlined] for a secondary action,
 * [Text] for a tertiary one. Both unfilled variants put `primary` on the
 * *label* — the label carries the emphasis, not the border.
 *
 * [Inverse] is not a fourth emphasis: it is the filled button standing on a
 * TONAL PANEL instead of the page — the key-absent notice is a
 * `tertiaryContainer` block, and a `primary` fill inside it is a second
 * colour arguing with the panel's own, so there the fill takes the panel's
 * own pair turned over (`onTertiaryContainer` as the fill, `tertiaryContainer`
 * as the label). Use it only inside such a panel (Button.jsx:10-17).
 */
enum class ButtonKind {
    Filled,
    Outlined,
    Text,
    Inverse,

    /**
     * The TEXT button on the same tonal panel: no fill, the panel's own
     * ink (`VouchBack.jsx`'s `Got it`, `color: var(--on-tertiary-container)`).
     */
    InverseText,
}

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

    // The text button's ink: `primary` on the page, the panel's own on a tonal panel.
    val textInk = MaterialTheme.colorScheme.let {
        if (kind == ButtonKind.InverseText) it.onTertiaryContainer else it.primary
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

        ButtonKind.Text, ButtonKind.InverseText -> TextButton(
            onClick = onClick,
            modifier = shared,
            enabled = enabled,
            shape = CircleShape,
            colors = ButtonDefaults.textButtonColors(contentColor = textInk),
            contentPadding = padding,
        ) { label() }

        ButtonKind.Inverse -> Button(
            onClick = onClick,
            modifier = shared,
            enabled = enabled,
            shape = CircleShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.onTertiaryContainer,
                contentColor = MaterialTheme.colorScheme.tertiaryContainer,
            ),
            contentPadding = padding,
        ) { label() }
    }
}

/**
 * AN OUTLINED PILL STANDING IN A ROW OF CONTROLS, drawn at its own height and
 * answering at 48 (`Button.jsx`: "the 48px hit expansion — a small button is
 * 33px of ink and 48px of target"; `ProfileHeader.jsx`'s actions row).
 *
 * [CograButton] lets Material grow its LAYOUT to the 48dp minimum, which a
 * row whose height is its controls' ink cannot afford: a 32dp pair of pills
 * would stand a 48dp row. Here the pill keeps its drawn box in the layout and
 * its target is the invisible margin [hitTarget] centres on it — the trade
 * the band's icons and the card's pills already make.
 *
 * [alpha] is the locked look (`StateTokens.DISABLED`): the pill stays
 * tappable, its tap explaining what unlocks it.
 */
@Composable
fun CograRowButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: ButtonSize = ButtonSize.Default,
    alpha: Float = 1f,
    contentDescription: String? = null,
    testTag: String? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    val height = when (size) {
        ButtonSize.Default -> Layout.ButtonHeight
        ButtonSize.Compact -> Layout.ButtonHeightCompact
    }
    val sidePadding = when (size) {
        ButtonSize.Default -> Layout.ButtonPadding
        ButtonSize.Compact -> Layout.ButtonPaddingCompact
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onClick)
                    .then(
                        if (contentDescription != null) {
                            Modifier.semantics { this.contentDescription = contentDescription }
                        } else {
                            Modifier
                        },
                    ),
                drawnHeight = height,
            )
            .alpha(alpha)
            .defaultMinSize(minWidth = Layout.ButtonMinWidth, minHeight = height)
            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
            .padding(horizontal = sidePadding),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            maxLines = 1,
        )
        trailing?.invoke()
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
