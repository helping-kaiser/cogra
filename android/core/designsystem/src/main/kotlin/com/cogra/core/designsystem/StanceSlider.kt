package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
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
