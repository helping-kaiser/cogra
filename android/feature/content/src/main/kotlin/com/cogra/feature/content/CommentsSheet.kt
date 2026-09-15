package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.feature.content.R

/**
 * THE COMMENTS SHEET, WIRED TO ITS OWN THREAD — the one comments surface
 * (jakob 2026-09-15).
 *
 * The same sheet the detail raises, raised over the feed by a card's
 * comment count, and full-function on both: reply, the comment ⋮, edit.
 * It is not a navigation destination — a sheet is a layer over the
 * surface that raised it, and the route below never changes — so it
 * takes its post id as an argument and binds [CommentsViewModel] to it,
 * rather than being reached by navigating.
 *
 * @param restoreTo where the reader was when the sheet gave way to a
 *   composer, and [pendingParent] which comment the new reply hangs
 *   under: the two halves of the return, both of them read from where
 *   the surface below keeps its results.
 */
@Composable
fun CommentsSheetRoute(
    postId: String,
    /** The viewer's account id; gates the per-comment edit affordance. */
    viewerId: String?,
    /** Null while the auth phase resolves; the comment affordances wait. */
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    /** The composer, pinned to what it answers (`ReplyEntry` 5 and 7). */
    onReply: (ReplyTargetRequest) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (commentId: String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** The Reference affordance (D20): compose a post citing this node. */
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    /**
     * Called as the sheet gives way to a composer, carrying the reader's
     * place — the surface below keeps it until they come back.
     */
    onDepart: (CommentsScroll) -> Unit = {},
    /** What came back with the reader — see [CommentsReturn]. */
    commentsReturn: CommentsReturn = CommentsReturn(),
    /** Marks the return consumed, so it cannot fire twice. */
    onReturnConsumed: () -> Unit = {},
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit = { _, _ -> },
    viewModel: CommentsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    // In an effect, not the composition body: a recomposition that never
    // commits would otherwise fire the refetch anyway. The landing is
    // not consumed here — the place is the other half of the same
    // return, and clearing it before the thread has been put back would
    // lose it.
    LaunchedEffect(commentsReturn.landed, commentsReturn.parentCommentId) {
        if (commentsReturn.landed) {
            viewModel.onCommentLanded(commentsReturn.parentCommentId)
        }
    }
    // The terms stand OUTSIDE the sheet's own window, as a sibling: a
    // modal sheet raised from inside another one would leave the thread
    // beneath it inert. Only a COMMENT's terms reach this mount — the
    // post's own are raised by the surface below — so it is always the
    // stacked case (`CommentLicense.jsx`, design/readme.md:2364).
    var licenseShown by remember { mutableStateOf<LicenseChoice?>(null) }
    CommentsSheet(
        state = state,
        viewerId = viewerId,
        signedIn = signedIn,
        restoreTo = commentsReturn.scroll,
        onRestored = onReturnConsumed,
        onDismiss = onDismiss,
        onDepart = onDepart,
        onLoadMoreComments = viewModel::loadMore,
        onAddComment = { onReply(ReplyTargetRequest(postId, null)) },
        onReplyTo = { comment -> onReply(ReplyTargetRequest(postId, comment)) },
        onEditComment = { comment -> onEditComment(comment.id) },
        onCommentSignedShown = viewModel::onCommentSignedShown,
        onLoadMoreReplies = viewModel::onLoadMoreReplies,
        onReveal = viewModel::onReveal,
        onOpenActor = onOpenActor,
        onOpenTopic = onOpenTopic,
        onReference = onReference,
        onLicense = { licenseShown = it },
        onSignInOrJoin = onSignInOrJoin,
        stanceControl = stanceControl,
    )
    licenseShown?.let { license ->
        LicenseSheet(license = license, onDismiss = { licenseShown = null }, stacked = true)
    }
}

/**
 * What the sheet asks the surface below to open a composer on: the post
 * the thread belongs to, and the comment being answered — null for a
 * comment on the post itself.
 *
 * The sheet hands up the NODES rather than a built route because the
 * composer's target card is built from the thread's own words, and the
 * thread is what has them.
 */
data class ReplyTargetRequest(val postId: String, val comment: CommentView?)

/**
 * THE THREAD IS A SHEET OVER WHAT RAISED IT (`_shared.jsx:1247-1257`): the
 * title, the comments, and the entry row pinned at its foot. The surface below
 * keeps its place — the sheet is a drawer over the screen, so nothing behind it
 * scrolls when it opens or drops.
 *
 * The sheet's own height is drawn rather than content-sized
 * (`BottomSheet.jsx:29-32`: "a pinned input row at its foot needs the surface
 * itself to own the height"), so the foot does not walk up and down the screen
 * as a page of comments lands.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentsSheet(
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    onLoadMoreComments: () -> Unit,
    /** `ReplyEntry` 7 — the full-focus composer, this post pinned. */
    onAddComment: () -> Unit,
    /** `ReplyEntry` 5 — the composer, pre-targeted at that comment. */
    onReplyTo: (CommentView) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (CommentView) -> Unit,
    onCommentSignedShown: () -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    /** Raises the terms in the sheet the menu's License row opens. */
    onLicense: (LicenseChoice) -> Unit,
    onSignInOrJoin: () -> Unit,
    /** The reader's place, handed up as the sheet gives way to a composer. */
    onDepart: (CommentsScroll) -> Unit = {},
    /** …and handed back on the way in. */
    restoreTo: CommentsScroll? = null,
    onRestored: () -> Unit = {},
    /** The stance control the post and every comment carry (design.md §6). */
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit = { _, _ -> },
) {
    // The sheet's own host. A ModalBottomSheet is its own window, so a
    // host on the surface behind would render the confirmation for a
    // comment that landed in THIS thread behind the thread it landed in.
    val snackbar = remember { SnackbarHostState() }
    val signedCopy = stringResource(R.string.content_post_saved)
    LaunchedEffect(state.commentSigned) {
        if (state.commentSigned) {
            snackbar.showSnackbar(signedCopy)
            onCommentSignedShown()
        }
    }
    val listState = rememberLazyListState()
    // THE READER COMES BACK WHERE THEY LEFT (jakob 2026-09-15). The
    // restore waits for the refetched page: scrolling an empty list puts
    // the reader at the top and the arriving comments do not move them.
    // It consumes either way once the read is done, so a thread that
    // came back empty does not leave a place behind to jump to later.
    LaunchedEffect(restoreTo, state.loading, state.comments.isEmpty()) {
        val place = restoreTo ?: return@LaunchedEffect
        if (state.loading) return@LaunchedEffect
        if (state.comments.isNotEmpty()) listState.scrollToItem(place.index, place.offset)
        onRestored()
    }
    val depart: (() -> Unit) -> Unit = { go ->
        onDepart(
            CommentsScroll(
                listState.firstVisibleItemIndex,
                listState.firstVisibleItemScrollOffset,
            ),
        )
        go()
    }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        // THE SHEET CARRIES THE HEIGHT, ITS HANDLE INCLUDED. The board leaves
        // 72px of the screen behind showing (`_shared.jsx:1421` —
        // `height="calc(100% - 72px)"`), and capping the CONTENT at that left
        // Material's drag handle standing above the cap: the sheet then came
        // to within a handle's height of the top and the reveal was gone.
        modifier = Modifier.testTag("comments_sheet").height(commentsSheetHeight()),
    ) {
        Column(Modifier.fillMaxSize()) {
            SheetTitle(
                text = stringResource(R.string.content_comments_heading),
                modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x1),
            )
            CommentsList(
                state = state,
                listState = listState,
                viewerId = viewerId,
                signedIn = signedIn,
                modifier = Modifier.weight(1f),
                onLoadMoreComments = onLoadMoreComments,
                onReplyTo = { c -> depart { onReplyTo(c) } },
                onEditComment = { c -> depart { onEditComment(c) } },
                onLoadMoreReplies = onLoadMoreReplies,
                onReveal = onReveal,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onReference = onReference,
                onLicense = onLicense,
                stanceControl = stanceControl,
            )
            CommentsFoot(signedIn, { depart(onAddComment) }, onSignInOrJoin)
            CograSnackbarHost(snackbar)
        }
    }
}

