// THE TAG CARD — a topic met in a feed, and a glimpse of what carries it
// (`_shared.jsx` `TagFeedCard`, jakob's pick 2026-10-01; FeedTagShapes.md,
// FeedKinds.md). web's twin is `web/src/lib/ui/tag-feed-card.tsx`.
//
// The lead is the topic's `#` tile beside its name; the body is the newest
// things tagged, their marks side by side and the newest one named over its
// author, so the card reads as a door to a place rather than a post inside a
// header. The card opens the tag's page.
//
// THE ROW READS OPINION · SCORE · THE KIND'S OWN ACT · SHARE (FeedKinds.md):
// the topic's Affinity on the tag page's own words, the score slot waiting
// with every card's (no field carries a card's score until the ranker's
// figure reaches the contract), `Tag a new post with it` — the composer
// opened with the tag already staged — and the share the tag page's row ends
// with. A Type has no license, is never cited and is never saved, so the card
// carries no ⋮.
//
// THE WHY-LINE STANDS ONLY WHERE THE TAG REACHES THE READER THROUGH SOMEONE
// (History.md:59). Whom a tag reaches the reader through is the strongest
// paths' people — ranker math no field carries yet — so [through] is handed
// in by the host and every host today hands none.
//
// AN EMPTY TAG keeps its card, and its glimpse gives way to one quiet line,
// `Nothing carries this tag right now.`, with no age, since nothing is newest.

package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.TypeTokens
import com.cogra.domain.FieldStatus
import com.cogra.domain.history.TagCardTopic
import java.time.Instant

/** The lead's `#` tile and the glimpse's marks: 32dp, the card's darker tile tone (`NodeMark`'s `onCard`). */
private val TAG_MARK = 32.dp

/** The lead's tile stands 10 from its words (`TagFeedCard`'s lead gap). */
private val LEAD_GAP = 10.dp

/** The why-line's own two-name law (`_shared.jsx` `reachesThrough`): past it, the line compresses. */
private const val WHY_LINE_CHARS = 46

/**
 * The why-line (FeedTagShapes.md:3-11): `Reaches you through @ada and @tobias`,
 * `… @ada and 3 others` past two, or `Through @ada` where the full line would
 * not fit its one line.
 */
internal fun reachesThrough(handles: List<String>): String {
    val named = handles.map { "@$it" }
    val people = if (named.size > 2) "${named.first()} and ${named.size - 1} others" else named.joinToString(" and ")
    val full = "Reaches you through $people"
    return if (full.length > WHY_LINE_CHARS) "Through ${named.first()}" else full
}

/** What a tag card hands its host: the doors and the slots the route fills. */
internal data class TagCardActions(
    /** The card's door: the tag's page. */
    val onOpen: (name: String) -> Unit,
    /** `Tag a new post with it`: the composer, the tag staged. */
    val onCompose: (name: String) -> Unit,
    val onShare: (name: String) -> Unit,
    /** The topic's Affinity control, on the card's `actionRow.stance` part. */
    val stance: @Composable (name: String, node: DataNode) -> Unit,
)

@Composable
internal fun TagFeedCard(
    topic: TagCardTopic,
    /** The registered card (`history.tagCard`), keyed by the tag's name here. */
    node: DataNode,
    actions: TagCardActions,
    /** Whom the tag reaches the reader through — none until the ranker says (History.md:59). */
    through: List<String> = emptyList(),
    now: Instant = Instant.now(),
) {
    val name = topic.name.value?.takeUnless { topic.name.status == FieldStatus.REDACTED }.orEmpty()
    val card = node.keyed(name)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = name.isNotEmpty()) { actions.onOpen(name) }
            .dataNode(card),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            TagLead(name, through, topic, card, now)
            Glimpse(topic, card)
            TagRow(name, card, actions)
        }
    }
}

/** The `#` tile beside the name (and the why-line under it), the newest thing's age on the right. */
@Composable
private fun TagLead(name: String, through: List<String>, topic: TagCardTopic, card: DataNode, now: Instant) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(LEAD_GAP),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TopicMark(card / "mark")
            Column {
                Text(
                    text = "#$name",
                    style = MaterialTheme.typography.labelLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.dataNode(card / "name"),
                )
                if (through.isNotEmpty()) {
                    Text(
                        text = reachesThrough(through),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.dataNode(card / "through"),
                    )
                }
            }
        }
        // AN EMPTY TAG SHOWS NO AGE: nothing is newest.
        topic.tagged.firstOrNull()?.let { newest ->
            Text(
                text = compactAge(newest.createdAt, now),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = Space.x2).dataNode(card / "timestamp"),
            )
        }
    }
}

/** The topic's tile: the `#` in the title's weight on the card's darker tone. */
@Composable
private fun TopicMark(node: DataNode) {
    Box(
        modifier = Modifier
            .size(TAG_MARK)
            .clip(RoundedCornerShape(Space.x2))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .dataNode(node),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "#",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** The newest things tagged: their marks side by side, the newest named over its author — or the empty tag's line. */
@Composable
private fun Glimpse(topic: TagCardTopic, card: DataNode) {
    val newest = topic.tagged.firstOrNull()
    if (newest == null) {
        Text(
            text = stringResource(R.string.content_tag_nothing),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            // Unregistered: no board draws the empty tag's card in History.
            modifier = Modifier.dataNode(card / "nothing"),
        )
        return
    }
    val glimpse = card / "glimpse"
    Row(
        modifier = Modifier.fillMaxWidth().dataNode(glimpse),
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Space.x1)) {
            topic.tagged.forEach { thing ->
                NodeMark(
                    comment = thing.comment,
                    coverUrl = thing.coverUrl,
                    removed = thing.removed,
                    testTag = "${glimpse.tag}_mark_${thing.id}",
                )
            }
        }
        Column(Modifier.weight(1f)) {
            Text(
                text = newest.title,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = if (newest.removed) TypeTokens.SystemVoiceWeight else null,
                color = quietIf(newest.removed),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.dataNode(glimpse / "newest"),
            )
            val more = topic.tagged.size - 1
            val by = newest.authorHandle?.let { "@$it" }.orEmpty()
            Text(
                text = if (more > 0) pluralStringResource(R.plurals.content_tag_glimpse_more, more, by, more) else by,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.dataNode(glimpse / "by"),
            )
        }
    }
}

/** Affinity · (score, waiting) · `Tag a new post with it` · share. */
@Composable
private fun TagRow(name: String, card: DataNode, actions: TagCardActions) {
    val row = card / "actionRow"
    Row(
        modifier = Modifier.fillMaxWidth().dataNode(row),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // A name moderation took away is a topic with nothing to stance
        // toward: the canonical name IS the target's identity (TagPage's rule).
        if (name.isNotEmpty()) actions.stance(name, row / "stance") else Box(Modifier)
        GlyphAffordance(
            icon = Icons.Filled.Add,
            description = stringResource(R.string.content_tag_act),
            testTag = (row / "compose").tag,
            onClick = { actions.onCompose(name) },
        )
        GlyphAffordance(
            icon = Icons.Filled.Share,
            description = stringResource(R.string.content_share_person, "#$name"),
            testTag = (row / "share").tag,
            onClick = { actions.onShare(name) },
        )
    }
}
