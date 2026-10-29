// APPROVING IS VOUCHING (ApprovePad.md:5): the approval pad IS the opinion
// pad — the design system's own `StanceControl`, the same anchor and the same
// acts, never a button labelled Approve. What differs is only what a vouch-in
// signs through, so this holder drives the control over the approval seam the
// way `StanceViewModel` drives it over a node's bundle. web's twin is
// `web/src/lib/invites/approval-stance-data.ts`.
//
// - THE STANDING IS EMPTY. An applicant has no node anyone has stanced yet,
//   so the landing of a pick is the pick itself, and a (0, 0) pick is an
//   EMPTY SIGN — never a walk-back (ApprovePad.md:43). With `vouchesIn` the
//   control's ask warns that they start out cut off, and `Set it anyway` IS
//   the approval (:45).
// - THE COMMIT IS THE APPROVAL: `approveApplicants` with exactly the pick,
//   then the device signs the approver's Opinion it returns, checked against
//   the applicant the row named (Intent.kt). The write rule stays a notice.
// - THE ASK LINK STAGES FIRST (api-spec.md "The ask link": `stageApplicant`
//   then the ordinary approval). The staged row is HELD, so a Retry after a
//   fault retries the approval only — a second stage would answer
//   WAITING_ON_VIEWER (packet residual flag "Kept-approval retry").
// - AN APPROVAL THAT LANDED KEEPS LANDED: if the vouch's signing did not
//   finish, Retry resumes the parked signing; it never approves twice.

package com.cogra.feature.invites

import com.cogra.core.designsystem.EmptySignPrompt
import com.cogra.core.designsystem.StanceControlState
import com.cogra.core.designsystem.StanceInputSurface
import com.cogra.core.designsystem.StanceLanding
import com.cogra.core.designsystem.StancePadMode
import com.cogra.core.designsystem.StancePoint
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.InvitesRepository
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.stanceRecord
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.isWriteRule
import com.cogra.domain.stance.localLanding
import com.cogra.domain.store.IdentityStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** What the pad approves: a row already in the reader's queue, or the asker an ask link stages. */
sealed interface ApprovalSource {
    data class Queued(val application: ApplicationInfo) : ApprovalSource

    data class Ask(val askLinkId: String) : ApprovalSource
}

/** How a commit ended, for the host to route on. */
sealed interface ApprovalOutcome {
    /** The vouch was taken: the row leaves, the signed line says where the reader stands. */
    data class Signed(val application: ApplicationInfo, val landing: StancePair) : ApprovalOutcome

    /** Staged, but the asker is not fully registered: nothing signed or spent (VouchAskPad.md:33). */
    data class NotRegistered(val application: ApplicationInfo) : ApprovalOutcome

    /** The ask link stages nobody for this reader any more: re-read it (VouchAskPad.md:27). */
    data object Unusable : ApprovalOutcome
}

/** One approval pad's state, as the control draws it. */
data class ApprovalPadState(
    val pad: StancePadMode = StancePadMode.CLOSED,
    val pick: StancePair = StancePair.TapDefault,
    val busy: Boolean = false,
    val failed: Boolean = false,
    val needsKey: Boolean = false,
    val writeRule: Boolean = false,
    val keyAbsent: Boolean = false,
    val emptySign: EmptySignPrompt? = null,
    val inputMode: StanceInputMode = StanceInputMode.Default,
) {
    /** Over nothing standing, a pick lands where it points. */
    val landing get() = localLanding(StancePair.Origin, pick)

    fun toControlState(): StanceControlState = StanceControlState(
        pick = StancePoint(pick.pDirected, pick.pInterest),
        pad = pad,
        // No record ever signed toward an applicant: the resting face is the
        // unauthored affordance, and the pad carries no Walk it back (:9).
        standing = null,
        landing = if (pad == StancePadMode.CLOSED) {
            null
        } else {
            landing.let {
                StanceLanding(
                    net = StancePoint(it.net.pDirected, it.net.pInterest),
                    inertDirected = it.inertDirected,
                    inertInterest = it.inertInterest,
                    severance = it.severance,
                )
            }
        },
        busy = busy,
        failed = failed,
        needsKey = needsKey,
        inputMode = when (inputMode) {
            StanceInputMode.PAD -> StanceInputSurface.PAD
            StanceInputMode.SLIDERS -> StanceInputSurface.SLIDERS
            StanceInputMode.ENTRY -> StanceInputSurface.ENTRY
        },
        emptySign = emptySign,
        writeRule = writeRule,
        keyAbsent = keyAbsent,
    )
}

