// What a topic name may be, and what a Tag act declares about it.
//
// Legality is L1's identifier atom, exactly (hashtag.md §1, D3): ASCII
// `[A-Za-z0-9._-]`, 1..=128 bytes, lowercase-normalized. The server
// stays the authority — every name still rides to it and a refusal
// surfaces on the offending field — but the client refuses to stage a
// name it can already see the substrate cannot carry, so a reader
// learns while typing rather than after signing (fix round 1, F1).

package com.cogra.domain.topics

/** The atom's byte ceiling — bytes, not characters, as L1 counts them. */
const val MAX_TAG_NAME_BYTES = 128

/** The default parameters a fresh tag claim carries (D13). */
const val TAG_DEFAULT_RELEVANCE = 0.1

const val TAG_DEFAULT_CONFIDENCE = 1.0

/**
 * The naming service's canonicalization (hashtag.md §1): trimmed, `#`
 * stripped, lowercased. What the reader sees previewed is what gets
 * staged.
 */
fun canonicalTagName(raw: String): String = raw.trim().removePrefix("#").lowercase()

/** Why a canonicalized name cannot be an identifier atom. */
enum class TagNameProblem {
    /** A name is one atom: whitespace cannot be part of it. */
    WHITESPACE,

    /** Over [MAX_TAG_NAME_BYTES] once encoded. */
    TOO_LONG,

    /** Something outside `[a-z0-9._-]` — the charset admits no encoding of it (D3). */
    ILLEGAL_CHARSET,
}

private val ATOM_CHARS = ('a'..'z') + ('0'..'9') + listOf('.', '_', '-')

/**
 * The problem with [raw] as a topic name, or null when it is a legal
 * atom. An empty name has no problem to report — there is nothing to
 * complain about yet — but it is not addable; [isAddableTagName] is the
 * gate a UI puts on its Add action.
 */
fun tagNameProblem(raw: String): TagNameProblem? {
    val name = canonicalTagName(raw)
    if (name.isEmpty()) return null
    if (name.any { it.isWhitespace() }) return TagNameProblem.WHITESPACE
    if (name.toByteArray(Charsets.UTF_8).size > MAX_TAG_NAME_BYTES) return TagNameProblem.TOO_LONG
    if (name.any { it !in ATOM_CHARS }) return TagNameProblem.ILLEGAL_CHARSET
    return null
}

/** Whether [raw] canonicalizes to a name this client will stage. */
fun isAddableTagName(raw: String): Boolean =
    canonicalTagName(raw).isNotEmpty() && tagNameProblem(raw) == null

/**
 * One tag a write will declare: the canonical name and the two
 * parameters the Tag act carries (api-spec.md `TagInput`). Both are
 * required on the wire and the server fills nothing in, so the defaults
 * here are the visible pre-fill an untouched slider sends as shown.
 */
data class TagClaim(
    val name: String,
    val relevance: Double = TAG_DEFAULT_RELEVANCE,
    val confidence: Double = TAG_DEFAULT_CONFIDENCE,
)

/**
 * What the tag picker reads a typed name as (TagPicker, TagPickerTyping,
 * TagPickerRefused; copy-voice *Tagging*): nothing yet, a legal name — the
 * list's first row, canonicalized — or a refusal standing in the rule line's
 * place. web's twin is `web/src/lib/topics/picker.ts` `readTagName`.
 */
sealed interface TagNameReading {
    /** An empty field (or a bare `#`): the rule line stands, nothing is offered yet. */
    data object Empty : TagNameReading

    /** A legal atom: [canonical] is the first row's name. */
    data class Legal(val canonical: String) : TagNameReading

    /** Outside the atom: the refusal's [reason], and no first row. */
    data class Refused(val reason: TagNameRefusal) : TagNameReading
}

/** The two refusals the picker's field says (TagPickerRefused.md). */
enum class TagNameRefusal {
    /** A character no name may carry, whitespace included — it leads, whatever the length. */
    CHARSET,

    /** Past the atom's [MAX_TAG_NAME_BYTES]. */
    LENGTH,
}

/** The typed name, as the picker draws it. */
fun readTagName(raw: String): TagNameReading {
    if (canonicalTagName(raw).isEmpty()) return TagNameReading.Empty
    return when (tagNameProblem(raw)) {
        null -> TagNameReading.Legal(canonicalTagName(raw))
        TagNameProblem.TOO_LONG ->
            // The charset refusal leads (TagPickerRefused.jsx: a space is the
            // refusal a reader reaches by habit), so a long name that also
            // carries an illegal character reads the charset one.
            if (canonicalTagName(raw).all { it in ATOM_CHARS }) {
                TagNameReading.Refused(TagNameRefusal.LENGTH)
            } else {
                TagNameReading.Refused(TagNameRefusal.CHARSET)
            }
        TagNameProblem.WHITESPACE, TagNameProblem.ILLEGAL_CHARSET -> TagNameReading.Refused(TagNameRefusal.CHARSET)
    }
}
