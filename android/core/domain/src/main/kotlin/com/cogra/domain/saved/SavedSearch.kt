// SAVED'S SEARCH — the one search rule, over the reader's own saved list
// (Saved.md, SavedNone.md; design/readme.md §4 *Search*). web's twin is
// `web/src/lib/saved/saved-search.ts`, clause for clause.
//
// WHY IT RUNS HERE. The rule is the server's (`crates/api/src/search.rs`, the
// one matcher), but Saved ships with the bookmarks contract untouched (jakob,
// round 12), and `User.bookmarks` takes no query. So the client holds the
// whole saved set and narrows it by the same rule:
//
// - the query is trimmed; a blank one narrows nothing;
// - only a LEADING `@name` or `#name` is a scope, its name running to the
//   first whitespace;
// - unscoped text matches a person's handle or display name as a
//   case-insensitive substring, and a post's TITLE by word — every word
//   required, the last one as a prefix. A comment has no title and is never
//   matched unscoped; an untitled post's stand-in is never matched, and
//   neither is any body, description or bio;
// - `@name text` searches that person's own things: their posts by title and
//   their comments through their thread's root post's title — never the
//   person's own card;
// - `#name text` searches the things that carry the tag, the same way;
// - a BARE scope is a lookup in progress and lists no one's contents: `@x`
//   narrows to the people whose handle starts with `x`, and `#x` to nothing,
//   because a tag is never saved.

package com.cogra.domain.saved

import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.TopicClaimView

/** A query, parsed the way the server's matcher parses it. */
sealed interface SavedQuery {
    data object Blank : SavedQuery

    data class Unscoped(val text: String) : SavedQuery

    /** A leading `@name` or `#name`; [remainder] is null for a bare scope. */
    data class Scoped(val tag: Boolean, val name: String, val remainder: String?) : SavedQuery
}

/** What one saved thing offers the matcher — its names and titles, never its words. */
sealed interface Searchable {
    data class Post(val authorHandle: String?, val title: String?, val tags: List<String>) : Searchable

    data class Comment(val authorHandle: String?, val rootTitle: String?, val tags: List<String>) : Searchable

    data class Person(val handle: String?, val displayName: String?) : Searchable
}

fun parseSavedQuery(raw: String): SavedQuery {
    val query = raw.trim()
    if (query.isEmpty()) return SavedQuery.Blank
    val sigil = query.first()
    if (sigil != '@' && sigil != '#') return SavedQuery.Unscoped(query)
    val rest = query.substring(1)
    val split = rest.indexOfFirst { it.isWhitespace() }
    val name = if (split < 0) rest else rest.substring(0, split)
    val remainder = if (split < 0) null else rest.substring(split).trim().ifEmpty { null }
    return SavedQuery.Scoped(tag = sigil == '#', name = name, remainder = remainder)
}

private val WORD = Regex("[\\p{L}\\p{N}]+")

/** A title's words: maximal runs of letters and digits, lowercased. */
fun titleWords(text: String): List<String> = WORD.findAll(text.lowercase()).map { it.value }.toList()

/**
 * Whether [title] answers [query] by word: every word of the query stands in
 * the title, the last one as the prefix of a title word. A query with no word
 * in it matches no title.
 */
fun titleMatches(title: String?, query: String): Boolean {
    if (title == null) return false
    val asked = titleWords(query)
    if (asked.isEmpty()) return false
    val held = titleWords(title)
    val last = asked.last()
    return asked.dropLast(1).all { it in held } && held.any { it.startsWith(last) }
}

private fun String?.containsFolded(text: String): Boolean = this != null && lowercase().contains(text.lowercase())

/** The canonical name a `#` scope names (the tag atom), or null for a name no tag carries. */
private fun canonicalTag(name: String): String? {
    val canonical = name.lowercase()
    return canonical.takeIf { it.isNotEmpty() && it.length <= TAG_NAME_MAX && TAG_ATOM.matches(it) }
}

private val TAG_ATOM = Regex("[a-z0-9._-]+")
private const val TAG_NAME_MAX = 128

/** Whether [item] stands in Saved narrowed by [query]. */
fun matches(item: Searchable, query: SavedQuery): Boolean = when (query) {
    SavedQuery.Blank -> true
    is SavedQuery.Unscoped -> when (item) {
        is Searchable.Person -> item.handle.containsFolded(query.text) || item.displayName.containsFolded(query.text)
        is Searchable.Post -> titleMatches(item.title, query.text)
        is Searchable.Comment -> false
    }
    is SavedQuery.Scoped -> scopedMatch(item, query)
}

private fun scopedMatch(item: Searchable, query: SavedQuery.Scoped): Boolean {
    val name = query.name.lowercase()
    val remainder = query.remainder
    if (remainder == null) {
        // A LOOKUP IN PROGRESS: `@x` proposes people, `#x` proposes tags, and
        // neither lists anyone's contents. A tag is never saved.
        return !query.tag && name.isNotEmpty() && item is Searchable.Person &&
            item.handle?.lowercase()?.startsWith(name) == true
    }
    val (author, tags, title) = when (item) {
        is Searchable.Person -> return false
        is Searchable.Post -> Triple(item.authorHandle, item.tags, item.title)
        is Searchable.Comment -> Triple(item.authorHandle, item.tags, item.rootTitle)
    }
    val inScope = if (query.tag) {
        val tag = canonicalTag(query.name)
        tag != null && tags.any { it.lowercase() == tag }
    } else {
        author?.lowercase() == name
    }
    return inScope && titleMatches(title, remainder)
}

private fun ModeratedField?.shown(): String? =
    this?.takeIf { it.status != FieldStatus.REDACTED }?.value?.trim()?.takeIf { it.isNotEmpty() }

private fun List<TopicClaimView>.carried(): List<String> =
    filter { it.relevance != 0.0 }.mapNotNull { it.hashtag.name.shown() }

/** What a kept card offers the matcher — a payload that went offers nothing. */
fun SavedCard.searchable(): Searchable = when (this) {
    is SavedCard.Post -> Searchable.Post(post.author?.handle, post.title.shown(), post.topics.carried())
    is SavedCard.Comment -> Searchable.Comment(
        authorHandle = comment.author?.handle,
        rootTitle = threadPostTitle.shown(),
        tags = comment.topics.carried(),
    )
    is SavedCard.Person -> Searchable.Person(
        handle = profile.handle.takeUnless { profile.deleted },
        displayName = profile.displayName.shown(),
    )
}
