// THE FEED'S OWN CARDS ON ANOTHER FEATURE'S LIST — a profile's posts and
// comments views (ProfilePosts.md:3, ProfileComments.md:3). The profile lists
// the person's things "as post cards, never as chronicle entries", and each
// comment "in reach of its thread": the same live cards Saved and History
// stand, unchanged, with every door they open and the sheets they raise over
// the list (a post's thread from its count, the report confirm from its ⋮).
//
// The list itself is the host's — its header rides the same scroll — so this
// file hands it the cards to draw, rather than a list: [CardListHost] wraps the
// host's content, keeps the sheets, and passes [HostedCards] down. The feature
// that hosts never depends on this module; the shell wires the two (android
// CLAUDE.md "Module discipline").

package com.cogra.feature.content

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.media.CoveringLayers
import com.cogra.core.designsystem.v2.media.LocalCoveringLayers
import com.cogra.core.designsystem.v2.media.SurfaceCover
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.SensitiveReveals
import com.cogra.domain.content.isRevealed
import com.cogra.domain.di.WebOrigin
import com.cogra.feature.content.reply.ReplyTarget
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/**
 * What a hosting list draws its cards with, and whether a sheet the cards
 * raised covers the list — while one does, the list's stage holds and nothing
 * on it counts as seen (the feed's laws).
 */
class HostedCards internal constructor(
    /** One post as the feed's post card, wearing [node] keyed by its id. */
    val post: @Composable (post: PostView, node: DataNode) -> Unit,
    /**
     * One listed comment as the comment card in its line shape, wearing
     * [node] keyed by its id, its collapsed branch under it wearing
     * [repliesNode]. [lockedReply] answers an applicant's Reply instead of the
     * thread opening (ProfileComments.md:29); null opens it.
     */
    val comment: @Composable (
        listed: ProfileComment,
        node: DataNode,
        repliesNode: DataNode,
        lockedReply: (() -> Unit)?,
    ) -> Unit,
    val covered: Boolean,
)

/** Where a hosted list's cards stand: their reveals and the addresses their shares hand over. */
@HiltViewModel
class HostedCardsViewModel @Inject constructor(
    private val reveals: SensitiveReveals,
    @WebOrigin webOrigin: String,
) : ViewModel() {
    /** SENSITIVE CONTENT KEEPS ITS VEIL, as on the feed: each body the reader chose to look at. */
    val revealed: StateFlow<Map<String, SensitiveMark>> = reveals.revealed

    fun onReveal(nodeId: String, mark: SensitiveMark) = reveals.reveal(nodeId, mark)

    /** What a card's share hands over: the thing's own web address, never the host's. */
    val shareUrls = CardShareUrls(
        post = { postId -> "$webOrigin/posts/$postId" },
        comment = { postId, commentId -> "$webOrigin/posts/$postId?comment=$commentId" },
        profile = { handle -> "$webOrigin/u/$handle" },
    )
}

/** What a hosted list's cards open beyond their doors: the menus' routes and the thread's composer. */
data class HostedCardRoutes(
    val viewerId: String?,
    val signedIn: Boolean?,
    val onEditPost: (String) -> Unit,
    val onCitePost: (String) -> Unit,
    val onReply: (ReplyTarget) -> Unit,
    val onEditComment: (commentId: String, parentTitle: String) -> Unit,
    val onSignInOrJoin: () -> Unit,
    /** A guest's report: the join prompt (ReportConfirm.md:21); null when signed in. */
    val onRequireAccount: (() -> Unit)? = null,
    val commentsReturn: CommentsReturn = CommentsReturn(),
    val onCommentsReturnConsumed: () -> Unit = {},
    val onCommentsDepart: (CommentsScroll) -> Unit = {},
)

/**
 * Hosts the feed's cards on [content]'s list: the doors they open, the thread
 * a post card's count raises over the list, the report confirm, and the
 * removal their own menus take (a card removed here stands as its mark in
 * place, RM-G9). [tag] scopes the cards' fallback tags and [notify] tells the
 * aftermath — `Reported.` — on the host page's own snackbar.
 */
