// THE SCORE'S TRACE, READ (score-readout packet §5; FeedEntry.md, RankPath.md,
// RankHop.md, RankRecords.md; copy-voice, *The score drill-down*). Everything
// the four levels draw, read off one held answer — the steps and people here,
// the step titles in `TraceTitles.kt`, a path's words in `TracePaths.kt`, each
// level's own lines in `TraceLevels.kt`. The web's twin is
// `web/src/lib/score/trace-model.ts`; the two say the same words.
//
// THE ONLY ARITHMETIC is the add-up rendering (`ScoreFigure.kt`) and the
// records' sum checked against the limit, which states what the records are,
// never a second opinion of what the step carries (RankHop.md:13). Paths stay
// in extraction order: "strongest first" is the ranker's order, never
// re-sorted here (SR-G9).
//
// A STEP IS ONE RECORD (RankPath.md:13; SR-G4): a hop crosses one node pair,
// and a record with two legs crosses two hops through the thing it passed — a
// comment it answered, a post it cited from, a topic it tagged — so the two
// hops that share that record read as ONE step naming what it passed through,
// and the trace above shows only people and the reached thing.
//
// THE PEOPLE ARE THE RECORDS' AUTHORS: a hop leaving a person is that person's
// own act, so the author of the records it folds is who stands on that node —
// their face and handle ride the answer, and no second read is made for them.

package com.cogra.domain.score

import java.time.Instant

/** The kind of thing a trace is about — the reached thing's mark and its cover. */
enum class TraceThingKind { POST, COMMENT, PERSON, TOPIC }

/** What the trace reads its words against. */
data class TraceContext(
    /** Whose view the trace walked from: the reader's own actor, or the lender (CD-5). */
    val viewer: String,
    /** The borrowed view: the lender's handle speaks every first person (SR-G3). */
    val borrowed: Boolean,
    /** The posts and comments steps pass through, by CoGra id. */
    val named: Map<String, TraceNamed>,
    /** The reached thing's own kind, for its mark and for `wrote it`. */
    val targetKind: TraceThingKind,
    /** The reached thing's age, where its own publish is a step (RankPath.md:11). */
    val targetCreatedAt: Instant?,
    val now: Instant,
)

/** How many paths stand drawn before the quiet row (FeedEntry.jsx: four). */
const val DRAWN_PATHS = 4

private val NUMBER_WORDS = listOf("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten")
private val ORDINALS =
    listOf("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth")

/** `two` — the boards' own counts are words (`two opinions`, `two steps`). */
fun countWord(n: Int): String = NUMBER_WORDS.getOrNull(n) ?: n.toString()

/** `first` — a step's place on its path (RankHop.md:7). */
internal fun ordinal(n: Int): String = ORDINALS.getOrNull(n - 1) ?: "${n}th"

/** Persons fold: an address and its profile are one node (feed-ranking.md §2; RankHop.records). */
private fun folded(graphId: String): String =
    if (graphId.startsWith("addr:")) "prof:${graphId.removePrefix("addr:")}" else graphId

internal fun TraceNode.isPerson(): Boolean =
    if (kind != null) kind == TraceNodeKind.USER else graphId.startsWith("prof:") || graphId.startsWith("addr:")

internal fun TraceNode.isTopic(): Boolean =
    kind == TraceNodeKind.HASHTAG || (kind == null && graphId.startsWith("name:"))

/**
 * The person on node [index] of [path]: the author of the records the hop
 * leaving it folds — the one whose account is that node, else the first.
 */
internal fun personAt(path: TracePath, index: Int): TracePerson? {
    val records = path.hops.getOrNull(index)?.records.orEmpty()
    val node = path.nodes[index]
    return records.firstOrNull { it.author != null && it.author.id == node.id }?.author
        ?: records.firstOrNull()?.author
}

/** One step: a record's crossing, one hop or two. */
data class TraceStep(
    /** The hops the step crosses, in path order. */
    val hops: List<TraceHop>,
    /** Index of the node the step starts on, and of the one it reaches. */
    val from: Int,
    val to: Int,
    /** The things it passed through on the way (the carrier of a two-legged record). */
    val through: List<Int>,
) {
    /**
     * The hop whose fold the step carries: the one reaching what the step names.
     * For a two-legged record that is its terminal leg's (X-SR4, SR-G4's merged step).
     */
    val carrying: TraceHop get() = hops.last()
}

private fun shareARecord(a: TraceHop, b: TraceHop): Boolean {
    val ids = a.records.mapTo(HashSet()) { it.id }
    return b.records.any { it.id in ids }
}

/**
 * Whether hop [at] and the next are one record's two legs: the node between
 * them is a thing passed through (never a person, never the reached thing),
 * and the two hops share a record.
 */
private fun TracePath.mergesNext(at: Int): Boolean {
    val between = at + 1
    if (between >= hops.size || between >= nodes.size - 1) return false
    return !nodes[between].isPerson() && shareARecord(hops[at], hops[between])
}

/** The path's steps: hops grouped so a two-legged record reads as one. */
fun TracePath.steps(): List<TraceStep> {
    val steps = mutableListOf<TraceStep>()
    var at = 0
    while (at < hops.size) {
        val start = at
        val through = mutableListOf<Int>()
        while (mergesNext(at)) {
            through += at + 1
            at += 1
        }
        steps += TraceStep(hops.subList(start, at + 1), from = start, to = at + 1, through = through)
        at += 1
    }
    return steps
}

/** The leg a member record contributes to the hop `from → to` (X-SR4). */
fun crossedLeg(record: TraceRecord, from: TraceNode, to: TraceNode): TraceLeg? {
    val source = folded(from.graphId)
    val target = folded(to.graphId)
    return record.legs.firstOrNull { folded(it.sourceId) == source && folded(it.targetId) == target }
        ?: record.legs.firstOrNull { it.role == TraceLegRole.A }
        ?: record.legs.firstOrNull()
}
