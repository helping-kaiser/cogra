// THE FOUR KINDS, AS THE FEED DRAWS THEM (FeedKinds.md; FeedCommentShapes,
// FeedProfileShapes, FeedTagShapes): each hydrated row as its kind's own live
// feed card reads it — a post as the feed card's [PostView], a comment as the
// thread's [CommentView] plus what its head row names, a person as the
// profile's [ProfileView], a topic as the tag card's [TagCardTopic]. The same
// selections History's cards read, so one card renders the same thing on both.

package com.cogra.domain.feed

import com.cogra.domain.CommentView
import com.cogra.domain.PostView
import com.cogra.domain.ProfileView
import com.cogra.domain.history.TagCardTopic
import com.cogra.domain.saved.CommentTarget

sealed interface FeedCard {
    val id: String

    /**
     * Whom the thing is by — a post's or a comment's author — for the hidden
     * set. A person and a topic are by no one.
     */
    val authorId: String?

    data class Post(val post: PostView) : FeedCard {
        override val id: String get() = post.id
        override val authorId: String? get() = post.author?.id
    }

    data class Comment(
        val comment: CommentView,
        /** What the comment answers — its head row; null when nothing resolves. */
        val target: CommentTarget?,
        /** The thread's root post: where the card's doors land. */
        val threadPostId: String?,
    ) : FeedCard {
        override val id: String get() = comment.id
        override val authorId: String? get() = comment.author?.id
    }

    data class Person(val profile: ProfileView) : FeedCard {
        override val id: String get() = profile.id
        override val authorId: String? get() = null
    }

    data class Tag(val topic: TagCardTopic) : FeedCard {
        override val id: String get() = topic.id
        override val authorId: String? get() = null
    }
}
