// THE COMMENT CARD — a slice of its thread (`_shared.jsx` `CommentFeedCard`,
// `CommentCard`'s `thread` shape; FeedCommentShapes.md, FeedKinds.md). web's
// twin is `web/src/lib/ui/comment-feed-card.tsx`.
//
// A comment is the one feed card whose meaning depends on something else, so
// it says what it answers before a word of it is read: the head row — the
// answered thing's mark, its title, its author — and the comment hung under it
// on a connector rule, the way a reply hangs under what it answers.
//
// THE DOUBLE DOOR. The head row opens what it names. The rest of the card opens
// the comment's own place — the post's comment section, scrolled to this
// comment. Things with their own meaning keep it: the author chip, the chips,
// the row.
//
// THE ROW READS OPINION · SCORE · THE COMMENT GLYPH · SHARE (FeedKinds.md). The
// glyph is the reply: the same comment section at this comment, the composer
// already aimed at it. The score slot waits with the post card's: no field
// carries a card's score until the ranker's figure reaches the contract.
// REPLIES NEVER APPEAR IN A FEED: the card carries no view-replies line.
//
// ITS ⋮ IS THE COMMENT'S MENU (`commentMenuRows`), the sheet every comment's ⋮
// opens, never the post card's.

package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.CommentView
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.headRowOf
import com.cogra.feature.saved.LocalSavedHost

/** A long comment folds at two lines under `More` (FeedCommentShapes.md). */
private const val FEED_COMMENT_CLAMP_LINES = 2

/** The head row's mark: 32dp, the card's darker tile tone (`NodeMark`'s `onCard`). */
private val MARK = 32.dp

/** The connector hangs from the mark's centre; the comment sits beside it (`CommentCard.jsx`). */
private val CONNECTOR_INSET = 15.dp
private val CONNECTOR = 2.dp
private val HUNG_INSET = 25.dp

@Composable
internal fun CommentFeedCard(
    comment: CommentView,
    /** What the comment answers — its head row; null draws the card without one. */
    target: CommentTarget?,
    /** The registered card (`saved.commentCard`), keyed by the comment's id here. */
    node: DataNode,
    testTagPrefix: String,
    revealed: Boolean,
    onReveal: () -> Unit,
    /** The head row's door: what it names. */
    onOpenTarget: () -> Unit,
    /** The card's own door: the thread, landed on this comment. */
    onOpenPlace: () -> Unit,
    /** The comment glyph: the same landing, the reply composer aimed at it. */
    onReply: () -> Unit,
    onShare: () -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onCite: () -> Unit,
    onLicense: () -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    val card = node.keyed(comment.id)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenPlace)
            .dataNode(card),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            if (target != null) {
                HeadRow(target, testTagPrefix, onOpenTarget)
                // THE CONNECTOR: a hairline rule down from the head's mark —
                // centred on its 32dp tile — to the comment, hung inset beside it.
                Row(Modifier.height(IntrinsicSize.Min).padding(start = CONNECTOR_INSET)) {
                    Box(
                        Modifier
                            .width(CONNECTOR)
                            .fillMaxHeight()
                            .background(MaterialTheme.colorScheme.outlineVariant),
                    )
                    Column(
                        modifier = Modifier.padding(start = HUNG_INSET),
                        verticalArrangement = Arrangement.spacedBy(Space.x3),
                    ) {
                        OwnPart(comment, testTagPrefix, revealed, onReveal, onOpenActor, onOpenTopic, onCite, onLicense)
                    }
                }
            } else {
                OwnPart(comment, testTagPrefix, revealed, onReveal, onOpenActor, onOpenTopic, onCite, onLicense)
            }
            if (comment.landing.isPending) PendingMarker(testTag = "${testTagPrefix}_pending")
            Row(
                modifier = Modifier.fillMaxWidth().testTag("${testTagPrefix}_affordances"),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                stanceControl(comment.id, testTagPrefix, null)
                val handle = comment.author?.handle
                GlyphAffordance(
                    icon = Icons.Filled.ChatBubble,
                    description = handle?.let { stringResource(R.string.content_card_reply_to, "@$it") }
                        ?: stringResource(R.string.content_comment_reply),
                    testTag = "${testTagPrefix}_reply",
                    onClick = onReply,
                )
                GlyphAffordance(
                    icon = Icons.Filled.Share,
                    description = stringResource(R.string.content_share_comment),
                    testTag = "${testTagPrefix}_share",
                    onClick = onShare,
                )
            }
            // THE ROW LINE under the face (RowSigning.md): a save or unsave of
            // this comment that did not go through.
            ComfortLine(comment.id, "${testTagPrefix}_row_line")
        }
    }
}

