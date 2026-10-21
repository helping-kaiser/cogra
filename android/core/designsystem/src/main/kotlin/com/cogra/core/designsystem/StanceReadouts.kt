// THE PAD'S THREE READOUTS — the masters `StanceStanding` and
// `StanceLandingLine` (StanceReadout.jsx; readme §11 *The stance control*).
//
// TWO DIFFERENT NUMBERS, NEVER MERGED INTO ONE LINE. `Current opinion` sits
// above the field — the bundle as it stands; `Your pick` sits between it and
// the field — the edge being authored, never the bundle it joins; `Resulting
// opinion` sits below the field — the bundle after the pick. Each is a label
// over its own face and pair, formatted identically so the eye compares them
// without reading.
//
// FACE AND PAIR — NEVER THE ANCHOR'S WORDS AS WELL. Three encodings of one
// value is two too many, and the words were the redundant one. They move to
// the accessibility tree: every block is one node whose name is the spoken
// twin (`Current opinion: Like this, For or against +0.55, How much reaches
// you +0.20`), because an emoji's own name is "slightly smiling face", never
// "Like this".
//
// THE FACE IS THE DEFAULT READING; THE PAIR IS THE GEEK ONE (readme §13). The
// pair is drawn only while the reader asked for exact values
// ([LocalShowExactValues]); what is spoken is the same in both paintings.
//
// THEY SPEAK WHEN THE PICK SETTLES (the K13 round): what is drawn follows the
// knob at once, what is spoken only once the pick has rested 500ms, politely.

package com.cogra.core.designsystem

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.text.style.TextOverflow
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Space
import kotlinx.coroutines.delay

/** How long a readout's value has to rest before it is spoken (`SETTLE_MS`). */
internal const val SETTLE_MS = 500L

/**
 * What a readout says aloud: [value] once it has stopped changing for
 * [SETTLE_MS] (`useSettled`). The first composition says the value as it
 * stands, so nothing is withheld; only a run of changes is held back.
 */
@Composable
internal fun rememberSettled(value: String): String {
    var settled by remember { mutableStateOf(value) }
    LaunchedEffect(value) {
        if (value != settled) {
            delay(SETTLE_MS)
            settled = value
        }
    }
    return settled
}

/** The target as the face's names and the dialog speak it — the host's, or the master's default `this post`. */
@Composable
internal fun targetWords(targetLabel: String?): String =
    targetLabel ?: stringResource(R.string.stance_target_default)

/**
 * The spoken twin of a readout: `Label: Word, For or against +x, How much
 * reaches you +y` (copy-voice *The readouts, spoken*).
 */
@Composable
internal fun spokenReadout(label: String, anchor: StanceAnchor, point: StancePoint, axes: StanceAxes): String =
    stringResource(R.string.stance_readout_spoken, label, stringResource(anchor.label), point.reading(axes))

/**
 * The `cg-exact` span: [text] drawn only while the reader asked for exact
 * values. Out of the semantics tree either way — the block it sits in
 * speaks the whole fact.
 */
@Composable
internal fun ExactSpan(text: String, color: Color, testTag: String? = null) {
    if (!LocalShowExactValues.current) return
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = color,
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Visible,
        modifier = Modifier.semantics {
            hideFromAccessibility()
            if (testTag != null) this.testTag = testTag
        },
    )
}

/**
 * One labelled readout (`ReadoutBlock`): the label in `label-small` on
 * `onSurfaceVariant`, then the face and the pair on the line below — the
 * pick's face a step larger and its pair in `onSurface` ([big]).
 */
@Composable
private fun ReadoutBlock(
    label: String,
    emoji: String,
    pair: String,
    spoken: String,
    big: Boolean,
    testTag: String,
    exactTag: String,
    modifier: Modifier = Modifier,
) {
    val said = rememberSettled(spoken)
    Column(
        modifier = modifier
            .semantics(mergeDescendants = true) {
                contentDescription = said
                liveRegion = LiveRegionMode.Polite
            }
            .testTag(testTag),
    ) {
        ReadoutLabel(label)
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            Text(
                text = emoji,
                style = if (big) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { hideFromAccessibility() },
            )
            ExactSpan(
                text = pair,
                color = if (big) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                testTag = exactTag,
            )
        }
    }
}

