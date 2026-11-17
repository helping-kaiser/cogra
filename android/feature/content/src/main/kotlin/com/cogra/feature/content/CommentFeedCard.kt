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
// already aimed at it. The score is the comment's own standing (`ScoreSlot`).
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
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.DynamicFeed
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.CommentStanceTarget
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.StateTokens
import com.cogra.core.designsystem.v2.token.TypeTokens
import com.cogra.domain.CommentView
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.headRowOf
import com.cogra.domain.score.TraceThingKind
import com.cogra.feature.saved.LocalSavedHost

/** A long comment folds at two lines under `More` (FeedCommentShapes.md). */
private const val FEED_COMMENT_CLAMP_LINES = 2

/** The head row's mark: 32dp, the card's darker tile tone (`NodeMark`'s `onCard`). */
private val MARK = 32.dp

/** The connector hangs from the mark's centre; the comment sits beside it (`CommentCard.jsx`). */
private val CONNECTOR_INSET = 15.dp
private val CONNECTOR = 2.dp
private val HUNG_INSET = 25.dp

/** The line shape's pointer glyph (`CommentCard.jsx` `Icon size={14}`). */
private val POINTER_GLYPH = 14.dp

/** The replies line hangs 28dp in under the card, its rule 24dp long (`CommentCard.jsx` 455, 465). */
private val REPLIES_INSET = 28.dp
private val REPLIES_RULE = 24.dp

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
    /** What the card's ⋮ holds and where it registers: the own rows or another's, and their doors. */
    menu: CommentCardMenu = CommentCardMenu(),
    /** How the card names what it answers: the feed's head row, or the line a listed comment leads with. */
    shape: CommentCardShape = CommentCardShape.Thread,
    /** The card stands on its author's own page — a profile's comments view — so the chip is inert. */
    authorHere: Boolean = false,
) {
    val card = node.keyed(comment.id)
    val line = shape as? CommentCardShape.Line
    Card(
        modifier = Modifier
            .fillMaxWidth()
            // IN THE LINE SHAPE THE WORDS ARE NO DOOR: the card is reached
            // through its pointer, its Reply and its replies line
            // (ProfileComments.md:23-27).
            .then(if (line == null) Modifier.clickable(onClick = onOpenPlace) else Modifier)
            .dataNode(card),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            val ownPart: @Composable () -> Unit = {
                OwnPart(
                    comment = comment,
                    node = card,
                    testTagPrefix = testTagPrefix,
                    revealed = revealed,
                    onReveal = onReveal,
                    onOpenActor = onOpenActor,
                    onOpenTopic = onOpenTopic,
                    onCite = onCite,
                    onLicense = onLicense,
                    menu = menu,
                    // A profile's list draws the words whole (`CommentCard`'s
                    // `clampLines`, off outside the feed).
                    clamped = line == null,
                    authorHere = authorHere,
                )
            }
            if (line != null) {
                target?.let { LinePointer(it, card / "target", onOpenTarget) }
                ownPart()
            } else if (target != null) {
                HeadRow(target, testTagPrefix, onOpenTarget)
                HungOnTheConnector(ownPart)
            } else {
                ownPart()
            }
            if (comment.landing.isPending) PendingMarker(testTag = "${testTagPrefix}_pending")
            if (line != null) {
                LineCommentRow(comment, testTagPrefix, line.reply, onReply, stanceControl, card / "actionRow")
            } else {
                FeedCommentRow(comment, testTagPrefix, onReply, onShare, stanceControl, card / "actionRow")
            }
            // THE ROW LINE under the face (RowSigning.md): a save or unsave of
            // this comment that did not go through.
            ComfortLine(comment.id, "${testTagPrefix}_row_line")
        }
    }
}

/**
 * THE CONNECTOR: a hairline rule down from the head's mark — centred on its
 * 32dp tile — to the comment, hung inset beside it. Drawn behind the hung part
 * rather than sized by an intrinsic pass: the part holds the tags line, whose
 * measured fold reads its constraints and so answers no intrinsic query.
 */
@Composable
private fun HungOnTheConnector(part: @Composable () -> Unit) {
    val rule = MaterialTheme.colorScheme.outlineVariant
    Column(
        modifier = Modifier
            .padding(start = CONNECTOR_INSET)
            .drawBehind {
                val x = CONNECTOR.toPx() / 2
                drawLine(rule, Offset(x, 0f), Offset(x, size.height), strokeWidth = CONNECTOR.toPx())
            }
            .padding(start = CONNECTOR + HUNG_INSET),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        part()
    }
}

