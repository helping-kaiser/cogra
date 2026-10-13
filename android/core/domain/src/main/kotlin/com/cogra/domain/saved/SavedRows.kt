// WHAT A SAVED ROW SAYS (Saved.md; design digest items 49 and 50; B11 for the
// untitled post's stand-in). A pure reading of one kept node into the row's
// slots — web's twin is `web/src/lib/saved/row-content.ts`, rule for rule.
//
// - A post: its kind's glyph, the title (else B11's stand-in), the author's
//   handle as the aside, and one second line — a titled words post's words, a
//   titled media post's description, an untitled words post's remaining words,
//   an untitled media post nothing.
// - A comment: the glyph, its first line as the title (a wordless comment
//   takes the media stand-in), the handle, and `on <thread's post>`.
// - A person: their picture, else their monogram; the display name (else the
//   handle, with no aside); the bio, or nothing.
// - The aside drops wherever the title already names the handle.
// - What changed stays and reads through its own status: a removed or
//   redacted post or comment reads `Removed by its author` in the system's
//   voice, a deleted account the reserved disc and `Deleted account`, and a
//   sensitive thing keeps its title while the second line gives way to the
//   reason.

package com.cogra.domain.saved

import com.cogra.domain.ModeratedField

/** The words a removed post's or comment's row carries, in the system's voice. */
const val REMOVED_BY_AUTHOR = "Removed by its author"

/** The words a deleted account's row carries (`ActorChip.jsx` REDACTED_ACTOR_NAME). */
const val DELETED_ACCOUNT = "Deleted account"

/** What fills a row's disc, by the master's precedence. */
sealed interface SavedDisc {
    /** The kind's glyph — a post's or a comment's. */
    data class Glyph(val comment: Boolean) : SavedDisc

    data class Picture(val url: String, val name: String) : SavedDisc

    data class Monogram(val name: String) : SavedDisc

    /** A deleted account's reserved disc: its space kept, filled with nothing. */
    data object Redacted : SavedDisc
}

/** Where a row opens. */
sealed interface SavedTarget {
    data class Post(val postId: String) : SavedTarget

    /** The thread opens over [postId], landed on [commentId]. */
    data class Comment(val postId: String, val commentId: String) : SavedTarget

    data class Person(val handle: String) : SavedTarget
}

data class SavedRowContent(
    val title: String,
    /** The title in the system's voice, quiet. */
    val titleQuiet: Boolean,
    val aside: String?,
    val second: String?,
    val disc: SavedDisc,
    /** The key `saved.list.entry` wears: the title's slug, or the id where no title is the thing's own. */
    val key: String,
    val target: SavedTarget,
    /** What the row's Unsave names (`Unsave <title>`). */
    val name: String,
)

/**
 * B11 (2): a media post (or a wordless comment) is named by what it holds and
 * who made it — `A video by @ada` when it holds a clip, `Pictures by @ada`
 * otherwise.
 */
fun mediaStandIn(mimeTypes: List<String>, handle: String?): String {
    val by = if (handle == null) "" else " by @$handle"
    return if (mimeTypes.any { it.startsWith("video/") }) "A video$by" else "Pictures$by"
}

/** The saved-list key (seam 066): lowercased, each run of other characters one `-`. */
fun slug(title: String): String =
    title.lowercase().replace(Regex("[^\\p{L}\\p{N}]+"), "-").trim('-')

/** A post's title, or B11's stand-in for an untitled one. */
fun postTitle(title: ModeratedField, content: ModeratedField, mimeTypes: List<String>, handle: String?): String {
    val named = title.text()
    if (named.isNotEmpty()) return named
    val words = content.text()
    if (words.isNotEmpty()) return firstLine(words).first
    return mediaStandIn(mimeTypes, handle)
}

private fun removed(id: String, target: SavedTarget, comment: Boolean) = SavedRowContent(
    title = REMOVED_BY_AUTHOR,
    titleQuiet = true,
    aside = null,
    second = null,
    disc = SavedDisc.Glyph(comment),
    key = id,
    target = target,
    name = REMOVED_BY_AUTHOR,
)

fun savedRow(node: SavedNode): SavedRowContent = when (node) {
    is SavedNode.Post -> postRow(node)
    is SavedNode.Comment -> commentRow(node)
    is SavedNode.Person -> personRow(node)
}

private fun postRow(node: SavedNode.Post): SavedRowContent {
    val target = SavedTarget.Post(node.id)
    if (node.title.redacted() || node.content.redacted()) return removed(node.id, target, comment = false)
    val media = node.mimeTypes.isNotEmpty()
    val titled = node.title.text().isNotEmpty()
    val title = postTitle(node.title, node.content, node.mimeTypes, node.authorHandle)
    val second = when {
        titled && media -> oneLine(node.description.text())
        titled -> oneLine(node.content.text())
        !media -> oneLine(firstLine(node.content.text()).second)
        else -> ""
    }
    return SavedRowContent(
        title = title,
        titleQuiet = false,
        aside = aside(title, node.authorHandle),
        second = sensitiveReason(node.moderation, node.sensitiveReason) ?: second.takeIf { it.isNotEmpty() },
        disc = SavedDisc.Glyph(comment = false),
        key = slug(title),
        target = target,
        name = title,
    )
}

private fun commentRow(node: SavedNode.Comment): SavedRowContent {
    val target = node.post?.let { SavedTarget.Comment(it.id, node.id) } ?: SavedTarget.Post(node.id)
    if (node.content.redacted()) return removed(node.id, target, comment = true)
    val words = node.content.text()
    val title = if (words.isNotEmpty()) firstLine(words).first else mediaStandIn(node.mimeTypes, node.authorHandle)
    val on = node.post?.let { "on ${postTitle(it.title, it.content, it.mimeTypes, it.authorHandle)}" }
    return SavedRowContent(
        title = title,
        titleQuiet = false,
        aside = aside(title, node.authorHandle),
        second = sensitiveReason(node.moderation, node.sensitiveReason) ?: on,
        disc = SavedDisc.Glyph(comment = true),
        key = slug(title),
        target = target,
        name = title,
    )
}

private fun personRow(node: SavedNode.Person): SavedRowContent {
    val target = SavedTarget.Person(node.handle)
    if (node.displayName.redacted()) {
        return SavedRowContent(
            title = DELETED_ACCOUNT,
            titleQuiet = true,
            aside = null,
            second = null,
            disc = SavedDisc.Redacted,
            key = node.id,
            target = target,
            name = DELETED_ACCOUNT,
        )
    }
    val name = node.displayName.text()
    val title = name.ifEmpty { "@${node.handle}" }
    return SavedRowContent(
        title = title,
        titleQuiet = false,
        aside = if (name.isNotEmpty()) "@${node.handle}" else null,
        second = oneLine(node.bio.text()).takeIf { it.isNotEmpty() },
        disc = node.avatarUrl?.let { SavedDisc.Picture(it, title) } ?: SavedDisc.Monogram(title),
        key = slug(name.ifEmpty { node.handle }),
        target = target,
        name = title,
    )
}