@Composable
private fun ComfortLine(node: String, testTag: String) {
    LocalSavedHost.current?.comfortLine(node)?.let { RowLine(it, testTag) }
}

/**
 * THE HEAD ROW — its own door, to what it names. A removed target keeps its
 * row: its tile keeps its space empty and the title's place reads the removal
 * line in the system's voice, over the author, who stays.
 */
@Composable
private fun HeadRow(target: CommentTarget, testTagPrefix: String, onOpen: () -> Unit) {
    val row = headRowOf(target)
    val door = stringResource(R.string.content_card_on, row.label)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("${testTagPrefix}_head")
            .clip(RoundedCornerShape(Space.x2))
            .clickable(onClick = onOpen)
            // ONE DOOR, ONE NAME: the row is heard as `On <what it names>`,
            // never as its title and sub-line read apart.
            .clearAndSetSemantics {
                contentDescription = door
                role = Role.Button
            },
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NodeMark(
            comment = row.comment,
            coverUrl = row.coverUrl,
            removed = row.removed,
            testTag = "${testTagPrefix}_head_mark",
        )
        Column(Modifier.weight(1f)) {
            Text(
                text = row.title,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = if (row.removed) FontWeight.Normal else null,
                color = quietIf(row.removed),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("${testTagPrefix}_head_title"),
            )
            Text(
                text = row.sub,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** The system's voice where [quiet] — a removal's line, a deleted account's name — else the plain ink. */
@Composable
internal fun quietIf(quiet: Boolean): Color =
    if (quiet) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface

/**
 * A kind's mark (`ReferenceRow.jsx` `NodeMark`) where the head row draws it: a
 * post's cover, else the text post's `T`; a comment's glyph; a removed
 * target's empty tile.
 */
@Composable
private fun NodeMark(comment: Boolean, coverUrl: String?, removed: Boolean, testTag: String) {
    Box(
        modifier = Modifier
            .size(MARK)
            .clip(RoundedCornerShape(Space.x2))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        when {
            removed -> Unit
            !comment && coverUrl != null -> AsyncImage(
                model = coverUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(MARK),
            )
            !comment -> Text(
                text = "T",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            else -> Icon(
                imageVector = Icons.Filled.ChatBubble,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

/** The comment's own part — who, what, its topics — standing straight or hung on the connector. */
@Composable
private fun OwnPart(
    comment: CommentView,
    testTagPrefix: String,
    revealed: Boolean,
    onReveal: () -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onCite: () -> Unit,
    onLicense: () -> Unit,
) {
    ContentCardHeader(
        author = comment.author,
        at = comment.createdAt,
        onOpenActor = onOpenActor,
        testTagPrefix = testTagPrefix,
        menu = if (isRemoved(comment.content, comment.attachments, comment.attachmentsStatus)) {
            emptyList()
        } else {
            commentMenuRows(comment = comment, onCite = onCite, onLicense = onLicense)
        },
        menuContentDescription = stringResource(R.string.content_menu_comment),
    )
    // THE COMPACT VEIL TAKES THE WORDS (FeedCommentShapes.md); the head row
    // above stays readable.
    PostBody(
        content = comment.content,
        description = null,
        attachments = comment.attachments,
        attachmentsStatus = comment.attachmentsStatus,
        moderation = comment.moderation,
        testTagPrefix = testTagPrefix,
        collapsed = true,
        wordsClampLines = FEED_COMMENT_CLAMP_LINES,
        surface = BodySurface.Comment,
        revealed = revealed,
        onReveal = onReveal,
        sensitiveSource = if (comment.sensitiveSelfMark) SensitiveSource.Author else SensitiveSource.Platform,
        sensitiveReason = comment.sensitiveReason,
    )
    TopicsLine(
        topics = comment.topics,
        references = comment.references,
        onOpenTopic = onOpenTopic,
        testTagPrefix = testTagPrefix,
    )
}
