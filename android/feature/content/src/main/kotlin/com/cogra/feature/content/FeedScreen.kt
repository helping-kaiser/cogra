package com.cogra.feature.content

import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.CollapsingTopBanner
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.PostView
import com.cogra.feature.content.R
import com.cogra.feature.stance.StanceControlRoute

@Composable
fun FeedRoute(
    /** Null while the auth phase resolves; the write/join affordances wait. */
    signedIn: Boolean?,
    onOpenPost: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    keyBanner: @Composable () -> Unit = {},
    refreshSignal: Boolean = false,
    onRefreshSignalConsumed: () -> Unit = {},
    banners: @Composable () -> Unit = {},
    /**
     * A post the wizard staged whose acts were collected before they
     * landed: the label names it, and null means there is nothing to
     * say (`ComposeExpired`).
     */
    expiredLabel: String? = null,
    onExpiredDismissed: () -> Unit = {},
    onOpenDraft: () -> Unit = {},
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
        expiredLabel = expiredLabel,
        onExpiredDismissed = onExpiredDismissed,
        onOpenDraft = onOpenDraft,
        onRefresh = viewModel::refresh,
        onLoadMore = viewModel::loadMore,
        onOpenPost = onOpenPost,
        onOpenActor = onOpenActor,
        onOpenTopic = onOpenTopic,
        onSignInOrJoin = onSignInOrJoin,
        keyBanner = keyBanner,
        banners = banners,
        stanceControl = { target, tag -> StanceControlRoute(target = target, testTagPrefix = tag) },
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
    onOpenTopic: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    keyBanner: @Composable () -> Unit = {},
    banners: @Composable () -> Unit = {},
    expiredLabel: String? = null,
    onExpiredDismissed: () -> Unit = {},
    onOpenDraft: () -> Unit = {},
    /**
     * The stance control a post card carries (design.md §6), hoisted so
     * the screen stays free of DI and previewable.
     */
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit = { _, _ -> },
) {
    // The collapsing top (design.md §6): the bar hides scrolling down
    // and returns after a third of a screen of upward scroll; the key
    // banner — or the guest notice, for the signed-out reader — rides
    // the same region and gate, so the card follows the reader.
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = { Text(stringResource(R.string.content_feed_title)) },
                    colors = surfaceTopAppBarColors(),
                    scrollBehavior = collapsingTop.scrollBehavior,
                )
                CollapsingTopBanner(collapsingTop) {
                    if (signedIn == false) GuestBanner(onSignInOrJoin) else keyBanner()
                }
            }
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
            // first, and the refresh gesture would swallow the
            // unconsumed at-the-top leftover — the gate's signal that
            // the reader is back at the top — before an outer gate
            // ever saw it.
            Box(
                Modifier
                    .fillMaxSize()
                    .collapsingTop(collapsingTop),
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
                        Box(Modifier.padding(horizontal = 16.dp)) { banners() }
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
                        Box(Modifier.padding(horizontal = 16.dp)) { banners() }
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
                            // "Your post didn't land." The canonical
                            // `ComposeExpired` board puts this here, at
                            // the top of the feed the author returns
                            // to, rather than in the composer they have
                            // already left.
                            expiredLabel?.let { label ->
                                item(key = "feed_expired") {
                                    ExpiredCard(
                                        label = label,
                                        onDismiss = onExpiredDismissed,
                                        onOpenDraft = onOpenDraft,
                                    )
                                }
                            }
                            items(state.posts, key = { it.id }) { post ->
                                PostCard(
                                    post = post,
                                    onClick = { onOpenPost(post.id) },
                                    onOpenActor = onOpenActor,
                                    onOpenTopic = onOpenTopic,
                                    onOpenPost = onOpenPost,
                                    stanceControl = stanceControl,
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
}

/** What a card shows of a long body before the detail takes over. */
private const val FEED_BODY_LINES = 4

/**
 * `ComposeExpired` — a staged batch collected before it landed.
 *
 * The tone is the whole point: nothing was spent, and the draft is
 * already saved, so this states two facts and offers the draft back. No
 * error colouring — an expiry is the substrate working as designed, not
 * a failure the author caused.
 */
@Composable
private fun ExpiredCard(
    label: String,
    onDismiss: () -> Unit,
    onOpenDraft: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("feed_expired"),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = stringResource(R.string.content_expired_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = stringResource(R.string.content_expired_body, label),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            ) {
                TextButton(onClick = onDismiss, modifier = Modifier.testTag("feed_expired_dismiss")) {
                    Text(stringResource(R.string.content_expired_dismiss))
                }
                Button(onClick = onOpenDraft, modifier = Modifier.testTag("feed_expired_open")) {
                    Text(stringResource(R.string.content_expired_open))
                }
            }
        }
    }
}

/**
 * The guest notice: the feed's one sign-in-or-join entry, riding the
 * collapsing top in place of a separate header action (design.md §6).
 */
@Composable
private fun GuestBanner(onSignInOrJoin: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("feed_guest_banner"),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.content_guest_body))
            // Filled: joining is the one committing action a guest has
            // on this surface (design.md §6).
            Button(
                onClick = onSignInOrJoin,
                modifier = Modifier.testTag("feed_signin"),
            ) {
                Text(stringResource(R.string.content_feed_signin))
            }
        }
    }
}

@Composable
private fun PostCard(
    post: PostView,
    onClick: () -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** A referenced post opens on its own detail, not this card's. */
    onOpenPost: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
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
                    avatarUrl = author.avatar?.url,
                    testTag = "feed_author_${post.id}",
                )
            }
            // The title stays outside the veil (D12): a reader has to
            // be able to tell what they are choosing not to look at.
            post.title.value?.takeIf { it.isNotEmpty() }?.let { title ->
                Text(title, style = MaterialTheme.typography.titleMedium)
            }
            PostBody(
                content = post.content,
                description = post.description,
                attachments = post.attachments,
                attachmentsStatus = post.attachmentsStatus,
                testTagPrefix = "feed_post_${post.id}",
                maxBodyLines = FEED_BODY_LINES,
                // The whole gallery is one target opening the post: a
                // reader scrolling the feed is choosing between posts,
                // not looking at one picture.
                onOpenMedia = onClick,
            )
            if (post.landing.isPending) {
                PendingMarker(testTag = "feed_post_pending_${post.id}")
            }
            TopicChipRow(post.topics, onOpenTopic, "feed_post_${post.id}")
            ReferenceChipRow(
                references = post.references,
                onOpenActor = onOpenActor,
                onOpenPost = onOpenPost,
                testTagPrefix = "feed_post_${post.id}",
            )
            // The post card carries the stance control (design.md §6).
            stanceControl(post.id, "feed_post_${post.id}")
        }
    }
}
