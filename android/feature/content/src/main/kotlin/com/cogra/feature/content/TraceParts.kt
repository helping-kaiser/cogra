// THE TRACE'S GLUE PARTS (`_shared.jsx`: ScoreColumn, ScoreOrigin, PathTrace,
// PathRow, ActionLog). They are not masters — the score readout builds them
// inside its own feature, never in the shared library (score-readout §6) — and
// every row that IS a master stays one: QuotedRow, ContentRow, the fact row,
// StanceValue. The web's twin is `web/src/app/trace/[id]/trace-parts.tsx`.

package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.GraphGlyph
import com.cogra.core.designsystem.v2.atom.MarkKind
import com.cogra.core.designsystem.v2.atom.NodeMark
import com.cogra.core.designsystem.v2.atom.QuotedRow
import com.cogra.core.designsystem.v2.atom.StanceValue
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.score.TracePerson
import com.cogra.domain.score.TraceThingKind

/** The trace's people at their trace size (`PathTrace size={24}`); the levels below draw them at 32. */
private val TRACE_FACE = 24.dp

/** The hairline between two faces (`width: 14, height: 1`). */
private val LINK = 14.dp

/** The reached thing, in its own mark at the trace's end. */
internal data class TraceEnd(val kind: TraceThingKind, val src: String?, val name: String)

/**
 * The drill-down's column — the read surface's own gutter, `8 16 0` with 12
 * between its children (`ScoreColumn`), scrolling under the header.
 */
@Composable
internal fun ScoreColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(start = Space.x4, end = Space.x4, top = Space.x2, bottom = Space.x4),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
        content = content,
    )
}

private fun TraceThingKind.mark(): MarkKind = when (this) {
    TraceThingKind.POST -> MarkKind.POST
    TraceThingKind.COMMENT -> MarkKind.COMMENT
    TraceThingKind.PERSON -> MarkKind.PERSON
    TraceThingKind.TOPIC -> MarkKind.TOPIC
}

/**
 * THE THING THE SCORE BELONGS TO, carried on all four levels (`ScoreOrigin`):
 * the flag — the `graph` glyph and the signed figure, spoken `Feed score` —
 * hung on the held thing's top-left as one entity. Plain text, never a door:
 * the reader is standing inside the explanation. [figure] null draws the flag
 * bare (nothing has answered, or the read failed — no figure is substituted).
 */
@Composable
internal fun ScoreOrigin(cover: TraceCover?, kind: TraceThingKind, figure: String?, node: DataNode) {
    val label = stringResource(R.string.content_feed_score)
    Column(Modifier.fillMaxWidth().dataNode(node)) {
        val small = MaterialTheme.shapes.small
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(small.copy(bottomStart = CornerSize(0.dp), bottomEnd = CornerSize(0.dp)))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                .dataNode(node / "flag")
                .semantics(mergeDescendants = true) {
                    contentDescription = if (figure == null) label else "$label $figure"
                }
                .padding(horizontal = 10.dp, vertical = 2.dp),
        ) {
            GraphGlyph(16.dp, MaterialTheme.colorScheme.onSurfaceVariant)
            if (figure != null) {
                Text(
                    text = figure,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.dataNode(node / "flag" / "value"),
                )
            }
        }
        val quote = node / "quote"
        when {
            cover == null -> Box(
                Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 56.dp)
                    .clip(small.copy(topStart = CornerSize(0.dp)))
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest),
            )
            kind == TraceThingKind.TOPIC -> QuotedRow(
                title = cover.title,
                snippet = cover.snippet,
                // A tag's face is its `#` tile, on the quote's own tone the darker one.
                mark = {
                    NodeMark(MarkKind.TOPIC, cover.title, null, Modifier.dataNode(quote / "disc"), onCard = true)
                },
                attach = true,
                node = quote,
            )
            else -> QuotedRow(
                title = cover.title,
                snippet = cover.snippet,
                name = cover.discName.orEmpty(),
                src = cover.discSrc,
                attach = true,
                node = quote,
            )
        }
    }
}