@Composable
private fun ReadoutLabel(label: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.semantics { hideFromAccessibility() },
    )
}

/** A readout that reads as a sentence, not a value — `🤷 No opinion on this post yet.`, `Adding it up…`. */
@Composable
private fun ReadoutSentence(sentence: String, testTag: String, modifier: Modifier = Modifier) {
    val said = rememberSettled(sentence)
    Text(
        text = sentence,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier
            .semantics {
                contentDescription = said
                liveRegion = LiveRegionMode.Polite
            }
            .testTag(testTag),
    )
}

/**
 * The current opinion and the pick — everything that sits above the field
 * (`StanceStanding`). [standing] null means nothing was ever signed toward
 * the target; a standing at exactly `(0, 0)` is a bundle walked back to
 * nothing, read as a sentence and never through the table.
 */
@Composable
internal fun StanceStanding(
    pick: StancePoint,
    standing: StancePoint?,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    targetLabel: String?,
    modifier: Modifier = Modifier,
    node: DataNode? = null,
) {
    val target = targetWords(targetLabel)
    val current = stringResource(R.string.stance_current)
    val pickLabel = stringResource(R.string.stance_pick)
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = modifier.dataNode(node),
    ) {
        val currentTag = node?.div("current")?.tag ?: "${testTagPrefix}_stance_standing"
        when {
            standing == null -> ReadoutSentence(
                "${ZERO_BUNDLE_READOUT.emoji} ${stringResource(R.string.stance_standing_none, target)}",
                currentTag,
            )
            standing.isZeroBundle -> ReadoutSentence(
                "${ZERO_BUNDLE_READOUT.emoji} ${stringResource(zeroWords.standingZero, target)}",
                currentTag,
            )
            else -> {
                val anchor = nearestStanceAnchor(standing)
                ReadoutBlock(
                    label = current,
                    emoji = anchor.emoji,
                    pair = standing.pair(),
                    spoken = spokenReadout(current, anchor, standing, axes),
                    big = false,
                    testTag = currentTag,
                    exactTag = "${testTagPrefix}_stance_standing_pair",
                )
            }
        }
        // The pick's own readout — above the field, never under the knob,
        // because a thumb on the control covers exactly where feedback would
        // otherwise sit.
        val anchor = nearestStanceAnchor(pick)
        ReadoutBlock(
            label = pickLabel,
            emoji = anchor.emoji,
            pair = pick.pair(),
            spoken = spokenReadout(pickLabel, anchor, pick, axes),
            big = true,
            testTag = node?.div("pick")?.tag ?: "${testTagPrefix}_stance_readout",
            exactTag = "${testTagPrefix}_stance_exact_pair",
        )
    }
}

/** The state an unreachable landing reads as, by the sign of the number that stands (`unreachableHead`). */
@Composable
internal fun unreachableHead(net: StancePoint): String = stringResource(
    when {
        net.directed == 0.0 && net.interest > 0.0 -> R.string.stance_unreachable_interested
        net.directed == 0.0 -> R.string.stance_unreachable_rather_not
        net.directed > 0.0 -> R.string.stance_unreachable_for
        else -> R.string.stance_unreachable_against
    },
)

/**
 * The landing — the one readout below the field (`StanceLandingLine`).
 *
 * ONE ZERO IS A DELIBERATE STATE, NOT A LOSS (jakob 2026-10-20, seam 240): a
 * landing with exactly one number at zero is held and shapes no feed. It
 * wears 🤔 and reads its state in words where the pair would stand, and
 * handed [onExplainZero] the 🤔 is a door named by the state, whose three
 * lines replace the pad's body in place. Only `(0, 0)` is severance, which
 * keeps its own line. While the reader still borrows a view, an unreachable
 * or severed landing carries the borrowed-view warning beneath it.
 */
