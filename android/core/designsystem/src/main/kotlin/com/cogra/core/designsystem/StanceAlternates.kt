// THE ALTERNATES — the master `StanceAlternates` (design/components/stance/
// StanceAlternates.jsx; stance-control.md *Alternate and accessible inputs*).
//
// Paired sliders and direct entry: the same machinery as the pad on a
// surface a screen-reader or switch user can drive, with the FULL range — a
// degraded alternate is not an accessible path. It opens from `Choose your
// opinion on …`, the non-drag door every face carries, and it REPLACES the
// pad everywhere for a reader who chose sliders or typed values in settings.
//
// ONE CONTROL AT A TIME. Sliders lead; `Type exact values` swaps to the typed
// fields and back. Two controls editing the same two numbers is a needless
// choice at the moment of a priced act.
//
// The same anatomy as the pad, centred as a dialog: a circled `?` whose
// lines teach the one thing two sliders cannot (*two values, not one*), the
// current opinion and the pick above, the landing below, and one row —
// `Walk it back` on the left, `Cancel` and `Sign it` on the right. The help
// replaces the whole body, readouts included, and takes at least the height
// it replaced, so no button moves when it opens.

package com.cogra.core.designsystem

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Space
import java.util.Locale

/** `--dialog-max-width` (20rem): one width for every dialog. */
private val DIALOG_MAX_WIDTH = 320.dp

/** The typed field's width (`width: 6rem`). */
private val ENTRY_WIDTH = 96.dp

/** What the alternates show in place of their inputs: the `?`'s lines, or the 🤔's. */
private enum class AlternatesExplaining { HELP, ZERO }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun StanceAlternates(
    state: StanceControlState,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onOpenSeverance: (() -> Unit)?,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    targetLabel: String?,
    helpLabel: String,
) {
    val title = stringResource(R.string.stance_alternates_title)
    var typed by rememberSaveable { mutableStateOf(state.inputMode == StanceInputSurface.ENTRY) }
    var explaining by rememberSaveable { mutableStateOf<AlternatesExplaining?>(null) }
    BasicAlertDialog(onDismissRequest = onCancel) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            modifier = Modifier
                .widthIn(max = DIALOG_MAX_WIDTH)
                .semantics { paneTitle = title }
                .testTag("${testTagPrefix}_stance_alternates"),
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(Space.x6),
            ) {
                AlternatesHeader(
                    title = title,
                    helpLabel = helpLabel,
                    onHelp = {
                        val shown = explaining == AlternatesExplaining.HELP
                        explaining = if (shown) null else AlternatesExplaining.HELP
                    },
                    testTagPrefix = testTagPrefix,
                )
                AlternatesBody(
                    state = state,
                    explaining = explaining,
                    onExplain = { explaining = it },
                    typed = typed,
                    onSwap = { typed = !typed },
                    onPick = onPick,
                    axes = axes,
                    zeroWords = zeroWords,
                    targetLabel = targetLabel,
                    testTagPrefix = testTagPrefix,
                )
                AlternatesActions(state, onCommit, onCancel, onOpenSeverance, zeroWords, testTagPrefix)
            }
        }
    }
}

/**
 * The body: the readouts, the inputs and the landing — or, in their place,
 * the `?`'s lines or the 🤔's. An explanation takes at least the height of
 * what it replaced, so no button moves when it opens.
 */
@Composable
private fun AlternatesBody(
    state: StanceControlState,
    explaining: AlternatesExplaining?,
    onExplain: (AlternatesExplaining?) -> Unit,
    typed: Boolean,
    onSwap: () -> Unit,
    onPick: (StancePoint) -> Unit,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    targetLabel: String?,
    testTagPrefix: String,
) {
    var slotHeight by rememberSaveable { mutableIntStateOf(0) }
    val density = LocalDensity.current
    val minHeight = with(density) { slotHeight.toDp() }
    when (explaining) {
        AlternatesExplaining.HELP -> HelpInPlace(
            lines = listOf(
                stringResource(R.string.stance_alternates_help_values),
                stringResource(R.string.stance_alternates_help_commit),
                stringResource(R.string.stance_explain_adds),
                stringResource(zeroWords.helpAlternates),
            ),
            back = stringResource(R.string.stance_alternates_back),
            onBack = { onExplain(null) },
            testTag = "${testTagPrefix}_stance_alternates_explanation",
            backTag = "${testTagPrefix}_stance_alternates_back",
            modifier = Modifier.heightIn(min = minHeight),
        )
        AlternatesExplaining.ZERO -> HelpInPlace(
            lines = unreachableHelp(zeroWords, targetLabel),
            back = stringResource(R.string.stance_alternates_back),
            onBack = { onExplain(null) },
            testTag = "${testTagPrefix}_stance_zero_explanation",
            backTag = "${testTagPrefix}_stance_alternates_back",
            modifier = Modifier.heightIn(min = minHeight),
        )
        null -> Column(Modifier.onSizeChanged { slotHeight = it.height }) {
            StanceStanding(
                pick = state.pick,
                standing = state.standing,
                testTagPrefix = testTagPrefix,
                axes = axes,
                zeroWords = zeroWords,
                targetLabel = targetLabel,
            )
            AlternateInputs(typed, onSwap, state.pick, onPick, axes, testTagPrefix)
            StanceLandingLine(
                landing = state.landing,
                testTagPrefix = testTagPrefix,
                axes = axes,
                zeroWords = zeroWords,
                borrowed = state.borrowed,
                onExplainZero = { onExplain(AlternatesExplaining.ZERO) },
            )
        }
    }
}

