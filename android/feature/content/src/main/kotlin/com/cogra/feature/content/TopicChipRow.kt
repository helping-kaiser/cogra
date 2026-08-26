// The chip row on content (hashtag.md §4): the topics a piece of
// content currently carries, each tapping through to its topic screen.
// Read-only wherever content is read — a card is for reading, and
// changing a post's topics belongs on the screen where the post itself
// is edited (F3), so nothing here stages a write.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.TopicChip
import com.cogra.domain.TopicClaimView

@Composable
internal fun TopicChipRow(
    topics: List<TopicClaimView>,
    onOpenTopic: (String) -> Unit,
    testTagPrefix: String,
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
            )
        }
    }
}
