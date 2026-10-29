// The two pickers' own state (TagPicker, TagPickerTyping, TagPickerRefused,
// ReferencePicker; behavior/*.md): what is typed, and the last answer the
// read gave — TAGGED with what it answered, so a stale answer never reads as
// the rows for what is typed now and nothing has to be reset as the reader
// types. web's twins hold the same in `tag-picker.tsx` / `reference-picker.tsx`.
//
// What a pick STAGES is not here: the staged section IS the composer's own
// tags and citations ([TagSectionState], [ReferenceSectionState]), applied the
// moment the pick is made, so the picker holds only the search.

package com.cogra.feature.content

import com.cogra.domain.feed.FeedKind
import com.cogra.domain.topics.TagNameReading
import com.cogra.domain.topics.readTagName

/** The index's answer for one canonical name: the names in use, or no answer. */
data class TagIndexAnswer(val name: String, val names: List<String> = emptyList(), val failed: Boolean = false)

/**
 * The tag picker, while it is open.
 *
 * THE FIRST ROW IS THE TYPED NAME, ALWAYS (TagPicker.md; jakob 2026-09-30,
 * K14.1): it needs no read, so a miss or a fault leaves it standing — the
 * index only ever adds names under it, it never gates one.
 */
data class TagPickerState(
    val query: String = "",
    val index: TagIndexAnswer? = null,
) {
    val reading: TagNameReading get() = readTagName(query)

    /** The typed name canonicalized, or null while it is empty or refused. */
    val canonical: String? get() = (reading as? TagNameReading.Legal)?.canonical

    /** The answer for what is typed now, or null while it is in flight. */
    private val current: TagIndexAnswer? get() = index?.takeIf { canonical != null && it.name == canonical }

    /** The first row: the typed name, unless it is already staged (it stands only in the staged section). */
    fun firstRow(staged: Collection<String>): String? = canonical?.takeIf { it !in staged }

    /** The index's rows under the first: names in use, never the typed name twice, never a staged one. */
    fun indexed(staged: Collection<String>): List<String> =
        current?.takeUnless { it.failed }?.names.orEmpty().filter { it != canonical && it !in staged }.distinct()

    /** TagPicker.md: "the candidates' read gets no answer" — the fault line stands where they were. */
    val faulted: Boolean get() = current?.failed == true
}

/** The candidates' answer for one query under one filter. */
data class CandidateAnswer(
    val query: String,
    val kinds: Set<FeedKind>,
    val candidates: List<ReferenceCandidateRow> = emptyList(),
    val failed: Boolean = false,
)

/**
 * The citation picker, while it is open. [kinds] is the committed filter —
 * the sheet stages its own copy until Done (ReferencePicker.md) — and none
 * narrows nothing.
 */
data class ReferencePickerState(
    val query: String = "",
    val kinds: Set<FeedKind> = emptySet(),
    val answer: CandidateAnswer? = null,
) {
    /** The answer for what is asked now, or null while it is in flight. */
    private val current: CandidateAnswer?
        get() = answer?.takeIf { isQueryable(query) && it.query == query.trim() && it.kinds == kinds }

    /** ALWAYS a staged citation stands only in the staged section above the results. */
    fun results(staged: Collection<String>): List<ReferenceCandidateRow> =
        current?.takeUnless { it.failed }?.candidates.orEmpty().filter { it.targetId !in staged }

    /** ReferencePicker.md: "the results' read gets no answer GIVEN no result has loaded for the query". */
    val faulted: Boolean get() = current?.failed == true
}

/**
 * Whether a query is worth sending (web's `isQueryable`): something typed,
 * not a `#` — a topic is tagged, never cited, so the finder finds nothing
 * under it — and not a bare `@`.
 */
internal fun isQueryable(raw: String): Boolean {
    val trimmed = raw.trim()
    return trimmed.isNotEmpty() && !trimmed.startsWith("#") && trimmed != "@"
}

/** Which composer opened a picker — the arrow names it, and the cap line says its noun (the K13 round). */
enum class PickerOrigin(val backLabel: String, val noun: String) {
    /** A post's composer or its edit. */
    Post("Back to the post", "post"),

    /** A reply's composer or a comment's edit. */
    Comment("Back to the comment", "comment"),
}

/**
 * The tag picker's pick (TagPicker.md): [name] — already canonical — joins the
 * staged tags, capped at ten and never twice. A name the edit WITHDREW comes
 * back as it stood, the loaded claim with its own parameters, so the
 * withdrawal unstages and no second record is staged for it ("the name's
 * withdrawal is unstaged").
 */
fun TagSectionState.staged(name: String): TagSectionState {
    if (capReached || tags.any { it.name == name }) return this
    return copy(tags = tags + (loaded.firstOrNull { it.name == name } ?: TagRow(name)))
}

fun TagSectionState.withPicker(state: TagPickerState?): TagSectionState = copy(picker = state)

/**
 * The citation picker's pick (ReferencePicker.md): the candidate joins the
 * staged citations, capped at ten and never twice. A target the edit WITHDREW
 * comes back as it stood — the loaded claim, its own pair — so the
 * withdrawal unstages and no second record is staged for it.
 */
fun ReferenceSectionState.staged(row: ReferenceCandidateRow): ReferenceSectionState {
    if (capReached || references.any { it.targetId == row.targetId }) return this
    val restored = loaded.firstOrNull { it.targetId == row.targetId }
    return copy(references = references + (restored ?: ReferenceRow(row.targetId, row.target)))
}

fun ReferenceSectionState.withPicker(state: ReferencePickerState?): ReferenceSectionState = copy(picker = state)
