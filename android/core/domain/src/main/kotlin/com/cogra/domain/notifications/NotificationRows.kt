// WHAT A NOTIFICATION ROW SAYS AND WHERE IT LANDS (Notifications.md;
// copy-voice; packet notifications-list §6.2-§6.3). A pure reading of one row
// into the row's slots and a destination — web's twin is
// `web/src/lib/notifications/row-content.ts`, rule for rule.
//
// - THE SENTENCE, one per kind, the actor's handle its subject. A deleted
//   actor reads `A deleted account …` and wears the reserved disc (design
//   digest items 18, 56a).
// - THE SECOND LINE: a comment's or a reply's words; `in <title>` for a
//   mention or a citation; nothing else.
// - THE DISC: the opinion row wears the opinion's face; the approvable row the
//   applicant's monogram, never a picture; every other row the actor's
//   picture, else their monogram.
// - THE TAP: a comment row lands on its comment in the thread (Saved's comment
//   landing); a mention or citation opens the post that carries it; a person
//   row opens that person's profile; the application rows open Invites and
//   the reader's own feed.
//
// THE NT-G3 / NT-G4 BRANCHES ship the packet's recommended defaults and are
// marked where they apply (packet §17): they are design's to confirm.

package com.cogra.domain.notifications

import com.cogra.domain.saved.REMOVED_BY_AUTHOR
import com.cogra.domain.saved.SavedNode
import com.cogra.domain.saved.mediaStandIn
import com.cogra.domain.saved.oneLine
import com.cogra.domain.saved.postTitle
import com.cogra.domain.saved.redacted
import com.cogra.domain.saved.sensitiveReason
import com.cogra.domain.saved.text

/** NotificationsEmpty.md:3, verbatim. */
const val NOTIFICATIONS_EMPTY =
    "Nothing here yet. Comments, replies, citations, mentions and opinions on you arrive here as they " +
        "happen, along with what becomes of your invites and your own application."

/** The prose name a deleted actor takes inside a sentence (design digest item 18). */
const val DELETED_ACTOR_PROSE = "A deleted account"

/** The roots a bell stands on, each with the back arrow's words (Notifications.md:49). */
enum class BellRoot(val backLabel: String) {
    FEED("Back to feed"),
    EXPLORE("Back to Explore"),
    WALLET("Back to Wallet"),
    PROFILE("Back to your profile"),
}

/** What fills a row's disc, by the board's precedence for each kind. */
sealed interface NotificationDisc {
    data class Picture(val url: String, val name: String) : NotificationDisc

    data class Monogram(val name: String) : NotificationDisc

    data class Face(val directed: Double, val interest: Double) : NotificationDisc

    data object Redacted : NotificationDisc
}

/** Where a row's tap lands. */
sealed interface NotificationTarget {
    data class Post(val postId: String) : NotificationTarget

    /** The thread opens over [postId], landed on [commentId]. */
    data class Comment(val postId: String, val commentId: String) : NotificationTarget

    data class Person(val handle: String) : NotificationTarget

    /** Invites, as the application now stands, with no notice that it moved on. */
    data object Invites : NotificationTarget

    /** The reader's own feed (NT-G4 recommendation (a)). */
    data object OwnFeed : NotificationTarget
}

data class NotificationRowContent(
    val title: String,
    val second: String?,
    val disc: NotificationDisc,
    /** The actor's handle is gone and the sentence names a deleted account. */
    val deleted: Boolean,
    /** Null when nothing resolves to land on. */
    val target: NotificationTarget?,
)

fun notificationRow(row: Notification): NotificationRowContent {
    val deleted = row.actor.displayName.redacted()
    val subject = if (deleted) DELETED_ACTOR_PROSE else "@${row.actor.handle}"
    val name = row.actor.displayName.text().ifEmpty { row.actor.handle }
    return NotificationRowContent(
        title = "$subject ${predicate(row)}",
        second = secondLine(row),
        disc = discOf(row, deleted, name),
        deleted = deleted,
        target = destination(row),
    )
}

