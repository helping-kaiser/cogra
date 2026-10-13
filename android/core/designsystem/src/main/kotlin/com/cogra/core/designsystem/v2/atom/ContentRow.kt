// THE IDENTITY ROW (design/components/core/ContentRow.jsx): the card-lite line
// every list in the product is built from — a 40dp disc saying who or what,
// two lines of words saying which and when, and whatever the list keeps on its
// trailing edge. One master, so the lists that reuse it (Saved first; the
// chronicle, notifications, the wallet, Hidden accounts later) cannot drift.
// web's twin is `web/src/lib/ui2/content-row.tsx`.
//
// THE DISC LEADS, BY PRECEDENCE: a deleted account's reserved disc, else a
// picture, else a monogram for a name, else the kind's glyph.
//
// THE SECOND LINE IS ONE LINE, ellipsized: a row in a list is scanned, not
// read.
//
// A ROW MAY CARRY ONE CONTROL OF ITS OWN (`action`) in the trailing-most slot,
// the chevron's. It does not take the trailing edge, which keeps its content
// inboard (on Saved, when the reader saved the thing — the list's whole
// order). With an action the row splits into the pressable part and the
// control beside it, so nothing nests a button in a button.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.CograAvatar

private val DISC = 40.dp

@Composable
private fun Disc(disc: ContentRowDisc) {
    when (disc) {
        ContentRowDisc.Redacted -> Box(
            Modifier
                .size(DISC)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        )

        is ContentRowDisc.Picture -> CograAvatar(name = disc.name, size = DISC, url = disc.url)
        is ContentRowDisc.Monogram -> CograAvatar(name = disc.name, size = DISC)
        is ContentRowDisc.Glyph -> Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(DISC)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            Icon(
                disc.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

/**
 * The `chronicle` variant: the second line is the thing's own words, in body
 * type; the trailing edge is a time, a quiet fact.
 *
 * @param titleQuiet the title in the system's voice (`Removed by its author`).
 * @param second one line under the title — words, or a node (the row line).
 * @param node the registered row (`saved.list.entry`, keyed); its parts wear
 *   their own paths under it, and [testTag] stands in where no board names it.
 */
@Composable
fun ContentRow(
    title: String,
    disc: ContentRowDisc,
    testTag: String,
    modifier: Modifier = Modifier,
    titleAside: String? = null,
    titleQuiet: Boolean = false,
    second: (@Composable () -> Unit)? = null,
    trailing: String? = null,
    onOpen: (() -> Unit)? = null,
    action: (@Composable () -> Unit)? = null,
    node: DataNode? = null,
) {
    // A DELETED ACCOUNT'S ROW (HA-3, design digest item 56): the reserved disc
    // and `Deleted account` in the system's voice, the aside dropped.
    val redacted = disc == ContentRowDisc.Redacted
    val shownTitle = if (redacted) stringResource(R.string.content_row_deleted_account) else title
    val aside = if (redacted) null else titleAside
    val quiet = redacted || titleQuiet
    val part: (String) -> DataNode? = { name -> node?.let { DataNode("${it.path}.$name") } }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .then(if (node != null) Modifier.dataNode(node) else Modifier.testTag(testTag))
            .padding(end = if (action != null) 12.dp else 0.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .weight(1f)
                .then(if (onOpen != null) Modifier.clickable(onClick = onOpen) else Modifier)
                .testTag("${testTag}_open")
                .padding(start = 12.dp, top = 12.dp, bottom = 12.dp, end = if (action != null) 0.dp else 12.dp),
        ) {
            Box(Modifier.dataNode(part("disc"))) { Disc(disc) }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                TitleLine(shownTitle, quiet, aside, part)
                second?.let { line ->
                    Box(Modifier.dataNode(part("second"))) { line() }
                }
            }
            trailing?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.dataNode(part("trailing")),
                )
            }
        }
        action?.invoke()
    }
}

@Composable
private fun TitleLine(title: String, quiet: Boolean, aside: String?, part: (String) -> DataNode?) {
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = if (quiet) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .weight(1f, fill = false)
                .dataNode(part("title")),
        )
        aside?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                modifier = Modifier.dataNode(part("aside")),
            )
        }
    }
}

/** A second line of words, in the chronicle's body type, one line ellipsized. */
@Composable
fun ContentRowSecond(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}
