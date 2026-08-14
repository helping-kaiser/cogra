package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.ErrorLine
import com.cogra.domain.PostView
import com.cogra.feature.content.R

@Composable
fun FeedRoute(
    /** Null while the auth phase resolves; the write/join affordances wait. */
    signedIn: Boolean?,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    /** Null when the feed is the shell's root tab — no back arrow. */
    onBack: (() -> Unit)?,
    refreshSignal: Boolean = false,
    onRefreshSignalConsumed: () -> Unit = {},
    banners: @Composable () -> Unit = {},
    viewModel: FeedViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    if (refreshSignal) {
        onRefreshSignalConsumed()
        viewModel.refresh()
    }
    FeedScreen(
        state = state,
        signedIn = signedIn,
        onRefresh = viewModel::refresh,
        onLoadMore = viewModel::loadMore,
        onOpenPost = onOpenPost,
        onOpenActor = onOpenActor,
        onSignInOrJoin = onSignInOrJoin,
        onBack = onBack,
        banners = banners,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    state: FeedUiState,
    signedIn: Boolean?,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onBack: (() -> Unit)?,
    banners: @Composable () -> Unit = {},
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.content_feed_title)) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack, modifier = Modifier.testTag("feed_back")) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.content_back),
                            )
                        }
                    }
                },
                actions = {
                    if (signedIn == false) {
                        TextButton(
                            onClick = onSignInOrJoin,
                            modifier = Modifier.testTag("feed_signin"),
                        ) {
                            Text(stringResource(R.string.content_feed_signin))
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
            // The status banners ride every branch — an applicant with an
            // empty feed still sees their application cards.
            when {
                state.transportFault != null && state.posts.isEmpty() -> Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    banners()
                    ErrorLine(R.string.content_error_transport, "feed_transport_error")
                    TextButton(onClick = onRefresh, modifier = Modifier.testTag("feed_retry")) {
                        Text(stringResource(R.string.content_retry))
                    }
                }
                !state.loading && state.posts.isEmpty() -> Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    banners()
                    Text(
                        stringResource(R.string.content_feed_empty),
                        modifier = Modifier.testTag("feed_empty"),
                    )
                }
                else -> Column(modifier = Modifier.fillMaxSize()) {
                    // A transport fault never blanks content already on
                    // screen, and it surfaces where the failed fetch was
                    // requested: a failed refresh on this banner, a
                    // failed page fetch at the load-more slot below
                    // (android.md "Degrade, never crash").
                    if (state.transportFault == TransportFault.REFRESH) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 24.dp, vertical = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            ErrorLine(R.string.content_feed_stale, "feed_transport_banner")
                            TextButton(
                                onClick = onRefresh,
                                modifier = Modifier.testTag("feed_retry"),
                            ) {
                                Text(stringResource(R.string.content_retry))
                            }
                        }
                    }
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .testTag("feed_list"),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        item(key = "feed_banners") { banners() }
                        items(state.posts, key = { it.id }) { post ->
                            PostCard(
                                post = post,
                                onClick = { onOpenPost(post.id) },
                                onOpenActor = onOpenActor,
                            )
                        }
                        if (state.hasNextPage) {
                            item {
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    when {
                                        state.loadingMore -> CircularProgressIndicator(
                                            modifier = Modifier.padding(8.dp),
                                        )
                                        state.transportFault == TransportFault.APPEND -> {
                                            ErrorLine(
                                                R.string.content_feed_stale,
                                                "feed_load_more_error",
                                            )
                                            TextButton(
                                                onClick = onLoadMore,
                                                modifier = Modifier.testTag("feed_load_more_retry"),
                                            ) {
                                                Text(stringResource(R.string.content_retry))
                                            }
                                        }
                                        else -> TextButton(
                                            onClick = onLoadMore,
                                            modifier = Modifier.testTag("feed_load_more"),
                                        ) {
                                            Text(stringResource(R.string.content_feed_load_more))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PostCard(post: PostView, onClick: () -> Unit, onOpenActor: (String) -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .testTag("feed_post_${post.id}"),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            post.author?.let { author ->
                ActorChip(
                    handle = author.handle,
                    displayName = author.displayName,
                    onOpen = { onOpenActor(author.handle) },
                    testTag = "feed_author_${post.id}",
                )
            }
            post.title.value?.takeIf { it.isNotEmpty() }?.let { title ->
                Text(title, style = MaterialTheme.typography.titleMedium)
            }
            post.content.value?.let { body ->
                Text(
                    body,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
