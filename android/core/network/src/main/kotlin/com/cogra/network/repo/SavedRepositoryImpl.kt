// The Saved list over the real contract (api-spec.md `User.bookmarks`,
// `setBookmark`, `removeBookmark`). Authenticated-only and never
// member-gated: an applicant keeps things like a member.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.saved.CommentTarget
import com.cogra.domain.saved.SavedCard
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedPage
import com.cogra.domain.saved.SavedRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.RemoveBookmarkMutation
import com.cogra.network.graphql.SavedPageQuery
import com.cogra.network.graphql.SetBookmarkMutation
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SavedRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : SavedRepository {

    override suspend fun setBookmark(node: String, at: Instant?): Outcome<Instant> = guard.run {
        client.mutation(SetBookmarkMutation(node = node, bookmarkedAt = Optional.present(at)))
            .payloadOutcome({ it.setBookmark.userErrors.map { e -> e.userErrorFields } }) {
                it.setBookmark.bookmark?.bookmarkedAt
            }
    }

    override suspend fun removeBookmark(node: String): Outcome<Unit> = guard.run {
        client.mutation(RemoveBookmarkMutation(node = node))
            .payloadOutcome({ it.removeBookmark.userErrors.map { e -> e.userErrorFields } }) {
                if (it.removeBookmark.ok == true) Unit else null
            }
    }

    override suspend fun savedPage(after: String?): Outcome<SavedPage?> = guard.run {
        client.query(SavedPageQuery(after = Optional.presentIfNotNull(after)))
            .fetch()
            .map { data ->
                val bookmarks = data.me?.bookmarks ?: return@map null
                SavedPage(
                    entries = bookmarks.edges.mapNotNull { edge ->
                        edge.node.toSaved()?.let { SavedEntry(it, edge.bookmarkedAt) }
                    },
                    endCursor = bookmarks.pageInfo.endCursor,
                    hasNextPage = bookmarks.pageInfo.hasNextPage,
                )
            }
    }
}

/** Each kept thing as its kind's own feed card reads it (Saved.md, round 12). */
private fun SavedPageQuery.Node.toSaved(): SavedCard? {
    onPost?.let { post ->
        return SavedCard.Post(post.postFields.toDomain().copy(commentCount = post.commentCount.totalCount))
    }
    onComment?.let { comment ->
        return SavedCard.Comment(
            comment = comment.commentFields.toDomain(),
            target = comment.target?.toTarget(),
            threadPostId = comment.post?.id,
            threadPostTitle = comment.post?.let { ModeratedField(it.title.value, it.title.status.toDomain()) },
        )
    }
    onUser?.let { user -> return SavedCard.Person(user.profileFields.toDomain()) }
    return null
}

private const val REDACTED = "REDACTED"

private fun SavedPageQuery.Target.toTarget(): CommentTarget? {
    onPost?.let { post ->
        val title = ModeratedField(post.title.value, post.title.status.toDomain())
        val content = ModeratedField(post.content.value, post.content.status.toDomain())
        val lead = post.attachments.firstOrNull()
        // The head row's mark: a picture's own frame, or a clip's still.
        val cover = when {
            lead == null -> null
            lead.mimeType.startsWith("video/") -> lead.coverMedia?.takeIf { it.status.rawValue != REDACTED }?.url
            else -> lead.url
        }
        return CommentTarget.Post(
            id = post.id,
            title = title,
            content = content,
            mimeTypes = post.attachments.map { it.mimeType },
            coverUrl = cover,
            authorHandle = post.author?.handle,
            moderation = post.moderationStatus.toDomain(),
            removed = title.status == FieldStatus.REDACTED ||
                content.status == FieldStatus.REDACTED ||
                post.attachments.any { it.status.rawValue == REDACTED },
        )
    }
    onComment?.let { comment ->
        return CommentTarget.Comment(
            id = comment.id,
            content = ModeratedField(comment.content.value, comment.content.status.toDomain()),
            authorHandle = comment.author?.handle,
        )
    }
    return null
}