/**
 * The thread's rows, and the three things it says when it has none:
 * reading, unreachable, or empty.
 *
 * The sheet says all three ITSELF, unlike the version that projected the
 * detail's state: it is raised over the feed too, where there is no
 * screen underneath holding a thread to degrade in its place.
 */
@Composable
private fun CommentsList(
    state: CommentsUiState,
    listState: LazyListState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreComments: () -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        state = listState,
        modifier = modifier.testTag("comments_list"),
        contentPadding = PaddingValues(horizontal = Space.x4, vertical = Space.x2),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        if (state.comments.isEmpty()) {
            item {
                when {
                    state.loading -> LoadingState(testTag = "comments_loading")
                    state.transportFault != null -> ErrorLine(
                        R.string.content_error_transport,
                        "comments_transport_error",
                    )
                    else -> Text(
                        stringResource(R.string.content_comments_empty),
                        modifier = Modifier.testTag("detail_no_comments"),
                    )
                }
            }
        }
        items(state.comments, key = { it.id }) { comment ->
            CommentThread(
                comment = comment,
                depth = 0,
                state = state,
                viewerId = viewerId,
                signedIn = signedIn,
                onLoadMoreReplies = onLoadMoreReplies,
                onReplyTo = onReplyTo,
                onEditComment = onEditComment,
                onReveal = onReveal,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onReference = onReference,
                onLicense = onLicense,
                stanceControl = stanceControl,
            )
        }
        if (state.hasMore) {
            item { MoreComments(state, onLoadMoreComments) }
        }
    }
}

