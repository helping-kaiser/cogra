package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The 2.0 text field, as `ComposeDetails` draws it: a label row carrying an
 * `Optional` marker on its right, over a field on the extra-small (4dp) rung
 * with a one-hairline `outline` border.
 *
 * Material's own `OutlinedTextField` is not used here because it draws the
 * notched-label treatment, and the canvas puts the label *above* the box as
 * its own row with a second value on the same line. Rebuilding the box is
 * the smaller divergence: the alternative is fighting a component's built-in
 * label placement on every screen.
 *
 * The `Optional` marker is folded into the field's accessible name rather
 * than left as a floating word, so a screen reader hears "Title, optional"
 * instead of two unrelated fragments.
 */
@Composable
fun CograTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    optional: Boolean = false,
    optionalLabel: String = "Optional",
    singleLine: Boolean = true,
    minLines: Int = 1,
    /**
     * Stretches the box to whatever height the caller gave the field —
     * what `ComposeWords` draws, where the body's box takes the rest of
     * the screen rather than a line count. Off by default, because a
     * field that fills its parent inside a `Column` with no weight
     * would take the whole screen.
     */
    fillHeight: Boolean = false,
    testTag: String? = null,
) {
    val colors = MaterialTheme.colorScheme
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = colors.onSurface,
                modifier = Modifier.weight(1f),
            )
            if (optional) {
                Text(
                    text = optionalLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant,
                )
            }
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = singleLine,
            minLines = minLines,
            textStyle = LocalTextStyle.current.merge(
                MaterialTheme.typography.bodyLarge.copy(color = colors.onSurface),
            ),
            cursorBrush = SolidColor(colors.primary),
            modifier = Modifier
                .fillMaxWidth()
                .then(if (fillHeight) Modifier.weight(1f) else Modifier)
                .defaultMinSize(minHeight = Layout.FieldHeight)
                .border(
                    BorderStroke(1.dp, colors.outline),
                    MaterialTheme.shapes.extraSmall,
                )
                .padding(horizontal = Space.x3, vertical = 10.dp)
                .semantics {
                    contentDescription =
                        if (optional) "$label, ${optionalLabel.lowercase()}" else label
                }
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        )
    }
}

@ThemePreviews
@Composable
private fun CograTextFieldVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            CograTextField(
                value = "Salt maps of the coast road",
                onValueChange = {},
                label = "Title",
                optional = true,
            )
            CograTextField(
                value = "Rubbings from three weekends at low tide — paper against the salt crust.",
                onValueChange = {},
                label = "Description",
                optional = true,
                singleLine = false,
                minLines = 3,
            )
            CograTextField(value = "", onValueChange = {}, label = "Title", optional = true)
        }
    }
}
