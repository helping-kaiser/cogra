// THE SCORE'S TRACE, READ (score-readout packet §5; FeedEntry.md, RankPath.md,
// RankHop.md, RankRecords.md; copy-voice, *The score drill-down*). Everything
// the four levels draw, read off one held answer. The web's twin is
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

import com.cogra.domain.ageLadder
import java.time.Instant
import kotlin.math.abs

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

/** The limit an opinion can reach on either axis (api-spec.md `Dimension`). */
private const val LIMIT = 1.0
private const val LIMIT_EPSILON = 1e-9

private val NUMBER_WORDS = listOf("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten")
private val ORDINALS =
    listOf("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth")

/** `two` — the boards' own counts are words (`two opinions`, `two steps`). */
fun countWord(n: Int): String = NUMBER_WORDS.getOrNull(n) ?: n.toString()

private fun ordinal(n: Int): String = ORDINALS.getOrNull(n - 1) ?: "${n}th"

/** Persons fold: an address and its profile are one node (feed-ranking.md §2; RankHop.records). */
private fun folded(graphId: String): String =
    if (graphId.startsWith("addr:")) "prof:${graphId.removePrefix("addr:")}" else graphId

private fun TraceNode.isPerson(): Boolean =
    if (kind != null) kind == TraceNodeKind.USER else graphId.startsWith("prof:") || graphId.startsWith("addr:")

private fun TraceNode.isTopic(): Boolean =
    kind == TraceNodeKind.HASHTAG || (kind == null && graphId.startsWith("name:"))

/**
 * The person on node [index] of [path]: the author of the records the hop
 * leaving it folds — the one whose account is that node, else the first.
 */
private fun personAt(path: TracePath, index: Int): TracePerson? {
    val records = path.hops.getOrNull(index)?.records.orEmpty()
    val node = path.nodes[index]
    return records.firstOrNull { it.author != null && it.author.id == node.id }?.author
        ?: records.firstOrNull()?.author
}

// ── Steps ────────────────────────────────────────────────────────────────

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

/** The path's steps: hops grouped so a two-legged record reads as one. */
fun TracePath.steps(): List<TraceStep> {
    val steps = mutableListOf<TraceStep>()
    val last = nodes.size - 1
    var at = 0
    while (at < hops.size) {
        val start = at
        val through = mutableListOf<Int>()
        while (
            at + 1 < hops.size && at + 1 < last && !nodes[at + 1].isPerson() && shareARecord(hops[at], hops[at + 1])
        ) {
            through += at + 1
            at += 1
        }
        steps += TraceStep(hops.subList(start, at + 1), from = start, to = at + 1, through = through)
        at += 1
    }
    return steps
}

// ── Words ────────────────────────────────────────────────────────────────

/** The giver of a step: the author of the records its carrying hop folds. */
private fun giverOf(step: TraceStep, path: TracePath): TracePerson? =
    step.carrying.records.firstOrNull()?.author
        ?: step.hops.first().records.firstOrNull()?.author
        ?: personAt(path, step.from)

private fun TraceContext.isOwn(giver: TracePerson?): Boolean = !borrowed && giver != null && giver.id == viewer

/** A person as a subject: `@ada`, or `Deleted account` where none fronts it (SR-G12). */
private fun handleOf(person: TracePerson?): String = if (person == null) "Deleted account" else "@${person.handle}"

/**
 * A thing as a step names it (RankPath.md:15): the reached thing `it`, another
 * post by its title, a comment by its author's handle, a person by their
 * handle, a topic by its `#name`. A node CoGra carries no row for is named by
 * what it is (SR-G4's residual, build reading).
 */