@Composable
private fun Link() {
    Box(Modifier.width(LINK).height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
}

/**
 * A PATH'S SHAPE (`PathTrace`): the people it runs through, in order, ending
 * on the thing it reached in that thing's own mark. The faces are decorative;
 * the trace speaks its own line ([spoken]), kind-neutral, ending `then what
 * reached you`. [onCard] gives the end tile the darker tone on a card's ground.
 */
@Composable
internal fun PathTrace(
    people: List<TracePerson?>,
    end: TraceEnd,
    spoken: String,
    size: Dp = TRACE_FACE,
    onCard: Boolean = false,
    node: DataNode? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier.clearAndSetSemantics {
            contentDescription = spoken
            node?.let { testTag = it.tag }
        },
    ) {
        people.forEachIndexed { index, person ->
            if (index > 0) Link()
            if (person == null) {
                // A deleted account's reserved disc (SR-G12).
                Box(Modifier.size(size).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceContainerHigh))
            } else {
                CograAvatar(name = person.displayName ?: person.handle, size = size, url = person.avatarUrl)
            }
        }
        Link()
        if (end.kind == TraceThingKind.PERSON) {
            CograAvatar(name = end.name, size = size, url = end.src)
        } else {
            NodeMark(end.kind.mark(), end.name, end.src, size = size, onCard = onCard)
        }
    }
}

/**
 * One path on the list (`PathRow`): `ContentRow`'s geometry with the trace where
 * the disc would be — the card ground, the medium corner, the 12dp padding, the
 * chevron that says this opens another surface.
 */
@Composable
internal fun PathRow(
    through: String,
    value: String,
    onOpen: () -> Unit,
    node: DataNode,
    trace: @Composable () -> Unit,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .dataNode(node)
            .clickable(role = Role.Button, onClick = onOpen)
            .padding(Space.x3),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Space.x1)) {
            trace()
            Text(
                text = through,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Normal,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().dataNode(DataNode("feedEntry.path.through")),
            )
        }
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.dataNode(DataNode("feedEntry.path.value")),
        )
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp).dataNode(DataNode("feedEntry.path.chevron")),
        )
    }
}

/**
 * The quiet row (FeedEntry.jsx): a text control and not a card — the paths
 * above it are destinations and this is a state change on this screen, so it
 * must not look like a fifth path. Heard as `Show 2 more paths`.
 */
@Composable
internal fun MorePathsRow(label: String, value: String, name: String, onUnfold: () -> Unit) {
    val row = FEED_ENTRY / "morePaths"
    Row(
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(row)
            .clickable(role = Role.Button, onClick = onUnfold)
            .semantics(mergeDescendants = true) { contentDescription = name }
            .defaultMinSize(minHeight = Layout.TouchTargetMin)
            .padding(horizontal = Space.x3),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Normal,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f).dataNode(row / "label"),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.dataNode(row / "value"),
        )
    }
}

/**
 * One record behind a step (`ActionLog`): inert, what it is in its step's own
 * title, its age, its pair through `StanceValue`, and its key in mono with no
 * copy control (jakob 2026-09-12). Keyed by the key it prints.
 */
@Composable
internal fun RecordRow(key: String, what: String, age: String, pair: StancePoint) {
    val self = (FEED_ENTRY / "record").keyed(key)
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x1),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .dataNode(self)
            .padding(Space.x3),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            Text(
                text = what,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).alignByBaseline().dataNode(DataNode("feedEntry.record.what")),
            )
            Text(
                text = age,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Normal,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.alignByBaseline().dataNode(DataNode("feedEntry.record.when")),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Space.x2), verticalAlignment = Alignment.CenterVertically) {
            StanceValue(pair, node = DataNode("feedEntry.record.pair"))
            Text(
                text = key,
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Normal,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f).dataNode(DataNode("feedEntry.record.key")),
            )
        }
    }
}
