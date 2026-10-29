// THE ASK LINK'S LANDING (VouchAsk, VouchAskPad, VouchAskInvalid,
// VouchAskUnusable; behavior/<board>.md; auth.md "The ask link"). A member or
// a guest who opens `/vouch/<id>` meets the person asking — named, wearing a
// monogram, with no reason given — and the stance affordance that vouches
// them in. Nothing is staged by the opening (VouchAsk.md:11). web's twin is
// `web/src/app/vouch/[id]/vouch-ask-view.tsx`.
//
// WHO OPENED IT DECIDES WHERE IT LANDS, in this order (VouchAsk.md:13-17,
// :49; VouchAskUnusable.md:5-7):
// - the ASKER, and any APPLICANT, land where app-open lands for them, with
//   their own snackbar — never this page, never VouchAskUnusable;
// - a member who already has the asker WAITING in their queue meets Invites
//   at that row, `@noor is already waiting in your invites.`;
// - an id resolving to nobody is VouchAskInvalid, signed in or not;
// - a landed asker is VouchAskUnusable, with the door to their profile;
// - every other member, and a guest, meets the ask.

package com.cogra.feature.invites

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.AccountState
import com.cogra.domain.Outcome
import com.cogra.domain.invites.AskLinkCheck
import com.cogra.domain.invites.AskLinkUnusableReason
import com.cogra.domain.invites.InvitesRepository
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.KeptPickStore
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What the page stands as once the reader and the link are known. */
sealed interface AskLanding {
    data object Reading : AskLanding

    data object Fault : AskLanding

    /** VouchAskInvalid: the id names nobody. */
    data object Invalid : AskLanding

    /** VouchAskUnusable: the asker is already in. [handle] carries no @. */
    data class Landed(val handle: String) : AskLanding

    /** VouchAsk: the ask itself. [handle] carries no @. */
    data class Ask(val handle: String) : AskLanding
}

/** Where the page sends the reader instead of standing, once. */
sealed interface AskExit {
    /** Where app-open lands for them, with their own snackbar (VouchAsk.md:13, :15). */
    data class AppOpen(@StringRes val line: Int) : AskExit

    /** Invites, with what it says on arrival (VouchAsk.md:17, :27, :31; VouchAskPad.md:25, :33). */
    data class Invites(val notice: InvitesNotice) : AskExit
}

data class VouchAskUiState(
    val landing: AskLanding = AskLanding.Reading,
    val exit: AskExit? = null,
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class VouchAskViewModel @Inject constructor(
    private val invites: InvitesRepository,
    private val account: AccountRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
    private val signals: StanceSignals,
    private val kept: KeptPickStore,
) : ViewModel() {

    private val _state = MutableStateFlow(VouchAskUiState())
    val state = _state.asStateFlow()

    private val pad = MutableStateFlow<ApprovalPad?>(null)

    val padState: StateFlow<ApprovalPadState?> = pad
        .flatMapLatest { it?.state ?: flowOf(null) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private var askLinkId: String? = null
    private var member = false

    /** The pad over the ask, once the ask stands. */
    fun approvalPad(): ApprovalPad? = pad.value

    /** Reads the link for this reader; [signedIn] is the shell's answer, never guessed. */
    fun load(askLinkId: String, signedIn: Boolean) {
        if (this.askLinkId == askLinkId && _state.value.landing != AskLanding.Fault) return
        this.askLinkId = askLinkId
        _state.update { it.copy(landing = AskLanding.Reading) }
        viewModelScope.launch {
            if (!signedIn) {
                member = false
                when (val check = invites.askLinkCheck(askLinkId)) {
                    is Outcome.Success -> settle(check.value)
                    else -> _state.update { it.copy(landing = AskLanding.Fault) }
                }
                return@launch
            }
            val me = async { account.me() }
            val mine = async { invites.myApplication() }
            val check = async { invites.askLinkCheck(askLinkId) }
            // The reader's own case answers first, at app-open, whatever the
            // link's state (VouchAsk.md:13-15, :49).
            val own = (mine.await() as? Outcome.Success)?.value?.askLink == askLinkId
            val profile = me.await()
            when {
                own -> exit(AskExit.AppOpen(R.string.vouch_ask_own))
                profile is Outcome.Success && profile.value?.accountState != AccountState.MEMBER ->
                    exit(AskExit.AppOpen(R.string.vouch_ask_once_in))
                else -> {
                    val read = check.await()
                    if (profile !is Outcome.Success || read !is Outcome.Success) {
                        _state.update { it.copy(landing = AskLanding.Fault) }
                    } else {
                        member = true
                        settle(read.value)
                    }
                }
            }
        }
    }

    /** The page took its exit; it says nothing twice. */
    fun onExitTaken() = _state.update { it.copy(exit = null) }

    private fun exit(to: AskExit) = _state.update { it.copy(exit = to) }

    private fun settle(check: AskLinkCheck?) {
        if (check == null) {
            _state.update { it.copy(landing = AskLanding.Invalid) }
            return
        }
        val handle = check.applicantHandle
        when {
            member && check.reason == AskLinkUnusableReason.WAITING_ON_VIEWER ->
                exit(AskExit.Invites(InvitesNotice.AlreadyWaiting(handle)))
            check.reason == AskLinkUnusableReason.LANDED ->
                _state.update { it.copy(landing = AskLanding.Landed(handle)) }
            else -> {
                pad.value = ApprovalPad(
                    scope = viewModelScope,
                    invites = invites,
                    signer = signer,
                    identity = identity,
                    signals = signals,
                    source = ApprovalSource.Ask(checkNotNull(askLinkId)),
                    onOutcome = { outcome -> onOutcome(handle, outcome) },
                    kept = kept,
                )
                _state.update { it.copy(landing = AskLanding.Ask(handle)) }
            }
        }
    }

    private fun onOutcome(handle: String, outcome: ApprovalOutcome) {
        when (outcome) {
            is ApprovalOutcome.Signed -> exit(AskExit.Invites(InvitesNotice.Signed(handle, outcome.landing)))
            // Staged, nothing signed or spent: Invites opens at their row (VouchAskPad.md:33).
            is ApprovalOutcome.NotRegistered -> exit(AskExit.Invites(InvitesNotice.NotRegistered(handle)))
            // The link changed under the ask: show its new state (VouchAskPad.md:27).
            ApprovalOutcome.Unusable -> recheck()
        }
    }

    private fun recheck() {
        val id = askLinkId ?: return
        viewModelScope.launch {
            when (val check = invites.askLinkCheck(id)) {
                is Outcome.Success -> {
                    pad.value = null
                    settle(check.value)
                }
                else -> _state.update { it.copy(landing = AskLanding.Fault) }
            }
        }
    }
}
