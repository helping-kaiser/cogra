package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.CommentView
import com.cogra.domain.OversightChoice
import com.cogra.domain.PostView
import com.cogra.feature.content.R

@Composable
fun PostDetailRoute(
    postId: String,
    /** The viewer's account id; gates the edit affordance to the creator. */
    viewerId: String?,
    /** Null while the auth phase resolves; the comment/join affordances wait. */
    signedIn: Boolean?,
    onEdit: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onBack: () -> Unit,
    refreshSignal: Boolean = false,
    onRefreshSignalConsumed: () -> Unit = {},
    viewModel: PostDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    if (refreshSignal) {
        onRefreshSignalConsumed()
        viewModel.refresh()
    }
    PostDetailScreen(
        state = state,
        viewerId = viewerId,
        signedIn = signedIn,
        onRefresh = viewModel::refresh,
        onLoadMoreComments = viewModel::loadMoreComments,
        onDraftChange = viewModel::onDraftChange,
        onAttributionChange = viewModel::onAttributionChange,
        onOversightChange = viewModel::onOversightChange,
        onSubmitComment = viewModel::onSubmitComment,
        onCommentSignedShown = viewModel::onCommentSignedShown,
        onLoadMoreReplies = viewModel::onLoadMoreReplies,
        onStartEditComment = viewModel::onStartEditComment,
        onEditDraftChange = viewModel::onEditDraftChange,
        onCancelEditComment = viewModel::onCancelEditComment,
        onSubmitCommentEdit = viewModel::onSubmitCommentEdit,
        onStartReply = viewModel::onStartReply,
        onReplyDraftChange = viewModel::onReplyDraftChange,
        onCancelReply = viewModel::onCancelReply,
        onSubmitReply = viewModel::onSubmitReply,
        onEdit = onEdit,
        onOpenActor = onOpenActor,
        onSignInOrJoin = onSignInOrJoin,
        onBack = onBack,
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
    onDraftChange: (String) -> Unit,
    onAttributionChange: (Boolean) -> Unit,
    onOversightChange: (OversightChoice) -> Unit,
    onSubmitComment: () -> Unit,
    onCommentSignedShown: () -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    onStartEditComment: (CommentView) -> Unit,
    onEditDraftChange: (String) -> Unit,
    onCancelEditComment: () -> Unit,
    onSubmitCommentEdit: () -> Unit,
    onStartReply: (String) -> Unit,
    onReplyDraftChange: (String) -> Unit,
    onCancelReply: () -> Unit,
    onSubmitReply: () -> Unit,
    onEdit: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onBack: () -> Unit,
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
        modifier = Modifier.collapsingTop(collapsingTop),
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
                    TextButton(onClick = onRefresh, modifier = Modifier.testTag("detail_retry")) {
                        Text(stringResource(R.string.content_retry))
                    }
                }
                state.post != null -> Column(modifier = Modifier.fillMaxSize()) {
                    // A transport fault never blanks content already on
                    // screen, and it surfaces where the failed fetch was
                    // requested: a failed refresh on this banner, a
                    // failed comments page at the load-more slot in the
                    // thread (android.md "Degrade, never crash").
                    if (state.transportFault == TransportFault.REFRESH) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 24.dp, vertical = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            ErrorLine(R.string.content_error_transport, "detail_transport_banner")
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
                        onDraftChange = onDraftChange,
                        onAttributionChange = onAttributionChange,
                        onOversightChange = onOversightChange,
                        onSubmitComment = onSubmitComment,
                        onLoadMoreReplies = onLoadMoreReplies,
                        onStartEditComment = onStartEditComment,
                        onEditDraftChange = onEditDraftChange,
                        onCancelEditComment = onCancelEditComment,
                        onSubmitCommentEdit = onSubmitCommentEdit,
                        onStartReply = onStartReply,
                        onReplyDraftChange = onReplyDraftChange,
                        onCancelReply = onCancelReply,
                        onSubmitReply = onSubmitReply,
                        onOpenActor = onOpenActor,
                        onSignInOrJoin = onSignInOrJoin,
                    )
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
    onDraftChange: (String) -> Unit,
    onAttributionChange: (Boolean) -> Unit,
    onOversightChange: (OversightChoice) -> Unit,
    onSubmitComment: () -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    onStartEditComment: (CommentView) -> Unit,
    onEditDraftChange: (String) -> Unit,
    onCancelEditComment: () -> Unit,
    onSubmitCommentEdit: () -> Unit,
    onStartReply: (String) -> Unit,
    onReplyDraftChange: (String) -> Unit,
    onCancelReply: () -> Unit,
    onSubmitReply: () -> Unit,
    onOpenActor: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
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
                post.description.value?.takeIf { it.isNotEmpty() }?.let {
                    Text(it, style = MaterialTheme.typography.titleSmall)
                }
                Text(
                    post.content.value.orEmpty(),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.testTag("detail_body"),
                )
                post.author?.let { author ->
                    ActorChip(
                        handle = author.handle,
                        displayName = author.displayName,
                        onOpen = { onOpenActor(author.handle) },
                        testTag = "detail_author",
                    )
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
                onStartEditComment = onStartEditComment,
                onEditDraftChange = onEditDraftChange,
                onCancelEditComment = onCancelEditComment,
                onSubmitCommentEdit = onSubmitCommentEdit,
                onStartReply = onStartReply,
                onReplyDraftChange = onReplyDraftChange,
                onCancelReply = onCancelReply,
                onSubmitReply = onSubmitReply,
                onOpenActor = onOpenActor,
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
        if (signedIn == true) item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = state.draft,
                    onValueChange = onDraftChange,
                    label = { Text(stringResource(R.string.content_comment_hint)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("detail_comment_input"),
                )
                LicenseControls(
                    attributionRequired = state.attributionRequired,
                    oversight = state.oversight,
                    onAttributionChange = onAttributionChange,
                    onOversightChange = onOversightChange,
                )
                if (state.refused) {
                    ErrorLine(R.string.content_error_refused, "detail_refused")
                }
                if (state.signingFailed) {
                    ErrorLine(
                        if (state.signingNeedsKey) {
                            R.string.content_error_signing_no_key
                        } else {
                            R.string.content_error_signing
                        },
                        "detail_signing_failed",
                    )
                }
                if (state.submitTransportFailed) {
                    ErrorLine(R.string.content_error_transport, "detail_comment_transport")
                }
                Button(
                    onClick = onSubmitComment,
                    enabled = !state.submitting && state.draft.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("detail_comment_submit"),
                ) {
                    Text(stringResource(R.string.content_comment_submit))
                }
            }
        }
    }
}

