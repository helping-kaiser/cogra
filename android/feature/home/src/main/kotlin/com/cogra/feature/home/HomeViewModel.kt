package com.cogra.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationProgress
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Where the vouch card's put-away stands (VouchBack.md:37-41). `Got it` is a
 * read-side comfort: it answers at once, so the card steps aside while the
 * put-away is asked, and only a refusal brings it back.
 */
enum class VouchPutAway {
    /** Never asked: the card stands. */
    STANDING,

    /** Asked, not yet answered: the card has stepped aside. */
    ASKING,

    /** Did not go through: the card is back, saying so, with Retry (ruling 44). */
    FAILED,

    /** Kept by the server: the card is away for good. */
    AWAY,
}

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
    /** One-shot: a fresh token was just sent; cleared once shown. */
    val resent: Boolean = false,
    val resending: Boolean = false,
    /** The resend refusal to render; null when none. */
    val resendError: ErrorCode? = null,
    /** One-shot: the approval just came through in this app run. */
    val approved: Boolean = false,
    /** One-shot: landed in this app run — greet the new member once. */
    val welcome: Boolean = false,
    val profile: UserProfile? = null,
    /** Signed in without the actor key — the husk state (auth.md). */
    val huskWarning: Boolean = false,
    /**
     * The member who vouched the account in, while the vouch card stands on
     * server state alone (VouchBack.md:3): landed, the pair incomplete,
     * never put away. No key term — a vouch-back set with the key
     * elsewhere waits as any pick does (VouchBackPad.md:41).
     */
    val vouchVoucher: ActorRef? = null,
    val vouchPutAway: VouchPutAway = VouchPutAway.STANDING,
    /** Handshakes parked mid-flight on this device. */
    val pendingHandshakes: Int = 0,
    val transportFailed: Boolean = false,
    /** One-shot: a restore just landed the actor key; cleared once shown. */
    val actorRestored: Boolean = false,
) {
    /**
     * The account's actor key is attached but not on this device —
     * the restore ask, member husk and mid-flow applicant alike. It
     * rides the screen's collapsing top (KeyRestoreBanner), never
     * the banner stack.
     */
    val keyElsewhere: Boolean
        get() {
            if (huskWarning) return true
            if (!applicant) return false
            return when (val p = progress) {
                is RegistrationProgress.AwaitingApproval -> p.keyAttached && !p.keyOnDevice
                RegistrationProgress.AwaitingSigningKey -> true
                else -> false
            }
        }

    /** The vouch card is on the feed: it stands and has not stepped aside. */
    val vouchCardStands: Boolean
        get() = vouchVoucher != null &&
            (vouchPutAway == VouchPutAway.STANDING || vouchPutAway == VouchPutAway.FAILED)
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val account: AccountRepository,
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
                    // The pair's state is the graph's (hasReciprocated),
                    // the dismissal the account's (vouchBackDismissed);
                    // the device holds neither, and the key is no term.
                    val stands = member &&
                        profile?.invitedBy != null &&
                        profile?.hasReciprocated == false &&
                        profile?.vouchBackDismissed == false
                    _state.update {
                        it.copy(
                            loading = false,
                            refreshing = false,
                            applicant = applicant,
                            profile = profile,
                            // The applicant cards carry their own key
                            // guidance; the husk card is the member's.
                            huskWarning = member && !seedOnDevice,
                            vouchVoucher = if (stands) profile?.invitedBy else null,
                            // A failed put-away says so "until Retry or the
                            // next fresh load" (ruling 55's comfort-revert).
                            vouchPutAway = if (it.vouchPutAway == VouchPutAway.FAILED) {
                                VouchPutAway.STANDING
                            } else {
                                it.vouchPutAway
                            },
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

    /** In-memory: the hint is a reminder, so the next app open revives it. */
    fun onDismissWaitingHint() = _state.update { it.copy(waitingHintDismissed = true) }

    fun onApprovedShown() = _state.update { it.copy(approved = false) }

    fun onWelcomeShown() = _state.update { it.copy(welcome = false) }

    /**
     * `Got it` (and the failed put-away's `Retry`): the card steps aside
     * at once, silently — no snackbar, no reminder, nothing in its place
     * (VouchBack.md:37) — while the put-away is asked. It is account state,
     * so it holds on every device (:45). A put-away that did not go through
     * brings the card back with `That didn't go through.` and `Retry` in its
     * row (:39, ruling 44): the NEVERs describe the successful outcome only.
     */
    fun onPutAway() {
        if (_state.value.vouchPutAway == VouchPutAway.ASKING) return
        _state.update { it.copy(vouchPutAway = VouchPutAway.ASKING) }
        viewModelScope.launch {
            val kept = account.dismissVouchBack() is Outcome.Success
            _state.update {
                it.copy(vouchPutAway = if (kept) VouchPutAway.AWAY else VouchPutAway.FAILED)
            }
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

    fun onResentShown() = _state.update { it.copy(resent = false) }
}
