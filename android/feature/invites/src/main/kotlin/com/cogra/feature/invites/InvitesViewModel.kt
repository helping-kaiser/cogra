package com.cogra.feature.invites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.Outcome
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class InvitesUiState(
    val loading: Boolean = true,
    val links: List<InviteLinkInfo> = emptyList(),
    val creating: Boolean = false,
    val singleUse: Boolean = false,
    val prefillPDirected: Double = 0.1,
    val prefillPInterest: Double = 0.1,
    /** The application currently being approved, if any. */
    val approvingId: String? = null,
    val error: ErrorCode? = null,
    val transportFailed: Boolean = false,
    /** One-shot, consumed after its snackbar: the vouch landed in the
     *  relay after on-device signing. */
    val vouchSigned: Boolean = false,
    /** One-shot, consumed after its snackbar: the approval landed but
     *  the vouch's signing did not finish — silence would hide a
     *  priced act's incomplete half. */
    val signingFailed: Boolean = false,
    /**
     * False in the husk state — the actor key is not on this device, so
     * approving (which must sign the vouch here) is gated until restore
     * (auth.md "Multi-account device custody").
     */
    val seedOnDevice: Boolean = true,
)

/**
 * The inviter surface (auth.md "Invite-link generation", "Approval and
 * landing"): links stage, approval is the priced act, and the vouch —
 * the inviter's own Opinion — is signed on this device.
 */
@HiltViewModel
class InvitesViewModel @Inject constructor(
    private val account: AccountRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
    @WebOrigin private val webOrigin: String,
) : ViewModel() {

    private val _state = MutableStateFlow(InvitesUiState())
    val state = _state.asStateFlow()

    init {
        refresh()
    }

    /** The canonical shareable URL (auth.md "Link URLs"). */
    fun shareUrl(link: InviteLinkInfo): String = "$webOrigin/join/${link.id}"

    fun onVouchSignedShown() = _state.update { it.copy(vouchSigned = false) }

    fun onSigningFailedShown() = _state.update { it.copy(signingFailed = false) }

    fun onSingleUseChange(v: Boolean) = _state.update { it.copy(singleUse = v) }

    fun onPrefillPDirectedChange(v: Double) = _state.update { it.copy(prefillPDirected = v) }

    fun onPrefillPInterestChange(v: Double) = _state.update { it.copy(prefillPInterest = v) }

    fun refresh() {
        viewModelScope.launch {
            val seedOnDevice = identity.actorSeed() != null
            when (val outcome = account.inviteLinks()) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        loading = false,
                        links = outcome.value,
                        transportFailed = false,
                        seedOnDevice = seedOnDevice,
                    )
                }
                is Outcome.Refused -> _state.update {
                    it.copy(loading = false, error = outcome.errors.first().code, seedOnDevice = seedOnDevice)
                }
                is Outcome.Failed -> _state.update {
                    it.copy(loading = false, transportFailed = true, seedOnDevice = seedOnDevice)
                }
            }
        }
    }

    fun onCreate() {
        if (_state.value.creating) return
        _state.update { it.copy(creating = true, error = null, transportFailed = false) }
        viewModelScope.launch {
            val outcome = account.createInviteLink(
                // The operational default; links are revocable any time.
                expiresAt = Instant.now().plus(7, ChronoUnit.DAYS),
                prefillPDirected = _state.value.prefillPDirected,
                prefillPInterest = _state.value.prefillPInterest,
                singleUse = _state.value.singleUse,
            )
            when (outcome) {
                is Outcome.Success -> {
                    _state.update { it.copy(creating = false) }
                    refresh()
                }
                is Outcome.Refused -> _state.update {
                    it.copy(creating = false, error = outcome.errors.first().code)
                }
                is Outcome.Failed -> _state.update { it.copy(creating = false, transportFailed = true) }
            }
        }
    }

    fun onRevoke(linkId: String) {
        viewModelScope.launch {
            val outcome = account.revokeInviteLink(linkId)
            refresh()
            when (outcome) {
                is Outcome.Success -> Unit
                is Outcome.Refused ->
                    _state.update { it.copy(error = outcome.errors.first().code) }
                is Outcome.Failed -> _state.update { it.copy(transportFailed = true) }
            }
        }
    }

    /**
     * The deliberate, priced act: approve, then sign the returned
     * Opinion writes on this device — the vouch is the inviter's
     * signature, not a server write.
     */
    fun onApprove(applicationId: String, pDirected: Double, pInterest: Double) {
        if (_state.value.approvingId != null) return
        _state.update {
            it.copy(approvingId = applicationId, error = null, vouchSigned = false, signingFailed = false)
        }
        viewModelScope.launch {
            // The vouch is this device's signature, so the gate sits
            // BEFORE the priced approval: without the key the approval
            // must not land only to strand the unsigned vouch.
            if (identity.actorSeed() == null) {
                _state.update { it.copy(approvingId = null, seedOnDevice = false) }
                return@launch
            }
            val prepared = when (val outcome = account.approveApplication(applicationId, pDirected, pInterest)) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    _state.update {
                        it.copy(approvingId = null, error = outcome.errors.first().code)
                    }
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(approvingId = null, transportFailed = true) }
                    return@launch
                }
            }
            val results = try {
                signer.sign(prepared)
            } catch (_: NoActorKeyException) {
                // The seed vanished between the gate and signing (a
                // concurrent purge): the approval landed, the vouch
                // waits on the expiry re-stage after restore.
                _state.update { it.copy(approvingId = null, seedOnDevice = false) }
                return@launch
            }
            // A priced act must never end in silence: the approval
            // landed either way, so an unfinished vouch is said out
            // loud — parked material resumes from Home.
            val signed = results.all { it is WriteResult.Done }
            _state.update { it.copy(approvingId = null, vouchSigned = signed, signingFailed = !signed) }
            refresh()
        }
    }
}