@Composable
fun CardListHost(
    doors: CardDoors,
    routes: HostedCardRoutes,
    tag: String,
    notify: (String) -> Unit,
    /** The host page's own re-read: an edit signed off a card returns to the page and re-reads it. */
    onRefresh: () -> Unit = {},
    viewModel: HostedCardsViewModel = hiltViewModel(),
    content: @Composable (HostedCards) -> Unit,
) {
    val context = LocalContext.current
    val revealed by viewModel.revealed.collectAsStateWithLifecycle()
    val hooks = CardHooks(
        viewerId = routes.viewerId,
        onShare = { url -> context.sharePost(url) },
        shareUrls = viewModel.shareUrls,
        onEditPost = routes.onEditPost,
        onCitePost = routes.onCitePost,
        onEditComment = routes.onEditComment,
        onReveal = viewModel::onReveal,
        stanceControl = nodeStanceControl,
    )
    ProvideRemoval {
        HostedCardsScope(doors, routes, hooks, revealed, tag, notify, onRefresh, content)
    }
}

/** The host below its DI: what [CardListHost] stands, with its hooks handed in (and what its tests drive). */
@Composable
internal fun HostedCardsScope(
    doors: CardDoors,
    routes: HostedCardRoutes,
    hooks: CardHooks,
    revealed: Map<String, SensitiveMark>,
    tag: String,
    notify: (String) -> Unit,
    onRefresh: () -> Unit = {},
    content: @Composable (HostedCards) -> Unit,
) {
    val layers = remember { CoveringLayers() }
    // The post whose thread stands over the list: its id survives a trip
    // away and back; the post itself is the one whose count was tapped.
    var commentsFor by rememberSaveable { mutableStateOf<String?>(null) }
    var commentsPost by remember { mutableStateOf<PostView?>(null) }
    var reportFor by remember { mutableStateOf<ReportAsk?>(null) }
    EditReturnsToHost(
        commentsReturn = routes.commentsReturn,
        threadOpen = commentsFor != null,
        onRefresh = onRefresh,
        onConsumed = routes.onCommentsReturnConsumed,
    )
    val actions = CardActions(
        hooks = hooks,
        doors = doors,
        reveals = revealed,
        onOpenComments = { commentsFor = it },
        onReport = { reportFor = it },
    )
    val cards = HostedCards(
        post = { post, node ->
            HostedPostCard(post, node, tag, actions) {
                commentsPost = post
                actions.onOpenComments(post.id)
            }
        },
        comment = { listed, node, repliesNode, lockedReply ->
            HostedCommentCard(listed, node, repliesNode, tag, routes.signedIn, lockedReply, actions)
        },
        covered = commentsFor != null || reportFor != null || layers.cover == SurfaceCover.Suspended,
    )
    CompositionLocalProvider(LocalCoveringLayers provides layers) {
        content(cards)
        commentsFor?.let { postId ->
            ListThread(
                postId = postId,
                post = commentsPost?.takeIf { it.id == postId },
                viewerId = routes.viewerId,
                signedIn = routes.signedIn,
                onDismiss = { commentsFor = null },
                doors = doors,
                onCitePost = routes.onCitePost,
                onReply = routes.onReply,
                onEditComment = routes.onEditComment,
                onSignInOrJoin = routes.onSignInOrJoin,
                commentsReturn = routes.commentsReturn,
                onCommentsReturnConsumed = routes.onCommentsReturnConsumed,
                onCommentsDepart = routes.onCommentsDepart,
            )
        }
        reportFor?.let { ask ->
            reportDoor(routes.onRequireAccount, "${tag}_report_sheet")(ask, { reportFor = null }, notify)
        }
    }
}

