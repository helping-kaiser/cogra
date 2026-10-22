// The topic chip (design.md §6 "Topic chip — a tappable tag"): the
// compact reference a hashtag renders as everywhere it appears — a
// post/comment's chip row, the composer's staged tags, the topic
// screen's own header (`design/components/core/Chip.jsx` `TopicChip`).

package com.cogra.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.hitTarget

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
    /**
     * The chip's data-node on a registered screen, already keyed by its
     * name (`composeDetails.tags.tag:rust`): the chip then wears it and its
     * remove button the `remove` part, in place of [testTag]'s. The open
     * target beside the remove is not registered and keeps `<testTag>_open`.
     */
    node: DataNode? = null,
    /**
     * The inert cut (`TopicChip` `inert`): the same pill inside a larger tap
     * target — the detail's tags line, one control opening the sheet — so it
     * takes no press of its own and [onClick] is never called.
     */
    inert: Boolean = false,
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
    val chipTag = node?.tag ?: testTag
    val removeTag = node?.div("remove")?.tag ?: testTag?.let { "${it}_remove" }
    val chipModifier = modifier.then(if (chipTag != null) Modifier.testTag(chipTag) else Modifier)
    val chipLabel: @Composable () -> Unit = {
        if (reading == null) {
            // One line, never a wrapped pill (`Chip.jsx` `whiteSpace: nowrap`).
            Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis)
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
                modifier = if (removeTag != null) Modifier.testTag(removeTag) else Modifier,
            ) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = stringResource(R.string.topic_chip_remove, label),
                )
            }
        }
    } else {
        TopicPill(onClick = onClick, inert = inert, modifier = chipModifier.then(described), label = chipLabel)
    }
}

/**
 * THE TOPIC CHIP'S PILL (`design/components/core/Chip.jsx` `TopicChip`, size
 * `md`): 32dp inside a 1dp `--border-hairline` (outlineVariant) ring — 34dp
 * drawn — fully rounded, on `--surface-card` (surfaceContainerHighest), 12dp
 * of side padding, the name in `label-large` on `on-surface`. It answers at
 * 48dp without growing ([hitTarget]); the inert cut — inside a line that is
 * itself the control — takes no press of its own.
 */
@Composable
private fun TopicPill(
    onClick: () -> Unit,
    inert: Boolean,
    modifier: Modifier,
    label: @Composable () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .then(
                if (inert) {
                    Modifier
                } else {
                    Modifier.hitTarget(
                        interactive = Modifier
                            .clip(CircleShape)
                            .clickable(role = Role.Button, onClick = onClick),
                        drawnHeight = TopicChipHeight,
                    )
                },
            )
            .height(TopicChipHeight)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .border(TOPIC_CHIP_BORDER, MaterialTheme.colorScheme.outlineVariant, CircleShape)
            .padding(horizontal = TOPIC_CHIP_PADDING + TOPIC_CHIP_BORDER),
    ) {
        CompositionLocalProvider(
            LocalTextStyle provides MaterialTheme.typography.labelLarge,
            LocalContentColor provides MaterialTheme.colorScheme.onSurface,
        ) {
            label()
        }
    }
}

/** The pill's drawn height: 32dp inside its 1dp ring (`Chip.jsx` `md` + border). */
val TopicChipHeight = 34.dp

/** What a pill costs beyond its label's width: 12dp of padding and the 1dp ring, each side. */
val TopicChipHorizontalOverhead = 26.dp

private val TOPIC_CHIP_BORDER = 1.dp
private val TOPIC_CHIP_PADDING = 12.dp

/** Relevance is bipolar, so its sign is part of the reading (F8). */
private fun signed(value: Double): String = twoPlaces(value)

/** Two decimals, as every other parameter readout in the app shows them. */
private fun plain(value: Double): String = twoPlacesUnsigned(value)
