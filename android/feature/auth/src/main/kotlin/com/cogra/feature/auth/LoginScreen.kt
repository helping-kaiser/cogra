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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import com.cogra.core.designsystem.PasswordTextField
import com.cogra.domain.ErrorCode

@Composable
fun LoginRoute(
    onForgotPassword: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LoginScreen(
        state = state,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onForgetOnSignOutChange = viewModel::onForgetOnSignOutChange,
        onSubmit = viewModel::onSubmit,
        onForgotPassword = onForgotPassword,
    )
}

@Composable
fun LoginScreen(
    state: LoginUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onForgetOnSignOutChange: (Boolean) -> Unit,
    onSubmit: () -> Unit,
    onForgotPassword: () -> Unit,
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
                text = stringResource(R.string.login_title),
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
                    .testTag("login_email"),
            )
            PasswordTextField(
                value = state.password,
                onValueChange = onPasswordChange,
                label = stringResource(R.string.login_password),
                testTag = "login_password",
                modifier = Modifier.fillMaxWidth(),
            )
            ForgetOnSignOutRow(
                checked = state.forgetOnSignOut,
                onCheckedChange = onForgetOnSignOutChange,
                testTag = "login_dont_remember",
            )
            state.error?.let {
                Text(
                    text = stringResource(it.loginMessage()),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("login_error"),
                )
            }
            if (state.transportFailed) {
                Text(
                    text = stringResource(R.string.error_transport),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("login_transport_error"),
                )
            }
            if (state.inProgress) {
                CircularProgressIndicator(modifier = Modifier.testTag("login_progress"))
            }
            Button(
                onClick = onSubmit,
                enabled = state.canSubmit,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("login_submit"),
            ) {
                Text(stringResource(R.string.login_submit))
            }
            TextButton(
                onClick = onForgotPassword,
                modifier = Modifier.testTag("login_forgot"),
            ) {
                Text(stringResource(R.string.login_forgot))
            }
        }
    }
}

private fun ErrorCode.loginMessage(): Int = when (this) {
    ErrorCode.INVALID_CREDENTIALS -> R.string.login_invalid_credentials
    ErrorCode.RATE_LIMITED -> R.string.error_rate_limited
    else -> R.string.error_generic
}
