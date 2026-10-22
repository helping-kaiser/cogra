package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.testTag
import com.cogra.core.designsystem.v2.token.Space

/**
 * One axis of a stance as an ordinary slider (the master `StanceSlider`):
 * range [-1, +1], each value on the hundredths grid, the axis's question in
 * `label-large` with the signed two-decimal value beside it only in geek mode
 * (`cg-exact`, readme §13), and the two ends named under the track in
 * `body-small` on `onSurfaceVariant` — a track says nothing about which end
 * is which. The slider announces its own value in both modes.
 */
@Composable
fun StanceSlider(
    label: String,
    value: Double,
    onChange: (Double) -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
    minLabel: String? = null,
    maxLabel: String? = null,
) {
    val reading = twoPlaces(value)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Space.x1)) {
        Text(
            text = if (LocalShowExactValues.current) "$label $reading" else label,
            style = MaterialTheme.typography.labelLarge,
        )
        Slider(
            value = value.toFloat(),
            // The track is continuous and a Float; the pick is a hundredth
            // (the value domain, jakob 2026-10-20), so every value it reports
            // lands on the grid.
            onValueChange = { onChange(hundredth(it.toDouble())) },
            valueRange = -1f..1f,
            modifier = Modifier
                .testTag(testTag)
                .semantics {
                    contentDescription = label
                    stateDescription = reading
                },
        )
        if (minLabel != null || maxLabel != null) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { hideFromAccessibility() },
            ) {
                Text(
                    text = minLabel.orEmpty(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = maxLabel.orEmpty(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * One dimension of the uniform two-parameter grammar over its
 * census-bounded range: the value in the label, and the same reading as
 * the slider's `stateDescription` so TalkBack announces the number
 * rather than a bare percentage. [scale] renders under the track, for a
 * range whose endpoints or centre are worth marking.
 */
@Composable
internal fun LabeledSlider(
    label: String,
    value: Double,
    onChange: (Double) -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
    valueRange: ClosedFloatingPointRange<Float> = -1f..1f,
    scale: @Composable (() -> Unit)? = null,
) {
    val reading = twoPlacesUnsigned(value)
    Column(modifier) {
        Text("$label: $reading")
        Slider(
            value = value.toFloat(),
            // The track is continuous and a Float; the pick is a hundredth
            // (the value domain, jakob 2026-10-20), so every value it reports
            // lands on the grid — what the label prints is what is picked.
            onValueChange = { onChange(hundredth(it.toDouble())) },
            valueRange = valueRange,
            modifier = Modifier
                .testTag(testTag)
                .semantics {
                    contentDescription = label
                    stateDescription = reading
                },
        )
        scale?.invoke()
    }
}

private val BIPOLAR_SCALE = listOf(
    R.string.scale_min,
    R.string.scale_zero,
    R.string.scale_max,
)

/**
 * The marks under a bipolar parameter's track. Its centre is the
 * meaningful one: zero is withdrawal, not "a little". The endpoints
 * and that centre ride as plain text — the slider itself already
 * announces its value, so the scale stays out of the semantics tree.
 */
@Composable
internal fun BipolarScale(testTag: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clearAndSetSemantics { this.testTag = testTag },
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        for (mark in BIPOLAR_SCALE) {
            Text(
                stringResource(mark),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
