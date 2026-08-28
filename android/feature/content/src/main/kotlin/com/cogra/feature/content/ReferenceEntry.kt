// The reference section every authoring surface carries, and the
// finder behind its add action (D18, D20).
//
// Deliberately plain: jakob is designing the finder's real interface,
// so 2.4 ships the structure — a stable picker surface bound once to a
// stable lookup query — and the look arrives with that design. What
// populates the finder before anything is typed is part of it, which
// is why an untouched finder shows nothing rather than guessing.

package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.ReferenceChip
import com.cogra.core.designsystem.ReferenceParameterSliders
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.references.MAX_REFERENCES
import com.cogra.feature.content.R

/**
 * The references section, on every authoring surface: staged chips
 * with the same tap-for-parameters affordance tags carry, an add
 * action that opens the finder, remove-before-send, capped at ten
 * (D7). Each chip carries the server's own words when a write was
 * refused on it.
 *
 * Unlike the tag section there is no free-text field here: a citation
 * names its target by id, so the finder is the only way in (D15).
 */
@Composable
internal fun ReferenceEntry(
    section: ReferenceSectionState,
    testTagPrefix: String,
    onOpenFinder: () -> Unit,
    onCloseFinder: () -> Unit,
    onFinderQueryChange: (String) -> Unit,
    onPickReference: (ReferenceCandidateRow) -> Unit,
    onRemoveReference: (String) -> Unit,
    onTuneReference: (String) -> Unit,
    onDoneTuningReference: () -> Unit,
    onReferenceRelevanceChange: (String, Double) -> Unit,
    onReferenceSupportChange: (String, Double) -> Unit,
    /** The comment surfaces sit inside a card; the heading would only repeat. */
    showHeading: Boolean = true,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (showHeading) {
            Text(
                stringResource(R.string.content_references_heading),
                style = MaterialTheme.typography.titleSmall,
            )
        }
        if (section.references.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.testTag("${testTagPrefix}_references"),
            ) {
                section.references.forEach { row ->
                    ReferenceChip(
                        label = referenceLabel(row.target),
                        supporting = referenceSupporting(row.target),
                        onClick = { onTuneReference(row.targetId) },
                        onRemove = { onRemoveReference(row.targetId) },
                        testTag = "${testTagPrefix}_reference_${row.targetId}",
                    )
                }
            }
            // Verbatim, on the chip the server named.
            section.references.forEach { row ->
                row.error?.let { message ->
                    ErrorLine(message, "${testTagPrefix}_reference_error_${row.targetId}")
                }
            }
        }
        if (section.capReached) {
            Text(
                stringResource(R.string.content_references_cap_reached, MAX_REFERENCES),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("${testTagPrefix}_references_cap"),
            )
        } else {
            TextButton(
                onClick = onOpenFinder,
                modifier = Modifier.testTag("${testTagPrefix}_reference_add"),
            ) {
                Text(stringResource(R.string.content_references_add))
            }
        }
    }
    section.finder?.let { finder ->
        ReferenceFinderSheet(
            finder = finder,
            testTagPrefix = testTagPrefix,
            onQueryChange = onFinderQueryChange,
            onPick = onPickReference,
            onDismiss = onCloseFinder,
        )
    }
    section.references.firstOrNull { it.targetId == section.tuning }?.let { row ->
        ReferenceParametersDialog(
            row = row,
            testTagPrefix = testTagPrefix,
            onRelevanceChange = { onReferenceRelevanceChange(row.targetId, it) },
            onSupportChange = { onReferenceSupportChange(row.targetId, it) },
            onDone = onDoneTuningReference,
        )
    }
}

