// THE LISTS OF FEED CARDS a reader's own surfaces stand — Saved and History
// (Saved.md, History.md): each thing as its kind's own live feed card, the
// doors every card opens, the thread a post card's comment count raises over
// the list, the comment card's wiring, and the next page asked a few cards
// short of the end. One implementation, so the lists cannot drift apart.

package com.cogra.feature.content

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.CommentView
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.stance.StanceControlRoute

/** Where the doors a list's card opens are asked to land. */
data class CardDoors(
    val onOpenPost: (String) -> Unit,
    /** The thread over [postId], landed on [commentId]; [aimReply] opens the composer aimed at it. */
    val onOpenComment: (postId: String, commentId: String, aimReply: Boolean) -> Unit,
    val onOpenActor: (String) -> Unit,
    val onOpenTopic: (String) -> Unit,
)

/** What a card's share hands over: the thing's own address. */
data class CardShareUrls(
    val post: (String) -> String,
    val comment: (postId: String, commentId: String) -> String,
    val profile: (String) -> String,
)

/**
 * What the route hands a list's cards beyond their doors: the viewer, the
 * shares, the menus' routes, the veil's reveal and the stance control —
 * hoisted, so the screen stays free of DI and previewable.
 */
data class CardHooks(
    val viewerId: String? = null,
    val onShare: (String) -> Unit = {},
    val shareUrls: CardShareUrls = CardShareUrls({ it }, { _, comment -> comment }, { it }),
    val onEditPost: (String) -> Unit = {},
    val onCitePost: (String) -> Unit = {},
    val onReveal: (String, SensitiveMark) -> Unit = { _, _ -> },
    val stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit =
        { _, _, _ -> },
)

/** What every card on a list is handed: the route's hooks, its doors, the reveals and the sheets it raises. */
internal data class CardActions(
    val hooks: CardHooks,
    val doors: CardDoors,
    val reveals: Map<String, SensitiveMark>,
    val onOpenComments: (String) -> Unit,
    val onReport: (String) -> Unit,
) {
    val viewerId: String? get() = hooks.viewerId
    val onShare: (String) -> Unit get() = hooks.onShare
    val shareUrls: CardShareUrls get() = hooks.shareUrls
    val onEditPost: (String) -> Unit get() = hooks.onEditPost
    val onCitePost: (String) -> Unit get() = hooks.onCitePost
    val onReveal: (String, SensitiveMark) -> Unit get() = hooks.onReveal
    val stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit
        get() = hooks.stanceControl
}

/** THE THREAD, OVER A LIST: a post card's comment count raises it, as over the feed. */
@Composable
internal fun ListThread(
    postId: String,
    post: PostView?,
    viewerId: String?,
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    doors: CardDoors,
    onCitePost: (String) -> Unit,
    onReply: (ReplyTarget) -> Unit,
    onEditComment: (commentId: String, parentTitle: String) -> Unit,
    onSignInOrJoin: () -> Unit,
    commentsReturn: CommentsReturn,
    onCommentsReturnConsumed: () -> Unit,
    onCommentsDepart: (CommentsScroll) -> Unit,
) {
    CommentsSheetRoute(
        postId = postId,
        viewerId = viewerId,
        signedIn = signedIn,
        onDismiss = onDismiss,
        onReply = { request -> (request.comment?.asReplyTarget() ?: post?.asReplyTarget())?.let(onReply) },
        onEditComment = { commentId -> onEditComment(commentId, post?.title?.value.orEmpty()) },
        onOpenActor = doors.onOpenActor,
        onOpenTopic = doors.onOpenTopic,
        onReference = onCitePost,
        onSignInOrJoin = onSignInOrJoin,
        onDepart = onCommentsDepart,
        commentsReturn = commentsReturn,
        onReturnConsumed = onCommentsReturnConsumed,
        stanceControl = { target, tag ->
            StanceControlRoute(target = StanceTarget.Node(target), testTagPrefix = tag)
        },
    )
}

/** A listed comment as the comment feed card, its doors landing on its thread. */
@Composable
internal fun ListCommentCard(
    comment: CommentView,
    target: CommentTarget?,
    threadPostId: String?,
    /** The registered card (`saved.commentCard`, `history.commentCard`). */
    node: DataNode,
    testTagPrefix: String,
    actions: CardActions,
) {
    val doors = actions.doors
    var licenseOpen by remember(comment.id) { mutableStateOf(false) }
    CommentFeedCard(
        comment = comment,
        target = target,
        node = node,
        testTagPrefix = testTagPrefix,
        revealed = actions.reveals.isRevealed(comment.id, comment.sensitiveMark()),
        onReveal = { actions.onReveal(comment.id, comment.sensitiveMark()) },
        onOpenTarget = {
            when (target) {
                is CommentTarget.Post -> doors.onOpenPost(target.id)
                is CommentTarget.Comment -> threadPostId?.let { doors.onOpenComment(it, target.id, false) }
                null -> Unit
            }
        },
        onOpenPlace = { threadPostId?.let { doors.onOpenComment(it, comment.id, false) } },
        onReply = { threadPostId?.let { doors.onOpenComment(it, comment.id, true) } },
        onShare = { threadPostId?.let { actions.onShare(actions.shareUrls.comment(it, comment.id)) } },
        onOpenActor = doors.onOpenActor,
        onOpenTopic = doors.onOpenTopic,
        onCite = { actions.onCitePost(comment.id) },
        onLicense = { licenseOpen = true },
        stanceControl = actions.stanceControl,
    )
    if (licenseOpen) {
        LicenseSheet(license = comment.license, onDismiss = { licenseOpen = false })
    }
}

/** THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (readme §13): asked a few cards short of the end. */
@Composable
internal fun LoadNextAtTheTail(
    list: LazyListState,
    hasNextPage: Boolean,
    moreFailed: Boolean,
    /** How many list items the cards and their furniture stand as. */
    items: Int,
    onLoadMore: () -> Unit,
) {
    LaunchedEffect(list, hasNextPage, moreFailed, items) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .collect { last ->
                val nearEnd = last >= items - FEED_TAIL_DISTANCE
                if (hasNextPage && !moreFailed && nearEnd) onLoadMore()
            }
    }
}
