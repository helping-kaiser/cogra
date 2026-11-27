// THE KEPT PICKS' REVIEW AND ITS SEAL — the state holder (KeptPicksReview.md,
// KeptPicksSeal.md; jakob's rulings B1-B3, 2026-10-01, and the kept-picks
// rulings of 2026-10-02). Picks kept while the key was elsewhere never sign on
// their own: once the key is back they sign together, in one batch the reader
// looks over first. web's twin is `web/src/app/(app)/kept-picks/kept-picks-view.tsx`.
//
// - ONE ROW PER KEPT PLAIN PICK, oldest first, each with its target's live
//   preview and, where the pick would net its bundle to nothing, that
//   consequence on its row. A kept vouch-back or approval never joins; a kept
//   approval is named under the intro, with the door to Invites.
// - THE × DROPS AT ONCE, no confirm, no undo; the last drop leaves.
// - THE SEAL SIGNS THE BATCH. There is no prepare that stages stances toward
//   several targets (api-spec.md "The generic stance"; the batch prepare is a
//   banked backend bite), so each pick is prepared on its own, IN ORDER, and
//   nothing is signed until every one is staged; the joined expectation is
//   then checked whole and signed in ONE `WriteSigner.sign` pass. A refusal at
//   pick n leaves picks 1…n-1 staged unsigned — named in the PR as the web's
//   own deviation candidate (KeptPicksSeal.md:29 "nothing is staged or spent").
// - NOTHING DROPS A PICK but the reader's × or the batch landing.
// - THE SEAL'S RETRY IS THE SAME BATCH (KeptPicksSeal.md:33, :63): the batch
//   keeps its own slot (`SlottedSigning`), so a press after a signing that did
//   not answer done asks that batch again rather than staging every pick twice.

package com.cogra.feature.stance.kept

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.SameSigning
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.joinExpectations
import com.cogra.domain.signing.stanceRecord
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.KeptPick
import com.cogra.domain.stance.KeptPickStore
import com.cogra.domain.stance.KeptPreview
import com.cogra.domain.stance.KeptPreviewRepository
import com.cogra.domain.stance.StanceAttempts
import com.cogra.domain.stance.StanceSignals
import com.cogra.domain.stance.StanceSlot
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.stance.WRITE_RULE_CODES
import com.cogra.domain.stance.fallbackPreview
import com.cogra.domain.stance.keptBatchIntent
import com.cogra.domain.stance.localLanding
import com.cogra.domain.stance.opinions
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import com.cogra.feature.stance.Slotted
import com.cogra.feature.stance.SlottedSigning
import com.cogra.feature.stance.Staging
import com.cogra.feature.stance.StancePress
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** One kept plain pick as its row and its seal row read it. */
data class KeptRow(
    val pick: KeptPick,
    /** The target's live preview, or its kind alone until a read answers (KeptPicksReview.md:15). */
    val preview: KeptPreview,
    /** The pick would net its bundle to nothing over a standing — said on its row (:19). */
    val severs: Boolean = false,
)

/** Which of the two screens stands. */
enum class KeptStage { REVIEW, SEAL }

/** How a press of `Sign the picks` did not go through (KeptPicksSeal.md:27-:33). */
enum class KeptSealFault {
    /** No answer reached the seal: the fault line and Retry. */
    OFFLINE,

    /** The write rule refused the batch: the notice, and `Not now` back to the review. */
    WRITE_RULE,

    /** Any other refusal of a staged act: `This shouldn't have happened`. */
    BUG,
}

/** The review's way out, a one-shot the screen routes on. */
sealed interface KeptExit {
    /** Back where the review was opened from, saying [snackbar] there once (or nothing). */
    data class Left(val snackbar: KeptSnack? = null) : KeptExit
}

/** What the surface the review returns to says, once. */
sealed interface KeptSnack {
    /** `Nothing left to sign.` (KeptPicksReview.md:25). */
    data object NothingLeft : KeptSnack

    /** `Signed 3 things, still settling.` with the batch's count (KeptPicksSeal.md:27). */
    data class Signed(val count: Int) : KeptSnack
}

data class KeptPicksUiState(
    /** The store has answered at least once. */
    val loaded: Boolean = false,
    val rows: List<KeptRow> = emptyList(),
    /** An approval was kept with the picks: the line about it and its door (KeptPicksReview.md:45). */
    val approvalKept: Boolean = false,
    val stage: KeptStage = KeptStage.REVIEW,
    /** `Sign the picks` is pressed and the signing has not answered. */
    val signing: Boolean = false,
    val fault: KeptSealFault? = null,
    /** The picks left after the last drop, for `Removed — N picks left.` (:21); null at rest. */
    val removedLeft: Int? = null,
    /** The row focus moves to after a drop (:21): the next one, else the one before. */
    val focusIndex: Int? = null,
    val exit: KeptExit? = null,
)

