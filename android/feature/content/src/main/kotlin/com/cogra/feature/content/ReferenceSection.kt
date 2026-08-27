// The reference section every authoring surface carries: the composer,
// the post edit screen, the comment box, the reply box, and the inline
// comment editor — the same surfaces the tag section rides. One holder
// for all of them, for the same reason: the rules (the batch cap, what
// counts as a change, where a refusal lands) are identical wherever an
// author declares a citation, and a second copy of them is a second
// place to get them wrong.
//
// A reference is keyed by its target's id, not by a name: the finder
// hands back the L2 id a `ReferenceInput` names, so nothing here
// canonicalizes or validates text the way the tag section must.

package com.cogra.feature.content

import com.cogra.domain.Outcome
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.map
import com.cogra.domain.references.MAX_REFERENCES
import com.cogra.domain.references.REFERENCE_DEFAULT_RELEVANCE
import com.cogra.domain.references.REFERENCE_DEFAULT_SUPPORT
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.repo.ReferenceRepository

/**
 * One citation a submit will declare: the target's **L2 id**, the
 * typed target the chip renders from, the two parameters its sliders
 * carry, and the server's own words about it when a write was refused
 * on this chip.
 *
 * [targetId] is what `ReferenceInput.target` and the withdrawal
 * mutation name — deliberately *not* a claim's `targetId`, which is
 * the raw L1 identifier and addresses no mutation. Only a typed target
 * carries the L2 id, which is why a claim this instance could not type
 * never reaches an authoring section (see [editableRow]).
 *
 * [target] is null only for a chip the Reference affordance staged
 * before its label resolved; the citation is still addressable,
 * because the affordance was handed an L2 id to begin with.
 */
data class ReferenceRow(
    val targetId: String,
    val target: ReferenceTargetView?,
    val relevance: Double = REFERENCE_DEFAULT_RELEVANCE,
    val support: Double = REFERENCE_DEFAULT_SUPPORT,
    val error: String? = null,
) {
    fun sameClaimAs(other: ReferenceRow): Boolean =
        targetId == other.targetId && relevance == other.relevance && support == other.support

    fun toClaim(): ReferenceClaim = ReferenceClaim(targetId, relevance, support)
}

/**
 * One reference section's whole state. [loaded] is what the content
 * already carries — empty while creating, since nothing is being
 * changed yet. Every mutator returns a new state rather than editing in
 * place, so a ViewModel holding several sections updates one by naming
 * it.
 */
data class ReferenceSectionState(
    /** The references the content will carry once this submit lands. */
    val references: List<ReferenceRow> = emptyList(),
    /** What a read loaded — what a change is measured against. */
    val loaded: List<ReferenceRow> = emptyList(),
    /** Which chip has its parameter sliders open; null when none. */
    val tuning: String? = null,
    /** The finder, while it is open. */
    val finder: ReferenceFinderState? = null,
) {
    /** The per-kind batch cap (D7) — the section blocks the 11th chip itself. */
    val capReached: Boolean get() = references.size >= MAX_REFERENCES

    /**
     * Every citation this submit declares that the content does not
     * already carry at these parameters — re-declaring one at a new
     * relevance is its own Reference act, not a no-op.
     */
    val adds: List<ReferenceRow>
        get() = references.filter { row -> loaded.none { it.sameClaimAs(row) } }

    /**
     * Citations the author took off. Each is a *withdrawal*, whose cost
     * the server quotes — the bundle nets to (0, 0) and that may take
     * more than one record (D11).
     */
    val removes: List<ReferenceRow>
        get() = loaded.filter { row -> references.none { it.targetId == row.targetId } }

    /**
     * How many prepare calls this section stages against existing
     * content. A withdrawal is one call whose batch may be longer than
     * one record, so this counts gestures, not signed acts — the true
     * cost is known only once the server has assembled the batch
     * (D11), which is why the confirm quotes it after staging.
     */
    val changeCount: Int get() = adds.size + removes.size

    /**
     * Adds a target as a chip: capped at ten (D7) and never duplicated —
     * picking a target already staged is a no-op, the same as the tag
     * section's re-entry of a staged name.
     */
    fun added(targetId: String, target: ReferenceTargetView?): ReferenceSectionState {
        if (capReached || references.any { it.targetId == targetId }) return this
        return copy(references = references + ReferenceRow(targetId, target))
    }

    fun removed(targetId: String) = copy(
        references = references.filterNot { it.targetId == targetId },
        tuning = if (tuning == targetId) null else tuning,
    )

    /** Tapping a staged chip opens its parameters. */
    fun tuned(targetId: String?) = copy(tuning = targetId)

    fun withRelevance(targetId: String, value: Double) =
        mapRow(targetId) { it.copy(relevance = value) }

    fun withSupport(targetId: String, value: Double) =
        mapRow(targetId) { it.copy(support = value) }

    /** A fresh staging pass starts with no stale refusals on the chips. */
    fun withoutErrors() = copy(references = references.map { it.copy(error = null) })

    /**
     * Puts a refusal on the chip it names. Returns null in the second
     * position when the chip carried it — a withdrawal has no chip left,
     * so that message needs somewhere else to go.
     */
    fun withError(targetId: String, message: String?): Pair<ReferenceSectionState, String?> =
        if (references.any { it.targetId == targetId }) {
            mapRow(targetId) { it.copy(error = message) } to null
        } else {
            this to message
        }

    /** Puts a refusal on chip [index], or hands it back unplaced. */
    fun withErrorAt(index: Int, message: String): Pair<ReferenceSectionState, String?> =
        if (index in references.indices) {
            copy(
                references = references.mapIndexed { i, row ->
                    if (i == index) row.copy(error = message) else row
                },
            ) to null
        } else {
            this to message
        }

    fun withFinder(state: ReferenceFinderState?) = copy(finder = state)

    private fun mapRow(targetId: String, block: (ReferenceRow) -> ReferenceRow) =
        copy(references = references.map { if (it.targetId == targetId) block(it) else it })
}