/**
 * The approval seam under the stance control, for one [source]. Lives in its
 * host's view-model scope; [onOutcome] hears every commit that ended other
 * than in a fault or a notice.
 */
@Suppress("TooManyFunctions") // one entry per gesture the control raises, plus the seam's roads to the act
class ApprovalPad(
    private val scope: CoroutineScope,
    private val invites: InvitesRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
    private val signals: StanceSignals,
    val source: ApprovalSource,
    private val onOutcome: (ApprovalOutcome) -> Unit,
) {
    private val _state = MutableStateFlow(ApprovalPadState())
    val state: StateFlow<ApprovalPadState> = _state.asStateFlow()

    /** The row the ask link staged, held for a Retry of the approval only. */
    private var staged: ApplicationInfo? = (source as? ApprovalSource.Queued)?.application

    /** The approval landed but its vouch's signing did not finish: Retry resumes it. */
    private var approvalLanded = false

    /** The tap: blooms the pad at the standing low default, staging nothing (ApprovePad.md:3, :7). */
    fun open() = openAt(StancePadMode.STICKY)

    /** The non-drag door, and the tap for a reader whose chosen input is sliders or typed values. */
    fun openAlternates() = openAt(StancePadMode.ALTERNATES)

    private fun openAt(mode: StancePadMode) {
        scope.launch {
            val inputMode = identity.stanceInputMode.first()
            val shown = if (mode == StancePadMode.STICKY && inputMode != StanceInputMode.PAD) {
                StancePadMode.ALTERNATES
            } else {
                mode
            }
            val keyHere = identity.actorSeed() != null
            _state.update {
                it.copy(
                    pad = shown,
                    pick = StancePair.TapDefault,
                    failed = false,
                    writeRule = false,
                    keyAbsent = !keyHere,
                    inputMode = inputMode,
                )
            }
        }
    }

    fun pick(pick: StancePair) = _state.update { it.copy(pick = pick) }

    /** Cancel, the wash, Back: the pad closes and nothing is signed (:29, :31). */
    fun dismiss() = _state.update {
        if (it.busy || it.emptySign?.working == true) it else ApprovalPadState(inputMode = it.inputMode)
    }

    /** Set: a (0, 0) pick asks the empty sign's question first; anything else signs (:43). */
    fun commit() {
        val current = _state.value
        if (current.busy) return
        if (current.landing.severance) {
            _state.update { it.copy(emptySign = EmptySignPrompt()) }
            return
        }
        sign(current.pick)
    }

    /** The press-and-hold reaching 500ms: the modest positive default, signed without the pad. */
    fun hold() {
        if (_state.value.busy) return
        scope.launch {
            if (identity.actorSeed() == null) {
                // With the key elsewhere a hold opens the pad carrying the
                // key notice, as a tap does, and signs nothing (PadKeyAbsent.md:5).
                openAt(StancePadMode.STICKY)
                return@launch
            }
            sign(StancePair.TapDefault)
        }
    }

    /** `Set it anyway`: the empty record IS the vouch-in (:45). */
    fun confirmEmptySign() {
        val ask = _state.value.emptySign ?: return
        if (ask.working) return
        _state.update { it.copy(emptySign = EmptySignPrompt(working = true)) }
        sign(_state.value.pick, fromEmptySign = true)
    }

    /** `Keep it`, the scrim or Back on the empty sign's ask: the pad keeps its pick. */
    fun dismissEmptySign() = _state.update { if (it.emptySign?.working == true) it else it.copy(emptySign = null) }

    private fun sign(pick: StancePair, fromEmptySign: Boolean = false) {
        if (!fromEmptySign) _state.update { it.copy(busy = true, failed = false, needsKey = false, writeRule = false) }
        scope.launch {
            val ended = attempt(pick)
            _state.update { state ->
                when (ended) {
                    Ended.Taken, Ended.Detoured -> ApprovalPadState(inputMode = state.inputMode)
                    Ended.Failed -> state.copy(
                        busy = false,
                        failed = !fromEmptySign,
                        emptySign = if (fromEmptySign) EmptySignPrompt(failed = true) else null,
                    )
                    Ended.NeedsKey -> state.copy(busy = false, needsKey = true, keyAbsent = true, emptySign = null)
                    Ended.WriteRule -> state.copy(busy = false, writeRule = true, emptySign = null)
                }
            }
        }
    }

    private enum class Ended { Taken, Detoured, Failed, NeedsKey, WriteRule }

    private suspend fun attempt(pick: StancePair): Ended {
        if (approvalLanded) return resumeSigning(pick)
        val application = when (val resolved = resolve()) {
            is Resolved.Row -> resolved.application
            is Resolved.Detour -> {
                onOutcome(resolved.outcome)
                return Ended.Detoured
            }
            Resolved.Fault -> return Ended.Failed
        }
        // A row without the applicant's node has no key attached, and
        // nothing approvable to bind a vouch to.
        val graphId = application.graphId ?: return Ended.Failed
        // The vouch is this device's signature, so the gate sits BEFORE the
        // priced approval: without the key the approval must not land only to
        // strand the unsigned vouch.
        if (identity.actorSeed() == null) return Ended.NeedsKey
        val prepared = when (val outcome = invites.approveApplication(application.id, pick.pDirected, pick.pInterest)) {
            is Outcome.Success -> outcome.value
            is Outcome.Refused -> return if (isWriteRule(outcome.errors)) Ended.WriteRule else Ended.Failed
            is Outcome.Failed -> return Ended.Failed
        }
        approvalLanded = true
        val results = try {
            signer.sign(prepared, Expectation(listOf(stanceRecord(graphId, pick.pDirected, pick.pInterest))))
        } catch (_: NoActorKeyException) {
            return Ended.NeedsKey
        }
        return finish(application, pick, results)
    }

    private suspend fun resumeSigning(pick: StancePair): Ended {
        val application = staged ?: return Ended.Failed
        val results = try {
            signer.resume()
        } catch (_: NoActorKeyException) {
            return Ended.NeedsKey
        }
        return finish(application, pick, results)
    }

    private fun finish(application: ApplicationInfo, pick: StancePair, results: List<WriteResult>): Ended {
        if (results.all { it is WriteResult.Done }) {
            signals.announceSigned()
            onOutcome(ApprovalOutcome.Signed(application, pick))
            return Ended.Taken
        }
        val refusal = results.filterIsInstance<WriteResult.Refused>().flatMap { it.errors }
        return if (isWriteRule(refusal)) Ended.WriteRule else Ended.Failed
    }

    private sealed interface Resolved {
        data class Row(val application: ApplicationInfo) : Resolved

        data class Detour(val outcome: ApprovalOutcome) : Resolved

        data object Fault : Resolved
    }

    /** The row the approval binds to: the queued one, or the asker the ask link stages (once). */
    private suspend fun resolve(): Resolved {
        staged?.let { return detourIfUnready(it) }
        val askLink = (source as? ApprovalSource.Ask)?.askLinkId ?: return Resolved.Fault
        return when (val outcome = invites.stageApplicant(askLink)) {
            is Outcome.Success -> {
                staged = outcome.value
                detourIfUnready(outcome.value)
            }
            is Outcome.Refused -> if (outcome.errors.any { it.code == ErrorCode.ASK_LINK_UNUSABLE }) {
                Resolved.Detour(ApprovalOutcome.Unusable)
            } else {
                Resolved.Fault
            }
            is Outcome.Failed -> Resolved.Fault
        }
    }

    /** An ask-link take-up of an asker not fully registered stops at the stage (VouchAskPad.md:33). */
    private fun detourIfUnready(application: ApplicationInfo): Resolved =
        if (source is ApprovalSource.Ask && !application.approvable) {
            Resolved.Detour(ApprovalOutcome.NotRegistered(application))
        } else {
            Resolved.Row(application)
        }
}
