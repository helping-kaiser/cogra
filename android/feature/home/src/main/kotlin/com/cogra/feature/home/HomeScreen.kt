package com.cogra.feature.home

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.domain.ErrorCode
import com.cogra.domain.signing.RegistrationProgress
import kotlinx.coroutines.launch

@Composable
fun HomeRoute(
    actorRestoredResult: Boolean,
    onActorRestoredResultConsumed: () -> Unit,
    handleChangedResult: Boolean,
    onHandleChangedResultConsumed: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenSettings: () -> Unit,
    onRestoreActor: () -> Unit,
    onStartKeyCeremony: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(actorRestoredResult) {
        if (actorRestoredResult) {
            onActorRestoredResultConsumed()
            viewModel.onActorRestored()
        }
    }
    // Settings already confirmed the change; here the stale greeting
    // just gets re-read, silently.
    LaunchedEffect(handleChangedResult) {
        if (handleChangedResult) {
            onHandleChangedResultConsumed()
            viewModel.refresh()
        }
    }
    HomeScreen(
        state = state,
        onPullRefresh = viewModel::onPullRefresh,
        onTokenChange = viewModel::onTokenChange,
        onVerify = viewModel::onVerify,
        onResendEmailChange = viewModel::onResendEmailChange,
        onResend = viewModel::onResend,
        onRearmInputChange = viewModel::onRearmInputChange,
        onRearm = viewModel::onRearm,
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
        onStartKeyCeremony = onStartKeyCeremony,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    state: HomeUiState,
    onPullRefresh: () -> Unit,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
    onRearmInputChange: (String) -> Unit,
    onRearm: () -> Unit,
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
    onStartKeyCeremony: () -> Unit,
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
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
        PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = onPullRefresh,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("home_refresh"),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
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
                        onRearmInputChange = onRearmInputChange,
                        onRearm = onRearm,
                        onDismissWaitingHint = onDismissWaitingHint,
                        onStartKeyCeremony = onStartKeyCeremony,
                        onRestoreActor = onRestoreActor,
                    )
                } else {
                    if (state.huskWarning) {
                        RestoreCard(onRestoreActor)
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
                }
                val invitesLockedMessage = stringResource(R.string.home_invites_locked_message)
                InvitesButton(
                    locked = state.applicant,
                    onOpen = onOpenInvites,
                    onLockedTap = { scope.launch { snackbarHostState.showSnackbar(invitesLockedMessage) } },
                )
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
}

/**
 * Acting is gated for applicants, but the surface stays visible (auth.md
 * "Application"): the locked look borrows the M3 disabled tokens (38%
 * content, 12% outline) while the button stays tappable, so a tap can
 * explain the lock instead of dying silently.
 */
@Composable
private fun InvitesButton(locked: Boolean, onOpen: () -> Unit, onLockedTap: () -> Unit) {
    val lockedState = stringResource(R.string.home_invites_locked)
    OutlinedButton(
        onClick = if (locked) onLockedTap else onOpen,
        colors = if (locked) {
            ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f),
            )
        } else {
            ButtonDefaults.outlinedButtonColors()
        },
        border = if (locked) {
            BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f))
        } else {
            ButtonDefaults.outlinedButtonBorder(enabled = true)
        },
        modifier = Modifier
            .fillMaxWidth()
            .testTag("home_invites")
            .then(
                if (locked) Modifier.semantics { stateDescription = lockedState } else Modifier,
            ),
    ) {
        Text(stringResource(R.string.home_open_invites))
    }
}

/**
 * The application riding along in the shell (auth.md "Application"): an
 * applicant already browses; these cards are the only trace of the flow
 * — the actionable proofs (email, key), then a dismissible waiting
 * hint, then the landing status — never a wall.
 */
