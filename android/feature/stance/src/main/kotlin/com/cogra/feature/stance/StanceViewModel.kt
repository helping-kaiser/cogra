// The stance control's state holder (roadmap "Slice 2.2"; design.md §8).
//
// One holder serves every control on a destination — a feed is a list of
// them — so the state is a map keyed by target rather than a single
// control's worth of fields. Each entry carries what its pad shows: the
// pick under the thumb, the standing the fold reports, where that pick
// leaves the bundle, and the severance prompt when one is open.
//
// The raw-edge rule lives here: a commit sends the picked pair and
// nothing else. This class never derives a delta against the bundle —
// the record carries what was picked (design.md §8.1, api-spec.md
// "Stance prepares write the picked values").
//
// The standing is READ from the repository. The landing is FOLDED here,
// from the raw sums that read carries, because a round trip per pick
// left the second number arriving about a second after the first and
// the two stopped reading as one control. That fold is display only:
// it clips a sum for the reader's eyes, it never changes what is
// written, and the backend's answer remains the authority once a record
// is signed (design.md §8.3).

package com.cogra.feature.stance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.has
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.severance
import com.cogra.domain.signing.stanceRecord
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StanceInputMode
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.stance.isEmptySign
import com.cogra.domain.stance.localLanding
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Where one control's pad is (mirrors the design system's own mode). */
enum class PadMode { CLOSED, STICKY, ALTERNATES }

/** One target's control, as the screen renders it. */
data class TargetStance(
    val pick: StancePair = StancePair.Origin,
    val pad: PadMode = PadMode.CLOSED,
    /**
     * The fold's answer, or null when the reader has authored nothing
     * toward this target — which is what the resting target renders as
     * the labelled affordance rather than a folded pair (design.md §8.3).
     * A bundle folding to the origin is NOT nothing: [standingRecords] is
     * what tells the two apart, and [standingSevered] which zero it is.
     */
    val standing: StancePair? = null,
    /**
     * The bundle is walked back to nothing (`StanceBundle.severed`). A
     * standing at the origin that is not severed is an empty sign's.
     */
    val standingSevered: Boolean = false,
    /**
     * The raw sums behind [standing], before the clip. The landing is
     * folded from THESE, locally and instantly; folding the clipped
     * standing would be wrong for any bundle already past `±1`.
     * Null until the fold has answered once.
     */
    val standingRaw: StancePair? = null,
    val standingRecords: Int = 0,
    /** The fold has answered at least once; a failed read has not. */
    val standingRead: Boolean = false,
    /** The shown standing counts a record still being signed. */
    val standingPending: Boolean = false,
    /** Where [pick] leaves the bundle; null while the fold is in flight. */
    val landing: StanceProjection? = null,
    val busy: Boolean = false,
    val failed: Boolean = false,
    /** The failure is a husk device, not a fault: the key has to come back. */
    val needsKey: Boolean = false,
    val severance: SeveranceState? = null,
    /** The empty sign's ask, open over the parked pad (`EmptySignConfirm`). */
    val emptySign: EmptySignState? = null,
    /**
     * A stance just signed, as the standing it left the reader at. A
     * one-shot: the screen shows it once and calls
     * [StanceViewModel.onConfirmationShown] (design.md §8.3).
     */
    val confirmation: StancePair? = null,
    /**
     * A walk-back just taken, as the number of things it signed — the same
     * one-shot as [confirmation] (`Signed 3 things, still settling. You've
     * walked … back to nothing.`).
     */
    val walkedBack: Int? = null,
    /**
     * A signing on this target was just taken — by Set or by the hold. A
     * one-shot for a host that routes on it (the vouch-back's ceremony,
     * VouchBackPad.md:33); consumed by [StanceViewModel.onTakenShown].
     */
    val taken: Boolean = false,
    /**
     * The write rule refused the last signing (PadWriteRule.md): a notice,
     * not a fault — nothing staged, signed or spent.
     */
    val writeRule: Boolean = false,
    /**
     * The last pick sent to be signed, so the row's Retry asks that act again
     * (the master's `sent`; round 21, ask 16).
     */
    val sent: StancePair? = null,
)

