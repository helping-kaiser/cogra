// The tag section every authoring surface carries: the composer, the
// post edit screen, the comment box, the reply box, and the inline
// comment editor (F3, F9, F10). One holder for all of them — the rules
// (canonical names, the batch cap, what counts as a change) are the
// same wherever an author declares a topic, and a second copy of them
// is a second place to get them wrong.

package com.cogra.feature.content

import com.cogra.domain.topics.TAG_DEFAULT_CONFIDENCE
import com.cogra.domain.topics.TAG_DEFAULT_RELEVANCE
import com.cogra.domain.topics.TagClaim
import com.cogra.domain.topics.canonicalTagName
import com.cogra.domain.topics.isAddableTagName

/** Mirrors the API's batch cap (D18) so a surface refuses locally, not with a round trip. */
const val MAX_TAGS = 10

/**
 * One tag a submit will declare: the canonical name, the two parameters
 * its sliders carry, and the server's own words about it when the write
 * was refused on this chip (F2).
 */
data class TagRow(
    val name: String,
    val relevance: Double = TAG_DEFAULT_RELEVANCE,
    val confidence: Double = TAG_DEFAULT_CONFIDENCE,
    val error: String? = null,
) {
    fun sameClaimAs(other: TagRow): Boolean =
        name == other.name && relevance == other.relevance && confidence == other.confidence

    fun toClaim(): TagClaim = TagClaim(name, relevance, confidence)
}

/**
 * One tag section's whole state. [loaded] is what the content already
 * carries — empty while creating, since nothing is being changed yet.
 * Every mutator returns a new state rather than editing in place, so a
 * ViewModel holding several sections updates one by naming it.
 */
data class TagSectionState(
    /** The entry field's raw text — [canonicalTagName] shows what it will become. */
    val input: String = "",
    /** The topics the content will carry once this submit lands. */
    val tags: List<TagRow> = emptyList(),
    /** What a read loaded — what a change is measured against. */
    val loaded: List<TagRow> = emptyList(),
    /** Which chip has its parameter sliders open; null when none. */
    val tuning: String? = null,
) {
    /** The batch cap (D18) — the section blocks the 11th chip itself. */
    val capReached: Boolean get() = tags.size >= MAX_TAGS

    /**
     * Every tag this submit declares that the content does not already
     * carry at these parameters — re-declaring a tag at a new relevance
     * is its own Tag act, not a no-op.
     */
    val adds: List<TagRow> get() = tags.filter { row -> loaded.none { it.sameClaimAs(row) } }

    /** Tags the author took off — each a further Tag at relevance 0 (hashtag.md §4). */
    val removes: List<String>
        get() = loaded.map { it.name }.filter { name -> tags.none { it.name == name } }

    /** How many Tag acts this section stages against existing content. */
    val changeCount: Int get() = adds.size + removes.size

    fun withInput(value: String) = copy(input = value)

    /**
     * Adds the current entry as a chip: canonical, capped at 10 (D18),
     * legal by L1's atom rule (F1), and never duplicated — re-entering a
     * name already staged just clears the field, the same as a
     * successful add would.
     */
    fun added(): TagSectionState {
        if (capReached || !isAddableTagName(input)) return this
        val name = canonicalTagName(input)
        return copy(
            input = "",
            tags = if (tags.any { it.name == name }) tags else tags + TagRow(name),
        )
    }

    fun removed(name: String) = copy(tags = tags.filterNot { it.name == name }, tuning = null)

    /** Tapping a staged chip opens its parameters; null closes them (F6). */
    fun tuned(name: String?) = copy(tuning = name)

    fun withRelevance(name: String, value: Double) = mapRow(name) { it.copy(relevance = value) }

    fun withConfidence(name: String, value: Double) = mapRow(name) { it.copy(confidence = value) }

    /** A fresh staging pass starts with no stale refusals on the chips (F2). */
    fun withoutErrors() = copy(tags = tags.map { it.copy(error = null) })

    /**
     * Puts a refusal on the chip it names. Returns null in the second
     * position when the chip carried it — a removal has no chip left, so
     * that message needs somewhere else to go.
     */
    fun withError(name: String, message: String?): Pair<TagSectionState, String?> =
        if (tags.any { it.name == name }) {
            mapRow(name) { it.copy(error = message) } to null
        } else {
            this to message
        }

    /** Puts a refusal on chip [index], or hands it back unplaced. */
    fun withErrorAt(index: Int, message: String): Pair<TagSectionState, String?> =
        if (index in tags.indices) {
            copy(tags = tags.mapIndexed { i, row -> if (i == index) row.copy(error = message) else row }) to null
        } else {
            this to message
        }

    private fun mapRow(name: String, block: (TagRow) -> TagRow) =
        copy(tags = tags.map { if (it.name == name) block(it) else it })
}

/** `["tags", i, "name"]` — the chip the server is talking about (F2). */
internal fun tagFieldIndex(field: List<String>?): Int? {
    if (field == null || field.size < 2 || field[0] != "tags") return null
    return field[1].toIntOrNull()
}
