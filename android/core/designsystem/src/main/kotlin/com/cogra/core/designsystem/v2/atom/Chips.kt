package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The 2.0 chip: one pill, told apart by what it does (design/readme.md §7).
 *
 * Drawn at 32dp, tapped at 48dp — `minimumInteractiveComponentSize` expands
 * the target without moving the ink, which is how design/readme.md §4 asks
 * for the minimum to be met.
 *
 * **Selection is colour only, with no check glyph.** A check would reflow
 * every label in the row as the reader picks, so the selected chip swaps to
 * `secondaryContainer` and drops its border instead.
 *
 * @param onRemove when present, a trailing `close` glyph that removes the
 *   chip. It is part of the chip's own semantics rather than a separate
 *   node, so a screen reader hears one control with two actions.
 */
@Composable
fun CograChip(
    label: String,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    onClick: (() -> Unit)? = null,
    onRemove: (() -> Unit)? = null,
    testTag: String? = null,
) {
    val colors = MaterialTheme.colorScheme
    val container = if (selected) {
        Modifier.background(colors.secondaryContainer, CircleShape)
    } else {
        Modifier.border(BorderStroke(1.dp, colors.outline), CircleShape)
    }
    val ink = if (selected) colors.onSecondaryContainer else colors.onSurfaceVariant

    Row(
        modifier = modifier
            .minimumInteractiveComponentSize()
            .defaultMinSize(minHeight = Layout.ChipHeight)
            .clip(CircleShape)
            .then(container)
            .then(
                if (onClick != null) {
                    Modifier.clickable(role = Role.Button, onClick = onClick)
                } else {
                    Modifier
                },
            )
            .padding(horizontal = Space.x3, vertical = Space.x1)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .semanticsSelected(selected, onClick != null),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, style = MaterialTheme.typography.labelLarge, color = ink)
        if (onRemove != null) {
            Icon(
                imageVector = Icons.Filled.Close,
                // The row already names the chip; the glyph must not be read
                // as a second, unlabelled control.
                contentDescription = null,
                tint = ink,
                modifier = Modifier
                    .size(16.dp)
                    .clickable(onClick = onRemove)
                    .testTag(testTag?.let { "${it}_remove" } ?: "chip_remove"),
            )
        }
    }
}

/**
 * Marks the chip selected for assistive technology. Colour never carries
 * meaning alone (design/readme.md §10), so the selected state is announced
 * rather than only drawn.
 */
private fun Modifier.semanticsSelected(isSelected: Boolean, selectable: Boolean) =
    if (selectable) {
        this.then(Modifier.semantics { selected = isSelected })
    } else {
        this
    }

@ThemePreviews
@Composable
private fun CograChipStates() {
    Cogra2PreviewTheme {
        PreviewRow {
            CograChip("Tall 4:5", selected = true, onClick = {})
            CograChip("Square 1:1", onClick = {})
            CograChip("Wide 1.91:1", onClick = {})
        }
    }
}

@ThemePreviews
@Composable
private fun CograChipRemovable() {
    Cogra2PreviewTheme {
        PreviewRow {
            CograChip("#fieldnotes", selected = true, onRemove = {})
            CograChip("#coastroad", selected = true, onRemove = {})
            CograChip("Add a topic", onClick = {})
        }
    }
}
