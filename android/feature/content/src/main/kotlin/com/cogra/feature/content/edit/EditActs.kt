// The edit family's foot, its detail, and its read-backs
// (design/components/compose/ActsFooter.jsx, ActsCard.jsx; the EditActs and
// CommentEditActs boards; `_shared.jsx` `WithdrawnLine`).
//
// ONE FOOT FOR EVERY EDIT, because the guard is the family's
// (EditComposeUnchanged.md): `EditCompose`, `EditComposeVideo`, `EditWords`,
// `CommentEdit` and `CommentEditVideo` carry the same line over the same
// batch, so they carry the same zero.
//
// AT ZERO THE LINE STOPS BEING A BUTTON. `Nothing to sign yet` is plain
// text: the acts sheet it would open has nothing in it, and a tap that can
// only open an empty list is a tap spent on nothing. The line still speaks —
// a foot gone silent would read as a fault.

package com.cogra.feature.content.edit

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.feature.content.R
import kotlinx.coroutines.delay

/** How long a signing may go unanswered before Sign the edit reads `Signing the edit…`. */
const val SLOW_ANSWER_MS = 200L

/**
 * True once [busy] has held for [SLOW_ANSWER_MS] — the moment the commit's
 * label swaps to `Signing the edit…` in its own place, with no spinner.
 * Resets the instant the answer lands.
 */
@Composable
fun rememberSlowAnswer(busy: Boolean): Boolean {
    var slow by remember { mutableStateOf(false) }
    LaunchedEffect(busy) {
        slow = false
        delay(if (busy) SLOW_ANSWER_MS else 0L)
        slow = busy
    }
    return busy && slow
}

/** The commit's label: `Sign the edit`, or `Signing the edit…` once the answer is slow. */
fun signLabel(slow: Boolean): String = if (slow) "Signing the edit…" else "Sign the edit"

/** The foot line's drawn height: one `label-small` line (`ActsFooter.jsx`). */
private val FOOT_LINE = 16.dp

/** Shown under the count once the signing has gone 5s unanswered. */
const val EDIT_SLOW_LINE = "Still signing — the network is slow right now."

/** Shown under the count when the prepared batch was not the one the foot read. */
const val EDIT_COUNT_CHANGED_LINE = "The count changed while you were editing — check it, then sign again."

/**
 * `You're signing N things ⌄` — the whole line is the control, opening the
 * acts sheet; at zero it is `Nothing to sign yet`, plain text and no control.
 * [subline] stands under it: the slow line or the count line.
 *
 * On a registered screen the foot wears [node] (`postEdit.acts`, keyed by the
 * state it draws), its line `line` and the subline [sublinePart] where the
 * board names it (`slow`).
 */
@Composable
fun ActsFooter(
    count: Int,
    onOpen: () -> Unit,
    testTag: String,
    subline: String? = null,
    node: DataNode? = null,
    sublinePart: String? = null,
) {
    val lineTag = node?.div("line")?.tag ?: testTag
    Column(
        modifier = Modifier.fillMaxWidth().dataNode(node),
        verticalArrangement = Arrangement.spacedBy(2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        val line = actsFooterLine(count)
        if (count == 0) {
            Text(
                text = line,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag(lineTag),
            )
        } else {
            Row(
                modifier = Modifier
                    // `ActsFooter.jsx`: the line keeps its drawn label-small height
                    // and answers at 48dp past it (`cg-hit`), so the foot stands
                    // 14 over the commit as drawn rather than 48dp tall.
                    .hitTarget(
                        interactive = Modifier
                            .testTag(lineTag)
                            .clickable(role = Role.Button, onClick = onOpen),
                        drawnHeight = FOOT_LINE,
                    ),
                horizontalArrangement = Arrangement.spacedBy(Space.x1, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = line,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Icon(
                    imageVector = Icons.Filled.ExpandMore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
        if (subline != null) {
            Text(
                text = subline,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.tertiary,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .testTag(sublinePart?.let { node?.div(it)?.tag } ?: "${testTag}_subline")
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
    }
}

/**
 * `EditActs` / `CommentEditActs`: the batch, every kind a row counted in the
 * records it signs, the title carrying the count, and `They land together, or
 * none does.` where the batch holds more than one act. Hosted by the caller's
 * sheet host, one drawer at a time.
 */
@Composable
fun ActsSheet(rows: List<EditActRow>, onDone: () -> Unit, testTag: String) {
    CograSheetSurface(testTag = testTag) {
        SheetTitle(actsSheetTitle(rows.actCount()))
        Column(Modifier.fillMaxWidth()) {
            rows.forEachIndexed { index, row ->
                if (index > 0) Hairline()
                ActRow(row, testTag = "${testTag}_row_${row.kind.name}")
            }
        }
        if (rows.size > 1) {
            Text(
                text = "They land together, or none does.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("${testTag}_together"),
            )
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            CograButton("Done", onDone, kind = ButtonKind.Text, testTag = "${testTag}_done")
        }
    }
}

/** One act: its kind, what it names, and its count seen bare and heard whole (`ActsCard.jsx`). */
@Composable
private fun ActRow(row: EditActRow, testTag: String) {
    val heard = "${row.count} ${if (row.count == 1) row.noun else "${row.noun}s"}"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x2)
            .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = row.kind.label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(112.dp),
        )
        Text(
            text = row.value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = row.count.toString(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.semantics { contentDescription = heard },
        )
    }
}

/**
 * `Withdrawn: #coastroad  Undo` — one line per withdrawn item, under its block.
 * On a registered screen the line wears [node] (`postEdit.tags.withdrawn`) and
 * its Undo `undo`.
 */
@Composable
fun WithdrawnLine(name: String, onUndo: () -> Unit, testTag: String, node: DataNode? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().dataNode(node),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Text(
            text = "Withdrawn: $name",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = if (node == null) Modifier.testTag(testTag) else Modifier,
        )
        InlineAction(
            text = "Undo",
            onClick = onUndo,
            modifier = Modifier.semantics { contentDescription = "Undo withdrawing $name" },
            testTag = node?.div("undo")?.tag ?: "${testTag}_undo",
        )
    }
}

/**
 * The license as signed, and locked: the lock is a mark rather than an
 * action — a license is published with the content and never changes, so the
 * row shows what was declared and says why nothing can be done about it.
 * On a registered screen the row wears [node] (`postEdit.facts.license`) and
 * its parts `label`, `value` and `lock`.
 */
@Composable
fun LockedLicenseRow(name: String, testTag: String, node: DataNode? = null) {
    Column(Modifier.fillMaxWidth()) {
        Hairline()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 44.dp)
                .testTag(node?.tag ?: testTag),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = "License",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f).dataNode(node?.div("label")),
            )
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag(node?.div("value")?.tag ?: "${testTag}_value"),
            )
            Icon(
                imageVector = Icons.Filled.Lock,
                contentDescription = stringResource(R.string.content_license_locked),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp).dataNode(node?.div("lock")),
            )
        }
        Hairline()
    }
}
