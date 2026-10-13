package com.cogra.core.designsystem.v2.atom

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/*
 * THE SETTINGS ROW AND ITS GROUP (`design/components/core/SettingsRow.jsx`,
 * the settings round) — one anatomy every setting follows. The GROUP is the
 * unit: a quiet heading above a filled card of rows, rows split by a hairline
 * inset to their own padding and never after the last, and a footnote under
 * the card for what the reader needs once.
 *
 * Tokens: the card is `--surface-card` (`surfaceContainerHighest`) at the
 * medium rung, the hairline `--border-hairline` (`outlineVariant`), and the
 * quiet words `--text-secondary` (`onSurfaceVariant`) — `design/tokens/
 * semantic.css`.
 */

/** The drawn row's minimum height and inner padding (`SettingsRow.jsx` `ROW_BOX`). */
private val RowMinHeight = 56.dp

/**
 * A group of settings rows. [rows] are the group's rows in order; the
 * hairlines between them are drawn here, so a row never decides whether
 * it is last. A [bare] group drops the card for a control that draws its
 * own container (the theme's segmented block); the heading and footnote
 * keep their inset either way.
 *
 * An unlabelled group names itself by [ariaLabel] (`leaving` is "Sign
 * out") — the board's `<section aria-label>`.
 */
@Composable
fun SettingsGroup(
    rows: List<@Composable () -> Unit>,
    modifier: Modifier = Modifier,
    label: String? = null,
    footnote: String? = null,
    ariaLabel: String? = null,
    bare: Boolean = false,
    node: DataNode? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .semantics {
                isTraversalGroup = true
                if (label == null && ariaLabel != null) contentDescription = ariaLabel
            },
    ) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(start = Space.x4, end = Space.x4, bottom = Space.x2)
                    .semantics { heading() }
                    .dataNode(node?.div("label")),
            )
        }
        Column(
            modifier = if (bare) {
                Modifier.fillMaxWidth()
            } else {
                Modifier
                    .fillMaxWidth()
                    .clip(MaterialTheme.shapes.medium)
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            },
        ) {
            rows.forEachIndexed { index, row ->
                if (index > 0) Hairline(Modifier.padding(start = Space.x4))
                row()
            }
        }
        if (footnote != null) {
            QuietNote(
                text = footnote,
                modifier = Modifier
                    .padding(start = Space.x4, end = Space.x4, top = Space.x2)
                    .dataNode(node?.div("footnote")),
            )
        }
    }
}

/**
 * What a row's trailing edge is — `SettingsRow.jsx`'s four variants, plus a
 * row that is a choice. Each says what the WHOLE row does:
 *
 * - [Switch]: on or off, taking effect on the press; the row is the switch.
 * - [Opens]: a value (optional) and a chevron — this opens another surface.
 * - [Choice]: one of a group, the leading dot `ComposeLicense` draws.
 * - [Action]: an act, not a setting — the label on `primary`, no chevron.
 * - [Inert]: the row is not a target; only its [trailing] control is.
 */
sealed interface SettingsRowKind {
    data class Switch(val checked: Boolean) : SettingsRowKind

    data object Opens : SettingsRowKind

    data class Choice(val selected: Boolean) : SettingsRowKind

    data object Action : SettingsRowKind

    data object Inert : SettingsRowKind
}

/**
 * One settings row. The words column is the [label] in `labelLarge` over
 * an optional [status] in `bodySmall` — status, not description, except on
 * a switch, whose line has to say what turning it on does. [value] is the
 * current answer in the reader's words; the chevron means one thing only,
 * that the row opens another surface. No row carries a leading icon.
 *
 * The parts wear [node]'s registered names: `label`, `status`, `value`,
 * `chevron`, `switch` and `choice` (`Settings`' registration, nodes.json).
 * [stateDescription] lets a caller announce a transient state (a pending
 * save) without changing the drawn words.
 */
