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
    val emailChangePassword: String = "",
    val emailChangeCode: String = "",
    val emailChangeRequested: Boolean = false,
    /** One-shot snackbar message; consumed via onFeedbackShown after display. */
    val feedback: SettingsFeedback? = null,
)

enum class SettingsAction {
    PASSWORD_CHANGED, HANDLE_CHANGED,
    EMAIL_CHANGE_REQUESTED, EMAIL_CONFIRMED,
    SESSION_REVOKED, OTHERS_REVOKED,
}

/** At most one message is pending at a time; the snackbar shows it once. */
sealed interface SettingsFeedback {
    data class Done(val action: SettingsAction) : SettingsFeedback
    data class Error(val code: ErrorCode) : SettingsFeedback
    data object Transport : SettingsFeedback
}

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

    fun onFeedbackShown() = _state.update { it.copy(feedback = null) }

    // ------------------------------------------------------------ backup

    /** Enable late or replace the code — recovery serves the newest blob. */
    fun onCreateBackup() {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, feedback = null) }
        viewModelScope.launch {
            when (val outcome = backup.enableOrReplace()) {
                is Outcome.Success -> _state.update { it.copy(busy = false, newBackupCode = outcome.value) }
                is Outcome.Refused -> _state.update {
                    it.copy(busy = false, feedback = SettingsFeedback.Error(outcome.errors.first().code))
                }
                is Outcome.Failed -> _state.update { it.copy(busy = false, feedback = SettingsFeedback.Transport) }
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
        _state.update { it.copy(busy = true, feedback = null) }
        viewModelScope.launch {
            val (outcome, action) = block()
            when (outcome) {
                is Outcome.Success -> _state.update {
                    it.copy(busy = false, feedback = SettingsFeedback.Done(action))
                }
                is Outcome.Refused -> _state.update {
                    it.copy(busy = false, feedback = SettingsFeedback.Error(outcome.errors.first().code))
                }
                is Outcome.Failed -> _state.update { it.copy(busy = false, feedback = SettingsFeedback.Transport) }
            }
            refresh()
        }
    }

    // ------------------------------------------------------- credentials

    fun onCurrentPasswordChange(v: String) = _state.update { it.copy(currentPassword = v) }

    fun onNewPasswordChange(v: String) = _state.update { it.copy(newPassword = v) }

    fun onNewHandleChange(v: String) = _state.update { it.copy(newHandle = v.lowercase()) }

    fun onNewEmailChange(v: String) = _state.update { it.copy(newEmail = v) }

    fun onEmailChangePasswordChange(v: String) = _state.update { it.copy(emailChangePassword = v) }

    fun onEmailChangeCodeChange(v: String) = _state.update { it.copy(emailChangeCode = v) }

    fun onChangePassword() = credentialAction(SettingsAction.PASSWORD_CHANGED) {
        account.changePassword(_state.value.currentPassword, _state.value.newPassword)
    }

    fun onChangeHandle() = credentialAction(SettingsAction.HANDLE_CHANGED) {
        account.changeHandle(_state.value.newHandle.trim())
    }

    /** Two-sided proof: the request mails both addresses (auth.md). */
    fun onRequestEmailChange() {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, feedback = null) }
        viewModelScope.launch {
            val outcome = account.requestEmailChange(
                _state.value.newEmail.trim(),
                _state.value.emailChangePassword,
            )
            when (outcome) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        busy = false,
                        emailChangeRequested = true,
                        emailChangePassword = "",
                        feedback = SettingsFeedback.Done(SettingsAction.EMAIL_CHANGE_REQUESTED),
                    )
                }
                is Outcome.Refused -> _state.update {
                    it.copy(busy = false, feedback = SettingsFeedback.Error(outcome.errors.first().code))
                }
                is Outcome.Failed -> _state.update { it.copy(busy = false, feedback = SettingsFeedback.Transport) }
            }
        }
    }

    fun onConfirmEmailChange() = credentialAction(SettingsAction.EMAIL_CONFIRMED) {
        account.confirmEmailChange(_state.value.emailChangeCode.trim())
    }

    private fun credentialAction(action: SettingsAction, block: suspend () -> Outcome<Unit>) {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, feedback = null) }
        viewModelScope.launch {
            when (val outcome = block()) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        busy = false,
                        feedback = SettingsFeedback.Done(action),
                        currentPassword = "",
                        newPassword = "",
                        emailChangeCode = "",
                        // A confirmed change completes the request flow.
                        newEmail = if (action == SettingsAction.EMAIL_CONFIRMED) "" else it.newEmail,
                        emailChangeRequested = it.emailChangeRequested &&
                            action != SettingsAction.EMAIL_CONFIRMED,
                    )
                }
                is Outcome.Refused -> _state.update {
                    it.copy(busy = false, feedback = SettingsFeedback.Error(outcome.errors.first().code))
                }
                is Outcome.Failed -> _state.update { it.copy(busy = false, feedback = SettingsFeedback.Transport) }
            }
        }
    }

    // ---------------------------------------------------------- sign out

    /** Clears the session; the actor key stays on the device. */
    fun onSignOut() {
        viewModelScope.launch { signOut.signOut() }
    }
}
