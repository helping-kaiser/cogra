package com.cogra.feature.settings

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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.PasswordTextField
import com.cogra.domain.ErrorCode

@Composable
fun SettingsRoute(
    onHandleChanged: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    // The nav result rides the moment the change lands — independent of
    // the snackbar's own consumption of the same one-shot.
    LaunchedEffect(state.feedback) {
        if ((state.feedback as? SettingsFeedback.Done)?.action == SettingsAction.HANDLE_CHANGED) {
            onHandleChanged()
        }
    }
    SettingsScreen(
        state = state,
        onCreateBackup = viewModel::onCreateBackup,
        onBackupCodeSaved = viewModel::onBackupCodeSaved,
        onRevokeSession = viewModel::onRevokeSession,
        onRevokeOthers = viewModel::onRevokeOthers,
        onCurrentPasswordChange = viewModel::onCurrentPasswordChange,
        onNewPasswordChange = viewModel::onNewPasswordChange,
        onChangePassword = viewModel::onChangePassword,
        onNewHandleChange = viewModel::onNewHandleChange,
        onChangeHandle = viewModel::onChangeHandle,
        onNewEmailChange = viewModel::onNewEmailChange,
        onEmailChangePasswordChange = viewModel::onEmailChangePasswordChange,
        onRequestEmailChange = viewModel::onRequestEmailChange,
        onEmailChangeCodeChange = viewModel::onEmailChangeCodeChange,
        onConfirmEmailChange = viewModel::onConfirmEmailChange,
        onFeedbackShown = viewModel::onFeedbackShown,
        onSignOut = viewModel::onSignOut,
    )
}

@Composable
fun SettingsScreen(
    state: SettingsUiState,
    onCreateBackup: () -> Unit,
    onBackupCodeSaved: () -> Unit,
    onRevokeSession: (String) -> Unit,
    onRevokeOthers: () -> Unit,
    onCurrentPasswordChange: (String) -> Unit,
    onNewPasswordChange: (String) -> Unit,
    onChangePassword: () -> Unit,
    onNewHandleChange: (String) -> Unit,
    onChangeHandle: () -> Unit,
    onNewEmailChange: (String) -> Unit,
    onEmailChangePasswordChange: (String) -> Unit,
    onRequestEmailChange: () -> Unit,
    onEmailChangeCodeChange: (String) -> Unit,
    onConfirmEmailChange: () -> Unit,
    onFeedbackShown: () -> Unit,
    onSignOut: () -> Unit,
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val feedbackMessage = state.feedback?.let { stringResource(it.message()) }
    // Consumed only after the snackbar is done: clearing first would
    // flip the LaunchedEffect key and cancel the showing coroutine.
    LaunchedEffect(state.feedback) {
        if (feedbackMessage != null) {
            snackbarHostState.showSnackbar(feedbackMessage)
            onFeedbackShown()
        }
    }
    Scaffold(
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data ->
                Snackbar(snackbarData = data, modifier = Modifier.testTag("settings_snackbar"))
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
            Text(
                text = stringResource(R.string.settings_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
            BackupSection(state, onCreateBackup, onBackupCodeSaved)
            SessionsSection(state, onRevokeSession, onRevokeOthers)
            CredentialsSection(
                state,
                onCurrentPasswordChange, onNewPasswordChange, onChangePassword,
                onNewHandleChange, onChangeHandle,
                onNewEmailChange, onEmailChangePasswordChange, onRequestEmailChange,
                onEmailChangeCodeChange, onConfirmEmailChange,
            )

            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("settings_sign_out"),
            ) {
                Text(stringResource(R.string.settings_sign_out))
            }
        }
    }
}

@Composable
private fun BackupSection(
    state: SettingsUiState,
    onCreateBackup: () -> Unit,
    onBackupCodeSaved: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.settings_backup_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() },
            )
            when (val code = state.newBackupCode) {
                null -> {
                    Text(
                        stringResource(
                            if (state.actorPresent) R.string.settings_backup_body
                            else R.string.settings_backup_no_actor,
                        ),
                    )
                    Button(
                        onClick = onCreateBackup,
                        enabled = state.actorPresent && !state.busy,
                        modifier = Modifier.testTag("settings_backup_create"),
                    ) {
                        Text(stringResource(R.string.settings_backup_create))
                    }
                }
                else -> {
                    Text(
                        text = code,
                        style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Monospace),
                        modifier = Modifier.testTag("settings_backup_code"),
                    )
                    Text(stringResource(R.string.settings_backup_code_explainer))
                    Button(
                        onClick = onBackupCodeSaved,
                        modifier = Modifier.testTag("settings_backup_saved"),
                    ) {
                        Text(stringResource(R.string.settings_backup_saved))
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionsSection(
    state: SettingsUiState,
    onRevokeSession: (String) -> Unit,
    onRevokeOthers: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.settings_sessions_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() },
            )
            state.sessions.forEach { session ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = (session.deviceLabel ?: stringResource(R.string.settings_session_unnamed)) +
                            if (session.isCurrent) stringResource(R.string.settings_session_current) else "",
                        modifier = Modifier.testTag("session_${session.id}"),
                    )
                    if (!session.isCurrent) {
                        TextButton(
                            onClick = { onRevokeSession(session.id) },
                            modifier = Modifier.testTag("revoke_${session.id}"),
                        ) {
                            Text(stringResource(R.string.settings_session_revoke))
                        }
                    }
                }
            }
            OutlinedButton(
                onClick = onRevokeOthers,
                enabled = !state.busy,
                modifier = Modifier.testTag("settings_revoke_others"),
            ) {
                Text(stringResource(R.string.settings_revoke_others))
            }
        }
    }
}

