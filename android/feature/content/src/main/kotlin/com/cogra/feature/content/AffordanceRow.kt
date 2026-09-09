// The post card's affordance row (`design/components/content/PostCard.jsx`
// lines 300-358, design/readme.md §13).
//
// ONE LINE, NEVER WRAPPING. A second row of affordances reads as a
// second kind of thing, and it costs the height a post does not have.
// That constraint is what keeps every affordance here glyph-plus-number
// — words would not fit, which is a feature. Nothing in the row takes
// `primaryContainer`: the stance knob already spends it.
//
// The order is the order of importance — stance, score, comment, share
// — and it is also the queue: on a phone too narrow to hold all four,
// share is the first to move into the ⋮ and the row gives way from its
// end.

package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.feature.content.R

/** The row's glyphs, the size the master draws them. */
private val GLYPH = 18.dp

/** The 6px seam between a glyph and the number beside it. */
private val GLYPH_GAP = 6.dp

/**
 * The row a post wears on the card and on the detail alike.
 *
 * **Two of the master's five are gated, and both for the same reason
 * (design/readme.md §2, the staging rule): a control whose destination
 * is neither designed nor built is a dead control.**
 *
 * - **The Post Score** is routed at an acknowledged gap — `graph.json`
 *   sends every `Post Score` edge to *"Post Score drill-down (backlog
 *   item 13)"* — and the contract carries no score to draw either:
 *   `schema.graphql`'s `Post` has no such field. The element arrives
 *   when the drill-down and the field do.
 * - **The overflow ⋮** opens `ReaderPostMenu`, whose rows (License
 *   terms, Cite in a new post) are W3's sheets. Its other possible
 *   content is a folded affordance — but with the score gated the row
 *   is stance, comment and share, which fits every phone width the app
 *   supports, so nothing folds into it. The ⋮ and the fold arrive
 *   together with the menu.
 *
 * @param commentCount the whole thread's size, across every page.
 * @param onOpenComments where the count leads, or null where the thread
 *   is already on screen.
 * @param actions the master's own tail slot (`PostCard.jsx:357`), for a
 *   control a surface grows past the four. It is where the detail's
 *   Reference affordance waits: the board's home for it is the ⋮'s
 *   `Cite in a new post` row, and that menu is W3's.
 */
@Composable
internal fun PostAffordanceRow(
    commentCount: Int,
    onOpenComments: (() -> Unit)?,
    onShare: () -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    actions: @Composable () -> Unit = {},
    stanceControl: @Composable () -> Unit,
) {
    Row(
        modifier = modifier.testTag("${testTagPrefix}_affordances"),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        stanceControl()
        CommentAffordance(commentCount, onOpenComments, testTagPrefix)
        ShareAffordance(onShare, testTagPrefix)
        actions()
    }
}

/**
 * Comments get their own affordance rather than living behind a tap on
 * the card: "read the replies" is a different intent from "read the
 * post", and the count is information in itself.
 *
 * **On the feed it opens the post; on the detail it states.** The
 * master's own fallback is `onOpenComments ?? onOpen` — the card opens
 * where the thread is. On the detail the thread is already under it and
 * its sheet (`ReplyEntry`) is W3's, so the count reads as the fact it
 * is rather than as a tap revealing what is already on screen.
 */
@Composable
private fun CommentAffordance(
    count: Int,
    onOpen: (() -> Unit)?,
    testTagPrefix: String,
) {
    val spoken = pluralStringResource(R.plurals.content_comment_count, count, count)
    val glyphAndCount: @Composable RowScope.() -> Unit = {
        Icon(
            imageVector = Icons.Filled.ChatBubble,
            contentDescription = null,
            modifier = Modifier.size(GLYPH),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (count > 0) {
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
    if (onOpen == null) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(GLYPH_GAP),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .testTag("${testTagPrefix}_comments")
                .clearAndSetSemantics { contentDescription = spoken },
            content = glyphAndCount,
        )
    } else {
        GlyphButton(
            onClick = onOpen,
            description = spoken,
            testTag = "${testTagPrefix}_comments",
            content = glyphAndCount,
        )
    }
}

/**
 * One tap to the platform's own share sheet — no surface of ours. The
 * control carries no number: a share count would be a public tally of
 * something the graph does not record.
 */
@Composable
private fun ShareAffordance(onShare: () -> Unit, testTagPrefix: String) {
    GlyphButton(
        onClick = onShare,
        description = stringResource(R.string.content_share_post),
        testTag = "${testTagPrefix}_share",
    ) {
        Icon(
            imageVector = Icons.Filled.Share,
            contentDescription = null,
            modifier = Modifier.size(GLYPH),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * The row's shared control shape: a pill-shaped target whose glyph is
 * absorbed into one accessible name, so a listener hears "3 comments"
 * rather than a glyph and a number apart. Drawn compact, tapped at the
 * 48dp minimum.
 */
@Composable
private fun GlyphButton(
    onClick: () -> Unit,
    description: String,
    testTag: String,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(GLYPH_GAP),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .clip(CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = Space.x2, vertical = GLYPH_GAP)
            .testTag(testTag)
            .semantics(mergeDescendants = true) { contentDescription = description },
        content = content,
    )
}
