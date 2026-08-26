// The topic screen (hashtag.md; roadmap "Slice 2.3"): a topic's name,
// its follow control — a plain toggle, no pad, no axis labels (D10) —
// and the content currently tagged with it, the fold read from the
// Type's own side (`Hashtag.taggedContent`). Shipped deliberately
// plain: a visual redesign pass over slice 2 is coming and this
// screen is built once for it to reach (rulings.md, redesign note).

package com.cogra.feature.topics

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.SeveranceConfirm
import com.cogra.core.designsystem.SeverancePrompt
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView

@Composable
fun TopicRoute(
    name: String,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: TopicViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(name) { viewModel.start(name) }
    TopicScreen(
        name = name,
        state = state,
        onRefresh = viewModel::refresh,
        onFollow = viewModel::onFollow,
        onOpenUnfollow = viewModel::onOpenUnfollow,
        onDismissUnfollow = viewModel::onDismissUnfollow,
        onConfirmUnfollow = viewModel::onConfirmUnfollow,
        onOpenPost = onOpenPost,
        onOpenActor = onOpenActor,
        onBack = onBack,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopicScreen(
    name: String,
    state: TopicUiState,
    onRefresh: () -> Unit,
    onFollow: () -> Unit,
    onOpenUnfollow: () -> Unit,
    onDismissUnfollow: () -> Unit,
    onConfirmUnfollow: () -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                colors = surfaceTopAppBarColors(),
                title = { Text("#$name", modifier = Modifier.testTag("topic_title")) },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("topic_back")) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.topics_back),
                        )
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                state.loading -> CircularProgressIndicator(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .testTag("topic_loading"),
                )
                state.notFound -> ErrorLine(
                    R.string.topics_not_found,
                    "topic_not_found",
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(24.dp),
                )
                state.transportFailed -> Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ErrorLine(R.string.topics_error_transport, "topic_transport_error")
                    TextButton(onClick = onRefresh, modifier = Modifier.testTag("topic_retry")) {
                        Text(stringResource(R.string.topics_retry))
                    }
                }
                else -> LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .testTag("topic_list"),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        FollowControl(
                            state = state,
                            onFollow = onFollow,
                            onOpenUnfollow = onOpenUnfollow,
                        )
                    }
                    if (!state.contentLoading && state.content.isEmpty()) {
                        item {
                            Text(
                                stringResource(R.string.topics_content_empty),
                                modifier = Modifier.testTag("topic_content_empty"),
                            )
                        }
                    }
                    items(state.content, key = { "${it.kind}:${it.id}" }) { entry ->
                        TaggedContentCard(entry, onOpenPost = onOpenPost, onOpenActor = onOpenActor)
                    }
                    if (state.contentLoading) {
                        item {
                            CircularProgressIndicator(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(8.dp)
                                    .testTag("topic_content_loading"),
                            )
                        }
                    }
                }
            }
        }
    }
    state.severance?.let { quote ->
        SeveranceConfirm(
            prompt = SeverancePrompt(
                standing = StancePoint(quote.standing.pDirected, quote.standing.pInterest),
                raw = StancePoint(quote.raw.pDirected, quote.raw.pInterest),
                records = quote.records,
                alreadySevered = quote.alreadySevered,
                fromPick = false,
                working = state.severanceWorking,
                failed = state.severanceFailed,
            ),
            onConfirm = onConfirmUnfollow,
            onDismiss = onDismissUnfollow,
            testTagPrefix = "topic",
        )
    }
}

/**
 * The follow control: a plain toggle (D10) — tap follows at the
 * tap default, tap again opens the existing severance confirm to
 * unfollow (D9). No pad, no axis labels; the redesign pass revisits.
 */
@Composable
private fun FollowControl(
    state: TopicUiState,
    onFollow: () -> Unit,
    onOpenUnfollow: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (state.following) {
            OutlinedButton(
                onClick = onOpenUnfollow,
                modifier = Modifier.testTag("topic_following"),
            ) {
                Text(stringResource(R.string.topics_following))
            }
        } else {
            Button(
                onClick = onFollow,
                enabled = !state.followBusy,
                modifier = Modifier.testTag("topic_follow"),
            ) {
                Text(stringResource(R.string.topics_follow))
            }
        }
        if (state.followFailed) {
            ErrorLine(
                if (state.followNeedsKey) R.string.topics_error_signing_no_key else R.string.topics_error_signing,
                "topic_follow_failed",
            )
        }
    }
}

@Composable
private fun TaggedContentCard(
    entry: TaggedContentView,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
) {
    val clickable = entry.kind == TaggedContentKind.POST
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("topic_content_${entry.kind}_${entry.id}")
            .let { m -> if (clickable) m.clickable { onOpenPost(entry.id) } else m },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            val authorHandle = entry.authorHandle
            if (authorHandle != null) {
                ActorChip(
                    handle = authorHandle,
                    displayName = entry.authorDisplayName,
                    onOpen = { onOpenActor(authorHandle) },
                    testTag = "topic_content_author_${entry.id}",
                )
            }
            entry.title?.takeIf { it.isNotEmpty() }?.let { title ->
                Text(title, style = MaterialTheme.typography.titleMedium)
            }
            entry.snippet?.let { body ->
                Text(
                    body,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (entry.pending) {
                PendingMarker(testTag = "topic_content_pending_${entry.id}")
            }
        }
    }
}
