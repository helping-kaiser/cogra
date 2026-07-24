package com.cogra.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.identity.BackupManager
import com.cogra.domain.identity.SignOut
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val sessions: List<SessionInfo> = emptyList(),
    val actorPresent: Boolean = false,
    val busy: Boolean = false,
    /** A fresh backup code to display exactly once; cleared on confirm. */
    val newBackupCode: String? = null,
    // Credentials forms.
    val currentPassword: String = "",
    val newPassword: String = "",
    val newHandle: String = "",
    val newEmail: String = "",
    val emailChangeCode: String = "",
    val emailChangeRequested: Boolean = false,
    /** One-shot confirmation of the last completed action. */
    val done: SettingsAction? = null,
    val error: ErrorCode? = null,
    val transportFailed: Boolean = false,
)

enum class SettingsAction { PASSWORD_CHANGED, HANDLE_CHANGED, EMAIL_CONFIRMED, SESSION_REVOKED, OTHERS_REVOKED }

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val sessions: SessionRepository,
    private val account: AccountRepository,
    private val backup: BackupManager,
    private val signOut: SignOut,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState())
    val state = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val actorPresent = identity.actorSeed() != null
            when (val outcome = sessions.sessions()) {
                is Outcome.Success -> _state.update {
                    it.copy(sessions = outcome.value, actorPresent = actorPresent)
                }
                else -> _state.update { it.copy(actorPresent = actorPresent) }
            }
        }
    }

    // ------------------------------------------------------------ backup

    /** Enable late or replace the code — recovery serves the newest blob. */
    fun onCreateBackup() {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, error = null, transportFailed = false) }
        viewModelScope.launch {
            when (val outcome = backup.enableOrReplace()) {
                is Outcome.Success -> _state.update { it.copy(busy = false, newBackupCode = outcome.value) }
                is Outcome.Refused -> _state.update {
                    it.copy(busy = false, error = outcome.errors.first().code)
                }
                is Outcome.Failed -> _state.update { it.copy(busy = false, transportFailed = true) }
            }
        }
    }

    fun onBackupCodeSaved() = _state.update { it.copy(newBackupCode = null) }

    // ---------------------------------------------------------- sessions

    fun onRevokeSession(id: String) = revoke { sessions.revokeSession(id) to SettingsAction.SESSION_REVOKED }

    fun onRevokeOthers() = revoke {
        when (val outcome = sessions.revokeOtherSessions()) {
            is Outcome.Success -> Outcome.Success(Unit) to SettingsAction.OTHERS_REVOKED
            is Outcome.Refused -> outcome to SettingsAction.OTHERS_REVOKED
            is Outcome.Failed -> outcome to SettingsAction.OTHERS_REVOKED
        }
    }

    private fun revoke(block: suspend () -> Pair<Outcome<Unit>, SettingsAction>) {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, done = null) }
        viewModelScope.launch {
            val (outcome, action) = block()
            when (outcome) {
                is Outcome.Success -> _state.update { it.copy(busy = false, done = action) }
                is Outcome.Refused -> _state.update {
                    it.copy(busy = false, error = outcome.errors.first().code)
                }
                is Outcome.Failed -> _state.update { it.copy(busy = false, transportFailed = true) }
            }
            refresh()
        }
    }

    // ------------------------------------------------------- credentials

    fun onCurrentPasswordChange(v: String) = _state.update { it.copy(currentPassword = v, error = null) }

    fun onNewPasswordChange(v: String) = _state.update { it.copy(newPassword = v, error = null) }

    fun onNewHandleChange(v: String) = _state.update { it.copy(newHandle = v.lowercase(), error = null) }

    fun onNewEmailChange(v: String) = _state.update { it.copy(newEmail = v, error = null) }

    fun onEmailChangeCodeChange(v: String) = _state.update { it.copy(emailChangeCode = v, error = null) }

    fun onChangePassword() = credentialAction(SettingsAction.PASSWORD_CHANGED) {
        account.changePassword(_state.value.currentPassword, _state.value.newPassword)
    }

    fun onChangeHandle() = credentialAction(SettingsAction.HANDLE_CHANGED) {
        account.changeHandle(_state.value.newHandle.trim())
    }

    /** Two-sided proof: the request mails both addresses (auth.md). */
    fun onRequestEmailChange() {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            when (account.requestEmailChange(_state.value.newEmail.trim(), _state.value.currentPassword)) {
                is Outcome.Failed -> _state.update { it.copy(busy = false, transportFailed = true) }
                else -> _state.update { it.copy(busy = false, emailChangeRequested = true) }
            }
        }
    }

    fun onConfirmEmailChange() = credentialAction(SettingsAction.EMAIL_CONFIRMED) {
        account.confirmEmailChange(_state.value.emailChangeCode.trim())
    }

    private fun credentialAction(action: SettingsAction, block: suspend () -> Outcome<Unit>) {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, error = null, transportFailed = false, done = null) }
        viewModelScope.launch {
            when (val outcome = block()) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        busy = false,
                        done = action,
                        currentPassword = "",
                        newPassword = "",
                        emailChangeCode = "",
                    )
                }
                is Outcome.Refused -> _state.update {
                    it.copy(busy = false, error = outcome.errors.first().code)
                }
                is Outcome.Failed -> _state.update { it.copy(busy = false, transportFailed = true) }
            }
        }
    }

    // ---------------------------------------------------------- sign out

    /** Clears the session; the actor key stays on the device. */
    fun onSignOut() {
        viewModelScope.launch { signOut.signOut() }
    }
}
