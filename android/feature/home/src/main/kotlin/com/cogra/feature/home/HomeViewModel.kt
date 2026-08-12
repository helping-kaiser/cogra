package com.cogra.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.DEFAULT_STANCE
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserProfile
import com.cogra.domain.extractInviteId
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
    /** A pull-to-refresh pass is in flight. */
    val refreshing: Boolean = false,
    /**
     * An applicant browsing the shell before landing (auth.md
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
    /** The verify refusal to render; null when none. */
    val verifyError: ErrorCode? = null,
    val resent: Boolean = false,
    val resending: Boolean = false,
    /** The resend refusal to render; null when none. */
    val resendError: ErrorCode? = null,
    /** The re-arm card's fresh-invite input (a dead application). */
    val rearmInput: String = "",
    val rearming: Boolean = false,
    val rearmError: ErrorCode? = null,
    val rearmMalformed: Boolean = false,
    /** One-shot: the approval just came through in this app run. */
    val approved: Boolean = false,
    /** One-shot: landed in this app run — greet the new member once. */
    val welcome: Boolean = false,
    val profile: UserProfile? = null,
    /** Signed in without the actor key — the husk state (auth.md). */
    val huskWarning: Boolean = false,
    /** The first-login prompt (auth.md "Reciprocation is the joiner's own act"). */
    val reciprocationTarget: ActorRef? = null,
    val pDirected: Double = DEFAULT_STANCE,
    val pInterest: Double = DEFAULT_STANCE,
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
            registration.progress.collect(::onProgress)
        }
        refresh()
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
        if (progress is RegistrationProgress.Member) {
            // A landing watched live greets once; either way the member
            // shape must be re-read while the UI still shows applicant.
            if (registration.consumeLanded()) _state.update { it.copy(welcome = true) }
            if (_state.value.applicant) refresh()
        }
    }

    /**
     * The Restore destination reported success into Home's back-stack
     * entry; Home outlives that push/pop, so this is the only signal
     * that the husk state must be re-read.
     */
    fun onActorRestored() {
        _state.update { it.copy(actorRestored = true) }
        // An applicant restoring mid-flow may have a Registration to
        // sign now — poll immediately.
        if (_state.value.applicant) registration.ensureAdvancing()
        refresh()
    }

    /** Pull-to-refresh: the one manual re-pull, applicant or member. */
    fun onPullRefresh() {
        _state.update { it.copy(refreshing = true) }
        if (_state.value.applicant) registration.ensureAdvancing()
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val seedOnDevice = identity.actorSeed() != null
            val pending = identity.handshakeIds().size
            when (val outcome = account.me()) {
                is Outcome.Success -> {
                    val profile = outcome.value
                    val applicant = profile?.accountState == AccountState.APPLICANT
                    // The poll/sign loop is onboarding-only: started (or
                    // poked) for an applicant, never for a member.
                    if (applicant) registration.ensureAdvancing()
                    val member = profile?.accountState == AccountState.MEMBER
                    // The pair's state is the graph's (hasReciprocated);
                    // the device remembers only a dismissal.
                    val prompt = member &&
                        profile?.invitedBy != null &&
                        seedOnDevice &&
                        profile?.hasReciprocated == false &&
                        !identity.reciprocationDismissed()
                    _state.update {
                        it.copy(
                            loading = false,
                            refreshing = false,
                            applicant = applicant,
                            profile = profile,
                            // The applicant cards carry their own key
                            // guidance; the husk card is the member's.
                            huskWarning = member && !seedOnDevice,
                            reciprocationTarget = if (prompt) profile?.invitedBy else null,
                            pendingHandshakes = pending,
                            transportFailed = false,
                        )
                    }
                }
                is Outcome.Refused -> _state.update {
                    // The auth-state holder handles a dead session; here
                    // just stop loading.
                    it.copy(loading = false, refreshing = false, pendingHandshakes = pending)
                }
                is Outcome.Failed -> _state.update {
                    it.copy(loading = false, refreshing = false, transportFailed = true)
                }
            }
        }
    }

    fun onTokenChange(v: String) = _state.update { it.copy(verificationToken = v, verifyError = null) }

    fun onResendEmailChange(v: String) = _state.update { it.copy(resendEmail = v, resent = false, resendError = null) }

    fun onVerify() {
        val token = _state.value.verificationToken.trim()
        if (token.isBlank() || _state.value.verifying) return
        _state.update { it.copy(verifying = true, verifyError = null) }
        viewModelScope.launch {
            when (val outcome = onboarding.verifyEmail(token)) {
                is Outcome.Success -> {
                    _state.update { it.copy(verifying = false, verified = true) }
                    // The proof just changed server-side: poll now.
                    registration.ensureAdvancing()
                }
                is Outcome.Refused -> _state.update {
                    it.copy(
                        verifying = false,
                        verifyError = outcome.errors.firstOrNull()?.code ?: ErrorCode.INTERNAL,
                    )
                }
                is Outcome.Failed -> _state.update {
                    it.copy(verifying = false, verifyError = ErrorCode.INTERNAL)
                }
            }
        }
    }

    fun onResend() {
        val email = _state.value.resendEmail.trim()
        if (email.isBlank() || _state.value.resending) return
        _state.update { it.copy(resending = true, resent = false, resendError = null) }
        viewModelScope.launch {
            when (val outcome = onboarding.resendVerificationEmail(email)) {
                is Outcome.Success -> _state.update { it.copy(resending = false, resent = true) }
                // The rate limiter is the one refusal this silent verb
                // can produce — say so instead of claiming the mail is
                // on its way.
                is Outcome.Refused -> _state.update {
                    it.copy(
                        resending = false,
                        resendError = outcome.errors.firstOrNull()?.code ?: ErrorCode.INTERNAL,
                    )
                }
                is Outcome.Failed -> _state.update {
                    it.copy(resending = false, resendError = ErrorCode.INTERNAL)
                }
            }
        }
    }

    fun onRearmInputChange(v: String) =
        _state.update { it.copy(rearmInput = v, rearmError = null, rearmMalformed = false) }

    /** A dead application re-arms with a fresh invite (auth.md "Expiry"). */
    fun onRearm() {
        if (_state.value.rearming) return
        val id = extractInviteId(_state.value.rearmInput)
        if (id == null) {
            _state.update { it.copy(rearmMalformed = true) }
            return
        }
        _state.update { it.copy(rearming = true, rearmError = null, rearmMalformed = false) }
        viewModelScope.launch {
            when (val outcome = onboarding.applyWithInvite(id)) {
                is Outcome.Success -> {
                    _state.update { it.copy(rearming = false, rearmInput = "") }
                    registration.ensureAdvancing()
                }
                is Outcome.Refused -> _state.update {
                    it.copy(rearming = false, rearmError = outcome.errors.first().code)
                }
                is Outcome.Failed -> _state.update {
                    it.copy(rearming = false, rearmError = ErrorCode.INTERNAL)
                }
            }
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
                // No device mark: the in-flight staged write already
                // answers hasReciprocated on the next profile read.
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
            identity.markReciprocationDismissed()
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
