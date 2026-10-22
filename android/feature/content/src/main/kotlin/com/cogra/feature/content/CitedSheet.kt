package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
 * **Its rows are the composer's own** ([StagedReferenceRow]): the details
 * stage already draws a staged citation with its mark, kind, pair and ×, and
 * a sheet that drew its own version would be the second drawing of one fact.
 *
 * **It adds nothing.** No "+ Cite something" here: a post's seal carries no
 * add-rows by design. **It is an editing sheet** (`BottomSheet.jsx`, the
 * editing-sheet exemption; ComposeCitations.md): each removal applies at
 * once, the last one closes the sheet to the seal (the host's job), and every
 * way out — Done included — just closes it. A name opens the citation's pair
 * in its own sheet over this one.
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
    ManagerSheet(title = "Cited · ${section.references.size}", onDone = onDone, testTag = testTag, modifier = modifier) {
        // `CitedSheet.jsx`: the rows 6 apart.
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            section.references.forEachIndexed { index, row ->
                StagedReferenceRow(
                    row = row,
                    onEdit = { onTuneReference(row.targetId) },
                    onRemove = { onRemoveReference(row.targetId) },
                    testTag = testTag?.let { "${it}_row_$index" },
                )
            }
        }
    }

    // The same pair sheet the details stage opens from a staged citation —
    // one editor, driven by the section's own `tuning`.
    section.references.firstOrNull { it.targetId == section.tuning }?.let { row ->
        ReferencePairSheet(
            row = row,
            testTagPrefix = testTag ?: "cited_sheet",
            onDone = { relevance, support ->
                onReferenceRelevanceChange(row.targetId, relevance)
                onReferenceSupportChange(row.targetId, support)
                onDoneTuningReference()
            },
            onDismiss = onDoneTuningReference,
        )
    }
}

/**
 * THE STAGED TAGS, OVER THE SEAL (`TagsSheet.jsx`; ComposeTags.md) — what the
 * seal's "N tags" row opens. It is [CitedSheet] with tags in it, on purpose:
 * the seal's two counting rows fold for one reason and open one kind of door.
 * The pills are the composer's own [TopicRemovable]; it adds nothing; it is an
 * editing sheet whose last removal closes it (the host's job).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TagsSheet(
    section: TagSectionState,
    onRemoveTag: (String) -> Unit,
    onTuneTag: (String) -> Unit,
    onDoneTuningTag: () -> Unit,
    onTagRelevanceChange: (String, Double) -> Unit,
    onTagConfidenceChange: (String, Double) -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    ManagerSheet(title = "Tags · ${section.tags.size}", onDone = onDone, testTag = testTag, modifier = modifier) {
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            section.tags.forEach { row ->
                TopicRemovable(
                    name = row.name,
                    onEdit = { onTuneTag(row.name) },
                    onRemove = { onRemoveTag(row.name) },
                    testTag = testTag?.let { "${it}_tag_${row.name}" },
                )
            }
        }
    }

    section.tags.firstOrNull { it.name == section.tuning }?.let { row ->
        TagPairSheet(
            row = row,
            testTagPrefix = testTag ?: "tags_sheet",
            onDone = { relevance, confidence ->
                onTagRelevanceChange(row.name, relevance)
                onTagConfidenceChange(row.name, confidence)
                onDoneTuningTag()
            },
            onDismiss = onDoneTuningTag,
        )
    }
}

/**
 * The managers' one anatomy (`CitedSheet.jsx` / `TagsSheet.jsx`): the title
 * 16 over the list, then `Done` as a text button at the foot's own `8 16 8` —
 * 16 from the screen's edge where the list keeps the sheet's 24.
 */
@Composable
private fun ManagerSheet(
    title: String,
    onDone: () -> Unit,
    testTag: String?,
    modifier: Modifier,
    list: @Composable () -> Unit,
) {
    CograSheetSurface(modifier = modifier, testTag = testTag, gap = 0.dp) {
        SheetTitle(text = title)
        // SheetTitle's own 8 under it, and the list's 8 over itself.
        Column(Modifier.fillMaxWidth().padding(top = Space.x4)) { list() }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .offset(x = Space.x2)
                .padding(top = Space.x2, bottom = Space.x2),
            horizontalArrangement = Arrangement.End,
        ) {
            CograButton(
                text = "Done",
                onClick = onDone,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_done" },
            )
        }
    }
}