@Composable
fun SettingsRow(
    label: String,
    kind: SettingsRowKind,
    modifier: Modifier = Modifier,
    status: String? = null,
    value: String? = null,
    onClick: () -> Unit = {},
    trailing: (@Composable RowScope.() -> Unit)? = null,
    node: DataNode? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .rowTarget(kind, onClick)
            .defaultMinSize(minHeight = RowMinHeight)
            .padding(horizontal = Space.x4, vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x4),
    ) {
        if (kind is SettingsRowKind.Choice) {
            ChoiceDot(selected = kind.selected, modifier = Modifier.dataNode(node?.div("choice")))
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = if (kind == SettingsRowKind.Action) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                modifier = Modifier.dataNode(node?.div("label")),
            )
            if (status != null) {
                Text(
                    text = status,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.dataNode(node?.div("status")),
                )
            }
        }
        RowTail(kind, value, trailing, node)
    }
}

/** What the whole row does — the row IS the switch, the choice or the door; an inert row is no target. */
private fun Modifier.rowTarget(kind: SettingsRowKind, onClick: () -> Unit): Modifier = when (kind) {
    is SettingsRowKind.Switch -> toggleable(value = kind.checked, role = Role.Switch, onValueChange = { onClick() })
    is SettingsRowKind.Choice -> selectable(selected = kind.selected, role = Role.RadioButton, onClick = onClick)
    SettingsRowKind.Opens, SettingsRowKind.Action -> clickable(role = Role.Button, onClick = onClick)
    SettingsRowKind.Inert -> this
}

/** The trailing edge: the value, a row's own control, the switch, the chevron. */
@Composable
private fun RowScope.RowTail(
    kind: SettingsRowKind,
    value: String?,
    trailing: (@Composable RowScope.() -> Unit)?,
    node: DataNode?,
) {
    if (value != null) {
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.dataNode(node?.div("value")),
        )
    }
    trailing?.invoke(this)
    if (kind is SettingsRowKind.Switch) {
        HouseSwitch(checked = kind.checked, modifier = Modifier.dataNode(node?.div("switch")))
    }
    if (kind == SettingsRowKind.Opens) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .size(18.dp)
                .dataNode(node?.div("chevron")),
        )
    }
}

/**
 * The house switch (`SettingsRow.jsx` `Switch`): 44×24 with an 18dp knob —
 * the sensitive sheet's geometry. Off is the hairline `outline` a pressable
 * control wears with an `outline` knob; on is a `primary` track with an
 * `onPrimary` knob, and the knob TRAVELS, so the state is never colour
 * alone. Drawn here decoratively: the row it sits in carries the switch
 * semantics, so a reader hears one control, once.
 */
@Composable
fun HouseSwitch(checked: Boolean, modifier: Modifier = Modifier) {
    val knobOffset by animateDpAsState(
        targetValue = if (checked) SwitchWidth - KnobSize - KnobInset else KnobInset,
        label = "switchKnob",
    )
    val colors = MaterialTheme.colorScheme
    Box(
        modifier = modifier
            .size(width = SwitchWidth, height = SwitchHeight)
            .clip(CircleShape)
            .then(
                if (checked) {
                    Modifier.background(colors.primary)
                } else {
                    Modifier.border(1.dp, colors.outline, CircleShape)
                },
            )
            .clearAndSetSemantics { },
        contentAlignment = Alignment.CenterStart,
    ) {
        Box(
            Modifier
                .offset(x = knobOffset)
                .size(KnobSize)
                .clip(CircleShape)
                .background(if (checked) colors.onPrimary else colors.outline),
        )
    }
}

private val SwitchWidth = 44.dp
private val SwitchHeight = 24.dp
private val KnobSize = 18.dp

/** The knob's distance from the track's outer edge, both states (1px border + 2, or 3). */
private val KnobInset = 3.dp

/**
 * The choice dot — `ComposeLicense`'s radio, from the same values so the
 * license sheet and a settings choice are visibly the same question asked
 * twice: 18dp, a 5dp `primary` ring when chosen, a 1dp `outline` one when
 * not. Decorative; the row carries the radio semantics.
 */
