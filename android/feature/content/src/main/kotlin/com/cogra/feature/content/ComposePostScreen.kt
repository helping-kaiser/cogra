package com.cogra.feature.content

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
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ErrorLine
import com.cogra.domain.OversightChoice
import com.cogra.feature.content.R

@Composable
fun ComposePostRoute(
    postId: String?,
    onSaved: () -> Unit,
    onBack: () -> Unit,
    viewModel: ComposePostViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    if (state.saved) {
        viewModel.onSavedConsumed()
        onSaved()
    }
    ComposePostScreen(
        state = state,
        onTitleChange = viewModel::onTitleChange,
        onDescriptionChange = viewModel::onDescriptionChange,
        onBodyChange = viewModel::onBodyChange,
        onAttributionChange = viewModel::onAttributionChange,
        onOversightChange = viewModel::onOversightChange,
        onSubmit = viewModel::onSubmit,
        onBack = onBack,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComposePostScreen(
    state: ComposePostUiState,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onBodyChange: (String) -> Unit,
    onAttributionChange: (Boolean) -> Unit,
    onOversightChange: (OversightChoice) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
) {
    val editing = state.editingId != null
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(
                            if (editing) R.string.content_compose_edit_title
                            else R.string.content_compose_title,
                        ),
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("compose_back")) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.content_back),
                        )
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.loading) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .testTag("compose_loading"),
                )
                return@Column
            }
            if (state.notFound) {
                ErrorLine(R.string.content_error_not_found, "compose_not_found")
                return@Column
            }
            OutlinedTextField(
                value = state.title,
                onValueChange = onTitleChange,
                label = { Text(stringResource(R.string.content_field_title)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_title"),
            )
            OutlinedTextField(
                value = state.description,
                onValueChange = onDescriptionChange,
                label = { Text(stringResource(R.string.content_field_description)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_description"),
            )
            OutlinedTextField(
                value = state.body,
                onValueChange = onBodyChange,
                label = { Text(stringResource(R.string.content_field_body)) },
                minLines = 6,
                isError = state.emptyBody,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_body"),
            )
            if (state.emptyBody) {
                ErrorLine(R.string.content_error_empty_body, "compose_empty_body")
            }
            // License qualifiers are genesis-only and immutable
            // (post.md §4) — the edit form carries none.
            if (!editing) {
                LicenseControls(
                    attributionRequired = state.attributionRequired,
                    oversight = state.oversight,
                    onAttributionChange = onAttributionChange,
                    onOversightChange = onOversightChange,
                )
            }
            if (state.refused) {
                ErrorLine(R.string.content_error_refused, "compose_refused")
            }
            if (state.signingFailed) {
                ErrorLine(
                    if (state.signingNeedsKey) {
                        R.string.content_error_signing_no_key
                    } else {
                        R.string.content_error_signing
                    },
                    "compose_signing_failed",
                )
            }
            if (state.transportFailed) {
                ErrorLine(R.string.content_error_transport, "compose_transport_error")
            }
            Button(
                onClick = onSubmit,
                enabled = !state.submitting,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_submit"),
            ) {
                Text(
                    stringResource(
                        if (editing) R.string.content_save_edit else R.string.content_submit,
                    ),
                )
            }
        }
    }
}

/** The mandatory authoring-time license declaration (guidelines §5). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LicenseControls(
    attributionRequired: Boolean,
    oversight: OversightChoice,
    onAttributionChange: (Boolean) -> Unit,
    onOversightChange: (OversightChoice) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.content_license_heading),
            style = MaterialTheme.typography.titleSmall,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(stringResource(R.string.content_license_attribution))
            Switch(
                checked = attributionRequired,
                onCheckedChange = onAttributionChange,
                modifier = Modifier.testTag("license_attribution"),
            )
        }
        val options = listOf(
            OversightChoice.NONE to R.string.content_license_oversight_none,
            OversightChoice.CONDITIONAL to R.string.content_license_oversight_conditional,
            OversightChoice.FULL to R.string.content_license_oversight_full,
        )
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, (choice, label) ->
                SegmentedButton(
                    selected = oversight == choice,
                    onClick = { onOversightChange(choice) },
                    shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
                    modifier = Modifier.testTag("license_oversight_${choice.name.lowercase()}"),
                ) {
                    Text(stringResource(label))
                }
            }
        }
    }
}
