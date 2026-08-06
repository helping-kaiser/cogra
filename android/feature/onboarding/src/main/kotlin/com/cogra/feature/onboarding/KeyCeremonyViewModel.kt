package com.cogra.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.signing.RegistrationFlow
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class KeyCeremonyUiState(
    val inProgress: Boolean = false,
    /** The recovery code, displayed exactly once; never persisted. */
    val recoveryCode: String? = null,
    /** The decline path asks for an explicit confirmation of the price. */
    val confirmingDecline: Boolean = false,
    /** The attach did not land; the same choice retries it. */
    val attachFailed: Boolean = false,
    val done: Boolean = false,
)

/**
 * The key ceremony as a logged-in step (auth.md "Application" step 3):
 * mint the key and address on this device, attach the public halves,
 * and offer the backup in the same step — the sealed blob uploads
 * immediately after the attach; a failed upload parks it and the
 * app-scoped flow retries. The key stays replaceable until approval, so
 * a retry may simply mint again.
 */
@HiltViewModel
class KeyCeremonyViewModel @Inject constructor(
    private val ceremony: KeyCeremony,
    private val registration: RegistrationFlow,
) : ViewModel() {

    private val _state = MutableStateFlow(KeyCeremonyUiState())
    val state = _state.asStateFlow()

    fun onAcceptBackup() {
        if (_state.value.inProgress || _state.value.recoveryCode != null) return
        _state.update { it.copy(inProgress = true, attachFailed = false) }
        viewModelScope.launch {
            ceremony.createActorKey()
            if (ceremony.attachActorKey() !is Outcome.Success) {
                _state.update { it.copy(inProgress = false, attachFailed = true) }
                return@launch
            }
            val code = ceremony.createPendingBackup()
            ceremony.uploadPendingBackup()
            _state.update { it.copy(inProgress = false, recoveryCode = code) }
        }
    }

    /** After the user confirms the code is written down. */
    fun onCodeSaved() = finish()

    fun onDeclineBackup() = _state.update { it.copy(confirmingDecline = true) }

    fun onCancelDecline() = _state.update { it.copy(confirmingDecline = false) }

    /** The stated price accepted: no backup, the key exists only here. */
    fun onConfirmDecline() {
        if (_state.value.inProgress) return
        _state.update { it.copy(inProgress = true, confirmingDecline = false, attachFailed = false) }
        viewModelScope.launch {
            ceremony.createActorKey()
            if (ceremony.attachActorKey() !is Outcome.Success) {
                _state.update { it.copy(inProgress = false, attachFailed = true) }
                return@launch
            }
            _state.update { it.copy(inProgress = false) }
            finish()
        }
    }

    /** The proof just changed server-side: poll now, not in 30 seconds. */
    private fun finish() {
        registration.ensureAdvancing()
        _state.update { it.copy(done = true) }
    }
}
