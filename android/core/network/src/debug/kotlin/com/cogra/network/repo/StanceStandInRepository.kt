// An in-memory `StanceRepository` for runs with no backend behind them.
// `StanceRepositoryImpl` is what the app binds; this one answers the
// same reads from process-local memory, so a screen can be exercised
// without a server.
//
// **In the debug source set, and nothing binds it.** It shipped in every
// variant from `src/main` while no DI binding named it, which made an
// accidental future binding a correctness hazard in a release build —
// its arithmetic is deliberately not the published fold rule (below).
// Here it cannot reach a release APK at all. Whether the no-backend run
// it supports is still wanted, or whether it should go entirely, is
// jakob's call.
//
// It is a STAND-IN FOR THE BACKEND, not client-side arithmetic the real
// build keeps: the raw-edge rule says the *record* carries the picked
// values verbatim and the client never derives a delta (api-spec.md
// "Stance prepares write the picked values"), and that rule is untouched
// here — `prepareStance` still writes what was picked. What this class
// fakes is the read-side fold, which is the backend's job. Its
// arithmetic is a plain clamped sum, deliberately NOT a claim about the
// published fold rule.

package com.cogra.network.repo

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StanceStandInRepository @Inject constructor(private val writes: WriteRepository) : StanceRepository {

    private val lock = Mutex()
    private val picks = mutableMapOf<String, MutableList<StancePair>>()

    /**
     * The one leg that is already on the API: the generic stance prepare,
     * carrying the picked values verbatim. The local note is what lets
     * the faked reads below move after a commit; it disappears with the
     * rest of the bookkeeping when the real reads land.
     */
    override suspend fun prepareStance(target: String, pick: StancePair): Outcome<List<PreparedWriteView>> {
        val prepared = writes.prepareStance(target, pick.pDirected, pick.pInterest)
        if (prepared is Outcome.Success) {
            lock.withLock { picks.getOrPut(target) { mutableListOf() }.add(pick) }
        }
        return prepared
    }

    override suspend fun standing(target: String, includePending: Boolean): Outcome<StanceStanding> =
        lock.withLock {
            val own = picks[target].orEmpty()
            Outcome.Success(
                StanceStanding(
                    target = target,
                    net = fold(own),
                    raw = rawSum(own),
                    records = own.size,
                    includePending = includePending,
                ),
            )
        }

    override suspend fun projection(
        target: String,
        pick: StancePair,
        includePending: Boolean,
    ): Outcome<StanceProjection> = lock.withLock {
        val landed = fold(picks[target].orEmpty() + pick)
        Outcome.Success(
            StanceProjection(
                pick = pick,
                net = landed,
                inertDirected = landed.pDirected == 0.0,
                inertInterest = landed.pInterest == 0.0,
                severance = landed.pDirected == 0.0 && landed.pInterest == 0.0,
            ),
        )
    }

    override suspend fun severanceQuote(target: String, includePending: Boolean): Outcome<SeveranceQuote> =
        lock.withLock {
            val own = picks[target].orEmpty()
            val net = fold(own)
            Outcome.Success(
                SeveranceQuote(
                    target = target,
                    standing = net,
                    raw = rawSum(own),
                    records = own.size,
                    alreadySevered = net == StancePair.Origin,
                ),
            )
        }

    /**
     * Refused rather than faked: staging real records is the backend's,
     * and a stand-in that returned made-up writes would put a signature
     * on nothing. The confirm surface reports the refusal like any other.
     */
    override suspend fun prepareSeverance(target: String): Outcome<List<PreparedWriteView>> =
        Outcome.Refused(
            listOf(UserError(ErrorCode.INTERNAL, "no backend to stage a severance batch")),
        )

    private fun fold(pairs: List<StancePair>): StancePair = StancePair(
        pDirected = pairs.sumOf { it.pDirected }.coerceIn(-1.0, 1.0),
        pInterest = pairs.sumOf { it.pInterest }.coerceIn(-1.0, 1.0),
    )

    /** The same sum without the clip — what a walk back to zero walks. */
    private fun rawSum(pairs: List<StancePair>): StancePair = StancePair(
        pDirected = pairs.sumOf { it.pDirected },
        pInterest = pairs.sumOf { it.pInterest },
    )
}
