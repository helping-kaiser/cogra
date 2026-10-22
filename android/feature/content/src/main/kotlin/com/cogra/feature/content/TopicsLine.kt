// The topics-and-citations line a content card wears, shared by the post
// card and the comment card (`design/components/content/TopicsLine.jsx`).
//
// AT MOST TWO CHIPS, THEN THE COUNTS: a clipped parade of half-chips says
// nothing, so the line shows up to two tags whole and states the rest in
// words, "· 23 tags · 3 references". Never a wrap, never a second row: the
// card's collapse order (design/readme.md §13) folds tags and references
// to one line before media or the affordance row ever give way. A CHIP IS
// NEVER CUT (jakob's ruling, 2026-09-09): one that would not draw whole
// folds into the counts instead.

package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.TopicChip
import com.cogra.core.designsystem.TopicChipHeight
import com.cogra.core.designsystem.TopicChipHorizontalOverhead
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.TopicClaimView
import com.cogra.feature.content.R

/** Two chips whole, then words — the master's own count. */
private const val VISIBLE_CHIPS = 2

/**
 * The one line, on every variant.
 *
 * **WHOLE OR FOLDED, NEVER CUT, AND ALWAYS A PREFIX** (`TopicsLine.jsx`;
 * jakob's ruling A3): the line tries two chips, then one, then none, and
 * keeps the first count whose whole line — every shown chip's pill, the
 * resulting counts and an 8dp gap between each — fits the width it is given.
 * It is MEASURED at the rendered size (readme §4, *Type*, the budgets law),
 * where the board estimates from its one fixed width: a scaled line never
 * cuts a chip and never clips the count. The shown chips are always the
 * first ones; a later, shorter tag never stands where an earlier one folded.
 *
 * **THE COUNTS ARE THE WAY IN** (graph.json: every `reference count` edge
 * advances to `RefsSheet`), and which control opens it is the master's own
 * split: on a detail surface the WHOLE line is the opener — drawn at the
 * chips' 34dp across the content width and answering at 48 (readme §10, jakob
 * 2026-10-07) — with the chips inert inside it; on a summary card the counts
 * open it and the chips still reach the tag page. Given neither handler the
 * counts stay the plain fact they were — a comment's line is that case,
 * since the sheet a comment would open sits inside the sheet the thread
 * already is.
 */
@Composable
internal fun TopicsLine(
    topics: List<TopicClaimView>,
    references: List<ReferenceClaimView>,
    onOpenTopic: (String) -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    /** A detail surface: the whole line opens the sheet, the chips inert. */
    onOpen: (() -> Unit)? = null,
    /** A summary card: the counts open the sheet, the chips still navigate. */
    onOpenReferences: (() -> Unit)? = null,
    /**
     * The line's data-node on a registered screen (`feed.card.tagsLine`):
     * the line, each chip (keyed by its name, without `#`) and the counts
     * then wear the registered paths in place of the [testTagPrefix] tags.
     */
    node: DataNode? = null,
) {
    if (topics.isEmpty() && references.isEmpty()) return
    val names = topics.map { it.hashtag.name.value.orEmpty() }
    val cap = minOf(VISIBLE_CHIPS, names.size)
    // Every candidate's counts, read once (the plurals are composable).
    val countsFor = (0..cap).associateWith { shown -> countsText(names.size - shown, references.size) }
    val measurer = rememberTextMeasurer()
    val chipStyle = MaterialTheme.typography.labelLarge
    val countsStyle = MaterialTheme.typography.bodySmall
    val density = LocalDensity.current
    val lineLabel = stringResource(R.string.content_topics_line_label)

    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val budget = with(density) { maxWidth.toPx() }
        val shown = (cap downTo 0).firstOrNull { n ->
            measurer.lineWidth(names.take(n), countsFor.getValue(n), chipStyle, countsStyle, density) <= budget
        } ?: 0
        val counts = countsFor.getValue(shown)
        Row(
            modifier = Modifier
                .testTag(node?.tag ?: "${testTagPrefix}_topics_line")
                // A flex row in the card's column: it spans the content width.
                .fillMaxWidth()
                .then(
                    if (onOpen != null) {
                        Modifier.hitTarget(
                            interactive = Modifier
                                .clickable(role = Role.Button, onClick = onOpen)
                                .semantics { contentDescription = lineLabel },
                            drawnHeight = TopicChipHeight,
                        )
                    } else {
                        Modifier
                    },
                )
                .heightIn(min = if (shown > 0 || onOpen != null) TopicChipHeight else 0.dp),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            names.take(shown).forEach { name ->
                TopicChip(
                    name = name,
                    onClick = { onOpenTopic(name) },
                    // Inert inside the line that is itself the opener: a chip
                    // sitting in a control must not be a second one.
                    inert = onOpen != null,
                    testTag = node?.div("tag")?.keyed(name)?.tag ?: "${testTagPrefix}_topic_$name",
                )
            }
            counts?.let {
                Text(
                    text = it,
                    style = countsStyle,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier
                        .testTag(node?.div("counts")?.tag ?: "${testTagPrefix}_topics_counts")
                        .then(
                            // THE COUNT IS A DOOR on every feed card (K13.3),
                            // grown to 48dp without moving its ink.
                            if (onOpenReferences != null) {
                                Modifier.hitTarget(
                                    interactive = Modifier.clickable(role = Role.Button, onClick = onOpenReferences),
                                    drawnHeight = COUNTS_LINE,
                                )
                            } else {
                                Modifier
                            },
                        ),
                )
            }
        }
    }
}

/** `body-small`'s line: the counts' drawn height. */
private val COUNTS_LINE = 16.dp

/** What [shownNames] and [counts] cost on one line, in px — pills, counts and the gaps between. */
private fun TextMeasurer.lineWidth(
    shownNames: List<String>,
    counts: String?,
    chipStyle: TextStyle,
    countsStyle: TextStyle,
    density: Density,
): Float {
    val overhead = with(density) { TopicChipHorizontalOverhead.toPx() }
    val gap = with(density) { Space.x2.toPx() }
    val chips = shownNames.sumOf { measure(AnnotatedString("#$it"), chipStyle, maxLines = 1).size.width.toDouble() }
        .toFloat() + overhead * shownNames.size
    val countsWidth = counts?.let { measure(AnnotatedString(it), countsStyle, maxLines = 1).size.width.toFloat() } ?: 0f
    val items = shownNames.size + (if (counts != null) 1 else 0)
    return chips + countsWidth + gap * (items - 1).coerceAtLeast(0)
}

/**
 * What the line says instead of the chips it does not draw: the tags past
 * the shown ones and every reference, folded into one trailing string. Null
 * when there is nothing left to state.
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
