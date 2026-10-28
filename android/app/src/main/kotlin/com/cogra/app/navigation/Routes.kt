// The app's destinations: type-safe routes (Navigation 2.8+), one
// `@Serializable` type per screen, and the link paths the graph claims.

package com.cogra.app.navigation

import com.cogra.feature.content.CHATS_FROM_FEED
import kotlinx.serialization.Serializable

/**
 * The Feed tab's nested graph: the feed's root and every screen opened from
 * it, whatever that screen is about (design/readme.md §13 — "a stack is
 * where a screen was opened FROM").
 */
@Serializable
data object FeedTab

/** The Profile tab's nested graph: the reader's own profile and every screen opened from it. */
@Serializable
data object ProfileTab

/** The Explore tab's nested graph: Explore and every screen a search or its door opens. */
@Serializable
data object ExploreTab

/** The Wallet tab's nested graph: today its coming-soon door, and what its band opens. */
@Serializable
data object WalletTab

// The destinations (type-safe routes, Navigation 2.8+).
@Serializable
data class InviteEntry(val inviteId: String? = null)

@Serializable
data class Apply(val inviteId: String)

@Serializable
data object Login

@Serializable
data object PasswordReset

@Serializable
data object Restore

@Serializable
data object KeyCeremony

@Serializable
data object Feed

/** Explore — the bar's search slot (Explore.md); searching is a state of this root, never a route. */
@Serializable
data object Explore

/** The Wallet tab's root: the coming-soon door (WalletComingSoon.md). */
@Serializable
data object Wallet

/** Every topic the reader holds, behind Explore's door (YourTopics.md). */
@Serializable
data object YourTopics

/**
 * The composer. [postId] names an edit target; [referenceTargetId]
 * arrives from a node's Reference affordance and opens a fresh post
 * with that node already staged as a chip (D20).
 */
@Serializable
data class ComposePost(
    val postId: String? = null,
    val referenceTargetId: String? = null,
)

/**
 * A post's detail. [from] names where the reader came from, which the back
 * arrow reads (`saved` → `Back to Saved`); [commentId] lands the thread on
 * that comment, opened over the post (Saved.md), and [aimReply] — a comment
 * card's comment glyph — opens the reply composer aimed at it.
 */
@Serializable
data class PostDetail(
    val postId: String,
    val from: String? = null,
    val commentId: String? = null,
    val aimReply: Boolean = false,
    /** Just signed here — `ComposeLanded`'s snackbar, said once. */
    val published: Boolean = false,
)

/**
 * The reply wizard, pinned to what it answers (graph.json `ReplyEntry`
 * 5 and 7): [isComment] false is the post, true the comment.
 *
 * The card's words ride the route rather than a second read — a
 * composer that had to fetch its own target would open empty, and the
 * thread already holds every one of these.
 */
@Serializable
data class ReplyWizard(
    val targetId: String,
    val isComment: Boolean,
    val title: String,
    val snippet: String,
    val authorHandle: String,
    val avatarUrl: String? = null,
)

/** `CommentEdit` on an own comment (graph.json `ReplyMedia` 6). */
@Serializable
data class EditComment(val commentId: String, val parentTitle: String)

/** A topic by its canonical name — reachable from a chip anywhere (D20). [from] names the back arrow's origin. */
@Serializable
data class Topic(val name: String, val from: String? = null)

/** An actor's profile; a null handle is the viewer's own (the tab). [from] names the back arrow's origin. */
@Serializable
data class Profile(val handle: String? = null, val from: String? = null)

/** The reader's Saved list, reached from their own profile's ⋮ (Saved.md). */
@Serializable
data object Saved

/**
 * The reader's notification list, reached from the bell on a root band
 * (Notifications.md). [from] names the root the bell was tapped on — the slot
 * the bar keeps lit and the root the back arrow names.
 */
@Serializable
data class Notifications(val from: String = "feed")

@Serializable
data object ProfileEdit

/**
 * The profile-picture flow (`AvatarCrop`, then `AvatarSeal` or back).
 *
 * The crop's Next has two outcomes (AvatarCrop.md). Off the avatar's change
 * badge it opens the picture's own seal. Opened from Change picture on the
 * edit form ([fromEdit]) it brings the picture back to that form, whose one
 * seal signs it with the fields — and the picture's own seal never opens
 * (design/readme.md §13).
 */
@Serializable
data class AvatarFlow(val uri: String, val fromEdit: Boolean)

@Serializable
data object Invites

@Serializable
data object Settings

@Serializable
data object KeyExport

/** The release chronicle behind Settings' `What's new` row (WhatsNew.md). */
@Serializable
data object WhatsNew

/** The interim recovery-code route (DRIFT: the SettingsBackup* boards are the backup-replacement packet's). */
@Serializable
data object SettingsBackup

@Serializable
data object ChangePassword

@Serializable
data object ChangeHandle

/**
 * The email change's request. [applicant] is the unverified applicant's
 * carve-out (`ApplicantEmail`), opened from Settings by G1/G2.
 */
@Serializable
data class ChangeEmail(val applicant: Boolean = false)

@Serializable
data object ChangeEmailConfirm

/** The new address's link — the App Link on `/email-change?token=`. */
@Serializable
data class ChangeEmailLinked(val token: String)

@Serializable
data object About

/** The deletion's request screen (`DeleteAccount`), opened from the Settings row. */
@Serializable
data object DeleteAccount

/**
 * Where the request lands (`DeleteAccountMail`). [includeContent] is the
 * request screen's recorded choice, which Resend carries again.
 */
@Serializable
data class DeleteAccountMail(val includeContent: Boolean)

/** The grace page (`DeleteAccountPending`), opened from the row while the deletion is confirmed. */
@Serializable
data object DeleteAccountPending

/** The mailed link's landing — the App Link on `/delete-account?token=`. */
@Serializable
data class DeleteAccountConfirmed(val token: String)

/**
 * Chats — coming soon (backlog item 68, ruled 2026-09-14). Reachable from
 * every root band's chats affordance and a profile's Message; [from] names
 * which, for the back arrow's noun (ChatsComingSoon.md:15-17).
 */
@Serializable
data class ChatsComingSoon(val from: String = CHATS_FROM_FEED)

/**
 * The vouch-back's ceremony (`VouchedIn`; VouchedIn.md). It carries the
 * voucher it names — handle, name, face — from the surface the signing was
 * taken on, so it needs no read of its own.
 */
@Serializable
data class VouchedIn(val handle: String, val name: String, val avatarUrl: String? = null)

/** The new address's link path (auth.md "Link URLs"), claimed beside `/join`. */
internal const val EMAIL_CHANGE_PATH = "/email-change"

/** The account deletion's link path (auth.md "Link URLs"), claimed beside `/join`. */
internal const val DELETE_ACCOUNT_PATH = "/delete-account"

/** What `ManageSpaceActivity` relays the system storage screen's "Manage space" as. */
const val ACTION_MANAGE_SPACE = "com.cogra.app.action.MANAGE_SPACE"
