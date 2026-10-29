package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.TagParameterSliders
import com.cogra.core.designsystem.TopicChip
import com.cogra.core.designsystem.dataNode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.topics.TagNameProblem
import com.cogra.domain.topics.canonicalTagName
import com.cogra.domain.topics.isAddableTagName
import com.cogra.domain.topics.tagNameProblem

/**
 * The tags section, on both the creation composer and the edit screen
 * (F3): free text (D15: no autocomplete) with a live canonicalization
 * preview, add-as-chip gated on L1's atom rule (F1), tap-a-chip for its
 * two parameters (F6), remove-before-send, capped at 10 (D18). Each
 * chip carries the server's own words when a write was refused on it
 * (F2).
 */
@Composable
internal fun TopicEntry(
    section: TagSectionState,
    testTagPrefix: String,
    onTagInputChange: (String) -> Unit,
    onAddTag: () -> Unit,
    onRemoveTag: (String) -> Unit,
    onTuneTag: (String) -> Unit,
    onDoneTuningTag: () -> Unit,
    onTagRelevanceChange: (String, Double) -> Unit,
    onTagConfidenceChange: (String, Double) -> Unit,
    /** The comment surfaces sit inside a card; the heading would only repeat. */
    showHeading: Boolean = true,
    /**
     * A chip opens its pair in `TagPadCompose`'s sheet, staged until Done,
     * rather than the write-through dialog. The compose Details stage opts in
     * (ComposeDetails.md); the edit, reply and comment surfaces keep the
     * dialog until their own boards (`TagPad`, `RefPairEdit`) are built.
     */
    pairSheet: Boolean = false,
    /**
     * The composer's own drawing (`ComposeDetailsBody`): the block headed by
     * `FieldLabel` `Tags`, 6 apart, and each staged tag a `TopicRemovable`
     * pill. The edit, reply and comment surfaces keep theirs until their own
     * boards are conformed.
     */
    staged: Boolean = false,
    /**
     * The section's data-node on a registered screen (`composeDetails.tags`):
     * the section, its heading (`label`), each chip (keyed by its name) and
     * the add action then wear the registered paths. The free-text field, the
     * preview and the refusals are not drawn on the board and keep their
     * [testTagPrefix] tags.
     */
    node: DataNode? = null,
    /** False where the host's own group wears [node] — its label and lines beside the section (the edit). */
    wearsRoot: Boolean = true,
) {
    val tagInput = section.input
    Column(
        verticalArrangement = Arrangement.spacedBy(sectionGap(staged)),
        modifier = Modifier.fillMaxWidth().dataNode(node.takeIf { wearsRoot }),
    ) {
        if (showHeading) {
            SectionHeading(
                text = stagedOr(staged, "Tags", stringResource(R.string.content_topics_heading)),
                staged = staged,
                node = node?.div("label"),
            )
        }
        if (section.tags.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.testTag("${testTagPrefix}_tags"),
            ) {
                section.tags.forEach { row ->
                    StagedTagChip(
                        name = row.name,
                        staged = staged,
                        onTune = { onTuneTag(row.name) },
                        onRemove = { onRemoveTag(row.name) },
                        testTag = "${testTagPrefix}_tag_${row.name}",
                        node = node?.div("tag")?.keyed(row.name),
                    )
                }
            }
            // Verbatim, on the chip the server named (F2).
            section.tags.forEach { row ->
                row.error?.let { message ->
                    ErrorLine(message, "${testTagPrefix}_tag_error_${row.name}")
                }
            }
        }
        if (section.capReached) {
            Text(
                stringResource(R.string.content_topics_cap_reached, MAX_TAGS),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("${testTagPrefix}_tags_cap"),
            )
        } else {
            val problem = tagNameProblem(tagInput)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedTextField(
                    value = tagInput,
                    onValueChange = onTagInputChange,
                    label = { Text(stringResource(R.string.content_topics_field)) },
                    singleLine = true,
                    isError = problem != null,
                    modifier = Modifier
                        .weight(1f)
                        .testTag("${testTagPrefix}_tag_input"),
                )
                // The gate is UX, not validation — the server stays the
                // authority — but a name the substrate cannot carry
                // never reaches a signature (F1).
                TextButton(
                    onClick = onAddTag,
                    enabled = isAddableTagName(tagInput),
                    modifier = Modifier.testTag(node?.div("add")?.tag ?: "${testTagPrefix}_tag_add"),
                ) {
                    Text(stringResource(R.string.content_topics_add))
                }
            }
            if (problem != null) {
                ErrorLine(problem.message(), "${testTagPrefix}_tag_illegal")
            } else if (tagInput.isNotBlank()) {
                Text(
                    stringResource(R.string.content_topics_preview, canonicalTagName(tagInput)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.testTag("${testTagPrefix}_tag_preview"),
                )
            }
        }
    }
    section.tags.firstOrNull { it.name == section.tuning }?.let { row ->
        if (pairSheet) {
            TagPairSheet(
                row = row,
                testTagPrefix = testTagPrefix,
                onDone = { relevance, confidence ->
                    onTagRelevanceChange(row.name, relevance)
                    onTagConfidenceChange(row.name, confidence)
                    onDoneTuningTag()
                },
                onDismiss = onDoneTuningTag,
            )
        } else {
            TagParametersDialog(
                row = row,
                testTagPrefix = testTagPrefix,
                onRelevanceChange = { onTagRelevanceChange(row.name, it) },
                onConfidenceChange = { onTagConfidenceChange(row.name, it) },
                onDone = onDoneTuningTag,
            )
        }
    }
}

