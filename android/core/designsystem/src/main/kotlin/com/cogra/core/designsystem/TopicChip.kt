// The topic chip (design.md §6 "Topic chip — a tappable tag"): the
// compact reference a hashtag renders as everywhere it appears — a
// post/comment's chip row, the composer's staged tags, the topic
// screen's own header. Plain Material 3; the slice ships deliberately
// unstyled ahead of the pending visual redesign pass over slice 2.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.unit.dp
import java.util.Locale

/**
 * A tag claim's two parameters as a chip shows them once a reader asks
 * for them (F8). Plain doubles rather than the domain claim: the design
 * system carries no domain types (android/CLAUDE.md "Module discipline").
 */
data class TagChipValues(val relevance: Double, val confidence: Double)

/**
 * One topic reference — the canonical name, already normalized
 * (lowercase, no `#`; hashtag.md §1). [onRemove] turns on the chip's
 * remove affordance (the composer's staged tags, the chip row's
 * remove gesture on owned content): a separate tap target sitting
 * beside the chip rather than nested inside it — two clickables
 * nested inside one Material chip surface merge their semantics
 * under `mergeDescendants`, which leaves assistive tech (and this
 * component's own tests) unable to address the inner one on its own.
 * [onRemove]'s absence renders a plain tappable chip that opens the
 * topic (hashtag.md §5).
 *
 * [values] renders the claim's two parameters beside the name, compactly
 * and signed (F8). The compact form is an abbreviation, so the chip
 * takes an explicit `contentDescription` naming both parameters —
 * assistive tech reads the claim, not "plus zero point four zero"
 * stranded after a name.
 */
@Composable
fun TopicChip(
    name: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onRemove: (() -> Unit)? = null,
    testTag: String? = null,
    values: TagChipValues? = null,
) {
    val label = "#$name"
    val reading = values?.let {
        stringResource(R.string.topic_chip_values, signed(it.relevance), plain(it.confidence))
    }
    val spoken = values?.let {
        stringResource(
            R.string.topic_chip_values_description,
            name,
            signed(it.relevance),
            plain(it.confidence),
        )
    }
    val chipModifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
    val chipLabel: @Composable () -> Unit = {
        if (reading == null) {
            Text(label)
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(label)
                Text(
                    reading,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
    val described = if (spoken == null) {
        Modifier
    } else {
        Modifier.semantics { contentDescription = spoken }
    }
    if (onRemove != null) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy((-8).dp),
            modifier = chipModifier,
        ) {
            AssistChip(
                onClick = onClick,
                label = chipLabel,
                // The row is the group; the chip itself is the tap
                // target beside the remove button, so it is addressable
                // on its own.
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
                    contentDescription = stringResource(R.string.topic_chip_remove, label),
                )
            }
        }
    } else {
        AssistChip(
            onClick = onClick,
            label = chipLabel,
            modifier = chipModifier.then(described),
        )
    }
}

/** Relevance is bipolar, so its sign is part of the reading (F8). */
private fun signed(value: Double): String = String.format(Locale.getDefault(), "%+.2f", value)

/** Two decimals, as every other parameter readout in the app shows them. */
private fun plain(value: Double): String = String.format(Locale.getDefault(), "%.2f", value)
