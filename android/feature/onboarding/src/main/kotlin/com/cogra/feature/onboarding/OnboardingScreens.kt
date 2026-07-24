// The three onboarding destinations. Stateless screens + thin routes
// (android/CLAUDE.md "Architecture"); semantics land with the UI
// (android.md "Accessibility").

package com.cogra.feature.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.domain.ErrorCode
import com.cogra.domain.signing.RegistrationProgress

// --------------------------------------------------------------------
// Invite entry
// --------------------------------------------------------------------

@Composable
fun InviteEntryRoute(
    deepLinkedInviteId: String?,
    onUsableLink: (String) -> Unit,
    onLogInInstead: () -> Unit,
    viewModel: InviteEntryViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(deepLinkedInviteId) {
        deepLinkedInviteId?.let(viewModel::onDeepLink)
    }
    InviteEntryScreen(
        state = state,
        onInputChange = viewModel::onInputChange,
        onCheck = viewModel::onCheck,
        onContinue = { state.inviteId?.let(onUsableLink) },
        onLogInInstead = onLogInInstead,
    )
}

@Composable
fun InviteEntryScreen(
    state: InviteEntryUiState,
    onInputChange: (String) -> Unit,
    onCheck: () -> Unit,
    onContinue: () -> Unit,
    onLogInInstead: () -> Unit,
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
                text = stringResource(R.string.invite_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
            Text(stringResource(R.string.invite_explainer))
            OutlinedTextField(
                value = state.input,
                onValueChange = onInputChange,
                label = { Text(stringResource(R.string.invite_input)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("invite_input"),
            )
            when {
                state.malformed -> Refusal("invite_error", R.string.invite_malformed)
                state.notFound -> Refusal("invite_error", R.string.invite_not_found)
                state.check?.usable == false -> Refusal("invite_error", R.string.invite_unusable)
                state.transportFailed -> Refusal("invite_error", R.string.error_transport)
            }
            state.check?.takeIf { it.usable }?.let {
                Text(
                    text = stringResource(R.string.invite_vouched_by, it.inviterHandle),
                    modifier = Modifier.testTag("invite_inviter"),
                )
            }
            if (state.inProgress) {
                CircularProgressIndicator(modifier = Modifier.testTag("invite_progress"))
            }
            if (state.canContinue) {
                Button(
                    onClick = onContinue,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("invite_continue"),
                ) {
                    Text(stringResource(R.string.invite_continue))
                }
            } else {
                Button(
                    onClick = onCheck,
                    enabled = state.input.isNotBlank() && !state.inProgress,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("invite_check"),
                ) {
                    Text(stringResource(R.string.invite_check))
                }
            }
            TextButton(onClick = onLogInInstead, modifier = Modifier.testTag("invite_login")) {
                Text(stringResource(R.string.invite_login_instead))
            }
        }
    }
}

// --------------------------------------------------------------------
// Application form + the key/backup step
// --------------------------------------------------------------------

@Composable
fun ApplyRoute(
    inviteId: String,
    onSubmitted: () -> Unit,
    viewModel: ApplyViewModel = hiltViewModel(),
) {
    viewModel.inviteId = inviteId
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.submitted) {
        if (state.submitted) onSubmitted()
    }
    ApplyScreen(
        state = state,
        onHandleChange = viewModel::onHandleChange,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onContinueToBackup = viewModel::onContinueToBackup,
        onAcceptBackup = viewModel::onAcceptBackup,
        onCodeSaved = viewModel::onCodeSaved,
        onDeclineBackup = viewModel::onDeclineBackup,
        onCancelDecline = viewModel::onCancelDecline,
        onConfirmDecline = viewModel::onConfirmDecline,
    )
}

