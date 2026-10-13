// A NEWER VERSION, SAID ONCE (FeedNewerVersion.md). Mounted on the feed — the
// one destination members, applicants and guests all land on (design ruling
// 62) — it asks the process's announcer at the feed's arrival and, given a
// release to announce, raises `A newer version of CoGra is out.` with
// `Update now` through the shell's snackbar host, which queues it behind
// whatever the feed is already saying (`SnackbarHostState.showSnackbar`
// suspends while another snackbar shows).
//
// The release is marked announced the moment the snackbar shows
// (FeedNewerVersion.md:3) — not when it is queued, so a reader who leaves
// the feed before it rises hears it at the next cold open.

package com.cogra.feature.home

import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.NodeSnackbarVisuals
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** The feed's newer-version snackbar; [onUpdateNow] opens CoGra's store listing. */
@Composable
fun NewerVersionAnnouncement(
    onUpdateNow: () -> Unit,
    viewModel: NewerVersionViewModel = hiltViewModel(),
) {
    val host = LocalSnackbarHostState.current ?: return
    val message = stringResource(R.string.newer_version_snackbar)
    val action = stringResource(R.string.newer_version_update_now)
    LaunchedEffect(Unit) {
        val release = viewModel.onFeedArrived() ?: return@LaunchedEffect
        val visuals = NodeSnackbarVisuals(message, DataNode("feed") / "snackbar", action)
        if (host.announce(visuals) { viewModel.onShown(release) } == SnackbarResult.ActionPerformed) {
            onUpdateNow()
        }
    }
}

/** Shows [visuals] in turn, running [onShown] the moment they are the one on screen. */
private suspend fun SnackbarHostState.announce(
    visuals: NodeSnackbarVisuals,
    onShown: suspend () -> Unit,
): SnackbarResult = coroutineScope {
    launch {
        snapshotFlow { currentSnackbarData?.visuals }.first { it === visuals }
        onShown()
    }
    showSnackbar(visuals)
}
