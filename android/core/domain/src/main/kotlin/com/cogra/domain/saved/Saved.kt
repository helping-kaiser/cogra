// The Saved list's client side (api-spec.md `User.bookmarks`, `setBookmark`,
// `removeBookmark`; saved-surface packet): the reader's private keep of
// posts, comments and people. L2 viewer state — never a graph record and
// never a signed act. web's twin is `web/src/lib/api/saved-api.ts`.

package com.cogra.domain.saved

import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.Outcome
import java.time.Instant

/** The Saved list over the contract. */
interface SavedRepository {
    /**
     * Keeps [node] — now, or at [at], an Undo restoring a removed row's own
     * time. Succeeds with when it is kept; keeping a kept node changes nothing.
     */
    suspend fun setBookmark(node: String, at: Instant?): Outcome<Instant>

    /** Drops [node]; dropping one not kept is a success. */
    suspend fun removeBookmark(node: String): Outcome<Unit>

    /**
     * The page of the reader's own Saved list after [after], newest first by
     * save time. Success(null) when there is no signed-in reader.
     */
    suspend fun savedPage(after: String?): Outcome<SavedPage?>
}

/** One page of the Saved list. */
data class SavedPage(
    val entries: List<SavedEntry>,
    val endCursor: String?,
    val hasNextPage: Boolean,
)

/** One kept thing, and when the reader kept it — the list's order and the row's age. */
data class SavedEntry(val node: SavedNode, val bookmarkedAt: Instant) {
    val id: String get() = node.id
}

/** What a Saved row draws from. */
sealed interface SavedNode {
    val id: String

    data class Post(
        override val id: String,
        val title: ModeratedField,
        val description: ModeratedField,
        val content: ModeratedField,
        /** The gallery's media types, in order: what names an untitled media post. */
        val mimeTypes: List<String>,
        val moderation: ModerationState,
        val sensitiveReason: String?,
        val authorHandle: String?,
    ) : SavedNode

    data class Comment(
        override val id: String,
        val content: ModeratedField,
        val mimeTypes: List<String>,
        val moderation: ModerationState,
        val sensitiveReason: String?,
        val authorHandle: String?,
        /** The post the comment's thread hangs under (`Comment.post`); null when none resolves. */
        val post: ThreadPost?,
    ) : SavedNode

    data class Person(
        override val id: String,
        val handle: String,
        val displayName: ModeratedField,
        val bio: ModeratedField,
        val avatarUrl: String?,
    ) : SavedNode
}

/** A comment's thread post, as much of it as names it. */
data class ThreadPost(
    val id: String,
    val title: ModeratedField,
    val content: ModeratedField,
    val mimeTypes: List<String>,
    val authorHandle: String?,
)
