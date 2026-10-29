// EACH LEVEL'S OWN LINES (FeedEntry.md:5-17; RankHop.md:7-13; RankRecords.md:3-19):
// level one's handful, quiet row and note, the step's place and fold notes, and
// the floor's records and their sum. See `TraceSteps.kt`.

package com.cogra.domain.score

import com.cogra.domain.ageLadder
import java.time.Instant
import kotlin.math.abs

/** The limit an opinion can reach on either axis (api-spec.md `Dimension`). */
private const val LIMIT = 1.0
private const val LIMIT_EPSILON = 1e-9

/** One drawn path on level one: its place in the answer and its displayed value. */
data class DrawnPath(val index: Int, val value: String)

/** The quiet row: how many more paths, and what they add. */
data class MorePaths(val count: Int, val value: String)

/** What level one draws. */
data class LevelOne(val drawn: List<DrawnPath>, val more: MorePaths?)

/**
 * The paths' values in extraction order, the handful standing and the rest
 * riding the quiet row unless [unfolded].
 *
 * EVERY PATH IS APPORTIONED ON ITS OWN, ONCE, and the quiet row carries the sum
 * of the ones it holds: so the drawn surface adds up to the trace's own figure
 * in either state (FeedEntry.md:15; SR-G8), and a path reads the same value on
 * the list, unfolded, and on its own level.
 */
fun TraceAnswer.levelOne(unfolded: Boolean): LevelOne {
    val cents = apportionCents(paths.map { it.contribution }, score ?: 0.0)
    val folds = !unfolded && cents.size > DRAWN_PATHS
    val shown = if (folds) cents.take(DRAWN_PATHS) else cents
    val rest = if (folds) cents.drop(DRAWN_PATHS) else emptyList()
    return LevelOne(
        drawn = shown.mapIndexed { index, value -> DrawnPath(index, signedOfCents(value)) },
        more = if (rest.isEmpty()) null else MorePaths(rest.size, signedOfCents(rest.sum())),
    )
}

/** `2 more paths` / `1 more path`. */
fun morePathsLabel(count: Int): String = if (count == 1) "1 more path" else "$count more paths"

/** A path's own value on level two, apportioned exactly as level one drew it. */
fun TraceAnswer.pathValue(index: Int): String = levelOne(unfolded = true).drawn.getOrNull(index)?.value.orEmpty()

/**
 * Level one's note (FeedEntry.md:5-7): the reader's own words, or the lender's
 * handle under a borrowed view.
 */
fun levelOneNote(context: TraceContext, lender: String?): String =
    if (context.borrowed && lender != null) {
        "Every path here starts with an opinion @$lender gave."
    } else {
        "Every path here starts with an opinion you gave."
    }

/** One member record and its pair on the leg the step crosses. */
data class MemberPair(val record: TraceRecord, val pDirected: Double, val pInterest: Double)

/** Each member's pair on the leg the step crosses, in the causal order. */
fun memberPairs(path: TracePath, step: TraceStep): List<MemberPair> {
    val at = step.to - 1
    val from = path.nodes[at]
    val to = path.nodes[at + 1]
    return step.carrying.records.map { record ->
        val leg = crossedLeg(record, from, to)
        MemberPair(record, leg?.pDirected ?: 0.0, leg?.pInterest ?: 0.0)
    }
}

/** The records' unclipped sum, and whether it passes the limit (SR-G6). */
data class MemberSum(val pDirected: Double, val pInterest: Double, val clipped: Boolean)

fun memberSum(path: TracePath, step: TraceStep): MemberSum {
    val pairs = memberPairs(path, step)
    val d = pairs.sumOf { it.pDirected }
    val i = pairs.sumOf { it.pInterest }
    return MemberSum(d, i, clipped = abs(d) > LIMIT + LIMIT_EPSILON || abs(i) > LIMIT + LIMIT_EPSILON)
}

private const val CLIPPED_FOLD = "Added up, they go past the limit an opinion can reach, so the step carries the limit."

/** Under the records whose sum passes the limit (RankRecords.md:7). */
const val CLIPPED_RECORDS = "Added up, these go past the limit an opinion can reach, so the step carries the limit."

/** `Your opinion of @ada — the first of this path's two steps.` (RankHop.md:7). */
fun placeNote(title: String, place: Int, steps: Int): String =
    if (steps == 1) {
        "$title — this path's one step."
    } else {
        "$title — the ${ordinal(place)} of this path's ${countWord(steps)} steps."
    }

/**
 * The fold's note (RankHop.md:9-13): the reader's own word with the pad's
 * clause, or the giver's handle without it, closing on the limit when the
 * records pass it.
 */
fun foldNote(path: TracePath, step: TraceStep, context: TraceContext): String {
    val giver = giverOf(step, path)
    val own = context.isOwn(giver)
    val thing = thingName(path, step.to, context)
    val n = step.carrying.records.size
    val given = if (own) "You have given $thing" else "${handleOf(giver)} has given $thing"
    val pad = if (own) " — the same adding up the pad shows you as your current opinion" else ""
    val body = if (n == 1) {
        "$given one opinion, and that one is what carries$pad."
    } else {
        "$given ${countWord(n)} opinions. They add up to one, and that one is what carries$pad."
    }
    return if (memberSum(path, step).clipped) "$body $CLIPPED_FOLD" else body
}

/**
 * The floor's opening line (RankRecords.md:3): `The two records behind your
 * opinion of @ada.`, in the third person for a step another gave.
 */
fun recordsNote(title: String, n: Int): String {
    val step = when {
        title.startsWith("Your ") -> "your ${title.removePrefix("Your ")}"
        title.startsWith("How you ") -> "how you ${title.removePrefix("How you ")}"
        else -> title
    }
    return if (n == 1) "The record behind $step." else "The ${countWord(n)} records behind $step."
}

/** A record's age: the ladder, a date past thirty days (RankRecords.md:17). */
fun recordAge(record: TraceRecord, now: Instant): String = ageLadder(record.landedAt, now)

/** The records' closing line (RankRecords.md:19). */
const val PUBLIC_SUM_LINE = "These records are public. Anyone can run the same sum and land on the same number."
