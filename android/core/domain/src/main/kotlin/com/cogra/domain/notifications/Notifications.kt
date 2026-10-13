// The notification list's client side (api-spec.md `User.notifications`,
// `User.hasUnreadNotifications`, `markNotificationsSeen`,
// `markNotificationRead`; notifications.md): acts other actors made that
// reached the reader's content, profile or application. L2 viewer state —
// never a graph record and never a signed act. web's twin is
// `web/src/lib/api/notifications-api.ts`.

package com.cogra.domain.notifications

import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.saved.SavedNode
import java.time.Instant

/** The list, the bell and the two read marks over the contract. */
interface NotificationsRepository {
    /** The page of the reader's list after [after], newest first. Success(null) with no signed-in reader. */
    suspend fun page(after: String?): Outcome<NotificationPage?>

    /** The bell's dot as the server reads it now. Success(null) with no signed-in reader. */
    suspend fun hasUnread(): Outcome<Boolean?>

    /** Moves the seen pointer to [through]; succeeds with whether anything is still unseen. */
    suspend fun markSeen(through: Instant): Outcome<Boolean>

    /** Marks one row read; succeeds with its read time. */
    suspend fun markRead(id: String): Outcome<Instant>
}

/** The nine addressed acts; UNKNOWN is a kind this build cannot name. */
enum class NotificationKind {
    COMMENT,
    REPLY,
    MENTION,
    CITATION,
    PROFILE_OPINION,
    APPLICATION_APPROVABLE,
    INVITE_LANDED,
    APPLICATION_APPROVED,
    APPLICATION_REJECTED,
    UNKNOWN,
}

/** One page of the list. */
data class NotificationPage(
    val notifications: List<Notification>,
    val endCursor: String?,
    val hasNextPage: Boolean,
)

/** Who acted. */
data class NotificationActor(
    val id: String,
    val handle: String,
    val displayName: ModeratedField,
    val avatarUrl: String?,
)

/** Where a row's tap lands, as the read serves it. */
sealed interface NotificationSubject {
    /** A post or a comment, in Saved's shape (`Comment.post` included). */
    data class Content(val node: SavedNode) : NotificationSubject

    data class Person(val id: String, val handle: String) : NotificationSubject
}

/** The reader's own node the act reached. */
sealed interface NotificationContext {
    data class Post(val id: String) : NotificationContext

    data class Comment(val id: String) : NotificationContext

    data class Person(val id: String) : NotificationContext
}

/** An opinion row's pair, read off its record. */
data class NotificationPair(val directed: Double, val interest: Double)

/** One row of the list. */
data class Notification(
    val id: String,
    val kind: NotificationKind,
    val createdAt: Instant,
    val readAt: Instant?,
    val actor: NotificationActor,
    val subject: NotificationSubject?,
    val context: NotificationContext?,
    val pair: NotificationPair?,
    val applicationId: String?,
)