/** The drawn gap above a full-height sheet (`_shared.jsx:1249`). */
private val SHEET_TOP_GAP = 72.dp

@Composable
private fun commentsSheetHeight(): Dp {
    val window = LocalWindowInfo.current.containerSize.height
    return with(LocalDensity.current) { window.toDp() } - SHEET_TOP_GAP
}

/**
 * A failed comments page surfaces where the failed fetch was asked for — the
 * load-more slot, inside the thread (android.md "Degrade, never crash").
 */
@Composable
private fun MoreComments(state: CommentsUiState, onLoadMoreComments: () -> Unit) {
    when {
        state.loadingMore -> CircularProgressIndicator(modifier = Modifier.padding(8.dp))
        state.transportFault == TransportFault.APPEND -> Column {
            ErrorLine(R.string.content_thread_stale, "detail_more_comments_error")
            TextButton(
                onClick = onLoadMoreComments,
                modifier = Modifier.testTag("detail_more_comments_retry"),
            ) {
                Text(stringResource(R.string.content_retry))
            }
        }
        else -> TextButton(
            onClick = onLoadMoreComments,
            modifier = Modifier.testTag("detail_more_comments"),
        ) {
            Text(stringResource(R.string.content_feed_load_more))
        }
    }
}

/**
 * `ReplyEntry` 7: the sheet's foot is the way *into* the composer, not the
 * composer itself. The full-focus wizard is where a comment is written, so
 * this row only opens it.
 *
 * The write affordance swaps, never merely disables: a member gets the
 * composer's door, an anonymous reader gets the join entry (android.md
 * "Screens"); while the phase resolves, neither.
 */
@Composable
private fun CommentsFoot(
    signedIn: Boolean?,
    onAddComment: () -> Unit,
    onSignInOrJoin: () -> Unit,
) {
    if (signedIn == null) return
    HorizontalDivider()
    if (signedIn) {
        // It looks like the field the board draws and behaves like the button
        // it is: a real text field would take focus and raise a keyboard for
        // words that are typed on the next screen.
        Surface(
            onClick = onAddComment,
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surfaceContainerHighest,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Space.x4, vertical = Space.x3)
                .testTag("detail_add_comment"),
        ) {
            Text(
                text = stringResource(R.string.content_comment_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            )
        }
    } else {
        TextButton(
            onClick = onSignInOrJoin,
            modifier = Modifier
                .padding(horizontal = Space.x2)
                .testTag("detail_comment_signin"),
        ) {
            Text(stringResource(R.string.content_comment_signin))
        }
    }
}

