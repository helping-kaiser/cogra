package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.CommentView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.PostView
import com.cogra.feature.content.R
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.content.reply.ReplyTargetKind
import com.cogra.feature.stance.StanceControlRoute

@Composable
fun PostDetailRoute(
    postId: String,
    /** The viewer's account id; gates the edit affordance to the creator. */
    viewerId: String?,
    /** Null while the auth phase resolves; the comment/join affordances wait. */
    signedIn: Boolean?,
    onEdit: (String) -> Unit,
    /**
     * The reply wizard, pinned to what it answers — the post for
     * `ReplyEntry` 7, the comment for `ReplyEntry` 5. The target is
     * built here rather than by the caller because this is where the
     * thread's own words are.
     */
    onReply: (ReplyTarget) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (commentId: String, parentTitle: String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** A referenced post opens on its own detail. */
    onOpenPost: (String) -> Unit,
    /** The Reference affordance (D20): compose a post citing this node. */
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onBack: () -> Unit,
    refreshSignal: Boolean = false,
    onRefreshSignalConsumed: () -> Unit = {},
    /**
     * A comment or an edit signed on the wizard, coming back. The thread
     * refetches so the new state arrives from the server — a client
     * never takes a write on by patching its own list — and the
     * snackbar fires once.
     */
    commentSignedSignal: Boolean = false,
    onCommentSignedSignalConsumed: () -> Unit = {},
    viewModel: PostDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    if (refreshSignal) {
        onRefreshSignalConsumed()
        viewModel.refresh()
    }
    if (commentSignedSignal) {
        onCommentSignedSignalConsumed()
        viewModel.onCommentSigned()
    }
    PostDetailScreen(
        state = state,
        viewerId = viewerId,
        signedIn = signedIn,
        onRefresh = viewModel::refresh,
        onLoadMoreComments = viewModel::loadMoreComments,
        onAddComment = { state.post?.let { onReply(it.asReplyTarget()) } },
        onReplyTo = { comment -> onReply(comment.asReplyTarget()) },
        onEditComment = { comment ->
            onEditComment(comment.id, state.post?.title?.value.orEmpty())
        },
        onCommentSignedShown = viewModel::onCommentSignedShown,
        onLoadMoreReplies = viewModel::onLoadMoreReplies,
        onToggleTagValues = viewModel::onToggleTagValues,
        onToggleReferenceValues = viewModel::onToggleReferenceValues,
        onReveal = viewModel::onReveal,
        onEdit = onEdit,
        onOpenActor = onOpenActor,
        onOpenTopic = onOpenTopic,
        onOpenPost = onOpenPost,
        onReference = onReference,
        onSignInOrJoin = onSignInOrJoin,
        onBack = onBack,
        stanceControl = { target, tag -> StanceControlRoute(target = target, testTagPrefix = tag) },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailScreen(
    state: PostDetailUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onRefresh: () -> Unit,
    onLoadMoreComments: () -> Unit,
    /** `ReplyEntry` 7 — the full-focus composer, this post pinned. */
    onAddComment: () -> Unit,
    /** `ReplyEntry` 5 — the composer, pre-targeted at that comment. */
    onReplyTo: (CommentView) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (CommentView) -> Unit,
    onCommentSignedShown: () -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    /** One chip row asking to show its claim parameters, by owner id (F8). */
    onToggleTagValues: (String) -> Unit,
    /** A reference row asking to show its parameters, by owner id (D16). */
    onToggleReferenceValues: (String) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onEdit: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onBack: () -> Unit,
    /** The stance control the post and every comment carry (design.md §6). */
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit = { _, _ -> },
) {
    val snackbar = remember { SnackbarHostState() }
    val signedCopy = stringResource(R.string.content_post_saved)
    LaunchedEffect(state.commentSigned) {
        if (state.commentSigned) {
            snackbar.showSnackbar(signedCopy)
            onCommentSignedShown()
        }
    }
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                colors = surfaceTopAppBarColors(),
                scrollBehavior = collapsingTop.scrollBehavior,
                title = { Text(state.post?.title?.value.orEmpty()) },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("detail_back")) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.content_back),
                        )
                    }
                },
                actions = {
                    val post = state.post
                    if (post != null && viewerId != null && post.author?.id == viewerId) {
                        TextButton(
                            onClick = { onEdit(post.id) },
                            modifier = Modifier.testTag("detail_edit"),
                        ) {
                            Text(stringResource(R.string.content_edit))
                        }
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.loading,
            onRefresh = onRefresh,
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            // The collapsing top wires up inside the pull-to-refresh
            // box, not on the Scaffold: post-scroll flows innermost
            // first, and the refresh gesture consumes the unconsumed
            // at-the-top leftover — the gate's signal that the reader is
            // back at the top — before an outer gate would ever see it.
            // Outside, the bar stays hidden at the top of the thread
            // while a pull is already gathering, which reads as a
            // refresh fired mid-scroll (the feed's twin wiring).
            Box(
                Modifier
                    .fillMaxSize()
                    .collapsingTop(collapsingTop),
            ) {
                when {
                    state.notFound -> ErrorLine(
                        R.string.content_error_not_found,
                        "detail_not_found",
                        modifier = Modifier.padding(24.dp),
                    )
                    state.transportFault != null && state.post == null -> Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        ErrorLine(R.string.content_error_transport, "detail_transport_error")
                        TextButton(
                            onClick = onRefresh,
                            modifier = Modifier.testTag("detail_retry"),
                        ) {
                            Text(stringResource(R.string.content_retry))
                        }
                    }
                    state.post != null -> Column(modifier = Modifier.fillMaxSize()) {
                        // A transport fault never blanks content already
                        // on screen, and it surfaces where the failed
                        // fetch was requested: a failed refresh on this
                        // banner, a failed comments page at the load-more
                        // slot in the thread (android.md "Degrade, never
                        // crash").
                        if (state.transportFault == TransportFault.REFRESH) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 24.dp, vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                ErrorLine(
                                    R.string.content_error_transport,
                                    "detail_transport_banner",
                                )
                                TextButton(
                                    onClick = onRefresh,
                                    modifier = Modifier.testTag("detail_retry"),
                                ) {
                                    Text(stringResource(R.string.content_retry))
                                }
                            }
                        }
                        PostWithThread(
                            state = state,
                            post = state.post,
                            viewerId = viewerId,
                            signedIn = signedIn,
                            onLoadMoreComments = onLoadMoreComments,
                            onAddComment = onAddComment,
                            onReplyTo = onReplyTo,
                            onEditComment = onEditComment,
                            onLoadMoreReplies = onLoadMoreReplies,
                            onToggleTagValues = onToggleTagValues,
                            onToggleReferenceValues = onToggleReferenceValues,
                            onReveal = onReveal,
                            onOpenActor = onOpenActor,
                            onOpenTopic = onOpenTopic,
                            onOpenPost = onOpenPost,
                            onReference = onReference,
                            onSignInOrJoin = onSignInOrJoin,
                            stanceControl = stanceControl,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PostWithThread(
    state: PostDetailUiState,
    post: PostView,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreComments: () -> Unit,
    onAddComment: () -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    onToggleTagValues: (String) -> Unit,
    onToggleReferenceValues: (String) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .testTag("detail_list"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Media, words and description are one region because
                // the veil covers them as one state (D12); the title
                // stays outside it, on the bar above.
                PostBody(
                    content = post.content,
                    description = post.description,
                    attachments = post.attachments,
                    attachmentsStatus = post.attachmentsStatus,
                    testTagPrefix = "detail",
                    modifier = Modifier.testTag("detail_body"),
                    // The same set the feed reads: a reader who already
                    // chose to look at this post is not asked again on
                    // the way in.
                    revealed = state.reveals.isRevealed(post.id, post.sensitiveMark()),
                    onReveal = { onReveal(post.id, post.sensitiveMark()) },
                )
                post.author?.let { author ->
                    ActorChip(
                        handle = author.handle,
                        displayName = author.displayName,
                        onOpen = { onOpenActor(author.handle) },
                        avatarUrl = author.avatar?.url,
                        testTag = "detail_author",
                    )
                }
                Text(
                    licenseTerms(post.license),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.testTag("detail_license_terms"),
                )
                if (post.landing.isPending) {
                    PendingMarker(testTag = "detail_pending")
                }
                // The reveal is a detail-view gesture (F8): here the
                // reader has already chosen this piece of content.
                TopicChipRow(
                    topics = post.topics,
                    onOpenTopic = onOpenTopic,
                    testTagPrefix = "detail_post",
                    valuesRevealed = post.id in state.revealedTagRows,
                    onToggleValues = { onToggleTagValues(post.id) },
                )
                ReferenceChipRow(
                    references = post.references,
                    onOpenActor = onOpenActor,
                    onOpenPost = onOpenPost,
                    testTagPrefix = "detail_post",
                    valuesRevealed = post.id in state.revealedReferenceRows,
                    onToggleValues = { onToggleReferenceValues(post.id) },
                )
                // The stance control rides the post itself here, the way
                // it rides the card in the feed (design.md §6), and the
                // Reference affordance sits beside it exactly as it does
                // on a comment: every content node can be referenced, so
                // the affordance lives on the node and opens the
                // composer with the chip already staged (D20).
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    stanceControl(post.id, "detail_post")
                    TextButton(
                        onClick = { onReference(post.id) },
                        modifier = Modifier.testTag("detail_post_reference_action"),
                    ) {
                        Text(stringResource(R.string.content_reference_action))
                    }
                }
                HorizontalDivider()
                Text(
                    stringResource(R.string.content_comments_heading),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
        if (state.comments.isEmpty()) {
            item {
                Text(
                    stringResource(R.string.content_comments_empty),
                    modifier = Modifier.testTag("detail_no_comments"),
                )
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
                onToggleTagValues = onToggleTagValues,
                onToggleReferenceValues = onToggleReferenceValues,
                onReveal = onReveal,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onOpenPost = onOpenPost,
                onReference = onReference,
                stanceControl = stanceControl,
            )
        }
        if (state.commentsHaveMore) {
            item {
                when {
                    state.loadingMore -> CircularProgressIndicator(
                        modifier = Modifier.padding(8.dp),
                    )
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
        }
        // The write affordance swaps, never merely disables: a member
        // gets the composer, an anonymous reader gets the join entry
        // (android.md "Screens"); while the phase resolves, neither.
        if (signedIn == false) {
            item {
                TextButton(
                    onClick = onSignInOrJoin,
                    modifier = Modifier.testTag("detail_comment_signin"),
                ) {
                    Text(stringResource(R.string.content_comment_signin))
                }
            }
        }
        // `ReplyEntry` 7: the thread's foot is the way *into* the
        // composer, not the composer itself. The full-focus wizard is
        // where a comment is written, so this row only opens it.
        if (signedIn == true) item {
            // It looks like the field the board draws and behaves like
            // the button it is: a real text field would take focus and
            // raise a keyboard for words that are typed on the next
            // screen.
            Surface(
                onClick = onAddComment,
                shape = MaterialTheme.shapes.extraLarge,
                color = MaterialTheme.colorScheme.surfaceContainerHighest,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("detail_add_comment"),
            ) {
                Text(
                    text = stringResource(R.string.content_comment_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                )
            }
        }
    }
}

/**
 * The post, as the composer's target card reads it (`ReplyEntry` 7).
 *
 * A post leads with its title; the line under it is the body, clipped,
 * because the card gives it one line either way.
 */
private fun PostView.asReplyTarget(): ReplyTarget = ReplyTarget(
    id = id,
    kind = ReplyTargetKind.Post,
    title = title?.value.orEmpty(),
    snippet = content?.value.orEmpty().clipForCard(),
    authorHandle = author?.handle.orEmpty(),
    avatarUrl = author?.avatar?.url,
)

/**
 * The comment, as the composer's target card reads it (`ReplyEntry` 5).
 *
 * A comment has no title, so its own opening words become one — the
 * card's two lines are then the answer's subject and its context, the
 * way a post's title and body are.
 */
private fun CommentView.asReplyTarget(): ReplyTarget = ReplyTarget(
    id = id,
    kind = ReplyTargetKind.Comment,
    title = content.value.orEmpty().clipForCard(TARGET_TITLE_CHARS),
    snippet = content.value.orEmpty().clipForCard(),
    authorHandle = author?.handle.orEmpty(),
    avatarUrl = author?.avatar?.url,
)

/**
 * The card draws one line, and a route carries what it is given — so
 * the words are clipped where they are read rather than where they are
 * drawn.
 */
private fun String.clipForCard(limit: Int = TARGET_SNIPPET_CHARS): String =
    if (length <= limit) this else take(limit).trimEnd() + "…"

private const val TARGET_TITLE_CHARS = 48
private const val TARGET_SNIPPET_CHARS = 120

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
    state: PostDetailUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onToggleTagValues: (String) -> Unit,
    onToggleReferenceValues: (String) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onReference: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
    val indent = (minOf(depth, MAX_INDENT_DEPTH) * 12).dp
    Column(
        modifier = Modifier
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
                comment.author?.let { author ->
                    // The picture the boards draw on a comment card
                    // (Q49). Null is the monogram — the designed
                    // fallback for an author who has set none, not a gap
                    // waiting for a photo.
                    ActorChip(
                        handle = author.handle,
                        displayName = author.displayName,
                        onOpen = { onOpenActor(author.handle) },
                        avatarUrl = author.avatar?.url,
                        testTag = "comment_author_${comment.id}",
                    )
                }
                // A comment is text **plus** optional media (D16),
                // so its body is never the exclusive-or a post's
                // is — but it veils and redacts as one region all
                // the same.
                PostBody(
                    content = comment.content,
                    description = null,
                    attachments = comment.attachments,
                    attachmentsStatus = comment.attachmentsStatus,
                    testTagPrefix = "comment_${comment.id}",
                    surface = BodySurface.Comment,
                    revealed = state.reveals.isRevealed(comment.id, comment.sensitiveMark()),
                    onReveal = { onReveal(comment.id, comment.sensitiveMark()) },
                )
                Text(
                    licenseTerms(comment.license),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.testTag("comment_license_terms_${comment.id}"),
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
                TopicChipRow(
                    topics = comment.topics,
                    onOpenTopic = onOpenTopic,
                    testTagPrefix = "comment_${comment.id}",
                    valuesRevealed = comment.id in state.revealedTagRows,
                    onToggleValues = { onToggleTagValues(comment.id) },
                )
                ReferenceChipRow(
                    references = comment.references,
                    onOpenActor = onOpenActor,
                    onOpenPost = onOpenPost,
                    testTagPrefix = "comment_${comment.id}",
                    valuesRevealed = comment.id in state.revealedReferenceRows,
                    onToggleValues = { onToggleReferenceValues(comment.id) },
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
                        // A comment is a content node like any
                        // other, so it carries the affordance too
                        // (D20).
                        TextButton(
                            onClick = { onReference(comment.id) },
                            modifier = Modifier
                                .testTag("comment_reference_${comment.id}"),
                        ) {
                            Text(stringResource(R.string.content_reference_action))
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
                onToggleTagValues = onToggleTagValues,
                onToggleReferenceValues = onToggleReferenceValues,
                onReveal = onReveal,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onOpenPost = onOpenPost,
                onReference = onReference,
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