/** Nesting indents up to three levels, then flattens (design.md §6). */
private const val MAX_INDENT_DEPTH = 3

/**
 * One comment with its nested replies (design.md §6 "Comment"):
 * author chip, body, the soft "Edited" marker (design.md §9), the
 * creator's edit affordance, the reply affordance, and the expandable
 * reply thread — one prefetched level, more on demand.
 */
@Composable
private fun CommentThread(
    comment: CommentView,
    depth: Int,
    state: PostDetailUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreReplies: (CommentView) -> Unit,
    onStartEditComment: (CommentView) -> Unit,
    onEditDraftChange: (String) -> Unit,
    onCancelEditComment: () -> Unit,
    onSubmitCommentEdit: () -> Unit,
    onStartReply: (String) -> Unit,
    onReplyDraftChange: (String) -> Unit,
    onCancelReply: () -> Unit,
    onSubmitReply: () -> Unit,
    onOpenActor: (String) -> Unit,
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
                    ActorChip(
                        handle = author.handle,
                        displayName = author.displayName,
                        onOpen = { onOpenActor(author.handle) },
                        testTag = "comment_author_${comment.id}",
                    )
                }
                if (state.editingCommentId == comment.id) {
                    OutlinedTextField(
                        value = state.editDraft,
                        onValueChange = onEditDraftChange,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("comment_edit_input"),
                    )
                    if (state.editRefused) {
                        ErrorLine(R.string.content_error_refused, "comment_edit_refused")
                    }
                    if (state.editSigningFailed) {
                        ErrorLine(
                            if (state.signingNeedsKey) {
                                R.string.content_error_signing_no_key
                            } else {
                                R.string.content_error_signing
                            },
                            "comment_edit_signing_failed",
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = onSubmitCommentEdit,
                            enabled = !state.editSubmitting && state.editDraft.isNotBlank(),
                            modifier = Modifier.testTag("comment_edit_save"),
                        ) {
                            Text(stringResource(R.string.content_comment_edit_save))
                        }
                        TextButton(
                            onClick = onCancelEditComment,
                            modifier = Modifier.testTag("comment_edit_cancel"),
                        ) {
                            Text(stringResource(R.string.content_comment_edit_cancel))
                        }
                    }
                } else {
                    Text(comment.content.value.orEmpty(), style = MaterialTheme.typography.bodyMedium)
                    // The soft marker, friendly not forensic (design.md §9).
                    if (comment.updatedAt.isAfter(comment.createdAt)) {
                        Text(
                            text = stringResource(R.string.content_comment_edited),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.testTag("comment_edited_${comment.id}"),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (signedIn == true) {
                            TextButton(
                                onClick = { onStartReply(comment.id) },
                                modifier = Modifier.testTag("comment_reply_${comment.id}"),
                            ) {
                                Text(stringResource(R.string.content_comment_reply))
                            }
                        }
                        if (viewerId != null && comment.author?.id == viewerId) {
                            TextButton(
                                onClick = { onStartEditComment(comment) },
                                modifier = Modifier.testTag("comment_edit_${comment.id}"),
                            ) {
                                Text(stringResource(R.string.content_edit))
                            }
                        }
                    }
                }
            }
        }
        if (state.replyingToId == comment.id) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = state.replyDraft,
                    onValueChange = onReplyDraftChange,
                    label = { Text(stringResource(R.string.content_comment_hint)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("comment_reply_input"),
                )
                if (state.replyRefused) {
                    ErrorLine(R.string.content_error_refused, "comment_reply_refused")
                }
                if (state.replySigningFailed) {
                    ErrorLine(
                        if (state.signingNeedsKey) {
                            R.string.content_error_signing_no_key
                        } else {
                            R.string.content_error_signing
                        },
                        "comment_reply_signing_failed",
                    )
                }
                if (state.replyTransportFailed) {
                    ErrorLine(R.string.content_error_transport, "comment_reply_transport")
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onSubmitReply,
                        enabled = !state.replySubmitting && state.replyDraft.isNotBlank(),
                        modifier = Modifier.testTag("comment_reply_submit"),
                    ) {
                        Text(stringResource(R.string.content_comment_submit))
                    }
                    TextButton(
                        onClick = onCancelReply,
                        modifier = Modifier.testTag("comment_reply_cancel"),
                    ) {
                        Text(stringResource(R.string.content_comment_edit_cancel))
                    }
                }
            }
        }
        val thread = state.replyThreads[comment.id]
        val replies = thread?.items ?: comment.replies?.items.orEmpty()
        val hasMore = thread?.hasMore ?: (comment.replies?.hasNextPage ?: false)
        replies.forEach { reply ->
            CommentThread(
                comment = reply,
                depth = depth + 1,
                state = state,
                viewerId = viewerId,
                signedIn = signedIn,
                onLoadMoreReplies = onLoadMoreReplies,
                onStartEditComment = onStartEditComment,
                onEditDraftChange = onEditDraftChange,
                onCancelEditComment = onCancelEditComment,
                onSubmitCommentEdit = onSubmitCommentEdit,
                onStartReply = onStartReply,
                onReplyDraftChange = onReplyDraftChange,
                onCancelReply = onCancelReply,
                onSubmitReply = onSubmitReply,
                onOpenActor = onOpenActor,
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
            hasMore -> TextButton(
                onClick = { onLoadMoreReplies(comment) },
                modifier = Modifier.testTag("replies_more_${comment.id}"),
            ) {
                Text(stringResource(R.string.content_comment_more_replies))
            }
        }
    }
}
