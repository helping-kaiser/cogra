// THE SEAM (`_shared.jsx` `Seam`): the one list-splitting line the system
// draws — a hairline either side of quiet centred words. Explore's search
// wears it where the ranked rows end ("Beyond your reach — newest first"),
// and the feed's seen tail wears the same drawing with its own words
// (`FeedSeenTail`, round 11).

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Space

/**
 * `8 24` padding, 12 between, the hairline `outlineVariant` (`--border-hairline`)
 * and the words label-small in `onSurfaceVariant`. [node] names it; its words
 * wear `label`.
 */
@Composable
fun Seam(label: String, modifier: Modifier = Modifier, node: DataNode? = null) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .padding(horizontal = Space.x6, vertical = Space.x2),
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outlineVariant)
        Text(
            text = label,
            modifier = Modifier.dataNode(node?.div("label")),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outlineVariant)
    }
}
