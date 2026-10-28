package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.TypeTokens

/**
 * The wizard's header band, as every canonical Compose board draws it: a 48dp
 * row with 12dp side padding, a 48dp square back target, the stage's name in
 * `titleLarge`, and an optional trailing action rendered as a Compact pill.
 *
 * **Two ways out, each doing one thing** (jakob 2026-08-31,
 * `design/components/compose/WizardHeader.prompt.md`):
 *
 * - **The arrow steps one stage back**, never out of the flow — Details
 *   reaches crop with it, and the platform back gesture does the same.
 * - **The X leaves the whole flow, from any stage, draft kept — no
 *   confirmation.** Nothing is lost, because every leave keeps the draft and
 *   the draft prompt is the return surface. Without it an author deep in the
 *   wizard was stuck backing out tap by tap.
 *
 * **The header carries only the ways out** (jakob 2026-09-01). The stage's
 * forward action — Next, Sign — lives at the bottom of the content column,
 * never here, so the top-right corner keeps one meaning through the whole
 * flow. It used to hold Next on the early stages and give the corner to the
 * X on the later ones, and an author trained on that corner left the flow by
 * reaching for Next ("i have also moved the button around a bit (namely the
 * next button) as i misslicked the 'X' multiple times"). What may still
 * trail the X is passive: a stage note, the help dot.
 *
 * **No step numbers.** design/readme.md §13 rules them out — the paths differ
 * in length, so the title names the stage and only the seal says "Last step".
 *
 * The back glyph is `automirrored` so a right-to-left locale gets the arrow
 * pointing the way that locale reads. The X is not: a close glyph reads the
 * same in every direction.
 */
@Composable
fun WizardHeader(
    title: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    backContentDescription: String? = "Back a step",
    onLeave: (() -> Unit)? = null,
    leaveContentDescription: String = "Leave — your draft is kept",
    trailingNote: String? = null,
    onHelp: (() -> Unit)? = null,
    helpContentDescription: String = "What this means",
    testTag: String? = null,
    /**
     * The header's data-node on a registered screen (`composeDetails.header`):
     * the header, its back arrow, title and X then wear the registered paths
     * in place of the [testTag] ones. The help dot is not on a registered
     * board, so it keeps its own.
     */
    node: DataNode? = null,
    /**
     * Where a stage lands its opening focus on its heading (EditCompose.md,
     * CommentEdit.md: "focus lands on the stage's heading AND NEVER the
     * keyboard rises before a field is tapped"): the title then takes focus
     * and reads as the heading it is.
     */
    titleFocus: FocusRequester? = null,
) {
    val tag = node?.tag ?: testTag
    Row(
        // The band's tag names the whole band (`PageHeader.jsx` `data-node` on
        // the full-width bar), so it rides outside the band's own padding.
        modifier = modifier
            .then(if (tag != null) Modifier.testTag(tag) else Modifier)
            .defaultMinSize(minHeight = Layout.TopBarHeight)
            .padding(horizontal = Layout.TopBarPadding),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(Layout.TouchTargetMin)
                    .testTag(partTag(node, testTag, "back")),
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

        // THE HEADER IS `PageHeader`'S TWO GROUPS (`WizardHeader.jsx` →
        // `PageHeader.jsx`): the arrow and the title share one `gap: 8`
        // group, the trailing group stands at least 12 from it
        // (`space-between`, `gap: 12`), and inside the trailing group the X,
        // the stage and the `?` sit 8 apart. The title's filling weight is the
        // space-between: it draws at the start of its space and pushes the
        // trailing group flush right.
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .padding(start = Space.x2)
                .weight(1f)
                .then(
                    if (titleFocus != null) {
                        Modifier
                            .semantics { heading() }
                            .focusRequester(titleFocus)
                            .focusable()
                    } else {
                        Modifier
                    },
                )
                .dataNode(node?.div("title")),
        )

        // The X: out of the flow entirely, from any stage, with the draft
        // kept and nothing to confirm.
        if (onLeave != null) {
            IconButton(
                onClick = onLeave,
                modifier = Modifier
                    .padding(start = Space.x3)
                    .size(Layout.TouchTargetMin)
                    .testTag(partTag(node, testTag, "leave")),
            ) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = leaveContentDescription,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // The seal's "Last step" — the one place a wizard header states where
        // the reader is, a plain note rather than a step count: `label-small`
        // by its size and leading alone, in the secondary ink.
        if (trailingNote != null) {
            Text(
                text = trailingNote,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                modifier = Modifier.padding(start = Space.x2),
            )
        }

        // The screen's one `?`, after the note the seal draws beside it.
        if (onHelp != null) {
            HelpDot(
                onHelp = onHelp,
                contentDescription = helpContentDescription,
                modifier = Modifier.padding(start = Space.x2),
                testTag = testTag?.let { "${it}_help" } ?: "wizard_help",
            )
        }
    }
}

/** A header control's tag: its registered path, else `<testTag>_<part>`, else `wizard_<part>`. */
private fun partTag(node: DataNode?, testTag: String?, part: String): String =
    node?.div(part)?.tag ?: testTag?.let { "${it}_$part" } ?: "wizard_$part"

@ThemePreviews
@Composable
private fun WizardHeaderVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            WizardHeader(title = "New post", onBack = {}, onLeave = {})
            WizardHeader(title = "Crop", onBack = {}, onLeave = {})
            WizardHeader(title = "Details", onBack = {}, onLeave = {})
            WizardHeader(
                title = "What you sign",
                onBack = {},
                onLeave = {},
                trailingNote = "Last step",
            )
        }
    }
}
