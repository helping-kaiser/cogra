package com.cogra.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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

@Composable
fun ProfileEditRoute(
    onSaved: () -> Unit,
    onBack: () -> Unit,
    viewModel: ProfileEditViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    if (state.saved) {
        viewModel.onSavedConsumed()
        onSaved()
    }
    ProfileEditScreen(
        state = state,
        onDisplayNameChange = viewModel::onDisplayNameChange,
        onBioChange = viewModel::onBioChange,
        onWebsiteChange = viewModel::onWebsiteChange,
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
                        enabled = !state.submitting,
                        modifier = Modifier.testTag("profile_edit_save"),
                    ) {
                        Text(stringResource(R.string.profile_edit_save))
                    }
                }
            }
        }
    }
}
