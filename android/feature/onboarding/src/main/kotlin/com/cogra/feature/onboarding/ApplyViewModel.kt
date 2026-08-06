package com.cogra.feature.onboarding

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.Register
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ApplyUiState(
    val handle: String = "",
    val email: String = "",
    val password: String = "",
    val inProgress: Boolean = false,
    val error: ErrorCode? = null,
    val errorField: String? = null,
    val transportFailed: Boolean = false,
) {
    val formValid: Boolean
        get() = handle.length >= 3 && email.contains('@') && password.length >= 12
}

/**
 * The registration form (auth.md "Application" step 2): the invite
 * capability plus the login triple. Handle and email conflicts surface
 * here, at the form, before anything else has happened. Success flips
 * the token store — the person is simply logged in, and the key
 * ceremony and email verification follow as logged-in steps in the
 * Home shell.
 */
@HiltViewModel
class ApplyViewModel @Inject constructor(
    private val register: Register,
) : ViewModel() {

    private val _state = MutableStateFlow(ApplyUiState())
    val state = _state.asStateFlow()

    /** Set by the route from its navigation arguments. */
    var inviteId: String = ""

    fun onHandleChange(v: String) = _state.update { it.copy(handle = v.lowercase(), error = null, errorField = null) }

    fun onEmailChange(v: String) = _state.update { it.copy(email = v, error = null, errorField = null) }

    fun onPasswordChange(v: String) = _state.update { it.copy(password = v, error = null, errorField = null) }

    fun onSubmit() {
        val current = _state.value
        if (!current.formValid || current.inProgress) return
        _state.update { it.copy(inProgress = true, transportFailed = false) }
        viewModelScope.launch {
            val outcome = register.register(
                inviteLink = inviteId,
                handle = current.handle.trim(),
                email = current.email.trim(),
                password = current.password,
                deviceLabel = Build.MODEL,
            )
            when (outcome) {
                is Outcome.Success -> _state.update { it.copy(inProgress = false) }
                is Outcome.Refused -> {
                    val error = outcome.errors.first()
                    _state.update {
                        it.copy(inProgress = false, error = error.code, errorField = error.field?.lastOrNull())
                    }
                }
                is Outcome.Failed -> _state.update {
                    it.copy(inProgress = false, transportFailed = true)
                }
            }
        }
    }
}