/**
 * The finder, while it is open (D20). Deliberately plain: a query
 * field and a list of what resolved. What populates it by default, and
 * how it looks, ride jakob's pending design — this is the structure
 * the clients bind to once, and slice 2.7 replaces the lookup behind
 * the same query.
 */
data class ReferenceFinderState(
    val query: String = "",
    val candidates: List<ReferenceCandidateRow> = emptyList(),
    val searching: Boolean = false,
    /** The lookup itself failed — distinct from resolving nothing. */
    val failed: Boolean = false,
) {
    /**
     * Nothing matched what was typed. Not an error: exact-match
     * resolution means most of what a finder is asked is a prefix of
     * something still being typed.
     */
    val foundNothing: Boolean
        get() = !searching && !failed && query.isNotBlank() && candidates.isEmpty()
}

/** One offer in the finder's list. */
data class ReferenceCandidateRow(
    val targetId: String,
    val target: ReferenceTargetView,
)

/**
 * This claim as a row an authoring section can carry, or null when it
 * cannot carry one.
 *
 * A claim's `targetId` is the raw L1 identifier, while every write
 * names its target by L2 id — which only the typed target holds. So a
 * claim whose far end the display store could not type is
 * *unaddressable*: no withdrawal could be staged for it. It is left
 * out of the editable section entirely, both baseline and draft, so
 * its absence is never read as the author having removed it. It still
 * renders read-only in the reference row, because the citation stands.
 */
internal fun ReferenceClaimView.editableRow(): ReferenceRow? {
    val id = when (val t = target) {
        is ReferenceTargetView.Profile -> t.id
        is ReferenceTargetView.Content -> t.id
        null -> return null
    }
    return ReferenceRow(
        targetId = id,
        target = target,
        relevance = relevance,
        support = support,
    )
}

/** `["references", i, "target"]` — the chip the server is talking about. */
internal fun referenceFieldIndex(field: List<String>?): Int? {
    if (field == null || field.size < 2 || field[0] != "references") return null
    return field[1].toIntOrNull()
}

/**
 * How long the finder waits after a keystroke before asking. The
 * lookup is exact-match today, so a query mid-word resolves nothing —
 * waiting for a pause costs the author nothing and the server a round
 * trip per word instead of per letter.
 */
internal const val FINDER_DEBOUNCE_MILLIS = 250L

/**
 * One finder lookup, as the list it produces. A blank query asks
 * nothing: what populates the finder by default rides jakob's pending
 * design (D20).
 */
internal suspend fun ReferenceRepository.candidateRows(
    query: String,
): Outcome<List<ReferenceCandidateRow>> =
    if (query.isBlank()) {
        Outcome.Success(emptyList())
    } else {
        referenceCandidates(query).map { candidates ->
            candidates.map { ReferenceCandidateRow(it.targetId, it.target) }
        }
    }