@Composable
fun ApplyScreen(
    state: ApplyUiState,
    onHandleChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onContinueToBackup: () -> Unit,
    onAcceptBackup: () -> Unit,
    onCodeSaved: () -> Unit,
    onDeclineBackup: () -> Unit,
    onCancelDecline: () -> Unit,
    onConfirmDecline: () -> Unit,
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
            when (state.step) {
                ApplyStep.FORM -> FormStep(
                    state, onHandleChange, onEmailChange, onPasswordChange, onContinueToBackup,
                )
                ApplyStep.BACKUP -> BackupStep(
                    state, onAcceptBackup, onCodeSaved, onDeclineBackup,
                )
            }
        }
    }
    if (state.confirmingDecline) {
        AlertDialog(
            onDismissRequest = onCancelDecline,
            title = { Text(stringResource(R.string.backup_decline_title)) },
            text = {
                Text(
                    text = stringResource(R.string.backup_decline_consequence),
                    modifier = Modifier.testTag("backup_decline_consequence"),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = onConfirmDecline,
                    modifier = Modifier.testTag("backup_decline_confirm"),
                ) {
                    Text(stringResource(R.string.backup_decline_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = onCancelDecline, modifier = Modifier.testTag("backup_decline_cancel")) {
                    Text(stringResource(R.string.backup_decline_cancel))
                }
            },
        )
    }
}

@Composable
private fun FormStep(
    state: ApplyUiState,
    onHandleChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onContinue: () -> Unit,
) {
    Text(
        text = stringResource(R.string.apply_title),
        style = MaterialTheme.typography.headlineMedium,
        modifier = Modifier.semantics { heading() },
    )
    OutlinedTextField(
        value = state.handle,
        onValueChange = onHandleChange,
        label = { Text(stringResource(R.string.apply_handle)) },
        supportingText = { Text(stringResource(R.string.apply_handle_rules)) },
        isError = state.errorField == "handle",
        singleLine = true,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("apply_handle"),
    )
    OutlinedTextField(
        value = state.email,
        onValueChange = onEmailChange,
        label = { Text(stringResource(R.string.login_email)) },
        isError = state.errorField == "email",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        singleLine = true,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("apply_email"),
    )
    OutlinedTextField(
        value = state.password,
        onValueChange = onPasswordChange,
        label = { Text(stringResource(R.string.login_password)) },
        supportingText = { Text(stringResource(R.string.apply_password_rules)) },
        isError = state.errorField == "password",
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        singleLine = true,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("apply_password"),
    )
    state.error?.let {
        Text(
            text = stringResource(it.applyMessage()),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("apply_error"),
        )
    }
    if (state.transportFailed) {
        Text(
            text = stringResource(R.string.error_transport),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("apply_transport_error"),
        )
    }
    Button(
        onClick = onContinue,
        enabled = state.formValid && !state.inProgress,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("apply_continue"),
    ) {
        Text(stringResource(R.string.apply_continue))
    }
}

@Composable
private fun BackupStep(
    state: ApplyUiState,
    onAcceptBackup: () -> Unit,
    onCodeSaved: () -> Unit,
    onDeclineBackup: () -> Unit,
) {
    Text(
        text = stringResource(R.string.backup_title),
        style = MaterialTheme.typography.headlineMedium,
        modifier = Modifier.semantics { heading() },
    )
    Text(stringResource(R.string.backup_explainer))
    if (state.inProgress) {
        CircularProgressIndicator(modifier = Modifier.testTag("backup_progress"))
    }
    when (val code = state.recoveryCode) {
        null -> {
            Button(
                onClick = onAcceptBackup,
                enabled = !state.inProgress,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("backup_accept"),
            ) {
                Text(stringResource(R.string.backup_accept))
            }
            OutlinedButton(
                onClick = onDeclineBackup,
                enabled = !state.inProgress,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("backup_decline"),
            ) {
                Text(stringResource(R.string.backup_decline))
            }
        }
        else -> {
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = code,
                    style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Monospace),
                    modifier = Modifier
                        .padding(16.dp)
                        .testTag("backup_code"),
                )
            }
            Text(stringResource(R.string.backup_code_explainer))
            Button(
                onClick = onCodeSaved,
                enabled = !state.inProgress,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("backup_code_saved"),
            ) {
                Text(stringResource(R.string.backup_code_saved))
            }
        }
    }
}

