package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.nearestStanceAnchor
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.token.Space

/**
 * **The** manager of staged citations (`design/components/compose/CitedSheet`,
 * jakob's ruling 2026-09-14, design backlog item 70) — the one surface behind
 * a seal's "N cited" row. One staged citation reads back as itself on the
 * seal; two or more read back as their count, and this is where the N is.
 *
 * **It is [com.cogra.core.designsystem.v2.compose.PickedSheet]'s shape**, for
 * the reason that sheet has its shape: a collection staged by an author is
 * managed in one place rather than in as many places as it appears. Rows, then
 * the word that closes the sheet.
 *
 * **It adds nothing.** No "+ Cite something" here: a post's seal carries no
 * add-rows by design and a door out of it that grew one would hand the seal a
 * stage's job, exactly as `PickedSheet` manages a pick without offering
 * another. Citations are staged where they are staged — the wizard's details
 * stage, the reply's own card.
 *
 * **Each control names its own citation** — "Remove <name>", "<name> — set how
 * it relates" — or a block of three is a block of identically-named controls.
 *
 * **What the row does not draw.** The master opens each row with `NodeMark`,
 * the kind's mark. Neither client carries a NodeMark: it belongs to the
 * READING side's reference-row family, which this change is held out of, so
 * the row starts at the name rather than inventing a second mark.
 *
 * Removal and re-pairing run through [ReferenceSectionState]'s own mutators —
 * the ones the details stage already drives — so the sheet manages the staged
 * set rather than keeping a second copy of it.
 */
@Composable
internal fun CitedSheet(
    section: ReferenceSectionState,
    onRemoveReference: (String) -> Unit,
    onTuneReference: (String) -> Unit,
    onDoneTuningReference: () -> Unit,
    onReferenceRelevanceChange: (String, Double) -> Unit,
    onReferenceSupportChange: (String, Double) -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    CograSheetSurface(modifier = modifier, testTag = testTag) {
        SheetTitle(text = "Cited · ${section.references.size}")
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            section.references.forEachIndexed { index, row ->
                CitedRow(
                    row = row,
                    onTune = { onTuneReference(row.targetId) },
                    onRemove = { onRemoveReference(row.targetId) },
                    testTag = testTag?.let { "${it}_row_$index" },
                )
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            CograButton(
                text = "Done",
                onClick = onDone,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_done" },
            )
        }
    }

    // The pair editor the details stage already opens from a staged chip —
    // one editor, driven by the section's own `tuning`, so the sheet and the
    // chips cannot drift into two ways of moving one pair.
    section.references.firstOrNull { it.targetId == section.tuning }?.let { row ->
        ReferenceParametersDialog(
            row = row,
            testTagPrefix = testTag ?: "cited_sheet",
            onRelevanceChange = { onReferenceRelevanceChange(row.targetId, it) },
            onSupportChange = { onReferenceSupportChange(row.targetId, it) },
            onDone = onDoneTuningReference,
        )
    }
}

/**
 * One staged citation, as the composer already draws it: what it points at,
 * the pair signed on the act, the × that takes it back out, and the name that
 * opens the pair.
 */
@Composable
private fun CitedRow(
    row: ReferenceRow,
    onTune: () -> Unit,
    onRemove: () -> Unit,
    testTag: String?,
) {
    val name = referenceLabel(row.target)
    val supporting = referenceSupporting(row.target)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x3, vertical = Space.x2)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 48.dp)
                .clip(MaterialTheme.shapes.small)
                .clickable(
                    role = Role.Button,
                    onClickLabel = "$name — set how it relates",
                    onClick = onTune,
                )
                .then(if (testTag != null) Modifier.testTag("${testTag}_repair") else Modifier),
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            supporting?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Text(
            text = citedPairReading(StancePoint(row.relevance, row.support)),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .heightIn(min = 48.dp)
                .clip(MaterialTheme.shapes.small)
                .clickable(role = Role.Button, onClickLabel = "Remove $name", onClick = onRemove)
                .then(if (testTag != null) Modifier.testTag("${testTag}_remove") else Modifier),
        )
    }
}

/**
 * The face, then the pair — the one string a staged citation wears wherever it
 * is read back, the same reading the seal's own reference row gives.
 */
@Composable
private fun citedPairReading(point: StancePoint): String =
    "${nearestStanceAnchor(point).emoji} ${point.pair()}"
