// The trace's test cast — the boards' own (`_shared.jsx` SCORE_PATHS): why
// @ada's post reached @sol at 15.20, through six paths that add up to it. The
// web's twin is `web/src/lib/score/trace-fixtures.ts`; shared by the domain's
// word tests and the trace screen's behaviour tests, so both read the answer
// the boards draw.

package com.cogra.domain.testing

import com.cogra.domain.score.TraceAnswer
import com.cogra.domain.score.TraceFamily
import com.cogra.domain.score.TraceFetch
import com.cogra.domain.score.TraceHop
import com.cogra.domain.score.TraceLeg
import com.cogra.domain.score.TraceLegRole
import com.cogra.domain.score.TraceNamed
import com.cogra.domain.score.TraceNode
import com.cogra.domain.score.TraceNodeKind
import com.cogra.domain.score.TracePath
import com.cogra.domain.score.TracePerson
import com.cogra.domain.score.TraceRecord
import com.cogra.domain.score.TraceRepository
import java.time.Duration
import java.time.Instant

object TraceCast {
    val SOL = TracePerson("u-sol", "sol", "Sol Navarro", null)
    val ADA = TracePerson("u-ada", "ada", "Ada Lindqvist", null)
    val TOBIAS = TracePerson("u-tobias", "tobias", "Tobias Brandt", null)
    val MIRA = TracePerson("u-mira", "mira", "Mira Okafor", null)
    val KEL = TracePerson("u-kel", "kel", "Kel Moreau", null)
    val WREN = TracePerson("u-wren", "wren", "Wren Aliyev", null)
    val NADIA = TracePerson("u-nadia", "nadia", "Nadia Rask", null)
    val JUNO = TracePerson("u-juno", "juno", "Juno Baptiste", null)

    const val POST_ID = "p-long-way"
    val POST_CREATED: Instant = Instant.parse("2026-10-28T08:00:00Z")

    /** The board's clock: the post two hours old, the records eight days and a date. */
    val NOW: Instant = Instant.parse("2026-10-28T10:00:00Z")

    private val TARGET = TraceNode("mint:act:${ADA.id}:1:publish", POST_ID, TraceNodeKind.POST)

    private fun person(p: TracePerson) = TraceNode("prof:${p.id}", p.id, TraceNodeKind.USER)

    private fun ago(days: Long): Instant = NOW.minus(Duration.ofDays(days))

    private fun record(
        id: String,
        author: TracePerson,
        family: TraceFamily,
        pair: Pair<Double, Double>,
        landedAt: Instant,
        to: String,
    ) = TraceRecord(
        id = id,
        family = family,
        author = author,
        landedAt = landedAt,
        legs = listOf(TraceLeg(TraceLegRole.A, "addr:${author.id}", to, pair.first, pair.second)),
    )

    private fun opinion(from: TracePerson, to: TracePerson, pairs: List<Pair<Double, Double>>, ages: List<Long>): TraceHop {
        val records = pairs.mapIndexed { index, pair ->
            record("act:${from.id}:$index:opinion:${to.id}", from, TraceFamily.OPINION, pair, ago(ages[index]), "prof:${to.id}")
        }
        fun sum(axis: (Pair<Double, Double>) -> Double) = pairs.sumOf(axis).coerceIn(-1.0, 1.0)
        return TraceHop(sum { it.first }, sum { it.second }, records)
    }

    private fun publish(author: TracePerson) = TraceHop(
        0.1,
        0.1,
        listOf(record("act:${author.id}:1:publish", author, TraceFamily.PUBLISH, 0.1 to 0.1, POST_CREATED, TARGET.graphId)),
    )

    private fun opinionOfPost(author: TracePerson) = TraceHop(
        0.5,
        0.3,
        listOf(record("act:${author.id}:9:opinion:post", author, TraceFamily.OPINION, 0.5 to 0.3, ago(2), TARGET.graphId)),
    )