/** The sentence's tail per kind (Notifications.md:11). */
private fun predicate(row: Notification): String = when (row.kind) {
    NotificationKind.COMMENT -> "commented on your post"
    NotificationKind.REPLY -> "replied to your comment"
    NotificationKind.PROFILE_OPINION -> "gave an opinion on you"
    NotificationKind.MENTION -> "mentioned you"
    // NT-G3(b): a citation of the reader's comment reads `cited your comment`.
    NotificationKind.CITATION ->
        if (row.context is NotificationContext.Comment) "cited your comment" else "cited your post"
    NotificationKind.APPLICATION_APPROVABLE -> "is ready for your approval"
    NotificationKind.INVITE_LANDED -> "landed through your invite"
    NotificationKind.APPLICATION_APPROVED -> "approved your application"
    NotificationKind.APPLICATION_REJECTED -> "closed your application"
    NotificationKind.UNKNOWN -> "did something"
}

private fun contentOf(row: Notification): SavedNode? = (row.subject as? NotificationSubject.Content)?.node

private fun secondLine(row: Notification): String? = when (row.kind) {
    NotificationKind.COMMENT, NotificationKind.REPLY -> (contentOf(row) as? SavedNode.Comment)?.let { comment ->
        // NT-G3(e) removed, (d) sensitive gives way to its reason, (c) wordless: none.
        if (comment.content.redacted()) {
            REMOVED_BY_AUTHOR
        } else {
            sensitiveReason(comment.moderation, comment.sensitiveReason)
                ?: oneLine(comment.content.text()).takeIf { it.isNotEmpty() }
        }
    }
    NotificationKind.MENTION, NotificationKind.CITATION -> when (val node = contentOf(row)) {
        is SavedNode.Post ->
            if (node.title.redacted() || node.content.redacted()) {
                REMOVED_BY_AUTHOR
            } else {
                "in ${postTitle(node.title, node.content, node.mimeTypes, node.authorHandle)}"
            }
        is SavedNode.Comment -> when {
            node.content.redacted() -> REMOVED_BY_AUTHOR
            // NT-G3(a): a comment carrying it reads its thread's post.
            node.post != null -> "in ${postTitle(node.post.title, node.post.content, node.post.mimeTypes, node.post.authorHandle)}"
            else -> "in " + oneLine(node.content.text()).ifEmpty { mediaStandIn(node.mimeTypes, node.authorHandle) }
        }
        else -> null
    }
    else -> null
}

private fun destination(row: Notification): NotificationTarget? = when (row.kind) {
    NotificationKind.COMMENT, NotificationKind.REPLY -> when (val node = contentOf(row)) {
        is SavedNode.Comment -> commentTarget(node)
        // A comment that no longer resolves: the reader's own post, which carries the thread.
        else -> (row.context as? NotificationContext.Post)?.let { NotificationTarget.Post(it.id) }
    }
    NotificationKind.MENTION, NotificationKind.CITATION -> when (val node = contentOf(row)) {
        is SavedNode.Post -> NotificationTarget.Post(node.id)
        // NT-G3(a): the citing comment, in its thread.
        is SavedNode.Comment -> commentTarget(node)
        else -> null
    }
    NotificationKind.PROFILE_OPINION,
    NotificationKind.INVITE_LANDED,
    NotificationKind.APPLICATION_APPROVED,
    -> NotificationTarget.Person(row.actor.handle)
    // Invites has no per-application focus yet: it opens on the reader's queue.
    NotificationKind.APPLICATION_APPROVABLE -> NotificationTarget.Invites
    // NT-G4 (a): the reader's own feed as it now stands, with no notice.
    NotificationKind.APPLICATION_REJECTED -> NotificationTarget.OwnFeed
    NotificationKind.UNKNOWN -> null
}

private fun commentTarget(node: SavedNode.Comment): NotificationTarget =
    node.post?.let { NotificationTarget.Comment(it.id, node.id) } ?: NotificationTarget.Post(node.id)

private fun discOf(row: Notification, deleted: Boolean, name: String): NotificationDisc {
    if (deleted) return NotificationDisc.Redacted
    if (row.kind == NotificationKind.PROFILE_OPINION && row.pair != null) {
        return NotificationDisc.Face(row.pair.directed, row.pair.interest)
    }
    // The applicant has no Profile to carry a picture until the approval lands.
    if (row.kind == NotificationKind.APPLICATION_APPROVABLE) return NotificationDisc.Monogram(row.actor.handle)
    return row.actor.avatarUrl?.let { NotificationDisc.Picture(it, name) } ?: NotificationDisc.Monogram(name)
}
