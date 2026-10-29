// A STEP'S WORDS (RankPath.md:7-31): its title per family and giver, in the
// second person for the reader's own steps in their own view and the third
// person for everyone else's, and its age on the ladder. See `TraceSteps.kt`.

package com.cogra.domain.score

import com.cogra.domain.ageLadder
import java.time.Instant

/** The giver of a step: the author of the records its carrying hop folds. */
internal fun giverOf(step: TraceStep, path: TracePath): TracePerson? =
    step.carrying.records.firstOrNull()?.author
        ?: step.hops.first().records.firstOrNull()?.author
        ?: personAt(path, step.from)

/** Whether [giver] is the view's own — the reader's, in their own view. */
internal fun TraceContext.isOwn(giver: TracePerson?): Boolean = !borrowed && giver != null && giver.id == viewer

/** A person as a subject: `@ada`, or `Deleted account` where none fronts it (SR-G12). */
internal fun handleOf(person: TracePerson?): String = if (person == null) "Deleted account" else "@${person.handle}"

/**
 * A thing as a step names it (RankPath.md:15): the reached thing `it`, another
 * post by its title, a comment by its author's handle, a person by their
 * handle, a topic by its `#name`.
 */
internal fun thingName(path: TracePath, index: Int, context: TraceContext): String {
    if (index == path.nodes.size - 1) return "it"
    val node = path.nodes[index]
    return when {
        node.isTopic() -> if (node.graphId.startsWith("name:")) "#${node.graphId.removePrefix("name:")}" else "a topic"
        node.isPerson() -> personAt(path, index)?.let { "@${it.handle}" } ?: "someone"
        else -> namedNode(node, context)
    }
}

/** A post or a comment by what the open's names read; one CoGra carries no row for, by what it is (SR-G4). */
private fun namedNode(node: TraceNode, context: TraceContext): String =
    when (val named = node.id?.let(context.named::get)) {
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

internal fun TraceStep.family(): TraceFamily? =
    carrying.records.firstOrNull()?.family ?: hops.first().records.firstOrNull()?.family

/**
 * A step's title (RankPath.md:15-31), in the second person for the reader's
 * own steps in their own view and the third person for everyone else's — the
 * lender's included, under a borrowed view.
 */
fun stepTitle(path: TracePath, step: TraceStep, context: TraceContext): String {
    val own = context.isOwn(giverOf(step, path))
    return familyTitle(
        family = step.family(),
        own = own,
        who = if (own) "You" else handleOf(giverOf(step, path)),
        thing = thingName(path, step.to, context),
        carrier = step.through.firstOrNull()?.let { thingName(path, it, context) },
        comment = context.targetKind == TraceThingKind.COMMENT,
    )
}

/** The family's drawn words; any family the boards draw no title for reads as the opinion it carries. */
private fun familyTitle(
    family: TraceFamily?,
    own: Boolean,
    who: String,
    thing: String,
    carrier: String?,
    comment: Boolean,
): String = when (family) {
    TraceFamily.AFFINITY -> if (own) "How you feel about $thing" else "How $who feels about $thing"
    // A comment reached through its own writing reads `wrote it` (RankPath.md:19).
    TraceFamily.PUBLISH -> if (thing == "it" && comment) "$who wrote it" else "$who published $thing"
    TraceFamily.REVIEW -> "$who replied to $thing"
    TraceFamily.REFERENCE -> if (carrier == null) "$who cited $thing" else "$who cited $thing in $carrier"
    TraceFamily.TAG -> if (carrier == null) "$who tagged $thing" else "$who tagged $thing $carrier"
    else -> if (own) "Your opinion of $thing" else "$who's opinion of $thing"
}

internal fun newestLanding(records: List<TraceRecord>): Instant? = records.maxOfOrNull { it.landedAt }

internal fun isOwnPublishOfTarget(path: TracePath, step: TraceStep): Boolean =
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
