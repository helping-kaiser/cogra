package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/** `--dialog-max-width` (20rem): one width for every dialog (`core/JoinPrompt.jsx`). */
val DialogMaxWidth = 320.dp

/** `--dialog-inset` (`--space-8`): the gap a dialog keeps from the screen's edge, wider than the page gutter. */
val DialogInset = Space.x8

/** `--scrim-dialog`: the scrim at 50%. */
private const val DIALOG_SCRIM_ALPHA = 0.5f

/**
 * THE HOUSE DIALOG SHELL — the master `DialogSurface` (`core/JoinPrompt.jsx`;
 * readme §11, *Dialogs*): one width, one anatomy, so the dialogs cannot drift
 * into two sizes, two alignments and two body colours.
 *
 * - WIDTH `min(100vw − 2 × --dialog-inset, --dialog-max-width)`: the platform's
 *   own dialog width is switched off (`usePlatformDefaultWidth = false`) so the
 *   inset and the cap are the only two rules, 320 on a phone and the screen
 *   less 32 a side below 384.
 * - `surfaceContainerHigh` (`--surface-dialog`) at the extra-large rung (28),
 *   padding 24, over a 50% scrim (`--scrim-dialog`).
 * - THE ANATOMY IS SLOTTED: the title in `headline-small`; the body's
 *   paragraphs in `body-medium` on `onSurfaceVariant`, 16 apart and 16 under
 *   the title; then [extra] — a fault line stands there, above the pair
 *   (SeveranceConfirm's placement); the actions end-aligned, 8 apart, 24 under
 *   the body, wrapping where they must.
 *
 * THE SCRIM AND BACK TAKE THE SAFE ANSWER: [onScrimPress] is that answer —
 * cancel, keep, close — never the act. A caller whose act is in flight ignores
 * it there, locked and never dimmed.
 *
 * Built on Material's [BasicAlertDialog], its documented hook for a dialog
 * whose content is laid out by the caller
 * (developer.android.com/develop/ui/compose/components/dialog).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DialogSurface(
    title: String,
    paragraphs: List<String>,
    onScrimPress: () -> Unit,
    actions: @Composable FlowRowScope.() -> Unit,
    modifier: Modifier = Modifier,
    extra: @Composable ColumnScope.() -> Unit = {},
    testTag: String? = null,
    /** The dialog's registered node, where its board registers one; it names its parts `title` and `body`. */
    node: DataNode? = null,
) {
    BasicAlertDialog(
        onDismissRequest = onScrimPress,
        properties = DialogProperties(usePlatformDefaultWidth = false),
        modifier = Modifier.padding(horizontal = DialogInset),
    ) {
        DialogScrim()
        Surface(
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            contentColor = MaterialTheme.colorScheme.onSurface,
            modifier = modifier
                .widthIn(max = DialogMaxWidth)
                .fillMaxWidth()
                // The dialog is named by its title (`aria-label = title`).
                .semantics { paneTitle = title }
                .then(if (node == null && testTag != null) Modifier.testTag(testTag) else Modifier)
                .dataNode(node),
        ) {
            Column(modifier = Modifier.padding(Space.x6)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.dataNode(node?.div("title")),
                )
                Column(
                    modifier = Modifier
                        .padding(top = Space.x4)
                        .dataNode(node?.div("body")),
                    verticalArrangement = Arrangement.spacedBy(Space.x4),
                ) {
                    paragraphs.forEach { paragraph ->
                        Text(
                            text = paragraph,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    extra()
                }
                FlowRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = Space.x6),
                    horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
                    itemVerticalAlignment = Alignment.CenterVertically,
                    content = actions,
                )
            }
        }
    }
}

/**
 * `--scrim-dialog`: the dialog window's own dim, at the token's 50%. The
 * window is the dialog's own ([DialogWindowProvider], Compose's documented
 * handle on it); the platform default dim is the theme's, not the board's.
 */
@Composable
private fun DialogScrim() {
    val window = (LocalView.current.parent as? DialogWindowProvider)?.window ?: return
    SideEffect { window.setDimAmount(DIALOG_SCRIM_ALPHA) }
}

@ThemePreviews
@Composable
private fun DialogSurfacePreview() {
    Cogra2PreviewTheme {
        DialogSurface(
            title = "Remove this post?",
            paragraphs = listOf(
                "The words and pictures leave every reader's view.",
                "This is immediate and permanent.",
            ),
            onScrimPress = {},
            actions = {
                CograButton("Remove", {}, kind = ButtonKind.Text)
                CograButton("Keep it", {})
            },
        )
    }
}
