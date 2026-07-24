package com.cogra.feature.auth

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.LogIn
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val inProgress: Boolean = false,
    /** The refusal to render; null when none. */
    val error: ErrorCode? = null,
    val transportFailed: Boolean = false,
) {
    val canSubmit: Boolean get() = email.isNotBlank() && password.isNotEmpty() && !inProgress
}

/** Success flips the token store; the app's auth-state holder navigates. */
@HiltViewModel
class LoginViewModel @Inject constructor(private val logIn: LogIn) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onEmailChange(value: String) = _state.update { it.copy(email = value, error = null, transportFailed = false) }

    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, error = null, transportFailed = false) }

    fun onSubmit() {
        val current = _state.value
        if (!current.canSubmit) return
        _state.update { it.copy(inProgress = true, error = null, transportFailed = false) }
        viewModelScope.launch {
            when (val outcome = logIn.logIn(current.email.trim(), current.password, Build.MODEL)) {
                is Outcome.Success -> _state.update { it.copy(inProgress = false) }
                is Outcome.Refused -> _state.update {
                    it.copy(inProgress = false, error = outcome.errors.first().code)
                }
                is Outcome.Failed -> _state.update {
                    it.copy(inProgress = false, transportFailed = true)
                }
            }
        }
    }
}
