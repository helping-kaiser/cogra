// The stance control's state holder (roadmap "Slice 2.2"; design.md §8).
//
// One holder serves every control on a destination — a feed is a list of
// them — so the state is a map keyed by target rather than a single
// control's worth of fields. Each entry carries what its pad shows: the
// pick under the thumb, the standing the fold reports, where that pick
// leaves the bundle, and the severance prompt when one is open.
//
// The raw-edge rule lives here: a commit sends the picked pair and
// nothing else. The standing and the landing are READ back from the
// repository — this class never subtracts one from the other, because
// the record carries what was picked and the bundle is the fold's
// business (design.md §8.1, api-spec.md "Stance prepares write the
// picked values").

package com.cogra.feature.stance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Where one control's pad is (mirrors the design system's own mode). */
enum class PadMode { CLOSED, DRAGGING, STICKY }

/** One target's control, as the screen renders it. */
data class TargetStance(
    val pick: StancePair = StancePair.Origin,
    val pad: PadMode = PadMode.CLOSED,
    /** The fold's answer; null until the read lands. */
    val standing: StancePair? = null,
    val standingRecords: Int = 0,
    /** Where [pick] leaves the bundle; null while the fold is in flight. */
    val landing: StanceProjection? = null,
    val busy: Boolean = false,
    val failed: Boolean = false,
    /** The failure is a husk device, not a fault: the key has to come back. */
    val needsKey: Boolean = false,
    val exactValues: Boolean = false,
    val severance: SeveranceState? = null,
)

/** An open severance confirmation and how it was reached. */
data class SeveranceState(
    val quote: SeveranceQuote,
    /** Reached by an ordinary pick landing on zero rather than by the route. */
    val fromPick: Boolean,
    val working: Boolean = false,
    val failed: Boolean = false,
)

data class StanceUiState(
    val targets: Map<String, TargetStance> = emptyMap(),
    /** The control whose first tap opened the teaching mark, if any. */
    val coachTarget: String? = null,
)

/**
 * How long a drifting thumb settles before the landing is asked for. The
 * face follows the finger with no round trip at all; only the second
 * number — where the pick leaves the bundle — costs a read.
 */
private const val PROJECTION_SETTLE_MS = 120L

