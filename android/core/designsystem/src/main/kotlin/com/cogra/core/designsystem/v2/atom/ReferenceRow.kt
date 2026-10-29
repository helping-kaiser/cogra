// THE RESULT ROW (`design/components/content/ReferenceRow.jsx`): every row is
// leading mark · name · value, so a heterogeneous list reads as one list. The
// search results and Your topics read it; web's twin is
// `web/src/lib/ui2/reference-row.tsx`.
//
// THE LEADING MARK SAYS THE KIND without a word beside it (`NodeMark`): a
// person keeps their avatar — people are circles everywhere — and every other
// kind is a 32dp tile at the small rung: a post with a cover wears it, a text
// post the letter T, a comment its node glyph, a topic the `#` its chip wears.
//
// THE RIGHT EDGE IS ONE OF THREE: the viewer-relative RANK beside the score's
// graph glyph (a ranked search row), a plain VALUE (an age past the seam or
// under Newest), or the signed PAIR (Your topics' Affinity: the face, with the
// digits painted only in geek mode and spoken either way).

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.bundleReadout
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/** The kinds a row's mark tells apart (`NodeMark`'s `kind`). */
enum class MarkKind { POST, COMMENT, PERSON, TOPIC }

/** What stands on a row's right edge. */
sealed interface RowEdge {
    /** The viewer-relative rank, beside the score's graph glyph (`9.10`). */
    data class Rank(val rank: String) : RowEdge

    /** A plain string printed as given — an age; geek mode never touches it. */
    data class Value(val value: String) : RowEdge

    /** An Affinity pair the reader signed (`pairFamily="stance"`): the face, the digits in geek mode. */
    data class Stance(val point: StancePoint) : RowEdge
}

/** The mark's edge (`NodeMark`'s default 32). */
private val MARK = 32.dp

/** The rank's graph glyph (`Icon name="graph" size={14}`). */
private val RANK_GLYPH = 14.dp

/**
 * A node kind's mark: an avatar for a person, else a 32dp tile — the cover,
 * `T`, `#`, or the comment's glyph — on `surfaceContainerHighest`.
 */
@Composable
fun NodeMark(kind: MarkKind, name: String, src: String?, modifier: Modifier = Modifier) {
    if (kind == MarkKind.PERSON) {
        CograAvatar(name = name, size = MARK, url = src, modifier = modifier)
        return
    }
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(MARK)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest),
    ) {
        when {
            kind == MarkKind.POST && src != null -> AsyncImage(
                model = src,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(MARK),
            )
            kind == MarkKind.COMMENT -> Icon(
                Icons.Filled.ChatBubble,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
            else -> Text(
                text = if (kind == MarkKind.TOPIC) "#" else "T",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                // The letter is the kind's picture, not a word to read out.
                modifier = Modifier.clearAndSetSemantics {},
            )
        }
    }
}

/**
 * One result row (`ReferenceRow`): min 48dp, `4 24` padding, 12 between the
 * mark, the name over its one-line [sub], and the right [edge]. The row is
 * one button, heard as its name, its sub and its edge (the rank's number is
 * its own screen-reader twin; a face is heard as its word and exact pair).
 *
 * [pending] stacks the settling marker under the edge (`PendingMarker`).
 */
@Composable
fun ReferenceRow(
    kind: MarkKind,
    name: String,
    modifier: Modifier = Modifier,
    sub: String? = null,
    src: String? = null,
    edge: RowEdge? = null,
    pending: Boolean = false,
    onOpen: (() -> Unit)? = null,
    node: DataNode? = null,
    testTag: String? = null,
) {
    val part: (String) -> DataNode? = { node?.let { n -> DataNode("${n.path}.$it") } }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        modifier = modifier
            .fillMaxWidth()
            .then(if (onOpen != null) Modifier.clickable(onClick = onOpen) else Modifier)
            .defaultMinSize(minHeight = Layout.TouchTargetMin)
            .then(if (node != null) Modifier.dataNode(node) else Modifier.dataNode(testTag?.let(::DataNode)))
            .padding(horizontal = Space.x6, vertical = Space.x1),
    ) {
        NodeMark(kind, name, src, Modifier.dataNode(part("mark")))
        Column(Modifier.weight(1f)) {
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                // A block in its column, as the master's span is.
                modifier = Modifier.fillMaxWidth().dataNode(part("name")),
            )
            if (sub != null) {
                Text(
                    text = sub,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().dataNode(part("sub")),
                )
            }
        }
        RightEdge(edge, pending, part)
    }
}

