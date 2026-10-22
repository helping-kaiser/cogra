// The notification list over the real contract (api-spec.md
// `User.notifications`, `User.hasUnreadNotifications`,
// `markNotificationsSeen`, `markNotificationRead`). Authenticated-only and
// never member-gated: an applicant reads its list like a member.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.notifications.Notification
import com.cogra.domain.notifications.NotificationActor
import com.cogra.domain.notifications.NotificationContext
import com.cogra.domain.notifications.NotificationKind
import com.cogra.domain.notifications.NotificationPage
import com.cogra.domain.notifications.NotificationPair
import com.cogra.domain.notifications.NotificationSubject
import com.cogra.domain.notifications.NotificationsRepository
import com.cogra.domain.saved.SavedNode
import com.cogra.domain.saved.ThreadPost
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.MarkNotificationReadMutation
import com.cogra.network.graphql.MarkNotificationsSeenMutation
import com.cogra.network.graphql.NotificationBellQuery
import com.cogra.network.graphql.NotificationsQuery
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import com.cogra.network.graphql.type.NotificationKind as WireKind

@Singleton
class NotificationsRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : NotificationsRepository {

    override suspend fun page(after: String?): Outcome<NotificationPage?> = guard.run {
        client.query(NotificationsQuery(after = Optional.presentIfNotNull(after)))
            .fetch()
            .map { data ->
                val list = data.me?.notifications ?: return@map null
                NotificationPage(
                    notifications = list.edges.map { it.node.toDomain() },
                    endCursor = list.pageInfo.endCursor,
                    hasNextPage = list.pageInfo.hasNextPage,
                )
            }
    }

    override suspend fun hasUnread(): Outcome<Boolean?> = guard.run {
        client.query(NotificationBellQuery()).fetch().map { it.me?.hasUnreadNotifications }
    }

    override suspend fun markSeen(through: Instant): Outcome<Boolean> = guard.run {
        client.mutation(MarkNotificationsSeenMutation(through = through))
            .payloadOutcome({ it.markNotificationsSeen.userErrors.map { e -> e.userErrorFields } }) {
                it.markNotificationsSeen.hasUnreadNotifications
            }
    }

    override suspend fun markRead(id: String): Outcome<Instant> = guard.run {
        client.mutation(MarkNotificationReadMutation(notification = id))
            .payloadOutcome({ it.markNotificationRead.userErrors.map { e -> e.userErrorFields } }) {
                it.markNotificationRead.notification?.readAt
            }
    }
}

private fun WireKind.toDomain(): NotificationKind = when (this) {
    WireKind.COMMENT -> NotificationKind.COMMENT
    WireKind.REPLY -> NotificationKind.REPLY
    WireKind.MENTION -> NotificationKind.MENTION
    WireKind.CITATION -> NotificationKind.CITATION
    WireKind.PROFILE_OPINION -> NotificationKind.PROFILE_OPINION
    WireKind.PROFILE_OPINION_WITHDRAWN -> NotificationKind.PROFILE_OPINION_WITHDRAWN
    WireKind.APPLICATION_APPROVABLE -> NotificationKind.APPLICATION_APPROVABLE
    WireKind.INVITE_LANDED -> NotificationKind.INVITE_LANDED
    WireKind.APPLICATION_APPROVED -> NotificationKind.APPLICATION_APPROVED
    WireKind.APPLICATION_REJECTED -> NotificationKind.APPLICATION_REJECTED
    else -> NotificationKind.UNKNOWN
}

private fun NotificationsQuery.Node.toDomain(): Notification = Notification(
    id = id,
    kind = kind.toDomain(),
    createdAt = createdAt,
    readAt = readAt,
    actor = NotificationActor(
        id = actor.id,
        handle = actor.handle,
        displayName = ModeratedField(actor.displayName.value, actor.displayName.status.toDomain()),
        avatarUrl = actor.onUser?.avatar?.takeIf { it.status.rawValue != "REDACTED" }?.url,
    ),
    subject = subject?.toDomain(),
    context = context?.let { node ->
        node.onPost?.let { NotificationContext.Post(it.id) }
            ?: node.onComment?.let { NotificationContext.Comment(it.id) }
            ?: node.onUser?.let { NotificationContext.Person(it.id) }
    },
    pair = record?.let { NotificationPair(it.pDirected, it.pInterest, it.severed) },
    applicationId = application?.id,
)

private fun NotificationsQuery.Subject.toDomain(): NotificationSubject? {
    onPost?.let { post ->
        return NotificationSubject.Content(
            SavedNode.Post(
                id = post.id,
                title = ModeratedField(post.title.value, post.title.status.toDomain()),
                description = ModeratedField(post.description.value, post.description.status.toDomain()),
                content = ModeratedField(post.content.value, post.content.status.toDomain()),
                mimeTypes = post.attachments.map { it.mimeType },
                moderation = post.moderationStatus.toDomain(),
                sensitiveReason = post.sensitiveReason,
                authorHandle = post.author?.handle,
            ),
        )
    }
    onComment?.let { comment ->
        return NotificationSubject.Content(
            SavedNode.Comment(
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
            ),
        )
    }
    onUser?.let { user -> return NotificationSubject.Person(user.id, user.handle) }
    return null
}
