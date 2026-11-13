// THE LISTS OF FEED CARDS a reader's own surfaces stand — Saved and History
// (Saved.md, History.md): each thing as its kind's own live feed card, the
// doors every card opens, the thread a post card's comment count raises over
// the list, the comment card's wiring, and the next page asked a few cards
// short of the end. One implementation, so the lists cannot drift apart.

package com.cogra.feature.content

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import com.cogra.core.designsystem.DataNode
import com.cogra.domain.CommentView
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.marked
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.headRowOf
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
    /** The own comment menu's Edit: the comment's edit over the host, [parentTitle] its caption. */
    val onEditComment: (commentId: String, parentTitle: String) -> Unit = { _, _ -> },
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
    val onReport: (ReportAsk) -> Unit,
    /** The host's off-thread edit return: which edit it opened, and the comments it re-read since. */
    val editReturn: EditReturn? = null,
) {
    val viewerId: String? get() = hooks.viewerId
    val onShare: (String) -> Unit get() = hooks.onShare
    val shareUrls: CardShareUrls get() = hooks.shareUrls
    val onEditPost: (String) -> Unit get() = hooks.onEditPost
    val onCitePost: (String) -> Unit get() = hooks.onCitePost
    val onEditComment: (String, String) -> Unit get() = hooks.onEditComment
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
    /** What came back to the thread's host: the thread reads it as its own return. */
    returns: HostReturn,
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
        commentsReturn = returns.value,
        onReturnConsumed = returns.onConsumed,
        stanceControl = { target, tag, node ->
            StanceControlRoute(target = StanceTarget.Node(target), testTagPrefix = tag, node = node)
        },
    )
}

/** A listed comment as the comment feed card, its doors landing on its thread. */
@Composable
internal fun ListCommentCard(
    /** The comment as the list read it; a removal since stands as its mark. */
    listed: CommentView,
    target: CommentTarget?,
    threadPostId: String?,
    /** The registered card (`saved.commentCard`, `history.commentCard`). */
    node: DataNode,
    testTagPrefix: String,
    actions: CardActions,
    /** The feed's head row (Saved, History), or the line a profile lists its comments in. */
    shape: CommentCardShape = CommentCardShape.Thread,
    authorHere: Boolean = false,
    /** The head row's door where it differs from what it names — the line shape's lands on the thread. */
    onOpenTarget: (() -> Unit)? = null,
    /** The reply's door where it differs from the thread aimed at the comment — an applicant's lock. */
    onReply: (() -> Unit)? = null,
    /** The sheet the card's ⋮ raises on this host and the rows its boards register; null keeps the rows' tags. */
    menu: CommentMenuPlacement? = null,
) {
    val doors = actions.doors
    // THE CARD AS THIS DEVICE KNOWS IT NOW: removed here or anywhere since the
    // page was read, it stands as its mark in place (RM-G9).
    // …and an edit signed off the thread since, standing in its place ([EditReturn]).
    val comment = (actions.editReturn?.shown(listed) ?: listed).marked(rememberRemovedMarks())
    var licenseOpen by remember(comment.id) { mutableStateOf(false) }
    var removeOpen by remember(comment.id) { mutableStateOf(false) }
    val own = actions.viewerId != null && comment.author?.id == actions.viewerId
    CommentFeedCard(
        comment = comment,
        menu = listedCommentMenu(comment, own, target, actions, menu) { removeOpen = true },
        target = target,
        node = node,
        testTagPrefix = testTagPrefix,
        revealed = actions.reveals.isRevealed(comment.id, comment.sensitiveMark()),
        onReveal = { actions.onReveal(comment.id, comment.sensitiveMark()) },
        onOpenTarget = onOpenTarget ?: {
            when (target) {
                is CommentTarget.Post -> doors.onOpenPost(target.id)
                is CommentTarget.Comment -> threadPostId?.let { doors.onOpenComment(it, target.id, false) }
                null -> Unit
            }
            Unit
        },
        onOpenPlace = { threadPostId?.let { doors.onOpenComment(it, comment.id, false) } },
        onReply = onReply ?: {
            threadPostId?.let { doors.onOpenComment(it, comment.id, true) }
            Unit
        },
        onShare = { threadPostId?.let { actions.onShare(actions.shareUrls.comment(it, comment.id)) } },
        onOpenActor = doors.onOpenActor,
        onOpenTopic = doors.onOpenTopic,
        onCite = { actions.onCitePost(comment.id) },
        onLicense = { licenseOpen = true },
        stanceControl = actions.stanceControl,
        shape = shape,
        authorHere = authorHere,
    )
    if (licenseOpen) {
        LicenseSheet(license = comment.license, onDismiss = { licenseOpen = false })
    }
    // The own comment's menu off its thread (RM-G9): the comment's confirm,
    // over the list; taken, the card stands as its mark in place.
    if (removeOpen) {
        RemoveConfirm(
            kind = RemovalKind.Comment,
            nodeId = comment.id,
            record = comment.genesisRecordId,
            onClose = { removeOpen = false },
            testTag = "${testTagPrefix}_remove_confirm",
        )
    }
}

