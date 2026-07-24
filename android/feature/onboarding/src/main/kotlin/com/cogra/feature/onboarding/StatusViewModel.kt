package com.cogra.feature.onboarding

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.signing.RegistrationProgress
import com.cogra.domain.signing.RegistrationSigner
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StatusUiState(
    val progress: RegistrationProgress? = null,
    val verificationToken: String = "",
    val resendEmail: String = "",
    val verifying: Boolean = false,
    val verified: Boolean = false,
    val verifyFailed: Boolean = false,
    val resent: Boolean = false,
)

/**
 * The wait-and-sign screen (auth.md "Approval and landing"): polls the
 * application, signs the staged Registration the moment it appears,
 * claims the first session once landed — `advance()` is idempotent, so
 * the loop just keeps calling it. Landing flips the token store and the
 * app's auth-state navigation takes over.
 */
@HiltViewModel
class StatusViewModel @Inject constructor(
    private val signer: RegistrationSigner,
    private val onboarding: OnboardingRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(StatusUiState())
    val state = _state.asStateFlow()

    /** Injectable for tests; the applicant poll cadence. */
    var pollDelayMs: Long = 3_000

    init {
        viewModelScope.launch {
            while (true) {
                val progress = signer.advance(Build.MODEL)
                _state.update { it.copy(progress = progress) }
                if (progress is RegistrationProgress.SessionClaimed ||
                    progress is RegistrationProgress.NoApplication
                ) {
                    break
                }
                delay(pollDelayMs)
            }
        }
    }

    fun onTokenChange(v: String) = _state.update { it.copy(verificationToken = v, verifyFailed = false) }

    fun onResendEmailChange(v: String) = _state.update { it.copy(resendEmail = v, resent = false) }

    fun onVerify() {
        val token = _state.value.verificationToken.trim()
        if (token.isBlank() || _state.value.verifying) return
        _state.update { it.copy(verifying = true, verifyFailed = false) }
        viewModelScope.launch {
            when (onboarding.verifyEmail(token)) {
                is Outcome.Success -> _state.update { it.copy(verifying = false, verified = true) }
                else -> _state.update { it.copy(verifying = false, verifyFailed = true) }
            }
        }
    }

    fun onResend() {
        val email = _state.value.resendEmail.trim()
        if (email.isBlank()) return
        viewModelScope.launch {
            onboarding.resendVerificationEmail(email)
            _state.update { it.copy(resent = true) }
        }
    }
}
