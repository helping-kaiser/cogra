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
import com.cogra.core.designsystem.v2.atom.CograOverflowMenu
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ActorRef
import java.time.Instant

/**
 * The row a post and a comment share.
 *
 * **The ⋮ sits beside the age**, where the master draws it — never in
 * the affordance row, which is for the things a reader actually reaches
 * for. Handed no rows it draws nothing: a trigger that opens an empty
 * sheet teaches the reader the card lies (design/readme.md §2).
 *
 * @param at when the node was authored; drawn as a compact age.
 * @param menu the overflow's rows, or empty for no ⋮ at all.
 * @param stacked the menu opens over another sheet rather than the plain
 *   page — the comment card's, over the comments thread (`CommentMenu.jsx`,
 *   design/readme.md:2364).
 */
@Composable
internal fun ContentCardHeader(
    author: ActorRef?,
    at: Instant,
    onOpenActor: (String) -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    now: Instant = Instant.now(),
    menu: List<MenuRow> = emptyList(),
    menuContentDescription: String = "",
    stacked: Boolean = false,
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
        CograOverflowMenu(
            items = menu,
            contentDescription = menuContentDescription,
            testTag = "${testTagPrefix}_menu",
            stacked = stacked,
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
