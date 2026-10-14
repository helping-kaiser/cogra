// HOW A ROW NAMES CONTENT THAT HAS NO TITLE OF ITS OWN (design digest items 49
// and 50; B11 for the untitled post's stand-in), and what the comment feed
// card's head row names (FeedCommentShapes.md; `_shared.jsx` `commentTarget`).
// First drawn for Saved's rows; Saved now stands as a feed of cards, and these
// names live on where a row or a head row still names a thing in one line —
// the notifications list and the comment card. web's twins are
// `web/src/lib/saved/row-content.ts` and `comment-feed-card.tsx`'s `headRowOf`.

package com.cogra.domain.saved

import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState

/** The words a removed post's or comment's row carries, in the system's voice. */
const val REMOVED_BY_AUTHOR = "Removed by its author"

/** A post removed by a passed proposal, in the reader's words (`RemovedPlaceholder`). */
const val REMOVED_BY_THE_PLATFORM = "Removed under the platform's rules"

/** The words a deleted account's row carries (`ActorChip.jsx` REDACTED_ACTOR_NAME). */
const val DELETED_ACCOUNT = "Deleted account"

/**
 * B11 (2): a media post (or a wordless comment) is named by what it holds and
 * who made it — `A video by @ada` when it holds a clip, `Pictures by @ada`
 * otherwise.
 */
fun mediaStandIn(mimeTypes: List<String>, handle: String?): String {
    val by = if (handle == null) "" else " by @$handle"
    return if (mimeTypes.any { it.startsWith("video/") }) "A video$by" else "Pictures$by"
}

/** A post's title, or B11's stand-in for an untitled one: its first line, else its media. */
fun postTitle(title: ModeratedField, content: ModeratedField, mimeTypes: List<String>, handle: String?): String {
    val named = title.text()
    if (named.isNotEmpty()) return named
    val words = content.text()
    if (words.isNotEmpty()) return firstLine(words).first
    return mediaStandIn(mimeTypes, handle)
}

/** What a comment card's head row draws: the answered thing's mark, title and sub-line. */
data class HeadRow(
    val comment: Boolean,
    val title: String,
    val sub: String,
    val coverUrl: String?,
    /** A removed target keeps its row; its tile keeps its space empty. */
    val removed: Boolean,
    /** The door's accessible name, after `On `. */
    val label: String,
)

/**
 * What the head row names, per target: a post by its title (an untitled one by
 * its first words, a wordless one by B11) over its author; a removed post by
 * its removal line over its author, its tile empty; a comment by its author
 * over its first words.
 */
fun headRowOf(target: CommentTarget): HeadRow = when (target) {
    is CommentTarget.Comment -> {
        val handle = target.authorHandle
        HeadRow(
            comment = true,
            title = handle?.let { "@$it" }.orEmpty(),
            sub = firstLine(target.content.text()).first,
            coverUrl = null,
            removed = false,
            label = handle?.let { "@$it's comment" } ?: "a comment",
        )
    }

    is CommentTarget.Post -> {
        val by = target.authorHandle?.let { "@$it" }.orEmpty()
        if (target.removed) {
            val byPlatform = target.moderation == ModerationState.ILLEGAL
            HeadRow(
                comment = false,
                title = if (byPlatform) REMOVED_BY_THE_PLATFORM else REMOVED_BY_AUTHOR,
                sub = by,
                coverUrl = null,
                removed = true,
                label = target.authorHandle?.let { "@$it's removed post" } ?: "a removed post",
            )
        } else {
            val title = postTitle(target.title, target.content, target.mimeTypes, target.authorHandle)
            HeadRow(
                comment = false,
                title = title,
                sub = by,
                coverUrl = target.coverUrl,
                removed = false,
                label = "“$title” — $by",
            )
        }
    }
}