/** A host's side of the comment return: what came back, how it is marked read, and the one-comment re-read. */
data class HostReturn(
    val value: CommentsReturn = CommentsReturn(),
    val onConsumed: () -> Unit = {},
    val reread: suspend (String) -> CommentView? = { null },
)

/**
 * AN EDIT OPENED OFF THE THREAD RETURNS TO ITS HOST (CommentEdit.md:89,
 * HistoryCommentMenuOwn.md:17, Saved.md:135, ProfileCommentsMenuOwn.md:17):
 * signed, "that host comes back as it was left AND the edited comment's card
 * settles in place there wearing Still settling" — so the host does NOT read
 * its list again (History.md:117: the order stands until the next open or
 * pull). It re-reads the ONE comment it opened the edit for and stands the
 * fresh read in that card's place; the list, its order and its scroll hold.
 * web's twin is the card's `fetchComment` re-read (`comment-feed-card.tsx`).
 *
 * The edit is its own destination, so the host's composition leaves while it
 * runs: which comment was opened rides saved state, and the re-read lands
 * once the host is back.
 */
@Stable
internal class EditReturn(
    private val opened: MutableState<String?>,
    /** The comments re-read since an edit off the thread was signed, by id. */
    val settled: Map<String, CommentView>,
) {
    /** The own menu's Edit was tapped on [commentId]'s card. */
    fun opening(commentId: String) {
        opened.value = commentId
    }

    /** The card as the host shows it: the fresh read once its edit was signed, else as listed. */
    fun shown(listed: CommentView): CommentView = settled[listed.id] ?: listed
}

/**
 * The host's half of [EditReturn]. A return the host does not handle — a
 * signed reply or edit while no edit of its own was opened, with no thread
 * standing over it to take it — is consumed all the same, so it cannot fire
 * the thread's signed line the next time a thread opens here.
 */
@Composable
internal fun rememberEditReturn(returns: HostReturn, threadOpen: Boolean): EditReturn {
    val commentsReturn = returns.value
    val opened = rememberSaveable { mutableStateOf<String?>(null) }
    val settled = remember { mutableStateMapOf<String, CommentView>() }
    LaunchedEffect(commentsReturn.landed, threadOpen) {
        if (!commentsReturn.landed || threadOpen) return@LaunchedEffect
        val id = opened.value
        opened.value = null
        returns.onConsumed()
        if (id != null) returns.reread(id)?.let { settled[id] = it }
    }
    return remember(opened, settled) { EditReturn(opened, settled) }
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

/**
 * What the edit's caption names (`Your comment on "…".`, which quotes it): a
 * post's own title, else the head row's words — `@mira's comment` (seam 320-15).
 */
private fun editCaption(target: CommentTarget?): String = when (target) {
    null -> ""
    is CommentTarget.Post -> headRowOf(target).title
    else -> headRowOf(target).label
}

/**
 * A listed comment's ⋮: the own rows or another's, their doors over the host.
 * THE EDIT OPENED OFF THE THREAD RETURNS TO THIS HOST (CommentEdit.md:89): the
 * host notes which comment it opened ([EditReturn]), and the edit's caption
 * names what the comment answers, as the head row does.
 */
private fun listedCommentMenu(
    comment: CommentView,
    own: Boolean,
    target: CommentTarget?,
    actions: CardActions,
    placement: CommentMenuPlacement?,
    onRemove: () -> Unit,
) = CommentCardMenu(
    own = own,
    onEdit = {
        actions.editReturn?.opening(comment.id)
        actions.onEditComment(comment.id, editCaption(target))
    },
    onRemove = onRemove,
    onReport = { actions.onReport(ReportAsk(comment.id, ReportKind.Comment)) },
    placement = placement,
)
