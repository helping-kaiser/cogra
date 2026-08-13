package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import com.cogra.core.designsystem.ErrorLine
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
        onEdit = onEdit,
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
    onEdit: (String) -> Unit,
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
    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
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
                state.transportFailed && state.post == null -> Column(
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
                state.post != null -> PostWithThread(
                    state = state,
                    post = state.post,
                    signedIn = signedIn,
                    onLoadMoreComments = onLoadMoreComments,
                    onDraftChange = onDraftChange,
                    onAttributionChange = onAttributionChange,
                    onOversightChange = onOversightChange,
                    onSubmitComment = onSubmitComment,
                    onSignInOrJoin = onSignInOrJoin,
                )
            }
        }
    }
}

@Composable
private fun PostWithThread(
    state: PostDetailUiState,
    post: PostView,
    signedIn: Boolean?,
    onLoadMoreComments: () -> Unit,
    onDraftChange: (String) -> Unit,
    onAttributionChange: (Boolean) -> Unit,
    onOversightChange: (OversightChoice) -> Unit,
    onSubmitComment: () -> Unit,
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
                post.author?.let {
                    Text(
                        "@${it.handle}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
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
            CommentCard(comment)
        }
        if (state.commentsHaveMore) {
            item {
                if (state.loadingMore) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    TextButton(
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
                    ErrorLine(R.string.content_error_signing, "detail_signing_failed")
                }
                if (state.transportFailed) {
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

@Composable
private fun CommentCard(comment: CommentView) {
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
            Text(comment.content.value.orEmpty(), style = MaterialTheme.typography.bodyMedium)
            comment.author?.let {
                Text(
                    "@${it.handle}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
