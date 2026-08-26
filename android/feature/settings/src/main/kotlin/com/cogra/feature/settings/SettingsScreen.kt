package com.cogra.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTopBanner
import com.cogra.core.designsystem.KeyGate
import com.cogra.core.designsystem.PasswordTextField
import com.cogra.core.designsystem.RecoveryCodeConfirm
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.rememberKeyGate
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.ErrorCode
import com.cogra.domain.MIN_HANDLE_LENGTH
import com.cogra.domain.identity.recoveryCodeTypedBack
import com.cogra.domain.stance.StanceInputMode

@Composable
fun SettingsRoute(
    onBack: () -> Unit,
    onHandleChanged: () -> Unit,
    onExportKey: () -> Unit,
    keyBanner: @Composable () -> Unit = {},
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
        onBack = onBack,
        onCreateBackup = viewModel::onCreateBackup,
        onBackupCodeSaved = viewModel::onBackupCodeSaved,
        onExportKey = onExportKey,
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
        onStanceInputMode = viewModel::onStanceInputMode,
        onConfirmMultiActionSubmits = viewModel::onConfirmMultiActionSubmits,
        onFeedbackShown = viewModel::onFeedbackShown,
        onSignOut = viewModel::onSignOut,
        keyBanner = keyBanner,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    state: SettingsUiState,
    onBack: () -> Unit,
    onCreateBackup: () -> Unit,
    onBackupCodeSaved: () -> Unit,
    onExportKey: () -> Unit,
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
    onStanceInputMode: (StanceInputMode) -> Unit,
    onConfirmMultiActionSubmits: (Boolean) -> Unit,
    onFeedbackShown: () -> Unit,
    onSignOut: () -> Unit,
    keyGate: KeyGate = rememberKeyGate(),
    keyBanner: @Composable () -> Unit = {},
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
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.collapsingTop(collapsingTop),
        topBar = {
            Column {
                TopAppBar(
                    colors = surfaceTopAppBarColors(),
                    scrollBehavior = collapsingTop.scrollBehavior,
                    title = {
                        Text(
                            text = stringResource(R.string.settings_title),
                            modifier = Modifier.semantics { heading() },
                        )
                    },
                    navigationIcon = {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier.testTag("settings_back"),
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.back),
                            )
                        }
                    },
                )
                // The key banner rides the collapsing top on every main
                // surface (design.md §6); the host pads to line up with
                // the content below.
                CollapsingTopBanner(collapsingTop, horizontalPadding = 24.dp) { keyBanner() }
            }
        },
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
            BackupSection(state, onCreateBackup, onBackupCodeSaved, onExportKey, keyGate)
            WritingSection(state.confirmMultiActionSubmits, onConfirmMultiActionSubmits)
            StanceInputSection(state.stanceInputMode, onStanceInputMode)
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

/**
 * The way back from "don't ask me again" (F4). A `Switch`, because it
 * is one setting that is on or off and takes effect immediately —
 * Material's own reading of the control.
 */
@Composable
private fun WritingSection(
    confirmMultiActionSubmits: Boolean,
    onConfirmMultiActionSubmits: (Boolean) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.settings_writing_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() },
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    // One target for label and switch, announced once.
                    .toggleable(
                        value = confirmMultiActionSubmits,
                        role = Role.Switch,
                        onValueChange = onConfirmMultiActionSubmits,
                    )
                    .testTag("settings_confirm_multi_action"),
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.settings_confirm_multi_action),
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Text(
                        text = stringResource(R.string.settings_confirm_multi_action_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = confirmMultiActionSubmits, onCheckedChange = null)
            }
        }
    }
}

/**
 * Where design.md §8.6 puts the choice: the same value through the pad,
 * paired sliders, or typed entry, and picking one replaces the pad
 * EVERYWHERE rather than per-screen. A radio group, because it is one
 * choice out of three — Material's `selectableGroup` carries the group
 * semantics and the single-selection announcement for free.
 */
@Composable
private fun StanceInputSection(
    mode: StanceInputMode,
    onStanceInputMode: (StanceInputMode) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.settings_stance_input_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = stringResource(R.string.settings_stance_input_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Column(Modifier.selectableGroup()) {
                for (option in StanceInputMode.entries) {
                    StanceInputOption(option, option == mode) { onStanceInputMode(option) }
                }
            }
        }
    }
}

@Composable
private fun StanceInputOption(mode: StanceInputMode, selected: Boolean, onSelect: () -> Unit) {
    val (label, hint) = when (mode) {
        StanceInputMode.PAD -> R.string.settings_stance_input_pad to
            R.string.settings_stance_input_pad_hint
        StanceInputMode.SLIDERS -> R.string.settings_stance_input_sliders to
            R.string.settings_stance_input_sliders_hint
        StanceInputMode.ENTRY -> R.string.settings_stance_input_entry to
            R.string.settings_stance_input_entry_hint
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            // The whole row is the target, and the radio itself leaves
            // the semantics tree so the row is announced once.
            .selectable(selected = selected, role = Role.RadioButton, onClick = onSelect)
            .padding(vertical = 4.dp)
            .testTag("settings_stance_input_${mode.name.lowercase()}"),
    ) {
        RadioButton(selected = selected, onClick = null)
        Column(Modifier.padding(start = 12.dp)) {
            Text(stringResource(label), style = MaterialTheme.typography.labelLarge)
            Text(
                text = stringResource(hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun BackupSection(
    state: SettingsUiState,
    onCreateBackup: () -> Unit,
    onBackupCodeSaved: () -> Unit,
    onExportKey: () -> Unit,
    keyGate: KeyGate,
) {
    // Replacing the code destroys the old backup and reveals a new
    // secret, so the phone confirms who is holding it first.
    val gate = rememberKeyGateRunner(keyGate)
    val replaceSubtitle = stringResource(R.string.key_gate_replace)
    KeyGateWarning(gate)
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
                        onClick = { gate.run(replaceSubtitle, onCreateBackup) },
                        enabled = state.actorPresent && !state.busy,
                        modifier = Modifier.testTag("settings_backup_create"),
                    ) {
                        Text(stringResource(R.string.settings_backup_create))
                    }
                    if (state.actorPresent) {
                        TextButton(
                            onClick = onExportKey,
                            modifier = Modifier.testTag("settings_export_key"),
                        ) {
                            Text(stringResource(R.string.settings_export_key))
                        }
                    }
                }
                else -> {
                    RecoveryCodeConfirm(
                        code = code,
                        explainer = stringResource(R.string.settings_backup_code_explainer),
                        matches = { recoveryCodeTypedBack(code, it) },
                        onConfirmed = onBackupCodeSaved,
                    )
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
                enabled = state.newHandle.length >= MIN_HANDLE_LENGTH && !state.busy,
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
