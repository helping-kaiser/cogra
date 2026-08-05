package com.cogra.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationProgress
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
    /**
     * A staged applicant browsing the shell before landing (auth.md
     * "Application"): reads are open, acting is gated, and the
     * application rides along as the cards below.
     */
    val applicant: Boolean = false,
    /** The applicant flow's last report; null before the first pass. */
    val progress: RegistrationProgress? = null,
    /** In-memory only: the hint returns on the next app open. */
    val waitingHintDismissed: Boolean = false,
    val verificationToken: String = "",
    val resendEmail: String = "",
    val verifying: Boolean = false,
    val verified: Boolean = false,
    val verifyFailed: Boolean = false,
    val resent: Boolean = false,
    /** One-shot: the approval just came through in this app run. */
    val approved: Boolean = false,
    /** One-shot: landed, claimed — greet the new member once. */
    val welcome: Boolean = false,
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
    private val onboarding: OnboardingRepository,
    private val registration: RegistrationFlow,
) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            if (identity.applicantToken() != null) {
                // Applicant shape: no session, no profile — observe the
                // app-scoped flow instead. Landing flips the token store
                // and navigation recreates Home in its member shape.
                _state.update { it.copy(loading = false, applicant = true) }
                registration.ensureAdvancing()
                registration.progress.collect(::onProgress)
            } else {
                if (registration.consumeClaimed()) {
                    _state.update { it.copy(welcome = true) }
                }
                refresh()
            }
        }
    }

    /** Live transitions become one-shots; a cold open shows only state. */
    private fun onProgress(progress: RegistrationProgress?) {
        _state.update { state ->
            val approved = state.approved ||
                (
                    state.progress is RegistrationProgress.AwaitingApproval &&
                        progress is RegistrationProgress.AwaitingLanding
                    )
            state.copy(progress = progress, approved = approved)
        }
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

    /** In-memory: the hint is a reminder, so the next app open revives it. */
    fun onDismissWaitingHint() = _state.update { it.copy(waitingHintDismissed = true) }

    fun onApprovedShown() = _state.update { it.copy(approved = false) }

    fun onWelcomeShown() = _state.update { it.copy(welcome = false) }

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