/** Why this name cannot be an identifier atom, in the reader's terms (F1). */
@Composable
private fun TagNameProblem.message(): String = stringResource(
    when (this) {
        TagNameProblem.WHITESPACE -> R.string.content_topics_illegal_whitespace
        TagNameProblem.TOO_LONG -> R.string.content_topics_illegal_too_long
        TagNameProblem.ILLEGAL_CHARSET -> R.string.content_topics_illegal_charset
    },
)

/**
 * One chip's two parameters (F6). The dialog only closes the editor —
 * every change is already in the draft, and nothing here signs.
 */
@Composable
private fun TagParametersDialog(
    row: TagRow,
    testTagPrefix: String,
    onRelevanceChange: (Double) -> Unit,
    onConfidenceChange: (Double) -> Unit,
    onDone: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDone,
        modifier = Modifier.testTag("${testTagPrefix}_tag_params"),
        title = { Text("#${row.name}") },
        text = {
            TagParameterSliders(
                relevance = row.relevance,
                confidence = row.confidence,
                onRelevanceChange = onRelevanceChange,
                onConfidenceChange = onConfidenceChange,
                testTagPrefix = "${testTagPrefix}_tag_params",
            )
        },
        confirmButton = {
            TextButton(
                onClick = onDone,
                modifier = Modifier.testTag("${testTagPrefix}_tag_params_done"),
            ) {
                Text(stringResource(R.string.content_topics_params_done))
            }
        },
    )
}

/** One axis of a license, as the read surface says it. */
internal data class LicenseReading(val axis: String, val reading: String)

/**
 * What a pair obliges, per axis, IN THE REUSER'S VOICE
 * (`LicenseChooser.jsx:36-49`). The chooser's hints address the author
 * declaring the terms — "Every use credits you" — which on a read
 * surface told a reuser they were owed the credit they in fact owe.
 *
 * BOTH ROWS ALWAYS STAND, whatever the pair: a block that dropped an
 * axis at zero would read as a shorter license rather than a term that
 * obliges nothing, and the two readings only read as a pair while they
 * are drawn as one. A degree between the published tiers reads as the
 * degree itself rather than being rounded into a tier it is not.
 */
@Composable
internal fun licenseReadings(license: LicenseChoice): List<LicenseReading> = listOf(
    LicenseReading(
        axis = stringResource(R.string.content_license_attribution_label),
        reading = when (license.attribution) {
            0.0 -> stringResource(R.string.content_license_reading_credit_none)
            0.5 -> stringResource(R.string.content_license_reading_credit_commercial)
            1.0 -> stringResource(R.string.content_license_reading_credit_always)
            else -> stringResource(
                R.string.content_license_reading_credit_degree,
                license.attribution.toString(),
            )
        },
    ),
    LicenseReading(
        axis = stringResource(R.string.content_license_provenance_label),
        reading = when (license.provenance) {
            0.0 -> stringResource(R.string.content_license_reading_record_none)
            0.5 -> stringResource(R.string.content_license_reading_record_commercial)
            1.0 -> stringResource(R.string.content_license_reading_record_always)
            else -> stringResource(
                R.string.content_license_reading_record_degree,
                license.provenance.toString(),
            )
        },
    ),
)

/** Whether a pair is the one readers already have a word for. */
internal fun isPublicDomain(license: LicenseChoice): Boolean =
    license.attribution == 0.0 && license.provenance == 0.0

/** A section's own gap: the composer's 6 (`ComposeDetailsBody`'s blocks), the entry's 8 elsewhere. */
internal fun sectionGap(staged: Boolean) = if (staged) 6.dp else 8.dp

/** The composer's word where it is drawn, the entry's elsewhere. */
internal fun stagedOr(staged: Boolean, composer: String, entry: String) = if (staged) composer else entry

/** A section's heading: `FieldLabel` (label-large) on the composer, the entry's title-small elsewhere. */
@Composable
internal fun SectionHeading(text: String, staged: Boolean, node: DataNode?) {
    Text(
        text = text,
        style = if (staged) MaterialTheme.typography.labelLarge else MaterialTheme.typography.titleSmall,
        modifier = Modifier.dataNode(node),
    )
}

/** One staged tag: `TopicRemovable` on the composer, the entry's chip elsewhere. */
@Composable
private fun StagedTagChip(
    name: String,
    staged: Boolean,
    onTune: () -> Unit,
    onRemove: () -> Unit,
    testTag: String,
    node: DataNode?,
) {
    if (staged) {
        TopicRemovable(name = name, onEdit = onTune, onRemove = onRemove, node = node, testTag = testTag)
    } else {
        TopicChip(name = name, onClick = onTune, onRemove = onRemove, testTag = testTag, node = node)
    }
}
