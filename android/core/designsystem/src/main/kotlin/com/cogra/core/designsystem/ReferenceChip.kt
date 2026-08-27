// The reference chip (design.md §6, D16): the compact form a citation
// renders as everywhere it appears — a post/comment's reference row,
// the composer's staged references, the finder's candidate list.
// Deliberately plain ahead of the pending visual redesign, which is
// where the body-integrated mention render arrives (D15, D16).
//
// One component for every target class. The class decides the label
// the caller hands in — a mention reads as a handle, a quote as its
// author and title — but the chip itself is one shape, because
// quoting, embedding and mentioning are one record (D2).

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.util.Locale

/**
 * A citation's two parameters as a chip shows them once a reader asks
 * (D16). Plain doubles rather than the domain claim: the design system
 * carries no domain types (android/CLAUDE.md "Module discipline").
 */
data class ReferenceChipValues(val relevance: Double, val support: Double)

/**
 * One citation. [label] is what the target reads as — a handle for a
 * mention, a title or snippet for a quote — and [supporting] carries
 * the author beside it where there is one.
 *
 * A null [onClick] renders the chip inert rather than absent: a
 * citation toward a node this build cannot route to still *stands*,
 * and hiding it would misreport the graph. Material's disabled chip is
 * the documented way to say "readable, not actionable".
 *
 * [onRemove] turns on the remove affordance (the composer's staged
 * references, the edit screen's withdrawal gesture) as a separate tap
 * target beside the chip — two clickables nested inside one Material
 * chip surface merge their semantics under `mergeDescendants`, which
 * leaves assistive tech unable to address the inner one.
 *
 * [values] renders the two parameters beside the label, compactly and
 * signed. The compact form is an abbreviation, so the chip takes an
 * explicit `contentDescription` naming both.
 */
@Composable
fun ReferenceChip(
    label: String,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    onRemove: (() -> Unit)? = null,
    testTag: String? = null,
    values: ReferenceChipValues? = null,
) {
    val reading = values?.let {
        stringResource(R.string.reference_chip_values, signedValue(it.relevance), signedValue(it.support))
    }
    val spoken = values?.let {
        stringResource(
            R.string.reference_chip_values_description,
            listOfNotNull(label, supporting).joinToString(", "),
            signedValue(it.relevance),
            signedValue(it.support),
        )
    }
    val chipModifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
    val chipLabel: @Composable () -> Unit = {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Column {
                Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                supporting?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            reading?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
    val described = if (spoken == null) Modifier else Modifier.semantics { contentDescription = spoken }
    if (onRemove != null) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy((-8).dp),
            modifier = chipModifier,
        ) {
            AssistChip(
                onClick = onClick ?: {},
                enabled = onClick != null,
                label = chipLabel,
                modifier = described.then(
                    if (testTag != null) Modifier.testTag("${testTag}_open") else Modifier,
                ),
            )
            IconButton(
                onClick = onRemove,
                modifier = if (testTag != null) Modifier.testTag("${testTag}_remove") else Modifier,
            ) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = stringResource(R.string.reference_chip_remove, label),
                )
            }
        }
    } else {
        AssistChip(
            onClick = onClick ?: {},
            enabled = onClick != null,
            label = chipLabel,
            modifier = chipModifier.then(described),
        )
    }
}

/** Both citation parameters are bipolar, so both readings carry their sign. */
private fun signedValue(value: Double): String =
    String.format(Locale.getDefault(), "%+.2f", value)
