package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenRepository
import java.time.Instant

/**
 * The hidden list, recording: every hide (with the restore time an Undo
 * passed) and every unhide, in call order, with scriptable answers — success
 * unless a test queues another outcome — and the set the read serves.
 */
class RecordingHiddenRepository : HiddenRepository {
    val hides = mutableListOf<Pair<String, Instant?>>()
    val unhides = mutableListOf<String>()
    var reads = 0

    /** Answers for the next hides, in order; empty means hidden at [hiddenAt]. */
    val hideAnswers = ArrayDeque<Outcome<Instant>>()

    /** Answers for the next unhides, in order; empty means unhidden. */
    val unhideAnswers = ArrayDeque<Outcome<Unit>>()

    /** What the read serves: the set, or a scripted fault. */
    var served: Outcome<List<HiddenEntry>> = Outcome.Success(emptyList())

    var hiddenAt: Instant = Instant.parse("2026-10-13T12:00:00Z")

    override suspend fun hiddenActors(): Outcome<List<HiddenEntry>> {
        reads++
        return served
    }

    override suspend fun hideActor(actor: String, at: Instant?): Outcome<Instant> {
        hides += actor to at
        return hideAnswers.removeFirstOrNull() ?: Outcome.Success(at ?: hiddenAt)
    }

    override suspend fun unhideActor(actor: String): Outcome<Unit> {
        unhides += actor
        return unhideAnswers.removeFirstOrNull() ?: Outcome.Success(Unit)
    }
}
