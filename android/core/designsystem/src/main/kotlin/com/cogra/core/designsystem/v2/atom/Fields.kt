package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error as markError
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import kotlin.math.roundToInt

/**
 * THE LATE COUNTER (jakob's ruling, the caps-affordance round,
 * `design/components/forms/TextField.jsx:32-93`). A capped field is silent
 * until the writer is within the last tenth of it, never fewer than the
 * last 20 scalar values — the count appears at
 * `remaining <= max(20, round(cap / 10))`, reading "N left" with room left
 * and "N over" past it. The unit is the Unicode scalar value
 * (`codePointCount`), which is what every ruled cap counts in — `.length`
 * counts UTF-16 code units, and would tell a writer of emoji they had spent
 * twice what they had.
 *
 * [used] overrides the arithmetic for a fixture drawing only a tail of a
 * longer value; every live field passes null and is counted whole.
 */
private const val COUNT_WINDOW_MINIMUM = 20

/** The late counter's window is the last TENTH of the cap, at minimum. */
private const val COUNT_WINDOW_DIVISOR = 10f

internal data class FieldCountReading(val text: String, val over: Boolean)

internal fun fieldCountReading(value: String, cap: Int?, used: Int? = null): FieldCountReading? {
    if (cap == null) return null
    val spent = used ?: value.codePointCount(0, value.length)
    val remaining = cap - spent
    val window = maxOf(COUNT_WINDOW_MINIMUM, (cap / COUNT_WINDOW_DIVISOR).roundToInt())
    if (remaining > window) return null
    return if (remaining < 0) {
        FieldCountReading("${-remaining} over", over = true)
    } else {
        FieldCountReading("$remaining left", over = false)
    }
}

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
 *
 * **The field atom's one error state** (the caps-affordance round, closing
 * the web/Android divergence design/backlog.md item 52 named: the outline
 * and label take `error`, and the message renders below, replacing a house
 * `ErrorLine` a caller used to draw separately. [cap]/[used] drive the late
 * counter in the same row, beside the message when both are live.
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
     * the screen rather than a line count.
     *
     * **The caller has to give the field a height too** — a
     * `Modifier.weight` from its own column — because this only passes
     * that height down to the box. Without it the surrounding column
     * wraps its content, there is no leftover space to distribute, and
     * the box sits at its 44dp minimum under an empty screen.
     */
    fillHeight: Boolean = false,
    /**
     * A field the surface is not currently accepting. Used where the
     * contract would refuse the value anyway — `ComposeSensitive`'s
     * reason before the mark is on — so an author never types into a box
     * whose contents would be thrown away.
     */
    enabled: Boolean = true,
    /** The field's ruled length cap, in Unicode scalar values — drives the late counter. */
    cap: Int? = null,
    /** Overrides the counter's own count, for a fixture drawing only a tail of the value. */
    used: Int? = null,
    /** The field's one refusal, worded by the caller — replaces the hint were there one. */
    error: String? = null,
    testTag: String? = null,
) {
    val colors = MaterialTheme.colorScheme
    val reading = fieldCountReading(value, cap, used)
    val hasError = error != null
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        FieldLabelRow(label, optional, optionalLabel, fieldLabelColor(colors, hasError, enabled))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = singleLine,
            minLines = minLines,
            textStyle = LocalTextStyle.current.merge(
                MaterialTheme.typography.bodyLarge.copy(
                    color = if (enabled) colors.onSurface else colors.onSurface.copy(alpha = DISABLED),
                ),
            ),
            cursorBrush = SolidColor(colors.primary),
            modifier = Modifier
                .fillMaxWidth()
                .then(if (fillHeight) Modifier.weight(1f) else Modifier)
                .defaultMinSize(minHeight = Layout.FieldHeight)
                .border(
                    BorderStroke(1.dp, fieldOutlineColor(colors, hasError, enabled)),
                    MaterialTheme.shapes.extraSmall,
                )
                .padding(horizontal = Space.x3, vertical = 10.dp)
                .semantics {
                    contentDescription =
                        if (optional) "$label, ${optionalLabel.lowercase()}" else label
                    if (error != null) markError(error)
                }
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        )
        FieldSupportRow(error, reading, testTag)
    }
}

/** [error] takes the outline over the disabled state, which takes it over rest. */
private fun fieldOutlineColor(colors: ColorScheme, hasError: Boolean, enabled: Boolean): Color = when {
    hasError -> colors.error
    !enabled -> colors.outline.copy(alpha = DISABLED)
    else -> colors.outline
}

/** The label follows the same precedence as the outline. */
private fun fieldLabelColor(colors: ColorScheme, hasError: Boolean, enabled: Boolean): Color = when {
    hasError -> colors.error
    !enabled -> colors.onSurface.copy(alpha = DISABLED)
    else -> colors.onSurface
}

@Composable
private fun FieldLabelRow(label: String, optional: Boolean, optionalLabel: String, labelColor: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = labelColor,
            modifier = Modifier.weight(1f),
        )
        if (optional) {
            Text(
                text = optionalLabel,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * The supporting row below the field: the caller's own error message and the
 * late counter, which is a third element in this row rather than a third
 * state of it — it sits beside the message when both are live, or alone at
 * the row's far end (the spacer standing in for an absent message).
 */
@Composable
private fun FieldSupportRow(error: String?, reading: FieldCountReading?, testTag: String?) {
    if (error == null && reading == null) return
    val colors = MaterialTheme.colorScheme
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        if (error != null) {
            Text(
                text = error,
                style = MaterialTheme.typography.bodySmall,
                color = colors.error,
                modifier = Modifier
                    .weight(1f)
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .then(if (testTag != null) Modifier.testTag("${testTag}_error") else Modifier),
            )
        } else {
            Spacer(Modifier.weight(1f))
        }
        if (reading != null) {
            Text(
                text = reading.text,
                style = MaterialTheme.typography.bodySmall,
                color = if (reading.over) colors.error else colors.onSurfaceVariant,
                modifier = Modifier
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .then(if (testTag != null) Modifier.testTag("${testTag}_count") else Modifier),
            )
        }
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
            CograTextField(
                value = "",
                onValueChange = {},
                label = "Why?",
                optional = true,
                optionalLabel = "Optional — shown on the veil",
                enabled = false,
            )
        }
    }
}

/** Material's own disabled-content opacity (`--state-disabled`). */
private const val DISABLED = 0.38f
