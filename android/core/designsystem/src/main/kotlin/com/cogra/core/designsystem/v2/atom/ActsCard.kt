// `ActsCard` (design/components/compose/ActsCard.jsx): the container-highest
// card listing what one signature commits — one row per act (quiet label ·
// value · count, a hairline under each, at least 44 tall), the total as its
// footer, and under the total the all-or-nothing line on a seal that signs
// more than one act, or, past 5s of signing, the slow line in the olive ink,
// announced once as a status.
//
// The generic drawing, for a seal whose rows are plain facts (the kept picks'
// seal first). The compose seal, the reply seal and the edits keep their own
// row kinds — doors, refused lines, chips — and are not moved here in this
// change (backlog: one ActsCard for every seal).

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.TypeTokens

/** `ActsCard.jsx` ROW's 44px floor. */
private val ACT_ROW_MIN = 44.dp

/** `ActsCard.jsx` LABEL's 76px column. */
private val ACT_LABEL = 76.dp

/** `They land together, or none does.` — the multi-act subline. */
const val ACTS_ALL_OR_NOTHING = "They land together, or none does."

/** The slow line past 5s of signing (copy-voice *Commits that wait*). */
const val ACTS_SLOW_LINE = "Still signing — the network is slow right now."

/** `4 things, signed together`, `1 thing, signed` at one. */
fun actsTotal(acts: Int): String = if (acts == 1) "1 thing, signed" else "$acts things, signed together"

/** A count as an ear hears it: `1 opinion`, `2 opinions`. */
fun actsCountReading(count: Int, noun: String): String = if (count == 1) "$count $noun" else "$count ${noun}s"

/**
 * The card. [node] names it (`keptPicksSeal.acts`); each row wears
 * `actRow` keyed by its place from 1, its parts `label`, `value` and `count`,
 * and the footer `total` and `note` — the registry's ActsCard paths.
 */
@Composable
fun ActsCard(rows: List<ActsCardRow>, slow: Boolean, modifier: Modifier = Modifier, node: DataNode? = null) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x4, vertical = Space.x1),
    ) {
        rows.forEachIndexed { index, row ->
            val rowNode = node?.div("actRow")?.keyed("${index + 1}")
            Column(Modifier.fillMaxWidth().dataNode(rowNode)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = ACT_ROW_MIN),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Space.x2),
                ) {
                    Text(
                        text = row.label,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(ACT_LABEL).dataNode(node?.div("actRow")?.div("label")),
                    )
                    Column(Modifier.weight(1f).dataNode(node?.div("actRow")?.div("value"))) { row.value() }
                    val spoken = actsCountReading(row.count, row.noun)
                    Text(
                        text = "${row.count}",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .dataNode(node?.div("actRow")?.div("count"))
                            .semantics { contentDescription = spoken },
                    )
                }
                Hairline()
            }
        }
        ActsFooter(acts = rows.sumOf { it.count }, slow = slow, node = node)
    }
}

/**
 * The total and its subline (`ActsCard.jsx`'s footer row): the total in
 * body-medium at label-large's weight, then the all-or-nothing line on a
 * multi-act seal — the slow line in its place past 5s, olive, a polite status.
 */
@Composable
private fun ActsFooter(acts: Int, slow: Boolean, node: DataNode?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .padding(vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
    ) {
        Text(
            text = actsTotal(acts),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = MaterialTheme.typography.labelLarge.fontWeight,
            ),
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.fillMaxWidth().dataNode(node?.div("total")),
        )
        val note = when {
            slow -> ACTS_SLOW_LINE
            acts > 1 -> ACTS_ALL_OR_NOTHING
            else -> null
        }
        if (note != null) {
            Text(
                text = note,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                color = if (slow) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .dataNode(node?.div("note"))
                    .then(if (slow) Modifier.semantics { liveRegion = LiveRegionMode.Polite } else Modifier),
            )
        }
    }
}
