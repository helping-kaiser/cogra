// ONE ROW OF A TAG'S PAGE (`TaggedRow.jsx`; TagPage.md:15, :19): the claim
// that put this content here, then the content's own card attached under it.
//
// THE PAIR BELONGS TO THE ROW, NOT THE CARD: `taggedContent` hands back the
// node and the tag record's own pair, so the card is the feed's, untouched,
// and the claim stands above it as a flag flush with the list's left edge —
// the card squaring its top-left corner under it, one folder-tab silhouette.
//
// THE GLYPH CARRIES THE READING, the numbers are the geek one (readme §13):
// the claim's nearest of the tag table's objects leads, `Tagged` says which
// act it was, and the exact pair paints only in geek mode. The row speaks as
// one thing in both modes — an object's own accessible name says nothing
// about a claim — and a claim still in flight wears the settling marker.

package com.cogra.feature.topics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.TagPoint
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.tagReadout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.TaggedContentView

/** The flag's inset: 2 above and below, 10 at the sides (`TaggedRow.jsx`). */
private val FLAG_VERTICAL = 2.dp
private val FLAG_HORIZONTAL = 10.dp

/**
 * The claim above [card], wearing [node] keyed by the thing's id, its parts
 * `glyph`, `exact` and `pending` under it.
 */
@Composable
internal fun TaggedRow(entry: TaggedContentView, node: DataNode, card: @Composable () -> Unit) {
    Column {
        ClaimFlag(entry, node.keyed(entry.id))
        card()
    }
}

/** The flag: the glyph, `Tagged`, the exact pair in geek mode, and the settling marker. */
@Composable
private fun ClaimFlag(entry: TaggedContentView, node: DataNode) {
    val point = TagPoint(entry.relevance, entry.confidence)
    val anchor = tagReadout(point)
    val exact = point.pair()
    val spoken = stringResource(R.string.topics_claim_spoken, stringResource(anchor.label), exact)
    val small = MaterialTheme.shapes.small
    Row(
        modifier = Modifier
            .dataNode(node)
            .background(
                MaterialTheme.colorScheme.surfaceContainerHigh,
                small.copy(bottomStart = CornerSize(0.dp), bottomEnd = CornerSize(0.dp)),
            )
            .padding(horizontal = FLAG_HORIZONTAL, vertical = FLAG_VERTICAL),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The visible parts speak as one: the reading, in both modes.
        Row(
            modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = spoken },
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // The glyph at body-medium on a line of 1 (`TaggedRow.jsx`), so the
            // flag's height is the body-small line's, 20 with its inset.
            val glyph = MaterialTheme.typography.bodyMedium
            Text(
                text = anchor.emoji,
                style = glyph.copy(lineHeight = glyph.fontSize),
                modifier = Modifier.dataNode(node / "glyph"),
            )
            Text(
                text = stringResource(R.string.topics_claim_tagged),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (LocalShowExactValues.current) {
                Text(
                    text = exact,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    modifier = Modifier.dataNode(node / "exact"),
                )
            }
        }
        if (entry.pending) PendingMarker(testTag = (node / "pending").tag)
    }
}
