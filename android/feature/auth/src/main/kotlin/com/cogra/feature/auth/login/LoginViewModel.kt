package com.cogra.feature.auth.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.domain.usecase.LogInUseCase
import com.cogra.core.domain.usecase.LoginResult
import com.cogra.feature.auth.toDisplayMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * UI state for the login screen. On a [LoginResult.Success] the use-case has
 * already persisted the session; the app's auth-state observer then swaps to
 * the profile, so this VM carries no navigation event.
 */
data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
) {
    val canSubmit: Boolean
        get() = !isSubmitting && email.isNotBlank() && password.isNotEmpty()
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val logIn: LogInUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onEmailChange(email: String) =
        _state.update { it.copy(email = email, errorMessage = null) }

    fun onPasswordChange(password: String) =
        _state.update { it.copy(password = password, errorMessage = null) }

    fun onSubmit() {
        if (_state.value.isSubmitting) return
        _state.update { it.copy(isSubmitting = true, errorMessage = null) }

        viewModelScope.launch {
            val current = _state.value
            val message = when (val result = logIn(current.email, current.password, DEVICE_LABEL)) {
                is LoginResult.Success -> null
                is LoginResult.Rejected -> result.errors.firstOrNull()?.toDisplayMessage()
                    ?: "Login failed."
                is LoginResult.Failure -> "Couldn't reach the server. Check your connection."
            }
            _state.update { it.copy(isSubmitting = false, errorMessage = message) }
        }
    }

    private companion object {
        const val DEVICE_LABEL = "Android"
    }
}
