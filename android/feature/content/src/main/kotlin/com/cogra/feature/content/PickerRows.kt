// THE PICKERS' SHARED ANATOMY (TagPicker.jsx: "`ReferencePicker`'s anatomy
// exactly — the same header, the same bar, the same rows, the same trailing
// add mark — because staging a tag and staging a citation are the same errand
// with a different record at the end"). web's twin is
// `web/src/lib/ui2/compose/picker-rows.tsx`.
//
// - A result row is `ReferenceRow` with the ADD mark on its edge, since the
//   whole row's tap picks; at the composer's cap it is dimmed and takes no tap.
// - [PickerStagedRow] is what a picked row becomes: `StagedReference` with no
//   pair and no edit door — the picker stages, the composer sets the pair —
//   standing above the results with its ×.
// - [PickerFrame] is the screen: the page header (the arrow named for the
//   composer it returns to, the title, the one "?"), the fixed head (field,
//   the line under it, the staged section, the spoken status), the list, and
//   the full-width `Done` foot every wizard stage wears.
//
// THE MOVE IS SPOKEN (`PickAnnouncement`): a polite live region mounted with
// the screen, which draws nothing — assistive technology announces only
// changes to a region it was already watching.

package com.cogra.feature.content

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograRowButton
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.MarkKind
import com.cogra.core.designsystem.v2.atom.NodeMark
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.token.Space

/** The pickers' spoken moves (`PickAnnouncement`; TagPicker.jsx, ReferencePicker.jsx). */
internal const val PICK_ADDED = "Added — in the staged list."
internal const val PICK_REMOVED = "Removed from the staged list."

/**
 * The picker screen. [head] is the field and what stands under it; [staged]
 * the staged rows; [list] the results, [foot] what stands under them; [said]
 * the status message's words. Done and the header back are ONE LEAVE
 * ([onLeave]), and system Back is that leave too.
 */
@Composable
internal fun PickerFrame(
    title: String,
    origin: PickerOrigin,
    helpLabel: String,
    onHelp: () -> Unit,
    onLeave: () -> Unit,
    said: String,
    node: DataNode,
    head: @Composable ColumnScope.() -> Unit,
    staged: @Composable ColumnScope.() -> Unit,
    list: @Composable ColumnScope.() -> Unit,
    modifier: Modifier = Modifier,
    foot: @Composable ColumnScope.() -> Unit = {},
    /**
     * The foot's 8dp above `Done`: `ReferencePicker` draws it (`8px 24px
     * 24px`); the tag picker's footnote already ends its list (`0 24px 24px`).
     */
    footSpaced: Boolean = false,
) {
    BackHandler(onBack = onLeave)
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .dataNodeSurface()
            .dataNode(node),
    ) {
        PageHeader(
            title = title,
            onBack = onLeave,
            backContentDescription = origin.backLabel,
            action = { HelpDot(onHelp, helpLabel, testTag = (node / "header" / "help").tag) },
            node = node / "header",
        )
        Column(Modifier.fillMaxWidth()) {
            head()
            staged()
            PickAnnouncement(said, node / "announcement")
        }
        // The list fills what the head leaves; its foot (the footnote) stands at
        // the bottom of that space, as the board's `flex: 1` spacer puts it.
        Column(Modifier.weight(1f).fillMaxWidth()) {
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) { list() }
            foot()
        }
        Box(
            Modifier
                .fillMaxWidth()
                .padding(start = Space.x6, end = Space.x6, bottom = Space.x6, top = if (footSpaced) Space.x2 else 0.dp),
        ) {
            CograButton(
                text = "Done",
                onClick = onLeave,
                modifier = Modifier.fillMaxWidth(),
                testTag = (node / "done").tag,
            )
        }
    }
}

/** The staged section: the picked rows between the field and the results, 8 apart (`0 16px 8px`). */
@Composable
internal fun StagedSection(node: DataNode, content: @Composable ColumnScope.() -> Unit) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(node)
            .padding(start = Space.x4, end = Space.x4, bottom = Space.x2),
        content = content,
    )
}

