package com.cogra.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.domain.signing.RegistrationProgress

@Composable
fun HomeRoute(
    actorRestoredResult: Boolean,
    onActorRestoredResultConsumed: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenSettings: () -> Unit,
    onRestoreActor: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(actorRestoredResult) {
        if (actorRestoredResult) {
            onActorRestoredResultConsumed()
            viewModel.onActorRestored()
        }
    }
    HomeScreen(
        state = state,
        onTokenChange = viewModel::onTokenChange,
        onVerify = viewModel::onVerify,
        onResendEmailChange = viewModel::onResendEmailChange,
        onResend = viewModel::onResend,
        onDismissWaitingHint = viewModel::onDismissWaitingHint,
        onApprovedShown = viewModel::onApprovedShown,
        onWelcomeShown = viewModel::onWelcomeShown,
        onPDirectedChange = viewModel::onPDirectedChange,
        onPInterestChange = viewModel::onPInterestChange,
        onReciprocate = viewModel::onReciprocate,
        onDismissReciprocation = viewModel::onDismissReciprocation,
        onResumePending = viewModel::onResumePending,
        onActorRestoredShown = viewModel::onActorRestoredShown,
        onOpenInvites = onOpenInvites,
        onOpenSettings = onOpenSettings,
        onRestoreActor = onRestoreActor,
    )
}

@Composable
fun HomeScreen(
    state: HomeUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
    onDismissWaitingHint: () -> Unit,
    onApprovedShown: () -> Unit,
    onWelcomeShown: () -> Unit,
    onPDirectedChange: (Double) -> Unit,
    onPInterestChange: (Double) -> Unit,
    onReciprocate: () -> Unit,
    onDismissReciprocation: () -> Unit,
    onResumePending: () -> Unit,
    onActorRestoredShown: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenSettings: () -> Unit,
    onRestoreActor: () -> Unit,
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val restoredMessage = stringResource(R.string.home_actor_restored)
    // Consumed only after the snackbar is done: clearing first would
    // flip the LaunchedEffect key and cancel the showing coroutine.
    LaunchedEffect(state.actorRestored) {
        if (state.actorRestored) {
            snackbarHostState.showSnackbar(restoredMessage)
            onActorRestoredShown()
        }
    }
    val approvedMessage = stringResource(R.string.home_approved)
    LaunchedEffect(state.approved) {
        if (state.approved) {
            snackbarHostState.showSnackbar(approvedMessage)
            onApprovedShown()
        }
    }
    val welcomeMessage = stringResource(R.string.home_welcome)
    LaunchedEffect(state.welcome) {
        if (state.welcome) {
            snackbarHostState.showSnackbar(welcomeMessage)
            onWelcomeShown()
        }
    }
    Scaffold(
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data ->
                Snackbar(snackbarData = data, modifier = Modifier.testTag("home_snackbar"))
            }
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
            if (state.applicant) {
                ApplicantStatus(
                    state = state,
                    onTokenChange = onTokenChange,
                    onVerify = onVerify,
                    onResendEmailChange = onResendEmailChange,
                    onResend = onResend,
                    onDismissWaitingHint = onDismissWaitingHint,
                )
                return@Column
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

/**
 * The application riding along in the shell (auth.md "Application"): a
 * staged applicant already browses; these cards are the only trace of
 * the flow — the actionable verification, then a dismissible waiting
 * hint, then the landing status — never a wall.
 */
@Composable
private fun ApplicantStatus(
    state: HomeUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
    onDismissWaitingHint: () -> Unit,
) {
    when (state.progress) {
        null -> CircularProgressIndicator(modifier = Modifier.testTag("home_status_loading"))
        RegistrationProgress.AwaitingEmailVerification -> VerifyCard(
            state, onTokenChange, onVerify, onResendEmailChange, onResend,
        )
        RegistrationProgress.AwaitingApproval ->
            if (!state.waitingHintDismissed) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = stringResource(R.string.home_waiting_title),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.testTag("home_waiting"),
                        )
                        Text(stringResource(R.string.home_waiting_body))
                        TextButton(
                            onClick = onDismissWaitingHint,
                            modifier = Modifier.testTag("home_waiting_dismiss"),
                        ) {
                            Text(stringResource(R.string.home_waiting_dismiss))
                        }
                    }
                }
            }
        RegistrationProgress.AwaitingLanding ->
            Text(
                text = stringResource(R.string.home_approved),
                modifier = Modifier.testTag("home_landing"),
            )
        is RegistrationProgress.SessionClaimed ->
            // Momentary: the claim flips the token store and navigation
            // recreates Home in its member shape.
            Text(
                text = stringResource(R.string.home_welcome),
                modifier = Modifier.testTag("home_claimed"),
            )
        RegistrationProgress.ApplicationGone, RegistrationProgress.NoApplication ->
            ApplicantError("home_application_gone", R.string.home_application_gone)
        is RegistrationProgress.RejectedByDevice ->
            ApplicantError("home_application_rejected", R.string.home_application_rejected)
        is RegistrationProgress.Refused ->
            ApplicantError("home_application_refused", R.string.error_generic)
        is RegistrationProgress.Failed ->
            ApplicantError("home_application_offline", R.string.error_transport)
    }
}

@Composable
private fun VerifyCard(
    state: HomeUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_verify_explainer),
                modifier = Modifier.testTag("home_verify"),
            )
            OutlinedTextField(
                value = state.verificationToken,
                onValueChange = onTokenChange,
                label = { Text(stringResource(R.string.home_verify_token)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("verify_token"),
            )
            if (state.verifyFailed) {
                ApplicantError("verify_error", R.string.home_verify_failed)
            }
            Button(
                onClick = onVerify,
                enabled = state.verificationToken.isNotBlank() && !state.verifying,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("verify_submit"),
            ) {
                Text(stringResource(R.string.home_verify_submit))
            }
            OutlinedTextField(
                value = state.resendEmail,
                onValueChange = onResendEmailChange,
                label = { Text(stringResource(R.string.home_verify_email)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("resend_email"),
            )
            TextButton(
                onClick = onResend,
                enabled = state.resendEmail.isNotBlank(),
                modifier = Modifier.testTag("verify_resend"),
            ) {
                Text(stringResource(R.string.home_verify_resend))
            }
            if (state.resent) {
                Text(
                    text = stringResource(R.string.home_verify_resent),
                    modifier = Modifier.testTag("verify_resent"),
                )
            }
        }
    }
}

@Composable
private fun ApplicantError(tag: String, text: Int) {
    Text(
        text = stringResource(text),
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier.testTag(tag),
    )
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
