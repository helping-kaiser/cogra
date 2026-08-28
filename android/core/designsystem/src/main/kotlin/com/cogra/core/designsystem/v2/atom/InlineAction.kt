package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
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
 * as bare `labelMedium` type with no pill — a pill here would compete with the
 * screen's one committing action.
 *
 * The tap target still reaches 48dp without the ink growing.
 */
@Composable
fun InlineAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    testTag: String? = null,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier
            .minimumInteractiveComponentSize()
            .defaultMinSize(minHeight = 0.dp)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    )
}

@ThemePreviews
@Composable
private fun InlineActionVariants() {
    Cogra2PreviewTheme {
        PreviewRow {
            InlineAction("Write words instead", {})
            InlineAction("Show all", {})
            InlineAction("+ Cite something", {})
        }
    }
}
