// The password-reset pair (auth.md "Password reset"): the request
// always reports success (no account enumeration); the confirm takes
// the emailed token — pasted in-app, per the dev-mailer posture
// (auth.md "Link URLs") — and a new password, then routes back to login
// (every session was revoked).

package com.cogra.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.PasswordTextField
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.repo.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ResetUiState(
    val email: String = "",
    val token: String = "",
    val newPassword: String = "",
    val inProgress: Boolean = false,
    /** The silent verb reported success — tell the user to check mail. */
    val requested: Boolean = false,
    val confirmed: Boolean = false,
    val error: ErrorCode? = null,
    val transportFailed: Boolean = false,
)

@HiltViewModel
class PasswordResetViewModel @Inject constructor(
    private val account: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ResetUiState())
    val state = _state.asStateFlow()

    fun onEmailChange(v: String) = _state.update { it.copy(email = v, error = null) }

    fun onTokenChange(v: String) = _state.update { it.copy(token = v, error = null) }

    fun onNewPasswordChange(v: String) = _state.update { it.copy(newPassword = v, error = null) }

    fun onRequest() {
        val email = _state.value.email.trim()
        if (email.isBlank() || _state.value.inProgress) return
        _state.update { it.copy(inProgress = true, transportFailed = false) }
        viewModelScope.launch {
            when (account.requestPasswordReset(email)) {
                is Outcome.Success -> _state.update { it.copy(inProgress = false, requested = true) }
                is Outcome.Refused -> _state.update { it.copy(inProgress = false, requested = true) }
                is Outcome.Failed -> _state.update { it.copy(inProgress = false, transportFailed = true) }
            }
        }
    }

    fun onConfirm() {
        val current = _state.value
        if (current.token.isBlank() || current.newPassword.isEmpty() || current.inProgress) return
        _state.update { it.copy(inProgress = true, error = null, transportFailed = false) }
        viewModelScope.launch {
            when (val outcome = account.confirmPasswordReset(current.token.trim(), current.newPassword)) {
                is Outcome.Success -> _state.update { it.copy(inProgress = false, confirmed = true) }
                is Outcome.Refused -> _state.update {
                    it.copy(inProgress = false, error = outcome.errors.first().code)
                }
                is Outcome.Failed -> _state.update { it.copy(inProgress = false, transportFailed = true) }
            }
        }
    }
}

@Composable
fun PasswordResetRoute(
    onDone: () -> Unit,
    viewModel: PasswordResetViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    androidx.compose.runtime.LaunchedEffect(state.confirmed) {
        if (state.confirmed) onDone()
    }
    PasswordResetScreen(
        state = state,
        onEmailChange = viewModel::onEmailChange,
        onTokenChange = viewModel::onTokenChange,
        onNewPasswordChange = viewModel::onNewPasswordChange,
        onRequest = viewModel::onRequest,
        onConfirm = viewModel::onConfirm,
    )
}

@Composable
fun PasswordResetScreen(
    state: ResetUiState,
    onEmailChange: (String) -> Unit,
    onTokenChange: (String) -> Unit,
    onNewPasswordChange: (String) -> Unit,
    onRequest: () -> Unit,
    onConfirm: () -> Unit,
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
                text = stringResource(R.string.reset_title),
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() },
            )
            OutlinedTextField(
                value = state.email,
                onValueChange = onEmailChange,
                label = { Text(stringResource(R.string.login_email)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("reset_email"),
            )
            Button(
                onClick = onRequest,
                enabled = state.email.isNotBlank() && !state.inProgress,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("reset_request"),
            ) {
                Text(stringResource(R.string.reset_request))
            }
            if (state.requested) {
                Text(
                    text = stringResource(R.string.reset_requested),
                    modifier = Modifier.testTag("reset_requested"),
                )
            }
            OutlinedTextField(
                value = state.token,
                onValueChange = onTokenChange,
                label = { Text(stringResource(R.string.reset_token)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("reset_token"),
            )
            PasswordTextField(
                value = state.newPassword,
                onValueChange = onNewPasswordChange,
                label = stringResource(R.string.reset_new_password),
                testTag = "reset_password",
                modifier = Modifier.fillMaxWidth(),
            )
            state.error?.let {
                Text(
                    text = stringResource(it.resetMessage()),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("reset_error"),
                )
            }
            if (state.transportFailed) {
                Text(
                    text = stringResource(R.string.error_transport),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("reset_transport_error"),
                )
            }
            Button(
                onClick = onConfirm,
                enabled = state.token.isNotBlank() && state.newPassword.isNotEmpty() && !state.inProgress,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("reset_confirm"),
            ) {
                Text(stringResource(R.string.reset_confirm))
            }
        }
    }
}

private fun ErrorCode.resetMessage(): Int = when (this) {
    ErrorCode.VERIFICATION_TOKEN_INVALID -> R.string.reset_token_invalid
    ErrorCode.WEAK_PASSWORD -> R.string.error_weak_password
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}
