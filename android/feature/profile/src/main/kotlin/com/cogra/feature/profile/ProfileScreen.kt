// The profile screen (roadmap "Slice 2.1"; design.md §6 "Profile
// header"): monogram avatar, name, handle, bio, link — and the
// authored chronicle under filter chips. The header's
// connection count and the connections sections arrive with the
// stance slice (open-questions Q35); media covers with slice 2.5.

package com.cogra.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTopBanner
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.crypto.Family
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.feature.stance.StanceControlRoute
import kotlinx.coroutines.launch

@Composable
fun ProfileRoute(
    handle: String?,
    handleChangedResult: Boolean,
    onHandleChangedResultConsumed: () -> Unit,
    profileSavedResult: Boolean,
    onProfileSavedResultConsumed: () -> Unit,
    onEdit: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenPost: (String) -> Unit,
    onBack: (() -> Unit)?,
    keyBanner: @Composable () -> Unit = {},
    banners: @Composable () -> Unit = {},
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(handle) { viewModel.start(handle) }
    // Settings confirmed the handle change; the edit screen confirmed
    // the save — either way this screen re-reads.
    LaunchedEffect(handleChangedResult) {
        if (handleChangedResult) {
            onHandleChangedResultConsumed()
            viewModel.refresh()
        }
    }
    ProfileScreen(
        state = state,
        profileSavedResult = profileSavedResult,
        onProfileSavedResultConsumed = {
            onProfileSavedResultConsumed()
            viewModel.refresh()
        },
        onFilterChange = viewModel::onFilterChange,
        onLoadMore = viewModel::onLoadMore,
        onRetry = viewModel::refresh,
        onEdit = onEdit,
        onOpenSettings = onOpenSettings,
        onOpenInvites = onOpenInvites,
        onOpenPost = onOpenPost,
        onBack = onBack,
        keyBanner = keyBanner,
        banners = banners,
        stanceControl = { target, tag -> StanceControlRoute(target = target, testTagPrefix = tag) },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    state: ProfileUiState,
    profileSavedResult: Boolean,
    onProfileSavedResultConsumed: () -> Unit,
    onFilterChange: (ChronicleFilter) -> Unit,
    onLoadMore: () -> Unit,
    onRetry: () -> Unit,
    onEdit: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenPost: (String) -> Unit,
    onBack: (() -> Unit)?,
    keyBanner: @Composable () -> Unit = {},
    banners: @Composable () -> Unit = {},
    /** The header's stance control on someone else's profile (design.md §6). */
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit = { _, _ -> },
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val savedMessage = stringResource(R.string.profile_saved)
    LaunchedEffect(profileSavedResult) {
        if (profileSavedResult) {
            snackbarHostState.showSnackbar(savedMessage)
            onProfileSavedResultConsumed()
        }
    }
    // Acting is gated for applicants, but the surface stays visible and
    // tappable — the tap explains that approval unlocks it (auth.md
    // "Application").
    val invitesLockedMessage = stringResource(R.string.profile_invites_locked)
    val openInvites: () -> Unit = {
        if (state.applicant) {
            scope.launch { snackbarHostState.showSnackbar(invitesLockedMessage) }
        } else {
            onOpenInvites()
        }
    }
    // The collapsing top — the FeedScreen twin: the shared bar-plus-
    // banner region with the reveal gate.
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.collapsingTop(collapsingTop),
        snackbarHost = {
            SnackbarHost(snackbarHostState) },
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Text(
                            text = state.profile?.let { "@${it.handle}" }
                                ?: stringResource(R.string.profile_title),
                        )
                    },
                    navigationIcon = {
                        if (onBack != null) {
                            IconButton(onClick = onBack, modifier = Modifier.testTag("profile_back")) {
                                Icon(
                                    Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = stringResource(R.string.profile_back),
                                )
                            }
                        }
                    },
                    actions = {
                        if (state.own) {
                            IconButton(
                                onClick = onOpenSettings,
                                modifier = Modifier.testTag("profile_settings"),
                            ) {
                                Icon(
                                    Icons.Filled.Settings,
                                    contentDescription = stringResource(R.string.profile_open_settings),
                                )
                            }
                        }
                    },
                    colors = surfaceTopAppBarColors(),
                    scrollBehavior = collapsingTop.scrollBehavior,
                )
                CollapsingTopBanner(collapsingTop) { keyBanner() }
            }
        },
    ) { padding ->
        when {
            state.loading -> Box(Modifier.fillMaxSize().padding(padding)) {
                CircularProgressIndicator(
                    modifier = Modifier.padding(24.dp).testTag("profile_loading"),
                )
            }
            state.notFound -> Column(Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                Text(
                    text = stringResource(R.string.profile_not_found),
                    modifier = Modifier.testTag("profile_not_found"),
                )
            }
            state.transportFailed && state.profile == null ->
                Column(Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
                    Text(
                        text = stringResource(R.string.error_transport),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.testTag("profile_transport_error"),
                    )
                    TextButton(onClick = onRetry, modifier = Modifier.testTag("profile_retry")) {
                        Text(stringResource(R.string.profile_retry))
                    }
                }
            else -> {
                val profile = state.profile ?: return@Scaffold
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item(key = "banners") {
                        Box(Modifier.padding(horizontal = 16.dp)) { banners() }
                    }
                    item(key = "header") {
                        ProfileHeader(
                            state = state,
                            onEdit = onEdit,
                            onOpenInvites = openInvites,
                            stanceControl = stanceControl,
                        )
                    }
                    item(key = "filters") {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(horizontal = 16.dp),
                        ) {
                            FilterChip(
                                selected = state.filter == ChronicleFilter.POSTS,
                                onClick = { onFilterChange(ChronicleFilter.POSTS) },
                                label = { Text(stringResource(R.string.profile_filter_posts)) },
                                modifier = Modifier.testTag("profile_filter_posts"),
                            )
                            FilterChip(
                                selected = state.filter == ChronicleFilter.COMMENTS,
                                onClick = { onFilterChange(ChronicleFilter.COMMENTS) },
                                label = { Text(stringResource(R.string.profile_filter_comments)) },
                                modifier = Modifier.testTag("profile_filter_comments"),
                            )
                            FilterChip(
                                selected = state.filter == ChronicleFilter.EVERYTHING,
                                onClick = { onFilterChange(ChronicleFilter.EVERYTHING) },
                                label = { Text(stringResource(R.string.profile_filter_everything)) },
                                modifier = Modifier.testTag("profile_filter_everything"),
                            )
                        }
                    }
                    if (state.rows.isEmpty() && !state.rowsLoading) {
                        item(key = "empty") {
                            Text(
                                text = stringResource(R.string.profile_chronicle_empty),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(16.dp).testTag("profile_chronicle_empty"),
                            )
                        }
                    }
                    items(state.rows, key = { it.id }) { row ->
                        ChronicleRow(row = row, onOpenPost = onOpenPost)
                    }
                    item(key = "more") {
                        when {
                            state.rowsLoading -> CircularProgressIndicator(
                                modifier = Modifier.padding(16.dp).testTag("profile_rows_loading"),
                            )
                            state.pageFailed -> TextButton(
                                onClick = onLoadMore,
                                modifier = Modifier.padding(4.dp).testTag("profile_rows_retry"),
                            ) {
                                Text(stringResource(R.string.profile_retry))
                            }
                            state.hasMore -> TextButton(
                                onClick = onLoadMore,
                                modifier = Modifier.padding(4.dp).testTag("profile_rows_more"),
                            ) {
                                Text(stringResource(R.string.profile_load_more))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileHeader(
    state: ProfileUiState,
    onEdit: () -> Unit,
    onOpenInvites: () -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
    val profile = state.profile ?: return
    val name = profile.displayName.value?.takeIf { it.isNotBlank() } ?: profile.handle
    Column(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // The actor's picture when they have one, the monogram when
        // they do not — and the monogram is where a failed load lands
        // too, so "no picture" and "broken picture" look alike (D13).
        CograAvatar(
            name = name,
            size = 64.dp,
            url = profile.avatar?.url,
            testTag = "profile_avatar",
        )
        Column {
            Text(
                text = name,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier
                    .semantics { heading() }
                    .testTag("profile_display_name"),
            )
            Text(
                text = "@${profile.handle}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("profile_handle"),
            )
            profile.bio.value?.takeIf { it.isNotBlank() }?.let { bio ->
                Text(
                    text = bio,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(top = 8.dp).testTag("profile_bio"),
                )
            }
            profile.websiteUrl.value?.takeIf { it.isNotBlank() }?.let { url ->
                Text(
                    text = url,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp).testTag("profile_website"),
                )
            }
            // The header's primary action (design.md §6). On someone
            // else's profile that action is the stance toward them — the
            // interpersonal Opinion (api-spec.md "The generic stance");
            // one's own profile keeps edit and invites instead.
            if (!state.own) {
                Box(Modifier.padding(top = 12.dp)) {
                    stanceControl(profile.id, "profile")
                }
            }
            if (state.own) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 12.dp),
                ) {
                    OutlinedButton(
                        onClick = onEdit,
                        modifier = Modifier.testTag("profile_edit"),
                    ) {
                        Text(stringResource(R.string.profile_edit))
                    }
                    // Invite management is a standalone entry on
                    // one's own profile (design.md §6); an
                    // applicant's tap explains the lock upstream.
                    OutlinedButton(
                        onClick = onOpenInvites,
                        modifier = Modifier.testTag("profile_invites"),
                    ) {
                        Text(stringResource(R.string.profile_invites))
                    }
                }
            }
        }
    }
}

/**
 * One chronicle row — the honest labelled history: what the record
 * did, a snippet of what it touched, opening the post it lives on.
 */
@Composable
private fun ChronicleRow(row: RecordRow, onOpenPost: (String) -> Unit) {
    val label = when (row.family) {
        Family.PUBLISH -> if (row.genesis) R.string.chronicle_published else R.string.chronicle_edited_post
        Family.REVIEW -> if (row.genesis) R.string.chronicle_commented else R.string.chronicle_edited_comment
        // The anchoring record and its updates share one honest label —
        // the chain shape is not visible per-row.
        Family.REGISTRATION -> R.string.chronicle_profile_record
        Family.OPINION, Family.AFFINITY -> R.string.chronicle_stanced
        else -> R.string.chronicle_acted
    }
    Card(
        onClick = { (row.link as? RecordLink.ToPost)?.let { onOpenPost(it.postId) } },
        enabled = row.link != null,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .testTag("chronicle_row"),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = stringResource(label),
                style = MaterialTheme.typography.labelLarge,
            )
            row.snippet?.takeIf { it.isNotBlank() }?.let { snippet ->
                Text(
                    text = snippet,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }
        }
    }
}
