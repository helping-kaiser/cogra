package com.cogra.feature.auth

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.domain.identity.RestoreResult

@Composable
fun RestoreRoute(
    onRestored: () -> Unit,
    viewModel: RestoreViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.restored) {
        if (state.restored) onRestored()
    }
    RestoreScreen(
        state = state,
        onCodeChange = viewModel::onCodeChange,
        onSubmit = viewModel::onSubmit,
    )
}

@Composable
fun RestoreScreen(
    state: RestoreUiState,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.restore_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
            Text(stringResource(R.string.restore_explainer))
            OutlinedTextField(
                value = state.code,
                onValueChange = onCodeChange,
                label = { Text(stringResource(R.string.restore_code)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("restore_code"),
            )
            when (state.result) {
                is RestoreResult.MalformedCode -> ErrorLine("restore_error", R.string.restore_malformed)
                RestoreResult.WrongCode -> ErrorLine("restore_error", R.string.restore_wrong_code)
                RestoreResult.NoBackup -> ErrorLine("restore_error", R.string.restore_no_backup)
                is RestoreResult.Failed -> ErrorLine("restore_error", R.string.error_transport)
                RestoreResult.Restored, null -> Unit
            }
            if (state.inProgress) {
                CircularProgressIndicator(modifier = Modifier.testTag("restore_progress"))
            }
            Button(
                onClick = onSubmit,
                enabled = state.canSubmit,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("restore_submit"),
            ) {
                Text(stringResource(R.string.restore_submit))
            }
        }
    }
}

@Composable
private fun ErrorLine(tag: String, text: Int) {
    Text(
        text = stringResource(text),
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier.testTag(tag),
    )
}