/**
 * The finder (D20). A query field and what resolved — nothing more,
 * because the interface itself is being designed. Resolution is
 * exact-match today and slice 2.7 replaces it behind the same query,
 * so the copy says what the field accepts rather than promising
 * search.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReferenceFinderSheet(
    finder: ReferenceFinderState,
    testTagPrefix: String,
    onQueryChange: (String) -> Unit,
    onPick: (ReferenceCandidateRow) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("${testTagPrefix}_finder"),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                stringResource(R.string.content_references_finder_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("${testTagPrefix}_finder_title"),
            )
            OutlinedTextField(
                value = finder.query,
                onValueChange = onQueryChange,
                label = { Text(stringResource(R.string.content_references_finder_field)) },
                supportingText = {
                    Text(stringResource(R.string.content_references_finder_hint))
                },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("${testTagPrefix}_finder_query"),
            )
            when {
                finder.searching -> CircularProgressIndicator(
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .testTag("${testTagPrefix}_finder_searching"),
                )
                finder.failed -> ErrorLine(
                    R.string.content_references_finder_failed,
                    "${testTagPrefix}_finder_failed",
                )
                finder.foundNothing -> Text(
                    stringResource(R.string.content_references_finder_empty),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.testTag("${testTagPrefix}_finder_empty"),
                )
                else -> LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                    items(finder.candidates, key = { it.targetId }) { candidate ->
                        ListItem(
                            headlineContent = { Text(referenceLabel(candidate.target)) },
                            supportingContent = referenceSupporting(candidate.target)?.let {
                                { Text(it) }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .clickable { onPick(candidate) }
                                .testTag("${testTagPrefix}_finder_candidate_${candidate.targetId}"),
                        )
                    }
                }
            }
            Row(
                horizontalArrangement = Arrangement.End,
                modifier = Modifier.fillMaxWidth(),
            ) {
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.testTag("${testTagPrefix}_finder_cancel"),
                ) {
                    Text(stringResource(R.string.content_references_finder_cancel))
                }
            }
        }
    }
}

/**
 * One chip's two parameters. The dialog only closes the editor — every
 * change is already in the draft, and nothing here signs.
 */
@Composable
private fun ReferenceParametersDialog(
    row: ReferenceRow,
    testTagPrefix: String,
    onRelevanceChange: (Double) -> Unit,
    onSupportChange: (Double) -> Unit,
    onDone: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDone,
        modifier = Modifier.testTag("${testTagPrefix}_reference_params"),
        title = { Text(referenceLabel(row.target)) },
        text = {
            ReferenceParameterSliders(
                relevance = row.relevance,
                support = row.support,
                onRelevanceChange = onRelevanceChange,
                onSupportChange = onSupportChange,
                testTagPrefix = "${testTagPrefix}_reference_params",
            )
        },
        confirmButton = {
            TextButton(
                onClick = onDone,
                modifier = Modifier.testTag("${testTagPrefix}_reference_params_done"),
            ) {
                Text(stringResource(R.string.content_references_params_done))
            }
        },
    )
}

/**
 * What a target reads as. A mention shows the handle — it must resolve
 * against the actor's *current* one, which is why the body is never
 * parsed for it (D15) — and a quote shows its title or, lacking one, a
 * snippet.
 */
@Composable
internal fun referenceLabel(target: ReferenceTargetView?): String = when (target) {
    is ReferenceTargetView.Profile ->
        stringResource(R.string.reference_chip_mention, target.handle)
    is ReferenceTargetView.Content ->
        target.title?.takeIf { it.isNotBlank() }
            ?: target.snippet?.takeIf { it.isNotBlank() }
            ?: stringResource(R.string.reference_chip_untitled)
    // The citation stands as a substrate fact whether or not this
    // instance can type its far end.
    null -> stringResource(R.string.reference_chip_unresolved)
}

/** The author beside a quoted artifact; a mention is already its own name. */
@Composable
internal fun referenceSupporting(target: ReferenceTargetView?): String? = when (target) {
    is ReferenceTargetView.Content ->
        target.authorHandle?.let { stringResource(R.string.reference_chip_mention, it) }
    else -> null
}

/** Which destination a reference chip opens, or null when none exists. */
internal fun referenceRoute(target: ReferenceTargetView?): ReferenceDestination? = when (target) {
    is ReferenceTargetView.Profile -> ReferenceDestination.Profile(target.handle)
    is ReferenceTargetView.Content -> when (target.kind) {
        ReferenceContentKind.POST -> ReferenceDestination.Post(target.id)
        // A comment has no permalink — it is read inside the post that
        // carries it, so the chip lands there. When the walk ran out of
        // levels the chip renders without a destination rather than
        // guessing at one.
        ReferenceContentKind.COMMENT ->
            target.containingPostId?.let { ReferenceDestination.Post(it) }
    }
    null -> null
}

/** Where a reference chip's tap lands. */
internal sealed interface ReferenceDestination {
    data class Profile(val handle: String) : ReferenceDestination
    data class Post(val id: String) : ReferenceDestination
}