@Composable
private fun RightEdge(edge: RowEdge?, pending: Boolean, part: (String) -> DataNode?) {
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant
    when (edge) {
        is RowEdge.Rank -> Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x1),
            modifier = Modifier.dataNode(part("rank")),
        ) {
            GraphGlyph(RANK_GLYPH, quiet)
            Text(edge.rank, style = MaterialTheme.typography.bodySmall, color = quiet, maxLines = 1)
        }
        else -> if (edge != null || pending) {
            Column(horizontalAlignment = Alignment.End, modifier = Modifier.dataNode(part("value"))) {
                when (edge) {
                    is RowEdge.Value -> Text(edge.value, style = MaterialTheme.typography.bodySmall, color = quiet)
                    is RowEdge.Stance -> StanceEdge(edge.point)
                    else -> Unit
                }
                if (pending) {
                    Text(
                        text = stringResource(R.string.pending_settling),
                        style = MaterialTheme.typography.bodySmall,
                        color = quiet,
                    )
                }
            }
        }
    }
}

/** The face, and its digits only while the reader asked for exact values (geek mode). */
@Composable
private fun StanceEdge(point: StancePoint) {
    val readout = bundleReadout(point)
    // Heard the same in both paintings: the face's word and the exact pair.
    val spoken = "${stringResource(readout.label)}, ${point.pair()}"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x1),
        modifier = Modifier.clearAndSetSemantics { contentDescription = spoken },
    ) {
        // `ReferenceRow.jsx`: the face at body-medium with `lineHeight: 1`, so it
        // stands no taller than its own glyph.
        Text(
            text = readout.emoji,
            style = MaterialTheme.typography.bodyMedium.let { it.copy(lineHeight = it.fontSize) },
        )
        if (LocalShowExactValues.current) {
            Text(
                text = point.pair(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
    }
}

/**
 * The score's glyph (`Icon.jsx` `graph`): a branching graph — the score comes
 * out of the graph. Material Symbols' path on its own 960 box, drawn to
 * [size] in [tint]; decorative, the number beside it is what is said.
 */
@Composable
fun GraphGlyph(size: Dp, tint: Color, modifier: Modifier = Modifier) {
    val path = remember { PathParser().parsePathString(GRAPH_PATH).toPath() }
    Canvas(modifier.size(size)) {
        val factor = this.size.minDimension / GRAPH_BOX
        scale(factor, factor, pivot = Offset.Zero) {
            translate(top = GRAPH_BOX) { drawPath(path, tint) }
        }
    }
}

private const val GRAPH_BOX = 960f

private const val GRAPH_PATH =
    "M480-80q-50 0-85-35t-35-85q0-5 .5-11t1.5-11l-83-47q-16 14-36 21.5t-43 7.5q-50 0-85-35t-35-85q0-50 35-85" +
        "t85-35q24 0 45 9t38 25l119-60q-3-23 2.5-45t19.5-41l-34-52q-7 2-14.5 3t-15.5 1q-50 0-85-35t-35-85q0-50 " +
        "35-85t85-35q50 0 85 35t35 85q0 20-6.5 38.5T456-688l35 52q8-2 15-3t15-1q17 0 32 4t29 12l66-54q-4-10-6-" +
        "20.5t-2-21.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-17 0-32-4.5T699-617l-66 55q4 10 6 " +
        "20.5t2 21.5q0 50-35 85t-85 35q-24 0-45.5-9T437-434l-118 59q2 9 1.5 18t-2.5 18l84 48q16-14 35.5-21.5" +
        "T480-320q50 0 85 35t35 85q0 50-35 85t-85 35Z"

@ThemePreviews
@Composable
private fun ReferenceRowPreview() {
    Cogra2PreviewTheme {
        Column {
            ReferenceRow(MarkKind.POST, "Salt maps of the coast road", edge = RowEdge.Rank("9.10"), onOpen = {})
            ReferenceRow(MarkKind.TOPIC, "saltmaps", sub = "tagged by @sol", edge = RowEdge.Rank("3.40"), onOpen = {})
            ReferenceRow(MarkKind.COMMENT, "The wax-stick ones", sub = "on Salt flats", edge = RowEdge.Value("2h"))
            ReferenceRow(MarkKind.PERSON, "Sal Torres", sub = "@saltorres", edge = RowEdge.Rank("4.20"))
            ReferenceRow(
                MarkKind.TOPIC,
                "#fieldnotes",
                edge = RowEdge.Stance(StancePoint(directed = 0.3, interest = 0.15)),
                pending = true,
            )
        }
    }
}
