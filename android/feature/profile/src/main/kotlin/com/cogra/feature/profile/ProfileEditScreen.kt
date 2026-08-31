package com.cogra.feature.profile

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.media.CograCover

@Composable
fun ProfileEditRoute(
    onSaved: () -> Unit,
    onBack: () -> Unit,
    viewModel: ProfileEditViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // A one-shot, in an effect rather than in the composition.
    //
    // Run inline, this popped the back stack twice: `onSavedConsumed`
    // writes to the state flow, but the collector is dispatched, so the
    // next recomposition in the same frame still saw `saved` and called
    // `onSaved` again — the second pop took the profile with it and the
    // refresh signal landed on the wrong back-stack entry, which is why a
    // changed avatar never appeared. Same shape the wizard's outcome uses.
    LaunchedEffect(state.saved) {
        if (state.saved) {
            viewModel.onSavedConsumed()
            onSaved()
        }
    }

    // One picker per picture: the system photo picker, so no media
    // permission is ever requested
    // (developer.android.com/training/data-storage/shared/photopicker).
    val avatarPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let { viewModel.onAvatarPicked(it.toString()) } }
    val coverPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> uri?.let { viewModel.onCoverPicked(it.toString()) } }

    ProfileEditScreen(
        state = state,
        onDisplayNameChange = viewModel::onDisplayNameChange,
        onBioChange = viewModel::onBioChange,
        onWebsiteChange = viewModel::onWebsiteChange,
        onPickAvatar = {
            avatarPicker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        },
        onClearAvatar = viewModel::onAvatarCleared,
        onPickCover = {
            coverPicker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        },
        onClearCover = viewModel::onCoverCleared,
        onSubmit = viewModel::onSubmit,
        onRetry = viewModel::load,
        onBack = onBack,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileEditScreen(
    state: ProfileEditUiState,
    onDisplayNameChange: (String) -> Unit,
    onBioChange: (String) -> Unit,
    onWebsiteChange: (String) -> Unit,
    onPickAvatar: () -> Unit,
    onClearAvatar: () -> Unit,
    onPickCover: () -> Unit,
    onClearCover: () -> Unit,
    onSubmit: () -> Unit,
    onRetry: () -> Unit,
    onBack: () -> Unit,
) {
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.collapsingTop(collapsingTop),
        topBar = {
            TopAppBar(
                colors = surfaceTopAppBarColors(),
                scrollBehavior = collapsingTop.scrollBehavior,
                title = { Text(stringResource(R.string.profile_edit_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("profile_edit_back")) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.profile_back),
                        )
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            when {
                state.loading -> CircularProgressIndicator(
                    modifier = Modifier.testTag("profile_edit_loading"),
                )
                state.transportFailed -> {
                    Text(
                        text = stringResource(R.string.error_transport),
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.testTag("profile_edit_transport_error"),
                    )
                    TextButton(onClick = onRetry, modifier = Modifier.testTag("profile_edit_retry")) {
                        Text(stringResource(R.string.profile_retry))
                    }
                }
                else -> {
                    // The two pictures (D13). Both go through the same
                    // pipeline a post's pictures do; only the crop
                    // differs — a circle-masked square, and a wide
                    // cover — and the monogram is the permanent
                    // fallback rather than an empty state.
                    ProfileImageRow(
                        label = stringResource(R.string.profile_edit_avatar),
                        image = state.avatar,
                        name = state.displayName,
                        onPick = onPickAvatar,
                        onClear = onClearAvatar,
                        testTagPrefix = "profile_edit_avatar",
                    ) {
                        CograAvatar(
                            name = state.displayName,
                            size = 72.dp,
                            url = state.avatar.previewUrl,
                            testTag = "profile_edit_avatar_preview",
                        )
                    }
                    ProfileImageRow(
                        label = stringResource(R.string.profile_edit_cover),
                        image = state.cover,
                        name = state.displayName,
                        onPick = onPickCover,
                        onClear = onClearCover,
                        testTagPrefix = "profile_edit_cover",
                    ) {
                        CograCover(
                            url = state.cover.previewUrl,
                            modifier = Modifier.fillMaxWidth(),
                            testTag = "profile_edit_cover_preview",
                        )
                    }
                    OutlinedTextField(
                        value = state.displayName,
                        onValueChange = onDisplayNameChange,
                        label = { Text(stringResource(R.string.profile_edit_display_name)) },
                        singleLine = true,
                        isError = state.emptyName,
                        supportingText = if (state.emptyName) {
                            { Text(stringResource(R.string.profile_edit_empty_name)) }
                        } else {
                            null
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("profile_edit_display_name"),
                    )
                    OutlinedTextField(
                        value = state.bio,
                        onValueChange = onBioChange,
                        label = { Text(stringResource(R.string.profile_edit_bio)) },
                        minLines = 3,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("profile_edit_bio"),
                    )
                    OutlinedTextField(
                        value = state.websiteUrl,
                        onValueChange = onWebsiteChange,
                        label = { Text(stringResource(R.string.profile_edit_website)) },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("profile_edit_website"),
                    )
                    if (state.refused) {
                        Text(
                            text = stringResource(R.string.profile_edit_refused),
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.testTag("profile_edit_refused"),
                        )
                    }
                    if (state.signingFailed) {
                        Text(
                            text = stringResource(R.string.profile_edit_signing_failed),
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.testTag("profile_edit_signing_failed"),
                        )
                    }
                    Button(
                        onClick = onSubmit,
                        // A picture still on its way has no id to name,
                        // so saving would silently drop it.
                        enabled = !state.submitting && !state.imagesPending,
                        modifier = Modifier.testTag("profile_edit_save"),
                    ) {
                        Text(stringResource(R.string.profile_edit_save))
                    }
                }
            }
        }
    }
}

/**
 * One picture with the two things you can do to it: replace it, or go
 * back to the monogram.
 *
 * The clear is a distinct control rather than "pick nothing" because
 * the contract distinguishes the two (D13) and a reader has to be able
 * to say which one they meant.
 */
@Composable
private fun ProfileImageRow(
    label: String,
    image: ProfileImageState,
    name: String,
    onPick: () -> Unit,
    onClear: () -> Unit,
    testTagPrefix: String,
    preview: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(text = label, style = MaterialTheme.typography.labelLarge)
        preview()
        when (image) {
            is ProfileImageState.Picked -> Text(
                text = stringResource(R.string.profile_edit_image_sending),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("${testTagPrefix}_sending"),
            )
            is ProfileImageState.Failed -> Text(
                text = image.message,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.testTag("${testTagPrefix}_failed"),
            )
            else -> Unit
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onPick, modifier = Modifier.testTag("${testTagPrefix}_pick")) {
                Text(stringResource(R.string.profile_edit_image_choose))
            }
            if (image.previewUrl != null) {
                TextButton(onClick = onClear, modifier = Modifier.testTag("${testTagPrefix}_clear")) {
                    Text(stringResource(R.string.profile_edit_image_clear, name.firstOrNull()?.uppercase() ?: "?"))
                }
            }
        }
    }
}
