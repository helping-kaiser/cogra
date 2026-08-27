// The chip row on content (hashtag.md §4): the topics a piece of
// content currently carries, each tapping through to its topic screen.
// Read-only wherever content is read — a card is for reading, and
// changing a post's topics belongs on the screen where the post itself
// is edited (F3), so nothing here stages a write.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.material3.IconToggleButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.TagChipValues
import com.cogra.core.designsystem.TopicChip
import com.cogra.domain.TopicClaimView
import com.cogra.feature.content.R

/**
 * [onToggleValues] adds the row's reveal affordance (F8): how strongly
 * each topic is claimed, on demand and never by default. It is the
 * detail view's gesture only — a feed card stays a card, so the callback
 * is absent there and no affordance renders.
 */
@Composable
internal fun TopicChipRow(
    topics: List<TopicClaimView>,
    onOpenTopic: (String) -> Unit,
    testTagPrefix: String,
    valuesRevealed: Boolean = false,
    onToggleValues: (() -> Unit)? = null,
) {
    if (topics.isEmpty()) return
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.testTag("${testTagPrefix}_topics"),
    ) {
        topics.forEach { claim ->
            val name = claim.hashtag.name.value.orEmpty()
            TopicChip(
                name = name,
                onClick = { onOpenTopic(name) },
                testTag = "${testTagPrefix}_topic_$name",
                values = if (valuesRevealed) {
                    TagChipValues(claim.relevance, claim.confidence)
                } else {
                    null
                },
            )
        }
        if (onToggleValues != null) {
            // A toggle, not a button that opens something: the row has
            // an on/off state a reader can read back, which is what
            // `IconToggleButton` puts in the semantics tree.
            IconToggleButton(
                checked = valuesRevealed,
                onCheckedChange = { onToggleValues() },
                modifier = Modifier.testTag("${testTagPrefix}_topics_reveal"),
            ) {
                Icon(
                    if (valuesRevealed) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = stringResource(
                        if (valuesRevealed) {
                            R.string.content_topics_hide_values
                        } else {
                            R.string.content_topics_show_values
                        },
                    ),
                )
            }
        }
    }
}