@Composable
private fun ApplicantStatus(
    state: HomeUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
    onRearmInputChange: (String) -> Unit,
    onRearm: () -> Unit,
    onDismissWaitingHint: () -> Unit,
    onStartKeyCeremony: () -> Unit,
    onRestoreActor: () -> Unit,
) {
    when (val progress = state.progress) {
        null -> CircularProgressIndicator(modifier = Modifier.testTag("home_status_loading"))
        is RegistrationProgress.AwaitingApproval -> {
            if (!progress.emailVerified) {
                VerifyCard(state, onTokenChange, onVerify, onResendEmailChange, onResend)
            }
            when {
                // The two proofs are independent — both cards can show.
                !progress.keyAttached && !progress.keyOnDevice -> CeremonyCard(onStartKeyCeremony)
                // A key sits on the device but the attach was refused —
                // it belongs to another account (ACTOR_KEY_IN_USE).
                !progress.keyAttached && progress.keyOnDevice -> KeyElsewhereCard(onStartKeyCeremony)
                progress.keyAttached && !progress.keyOnDevice -> RestoreCard(onRestoreActor)
                else -> if (progress.emailVerified && !state.waitingHintDismissed) {
                    WaitingHint(onDismissWaitingHint)
                }
            }
        }
        RegistrationProgress.AwaitingLanding ->
            Text(
                text = stringResource(R.string.home_approved),
                modifier = Modifier.testTag("home_landing"),
            )
        RegistrationProgress.AwaitingSigningKey -> RestoreCard(onRestoreActor)
        RegistrationProgress.NeedsInvite -> RearmCard(state, onRearmInputChange, onRearm)
        RegistrationProgress.Member ->
            // Momentary: the refresh re-reads the member shape.
            Text(
                text = stringResource(R.string.home_welcome),
                modifier = Modifier.testTag("home_landed"),
            )
        is RegistrationProgress.RejectedByDevice ->
            ApplicantError("home_application_rejected", R.string.home_application_rejected)
        is RegistrationProgress.Refused ->
            ApplicantError("home_application_refused", R.string.error_generic)
        is RegistrationProgress.Failed ->
            ApplicantError("home_application_offline", R.string.error_transport)
    }
}

@Composable
private fun WaitingHint(onDismiss: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_waiting_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("home_waiting"),
            )
            Text(stringResource(R.string.home_waiting_body))
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("home_waiting_dismiss"),
            ) {
                Text(stringResource(R.string.home_waiting_dismiss))
            }
        }
    }
}

/** The key proof: mint and attach on this device (auth.md step 3). */
@Composable
private fun CeremonyCard(onStartKeyCeremony: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_create_key_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(stringResource(R.string.home_create_key_body))
            Button(
                onClick = onStartKeyCeremony,
                modifier = Modifier.testTag("home_create_key"),
            ) {
                Text(stringResource(R.string.home_create_key_button))
            }
        }
    }
}

/**
 * The device's key backs another account, so this account needs its own
 * — the ceremony's fresh mint replaces the stored key (the other
 * account's stays restorable with its recovery code).
 */
@Composable
private fun KeyElsewhereCard(onStartKeyCeremony: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_key_elsewhere_title),
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = stringResource(R.string.home_key_elsewhere_body),
                modifier = Modifier.testTag("home_key_elsewhere"),
            )
            Button(
                onClick = onStartKeyCeremony,
                modifier = Modifier.testTag("home_fresh_key"),
            ) {
                Text(stringResource(R.string.home_key_elsewhere_button))
            }
        }
    }
}

/** The actor key lives elsewhere — restore brings it to this device. */
@Composable
private fun RestoreCard(onRestoreActor: () -> Unit) {
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

/** A dead application re-arms with a fresh invite (auth.md "Expiry"). */
@Composable
private fun RearmCard(
    state: HomeUiState,
    onRearmInputChange: (String) -> Unit,
    onRearm: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.home_rearm_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("home_rearm"),
            )
            Text(stringResource(R.string.home_rearm_body))
            OutlinedTextField(
                value = state.rearmInput,
                onValueChange = onRearmInputChange,
                label = { Text(stringResource(R.string.home_rearm_input)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("rearm_input"),
            )
            when {
                state.rearmMalformed -> ApplicantError("rearm_error", R.string.home_rearm_invalid)
                state.rearmError != null -> ApplicantError("rearm_error", state.rearmError.rearmMessage())
            }
            Button(
                onClick = onRearm,
                enabled = state.rearmInput.isNotBlank() && !state.rearming,
                modifier = Modifier.testTag("rearm_submit"),
            ) {
                Text(stringResource(R.string.home_rearm_submit))
            }
        }
    }
}

private fun ErrorCode.rearmMessage(): Int = when (this) {
    ErrorCode.INVITE_UNUSABLE -> R.string.home_rearm_unusable
    ErrorCode.BAD_INPUT -> R.string.home_rearm_live
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
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
            state.verifyError?.let {
                ApplicantError("verify_error", it.verifyMessage())
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
            state.resendError?.let {
                ApplicantError("resend_error", it.resendMessage())
            }
        }
    }
}

private fun ErrorCode.verifyMessage(): Int = when (this) {
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.home_verify_failed
}

private fun ErrorCode.resendMessage(): Int = when (this) {
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
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
