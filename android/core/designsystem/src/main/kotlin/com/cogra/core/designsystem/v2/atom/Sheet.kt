package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The bottom sheet's *surface*, extracted from its presentation.
 *
 * A sheet is a drawer the reader opened and can drop (design/readme.md §7):
 * it comes from the edge it goes back to, covers the bottom bar, and traps
 * nothing. Presentation is Material's `ModalBottomSheet` — the documented
 * component, with its own scrim, drag behaviour and back handling — and this
 * is what goes inside it, so a screen never restates the geometry and a
 * static preview can draw a sheet without driving a sheet state. That is the
 * same split `StancePad` already uses to draw a bloomed pad without the
 * gesture.
 *
 * Geometry is the canonical seal board's: the extra-large (28dp) rung on the
 * top corners only, `surfaceContainerHigh`, a 32×4 handle in `outlineVariant`,
 * and 24dp side padding.
 */
@Composable
fun CograSheetSurface(
    modifier: Modifier = Modifier,
    showHandle: Boolean = true,
    testTag: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x6)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        if (showHandle) {
            Spacer(
                Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(32.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.outlineVariant),
            )
        }
        content()
    }
}

/**
 * A sheet's heading, with the optional `?` that opens the screen's one
 * explanation (design/readme.md §13: at most one per screen).
 */
@Composable
fun SheetTitle(
    text: String,
    modifier: Modifier = Modifier,
    onHelp: (() -> Unit)? = null,
    helpContentDescription: String = "What this means",
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        if (onHelp != null) {
            HelpAffordance(onHelp, helpContentDescription)
        }
        trailing?.invoke()
    }
}

/**
 * The circled `?`, drawn as the canonical boards draw it. It taps at 48dp
 * while drawing at 24dp, and its label rides `onClickLabel` so the glyph is
 * never the only thing announced.
 */
@Composable
private fun HelpAffordance(onHelp: () -> Unit, description: String) {
    Box(
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(24.dp)
            .clip(CircleShape)
            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
            .clickable(role = Role.Button, onClickLabel = description, onClick = onHelp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "?",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@ThemePreviews
@Composable
private fun CograSheetSurfacePreview() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            CograSheetSurface {
                SheetTitle("Mark as sensitive", onHelp = {})
                Text(
                    "Veils the pictures and the description until a reader chooses to look.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                CograButton("Done", {})
            }
        }
    }
}
