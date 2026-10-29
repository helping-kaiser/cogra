// ONE SIGNED PAIR, READ (`design/components/stance/StanceReadout.jsx`
// `StanceValue`): the face leads and the digits ride the reading mode — the
// `cg-exact` span paints only while the reader shows exact values — and the
// accessible name speaks the whole fact in both modes. The web's twin is
// `web/src/lib/ui2/stance-value.tsx`.

package com.cogra.core.designsystem.v2.atom

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
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
import com.cogra.core.designsystem.SEVERED_LABEL
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.bundleReadout
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.pair

/**
 * The face of [point] (`face`) and, in geek mode, its exact pair (`exact`),
 * heard as the face's word and the pair (`Warm, +0.55 / +0.20`). [zeroLabel]
 * says which zero a (0, 0) is — the data knows, the numbers do not.
 */
@Composable
fun StanceValue(
    point: StancePoint,
    modifier: Modifier = Modifier,
    @StringRes zeroLabel: Int = SEVERED_LABEL,
    node: DataNode? = null,
) {
    val readout = bundleReadout(point, zeroLabel)
    val pair = point.pair()
    val spoken = "${stringResource(readout.label)}, $pair"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = modifier
            .dataNode(node)
            .semantics(mergeDescendants = true) { contentDescription = spoken },
    ) {
        // The row's own name speaks the whole fact: the word and the pair.
        Text(
            text = readout.emoji,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.dataNode(node?.div("face")),
        )
        if (LocalShowExactValues.current) {
            Text(
                text = pair,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier.dataNode(node?.div("exact")),
            )
        }
    }
}
