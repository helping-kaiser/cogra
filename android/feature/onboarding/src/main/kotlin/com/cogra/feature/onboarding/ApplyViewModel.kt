package com.cogra.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** The two steps of one destination: the form, then the key + backup step. */
enum class ApplyStep { FORM, BACKUP }

data class ApplyUiState(
    val step: ApplyStep = ApplyStep.FORM,
    val handle: String = "",
    val email: String = "",
    val password: String = "",
    val inProgress: Boolean = false,
    /** The recovery code, displayed exactly once; never persisted. */
    val recoveryCode: String? = null,
    /** The decline path asks for an explicit confirmation of the price. */
    val confirmingDecline: Boolean = false,
    val submitted: Boolean = false,
    val error: ErrorCode? = null,
    val errorField: String? = null,
    val transportFailed: Boolean = false,
) {
    val formValid: Boolean
        get() = handle.length >= 3 && email.contains('@') && password.length >= 12
}

/**
 * Application with the on-device key ceremony (auth.md "Application"
 * steps 2–3): the key and address exist before the submit — approval
 * funds a burn to the applicant's own address — and the backup offer
 * rides the same step, its consequence stated before a decline.
 */
@HiltViewModel
class ApplyViewModel @Inject constructor(
    private val onboarding: OnboardingRepository,
    private val ceremony: KeyCeremony,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(ApplyUiState())
    val state = _state.asStateFlow()

    /** Set by the route from its navigation arguments. */
    var inviteId: String = ""

    fun onHandleChange(v: String) = _state.update { it.copy(handle = v.lowercase(), error = null, errorField = null) }

    fun onEmailChange(v: String) = _state.update { it.copy(email = v, error = null, errorField = null) }

    fun onPasswordChange(v: String) = _state.update { it.copy(password = v, error = null, errorField = null) }

    /** FORM → BACKUP: the ceremony runs now; the offer is next. */
    fun onContinueToBackup() {
        if (!_state.value.formValid || _state.value.inProgress) return
        _state.update { it.copy(step = ApplyStep.BACKUP, confirmingDecline = false) }
    }

    fun onAcceptBackup() {
        if (_state.value.inProgress || _state.value.recoveryCode != null) return
        _state.update { it.copy(inProgress = true) }
        viewModelScope.launch {
            ceremony.createActorKey()
            val code = ceremony.createPendingBackup()
            _state.update { it.copy(inProgress = false, recoveryCode = code) }
        }
    }

    /** After the user confirms the code is written down. */
    fun onCodeSaved() = submit(withKey = false)

    fun onDeclineBackup() = _state.update { it.copy(confirmingDecline = true) }

    fun onCancelDecline() = _state.update { it.copy(confirmingDecline = false) }

    /** The stated price accepted: no backup, the key exists only here. */
    fun onConfirmDecline() = submit(withKey = true)

    private fun submit(withKey: Boolean) {
        val current = _state.value
        if (current.inProgress) return
        _state.update { it.copy(inProgress = true, transportFailed = false) }
        viewModelScope.launch {
            // Declining creates the key now; accepting created it with
            // the backup offer.
            val public = if (withKey) {
                ceremony.createActorKey()
            } else {
                checkNotNull(ceremony.publicIdentity()) { "the backup offer creates the key" }
            }
            val outcome = onboarding.submitApplication(
                inviteLink = inviteId,
                handle = current.handle.trim(),
                email = current.email.trim(),
                password = current.password,
                actorPubkeyBase64 = public.publicKeyBase64,
                l0Address = public.l0Address,
            )
            when (outcome) {
                is Outcome.Success -> {
                    identity.saveApplicantToken(outcome.value)
                    _state.update { it.copy(inProgress = false, submitted = true) }
                }
                is Outcome.Refused -> {
                    val error = outcome.errors.first()
                    _state.update {
                        it.copy(
                            inProgress = false,
                            step = ApplyStep.FORM,
                            confirmingDecline = false,
                            error = error.code,
                            errorField = error.field?.lastOrNull(),
                        )
                    }
                }
                is Outcome.Failed -> _state.update {
                    it.copy(inProgress = false, transportFailed = true, confirmingDecline = false)
                }
            }
        }
    }
}
