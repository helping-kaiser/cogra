// THE COMPOSER'S PAIR SHEETS — `TagPadCompose` over a staged tag and `RefPair`
// over a staged citation (ComposeDetails.md: "tap the tag -> the tag's pair
// opens in a sheet over the stage"; seam 218/219 — the dialog with its
// write-through sliders and its −1 relevance floor was build drift). The web
// built the same pair (#234's `PairSheet`); this mirrors it.
//
// ONE SHEET, TWO FAMILIES. The boards are the same gesture: a sheet titled by
// what it edits, the pick's readout above a two-axis field, `Done` at the foot.
// They differ only in what the census gives each family — a tag's field runs
// from its +0.01 relevance floor and its confidence from 0, a citation's is the
// signed square — and in how the readout speaks: a tag's nearest of its
// thirteen objects with the anchor's words, a citation's stance face with the
// two axes named and no anchor word.
//
// THE SHEET HOLDS ITS OWN COPY UNTIL DONE. `Done` hands the pair over once;
// the scrim, a swipe down and Back close it and nothing staged in it applies.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.PairAxes
import com.cogra.core.designsystem.PairField
import com.cogra.core.designsystem.PairPoint
import com.cogra.core.designsystem.PairRanges
import com.cogra.core.designsystem.PairSliders
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.TagPoint
import com.cogra.core.designsystem.nearestStanceAnchor
import com.cogra.core.designsystem.nearestTagAnchor
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.twoPlaces
import com.cogra.core.designsystem.twoPlacesUnsigned
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.SheetTitle

/** The foot's line on both boards: nothing signs here; the pair rides its own act at the seal. */
const val PAIR_SHEET_FOOT = "Signed with the post, as its own action."

/** The readout's label, as the boards draw it. */
private const val PICK_LABEL = "Your pick"

/** What a readout draws and says for one pick. */
private data class PairReading(val face: String, val pair: String, val spoken: String)

/** `TagPadCompose` — a staged tag's pair, titled `#name`, its field floored at +0.01. */
@Composable
internal fun TagPairSheet(
    row: TagRow,
    testTagPrefix: String,
    onDone: (relevance: Double, confidence: Double) -> Unit,
    onDismiss: () -> Unit,
) {
    PairSheet(
        title = "#${row.name}",
        initial = PairPoint(row.relevance, row.confidence),
        ranges = PairRanges.Tag,
        axes = PairAxes.Tag,
        reading = { pick ->
            val at = TagPoint(pick.directed, pick.interest)
            val anchor = nearestTagAnchor(at)
            PairReading(
                face = anchor.emoji,
                pair = at.pair(),
                spoken = "$PICK_LABEL: ${stringResource(anchor.label)}. " +
                    "${PairAxes.Tag.directed} ${twoPlaces(pick.directed)}, " +
                    "${PairAxes.Tag.interest} ${twoPlacesUnsigned(pick.interest)}",
            )
        },
        onDone = { onDone(it.directed, it.interest) },
        onDismiss = onDismiss,
        testTagPrefix = "${testTagPrefix}_tag_pair",
    )
}

/** `RefPair` — a staged citation's pair, titled by what it cites, on the signed square. */
@Composable
internal fun ReferencePairSheet(
    row: ReferenceRow,
    testTagPrefix: String,
    onDone: (relevance: Double, support: Double) -> Unit,
    onDismiss: () -> Unit,
) {
    val label = referenceLabel(row.target)
    val title = referenceSupporting(row.target)?.let { "$label — $it" } ?: label
    PairSheet(
        title = title,
        initial = PairPoint(row.relevance, row.support),
        ranges = PairRanges.Signed,
        axes = PairAxes.Citation,
        reading = { pick ->
            val at = StancePoint(pick.directed, pick.interest)
            // The face survives the change of family; the anchor's WORD names a
            // feeling about a stance, and this record is a citation — so the
            // spoken reading names the two axes instead.
            PairReading(
                face = nearestStanceAnchor(at).emoji,
                pair = at.pair(),
                spoken = "$PICK_LABEL: ${PairAxes.Citation.directed} ${twoPlaces(pick.directed)}, " +
                    "${PairAxes.Citation.interest} ${twoPlaces(pick.interest)}",
            )
        },
        onDone = { onDone(it.directed, it.interest) },
        onDismiss = onDismiss,
        testTagPrefix = "${testTagPrefix}_reference_pair",
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PairSheet(
    title: String,
    initial: PairPoint,
    ranges: PairRanges,
    axes: PairAxes,
    reading: @Composable (PairPoint) -> PairReading,
    onDone: (PairPoint) -> Unit,
    onDismiss: () -> Unit,
    testTagPrefix: String,
) {
    // The sheet's own copy: it survives a configuration change, and nothing
    // outside the sheet sees it until Done.
    var directed by rememberSaveable(title) { mutableDoubleStateOf(ranges.directed.clamp(initial.directed)) }
    var interest by rememberSaveable(title) { mutableDoubleStateOf(ranges.interest.clamp(initial.interest)) }
    var exact by rememberSaveable(title) { mutableStateOf(false) }
    val pick = PairPoint(directed, interest)
    val set: (PairPoint) -> Unit = {
        directed = it.directed
        interest = it.interest
    }
    CograSheetHost(onDismissRequest = onDismiss) {
        CograSheetSurface(testTag = "${testTagPrefix}_sheet") {
            SheetTitle(text = title)
            PairReadout(reading(pick), "${testTagPrefix}_readout")
            if (exact) {
                PairSliders(
                    value = pick,
                    onValueChange = set,
                    ranges = ranges,
                    axes = axes,
                    testTagPrefix = "${testTagPrefix}_exact",
                )
            } else {
                PairField(
                    value = pick,
                    onValueChange = set,
                    ranges = ranges,
                    axes = axes,
                    exactValuesLabel = "Set exact values for $title",
                    onExactValues = { exact = true },
                    testTag = "${testTagPrefix}_field",
                )
            }
            Hairline()
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = PAIR_SHEET_FOOT,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                CograButton("Done", { onDone(pick) }, testTag = "${testTagPrefix}_done")
            }
        }
    }
}

/** The pick's readout above the field: the label, then the face and the exact pair; spoken whole. */
@Composable
private fun PairReadout(reading: PairReading, testTag: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = reading.spoken
                liveRegion = LiveRegionMode.Polite
            }
            .testTag(testTag),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = PICK_LABEL,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = reading.face,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.clearAndSetSemantics { },
            )
            Text(
                text = reading.pair,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier
                    .clearAndSetSemantics { this.testTag = "${testTag}_pair" },
            )
        }
    }
}
