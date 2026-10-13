// The Saved list over the real contract (api-spec.md `User.bookmarks`,
// `setBookmark`, `removeBookmark`). Authenticated-only and never
// member-gated: an applicant keeps things like a member.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.saved.SavedEntry
import com.cogra.domain.saved.SavedNode
import com.cogra.domain.saved.SavedPage
import com.cogra.domain.saved.SavedRepository
import com.cogra.domain.saved.ThreadPost
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

private fun SavedPageQuery.Node.toSaved(): SavedNode? {
    onPost?.let { post ->
        return SavedNode.Post(
            id = post.id,
            title = ModeratedField(post.title.value, post.title.status.toDomain()),
            description = ModeratedField(post.description.value, post.description.status.toDomain()),
            content = ModeratedField(post.content.value, post.content.status.toDomain()),
            mimeTypes = post.attachments.map { it.mimeType },
            moderation = post.moderationStatus.toDomain(),
            sensitiveReason = post.sensitiveReason,
            authorHandle = post.author?.handle,
        )
    }
    onComment?.let { comment ->
        return SavedNode.Comment(
            id = comment.id,
            content = ModeratedField(comment.content.value, comment.content.status.toDomain()),
            mimeTypes = comment.attachments.map { it.mimeType },
            moderation = comment.moderationStatus.toDomain(),
            sensitiveReason = comment.sensitiveReason,
            authorHandle = comment.author?.handle,
            post = comment.post?.let { post ->
                ThreadPost(
                    id = post.id,
                    title = ModeratedField(post.title.value, post.title.status.toDomain()),
                    content = ModeratedField(post.content.value, post.content.status.toDomain()),
                    mimeTypes = post.attachments.map { it.mimeType },
                    authorHandle = post.author?.handle,
                )
            },
        )
    }
    onUser?.let { user ->
        return SavedNode.Person(
            id = user.id,
            handle = user.handle,
            displayName = ModeratedField(user.displayName.value, user.displayName.status.toDomain()),
            bio = ModeratedField(user.bio.value, user.bio.status.toDomain()),
            avatarUrl = user.avatar?.takeIf { it.status.rawValue != "REDACTED" }?.url,
        )
    }
    return null
}
