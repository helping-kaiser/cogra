// The reference row on content (D16): the citations a piece of content
// currently carries — the carrier author's own, the channel that needs
// no forward-path weight (D12) — each tapping through to what it
// cites. Read-only wherever content is read: changing what a post
// references belongs on the screen where the post itself is edited.
//
// Deliberately plain, one uniform row for every target class. The
// body-integrated render — clickable, highlighted handles inside the
// text — arrives with jakob's mention design (D15, D16).

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.material3.IconToggleButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.ReferenceChip
import com.cogra.core.designsystem.ReferenceChipValues
import com.cogra.domain.ReferenceClaimView
import com.cogra.feature.content.R

/**
 * [onToggleValues] adds the row's reveal affordance: how strongly each
 * citation is made, on demand and never by default. It is the detail
 * view's gesture only — a feed card stays a card, so the callback is
 * absent there and no affordance renders.
 *
 * A chip whose target has no destination renders inert rather than
 * absent: the citation stands as a substrate fact, and hiding it would
 * misreport the graph.
 */
@Composable
internal fun ReferenceChipRow(
    references: List<ReferenceClaimView>,
    onOpenActor: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    testTagPrefix: String,
    valuesRevealed: Boolean = false,
    onToggleValues: (() -> Unit)? = null,
) {
    if (references.isEmpty()) return
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.testTag("${testTagPrefix}_references"),
    ) {
        references.forEach { claim ->
            val destination = referenceRoute(claim.target)
            ReferenceChip(
                label = referenceLabel(claim.target),
                supporting = referenceSupporting(claim.target),
                onClick = destination?.let { target ->
                    {
                        when (target) {
                            is ReferenceDestination.Profile -> onOpenActor(target.handle)
                            is ReferenceDestination.Post -> onOpenPost(target.id)
                        }
                    }
                },
                testTag = "${testTagPrefix}_reference_${claim.targetId}",
                values = if (valuesRevealed) {
                    ReferenceChipValues(claim.relevance, claim.support)
                } else {
                    null
                },
            )
        }
        if (onToggleValues != null) {
            // A toggle, not a button that opens something: the row has
            // an on/off state a reader can read back, which is what
            // `IconToggleButton` puts in the semantics tree.
            IconToggleButton(
                checked = valuesRevealed,
                onCheckedChange = { onToggleValues() },
                modifier = Modifier.testTag("${testTagPrefix}_references_reveal"),
            ) {
                Icon(
                    if (valuesRevealed) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = stringResource(
                        if (valuesRevealed) {
                            R.string.content_references_hide_values
                        } else {
                            R.string.content_references_show_values
                        },
                    ),
                )
            }
        }
    }
}