@HiltViewModel
class StanceViewModel @Inject constructor(
    private val stances: StanceRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(StanceUiState())
    val state = _state.asStateFlow()

    private val projections = mutableMapOf<String, Job>()
    private val observed = mutableSetOf<String>()

    /**
     * Whether the held gesture has been taught on this device; null until
     * the store answers. The first tap waits on it rather than acting
     * blind — a tap that stages a priced act must not be the teaching
     * moment's casualty (design.md §8.7).
     */
    private var taught: Boolean? = null

    /** Registers a control and reads the standing behind it, once. */
    fun observe(target: String) {
        if (!observed.add(target)) return
        _state.update { it.copy(targets = it.targets + (target to TargetStance())) }
        viewModelScope.launch {
            if (taught == null) taught = identity.stancePadTaught()
            readStanding(target)
        }
    }

    /**
     * The plain tap. The FIRST tap ever teaches and stages nothing; every
     * tap after that commits the modest positive default (design.md §8.3,
     * §8.7).
     */
    fun onTapDefault(target: String) {
        when (taught) {
            // The store has not answered yet: wait for it rather than
            // spending the teaching tap on a guess.
            null -> viewModelScope.launch {
                taught = identity.stancePadTaught()
                onTapDefault(target)
            }
            false -> teach(target)
            true -> commit(target, StancePair.TapDefault)
        }
    }

    fun onOpenPad(target: String) {
        // A hold is the lesson: whoever completed one has no more use for
        // the mark (design.md §8.7).
        dismissCoachMark()
        // The pad opens at the origin, untilted — the low default belongs
        // to the tap, not to the considered gesture (design.md §8.3).
        update(target) {
            it.copy(pad = PadMode.DRAGGING, pick = StancePair.Origin, landing = null, failed = false)
        }
        requestLanding(target, StancePair.Origin)
    }

    fun onPick(target: String, pick: StancePair) {
        update(target) { it.copy(pick = pick, landing = null) }
        requestLanding(target, pick)
    }

    /** A hold released without drifting parks the pad open (design.md §8.5, §8.6). */
    fun onHold(target: String) = update(target) { it.copy(pad = PadMode.STICKY) }

    fun onDismissPad(target: String) {
        projections.remove(target)?.cancel()
        update(target) {
            it.copy(pad = PadMode.CLOSED, pick = StancePair.Origin, landing = null, exactValues = false)
        }
    }

    fun onToggleExactValues(target: String) =
        update(target) { it.copy(exactValues = !it.exactValues) }

    /**
     * Commits the pick — unless it lands on severance, which is asked
     * about rather than refused, through the same confirmation the
     * explicit route opens (design.md §8.2, §8.5).
     */
    fun onCommit(target: String) {
        val entry = _state.value.targets[target] ?: return
        if (entry.landing?.severance == true) {
            openSeverance(target, fromPick = true)
            return
        }
        commit(target, entry.pick)
    }

    /** The route for the reader who came to sever (design.md §8.5). */
    fun onOpenSeverance(target: String) = openSeverance(target, fromPick = false)

    fun onDismissSeverance(target: String) = update(target) { it.copy(severance = null) }

    fun onConfirmSeverance(target: String) {
        val open = _state.value.targets[target]?.severance ?: return
        if (open.working) return
        update(target) { it.copy(severance = open.copy(working = true, failed = false)) }
        viewModelScope.launch {
            val prepared = when (val outcome = stances.prepareSeverance(target)) {
                is Outcome.Success -> outcome.value
                else -> return@launch failSeverance(target)
            }
            val results = try {
                signer.sign(prepared)
            } catch (_: NoActorKeyException) {
                return@launch failSeverance(target)
            }
            if (results.all { it is WriteResult.Done }) {
                update(target) { it.copy(severance = null, pad = PadMode.CLOSED, pick = StancePair.Origin) }
                readStanding(target)
            } else {
                failSeverance(target)
            }
        }
    }

    /** The mark stays until dismissed or until a hold lands (design.md §8.7). */
    fun onCoachMarkDismissed() = dismissCoachMark()

    /**
     * Opens the teaching mark and spends the teaching tap. The flag is
     * written HERE rather than on dismissal: its meaning is "the tap that
     * teaches has been spent", and a flag written later would let a
     * restart swallow a second priced tap in silence.
     */
    private fun teach(target: String) {
        taught = true
        _state.update { it.copy(coachTarget = target) }
        viewModelScope.launch { identity.markStancePadTaught() }
    }

    private fun dismissCoachMark() {
        if (_state.value.coachTarget == null) return
        _state.update { it.copy(coachTarget = null) }
    }

    private fun openSeverance(target: String, fromPick: Boolean) {
        viewModelScope.launch {
            when (val outcome = stances.severanceQuote(target)) {
                is Outcome.Success -> update(target) {
                    it.copy(severance = SeveranceState(outcome.value, fromPick = fromPick))
                }
                else -> update(target) { it.copy(failed = true) }
            }
        }
    }

    private fun commit(target: String, pick: StancePair) {
        val entry = _state.value.targets[target]
        if (entry?.busy == true) return
        update(target) { it.copy(busy = true, failed = false, needsKey = false) }
        viewModelScope.launch {
            // The record carries the pick verbatim; no delta is derived.
            val prepared = when (val outcome = stances.prepareStance(target, pick)) {
                is Outcome.Success -> outcome.value
                else -> return@launch fail(target, needsKey = false)
            }
            val results = try {
                signer.sign(prepared)
            } catch (_: NoActorKeyException) {
                // A husk device: the write waits on the reader restoring
                // the key, not on time passing.
                return@launch fail(target, needsKey = true)
            }
            if (results.all { it is WriteResult.Done }) {
                update(target) {
                    it.copy(
                        busy = false,
                        pad = PadMode.CLOSED,
                        pick = StancePair.Origin,
                        landing = null,
                        exactValues = false,
                    )
                }
                readStanding(target)
            } else {
                fail(target, needsKey = false)
            }
        }
    }

    /**
     * Asks the fold where [pick] leaves the bundle, after the thumb
     * settles. Only the newest question is outstanding — a drag would
     * otherwise queue one read per frame.
     */
    private fun requestLanding(target: String, pick: StancePair) {
        projections.remove(target)?.cancel()
        projections[target] = viewModelScope.launch {
            delay(PROJECTION_SETTLE_MS)
            val outcome = stances.projection(target, pick)
            if (outcome is Outcome.Success) {
                update(target) { if (it.pick == pick) it.copy(landing = outcome.value) else it }
            }
        }
    }

    private suspend fun readStanding(target: String) {
        when (val outcome = stances.standing(target)) {
            is Outcome.Success -> update(target) {
                it.copy(standing = outcome.value.net, standingRecords = outcome.value.records)
            }
            // A missing standing is not a failure the reader has to act
            // on: the control still works, it simply says less.
            else -> Unit
        }
    }

    // The pad is left where it was: a tap that failed must not conjure a
    // pad the reader never asked for, and an open pad keeps its place.
    private fun fail(target: String, needsKey: Boolean) =
        update(target) { it.copy(busy = false, failed = true, needsKey = needsKey) }

    private fun failSeverance(target: String) = update(target) {
        it.copy(severance = it.severance?.copy(working = false, failed = true))
    }

    private fun update(target: String, block: (TargetStance) -> TargetStance) {
        _state.update { state ->
            val entry = state.targets[target] ?: TargetStance()
            state.copy(targets = state.targets + (target to block(entry)))
        }
    }
}
