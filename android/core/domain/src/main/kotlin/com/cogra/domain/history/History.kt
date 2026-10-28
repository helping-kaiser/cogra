// HISTORY, THE SCREEN'S READ (api-spec.md `User.viewHistory`; History.md,
// HistoryFilter.md, HistorySearch.md): the reader's seen-list as a feed —
// every seen thing as its kind's own feed card, newest first by first seeing.
// L2 viewer state, never a graph record. web's twin is
// `web/src/lib/api/history-api.ts`.

package com.cogra.domain.history

import com.cogra.domain.CommentView
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.ProfileView
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.REMOVED_BY_AUTHOR
import com.cogra.domain.saved.firstLine
import com.cogra.domain.saved.postTitle
import com.cogra.domain.saved.redacted
import com.cogra.domain.saved.text
import java.time.Instant

/** History's own read over the contract. */
interface HistoryRepository {
    /**
     * The page of the reader's own History after [after], newest first by
     * first seeing. Success(null) when there is no signed-in reader.
     *
     * [kinds] narrows to the staged kinds; empty narrows nothing — every kind
     * History serves (HistoryFilter.md:9). A non-null [query] narrows by the
     * one search law over the seen set alone, on the server, and the narrowed
     * list stands in sections — people, then topics, then content — paged on
     * cursors of its own: [after] must come from a page read with the same
     * [query] and [kinds].
     */
    suspend fun historyPage(query: String?, kinds: Set<FeedKind>, after: String?): Outcome<HistoryPage?>
}

/** One page of History. */
data class HistoryPage(
    val entries: List<HistoryEntry>,
    val endCursor: String?,
    val hasNextPage: Boolean,
    /** More people match than the people section serves: `See all profiles` (HistorySearch.md:7). */
    val hasMorePeople: Boolean = false,
    /** More topics match than the tags section serves: `See all tags` (HistorySearch.md:15). */
    val hasMoreTags: Boolean = false,
)

/** One seen thing, and when the reader first saw it — the list's order, never a card's age (History.md:31). */
data class HistoryEntry(val card: HistoryCard, val firstSeenAt: Instant) {
    val id: String get() = card.id
}

/**
 * HISTORY IS A FEED (History.md:19-21): each seen thing as its kind's own
 * live feed card reads it — a post as the feed card's [PostView], a comment
 * as the thread's [CommentView] plus what its head row names, a person as the
 * profile's [ProfileView], a topic as the tag card's [TagCardTopic].
 */
sealed interface HistoryCard {
    val id: String

    /**
     * Whom the thing is by — a post's or a comment's author — for the hidden
     * set. A person and a topic are by no one: a hidden account's own profile
     * card stays (History.md:41).
     */
    val authorId: String?

    data class Post(val post: PostView) : HistoryCard {
        override val id: String get() = post.id
        override val authorId: String? get() = post.author?.id
    }

    data class Comment(
        val comment: CommentView,
        /** What the comment answers — its head row; null when nothing resolves. */
        val target: CommentTarget?,
        /** The thread's root post: where the card's doors land. */
        val threadPostId: String?,
    ) : HistoryCard {
        override val id: String get() = comment.id
        override val authorId: String? get() = comment.author?.id
    }

    data class Person(val profile: ProfileView) : HistoryCard {
        override val id: String get() = profile.id
        override val authorId: String? get() = null
    }

    data class Tag(val topic: TagCardTopic) : HistoryCard {
        override val id: String get() = topic.id
        override val authorId: String? get() = null
    }
}

/** A topic as the tag feed card draws it: its name and a glimpse of the newest things carrying it. */
data class TagCardTopic(
    val id: String,
    /** The canonical name, without `#`. */
    val name: ModeratedField,
    /** The newest things carrying it, newest first — at most [TAG_GLIMPSE_LIMIT]. */
    val tagged: List<TaggedGlimpse>,
)

/** How many tagged things the tag card's glimpse reads — the board's three marks. */
const val TAG_GLIMPSE_LIMIT = 3

/** One thing a topic carries, as the tag card's glimpse names it. */
data class TaggedGlimpse(
    val id: String,
    /** A comment's mark is the comment glyph; a post's its cover or `T`. */
    val comment: Boolean,
    /** The glimpse's name: a post's title (B11's stand-in for an untitled one), a comment's first line. */
    val title: String,
    /** The cover, or a clip's still; null with none to show. */
    val coverUrl: String?,
    /** Its payload went: the tile keeps its space empty and the name reads the removal line. */
    val removed: Boolean,
    val authorHandle: String?,
    val createdAt: Instant,
)

/**
 * A tagged post as the glimpse names it (`tag-feed-card.tsx` `glimpsed`): its
 * title, B11's stand-in for an untitled one; a removed one by the removal
 * line, its tile emptied.
 */
fun taggedPost(
    id: String,
    title: ModeratedField,
    content: ModeratedField,
    mimeTypes: List<String>,
    coverUrl: String?,
    authorHandle: String?,
    createdAt: Instant,
): TaggedGlimpse {
    val removed = title.redacted() || content.redacted()
    return TaggedGlimpse(
        id = id,
        comment = false,
        title = if (removed) REMOVED_BY_AUTHOR else postTitle(title, content, mimeTypes, authorHandle),
        coverUrl = coverUrl.takeUnless { removed },
        removed = removed,
        authorHandle = authorHandle,
        createdAt = createdAt,
    )
}

/** A tagged comment as the glimpse names it: its first line, or the removal line. */
fun taggedComment(id: String, content: ModeratedField, authorHandle: String?, createdAt: Instant): TaggedGlimpse {
    val removed = content.redacted()
    return TaggedGlimpse(
        id = id,
        comment = true,
        title = if (removed) REMOVED_BY_AUTHOR else firstLine(content.text()).first,
        coverUrl = null,
        removed = removed,
        authorHandle = authorHandle,
        createdAt = createdAt,
    )
}