/** The dialog's title in `title-large`, clear of the circled `?` in its corner. */
@Composable
private fun AlternatesHeader(title: String, helpLabel: String, onHelp: () -> Unit, testTagPrefix: String) {
    Box(Modifier.fillMaxWidth()) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(end = 40.dp),
        )
        AlternatesHelpButton(
            label = helpLabel,
            onClick = onHelp,
            testTag = "${testTagPrefix}_stance_alternates_help",
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = 12.dp, y = (-12).dp),
        )
    }
}

/**
 * The fault when one stands, then one row: `Walk it back` on the left where
 * there is something to walk back, `Cancel` and `Sign it` on the right.
 */
@Composable
private fun AlternatesActions(
    state: StanceControlState,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onOpenSeverance: (() -> Unit)?,
    zeroWords: StanceZeroWords,
    testTagPrefix: String,
) {
    if (state.failed && !state.needsKey) {
        Text(
            text = stringResource(R.string.stance_pad_failed),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier
                .padding(top = Space.x4)
                .testTag("${testTagPrefix}_stance_failed"),
        )
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = Space.x6),
    ) {
        if (onOpenSeverance != null) {
            Box(Modifier.weight(1f)) {
                CograButton(
                    text = stringResource(zeroWords.open),
                    onClick = onOpenSeverance,
                    kind = ButtonKind.Text,
                    size = ButtonSize.Compact,
                    testTag = "${testTagPrefix}_stance_sever",
                )
            }
        } else {
            Spacer(Modifier.weight(1f))
        }
        CograButton(
            text = stringResource(R.string.stance_cancel),
            onClick = onCancel,
            kind = ButtonKind.Text,
            size = ButtonSize.Compact,
            testTag = "${testTagPrefix}_stance_cancel",
        )
        CograButton(
            text = stringResource(R.string.stance_alternates_commit),
            onClick = onCommit,
            size = ButtonSize.Compact,
            enabled = !state.busy,
            testTag = "${testTagPrefix}_stance_set",
        )
    }
}

/** The circled `?` the pad carries, in the dialog's corner (StanceAlternates.jsx:233-270). */
@Composable
private fun AlternatesHelpButton(label: String, onClick: () -> Unit, testTag: String, modifier: Modifier = Modifier) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(48.dp)
            .clip(CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label }
            .testTag(testTag),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(32.dp)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape),
        ) {
            Text(
                text = "?",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clearAndSetSemantics { },
            )
        }
    }
}

/** The two tracks or the two typed fields, and the quiet swap to the other — never both. */
@Composable
private fun AlternateInputs(
    typed: Boolean,
    onSwap: () -> Unit,
    pick: StancePoint,
    onPick: (StancePoint) -> Unit,
    axes: StanceAxes,
    testTagPrefix: String,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x4),
        modifier = Modifier.padding(top = Space.x4),
    ) {
        if (typed) {
            StanceEntry(
                label = stringResource(axes.directed),
                value = pick.directed,
                onChange = { onPick(pick.copy(directed = it)) },
                testTag = "${testTagPrefix}_stance_entry_directed",
            )
            StanceEntry(
                label = stringResource(axes.interest),
                value = pick.interest,
                onChange = { onPick(pick.copy(interest = it)) },
                testTag = "${testTagPrefix}_stance_entry_interest",
            )
        } else {
            StanceSlider(
                label = stringResource(axes.directed),
                value = pick.directed,
                onChange = { onPick(pick.copy(directed = it)) },
                testTag = "${testTagPrefix}_stance_slider_directed",
                minLabel = stringResource(axes.left),
                maxLabel = stringResource(axes.right),
            )
            StanceSlider(
                label = stringResource(axes.interest),
                value = pick.interest,
                onChange = { onPick(pick.copy(interest = it)) },
                testTag = "${testTagPrefix}_stance_slider_interest",
                minLabel = stringResource(axes.bottom),
                maxLabel = stringResource(axes.top),
            )
        }
    }
    CograButton(
        text = stringResource(if (typed) R.string.stance_alternates_slide else R.string.stance_alternates_type),
        onClick = onSwap,
        kind = ButtonKind.Text,
        size = ButtonSize.Compact,
        testTag = "${testTagPrefix}_stance_alternates_swap",
        modifier = Modifier.padding(top = Space.x2),
    )
}

/**
 * The direct-entry field's text. Root locale, not the reader's: this one
 * has to survive a round trip through [String.toDoubleOrNull], and a
 * decimal comma would not.
 */
private fun entryText(value: Double): String = String.format(Locale.ROOT, "%.2f", value)

/**
 * Direct entry (`DirectEntry`): the axis's question beside a 6rem field. A
 * typed value is reported only once it parses inside the closed range — the
 * typed text is its own state, since reformatting on every keystroke would
 * make a leading minus sign impossible to type — and lands on the hundredths
 * grid, as a released drag does.
 */
@Composable
private fun StanceEntry(label: String, value: Double, onChange: (Double) -> Unit, testTag: String) {
    var typed by rememberSaveable { mutableStateOf(entryText(value)) }
    LaunchedEffect(value) {
        if (typed.toDoubleOrNull() != value) typed = entryText(value)
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(text = label, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
        OutlinedTextField(
            value = typed,
            onValueChange = { text ->
                val parsed = text.toDoubleOrNull()?.takeIf { it in -1.0..1.0 }
                if (parsed == null) {
                    typed = text
                } else {
                    val landed = hundredth(parsed)
                    typed = if (landed == parsed) text else entryText(landed)
                    onChange(landed)
                }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier
                .width(ENTRY_WIDTH)
                .semantics { contentDescription = label }
                .testTag(testTag),
        )
    }
}
