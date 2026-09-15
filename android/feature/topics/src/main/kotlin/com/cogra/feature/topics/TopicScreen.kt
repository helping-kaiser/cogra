// The topic screen (hashtag.md; roadmap "Slice 2.3"): a topic's name,
// the stance row, and the content currently tagged with it — the fold
// read from the Type's own side (`Hashtag.taggedContent`).
//
// THE TITLE CARRIES NO CONTROL AND THE ROW BELOW IT DOES (`TagPage`,
// the topic round 2026-09-14). A stance anchor on the bar's trailing
// edge read as a stance readout for the post the reader arrived from;
// a row of its own, under the title and above anything belonging to a
// post, cannot. THE GESTURE IS AN AFFINITY — the same ceremony every
// stance uses, wearing the family's own words (`StanceAxes.Affinity`)
// — so there is no toggle and no one-tap follow, and the word "follow"
// is not on the screen.
//
// THE ROW IS A SLOT, not a control this module builds. `feature:topics`
// depends on `core:domain` and never on a feature it would have to
// reach through — the shell owns what a signed-out tap does, so the
// shell passes the whole row in (android/CLAUDE.md, "Navigation is
// hoisted"). It is also why a guest reaches this page like anyone else:
// the page is public, the face wears the same no-standing affordance a
// reader with nothing said wears, and the tap raises the join prompt.
//
// THE EMPTY PAGE WIRES NO FACE AT ALL (backlog item 81, ruled
// 2026-09-15), which is why the row sits inside the populated branch.

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
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.TaggedContentKind
import com.cogra.domain.TaggedContentView

@Composable
fun TopicRoute(
    name: String,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onBack: () -> Unit,
    stanceControl: (@Composable () -> Unit)? = null,
    viewModel: TopicViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(name) { viewModel.start(name) }
    TopicScreen(
        name = name,
        state = state,
        onRefresh = viewModel::refresh,
        onOpenPost = onOpenPost,
        onOpenActor = onOpenActor,
        onBack = onBack,
        stanceControl = stanceControl,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopicScreen(
    name: String,
    state: TopicUiState,
    onRefresh: () -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onBack: () -> Unit,
    /**
     * The page's one action, drawn by the shell. Null while the auth
     * state is still unknown — the signed-in and signed-out readings
     * differ, and guessing puts the wrong action on the tap for a frame.
     */
    stanceControl: (@Composable () -> Unit)? = null,
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
                else -> Column(modifier = Modifier.fillMaxSize()) {
                    // Under the title, above anything belonging to a
                    // post — outside the list, so it does not scroll
                    // away from the page it acts on.
                    if (stanceControl != null && state.content.isNotEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                                .testTag("topic_stance_row"),
                        ) {
                            stanceControl()
                        }
                    }
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .testTag("topic_list"),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
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
