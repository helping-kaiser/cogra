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
 * parameters the Tag act carries (api-spec.md `TagInput`). The client
 * always sends both — the defaults it starts from are the server's own,
 * so an explicit value never changes what an untouched slider means.
 */
data class TagClaim(
    val name: String,
    val relevance: Double = TAG_DEFAULT_RELEVANCE,
    val confidence: Double = TAG_DEFAULT_CONFIDENCE,
)