private fun ErrorCode.applyMessage(): Int = when (this) {
    ErrorCode.INVITE_UNUSABLE -> R.string.invite_unusable
    ErrorCode.HANDLE_TAKEN -> R.string.apply_handle_taken
    ErrorCode.WEAK_PASSWORD -> R.string.error_weak_password
    ErrorCode.APPLICATION_IN_PROGRESS -> R.string.apply_in_progress
    ErrorCode.BAD_INPUT -> R.string.apply_bad_input
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}

// --------------------------------------------------------------------
// Status: verify, wait, sign, land
// --------------------------------------------------------------------

@Composable
fun StatusRoute(viewModel: StatusViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    StatusScreen(
        state = state,
        onTokenChange = viewModel::onTokenChange,
        onVerify = viewModel::onVerify,
        onResendEmailChange = viewModel::onResendEmailChange,
        onResend = viewModel::onResend,
    )
}

@Composable
fun StatusScreen(
    state: StatusUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
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
            Text(
                text = stringResource(R.string.status_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
            when (val progress = state.progress) {
                null -> CircularProgressIndicator(modifier = Modifier.testTag("status_loading"))
                RegistrationProgress.AwaitingEmailVerification -> VerifyBlock(
                    state, onTokenChange, onVerify, onResendEmailChange, onResend,
                )
                RegistrationProgress.AwaitingApproval -> StatusLine("status_waiting", R.string.status_awaiting_approval)
                RegistrationProgress.AwaitingLanding -> StatusLine("status_landing", R.string.status_awaiting_landing)
                is RegistrationProgress.SessionClaimed -> StatusLine("status_claimed", R.string.status_claimed)
                RegistrationProgress.ApplicationGone -> StatusLine("status_gone", R.string.status_gone)
                RegistrationProgress.NoApplication -> StatusLine("status_gone", R.string.status_gone)
                is RegistrationProgress.RejectedByDevice -> StatusLine("status_rejected", R.string.status_rejected)
                is RegistrationProgress.Refused -> StatusLine("status_refused", R.string.error_generic)
                is RegistrationProgress.Failed -> StatusLine("status_offline", R.string.error_transport)
            }
        }
    }
}

@Composable
private fun VerifyBlock(
    state: StatusUiState,
    onTokenChange: (String) -> Unit,
    onVerify: () -> Unit,
    onResendEmailChange: (String) -> Unit,
    onResend: () -> Unit,
) {
    Text(
        text = stringResource(R.string.verify_explainer),
        modifier = Modifier.testTag("status_verify"),
    )
    OutlinedTextField(
        value = state.verificationToken,
        onValueChange = onTokenChange,
        label = { Text(stringResource(R.string.verify_token)) },
        singleLine = true,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("verify_token"),
    )
    if (state.verifyFailed) {
        Refusal("verify_error", R.string.verify_failed)
    }
    Button(
        onClick = onVerify,
        enabled = state.verificationToken.isNotBlank() && !state.verifying,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("verify_submit"),
    ) {
        Text(stringResource(R.string.verify_submit))
    }
    OutlinedTextField(
        value = state.resendEmail,
        onValueChange = onResendEmailChange,
        label = { Text(stringResource(R.string.login_email)) },
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
        Text(stringResource(R.string.verify_resend))
    }
    if (state.resent) {
        Text(
            text = stringResource(R.string.verify_resent),
            modifier = Modifier.testTag("verify_resent"),
        )
    }
}

@Composable
private fun StatusLine(tag: String, text: Int) {
    Text(text = stringResource(text), modifier = Modifier.testTag(tag))
}

@Composable
private fun Refusal(tag: String, text: Int) {
    Text(
        text = stringResource(text),
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier.testTag(tag),
    )
}