/**
 * THE COMMENT'S ROWS (`_shared.jsx:392`) — Save · Cite in a new post ·
 * Opinions on this · License terms.
 *
 * NO HIDE ROW, AND THE ABSENCE IS RULED (jakob 2026-09-12): hiding is an
 * act on an ACTOR, and the route to it is the commenter's own profile,
 * one tap away through their chip. A thread of many voices is not where
 * that decision belongs.
 *
 * `Opinions on this` STANDS WHATEVER THE COUNT IS, which is the
 * difference between a menu row and a count line: a row that came and
 * went with a number would make the menu a different menu every time.
 */
@Composable
private fun commentMenuRows(
    comment: CommentView,
    onCite: () -> Unit,
    onLicense: () -> Unit,
): List<MenuRow> = buildList {
    add(MenuRow(stringResource(R.string.content_menu_save), "comment_menu_save_${comment.id}") {})
    add(
        MenuRow(
            stringResource(R.string.content_menu_cite),
            "comment_menu_cite_${comment.id}",
            onCite,
        ),
    )
    add(
        MenuRow(
            stringResource(R.string.content_menu_opinions),
            "comment_menu_opinions_${comment.id}",
        ) {},
    )
    add(
        MenuRow(
            stringResource(R.string.content_menu_license),
            "comment_menu_license_${comment.id}",
            onLicense,
        ),
    )
}

/**
 * The thread is **two levels deep on screen**: a comment, and its
 * replies indented once (design/readme.md §13, 2026-08-28, and the
 * canonical `CommentCard`, which sets exactly this).
 *
 * Anything deeper flattens into that one reply level and opens with the
 * @handle it answers — the mention is the structure, so the column never
 * narrows to a word. design.md §6 still says three levels; it predates
 * the ruling (design/backlog.md item 26 tracks that lag).
 */
private const val MAX_INDENT_DEPTH = 1

/**
 * One comment with its replies (design.md §6 "Comment"): author chip,
 * body, the soft "Edited" marker (design.md §9), the creator's edit
 * affordance, the reply affordance, and the branch behind its count.
 */
