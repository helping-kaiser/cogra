package com.cogra.feature.profile.avatar

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.cogra.domain.media.CropWindow

/**
 * The profile-picture flow's route: the picked URI in, a signed change out
 * — or, opened from the edit form, the framed picture out.
 *
 * The pick happens before this destination, so the flow opens straight on
 * the crop, which is the first thing it has anything to draw. Its Next has
 * two outcomes (AvatarCrop.md): off the avatar's change badge it opens the
 * picture's own seal; opened from Change picture on the edit form
 * ([onFramed] given) it hands the framing back to that form, whose one seal
 * signs the picture with the fields — nothing is uploaded or signed here.
 */
@Composable
fun AvatarFlowRoute(
    uri: String,
    onSigned: () -> Unit,
    onLeave: () -> Unit,
    onFramed: ((CropWindow?) -> Unit)? = null,
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
        onNext = {
            if (onFramed != null) onFramed(state.crop?.window) else viewModel.onNext()
        },
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