@HiltViewModel
@Suppress("TooManyFunctions") // one handler per drawn gesture across the review and its seal
class KeptPicksViewModel @Inject constructor(
    private val kept: KeptPickStore,
    private val previews: KeptPreviewRepository,
    private val stances: StanceRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
    private val signals: StanceSignals,
    /** Whose press it is: a batch signs only for the account that pressed. */
    tokens: TokenStore,
    /** The staged writes' states, read when a Retry asks the same batch again. */
    stagedWrites: WriteRepository,
    /** Every stance gesture's attempt on this device, per account (`StanceAttempts`). */
    attempts: StanceAttempts,
) : ViewModel() {

    /** The batch's slot: the seal's Retry asks the same batch again (`SlottedSigning`). */
    private val signing = SlottedSigning(signer, SameSigning(signer, stagedWrites, identity), attempts, tokens)

    private val _state = MutableStateFlow(KeptPicksUiState())
    val state = _state.asStateFlow()

    /** The targets whose preview has been asked for, so a store change re-reads only new rows. */
    private val read = mutableSetOf<StanceTarget>()

    /**
     * The review has left, once and for good: a store change that lands after
     * the exit was taken (the signed batch's drop) must not route a second time.
     */
    private var exited = false

    init {
        viewModelScope.launch {
            // THE REVIEW NEEDS THE KEY HERE (KeptPicksReview.md:39): with it gone
            // again the waiting-for-key state owns every surface.
            if (identity.actorSeed() == null) {
                leave()
                return@launch
            }
            kept.watch().collect(::onKept)
        }
    }

    private fun onKept(picks: List<KeptPick>) {
        val opinions = picks.opinions()
        _state.update { state ->
            val known = state.rows.associateBy { it.pick.target }
            state.copy(
                loaded = true,
                rows = opinions.map { pick ->
                    known[pick.target]?.copy(pick = pick) ?: KeptRow(pick, fallbackPreview(pick.target, pick.kind))
                },
                approvalKept = picks.any { it.family == KeptFamily.APPROVAL },
            )
        }
        // Nothing kept to review: back where it was opened from.
        if (opinions.isEmpty()) leave()
        opinions.filter { read.add(it.target) }.forEach(::readRow)
    }

    /** A row's live preview and its consequence, read when the row appears. */
    private fun readRow(pick: KeptPick) {
        viewModelScope.launch {
            val preview = (previews.preview(pick.target, pick.kind) as? Outcome.Success)?.value
            val standing = (stances.standing(pick.target) as? Outcome.Success)?.value
            // Netting to nothing over a standing is a walk-back; over nothing
            // standing it is an empty sign, which takes nothing back.
            val severs = standing != null && standing.records > 0 && !standing.severed &&
                localLanding(standing.raw, pick.pick).severance
            updateRow(pick.target) { row -> row.copy(preview = preview ?: row.preview, severs = severs) }
        }
    }

    private fun updateRow(target: StanceTarget, block: (KeptRow) -> KeptRow) = _state.update { state ->
        state.copy(rows = state.rows.map { if (it.pick.target == target) block(it) else it })
    }

    /**
     * The ×: the pick is dropped from this device at once — no confirm, no
     * undo (KeptPicksReview.md:21). The last one leaves the review with
     * `Nothing left to sign.` where it was opened from (:23).
     */
    fun onRemove(index: Int) {
        val rows = _state.value.rows
        val row = rows.getOrNull(index) ?: return
        val left = rows.size - 1
        if (left == 0) {
            exit(KeptSnack.NothingLeft)
        } else {
            _state.update { it.copy(removedLeft = left, focusIndex = index.coerceAtMost(left - 1)) }
        }
        viewModelScope.launch { kept.drop(listOf(row.pick.target), KeptFamily.OPINION) }
    }

    fun onFocusMoved() = _state.update { it.copy(focusIndex = null) }

    /** `Sign them`: the seal opens with every pick in the review as its acts, nothing signed (:27). */
    fun onSignThem() = _state.update { it.copy(stage = KeptStage.SEAL, fault = null) }

    /**
     * The seal's arrow, its Back, and `Not now` on either notice: the review
     * stands again, one stage behind, every pick still in it (KeptPicksSeal.md:31,
     * :37, :45, :47). Refused while the signing waits on its answer (:23).
     */
    fun onBackToReview() {
        if (_state.value.signing) return
        _state.update { it.copy(stage = KeptStage.REVIEW, fault = null) }
    }

    /** The seal's X, `Leave — your picks are kept`: the flow is left, nothing signed (:49). */
    fun onLeave() {
        if (_state.value.signing) return
        leave()
    }

    /** The review's header back: it closes to where it was opened from (KeptPicksReview.md:33). */
    fun onHeaderBack() = leave()

    private fun leave() = exit(null)

    private fun exit(snack: KeptSnack?) {
        if (exited) return
        exited = true
        _state.update { it.copy(exit = KeptExit.Left(snack)) }
    }

    fun onExited() = _state.update { it.copy(exit = null) }

    /**
     * `Sign the picks` (or its Retry, or `Try again`): refuses a second press
     * until the signing answers (KeptPicksSeal.md:21). Taken, the picks are kept
     * no longer, each target settles under its face, and the seal leaves with
     * `Signed N things, still settling.` (:27).
     */
    fun onSign() {
        val current = _state.value
        if (current.signing || current.rows.isEmpty()) return
        _state.update { it.copy(signing = true, fault = null) }
        val batch = current.rows.map { it.pick }
        // Dispatched, not UNDISPATCHED as the reply seal starts: `signing` is
        // set before the launch, so the seal refuses a second press until this
        // one answers (KeptPicksSeal.md:21) whatever the dispatch; the account
        // is read on the press's first leg.
        viewModelScope.launch {
            when (val signed = signBatch(batch, retrying = current.fault != null)) {
                BatchSigned.Taken -> taken(batch)
                is BatchSigned.Fault -> _state.update { it.copy(signing = false, fault = signed.fault) }
                // Another account is active: nothing ran, the seal stands as it was.
                BatchSigned.Stood -> _state.update { it.copy(signing = false, fault = current.fault) }
            }
        }
    }

    /** How one press of the seal ended. */
    private sealed interface BatchSigned {
        data object Taken : BatchSigned

        data class Fault(val fault: KeptSealFault) : BatchSigned

        /** The pressing account is not the active one: nothing ran, nothing is said. */
        data object Stood : BatchSigned
    }

    private suspend fun taken(batch: List<KeptPick>) {
        val targets = batch.map { it.target }
        signals.markSettling(targets)
        signals.announceSigned()
        exit(KeptSnack.Signed(batch.size))
        kept.drop(targets, KeptFamily.OPINION)
    }

    /**
     * Signs the batch through the kept picks' own slot (`SlottedSigning`):
     * after a signing that did not answer done, the same batch is asked again
     * (KeptPicksSeal.md:33, :63) — each pick is a record of its own in a bundle
     * that sums, so a batch prepared afresh beside one the server took would
     * sum every pick twice. A first press, or one after the first batch was
     * retired, prepares every pick in order and signs the joined batch once.
     */
    private suspend fun signBatch(batch: List<KeptPick>, retrying: Boolean): BatchSigned {
        val press = signing.press(retrying) ?: return BatchSigned.Stood
        val intent = keptBatchIntent(batch.map { it.target to it.pick })
        val slotted = signing.sign(StanceSlot.KeptBatch, intent, press) {
            stageBatch(batch, press)
        }
        val fault = when (slotted) {
            is Slotted.Answered -> faultOf(slotted.results)
            // A changed batch found the first one approved: it is what lands.
            // INTERIM, the web's (#693): the batch as the seal holds it now is
            // what is dropped and counted.
            is Slotted.Landing -> null
            is Slotted.Refused -> if (slotted.errors.any { it.code in WRITE_RULE_CODES }) {
                KeptSealFault.WRITE_RULE
            } else {
                KeptSealFault.BUG
            }
            Slotted.Unreachable -> KeptSealFault.OFFLINE
            Slotted.Stood -> return BatchSigned.Stood
            Slotted.NoKey -> {
                // The key left between the review and the press: nothing signed.
                leave()
                KeptSealFault.OFFLINE
            }
        }
        return fault?.let { BatchSigned.Fault(it) } ?: BatchSigned.Taken
    }

    /**
     * Prepares every pick in order, the account asked before each leg; nothing
     * is signed until every one is staged.
     */
    private suspend fun stageBatch(batch: List<KeptPick>, press: StancePress): Staging {
        val prepared = mutableListOf<PreparedWriteView>()
        val expected = mutableListOf<Expectation>()
        val nodes = mutableListOf<String>()
        for (pick in batch) {
            if (!press.holds()) return Staging.Stood
            val graphId = (stances.targetGraphId(pick.target) as? Outcome.Success)?.value
                ?: return Staging.Unreachable
            if (!press.holds()) return Staging.Stood
            when (val outcome = stances.prepareStance(pick.target, pick.pick)) {
                is Outcome.Success -> prepared += outcome.value
                is Outcome.Refused -> return Staging.Refused(outcome.errors)
                is Outcome.Failed -> return Staging.Unreachable
            }
            nodes += graphId
            expected += Expectation(listOf(stanceRecord(graphId, pick.pick.pDirected, pick.pick.pInterest)))
        }
        return Staging.Staged(nodes.joinToString(" "), prepared, joinExpectations(expected))
    }

    /** What a signing pass's answers make of the seal; null when the batch was taken. */
    private fun faultOf(results: List<WriteResult>): KeptSealFault? = when {
        WriteResult.allDone(results) -> null
        results.any { it is WriteResult.Refused && it.errors.any { e -> e.code in WRITE_RULE_CODES } } ->
            KeptSealFault.WRITE_RULE
        results.any { it is WriteResult.Refused || it is WriteResult.RejectedByDevice } -> KeptSealFault.BUG
        else -> KeptSealFault.OFFLINE
    }
}
