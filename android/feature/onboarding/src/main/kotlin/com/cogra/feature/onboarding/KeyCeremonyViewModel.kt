package com.cogra.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.has
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.signing.RegistrationFlow
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Why the attach did not land; the same choice retries it. */
enum class AttachError {
    /** Transport failed or the server refused for a transient reason. */
    NETWORK,

    /**
     * ACTOR_KEY_IN_USE: the key is bound to a different account — an
     * address binds at most one account (auth.md §Application).
     */
    KEY_IN_USE,
}

data class KeyCeremonyUiState(
    val inProgress: Boolean = false,
    /** The recovery code, displayed exactly once; never persisted. */
    val recoveryCode: String? = null,
    /** The decline path asks for an explicit confirmation of the price. */
    val confirmingDecline: Boolean = false,
    val attachError: AttachError? = null,
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
        _state.update { it.copy(inProgress = true, attachError = null) }
        viewModelScope.launch {
            ceremony.createActorKey()
            val attached = ceremony.attachActorKey()
            if (attached !is Outcome.Success) {
                _state.update { it.copy(inProgress = false, attachError = attached.asAttachError()) }
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
        _state.update { it.copy(inProgress = true, confirmingDecline = false, attachError = null) }
        viewModelScope.launch {
            ceremony.createActorKey()
            val attached = ceremony.attachActorKey()
            if (attached !is Outcome.Success) {
                _state.update { it.copy(inProgress = false, attachError = attached.asAttachError()) }
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

    private fun Outcome<*>.asAttachError(): AttachError =
        if (this is Outcome.Refused && has(ErrorCode.ACTOR_KEY_IN_USE)) {
            AttachError.KEY_IN_USE
        } else {
            AttachError.NETWORK
        }
}
