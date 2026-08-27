// The two parameters every Reference act carries (api-spec.md
// `ReferenceInput`): relevance — the census's effort `f`, on the
// `pDirected` slot — and support — enthusiasm `e`, on `pInterest`.
// Both are bipolar over the census range, unlike a tag's confidence,
// so both carry the centre-zero scale (D1).
//
// Relevance keeps the word authors learned on the 2.3 tag sliders: it
// is the same slot in both families and the same signed range.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp

@Composable
fun ReferenceParameterSliders(
    relevance: Double,
    support: Double,
    onRelevanceChange: (Double) -> Unit,
    onSupportChange: (Double) -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        LabeledSlider(
            label = stringResource(R.string.reference_relevance),
            value = relevance,
            onChange = onRelevanceChange,
            testTag = "${testTagPrefix}_relevance",
            valueRange = -1f..1f,
        ) {
            BipolarScale("${testTagPrefix}_relevance_scale")
        }
        LabeledSlider(
            label = stringResource(R.string.reference_support),
            value = support,
            onChange = onSupportChange,
            testTag = "${testTagPrefix}_support",
            valueRange = -1f..1f,
        ) {
            BipolarScale("${testTagPrefix}_support_scale")
        }
    }
}
