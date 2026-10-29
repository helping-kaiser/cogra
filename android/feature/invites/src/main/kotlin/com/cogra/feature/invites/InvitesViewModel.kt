// INVITES' STATE HOLDER (behavior/Invites.md and its siblings): the one queue
// read spanning both ends of the funnel, the usable links, the create sheet
// in its two stages, the two closing dialogs and the approval pad. Everything
// the screen decides that is not drawing is here; the order law is
// core:domain's (`layoutQueue`). web's twin is
// `web/src/app/(app)/invites/invites-view.tsx`.

package com.cogra.feature.invites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.AccountState
import com.cogra.domain.Outcome
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.invites.ApplicationGroup
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.InviteLinkInfo
import com.cogra.domain.invites.InvitesRead
import com.cogra.domain.invites.InvitesRepository
import com.cogra.domain.invites.QueueLayout
import com.cogra.domain.invites.layoutQueue
import com.cogra.domain.invites.liveLinks
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.KeptPickStore
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

private const val DAY_HOURS = 24L
private const val WEEK_DAYS = 7L
private const val MONTH_DAYS = 30L

/** The three lengths, and no custom date (InviteExpiry.md:5). */
enum class ExpiryChoice(val lifetime: Duration) {
    HOURS_24(Duration.ofHours(DAY_HOURS)),
    DAYS_7(Duration.ofDays(WEEK_DAYS)),
    DAYS_30(Duration.ofDays(MONTH_DAYS)),
    ;

    companion object {
        /** The sheet opens at 7 days (InviteNew.md:9). */
        val Default = DAYS_7
    }
}

/** The create sheet, in its two stages, with the expiry chooser over it. */
data class InviteSheetState(
    /** `Only one person can use it` stands on when the sheet opens (InviteNew.md:7). */
    val singleUse: Boolean = true,
    val expiry: ExpiryChoice = ExpiryChoice.Default,
    val choosing: Boolean = false,
    val creating: Boolean = false,
    val failed: Boolean = false,
    /** The fresh link: the sheet's second stage (InviteCreated.md). */
    val created: InviteLinkInfo? = null,
)

/** What a closing dialog closes. */
sealed interface CloseTarget {
    data class One(val application: ApplicationInfo) : CloseTarget

    data class All(val group: ApplicationGroup) : CloseTarget
}

/** A closing dialog up: what it closes and how its one act is going. */
data class ClosingState(
    val target: CloseTarget,
    val working: Boolean = false,
    val failed: Boolean = false,
)

/** The page's one-shot snackbars. */
sealed interface InvitesSnack {
    data object LinkCopied : InvitesSnack

    data object Revoked : InvitesSnack

    data class FinishRegistering(val handle: String) : InvitesSnack

    data class AlreadyWaiting(val handle: String) : InvitesSnack

    /** The vouch landed: `Signed, still settling. Current opinion …`. */
    data class Signed(val landing: StancePair) : InvitesSnack
}

/** Where focus goes once a row or a card removes itself (Invites.md:61). */
data class FocusAfter(val section: Section, val index: Int) {
    enum class Section { APPLICATION, LINK }
}