@Composable
private fun CommentThread(
    comment: CommentView,
    depth: Int,
    modifier: Modifier = Modifier,
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    /** Raises the terms in the sheet the menu's License row opens. */
    onLicense: (LicenseChoice) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
    val indent = (minOf(depth, MAX_INDENT_DEPTH) * 12).dp
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = indent),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("detail_comment_${comment.id}"),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                // The picture the boards draw on a comment card (Q49),
                // and the age beside it. Null is the monogram — the
                // designed fallback for an author who has set none, not
                // a gap waiting for a photo.
                ContentCardHeader(
                    author = comment.author,
                    at = comment.createdAt,
                    onOpenActor = onOpenActor,
                    testTagPrefix = "comment_${comment.id}",
                    menu = commentMenuRows(
                        comment = comment,
                        onCite = { onReference(comment.id) },
                        onLicense = { onLicense(comment.license) },
                    ),
                    menuContentDescription = stringResource(R.string.content_menu_comment),
                    // IT IS DRAWN STACKED ON PURPOSE (`CommentMenu.jsx:18-23`):
                    // the thread already lives in a sheet, so this menu is a
                    // sheet on a sheet (design/readme.md:2364).
                    stacked = true,
                )
                // A comment is text **plus** optional media (D16),
                // so its body is never the exclusive-or a post's
                // is — but it veils and redacts as one region all
                // the same.
                PostBody(
                    content = comment.content,
                    description = null,
                    attachments = comment.attachments,
                    attachmentsStatus = comment.attachmentsStatus,
                    moderation = comment.moderation,
                    testTagPrefix = "comment_${comment.id}",
                    surface = BodySurface.Comment,
                    revealed = state.reveals.isRevealed(comment.id, comment.sensitiveMark()),
                    onReveal = { onReveal(comment.id, comment.sensitiveMark()) },
                    // The statuses are the veil — the OR of the author's
                    // own mark and a moderator's verdict — so the
                    // author's half is what names the source.
                    sensitiveSource = if (comment.sensitiveSelfMark) {
                        SensitiveSource.Author
                    } else {
                        SensitiveSource.Platform
                    },
                    sensitiveReason = comment.sensitiveReason,
                )
                // The soft marker, friendly not forensic (design.md §9).
                if (comment.updatedAt.isAfter(comment.createdAt)) {
                    Text(
                        text = stringResource(R.string.content_comment_edited),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.testTag("comment_edited_${comment.id}"),
                    )
                }
                if (comment.landing.isPending) {
                    PendingMarker(testTag = "comment_pending_${comment.id}")
                }
                // The same one line a post wears (`CommentCard.jsx`).
                TopicsLine(
                    topics = comment.topics,
                    references = comment.references,
                    onOpenTopic = onOpenTopic,
                    testTagPrefix = "comment_${comment.id}",
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // A comment carries the control too (design.md §6).
                    stanceControl(comment.id, "comment_${comment.id}")
                    if (signedIn == true) {
                        // `ReplyEntry` 5 — the composer, pre-targeted.
                        TextButton(
                            onClick = { onReplyTo(comment) },
                            modifier = Modifier.testTag("comment_reply_${comment.id}"),
                        ) {
                            Text(stringResource(R.string.content_comment_reply))
                        }
                    }
                    // `ReplyMedia` 6 — an own comment wears Edit, and it
                    // opens `CommentEdit`.
                    if (viewerId != null && comment.author?.id == viewerId) {
                        TextButton(
                            onClick = { onEditComment(comment) },
                            modifier = Modifier.testTag("comment_edit_${comment.id}"),
                        ) {
                            Text(stringResource(R.string.content_edit))
                        }
                    }
                }
            }
        }
        // Replies are counted, not carried (Q49): nothing is on screen
        // until a reader opens the branch, and `replyCount` is what the
        // collapsed line reads.
        val thread = state.replyThreads[comment.id]
        val replies = thread?.items.orEmpty()
        val hasMore = thread?.hasMore ?: false
        replies.forEach { reply ->
            CommentThread(
                comment = reply,
                depth = depth + 1,
                state = state,
                viewerId = viewerId,
                signedIn = signedIn,
                onLoadMoreReplies = onLoadMoreReplies,
                onReplyTo = onReplyTo,
                onEditComment = onEditComment,
                onReveal = onReveal,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onReference = onReference,
                onLicense = onLicense,
                stanceControl = stanceControl,
            )
        }
        when {
            thread?.loading == true -> CircularProgressIndicator(
                modifier = Modifier.padding(start = 12.dp).testTag("replies_loading_${comment.id}"),
            )
            thread?.failed == true -> TextButton(
                onClick = { onLoadMoreReplies(comment) },
                modifier = Modifier.testTag("replies_retry_${comment.id}"),
            ) {
                Text(stringResource(R.string.content_retry))
            }
            // The collapsed branch, as `CommentCard` draws it: the count
            // stands in for the replies until a reader asks for them.
            replies.isEmpty() && comment.replyCount > 0 -> TextButton(
                onClick = { onLoadMoreReplies(comment) },
                modifier = Modifier.testTag("replies_more_${comment.id}"),
            ) {
                Text(
                    pluralStringResource(
                        R.plurals.content_comment_view_replies,
                        comment.replyCount,
                        comment.replyCount,
                    ),
                )
            }
            hasMore -> TextButton(
                onClick = { onLoadMoreReplies(comment) },
                modifier = Modifier.testTag("replies_more_${comment.id}"),
            ) {
                Text(stringResource(R.string.content_comment_more_replies))
            }
        }
    }
}