    private fun path(
        people: List<TracePerson>,
        contribution: Double,
        firstPairs: List<Pair<Double, Double>> = listOf(0.3 to 0.1),
    ): TracePath {
        val hops = mutableListOf<TraceHop>()
        for (at in 0 until people.size - 1) {
            hops += if (at == 0) {
                opinion(people[at], people[at + 1], firstPairs, listOf(8L, 40L))
            } else {
                opinion(people[at], people[at + 1], listOf(0.4 to 0.2), listOf(3L))
            }
        }
        val last = people.last()
        // The author reaches her post by publishing it; anyone else by an opinion of it.
        hops += if (last.id == ADA.id) publish(last) else opinionOfPost(last)
        return TracePath(people.map(::person) + TARGET, if (contribution < 0) -1 else 1, contribution, hops)
    }

    private val ADA_PAIRS = listOf(0.45 to 0.1, 0.1 to 0.1)

    /** The board's six paths in the reader's own view: 6.80 + 4.20 + 2.60 + 1.10 + (0.30 + 0.20) = 15.20. */
    fun ownAnswer(score: Double = 15.2) = TraceAnswer(
        score = score,
        paths = listOf(
            path(listOf(SOL, ADA), 6.8, ADA_PAIRS),
            path(listOf(SOL, TOBIAS), 4.2),
            path(listOf(SOL, MIRA), 2.6),
            path(listOf(SOL, KEL, WREN), 1.1),
            path(listOf(SOL, NADIA), 0.3),
            path(listOf(SOL, JUNO), 0.2),
        ),
    )

    /** The same set walked from @mira's opinions (FeedEntry `view` borrowed). */
    fun borrowedAnswer() = TraceAnswer(
        score = 15.2,
        paths = listOf(
            path(listOf(MIRA, ADA), 6.8, ADA_PAIRS),
            path(listOf(MIRA, TOBIAS), 4.2),
            path(listOf(MIRA, SOL), 2.6),
            path(listOf(MIRA, KEL, WREN), 1.1),
            path(listOf(MIRA, NADIA), 0.5),
        ),
    )

    /** A step whose records add up past the limit (RankHop.md:13). */
    fun clippedAnswer() = TraceAnswer(score = 2.0, paths = listOf(path(listOf(SOL, ADA), 2.0, listOf(0.8 to 0.2, 0.7 to 0.1))))

    /** A comment @ada wrote in reply to @tobias's post: one record, two legs (SR-G4). */
    fun reviewPath(): TracePath {
        val review = TraceRecord(
            id = "act:u-ada:4:review",
            family = TraceFamily.REVIEW,
            author = ADA,
            landedAt = NOW.minus(Duration.ofHours(1)),
            legs = listOf(
                TraceLeg(TraceLegRole.A, "addr:u-ada", "mint:act:u-ada:4:review", 0.4, 0.2),
                TraceLeg(TraceLegRole.T, "mint:act:u-ada:4:review", "mint:act:u-tobias:1:publish", 0.3, 0.1),
            ),
        )
        val hop = TraceHop(0.4, 0.2, listOf(review))
        return TracePath(
            nodes = listOf(
                person(SOL),
                person(ADA),
                TraceNode("mint:act:u-ada:4:review", "c1", TraceNodeKind.COMMENT),
                TraceNode("mint:act:u-tobias:1:publish", "p2", TraceNodeKind.POST),
            ),
            sign = 1,
            contribution = 1.0,
            hops = listOf(ownAnswer().paths[0].hops[0], hop, hop),
        )
    }

    val NAMED: Map<String, TraceNamed> = mapOf(POST_ID to TraceNamed.Post(POST_ID, "The long way home", "ada"))
}

/** The trace's reads, scripted: each [trace] answers the next of [answers] and counts the call. */
class FakeTraceRepository(var answers: ArrayDeque<TraceFetch> = ArrayDeque()) : TraceRepository {
    /** Every `feedTrace` asked, as (viewer, target). */
    val traced = mutableListOf<Pair<String, String>>()

    /** Every names batch asked. */
    val namesAsked = mutableListOf<List<String>>()

    override suspend fun trace(viewer: String, target: String): TraceFetch {
        traced += viewer to target
        return answers.removeFirstOrNull() ?: TraceFetch.Answered(TraceAnswer(null, emptyList()))
    }

    override suspend fun names(ids: List<String>): Map<String, TraceNamed> {
        namesAsked += ids
        return TraceCast.NAMED.filterKeys { it in ids }
    }
}