data class InvitesUiState(
    /** Null until the first read answers. */
    val read: InvitesRead? = null,
    /** The last read did not go through: the fault line, beside what the page shows. */
    val fault: Boolean = false,
    val refreshing: Boolean = false,
    /** The reader is not a member: Invites never stands for them (ProfileApplicant.md:18). */
    val notMember: Boolean = false,
    val revoking: String? = null,
    val revokeFailed: Boolean = false,
    val sheet: InviteSheetState? = null,
    val closing: ClosingState? = null,
    /** The application whose approval pad is up. */
    val approvingId: String? = null,
    val snack: InvitesSnack? = null,
    val focusAfter: FocusAfter? = null,
    /** The handle (without @) an ask link's arrival stands at, once. */
    val standAt: String? = null,
    /** The vouches kept on this device, by application id (Invites.md:85). */
    val keptApprovals: Map<String, StancePair> = emptyMap(),
    /** The signing key is not on this device: a kept approval reads `Waiting for your key` (:87). */
    val keyAbsent: Boolean = false,
) {
    val layout: QueueLayout get() = layoutQueue(read?.queue.orEmpty())
    val links: List<InviteLinkInfo> get() = liveLinks(read?.links.orEmpty())

    /** InvitesEmpty: no application waits and no link is live. */
    val empty: Boolean get() = read != null && layout.isEmpty && links.isEmpty()
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
@Suppress("TooManyFunctions") // one handler per drawn gesture across the page's six boards
class InvitesViewModel @Inject constructor(
    private val invites: InvitesRepository,
    private val account: AccountRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
    private val signals: StanceSignals,
    @WebOrigin private val webOrigin: String,
    /** The vouches kept for the key, each waiting on its application's row (Invites.md:85-:103). */
    private val kept: KeptPickStore,
) : ViewModel() {

    private val _state = MutableStateFlow(InvitesUiState())
    val state = _state.asStateFlow()

    private val pad = MutableStateFlow<ApprovalPad?>(null)

    /** The approval pad's own state, while one is up. */
    val padState: StateFlow<ApprovalPadState?> = pad
        .flatMapLatest { it?.state ?: flowOf(null) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    /** The clock captions are read against; a test pins it. */
    var now: () -> Instant = Instant::now

    init {
        viewModelScope.launch {
            val me = account.me()
            if (me is Outcome.Success && me.value?.accountState != AccountState.MEMBER) {
                _state.update { it.copy(notMember = true) }
            }
        }
        viewModelScope.launch {
            kept.watch().collect { picks ->
                val approvals = picks.filter { it.family == KeptFamily.APPROVAL }
                    .associate { (it.target as StanceTarget.Node).id to it.pick }
                _state.update { it.copy(keptApprovals = approvals) }
            }
        }
        onResume()
        refresh()
    }

    /** The invite link whole — the id inside it is the capability (auth.md "Link URLs"). */
    fun joinUrl(link: InviteLinkInfo): String = "$webOrigin/join/${link.id}"

    /** An ask link's arrival: its snackbar, and the row to stand at (VouchAsk.md:17, :27, :31). */
    fun onArrival(notice: InvitesNotice) = _state.update {
        it.copy(
            snack = when (notice) {
                is InvitesNotice.AlreadyWaiting -> InvitesSnack.AlreadyWaiting("@${notice.handle}")
                is InvitesNotice.NotRegistered -> InvitesSnack.FinishRegistering("@${notice.handle}")
                is InvitesNotice.Signed -> InvitesSnack.Signed(notice.landing)
            },
            standAt = notice.handle.takeIf { _ -> notice !is InvitesNotice.Signed },
        )
    }

    fun onSnackShown() = _state.update { it.copy(snack = null) }

    fun onFocusMoved() = _state.update { it.copy(focusAfter = null, standAt = null) }

    /** Pull down at the top: the page refreshes (Invites.md:91). */
    fun onPull() {
        _state.update { it.copy(refreshing = true) }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch { read() }
    }

    private suspend fun read() {
        when (val outcome = invites.invites()) {
            is Outcome.Success -> _state.update { it.copy(read = outcome.value, fault = false, refreshing = false) }
            else -> _state.update { it.copy(fault = true, refreshing = false) }
        }
    }

    // ── The rows ─────────────────────────────────────────────────────────

    /**
     * A row's tap: a ready row blooms the pad on that applicant, staging
     * nothing; a row not fully registered answers with a snackbar and never
     * opens the pad (Invites.md:39-41, ApprovePad.md:3).
     */
    fun onOpenRow(application: ApplicationInfo) {
        val held = _state.value.keptApprovals[application.id]
        // A KEPT APPROVAL WITH THE KEY ELSEWHERE meets the key notice, as a kept
        // pick's face does, whatever its asker's registration (Invites.md:93):
        // the pad opens holding the kept vouch, its notice in place of Set.
        val keyNotice = held != null && _state.value.keyAbsent
        if (!application.approvable && !keyNotice) {
            _state.update { it.copy(snack = InvitesSnack.FinishRegistering("@${application.handle}")) }
            return
        }
        if (_state.value.approvingId != null) return
        val opened = ApprovalPad(
            scope = viewModelScope,
            invites = invites,
            signer = signer,
            identity = identity,
            signals = signals,
            source = ApprovalSource.Queued(application),
            onOutcome = ::onApprovalOutcome,
            kept = kept,
            // Back, the kept approval signs only through this pad, holding the
            // vouch that waited (:95, :99; ApprovePad.md:41).
            held = held,
        )
        pad.value = opened
        _state.update { it.copy(approvingId = application.id) }
        opened.open()
    }

    /**
     * The page came back (ON_RESUME): whether the key is here is read again,
     * so a restore taken on its own screen turns a kept approval's line from
     * `Waiting for your key` to `Ready for your approval` (Invites.md:87-:89).
     */
    fun onResume() {
        viewModelScope.launch {
            val keyHere = identity.actorSeed() != null
            _state.update { it.copy(keyAbsent = !keyHere) }
        }
    }

    /** The approval pad itself, for the control's callbacks; null while none is up. */
    fun approvalPad(): ApprovalPad? = pad.value

    /** Cancel, the wash or Back: the pad closes onto Invites, nothing signed (ApprovePad.md:29-31). */
    fun onApprovalDismissed() {
        val open = pad.value ?: return
        open.dismiss()
        if (open.state.value.busy || open.state.value.emptySign?.working == true) return
        pad.value = null
        _state.update { it.copy(approvingId = null) }
    }

    private fun onApprovalOutcome(outcome: ApprovalOutcome) {
        if (outcome !is ApprovalOutcome.Signed) return
        val index = indexOf(outcome.application.id)
        pad.value = null
        // The vouch lands, the row leaves the queue and the snackbar says
        // where the reader now stands (ApprovePad.md:37).
        _state.update {
            it.copy(
                approvingId = null,
                snack = InvitesSnack.Signed(outcome.landing),
                focusAfter = FocusAfter(FocusAfter.Section.APPLICATION, index),
            )
        }
        refresh()
    }

    private fun indexOf(applicationId: String): Int =
        _state.value.layout.rows.indexOfFirst { it.id == applicationId }.coerceAtLeast(0)

    // ── The closing dialogs ──────────────────────────────────────────────

    fun onCloseRow(application: ApplicationInfo) = _state.update {
        it.copy(closing = ClosingState(CloseTarget.One(application)))
    }

    fun onCloseAll(group: ApplicationGroup) = _state.update { it.copy(closing = ClosingState(CloseTarget.All(group))) }

    /** Keep, the scrim or Back: nothing is closed — but never while the closing is in flight. */
    fun onKeep() = _state.update { if (it.closing?.working == true) it else it.copy(closing = null) }

    /** `Close it` / `Close them`: the dialog stays up and locked until the closing answers. */
    fun onConfirmClose() {
        val closing = _state.value.closing ?: return
        if (closing.working) return
        _state.update { it.copy(closing = closing.copy(working = true, failed = false)) }
        viewModelScope.launch {
            val first = when (val target = closing.target) {
                is CloseTarget.One -> target.application
                is CloseTarget.All -> target.group.rows.first()
            }
            val outcome = when (val target = closing.target) {
                is CloseTarget.One -> invites.rejectApplication(target.application.id)
                is CloseTarget.All -> invites.rejectLinkApplications(target.group.linkId)
            }
            if (outcome is Outcome.Success) {
                val index = indexOf(first.id)
                // A kept approval's closing drops its kept vouch, nothing signed
                // (Invites.md:103, RejectConfirm.md:7).
                val closed = when (val target = closing.target) {
                    is CloseTarget.One -> listOf(target.application)
                    is CloseTarget.All -> target.group.rows
                }
                kept.drop(closed.map { approvalTarget(it.id) }, KeptFamily.APPROVAL)
                read()
                _state.update {
                    it.copy(closing = null, focusAfter = FocusAfter(FocusAfter.Section.APPLICATION, index))
                }
            } else {
                // The dialog stays up with its pair, the application still waiting (RejectConfirm.md:23).
                _state.update { it.copy(closing = closing.copy(working = false, failed = true)) }
            }
        }
    }

    // ── The links ────────────────────────────────────────────────────────

    fun onLinkCopied() = _state.update { it.copy(snack = InvitesSnack.LinkCopied) }

    /**
     * Revoke: the card holds until the revoke answers, refuses a second press,
     * and no dialog asks (Invites.md:49-53). A revoke that did not go through
     * keeps the card and answers in the network fault's grammar (:59).
     */
    fun onRevoke(link: InviteLinkInfo) {
        if (_state.value.revoking != null) return
        val index = _state.value.links.indexOfFirst { it.id == link.id }.coerceAtLeast(0)
        _state.update { it.copy(revoking = link.id, revokeFailed = false) }
        viewModelScope.launch {
            when (invites.revokeInviteLink(link.id)) {
                is Outcome.Success -> {
                    read()
                    _state.update {
                        it.copy(
                            revoking = null,
                            snack = InvitesSnack.Revoked,
                            focusAfter = FocusAfter(FocusAfter.Section.LINK, index),
                        )
                    }
                }
                else -> _state.update { it.copy(revoking = null, revokeFailed = true) }
            }
        }
    }

    // ── The create sheet ─────────────────────────────────────────────────

    fun onOpenSheet() = _state.update { it.copy(sheet = InviteSheetState()) }

    /** The scrim, a swipe, Back: the sheet closes, nothing created — the next open starts at the defaults. */
    fun onCloseSheet() = _state.update { if (it.sheet?.creating == true) it else it.copy(sheet = null) }

    fun onSingleUseChange(on: Boolean) = updateSheet { it.copy(singleUse = on) }

    fun onOpenExpiry() = updateSheet { it.copy(choosing = true) }

    fun onCloseExpiry() = updateSheet { it.copy(choosing = false) }

    /** A tap picks and closes, no Done (InviteExpiry.md:9). */
    fun onPickExpiry(choice: ExpiryChoice) = updateSheet { it.copy(expiry = choice, choosing = false) }

    /** `Create invite`: the link is made with the staged choices, and the sheet turns to the fresh link. */
    fun onCreate() {
        val sheet = _state.value.sheet ?: return
        if (sheet.creating || sheet.created != null) return
        updateSheet { it.copy(creating = true, failed = false) }
        viewModelScope.launch {
            val outcome = invites.createInviteLink(now().plus(sheet.expiry.lifetime), sheet.singleUse)
            if (outcome is Outcome.Success) {
                updateSheet { it.copy(creating = false, created = outcome.value) }
                read()
            } else {
                // The staged choices stay as they were (InviteNew.md:23).
                updateSheet { it.copy(creating = false, failed = true) }
            }
        }
    }

    private fun updateSheet(block: (InviteSheetState) -> InviteSheetState) = _state.update { state ->
        state.sheet?.let { state.copy(sheet = block(it)) } ?: state
    }
}
