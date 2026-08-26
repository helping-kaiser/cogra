// The two parameters every Tag act carries (api-spec.md `TagInput`):
// relevance `r` — how much the topic is the content's — over the
// bipolar census range, and confidence `c` over [0, 1]. Sliders rather
// than the pad: the pad reads a stance toward a target, and these two
// are read one at a time (fix round 1, F6). Deliberately plain ahead of
// the redesign pass over slice 2.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.unit.dp

@Composable
fun TagParameterSliders(
    relevance: Double,
    confidence: Double,
    onRelevanceChange: (Double) -> Unit,
    onConfidenceChange: (Double) -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        LabeledSlider(
            label = stringResource(R.string.tag_relevance),
            value = relevance,
            onChange = onRelevanceChange,
            testTag = "${testTagPrefix}_relevance",
            valueRange = -1f..1f,
        ) {
            RelevanceScale(testTagPrefix)
        }
        LabeledSlider(
            label = stringResource(R.string.tag_confidence),
            value = confidence,
            onChange = onConfidenceChange,
            testTag = "${testTagPrefix}_confidence",
            valueRange = 0f..1f,
        )
    }
}

private val RELEVANCE_SCALE = listOf(
    R.string.tag_relevance_min,
    R.string.tag_relevance_zero,
    R.string.tag_relevance_max,
)

/**
 * Relevance is bipolar, so its centre is the meaningful mark: zero is
 * withdrawal, not "a little". The endpoints and that centre ride as
 * plain text under the track — the slider itself already announces its
 * value, so the scale stays out of the semantics tree.
 */
@Composable
private fun RelevanceScale(testTagPrefix: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clearAndSetSemantics { testTag = "${testTagPrefix}_relevance_scale" },
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        for (mark in RELEVANCE_SCALE) {
            Text(
                stringResource(mark),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