/**
 * The status message (`PickAnnouncement`): mounted with the screen, drawn as
 * nothing, and heard politely each time [said] changes.
 */
@Composable
private fun PickAnnouncement(said: String, node: DataNode) {
    Box(
        Modifier
            .size(1.dp)
            .dataNode(node)
            .clearAndSetSemantics {
                liveRegion = LiveRegionMode.Polite
                if (said.isNotEmpty()) contentDescription = said
            },
    )
}

/**
 * A staged row (`StagedReference` with no pair and no edit door): the kind's
 * mark on the card's tone, the name over its [sub], and the × that un-stages
 * it on the spot — named for what it removes. `surfaceContainerHighest` at
 * the small rung, `8 12`, at least 48 tall.
 */
@Composable
internal fun PickerStagedRow(
    kind: MarkKind,
    name: String,
    onRemove: () -> Unit,
    node: DataNode,
    sub: String? = null,
    src: String? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(node)
            .defaultMinSize(minHeight = 48.dp)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x3, vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        NodeMark(kind, name, src, Modifier.dataNode(node / "mark"), onCard = true)
        Column(Modifier.weight(1f)) {
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().dataNode(node / "name"),
            )
            sub?.let {
                // The composer's StagedRow names this line its `kind`.
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().dataNode(node / "kind"),
                )
            }
        }
        Box(
            modifier = Modifier
                .testTag((node / "remove").tag)
                .hitTarget(
                    interactive = Modifier
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClick = onRemove)
                        .semantics { contentDescription = "Remove $name" },
                    drawnWidth = REMOVE_BOX,
                    drawnHeight = REMOVE_BOX,
                )
                .size(REMOVE_BOX),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

/**
 * The cap line (`PICKER_NOTE`, seam 248 GAP B): the batch's ten reached, said
 * once above the rows it stills — a fact, not a fault, so never the error ink.
 */
@Composable
internal fun PickerCapLine(text: String, node: DataNode) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(node)
            .padding(horizontal = Space.x6, vertical = Space.x2),
    )
}

/**
 * The fault line (round 25: the fault family's one shape, `ProfileUnreachable`):
 * the house line's NOUN form in the failure ink over an outlined `Retry` at
 * `sm`, where the rows were — never "try again", which beside a Retry says it
 * twice. Announced as it arrives.
 */
@Composable
internal fun PickerFault(message: String, onRetry: () -> Unit, node: DataNode) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x3),
        horizontalAlignment = Alignment.Start,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Space.x6, vertical = Space.x2)
            .dataNode(node),
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
        )
        CograRowButton(
            text = "Retry",
            onClick = onRetry,
            size = ButtonSize.Compact,
            kind = ButtonKind.Outlined,
            testTag = (node / "retry").tag,
        )
    }
}

/** `StagedReference`'s × box: 32 drawn, 18 glyph, answering at 48. */
private val REMOVE_BOX = 32.dp

/** The picker's one "?" dialog (`Tagging`, `Citing`), the house plain dialog over the screen. */
@Composable
internal fun PickerHelp(topic: HelpTopic, onClose: () -> Unit) {
    HelpDialog(
        title = topic.title,
        paragraphs = topic.paragraphs,
        onClose = onClose,
        testTag = "picker_help_${topic.name.lowercase()}",
    )
}

/**
 * THE PICKERS DRAW IN THE COMPOSER'S PLACE (web's wizard, post edit and
 * comment editor alike): while either is open it stands where the stage
 * stood, its own system Back closing it, and the composer underneath keeps
 * every word. Says whether one is drawn, so the host draws nothing else.
 */
@Composable
internal fun PickerInPlace(
    tags: TagSectionState,
    references: ReferenceSectionState,
    origin: PickerOrigin,
    tagPicker: TagPickerHandlers,
    referencePicker: ReferencePickerHandlers,
): Boolean = when {
    tags.picker != null -> {
        TagPicker(tags, origin, tagPicker)
        true
    }
    references.picker != null -> {
        ReferencePicker(references, origin, referencePicker)
        true
    }
    else -> false
}