/**
 * A comment card's ⋮ off the thread (CommentMenu.md:5, CommentMenuOwn.md:7):
 * the own rows or another's, the doors its rows open over the host, and the
 * host's registered sheet. The default stands the rows inert under their tags.
 */
internal data class CommentCardMenu(
    val own: Boolean = false,
    val onEdit: () -> Unit = {},
    val onRemove: () -> Unit = {},
    val onReport: (() -> Unit)? = null,
    val placement: CommentMenuPlacement? = null,
)

/**
 * HOW A COMMENT CARD NAMES WHAT IT ANSWERS (`CommentCard`'s `targetShape`).
 * [Thread] is the feed's: the post as a head row, the comment hung under it.
 * [Line] is a comment listed away from its thread — a profile's comments
 * view (ProfileComments): the one-line `On …` pointer leading, the words
 * whole, the thread's text Reply in the row, and no score and no share.
 */
sealed interface CommentCardShape {
    data object Thread : CommentCardShape

    data class Line(val reply: LineReply) : CommentCardShape
}

/** What the line shape's text Reply does for this reader (`CommentCard`'s `replyOpacity`, `signedIn`). */
enum class LineReply {
    /** A member: the thread opens, its composer aimed at the comment (ProfileComments.md:25). */
    Open,

    /** An applicant: the locked look, still tappable, its tap answered in the snackbar (:29). */
    Locked,

    /** A guest: no Reply, as the thread draws none for one. */
    None,
}

/**
 * A LISTED COMMENT, AND ITS COLLAPSED BRANCH UNDER IT (`CommentCard`'s line
 * shape; ProfileComments.md): the card, then — 12dp below, outside its
 * surface — the "View n replies" line, its door the thread (:27). The line
 * wears [repliesNode] keyed by the comment's id, the card's sibling path.
 */
@Composable
internal fun ListedCommentCard(
    comment: CommentView,
    repliesNode: DataNode,
    testTagPrefix: String,
    onOpenReplies: () -> Unit,
    card: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Space.x3)) {
        card()
        if (comment.replyCount > 0) ViewRepliesLine(comment, repliesNode, testTagPrefix, onOpenReplies)
    }
}

/** The collapsed branch: a short rule and the count, indented under the card (`CommentCard.jsx` 437-468). */
@Composable
private fun ViewRepliesLine(comment: CommentView, node: DataNode, testTagPrefix: String, onOpen: () -> Unit) {
    val rule = MaterialTheme.colorScheme.outlineVariant
    Row(
        modifier = Modifier
            .padding(start = REPLIES_INSET)
            .clip(RoundedCornerShape(Space.x2))
            .dataNode(node.keyed(comment.id))
            .clickable(role = Role.Button, onClick = onOpen)
            .padding(top = Space.x1, bottom = Space.x1, end = Space.x2),
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(width = REPLIES_RULE, height = 1.dp)
                .drawBehind { drawRect(rule) },
        )
        Text(
            text = pluralStringResource(R.plurals.content_comment_view_replies, comment.replyCount, comment.replyCount),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("${testTagPrefix}_replies"),
        )
    }
}

/**
 * THE TARGET POINTER (`CommentCard`'s line shape; ProfileComments.md:5): one
 * line, one tap — the target kind's glyph, then `On …` in the quiet ink at
 * label-small, ellipsized.
 */
@Composable
private fun LinePointer(target: CommentTarget, node: DataNode, onOpen: () -> Unit) {
    val row = headRowOf(target)
    val words = stringResource(R.string.content_card_on, row.label)
    Row(
        modifier = Modifier
            // The pointer stands across the card, a block in its column
            // (`CommentCard.jsx`: the button stretches in the card's flex column).
            .fillMaxWidth()
            .clip(RoundedCornerShape(Space.x2))
            .dataNode(node)
            .clickable(role = Role.Button, onClick = onOpen),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (row.comment) Icons.Filled.ChatBubble else Icons.Filled.DynamicFeed,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(POINTER_GLYPH),
        )
        Text(
            text = words,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * THE LINE SHAPE'S ROW (`CommentCard` without `replyGlyph`, `score` or
 * `onShare`): the opinion, then the thread's text `Reply`, spread across the
 * card. A removed comment keeps its Reply, as in its thread (CommentRemoved.md).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LineCommentRow(
    comment: CommentView,
    testTagPrefix: String,
    reply: LineReply,
    onReply: () -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
    node: DataNode,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth().dataNode(node),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(Space.x1),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        CommentStanceTarget { stanceControl(comment.id, testTagPrefix, node / "stance") }
        if (reply != LineReply.None) {
            CograButton(
                text = stringResource(R.string.content_comment_reply),
                onClick = onReply,
                kind = ButtonKind.Text,
                size = ButtonSize.Compact,
                modifier = Modifier
                    .dataNode(node / "reply")
                    .alpha(if (reply == LineReply.Locked) StateTokens.DISABLED else 1f),
            )
        }
    }
}

