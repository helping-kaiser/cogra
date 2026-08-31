package com.cogra.feature.profile.avatar

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

/**
 * The profile-picture flow's route: the picked URI in, a signed change out.
 *
 * The pick happens before this destination — the system photo picker on
 * the edit form — so the flow opens straight on the crop, which is the
 * first thing it has anything to draw.
 */
@Composable
fun AvatarFlowRoute(
    uri: String,
    onSigned: () -> Unit,
    onLeave: () -> Unit,
    viewModel: AvatarFlowViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var helpOpen by remember { mutableStateOf(false) }

    LaunchedEffect(uri) {
        viewModel.start()
        viewModel.onPicked(uri)
    }

    LaunchedEffect(state.saved) {
        if (state.saved) {
            viewModel.onSavedConsumed()
            onSigned()
        }
    }

    AvatarFlowScreen(
        state = state,
        onNext = viewModel::onNext,
        // The arrow steps a stage; from the first there is nowhere to step
        // to, and the gesture leaves — the draft here is only the pick.
        onBack = { if (!viewModel.onBack()) onLeave() },
        onLeave = onLeave,
        onCropCommitted = viewModel::onCropCommitted,
        onSign = viewModel::onSign,
        onRetryUpload = viewModel::onRetryUpload,
        onOpenHelp = { helpOpen = true },
        helpOpen = helpOpen,
        onCloseHelp = { helpOpen = false },
    )
}