/**
 * Where [pick] leaves this bundle, folded locally — or null while the
 * raw sums are still unknown, which is the one case the pad has nothing
 * honest to show yet.
 */
private fun TargetStance.landingFor(pick: StancePair): StanceProjection? =
    standingRaw?.let { localLanding(it, pick) }

/** The same fold against freshly read sums, for a pad that is open. */
private fun TargetStance.landingForRaw(raw: StancePair): StanceProjection? =
    if (pad == PadMode.CLOSED) null else localLanding(raw, pick)

/** An open severance confirmation and how it was reached. */
data class SeveranceState(
    val quote: SeveranceQuote,
    /** Reached by an ordinary pick landing on zero rather than by the route. */
    val fromPick: Boolean,
    val working: Boolean = false,
    val failed: Boolean = false,
    /** The write rule refused the walk-back: a notice, not a fault (round 21, ask 15). */
    val writeRule: Boolean = false,
)

/** An open empty-sign ask and its one signing's progress. */
data class EmptySignState(
    val working: Boolean = false,
    val failed: Boolean = false,
    /** The write rule refused the empty sign — [SeveranceState.writeRule]'s state. */
    val writeRule: Boolean = false,
)

data class StanceUiState(
    val targets: Map<StanceTarget, TargetStance> = emptyMap(),
    /**
     * The control whose open pad is the account's first-ever pad open,
     * and so carries the two coaching lines (stance-control.md "Teaching
     * it"). Cleared the moment that pad closes: the lines close with it.
     */
    val coachingTarget: StanceTarget? = null,
    /** The reader's chosen input surface, the same on every control (design.md §8.6). */
    val inputMode: StanceInputMode = StanceInputMode.Default,
    /**
     * The reader still borrows a view (the master's `borrowed`; jakob
     * 2026-10-20, seam 240): no outgoing opinion with neither number at zero
     * yet. Read afresh on every open, so an unreachable or severed landing
     * can warn that the pick would keep the borrowed view.
     */
    val borrowed: Boolean = false,
    /**
     * The signing key is not in this app (PadKeyAbsent.md): the pad opens
     * anyway, carrying the key notice in place of its actions.
     */
    val keyAbsent: Boolean = false,
)

