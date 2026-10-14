// NOTIFICATIONS — the second surfacing channel, reached from the bell on a
// root band (Notifications.md, NotificationsEmpty.md;
// design/designs/canonical/screens/Notifications.jsx). web's twin is
// `web/src/app/notifications/notifications-view.tsx`.
//
// ONE FLAT LIST, NEWEST FIRST, NO GROUPING: every row is one actor doing one
// thing at one moment, written as a sentence over ContentRow's chronicle
// variant. There is no mark-all control and no pull — freshness comes from
// opening the list again. Every row not yet opened wears its own dot until it
// is tapped. The back arrow names the root the bell was tapped on and pops
// back to it, in the state it was left (Notifications.md:47, :49).

package com.cogra.feature.notifications

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.ContentRowSecond
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.domain.ageLadder
import com.cogra.domain.notifications.BellRoot
import com.cogra.domain.notifications.NOTIFICATIONS_EMPTY
import com.cogra.domain.notifications.Notification
import com.cogra.domain.notifications.NotificationDisc
import com.cogra.domain.notifications.NotificationTarget
import com.cogra.domain.notifications.notificationRow
import java.time.Instant

private val NOTIFICATIONS = DataNode("notifications")

/** The root a `from` names; unknown values fall to the feed. */
fun bellRootOf(from: String?): BellRoot = when (from) {
    "explore" -> BellRoot.EXPLORE
    "wallet" -> BellRoot.WALLET
    "profile" -> BellRoot.PROFILE
    else -> BellRoot.FEED
}

@Composable
fun NotificationsRoute(
    from: String?,
    onBack: () -> Unit,
    onOpen: (NotificationTarget) -> Unit,
    viewModel: NotificationsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LifecycleResumeEffect(viewModel) {
        viewModel.resumed()
        onPauseOrDispose {}
    }
    NotificationsScreen(
        state = state,
        root = bellRootOf(from),
        onRetry = viewModel::read,
        onLoadMore = viewModel::loadMore,
        onBack = onBack,
        onOpen = { row, target ->
            viewModel.opened(row)
            target?.let(onOpen)
        },
    )
}

@Composable
fun NotificationsScreen(
    state: NotificationsUiState,
    root: BellRoot,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onBack: () -> Unit,
    onOpen: (Notification, NotificationTarget?) -> Unit,
    now: Instant = Instant.now(),
) {
    val list = rememberLazyListState()
    LoadNextAtTheTail(list, state, onLoadMore)
    Column(Modifier.fillMaxSize().dataNodeSurface()) {
        PageHeader(
            title = stringResource(R.string.notifications_title),
            onBack = onBack,
            backContentDescription = root.backLabel,
            node = NOTIFICATIONS / "header",
        )
        when {
            state.loading && state.notifications.isEmpty() -> Text(
                stringResource(com.cogra.core.designsystem.R.string.loading_state),
                modifier = Modifier.padding(16.dp).testTag("notifications_loading"),
            )

            state.failed && state.notifications.isEmpty() -> LoadFailed(onRetry)

            state.notifications.isEmpty() && !state.hasNextPage -> Empty()

            else -> NotificationList(list, state, now, onOpen, onLoadMore)
        }
    }
}

/** THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (readme §13): asked a few rows short of the end. */
@Composable
private fun LoadNextAtTheTail(list: LazyListState, state: NotificationsUiState, onLoadMore: () -> Unit) {
    val rows = state.notifications.size
    LaunchedEffect(list, state.hasNextPage, state.moreFailed, rows) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .collect { last ->
                val nearEnd = last >= rows - TAIL_DISTANCE
                if (state.hasNextPage && !state.moreFailed && nearEnd) onLoadMore()
            }
    }
}

@Composable
private fun NotificationList(
    list: LazyListState,
    state: NotificationsUiState,
    now: Instant,
    onOpen: (Notification, NotificationTarget?) -> Unit,
    onLoadMore: () -> Unit,
) {
    LazyColumn(
        state = list,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxSize().dataNode(NOTIFICATIONS / "list"),
    ) {
        itemsIndexed(state.notifications, key = { _, row -> row.id }) { index, row ->
            val content = notificationRow(row)
            ContentRow(
                title = content.title,
                sentence = content.deleted,
                disc = content.disc.toContentRowDisc(),
                second = content.second?.let { words -> { ContentRowSecond(words) } },
                trailing = ageLadder(row.createdAt, now),
                unread = row.readAt == null && row.id !in state.opened,
                onOpen = { onOpen(row, content.target) },
                // Keyed by place in the list, newest first (the board's key rule).
                node = (NOTIFICATIONS / "list" / "notification").keyed((index + 1).toString()),
                testTag = "notification_${row.id}",
            )
        }
        if (state.moreFailed) {
            item(key = "more-failed") { MoreFailed(onLoadMore) }
        }
    }
}

@Composable
private fun LoadFailed(onRetry: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
        Text(
            stringResource(R.string.notifications_load_failed),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f).testTag("notifications_transport_error"),
        )
        TextButton(onClick = onRetry, modifier = Modifier.testTag("notifications_retry")) {
            Text(stringResource(R.string.notifications_retry))
        }
    }
}

/** NOTIFICATIONSEMPTY: the kinds named in words — no action button, no error colour. */
@Composable
private fun Empty() {
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp).dataNode(NOTIFICATIONS / "empty")) {
        Text(
            NOTIFICATIONS_EMPTY,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 8.dp).dataNode(NOTIFICATIONS / "empty" / "title"),
        )
    }
}

/** The chronicle's load-more fault, quiet (design digest item 57). */
@Composable
private fun MoreFailed(onLoadMore: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            stringResource(R.string.notifications_more_failed),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("notifications_more_failed"),
        )
        TextButton(onClick = onLoadMore, modifier = Modifier.testTag("notifications_more_retry")) {
            Text(stringResource(R.string.notifications_retry))
        }
    }
}

/** How close to the end of the list the next page is asked for. */
private const val TAIL_DISTANCE = 5

private fun NotificationDisc.toContentRowDisc(): ContentRowDisc = when (this) {
    is NotificationDisc.Picture -> ContentRowDisc.Picture(url, name)
    is NotificationDisc.Monogram -> ContentRowDisc.Monogram(name)
    is NotificationDisc.Face -> ContentRowDisc.Face(directed, interest)
    NotificationDisc.Redacted -> ContentRowDisc.Redacted
}
