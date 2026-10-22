package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The quiet `primary` word the canvas uses for a secondary route out of a
 * screen — `Write words instead`, `Show all`, `Crop`, `Edit`,
 * `+ Cite something`.
 *
 * It is a **button, not a link**: what separates the two is what the control
 * does, and every one of these performs an action rather than going somewhere
 * (design/readme.md §7). It is not a [CograButton] because the canvas draws it
 * as bare type with no pill — a pill here would compete with the screen's one
 * committing action.
 *
 * WITH A [size] IT IS THE MASTER'S WORD (`Button.jsx` `InlineAction`): the
 * rung's type, its ink box in the layout, and the 48dp target answering
 * around it without growing the line ([hitTarget], the `cg-hit` analogue).
 * Without one it keeps the pre-audit drawing — `labelMedium`, its layout
 * grown to 48 — for the surfaces not yet audited against their boards.
 */
@Composable
fun InlineAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    testTag: String? = null,
    size: InlineSize? = null,
    /** The control's name where the word alone would not say what it acts on (`Remove it` → which). */
    contentDescription: String? = null,
    /** The word's data-node on a registered screen; replaces [testTag]. */
    node: DataNode? = null,
) {
    val tag = node?.tag ?: testTag
    val named = if (contentDescription != null) {
        Modifier.semantics { this.contentDescription = contentDescription }
    } else {
        Modifier
    }
    if (size == null) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            modifier = modifier
                .minimumInteractiveComponentSize()
                .defaultMinSize(minHeight = 0.dp)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .then(named)
                .then(if (tag != null) Modifier.testTag(tag) else Modifier),
        )
        return
    }
    val style = when (size) {
        InlineSize.Large -> MaterialTheme.typography.labelLarge
        InlineSize.Small -> MaterialTheme.typography.labelSmall
    }
    val line = with(LocalDensity.current) { style.lineHeight.toDp() }
    Text(
        text = text,
        style = style,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier
            .then(if (tag != null) Modifier.testTag(tag) else Modifier)
            .hitTarget(
                interactive = Modifier
                    .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                    .then(named),
                drawnHeight = line,
            ),
    )
}

@ThemePreviews
@Composable
private fun InlineActionVariants() {
    Cogra2PreviewTheme {
        PreviewRow {
            InlineAction("Write words instead", {})
            InlineAction("Change", {}, size = InlineSize.Large)
            InlineAction("+ Cite something", {}, size = InlineSize.Small)
        }
    }
}
