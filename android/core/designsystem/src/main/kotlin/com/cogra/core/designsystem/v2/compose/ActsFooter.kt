// `ActsFooter` (design/components/compose/ActsFooter.jsx): the foot an edit
// carries over its batch — `You're signing N things ⌄`, the line that opens the
// acts sheet — shared by the post and comment edits and the profile edit.
//
// AT ZERO THE LINE STOPS BEING A BUTTON. `Nothing to sign yet` is plain
// text: the acts sheet it would open has nothing in it, and a tap that can
// only open an empty list is a tap spent on nothing. The line still speaks —
// a foot gone silent would read as a fault.

package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.token.Space

/** The foot line's drawn height: one `label-small` line (`ActsFooter.jsx`). */
private val FOOT_LINE = 16.dp

/**
 * The foot's sentence (`ActsFooter.jsx`): `Nothing to sign yet` at zero — and
 * then the line is no control — `You're signing 1 thing`, `You're signing N
 * things`.
 */
fun actsFooterLine(count: Int): String = when (count) {
    0 -> "Nothing to sign yet"
    1 -> "You're signing 1 thing"
    else -> "You're signing $count things"
}

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
