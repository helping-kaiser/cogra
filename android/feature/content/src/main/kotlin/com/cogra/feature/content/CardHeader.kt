// A content card's header row (`design/components/content/PostCard.jsx`
// 243-255 and `CommentCard.jsx` 149-155): the author on the left, the
// age — and, once its menu exists, the ⋮ — on the right.
//
// PEOPLE FIRST (§1): the author leads. The chip sits ABOVE the content,
// never below it as a byline — including on a media post, where every
// other product would put the picture first.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ActorRef
import java.time.Instant

/**
 * The row a post and a comment share.
 *
 * **The ⋮ the master draws beside the age is gated** — it opens
 * `ReaderPostMenu`, which W3 builds, and a control that opens nothing
 * teaches the reader the card lies (design/readme.md §2).
 *
 * @param at when the node was authored; drawn as a compact age.
 */
@Composable
internal fun ContentCardHeader(
    author: ActorRef?,
    at: Instant,
    onOpenActor: (String) -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    now: Instant = Instant.now(),
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The chip takes the row and the age holds the right edge, so a
        // system actor's missing chip does not pull the age left.
        Box(Modifier.weight(1f)) {
            author?.let {
                ActorChip(
                    handle = it.handle,
                    displayName = it.displayName,
                    onOpen = { onOpenActor(it.handle) },
                    avatarUrl = it.avatar?.url,
                    testTag = "${testTagPrefix}_author",
                )
            }
        }
        Text(
            text = compactAge(at, now),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(start = Space.x3)
                .testTag("${testTagPrefix}_age"),
        )
    }
}

/**
 * The age the boards draw: a number and its unit, no word between —
 * `35m`, `1h`, `3d`. Compact because the row it shares with the author
 * has no width to spare, and because a reader scanning a feed reads the
 * order, not the clock.
 *
 * The unit stops at days. No board draws a card older than `3d`, and
 * the date form (`06.09.2024`) belongs to the search result row, on a
 * surface this release does not build.
 */
internal fun compactAge(at: Instant, now: Instant): String {
    val minutes = java.time.Duration.between(at, now).toMinutes().coerceAtLeast(0)
    return when {
        minutes < MINUTES_PER_HOUR -> "${minutes}m"
        minutes < MINUTES_PER_DAY -> "${minutes / MINUTES_PER_HOUR}h"
        else -> "${minutes / MINUTES_PER_DAY}d"
    }
}

private const val MINUTES_PER_HOUR = 60L
private const val MINUTES_PER_DAY = 60L * 24
