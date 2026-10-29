// THE ONE-AXIS READOUTS — the masters `AttachmentReadout`,
// `AttachmentStanding` and `AttachmentLandingLine` (StanceReadout.jsx,
// jakob 2026-10-16, PR-101).
//
// The BACKING an author signs with their own content is one number:
// Publish carries the attachment on `p_d`, and the census pins `p_i` at 1,
// so a pair would draw a second figure nobody can choose. Every face here
// reads through the one-axis table, 🤔 at exactly 0.00
// ([nearestValenceAnchor]). Backing is the authoring bundle; OPINION is
// the face's record, a pair, read by the ordinary stance readouts — the
// two words never trade places (copy-voice "What an author signs with
// their own content is their BACKING").
//
// THE PICK IS THE RECORD — the pad never works in results. A new post's
// pad has nothing standing, so its pick is its result and `Your pick`
// reads alone. An edit's pad reads `Current backing` (the bundle's net
// now) over `Your pick`, and `Backing after` beneath the strip — `clip`
// of the RAW sum plus the pick, the total and the cap stated past ±1.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.text.style.TextOverflow
import com.cogra.core.designsystem.v2.token.Space

/** Where a pick lands the backing: the raw total, its fold, and whether the fold clipped it (`attachmentLanding`). */
@Immutable
data class AttachmentLanding(
    /** The bundle's raw sum plus the pick, unclipped. */
    val raw: Double,
    /** The fold: [raw] clipped to the axis — where the graph puts the backing. */
    val landing: Double,
    /** Whether [raw] passed ±1, so the fold clipped it. */
    val capped: Boolean,
)

/**
 * The fold the stance pad uses, at one axis: `clip` of the RAW sum plus
 * the pick, so a bundle that has summed past ±1 lands where the graph
 * will put it, not where the clipped net suggests. The sum normalizes −0
 * to +0, so a landing at zero shrugs.
 */
fun attachmentLanding(rawSum: Double, pick: Double): AttachmentLanding {
    val raw = rawSum + pick + 0.0
    return AttachmentLanding(raw = raw, landing = raw.coerceIn(-1.0, 1.0) + 0.0, capped = raw > 1.0 || raw < -1.0)
}

/**
 * `Walk it all back`: the pick that parks at the raw sum's opposite,
 * clipped to the strip (EditPad.md). Within ±1 it lands the backing at
 * 0.00; past it, as far as one record reaches — the rest another edit's. A
 * parked pick is a pick, so it lands on the hundredths grid like a release.
 */
fun walkBackPick(rawSum: Double): Double = hundredth(-rawSum)

/**
 * The seal's and an edit's `Your backing` row value: the face and the one
 * number on a line, the spoken twin naming the one axis there is.
 */
@Composable
fun AttachmentReadout(
    pDirected: Double,
    modifier: Modifier = Modifier,
    testTag: String? = null,
    /** The readout's data-node on a registered screen: its `face` and `exact` wear its parts. */
    node: DataNode? = null,
) {
    val band = nearestValenceAnchor(pDirected)
    val spoken = valenceReading(pDirected)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = modifier
            .semantics(mergeDescendants = true) { contentDescription = spoken }
            .then(if (node == null && testTag != null) Modifier.testTag(testTag) else Modifier)
            .dataNode(node),
    ) {
        Text(
            text = band.emoji,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.dataNode(node?.div("face")).clearAndSetSemantics { },
        )
        // NEVER WRAPS: a number broken across two lines reads as two.
        Text(
            text = valenceExact(pDirected),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Visible,
            modifier = Modifier.dataNode(node?.div("exact")).clearAndSetSemantics { },
        )
    }
}

/**
 * What a backing read says: the current backing, or the raw sum a landing
 * folds from — or, when the read served none or failed, a placeholder,
 * not a reading, drawn as a bare dash and spoken as unread.
 */
@Immutable
sealed interface BackingValue {
    /** The bundle's net, as read. */
    data class Read(val value: Double) : BackingValue

    /** Not served, or the read failed: nothing to fold from. */
    data object Unread : BackingValue
}

/**
 * The one-axis pad's readouts above its strip: `Current backing` over
 * `Your pick` on an edit's pad, `Your pick` alone where nothing stands
 * yet ([current] null). Each block is a label over its own face and one
 * number, never merged into one line, and the column is a polite live
 * region so the pick is heard once it rests.
 */
@Composable
fun AttachmentStanding(
    pick: Double,
    modifier: Modifier = Modifier,
    current: BackingValue? = null,
    testTagPrefix: String = "attachment",
) {
    Column(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        if (current != null) {
            BackingBlock(
                label = stringResource(R.string.backing_current),
                value = current,
                big = false,
                testTag = "${testTagPrefix}_current",
            )
        }
        BackingBlock(
            label = stringResource(R.string.backing_pick),
            value = BackingValue.Read(pick),
            big = true,
            testTag = "${testTagPrefix}_pick",
        )
    }
}

/**
 * `Backing after`, beneath an edit's strip: [attachmentLanding]'s fold of
 * the raw sum plus the pick. When the sum passes the cap a quiet line
 * says the total and the cap — clipped is not hidden.
 */
@Composable
fun AttachmentLandingLine(
    rawSum: BackingValue,
    pick: Double,
    modifier: Modifier = Modifier,
    testTagPrefix: String = "attachment",
) {
    val landing = (rawSum as? BackingValue.Read)?.let { attachmentLanding(it.value, pick) }
    Column(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        BackingBlock(
            label = stringResource(R.string.backing_after),
            value = landing?.let { BackingValue.Read(it.landing) } ?: BackingValue.Unread,
            big = false,
            testTag = "${testTagPrefix}_after",
        )
        if (landing != null && landing.capped) {
            Text(
                text = stringResource(
                    R.string.backing_capped,
                    valenceExact(landing.raw),
                    valenceExact(landing.landing),
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("${testTagPrefix}_after_cap"),
            )
        }
    }
}

/**
 * One labelled block: the label in the quiet label ink, then the face and
 * the one number — the pick's block a step larger, as the master's `big`
 * block is. Spoken whole, `Your pick: Nice, For or against +0.10`.
 */
@Composable
private fun BackingBlock(label: String, value: BackingValue, big: Boolean, testTag: String) {
    val spoken = when (value) {
        is BackingValue.Read -> "$label: ${valenceReading(value.value)}"
        BackingValue.Unread -> "$label: ${stringResource(R.string.backing_unread)}"
    }
    Column(
        modifier = Modifier
            .semantics(mergeDescendants = true) { contentDescription = spoken }
            .testTag(testTag),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            when (value) {
                is BackingValue.Read -> {
                    Text(
                        text = nearestValenceAnchor(value.value).emoji,
                        style = if (big) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                        modifier = Modifier.clearAndSetSemantics { },
                    )
                    Text(
                        text = valenceExact(value.value),
                        style = MaterialTheme.typography.bodySmall,
                        color = if (big) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        maxLines = 1,
                        softWrap = false,
                        modifier = Modifier
                            .clearAndSetSemantics { this.testTag = "${testTag}_exact" },
                    )
                }
                BackingValue.Unread -> Text(
                    text = BACKING_UNREAD_MARK,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .clearAndSetSemantics { this.testTag = "${testTag}_unread" },
                )
            }
        }
    }
}

/** What an unread backing draws: a dash, no face — a face would read a value nobody served. */
const val BACKING_UNREAD_MARK = "—"
