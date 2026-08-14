// The onboarding destinations: invite entry, the registration form,
// and the key ceremony (auth.md "Application").

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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.PasswordTextField
import com.cogra.core.designsystem.RecoveryCodeConfirm
import com.cogra.domain.ErrorCode
import com.cogra.domain.identity.recoveryCodeTypedBack

// --------------------------------------------------------------------
// Invite entry
// --------------------------------------------------------------------

@Composable
fun InviteEntryRoute(
    deepLinkedInviteId: String?,
    onUsableLink: (String) -> Unit,
    onLogInInstead: () -> Unit,
    onBrowseFeed: () -> Unit,
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
        onBrowseFeed = onBrowseFeed,
    )
}

@Composable
fun InviteEntryScreen(
    state: InviteEntryUiState,
    onInputChange: (String) -> Unit,
    onCheck: () -> Unit,
    onContinue: () -> Unit,
    onLogInInstead: () -> Unit,
    onBrowseFeed: () -> Unit,
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
                state.malformed -> ErrorLine(R.string.invite_malformed, testTag = "invite_error")
                state.notFound -> ErrorLine(R.string.invite_not_found, testTag = "invite_error")
                state.check?.usable == false -> ErrorLine(R.string.invite_unusable, testTag = "invite_error")
                state.transportFailed -> ErrorLine(R.string.error_transport, testTag = "invite_error")
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
            // The front door carries the browse entry: reading is public,
            // only participation needs the invite (android.md "Screens").
            TextButton(onClick = onBrowseFeed, modifier = Modifier.testTag("invite_browse")) {
                Text(stringResource(R.string.invite_browse))
            }
        }
    }
}

// --------------------------------------------------------------------
// Registration form
// --------------------------------------------------------------------

@Composable
fun ApplyRoute(
    inviteId: String,
    viewModel: ApplyViewModel = hiltViewModel(),
) {
    viewModel.inviteId = inviteId
    val state by viewModel.state.collectAsStateWithLifecycle()
    ApplyScreen(
        state = state,
        onHandleChange = viewModel::onHandleChange,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onSubmit = viewModel::onSubmit,
    )
}

@Composable
fun ApplyScreen(
    state: ApplyUiState,
    onHandleChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
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
            PasswordTextField(
                value = state.password,
                onValueChange = onPasswordChange,
                label = stringResource(R.string.login_password),
                testTag = "apply_password",
                supportingText = stringResource(R.string.apply_password_rules),
                isError = state.errorField == "password",
                modifier = Modifier.fillMaxWidth(),
            )
            state.error?.let {
                ErrorLine(it.applyMessage(), testTag = "apply_error")
            }
            if (state.transportFailed) {
                ErrorLine(R.string.error_transport, testTag = "apply_transport_error")
            }
            if (state.inProgress) {
                CircularProgressIndicator(modifier = Modifier.testTag("apply_progress"))
            }
            Button(
                onClick = onSubmit,
                enabled = state.formValid && !state.inProgress,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("apply_continue"),
            ) {
                Text(stringResource(R.string.apply_continue))
            }
        }
    }
}

private fun ErrorCode.applyMessage(): Int = when (this) {
    ErrorCode.INVITE_UNUSABLE -> R.string.invite_unusable
    ErrorCode.HANDLE_TAKEN -> R.string.apply_handle_taken
    ErrorCode.WEAK_PASSWORD -> R.string.error_weak_password
    ErrorCode.EMAIL_IN_USE -> R.string.apply_email_in_use
    ErrorCode.BAD_INPUT -> R.string.apply_bad_input
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}

// --------------------------------------------------------------------
// Key ceremony — a logged-in step, reached from its Home card
// --------------------------------------------------------------------

@Composable
fun KeyCeremonyRoute(
    onDone: () -> Unit,
    viewModel: KeyCeremonyViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.done) {
        if (state.done) onDone()
    }
    KeyCeremonyScreen(
        state = state,
        onAcceptBackup = viewModel::onAcceptBackup,
        onCodeSaved = viewModel::onCodeSaved,
        onDeclineBackup = viewModel::onDeclineBackup,
        onCancelDecline = viewModel::onCancelDecline,
        onConfirmDecline = viewModel::onConfirmDecline,
    )
}

@Composable
fun KeyCeremonyScreen(
    state: KeyCeremonyUiState,
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
            Text(
                text = stringResource(R.string.backup_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
            Text(stringResource(R.string.backup_explainer))
            when (state.attachError) {
                AttachError.NETWORK -> ErrorLine(R.string.error_transport, testTag = "ceremony_attach_error")
                AttachError.KEY_IN_USE -> ErrorLine(R.string.error_key_in_use, testTag = "ceremony_key_in_use")
                null -> Unit
            }
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
                        RecoveryCodeConfirm(
                            code = code,
                            explainer = stringResource(R.string.backup_code_explainer),
                            matches = { recoveryCodeTypedBack(code, it) },
                            onConfirmed = onCodeSaved,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
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

