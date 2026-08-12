package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
    Column(modifier) {
        Text("$label: ${String.format(Locale.getDefault(), "%.2f", value)}")
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toDouble()) },
            valueRange = -1f..1f,
            modifier = Modifier
                .testTag(testTag)
                .semantics { contentDescription = label },
        )
    }
}