@Composable
fun ChoiceDot(selected: Boolean, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(18.dp)
            .clip(CircleShape)
            .border(
                width = if (selected) 5.dp else 1.dp,
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                shape = CircleShape,
            )
            .clearAndSetSemantics { },
    )
}

/**
 * The quiet note (`QuietNote.jsx`): one true line in `labelSmall` on
 * `onSurfaceVariant`, asking for nothing. It carries no spacing of its
 * own; the column it lives in owns the gap.
 */
@Composable
fun QuietNote(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    )
}

/** The segmented filter's drawn height (`SegmentedFilter.jsx`, 32px border-box). */
private val SegmentHeight = 32.dp

/** The segment's vertical padding: (32 − labelLarge's 20 line) / 2 at the default font size. */
private val SegmentPaddingVertical = 6.dp

/** One option of a [SegmentedFilter]. */
data class SegmentedOption<T>(val value: T, val label: String, val nodeName: String)

/**
 * The segmented filter (`design/components/navigation/SegmentedFilter.jsx`):
 * two to four short, mutually exclusive options as one bordered pill of
 * equal segments, drawn at 32dp. Selection is colour only —
 * `secondaryContainer` on `onSecondaryContainer`. [block] spans the
 * container, for a settings group whose whole content it is.
 *
 * Each segment is a radio in one group, so a reader hears one choice out
 * of the set; a segment wears its option's registered name under [node]
 * (`settings.theme.picker.lightOption`).
 */
@Composable
fun <T> SegmentedFilter(
    options: List<SegmentedOption<T>>,
    selected: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
    block: Boolean = false,
    ariaLabel: String? = null,
    node: DataNode? = null,
) {
    val colors = MaterialTheme.colorScheme
    Row(
        modifier = modifier
            .then(if (block) Modifier.fillMaxWidth() else Modifier)
            // Drawn at 32dp: at the default font size the label's 20sp line
            // plus the segment's padding is exactly that. Under a larger font
            // size the pill grows with its words instead of clipping them —
            // sp text in a fixed dp box is what Android's font-scaling
            // guidance warns against (developer.android.com, Android 14
            // "Non-linear font scaling to 200%").
            .height(IntrinsicSize.Min)
            .heightIn(min = SegmentHeight)
            .clip(CircleShape)
            .border(1.dp, colors.outline, CircleShape)
            .dataNode(node)
            .selectableGroup()
            .semantics { if (ariaLabel != null) contentDescription = ariaLabel },
    ) {
        options.forEachIndexed { index, option ->
            if (index > 0) {
                Box(
                    Modifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .background(colors.outline),
                )
            }
            val isSelected = option.value == selected
            Box(
                modifier = Modifier
                    .then(if (block) Modifier.weight(1f) else Modifier)
                    .fillMaxHeight()
                    .then(if (isSelected) Modifier.background(colors.secondaryContainer) else Modifier)
                    .selectable(selected = isSelected, role = Role.RadioButton, onClick = { onSelect(option.value) })
                    .dataNode(node?.div(option.nodeName))
                    .padding(horizontal = Space.x4, vertical = SegmentPaddingVertical),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option.label,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (isSelected) colors.onSecondaryContainer else colors.onSurface,
                    maxLines = 1,
                )
            }
        }
    }
}

@ThemePreviews
@Composable
private fun SettingsGroupPreview() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            SettingsGroup(
                label = "Writing",
                footnote = "Every signed action is paid for separately.",
                rows = listOf(
                    {
                        SettingsRow(
                            label = "Confirm multi-action submits",
                            status = "Ask first when one submit signs more than one action.",
                            kind = SettingsRowKind.Switch(checked = true),
                        )
                    },
                    { SettingsRow(label = "Default license", value = "Public domain", kind = SettingsRowKind.Opens) },
                ),
            )
            SettingsGroup(
                ariaLabel = "Sign out",
                rows = listOf({ SettingsRow(label = "Sign out", kind = SettingsRowKind.Action) }),
            )
        }
    }
}