@Composable
private fun CredentialsSection(
    state: SettingsUiState,
    onCurrentPasswordChange: (String) -> Unit,
    onNewPasswordChange: (String) -> Unit,
    onChangePassword: () -> Unit,
    onNewHandleChange: (String) -> Unit,
    onChangeHandle: () -> Unit,
    onNewEmailChange: (String) -> Unit,
    onEmailChangePasswordChange: (String) -> Unit,
    onRequestEmailChange: () -> Unit,
    onEmailChangeCodeChange: (String) -> Unit,
    onConfirmEmailChange: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.settings_credentials_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() },
            )
            PasswordTextField(
                value = state.currentPassword,
                onValueChange = onCurrentPasswordChange,
                label = stringResource(R.string.settings_current_password),
                testTag = "settings_current_password",
                modifier = Modifier.fillMaxWidth(),
            )
            PasswordTextField(
                value = state.newPassword,
                onValueChange = onNewPasswordChange,
                label = stringResource(R.string.settings_new_password),
                testTag = "settings_new_password",
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = onChangePassword,
                enabled = state.currentPassword.isNotEmpty() && state.newPassword.isNotEmpty() && !state.busy,
                modifier = Modifier.testTag("settings_change_password"),
            ) {
                Text(stringResource(R.string.settings_change_password))
            }

            OutlinedTextField(
                value = state.newHandle,
                onValueChange = onNewHandleChange,
                label = { Text(stringResource(R.string.settings_new_handle)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("settings_new_handle"),
            )
            Button(
                onClick = onChangeHandle,
                enabled = state.newHandle.length >= 3 && !state.busy,
                modifier = Modifier.testTag("settings_change_handle"),
            ) {
                Text(stringResource(R.string.settings_change_handle))
            }

            OutlinedTextField(
                value = state.newEmail,
                onValueChange = onNewEmailChange,
                label = { Text(stringResource(R.string.settings_new_email)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("settings_new_email"),
            )
            PasswordTextField(
                value = state.emailChangePassword,
                onValueChange = onEmailChangePasswordChange,
                label = stringResource(R.string.settings_email_password),
                testTag = "settings_email_password",
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = onRequestEmailChange,
                enabled = state.newEmail.contains('@') && state.emailChangePassword.isNotEmpty() && !state.busy,
                modifier = Modifier.testTag("settings_request_email"),
            ) {
                Text(stringResource(R.string.settings_request_email))
            }
            if (state.emailChangeRequested) {
                Text(
                    text = stringResource(R.string.settings_email_requested),
                    modifier = Modifier.testTag("settings_email_requested"),
                )
                OutlinedTextField(
                    value = state.emailChangeCode,
                    onValueChange = onEmailChangeCodeChange,
                    label = { Text(stringResource(R.string.settings_email_code)) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("settings_email_code"),
                )
                Button(
                    onClick = onConfirmEmailChange,
                    enabled = state.emailChangeCode.isNotBlank() && !state.busy,
                    modifier = Modifier.testTag("settings_confirm_email"),
                ) {
                    Text(stringResource(R.string.settings_confirm_email))
                }
            }
        }
    }
}

private fun SettingsFeedback.message(): Int = when (this) {
    is SettingsFeedback.Done -> action.message()
    is SettingsFeedback.Error -> code.settingsMessage()
    SettingsFeedback.Transport -> R.string.error_transport
}

private fun ErrorCode.settingsMessage(): Int = when (this) {
    ErrorCode.INVALID_CREDENTIALS -> R.string.settings_wrong_password
    ErrorCode.WEAK_PASSWORD -> R.string.error_weak_password
    ErrorCode.HANDLE_TAKEN -> R.string.settings_handle_taken
    ErrorCode.BAD_INPUT -> R.string.settings_bad_input
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}

private fun SettingsAction.message(): Int = when (this) {
    SettingsAction.PASSWORD_CHANGED -> R.string.settings_password_changed
    SettingsAction.HANDLE_CHANGED -> R.string.settings_handle_changed
    SettingsAction.EMAIL_CHANGE_REQUESTED -> R.string.settings_email_change_requested
    SettingsAction.EMAIL_CONFIRMED -> R.string.settings_email_confirmed
    SettingsAction.SESSION_REVOKED -> R.string.settings_session_revoked
    SettingsAction.OTHERS_REVOKED -> R.string.settings_others_revoked
}