@HiltViewModel
class StanceViewModel @Inject constructor(
    private val stances: StanceRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
    /** Every signing taken here is announced, for the borrowed-view band. */
    private val signals: StanceSignals,
    /** Whether the reader still borrows a view — `borrowedView`, the band's own read. */
    private val account: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(StanceUiState())
    val state = _state.asStateFlow()

    /** Targets whose standing read is in flight; a feed asks once, not per frame. */
    private val reading = mutableSetOf<StanceTarget>()

    /**
     * Whether the account's first-ever pad open has happened on this
     * device; null until the store answers. That open carries the two
     * coaching lines, and no later one does (stance-control.md "Teaching
     * it").
     */
    private var taught: Boolean? = null

    init {
        // Collected, not read once: choosing an alternate in Settings has
        // to reach controls already composed here (design.md §8.6).
        viewModelScope.launch {
            identity.stanceInputMode.collect { mode ->
                _state.update { it.copy(inputMode = mode) }
            }
        }
    }

    /**
     * Registers a control and reads the standing behind it. A read that
     * ANSWERED is not asked again — a node's bundle does not change
     * under the reader — but one that failed is, the next time the
     * control comes back into view. Otherwise a single transport blip
     * leaves that card a mystery button for the rest of the session.
     */
    fun observe(target: StanceTarget) {
        if (_state.value.targets[target]?.standingRead == true) return
        if (!reading.add(target)) return
        _state.update { state ->
            if (state.targets.containsKey(target)) {
                state
            } else {
                state.copy(targets = state.targets + (target to TargetStance()))
            }
        }
        viewModelScope.launch {
            if (taught == null) taught = identity.stancePadTaught()
            // Whether the key is here decides what a hold does (PadKeyAbsent.md:5).
            val keyHere = identity.actorSeed() != null
            _state.update { it.copy(keyAbsent = !keyHere) }
            readStanding(target)
            reading.remove(target)
        }
    }

    /**
     * The press-and-hold: commits the modest positive default outright,
     * without opening anything (design/guidelines/stance-control.md "The
     * gesture" — the shortcut that signs takes a held finger).
     */
    fun onHoldDefault(target: StanceTarget) = signFromRow(target, StancePair.TapDefault)

    /**
     * THE ROW'S RETRY ASKS THE ACT THAT WAS SENT (round 21, seam 245 ask 16;
     * PadFailed.md): the hold's default after a hold, the pick after a Set
     * whose pad was cancelled while it signed — never the hold's +0.10 /
     * +0.10 in a cancelled pick's place.
     */
    fun onRetrySigning(target: StanceTarget) =
        signFromRow(target, _state.value.targets[target]?.sent ?: StancePair.TapDefault)

    /** A signing the target's row sends — the hold, or its Retry — checked like Set. */
    private fun signFromRow(target: StanceTarget, pick: StancePair) {
        // With the key elsewhere a hold opens the pad carrying the key
        // notice, as a tap does, and signs nothing (PadKeyAbsent.md:5).
        if (_state.value.keyAbsent) return onOpenPad(target)
        // THE HOLD IS CHECKED LIKE SET (the master's `commitChecked(TAP_DEFAULT)`):
        // a default that nets the bundle to (0, 0) asks before it signs.
        val landed = _state.value.targets[target]?.landingFor(pick)
        if (landed?.severance == true) {
            update(target) { it.copy(pick = pick, landing = landed) }
            return askAtZero(target)
        }
        commit(target, pick)
    }

    /**
     * The tap: blooms the pad parked open, and stages nothing. It opens
     * AT the default, +0.10 / +0.10, so Set on a pick never moved signs
     * exactly what the hold would (stance-control.md "The gesture",
     * jakob 2026-10-05).
     *
     * The account's first-ever open carries the coaching lines. The flag
     * is written HERE, at the open, rather than on close: its meaning is
     * "the teaching open has happened", and a flag written later would
     * let a restart teach twice.
     */
    fun onOpenPad(target: StanceTarget) {
        // A reader who chose sliders or typed values meets the alternates
        // wherever the pad would bloom: the choice replaces the pad
        // everywhere (stance-control.md *Alternate and accessible inputs*).
        if (_state.value.inputMode != StanceInputMode.PAD) return onOpenAlternates(target)
        open(target, PadMode.STICKY)
        when (taught) {
            true -> Unit
            false -> teach(target)
            // The store has not answered yet: the pad opens at once, and
            // the coaching joins it when the answer arrives — but only if
            // that same pad is still the one standing open.
            null -> viewModelScope.launch {
                taught = identity.stancePadTaught()
                if (taught == false && _state.value.targets[target]?.pad == PadMode.STICKY) {
                    teach(target)
                }
            }
        }
    }

    /**
     * The pick under the thumb. The landing moves with it: the fold is
     * local arithmetic on the raw sums the surface was already served,
     * so there is no round trip to wait for and nothing to debounce
     * (design.md §8.3).
     */
    fun onPick(target: StanceTarget, pick: StancePair) {
        update(target) { it.copy(pick = pick, landing = it.landingFor(pick)) }
    }

    /**
     * Shuts the pad and stages nothing. Called on the way out of a
     * screen as well as by Cancel, so a shut pad is left strictly alone
     * — a feed asks this of every control it holds, and a dismissal that
     * touched state would churn the whole map for nothing.
     */
    fun onDismissPad(target: StanceTarget) {
        val entry = _state.value.targets[target] ?: return
        if (entry.pad == PadMode.CLOSED && entry.emptySign == null && entry.severance == null) return
        update(target) {
            // The asks sit over the parked pad and leave with it; one whose
            // signature is in flight is left to answer (as its own dismissal does).
            it.copy(
                pad = PadMode.CLOSED,
                pick = StancePair.Origin,
                landing = null,
                writeRule = false,
                emptySign = it.emptySign?.takeIf { ask -> ask.working },
                severance = it.severance?.takeIf { ask -> ask.working },
            )
        }
    }

    /**
     * The non-drag door, `Choose your opinion on …` (StanceControl.jsx
     * :601-614): the alternates, at the same default the pad opens at. It
     * spends the teaching as the master's does — a reader who has found the
     * considered route has met the gesture — without drawing the lines.
     */
    fun onOpenAlternates(target: StanceTarget) {
        open(target, PadMode.ALTERNATES)
        if (taught != true) {
            taught = true
            viewModelScope.launch { identity.markStancePadTaught() }
        }
    }

    /** Opens [target]'s considered route at the default, and asks whether the reader still borrows a view. */
    private fun open(target: StanceTarget, mode: PadMode) {
        update(target) {
            it.copy(
                pad = mode,
                pick = StancePair.TapDefault,
                landing = it.landingFor(StancePair.TapDefault),
                failed = false,
                writeRule = false,
            )
        }
        viewModelScope.launch {
            val borrowing = (account.borrowedView() as? Outcome.Success)?.value != null
            val keyHere = identity.actorSeed() != null
            _state.update { it.copy(borrowed = borrowing, keyAbsent = !keyHere) }
        }
    }

    /**
     * Commits the pick — unless it lands at (0, 0), which is asked about
     * rather than refused (design.md §8.2, §8.5): over anything standing
     * through the walk-back's own confirmation, over nothing through the
     * empty sign's ask.
     */
    fun onCommit(target: StanceTarget) {
        val entry = _state.value.targets[target] ?: return
        // A Set pressed before the standing has loaded has no landing to
        // check yet; it waits for the read rather than skipping the (0, 0)
        // ask, and a read that fails signs nothing (StanceControl.jsx `commitChecked`
        // always holds the bundle).
        if (entry.standingRaw == null) return commitOnceRead(target)
        if (entry.landing?.severance == true) return askAtZero(target)
        commit(target, entry.pick)
    }

    private fun commitOnceRead(target: StanceTarget) {
        if (_state.value.targets[target]?.busy == true) return
        update(target) { it.copy(busy = true, failed = false) }
        viewModelScope.launch {
            readStanding(target)
            val read = _state.value.targets[target] ?: return@launch
            update(target) { it.copy(busy = false) }
            when {
                read.standingRaw == null -> fail(target, needsKey = false)
                read.pad != PadMode.CLOSED -> onCommit(target)
            }
        }
    }

    /**
     * THE TRIGGER SPLIT (jakob 2026-10-21, seam 242; StanceControl.jsx
     * `commitChecked`): a landing at (0, 0) while nothing stands — no record,
     * or a bundle already walked back — is an empty sign and asks
     * `EmptySignConfirm`; over anything standing, an empty sign's standing
     * included, it is severance and asks `SeveranceConfirm`. Never a block.
     */
    private fun askAtZero(target: StanceTarget) {
        val entry = _state.value.targets[target] ?: return
        val landing = entry.landing ?: return
        if (isEmptySign(landing, entry.standingRecords, entry.standingSevered)) {
            update(target) { it.copy(emptySign = EmptySignState()) }
        } else {
            openSeverance(target, fromPick = true)
        }
    }

    /** `Keep it`, the scrim or Back on the empty sign's ask: the pad keeps its pick. */
    fun onDismissEmptySign(target: StanceTarget) = update(target) {
        if (it.emptySign?.working == true) it else it.copy(emptySign = null)
    }

    /**
     * `Set it anyway`: signs the one empty record like any Set — it counts,
     * the fold stays at (0, 0) and is not severed, and the ordinary
     * confirmation answers (jakob 2026-10-21). The ask stays up until that
     * one signature answers, and a signing that did not go through keeps it
     * up with the fault and `Retry`.
     */
    fun onConfirmEmptySign(target: StanceTarget) {
        val open = _state.value.targets[target]?.emptySign ?: return
        if (open.working || open.writeRule) return
        update(target) { it.copy(emptySign = EmptySignState(working = true)) }
        val pick = _state.value.targets[target]?.pick ?: return
        viewModelScope.launch {
            when (sign(target, pick)) {
                Signed.Done -> taken(target, pick)
                // The write rule's no is a notice (EmptySignConfirm.md, round 21):
                // the act dims and no Retry is offered.
                Signed.WriteRule -> update(target) { it.copy(emptySign = EmptySignState(writeRule = true)) }
                is Signed.Failed -> update(target) { it.copy(emptySign = EmptySignState(failed = true)) }
            }
        }
    }

    /** The route for the reader who came to sever (design.md §8.5). */
    fun onOpenSeverance(target: StanceTarget) = openSeverance(target, fromPick = false)

    /**
     * `Keep it`, the scrim or Back on the walk-back: the pad keeps its pick —
     * and, like `Keep it`, it waits while the dialog's act signs
     * (SeveranceConfirm.md; the master's Escape lock, round 21).
     */
    fun onDismissSeverance(target: StanceTarget) = update(target) {
        if (it.severance?.working == true) it else it.copy(severance = null)
    }

    fun onConfirmSeverance(target: StanceTarget) {
        val open = _state.value.targets[target]?.severance ?: return
        if (open.working || open.writeRule) return
        update(target) { it.copy(severance = open.copy(working = true, failed = false)) }
        // THE PICK ROUTE SIGNS EXACTLY ONE RECORD — the pick itself (jakob
        // 2026-10-05, P5; StanceControl.jsx `commitChecked`): it nets the
        // bundle to (0, 0) as an ordinary opinion would, and the dialog stays
        // up until that one signature answers.
        if (open.fromPick) {
            val pick = _state.value.targets[target]?.pick ?: return
            viewModelScope.launch {
                when (sign(target, pick)) {
                    Signed.Done -> taken(target, pick)
                    Signed.WriteRule -> severanceWriteRule(target)
                    is Signed.Failed -> failSeverance(target)
                }
            }
            return
        }
        viewModelScope.launch {
            // The walk-back is checked against the quote the reader
            // confirmed: toward the node the read named, netting exactly
            // the raw sums shown, in exactly the records its cost stated.
            val graphId = when (val read = stances.targetGraphId(target)) {
                is Outcome.Success -> read.value
                else -> return@launch failSeverance(target)
            }
            val quote = open.quote
            val expected = Expectation(
                writes = emptyList(),
                netting = listOf(severance(graphId, quote.raw.pDirected, quote.raw.pInterest, quote.records)),
            )
            val prepared = when (val outcome = stances.prepareSeverance(target)) {
                is Outcome.Success -> outcome.value
                // The write rule refuses at staging as well as at the signer.
                is Outcome.Refused ->
                    return@launch if (outcome.has(ErrorCode.RATE_LIMITED)) {
                        severanceWriteRule(target)
                    } else {
                        failSeverance(target)
                    }
                else -> return@launch failSeverance(target)
            }
            val results = try {
                signer.sign(prepared, expected)
            } catch (_: NoActorKeyException) {
                return@launch failSeverance(target)
            }
            if (results.any { it.rateLimited() }) return@launch severanceWriteRule(target)
            if (results.all { it is WriteResult.Done }) {
                signals.announceSigned()
                update(target) {
                    it.copy(
                        severance = null,
                        pad = PadMode.CLOSED,
                        pick = StancePair.Origin,
                        landing = null,
                        // `Signed 3 things, still settling. You've walked …
                        // back to nothing.` (SeveranceConfirm.md).
                        walkedBack = quote.records,
                    )
                }
                readStanding(target)
            } else {
                failSeverance(target)
            }
        }
    }

    /** Puts the coaching lines on [target]'s open pad and spends them. */
    private fun teach(target: StanceTarget) {
        taught = true
        _state.update { it.copy(coachingTarget = target) }
        viewModelScope.launch { identity.markStancePadTaught() }
    }

    private fun openSeverance(target: StanceTarget, fromPick: Boolean) {
        viewModelScope.launch {
            when (val outcome = stances.severanceQuote(target)) {
                is Outcome.Success -> update(target) {
                    it.copy(severance = SeveranceState(outcome.value, fromPick = fromPick))
                }
                else -> update(target) { it.copy(failed = true) }
            }
        }
    }

    /** Consumes the one-shot confirmation once the screen has shown it. */
    fun onConfirmationShown(target: StanceTarget) = update(target) { it.copy(confirmation = null, walkedBack = null) }

    /** Consumes the one-shot [TargetStance.taken] once the host has routed on it. */
    fun onTakenShown(target: StanceTarget) = update(target) { it.copy(taken = false) }

    private fun commit(target: StanceTarget, pick: StancePair) {
        val entry = _state.value.targets[target]
        if (entry?.busy == true) return
        // The act sent, kept for the row's Retry once its pad is gone.
        update(target) { it.copy(busy = true, failed = false, needsKey = false, sent = pick) }
        viewModelScope.launch {
            when (val signed = sign(target, pick)) {
                Signed.Done -> taken(target, pick)
                is Signed.Failed -> fail(target, needsKey = signed.needsKey)
                Signed.WriteRule -> update(target) { it.copy(busy = false, writeRule = true) }
            }
        }
    }

    /** How one signing of a pick ended. */
    private sealed interface Signed {
        data object Done : Signed

        data class Failed(val needsKey: Boolean) : Signed

        /** The write rule refused it — a notice, not a fault. */
        data object WriteRule : Signed
    }

    /** Signs [pick] as one stance record toward [target] — the record carries the pick verbatim. */
    private suspend fun sign(target: StanceTarget, pick: StancePair): Signed {
        // The record must come back as exactly the pick, toward the node
        // the standing read named (Intent.kt).
        val graphId = when (val read = stances.targetGraphId(target)) {
            is Outcome.Success -> read.value
            else -> return Signed.Failed(needsKey = false)
        }
        val expected = Expectation(listOf(stanceRecord(graphId, pick.pDirected, pick.pInterest)))
        val prepared = when (val outcome = stances.prepareStance(target, pick)) {
            is Outcome.Success -> outcome.value
            // The write rule refuses at staging as well as at the signer.
            is Outcome.Refused -> return if (outcome.has(ErrorCode.RATE_LIMITED)) {
                Signed.WriteRule
            } else {
                Signed.Failed(needsKey = false)
            }
            else -> return Signed.Failed(needsKey = false)
        }
        val results = try {
            signer.sign(prepared, expected)
        } catch (_: NoActorKeyException) {
            // A husk device: the write waits on the reader restoring the
            // key, not on time passing.
            return Signed.Failed(needsKey = true)
        }
        return when {
            results.all { it is WriteResult.Done } -> Signed.Done
            results.any { it.rateLimited() } -> Signed.WriteRule
            else -> Signed.Failed(needsKey = false)
        }
    }

    /** The write rule refused this result: a notice, not a fault. */
    private fun WriteResult.rateLimited(): Boolean =
        this is WriteResult.Refused && errors.any { it.code == ErrorCode.RATE_LIMITED }

    /**
     * THE SIGNATURE IS TAKEN — and only now does the opinion move (the
     * failure pack: signed acts are pessimistic; StanceControl.jsx "The
     * resting target moves to the new opinion when the signature is
     * taken"). The pad closes back where it bloomed, the pending-inclusive
     * fold shows at once, and the snackbar says where the reader now
     * stands — not what they picked: the pick is one edge, the standing is
     * what it left them at.
     */
    private suspend fun taken(target: StanceTarget, pick: StancePair) {
        signals.announceSigned()
        showPendingStanding(target, pick)
        update(target) {
            it.copy(
                busy = false,
                taken = true,
                pad = PadMode.CLOSED,
                pick = StancePair.Origin,
                landing = null,
                severance = null,
                emptySign = null,
            )
        }
        readStanding(target)
        // A pick that walked the bundle back confirms as the walk-back it was,
        // one thing signed; everything else — an empty sign's (0, 0) included
        // — is the ordinary `Current opinion` line.
        update(target) {
            if (it.standingSevered) {
                it.copy(walkedBack = 1)
            } else {
                it.copy(confirmation = it.standing ?: pick)
            }
        }
    }

    /**
     * Shows where [pick] leaves the bundle as the standing, the moment its
     * signature is taken (design.md §8.3) — before the read that confirms
     * it lands. The same local fold the landing line uses, so the answer
     * the reader was looking at when they pressed Set is the answer they
     * get.
     *
     * The raw sums move with it: a second pick before the read lands
     * must fold onto the first, not onto the history that preceded it.
     */
    private fun showPendingStanding(target: StanceTarget, pick: StancePair) = update(target) {
        val raw = it.standingRaw ?: return@update it
        val landed = localLanding(raw, pick)
        it.copy(
            standing = landed.net,
            standingRaw = StancePair(
                raw.pDirected + pick.pDirected,
                raw.pInterest + pick.pInterest,
            ),
            standingRecords = it.standingRecords + 1,
            // `StanceBundle.severed`'s own rule: at (0, 0), and the newest
            // record — this pick — said something. An empty sign never severs.
            standingSevered = landed.severance && !(pick.pDirected == 0.0 && pick.pInterest == 0.0),
            standingPending = true,
        )
    }

    /**
     * The pending-inclusive fold: a stance still settling is one the
     * author already made, so it counts (design.md §9). A bundle with no
     * records is no standing at all, which is the difference between the
     * labelled affordance and a folded pair on the target.
     */
    private suspend fun readStanding(target: StanceTarget) {
        when (val outcome = stances.standing(target)) {
            is Outcome.Success -> update(target) {
                it.copy(
                    standing = outcome.value.net.takeIf { _ -> outcome.value.records > 0 },
                    standingRaw = outcome.value.raw,
                    standingRecords = outcome.value.records,
                    standingSevered = outcome.value.severed,
                    standingRead = true,
                    standingPending = false,
                    // The pick standing on an open pad now folds onto a
                    // newer history, so the landing it shows has to
                    // follow the numbers it was folded from.
                    landing = it.landingForRaw(outcome.value.raw),
                )
            }
            // A missing standing is not a failure the reader has to act
            // on: the control still works, it simply says less. It is
            // asked again when the control next comes into view.
            else -> Unit
        }
    }

    // The pad is left where it was: a hold that failed must not conjure a
    // pad the reader never asked for, and an open pad keeps its place.
    // A pending standing does not survive it — the write did not keep
    // the promise the pending answer made, so the fold is asked again.
    private fun fail(target: StanceTarget, needsKey: Boolean) {
        val pending = _state.value.targets[target]?.standingPending == true
        update(target) { it.copy(busy = false, failed = true, needsKey = needsKey) }
        if (needsKey) _state.update { it.copy(keyAbsent = true) }
        if (pending) viewModelScope.launch { readStanding(target) }
    }

    private fun failSeverance(target: StanceTarget) = update(target) {
        it.copy(severance = it.severance?.copy(working = false, failed = true))
    }

    /** The write rule's no on the walk-back: the dialog stays, the act dims, no Retry (round 21, ask 15). */
    private fun severanceWriteRule(target: StanceTarget) = update(target) {
        it.copy(severance = it.severance?.copy(working = false, failed = false, writeRule = true))
    }

    private fun update(target: StanceTarget, block: (TargetStance) -> TargetStance) {
        _state.update { state ->
            val entry = block(state.targets[target] ?: TargetStance())
            // The coaching lines close with the pad that carried them, and
            // never show again (stance-control.md "Teaching it").
            val closed = state.coachingTarget == target && entry.pad == PadMode.CLOSED
            state.copy(
                targets = state.targets + (target to entry),
                coachingTarget = if (closed) null else state.coachingTarget,
            )
        }
    }
}
