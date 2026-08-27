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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.testTag
import java.util.Locale

/**
 * The house stance editor: a stance dimension over the closed [-1, +1]
 * (api-spec.md § Scalars) with a two-decimal label, the slider named
 * for TalkBack — the web app's `StanceSlider`.
 */
@Composable
fun StanceSlider(
    label: String,
    value: Double,
    onChange: (Double) -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    LabeledSlider(
        label = label,
        value = value,
        onChange = onChange,
        testTag = testTag,
        modifier = modifier,
    )
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
    val reading = String.format(Locale.getDefault(), "%.2f", value)
    Column(modifier) {
        Text("$label: $reading")
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toDouble()) },
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
