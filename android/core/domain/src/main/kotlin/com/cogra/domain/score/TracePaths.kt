// A PATH'S WORDS (FeedEntry.md:3-11; PathTrace, PathRow; RankPath.md:7): the
// people its trace draws, the row's `Through @ada`, the spoken trace, and the
// path's newest age. See `TraceSteps.kt`.

package com.cogra.domain.score

import com.cogra.domain.ageLadder
import java.time.Instant

/** `2 opinions` (RankHop's `Behind it`). */
fun opinionsCount(n: Int): String = if (n == 1) "1 opinion" else "$n opinions"

/**
 * A step's second line (RankPath.jsx): `2 opinions behind it`; an author's
 * publish of the reached thing says whose opinion rides it — by handle where
 * the board's `Her` presumes a pronoun the graph does not hold.
 */
fun stepSecondLine(path: TracePath, step: TraceStep, context: TraceContext): String {
    if (isOwnPublishOfTarget(path, step)) {
        val giver = giverOf(step, path)
        val thing = if (context.targetKind == TraceThingKind.COMMENT) "the comment" else "the post"
        val whose = if (context.isOwn(giver)) "Your" else "${handleOf(giver)}'s"
        return "$whose own opinion rides $thing"
    }
    return "${opinionsCount(step.carrying.records.size)} behind it"
}

/** The people a path's trace draws, in order — never a thing passed through (RankPath.md:13). */
fun pathPeople(path: TracePath): List<TracePerson?> =
    (0 until path.nodes.size - 1).filter { path.nodes[it].isPerson() }.map { personAt(path, it) }

/** `and`-joined handles: `@ada`, `@kel and @wren`, `@a, @b and @c`. */
private fun joined(names: List<String>): String = when {
    names.size <= 1 -> names.firstOrNull().orEmpty()
    else -> "${names.dropLast(1).joinToString(", ")} and ${names.last()}"
}

/**
 * The row's words (`Through @ada`, `Through @kel and @wren`): who the path ran
 * through after the view's own start. A path straight from the view's own
 * opinion names that start (build reading: the boards draw none).
 */
fun throughLine(path: TracePath, context: TraceContext): String {
    val people = pathPeople(path)
    val after = people.drop(1).map(::handleOf)
    return when {
        after.isNotEmpty() -> "Through ${joined(after)}"
        context.borrowed -> "Through ${handleOf(people.firstOrNull())}"
        else -> "Through you"
    }
}

/** The people one step joins (RankHop's trace): its ends that are people, the reached thing standing after them. */
fun stepPeople(path: TracePath, step: TraceStep): List<TracePerson?> {
    val last = path.nodes.size - 1
    return (step.from..step.to).filter { it != last && path.nodes[it].isPerson() }.map { personAt(path, it) }
}

/**
 * A trace of [people] spoken (PathTrace): `You, then @ada, then what reached
 * you`; two or more people between take `several steps`.
 */
fun spokenPeople(people: List<TracePerson?>, context: TraceContext): String {
    val lead = if (context.borrowed) handleOf(people.firstOrNull()) else "You"
    val between = people.drop(1)
    if (between.isEmpty()) return "$lead, then what reached you"
    val middle = if (between.size == 1) handleOf(between.single()) else "several steps"
    return "$lead, then $middle, then what reached you"
}

/** The path's spoken trace. */
fun spokenTrace(path: TracePath, context: TraceContext): String = spokenPeople(pathPeople(path), context)

/** The path's `Newest opinion on it`: its last step's age (RankPath.md:7). */
fun pathNewest(path: TracePath, context: TraceContext): String =
    path.steps().lastOrNull()?.let { stepAge(path, it, context) }.orEmpty()

/** A step's `Newest of them`: when the newest of its records landed (RankHop.md:3). */
fun hopNewest(hop: TraceHop, now: Instant): String = newestLanding(hop.records)?.let { ageLadder(it, now) }.orEmpty()
