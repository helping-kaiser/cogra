// YOUR TOPICS (YourTopics.jsx; YourTopics.md) — every topic the reader holds,
// in one place, behind Explore's door. A SUBPAGE OF EXPLORE: the arrow goes
// back to it and there is no bottom bar (TagPage's arrangement). Each row is
// `ReferenceRow` kind `topic` with the AFFINITY the reader signed — the face,
// its digits in geek mode — and the settling marker while an act is in
// flight. Strongest first, as served; no per-row removal (a walk-back happens
// on the topic's own page, where the act is explained); the word "follow"
// nowhere.
//
// REGISTERED as `YourTopics` (prefix `yourTopics`, design round 23); a row
// is `heldTopic`, keyed by the topic's name without #. The empty and error
// states are not drawn, so their tags stay unregistered.

package com.cogra.feature.explore

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.MarkKind
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.ReferenceRow
import com.cogra.core.designsystem.v2.atom.RowEdge
import com.cogra.core.designsystem.v2.token.Space

/** The screen's registered prefix (nodes.json `YourTopics`). */
internal val YOUR_TOPICS = DataNode("yourTopics")

@Composable
fun YourTopicsRoute(
    onBack: () -> Unit,
    onOpenTopic: (name: String) -> Unit,
    viewModel: YourTopicsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    YourTopicsScreen(
        state = state,
        onBack = onBack,
        onOpenTopic = onOpenTopic,
        onRetry = viewModel::read,
        onLoadMore = viewModel::loadMore,
        onRetryMore = viewModel::retryMore,
    )
}

@Composable
fun YourTopicsScreen(
    state: YourTopicsUiState,
    onBack: () -> Unit,
    onOpenTopic: (name: String) -> Unit,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    modifier: Modifier = Modifier,
    onRetryMore: () -> Unit = onLoadMore,
) {
    val list = rememberLazyListState()
    val load by rememberUpdatedState(onLoadMore)
    LaunchedEffect(list) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .collect { last -> if (last >= 0 && last >= list.layoutInfo.totalItemsCount - TAIL) load() }
    }
    Column(modifier.fillMaxSize().dataNodeSurface()) {
        PageHeader(
            title = stringResource(R.string.your_topics_title),
            onBack = onBack,
            backContentDescription = stringResource(R.string.your_topics_back),
            node = YOUR_TOPICS / "header",
        )
        when {
            state.loading && state.topics.isEmpty() -> LoadingState(
                "your_topics_loading",
                Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
            )
            state.failed && state.topics.isEmpty() -> EmptyState(
                testTag = "your_topics_error",
                title = stringResource(R.string.explore_cant_reach),
                actionLabel = stringResource(R.string.explore_retry),
                onAction = onRetry,
                modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
            )
            state.topics.isEmpty() -> EmptyState(
                testTag = (YOUR_TOPICS / "empty").tag,
                title = stringResource(R.string.your_topics_empty),
                modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
            )
            else -> LazyColumn(state = list, modifier = Modifier.fillMaxSize().padding(top = Space.x1)) {
                items(state.topics, key = { it.name }) { topic ->
                    ReferenceRow(
                        kind = MarkKind.TOPIC,
                        name = "#${topic.name}",
                        edge = RowEdge.Stance(StancePoint(topic.pDirected, topic.pInterest)),
                        pending = topic.pending,
                        onOpen = { onOpenTopic(topic.name) },
                        node = (YOUR_TOPICS / "heldTopic").keyed(topic.name),
                    )
                }
                if (state.moreFailed) {
                    item(key = "moreFailed") {
                        EmptyState(
                            testTag = "your_topics_more_failed",
                            title = stringResource(R.string.explore_couldnt_load_more),
                            actionLabel = stringResource(R.string.explore_retry),
                            onAction = onRetryMore,
                            modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
                        )
                    }
                }
            }
        }
    }
}

private const val TAIL = 5