/** A hosted post as the feed's own card; its count raises the thread over the list through [onOpenComments]. */
@Composable
private fun HostedPostCard(
    post: PostView,
    node: DataNode,
    tag: String,
    actions: CardActions,
    onOpenComments: () -> Unit,
) {
    val doors = actions.doors
    PostCard(
        post = post,
        onClick = { doors.onOpenPost(post.id) },
        onOpenComments = onOpenComments,
        onOpenPost = doors.onOpenPost,
        onOpenActor = doors.onOpenActor,
        onOpenTopic = doors.onOpenTopic,
        onShare = { id -> actions.onShare(actions.shareUrls.post(id)) },
        viewerId = actions.viewerId,
        onEdit = actions.onEditPost,
        onCite = actions.onCitePost,
        onReport = { actions.onReport(ReportAsk(post.id, ReportKind.Post)) },
        revealed = actions.reveals.isRevealed(post.id, post.sensitiveMark()),
        onReveal = { actions.onReveal(post.id, post.sensitiveMark()) },
        stanceControl = actions.stanceControl,
        placement = hostedPlacement(node, tag),
    )
}

/**
 * The sheet a hosted card's ⋮ raises. The profile's tabs are the one host of
 * these cards (this file's header), and their boards register the cards' menus
 * under the profile's own sheet (seam 300: the added `profile.menuSheet.*` rows).
 */
private val PROFILE_MENU_SHEET = DataNode("profile") / "menuSheet"

/** The profile's comment card menus: `profile.menuSheet`, every row registered (ProfileCommentsMenu, -Own). */
private val PROFILE_COMMENT_MENU = CommentMenuPlacement(PROFILE_MENU_SHEET, CommentMenuPlacement.ALL)

/**
 * A hosted post card's place: the host's registered card, keyed by the
 * post's id; its ⋮ raises the host's registered sheet (`profile.menuSheet` on
 * a profile's posts view — ProfilePostsMenu, ProfilePostsMenuOwn), the terms
 * keeping their tags; and the author chip inert, the author being the page.
 */
private fun hostedPlacement(node: DataNode, tag: String) = CardPlacement(
    card = node,
    menuSheet = PROFILE_MENU_SHEET,
    licenseSheet = null,
    tag = tag,
    menuRows = POST_MENU_ROWS,
    authorHere = true,
)

/**
 * A listed comment as the comment card's line shape, its every door landing
 * on its thread (ProfileComments.md:23-27): the pointer and the replies line
 * on the comment's own place, Reply with the composer aimed at it — an
 * applicant's answered in the snackbar — and a guest's drawing none.
 */
@Composable
private fun HostedCommentCard(
    listed: ProfileComment,
    node: DataNode,
    repliesNode: DataNode,
    tag: String,
    signedIn: Boolean?,
    lockedReply: (() -> Unit)?,
    actions: CardActions,
) {
    val doors = actions.doors
    val threadPostId = listed.threadPostId
    val comment = listed.comment
    val testTagPrefix = "${tag}_comment_${comment.id}"
    val reply = when {
        signedIn != true -> LineReply.None
        lockedReply != null -> LineReply.Locked
        else -> LineReply.Open
    }
    val openPlace = { threadPostId?.let { doors.onOpenComment(it, comment.id, false) } }
    ListedCommentCard(comment, repliesNode, testTagPrefix, onOpenReplies = { openPlace() }) {
        ListCommentCard(
            listed = listed.comment,
            target = listed.target,
            threadPostId = threadPostId,
            node = node,
            testTagPrefix = testTagPrefix,
            actions = actions,
            shape = CommentCardShape.Line(reply),
            authorHere = true,
            menu = PROFILE_COMMENT_MENU,
            // THE POINTER OPENS THE THREAD THE COMMENT LIVES IN, landed on the
            // comment that answers it (ProfileComments.md:23).
            onOpenTarget = { openPlace() },
            onReply = {
                if (lockedReply != null) {
                    lockedReply()
                } else {
                    threadPostId?.let { doors.onOpenComment(it, comment.id, true) }
                }
            },
        )
    }
}
