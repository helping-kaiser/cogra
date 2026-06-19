package com.cogra.feature.auth.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun EditProfileRoute(
    onSaved: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: EditProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    // A successful save navigates back; the profile destination reads the
    // result and confirms. This VM is NavBackStackEntry-scoped, so `saved`
    // starts false on every visit and can't re-fire a stale pop.
    LaunchedEffect(state.saved) {
        if (state.saved) onSaved()
    }
    EditProfileScreen(
        state = state,
        onHandleChange = viewModel::onHandleChange,
        onDisplayNameChange = viewModel::onDisplayNameChange,
        onBioChange = viewModel::onBioChange,
        onWebsiteUrlChange = viewModel::onWebsiteUrlChange,
        onSave = viewModel::onSave,
        onCancel = onCancel,
        onRetry = viewModel::load,
        modifier = modifier,
    )
}

@Composable
fun EditProfileScreen(
    state: EditProfileUiState,
    onHandleChange: (String) -> Unit,
    onDisplayNameChange: (String) -> Unit,
    onBioChange: (String) -> Unit,
    onWebsiteUrlChange: (String) -> Unit,
    onSave: () -> Unit,
    onCancel: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when {
            state.isLoading -> CircularProgressIndicator(
                modifier = Modifier.testTag(EditProfileTestTags.PROGRESS),
            )

            state.loadError -> LoadError(onRetry = onRetry)

            else -> EditForm(
                state = state,
                onHandleChange = onHandleChange,
                onDisplayNameChange = onDisplayNameChange,
                onBioChange = onBioChange,
                onWebsiteUrlChange = onWebsiteUrlChange,
                onSave = onSave,
                onCancel = onCancel,
            )
        }
    }
}

@Composable
private fun EditForm(
    state: EditProfileUiState,
    onHandleChange: (String) -> Unit,
    onDisplayNameChange: (String) -> Unit,
    onBioChange: (String) -> Unit,
    onWebsiteUrlChange: (String) -> Unit,
    onSave: () -> Unit,
    onCancel: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(text = "Edit profile", style = MaterialTheme.typography.headlineMedium)

        OutlinedTextField(
            value = state.displayName,
            onValueChange = onDisplayNameChange,
            label = { Text("Display name") },
            singleLine = true,
            enabled = !state.isSubmitting,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(EditProfileTestTags.DISPLAY_NAME),
        )
        OutlinedTextField(
            value = state.handle,
            onValueChange = onHandleChange,
            label = { Text("Handle") },
            prefix = { Text("@") },
            singleLine = true,
            enabled = !state.isSubmitting,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(EditProfileTestTags.HANDLE),
        )
        OutlinedTextField(
            value = state.bio,
            onValueChange = onBioChange,
            label = { Text("Bio") },
            minLines = 3,
            enabled = !state.isSubmitting,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(EditProfileTestTags.BIO),
        )
        OutlinedTextField(
            value = state.websiteUrl,
            onValueChange = onWebsiteUrlChange,
            label = { Text("Website") },
            singleLine = true,
            enabled = !state.isSubmitting,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(EditProfileTestTags.WEBSITE),
        )

        if (state.errorMessage != null) {
            Text(
                text = state.errorMessage,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.testTag(EditProfileTestTags.ERROR),
            )
        }

        Button(
            onClick = onSave,
            enabled = state.canSave,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(EditProfileTestTags.SAVE),
        ) {
            if (state.isSubmitting) {
                CircularProgressIndicator(modifier = Modifier.testTag(EditProfileTestTags.PROGRESS))
            } else {
                Text("Save")
            }
        }
        TextButton(
            onClick = onCancel,
            enabled = !state.isSubmitting,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(EditProfileTestTags.CANCEL),
        ) {
            Text("Cancel")
        }
    }
}

@Composable
private fun LoadError(onRetry: () -> Unit) {
    Column(
        modifier = Modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Couldn't load your profile.",
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag(EditProfileTestTags.ERROR),
        )
        Button(onClick = onRetry, modifier = Modifier.testTag(EditProfileTestTags.RETRY)) {
            Text("Retry")
        }
    }
}

/** Stable tags for UI tests, so they don't bind to display copy. */
object EditProfileTestTags {
    const val DISPLAY_NAME = "edit_profile_display_name"
    const val HANDLE = "edit_profile_handle"
    const val BIO = "edit_profile_bio"
    const val WEBSITE = "edit_profile_website"
    const val SAVE = "edit_profile_save"
    const val CANCEL = "edit_profile_cancel"
    const val ERROR = "edit_profile_error"
    const val PROGRESS = "edit_profile_progress"
    const val RETRY = "edit_profile_retry"
}