/** OPINION · SCORE · THE COMMENT GLYPH · SHARE — the card's one row (FeedKinds.md:3). */
@Composable
private fun FeedCommentRow(
    comment: CommentView,
    testTagPrefix: String,
    onReply: () -> Unit,
    onShare: () -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
    /** The row's registered node (`saved.commentCard.actionRow`): its stance, reply and share wear its parts. */
    node: DataNode,
) {
    Row(
        modifier = Modifier.fillMaxWidth().dataNode(node),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CommentStanceTarget { stanceControl(comment.id, testTagPrefix, node / "stance") }
        ScoreSlot(
            targetId = comment.id,
            kind = TraceThingKind.COMMENT,
            pending = comment.landing.isPending,
            cover = commentCover(comment),
            node = node / "score",
            testTag = "${testTagPrefix}_score",
        )
        val handle = comment.author?.handle
        GlyphAffordance(
            icon = Icons.Filled.ChatBubble,
            description = handle?.let { stringResource(R.string.content_card_reply_to, "@$it") }
                ?: stringResource(R.string.content_comment_reply),
            testTag = (node / "reply").tag,
            onClick = onReply,
        )
        GlyphAffordance(
            icon = Icons.Filled.Share,
            description = stringResource(R.string.content_share_comment),
            testTag = (node / "share").tag,
            onClick = onShare,
        )
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
                fontWeight = if (row.removed) TypeTokens.SystemVoiceWeight else null,
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
internal fun NodeMark(comment: Boolean, coverUrl: String?, removed: Boolean, testTag: String) {
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
    /** The card (`saved.commentCard`, keyed): its author chip, ⋮ and media wear its parts. */
    node: DataNode,
    testTagPrefix: String,
    revealed: Boolean,
    onReveal: () -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onCite: () -> Unit,
    onLicense: () -> Unit,
    menu: CommentCardMenu,
    /** The words fold at two lines under `More` — in the feed, never on a listed comment. */
    clamped: Boolean,
    authorHere: Boolean,
) {
    ContentCardHeader(
        author = comment.author,
        at = comment.createdAt,
        onOpenActor = onOpenActor,
        authorHere = authorHere,
        testTagPrefix = testTagPrefix,
        // A REMOVED COMMENT HAS NO MENU LEFT (CommentRemoved.md:9): its ⋮ goes
        // with the payload.
        menu = if (comment.removed) {
            emptyList()
        } else {
            commentMenuRows(
                comment = comment,
                own = menu.own,
                onCite = onCite,
                onLicense = onLicense,
                onEdit = menu.onEdit,
                onRemove = menu.onRemove,
                onReport = menu.onReport,
                placement = menu.placement,
            )
        },
        menuContentDescription = stringResource(R.string.content_menu_comment),
        // UNSTACKED OVER ITS HOST (CommentMenu.md:5): the host's registered sheet.
        menuSheetNode = menu.placement?.sheet,
        node = node,
    )
    // THE COMPACT VEIL TAKES THE WORDS (FeedCommentShapes.md); the head row
    // above stays readable.
    PostBody(
        content = comment.content,
        description = null,
        attachments = comment.attachments,
        attachmentsStatus = comment.attachmentsStatus,
        moderation = comment.moderation,
        removal = comment.removal,
        testTagPrefix = testTagPrefix,
        collapsed = clamped,
        wordsClampLines = FEED_COMMENT_CLAMP_LINES,
        surface = BodySurface.Comment,
        revealed = revealed,
        onReveal = onReveal,
        sensitiveSource = if (comment.sensitiveSelfMark) SensitiveSource.Author else SensitiveSource.Platform,
        sensitiveReason = comment.sensitiveReason,
        node = node,
    )
    TopicsLine(
        topics = comment.topics,
        references = comment.references,
        onOpenTopic = onOpenTopic,
        testTagPrefix = testTagPrefix,
    )
}