@Composable
internal fun StanceLandingLine(
    landing: StanceLanding?,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    modifier: Modifier = Modifier,
    borrowed: Boolean = false,
    onExplainZero: (() -> Unit)? = null,
    node: DataNode? = null,
) {
    val tag = node?.tag ?: "${testTagPrefix}_stance_landing"
    val keepsBorrowed = borrowed && landing != null &&
        (landing.severance || landing.inertDirected || landing.inertInterest)
    Column(verticalArrangement = Arrangement.spacedBy(Space.x1), modifier = modifier) {
        when {
            landing == null -> ReadoutSentence(stringResource(R.string.stance_landing_working), tag)
            landing.severance -> ReadoutSentence(stringResource(zeroWords.reached), tag)
            landing.inertDirected || landing.inertInterest ->
                UnreachableLanding(landing.net, tag, testTagPrefix, onExplainZero)
            else -> {
                val resulting = stringResource(R.string.stance_resulting)
                val anchor = nearestStanceAnchor(landing.net)
                ReadoutBlock(
                    label = resulting,
                    emoji = anchor.emoji,
                    pair = landing.net.pair(),
                    spoken = spokenReadout(resulting, anchor, landing.net, axes),
                    big = false,
                    testTag = tag,
                    exactTag = "${testTagPrefix}_stance_landing_pair",
                )
            }
        }
        if (keepsBorrowed) {
            Text(
                text = stringResource(R.string.stance_borrowed_kept),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("${testTagPrefix}_stance_landing_borrowed"),
            )
        }
    }
}

/** `Resulting opinion` over 🤔 and the state: `Interested, no side taken — this won't shape anyone's feed.` */
@Composable
private fun UnreachableLanding(
    net: StancePoint,
    tag: String,
    testTagPrefix: String,
    onExplainZero: (() -> Unit)?,
) {
    val resulting = stringResource(R.string.stance_resulting)
    val head = unreachableHead(net)
    val words = stringResource(R.string.stance_unreachable_line, head, stringResource(R.string.stance_unreachable_tail))
    val said = rememberSettled("$resulting: $words")
    Column(
        modifier = Modifier
            .semantics(mergeDescendants = true) {
                contentDescription = said
                liveRegion = LiveRegionMode.Polite
            }
            .testTag(tag),
    ) {
        ReadoutLabel(resulting)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            val face = Modifier.then(
                if (onExplainZero == null) {
                    Modifier.semantics { hideFromAccessibility() }
                } else {
                    // The door, named by the state it explains; 48dp of aim
                    // around a title-medium face (readme §10).
                    // The name replaces the emoji's own ("thinking face").
                    Modifier
                        .semantics {
                            contentDescription = head
                            this.testTag = "${testTagPrefix}_stance_landing_zero"
                        }
                        .minimumInteractiveComponentSize()
                        .clickable(role = Role.Button, onClick = onExplainZero)
                },
            )
            Text(text = UNREACHABLE_EMOJI, style = MaterialTheme.typography.titleMedium, modifier = face)
            Text(
                text = words,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.semantics { hideFromAccessibility() },
            )
        }
    }
}

/**
 * Lines that replace a body in place — the pad's `?` and the 🤔's — then the
 * way back (`Back to the pad`). Never a dialog: the pad is parked, and a
 * panel that grew below it would push Set away from the thumb.
 */
@Composable
internal fun HelpInPlace(
    lines: List<String>,
    back: String,
    onBack: () -> Unit,
    testTag: String,
    backTag: String,
    modifier: Modifier = Modifier,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = modifier
            .fillMaxWidth()
            .testTag(testTag),
    ) {
        lines.forEach { line ->
            Text(
                text = line,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        CograButton(
            text = back,
            onClick = onBack,
            kind = ButtonKind.Text,
            size = ButtonSize.Compact,
            testTag = backTag,
        )
    }
}

/** The pad's four help lines, the fourth the family's own (`padHelp`). */
@Composable
internal fun padHelp(zeroWords: StanceZeroWords): List<String> = listOf(
    stringResource(R.string.stance_explain_field),
    stringResource(R.string.stance_explain_commit),
    stringResource(R.string.stance_explain_adds),
    stringResource(zeroWords.help),
)

/**
 * What the 🤔 opens on an unreachable landing (`unreachableHelp`): still
 * held (a person stays under `Your people`), shaping no feed, and not the
 * family's way out.
 */
@Composable
internal fun unreachableHelp(zeroWords: StanceZeroWords, targetLabel: String?): List<String> = listOf(
    if (targetLabel?.startsWith("@") == true) {
        stringResource(R.string.stance_zero_help_held_person, targetLabel)
    } else {
        stringResource(R.string.stance_zero_help_held)
    },
    stringResource(R.string.stance_zero_help_feed),
    stringResource(R.string.stance_zero_help_way_out, stringResource(zeroWords.open)),
)
