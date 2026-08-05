package com.cogra.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val profile: UserProfile? = null,
    /** Signed in without the actor key — the husk state (auth.md). */
    val huskWarning: Boolean = false,
    /** The first-login prompt (auth.md "Reciprocation is the joiner's own act"). */
    val reciprocationTarget: ActorRef? = null,
    val pDirected: Double = 0.5,
    val pInterest: Double = 0.5,
    val signing: Boolean = false,
    val reciprocated: Boolean = false,
    val signingFailed: Boolean = false,
    /** Handshakes parked mid-flight on this device. */
    val pendingHandshakes: Int = 0,
    val transportFailed: Boolean = false,
    /** One-shot: a restore just landed the actor key; cleared once shown. */
    val actorRestored: Boolean = false,
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val account: AccountRepository,
    private val writes: WriteRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state = _state.asStateFlow()

    init {
        refresh()
    }

    /**
     * The Restore destination reported success into Home's back-stack
     * entry; Home outlives that push/pop, so this is the only signal
     * that the husk state must be re-read.
     */
    fun onActorRestored() {
        _state.update { it.copy(actorRestored = true) }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val huskWarning = identity.actorSeed() == null
            val pending = identity.handshakeIds().size
            when (val outcome = account.me()) {
                is Outcome.Success -> {
                    val profile = outcome.value
                    val prompt = profile?.invitedBy != null &&
                        !huskWarning &&
                        !identity.reciprocationHandled()
                    _state.update {
                        it.copy(
                            loading = false,
                            profile = profile,
                            huskWarning = huskWarning,
                            reciprocationTarget = if (prompt) profile?.invitedBy else null,
                            pendingHandshakes = pending,
                            transportFailed = false,
                        )
                    }
                }
                is Outcome.Refused -> _state.update {
                    // The auth-state holder handles a dead session; here
                    // just stop loading.
                    it.copy(loading = false, huskWarning = huskWarning, pendingHandshakes = pending)
                }
                is Outcome.Failed -> _state.update {
                    it.copy(loading = false, huskWarning = huskWarning, transportFailed = true)
                }
            }
        }
    }

    fun onPDirectedChange(v: Double) = _state.update { it.copy(pDirected = v) }

    fun onPInterestChange(v: Double) = _state.update { it.copy(pInterest = v) }

    /** The joiner points back — their own signed Opinion. */
    fun onReciprocate() {
        val target = _state.value.reciprocationTarget ?: return
        if (_state.value.signing) return
        _state.update { it.copy(signing = true, signingFailed = false) }
        viewModelScope.launch {
            val prepared = when (val outcome =
                writes.prepareStance(target.id, _state.value.pDirected, _state.value.pInterest)) {
                is Outcome.Success -> outcome.value
                else -> {
                    _state.update { it.copy(signing = false, signingFailed = true) }
                    return@launch
                }
            }
            val results = signer.sign(prepared)
            if (results.all { it is WriteResult.Done }) {
                identity.markReciprocationHandled()
                _state.update {
                    it.copy(signing = false, reciprocated = true, reciprocationTarget = null)
                }
            } else {
                _state.update { it.copy(signing = false, signingFailed = true) }
            }
        }
    }

    /** Dismissal is remembered — the prompt is an offer, not a nag. */
    fun onDismissReciprocation() {
        viewModelScope.launch {
            identity.markReciprocationHandled()
            _state.update { it.copy(reciprocationTarget = null) }
        }
    }

    /** Continues every parked handshake (process-death recovery). */
    fun onResumePending() {
        viewModelScope.launch {
            signer.resume()
            _state.update { it.copy(pendingHandshakes = identity.handshakeIds().size) }
        }
    }

    fun onActorRestoredShown() {
        _state.update { it.copy(actorRestored = false) }
    }
}
