// The topics-and-citations line a content card wears, shared by the post
// card and the comment card (`design/components/content/TopicsLine.jsx`).
//
// AT MOST TWO CHIPS, THEN THE COUNTS: a clipped parade of half-chips says
// nothing, so the line shows up to two topics whole — each capped so both
// always fit beside the counts — and states the rest in words,
// "· 23 topics · 3 references". Never a wrap, never a second row: the
// card's collapse order (design/readme.md §13) folds tags and references
// to one line before media or the affordance row ever give way.
//
// A CHIP IS NEVER CUT (jakob's ruling, 2026-09-09). The cap alone did not
// carry that: a name longer than the pill came out as "#saltmar…", the
// very half-chip the rule forbids. So the label is measured, and a name
// that will not draw whole is stated by the counts instead — down to
// counts-only when neither of the two fits.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.TopicChip
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.TopicClaimView
import com.cogra.feature.content.R

/** Two chips whole, then words — the master's own count. */
private const val VISIBLE_CHIPS = 2

/** Two capped chips plus the counts fit a 390dp card at its 16dp insets. */
private val CHIP_CAP = 96.dp

/**
 * What is left for the label inside [CHIP_CAP]: Material 3 pads a chip's
 * label 16dp on each side, inside a 1dp outline. A name that does not
 * measure under this is not drawn as a chip at all — jakob's ruling
 * (2026-09-09): a chip is never cut, it shows whole or falls into the
 * counts. The cap itself stays on the chip as a layout backstop, but the
 * measurement is what decides, so it is never reached.
 */
private val CHIP_LABEL_CAP = CHIP_CAP - 34.dp

/**
 * The one line, on every variant.
 *
 * **The counts are not a control yet.** The master makes them the way in
 * to the topics-and-references sheet, and on a detail surface the whole
 * line is that opener — but `RefsSheet` is not built, and a control whose
 * destination does not exist is a dead control (design/readme.md §2). So
 * the counts read as the fact they are, and the chips keep the topic
 * screen they already reach; the openers arrive with the sheet.
 *
 * The same staging costs the detail its on-demand reveal of each claim's
 * signed pair: those values are `ReferenceRow`'s in the sheet, and the
 * one-line master has no room for a toggle beside the counts.
 */
@Composable
internal fun TopicsLine(
    topics: List<TopicClaimView>,
    references: List<ReferenceClaimView>,
    onOpenTopic: (String) -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
) {
    if (topics.isEmpty() && references.isEmpty()) return
    val measurer = rememberTextMeasurer()
    val labelStyle = MaterialTheme.typography.labelLarge
    val capPx = with(LocalDensity.current) { CHIP_LABEL_CAP.toPx() }
    val visible = topics.take(VISIBLE_CHIPS).filter {
        measurer.fitsWhole(it.hashtag.name.value.orEmpty(), labelStyle, capPx)
    }
    val counts = countsText(topics.size - visible.size, references.size)

    Row(
        modifier = modifier.testTag("${testTagPrefix}_topics_line"),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        visible.forEach { claim ->
            val name = claim.hashtag.name.value.orEmpty()
            TopicChip(
                name = name,
                onClick = { onOpenTopic(name) },
                modifier = Modifier.widthIn(max = CHIP_CAP),
                testTag = "${testTagPrefix}_topic_$name",
            )
        }
        counts?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("${testTagPrefix}_topics_counts"),
            )
        }
    }
}

/**
 * Whether the chip's whole label draws inside [CHIP_LABEL_CAP].
 *
 * Measured, not estimated: the alternative is the cap ellipsising the
 * name, and a half-chip is the one thing this line must never show. A
 * name too long for the pill is a topic the counts state in words —
 * which is where every topic past the second already goes.
 */
private fun TextMeasurer.fitsWhole(name: String, style: TextStyle, capPx: Float): Boolean =
    measure(AnnotatedString("#$name"), style, maxLines = 1).size.width <= capPx

/**
 * What the line says instead of the chips it does not draw: the topics
 * past the first two and every reference, folded into one trailing
 * string. Null when there is nothing left to state.
 */
@Composable
private fun countsText(hiddenTopics: Int, references: Int): String? {
    val parts = buildList {
        if (hiddenTopics > 0) {
            add(pluralStringResource(R.plurals.content_topics_line_topics, hiddenTopics, hiddenTopics))
        }
        if (references > 0) {
            add(pluralStringResource(R.plurals.content_topics_line_references, references, references))
        }
    }
    if (parts.isEmpty()) return null
    return "· " + parts.joinToString(" · ")
}
