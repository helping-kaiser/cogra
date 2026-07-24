package com.cogra.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun HomeRoute(
    onOpenInvites: () -> Unit,
    onOpenSettings: () -> Unit,
    onRestoreActor: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeScreen(
        state = state,
        onPDirectedChange = viewModel::onPDirectedChange,
        onPInterestChange = viewModel::onPInterestChange,
        onReciprocate = viewModel::onReciprocate,
        onDismissReciprocation = viewModel::onDismissReciprocation,
        onResumePending = viewModel::onResumePending,
        onOpenInvites = onOpenInvites,
        onOpenSettings = onOpenSettings,
        onRestoreActor = onRestoreActor,
    )
}

@Composable
fun HomeScreen(
    state: HomeUiState,
    onPDirectedChange: (Double) -> Unit,
    onPInterestChange: (Double) -> Unit,
    onReciprocate: () -> Unit,
    onDismissReciprocation: () -> Unit,
    onResumePending: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenSettings: () -> Unit,
    onRestoreActor: () -> Unit,
) {
    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (state.loading) {
                CircularProgressIndicator(modifier = Modifier.testTag("home_loading"))
                return@Column
            }
            Text(
                text = state.profile?.let { stringResource(R.string.home_greeting, it.handle) }
                    ?: stringResource(R.string.home_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier
                    .semantics { heading() }
                    .testTag("home_greeting"),
            )
            if (state.transportFailed) {
                Text(
                    text = stringResource(R.string.error_transport),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("home_transport_error"),
                )
            }
            if (state.huskWarning) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = stringResource(R.string.home_husk_title),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(stringResource(R.string.home_husk_body))
                        Button(
                            onClick = onRestoreActor,
                            modifier = Modifier.testTag("home_restore"),
                        ) {
                            Text(stringResource(R.string.home_husk_restore))
                        }
                    }
                }
            }
            state.reciprocationTarget?.let { inviter ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = stringResource(R.string.home_reciprocate_title, inviter.handle),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.testTag("home_reciprocation"),
                        )
                        Text(stringResource(R.string.home_reciprocate_body))
                        LabeledSlider(
                            label = stringResource(R.string.stance_p_directed),
                            value = state.pDirected,
                            onChange = onPDirectedChange,
                            tag = "home_p_directed",
                        )
                        LabeledSlider(
                            label = stringResource(R.string.stance_p_interest),
                            value = state.pInterest,
                            onChange = onPInterestChange,
                            tag = "home_p_interest",
                        )
                        if (state.signingFailed) {
                            Text(
                                text = stringResource(R.string.home_signing_failed),
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.testTag("home_signing_failed"),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = onReciprocate,
                                enabled = !state.signing,
                                modifier = Modifier.testTag("home_reciprocate"),
                            ) {
                                Text(stringResource(R.string.home_reciprocate_sign))
                            }
                            TextButton(
                                onClick = onDismissReciprocation,
                                modifier = Modifier.testTag("home_reciprocate_skip"),
                            ) {
                                Text(stringResource(R.string.home_reciprocate_skip))
                            }
                        }
                    }
                }
            }
            if (state.reciprocated) {
                Text(
                    text = stringResource(R.string.home_reciprocated),
                    modifier = Modifier.testTag("home_reciprocated"),
                )
            }
            if (state.pendingHandshakes > 0) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            stringResource(R.string.home_pending, state.pendingHandshakes),
                            modifier = Modifier.testTag("home_pending"),
                        )
                        OutlinedButton(
                            onClick = onResumePending,
                            modifier = Modifier.testTag("home_resume"),
                        ) {
                            Text(stringResource(R.string.home_resume))
                        }
                    }
                }
            }
            OutlinedButton(
                onClick = onOpenInvites,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("home_invites"),
            ) {
                Text(stringResource(R.string.home_open_invites))
            }
            OutlinedButton(
                onClick = onOpenSettings,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("home_settings"),
            ) {
                Text(stringResource(R.string.home_open_settings))
            }
        }
    }
}

/** A stance dimension slider over [-1, +1], labeled for TalkBack. */
@Composable
fun LabeledSlider(label: String, value: Double, onChange: (Double) -> Unit, tag: String) {
    Column {
        Text("$label: ${"%.2f".format(value)}")
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toDouble()) },
            valueRange = -1f..1f,
            modifier = Modifier
                .testTag(tag)
                .semantics { contentDescription = label },
        )
    }
}