private fun thingName(path: TracePath, index: Int, context: TraceContext): String {
    if (index == path.nodes.size - 1) return "it"
    val node = path.nodes[index]
    if (node.isTopic()) {
        return if (node.graphId.startsWith("name:")) "#${node.graphId.removePrefix("name:")}" else "a topic"
    }
    if (node.isPerson()) return personAt(path, index)?.let { "@${it.handle}" } ?: "someone"
    return when (val named = node.id?.let(context.named::get)) {
        is TraceNamed.Post -> when {
            !named.title.isNullOrEmpty() -> "\"${named.title}\""
            named.authorHandle != null -> "@${named.authorHandle}'s post"
            else -> "a post"
        }
        is TraceNamed.Comment -> named.authorHandle?.let { "@$it" } ?: "a comment"
        null -> when (node.kind) {
            TraceNodeKind.POST -> "a post"
            TraceNodeKind.COMMENT -> "a comment"
            else -> "a thing"
        }
    }
}

private fun TraceStep.family(): TraceFamily? =
    carrying.records.firstOrNull()?.family ?: hops.first().records.firstOrNull()?.family

/**
 * A step's title (RankPath.md:15-31), in the second person for the reader's own
 * steps in their own view and the third person for everyone else's — the
 * lender's included, under a borrowed view.
 */
fun stepTitle(path: TracePath, step: TraceStep, context: TraceContext): String {
    val giver = giverOf(step, path)
    val own = context.isOwn(giver)
    val who = if (own) "You" else handleOf(giver)
    val thing = thingName(path, step.to, context)
    val carrier = step.through.firstOrNull()?.let { thingName(path, it, context) }
    return when (step.family()) {
        TraceFamily.AFFINITY -> if (own) "How you feel about $thing" else "How $who feels about $thing"
        TraceFamily.PUBLISH -> {
            val ownWriting = thing == "it" && context.targetKind == TraceThingKind.COMMENT
            if (ownWriting) "$who wrote it" else "$who published $thing"
        }
        TraceFamily.REVIEW -> "$who replied to $thing"
        TraceFamily.REFERENCE -> if (carrier == null) "$who cited $thing" else "$who cited $thing in $carrier"
        TraceFamily.TAG -> if (carrier == null) "$who tagged $thing" else "$who tagged $thing $carrier"
        // An opinion — and, as a build reading, any family the boards draw no
        // title for, which reads as the opinion it carries.
        else -> if (own) "Your opinion of $thing" else "$who's opinion of $thing"
    }
}

private fun newestLanding(records: List<TraceRecord>): Instant? = records.maxOfOrNull { it.landedAt }

private fun isOwnPublishOfTarget(path: TracePath, step: TraceStep): Boolean =
    step.family() == TraceFamily.PUBLISH && step.to == path.nodes.size - 1

/**
 * A step's age (RankPath.md:7-11): its newest record's landing on the ladder;
 * an author's publish of the reached thing is aged as the thing itself.
 */
fun stepAge(path: TracePath, step: TraceStep, context: TraceContext): String {
    val at = if (isOwnPublishOfTarget(path, step) && context.targetCreatedAt != null) {
        context.targetCreatedAt
    } else {
        newestLanding(step.carrying.records)
    }
    return at?.let { ageLadder(it, context.now) }.orEmpty()
}

/** A step's `Newest of them`: when the newest of its records landed (RankHop.md:3). */
fun hopNewest(hop: TraceHop, now: Instant): String = newestLanding(hop.records)?.let { ageLadder(it, now) }.orEmpty()

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

// ── The path ─────────────────────────────────────────────────────────────

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

// ── Level one ────────────────────────────────────────────────────────────

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

// ── Level three ──────────────────────────────────────────────────────────

/** The leg a member record contributes to the hop `from → to` (X-SR4). */
fun crossedLeg(record: TraceRecord, from: TraceNode, to: TraceNode): TraceLeg? {
    val source = folded(from.graphId)
    val target = folded(to.graphId)
    return record.legs.firstOrNull { folded(it.sourceId) == source && folded(it.targetId) == target }
        ?: record.legs.firstOrNull { it.role == TraceLegRole.A }
        ?: record.legs.firstOrNull()
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

// ── Level four ───────────────────────────────────────────────────────────

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
