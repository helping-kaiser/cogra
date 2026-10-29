// The approver's side of admission and the ask link's two ends, over the
// contract (api-spec.md "Invites", "The ask link"; auth.md "Invite-link
// generation", "Rejection", "The ask link"). The vouch an approval returns
// is the approver's own signature, never a server write. web's twin is
// `web/src/lib/api/invites-api.ts`.

package com.cogra.domain.invites

import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import java.time.Instant

/** The invite and ask-link verbs; every read is the viewer's own. */
interface InvitesRepository {
    /** Invites in one read: the approval queue and the reader's links. */
    suspend fun invites(): Outcome<InvitesRead>

    suspend fun createInviteLink(expiresAt: Instant, singleUse: Boolean): Outcome<InviteLinkInfo>

    suspend fun revokeInviteLink(id: String): Outcome<Unit>

    /** The priced vouch; returns the approver's own Opinion writes to sign. */
    suspend fun approveApplication(
        applicationId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>>

    /** Closes one application in the reader's queue; nothing is deleted. */
    suspend fun rejectApplication(applicationId: String): Outcome<Unit>

    /** Closes every application still waiting on [linkId]; succeeds with how many. */
    suspend fun rejectLinkApplications(linkId: String): Outcome<Int>

    /** The anonymous check an ask link's arrival reads; Success(null) names nobody. */
    suspend fun askLinkCheck(askLinkId: String): Outcome<AskLinkCheck?>

    /** Takes the asker up into the reader's own queue (ASK_LINK_UNUSABLE refuses). */
    suspend fun stageApplicant(askLinkId: String): Outcome<ApplicationInfo>

    /** The applicant's own card: the precedence row and the ask link. Success(null) signed out. */
    suspend fun myApplication(): Outcome<MyApplication?>
}

/** Invites, as one read answers it. */
data class InvitesRead(
    /** Waiting applications only, oldest first (`approvalQueue`). */
    val queue: List<ApplicationInfo>,
    /** The reader's links, usable or not; the screen shows the usable ones. */
    val links: List<InviteLinkInfo>,
)

/** An invite link as its issuer sees it. */
data class InviteLinkInfo(
    val id: String,
    val singleUse: Boolean,
    val createdAt: Instant,
    val expiresAt: Instant,
    val revokedAt: Instant?,
    /** The server's one reckoning: not revoked, not expired, and (single use) never used. */
    val usable: Boolean,
)

/** The link a queue row came through, as the group it stands in. */
data class QueueLink(val id: String, val singleUse: Boolean)

/** An application in the approver's queue. */
data class ApplicationInfo(
    val id: String,
    val handle: String,
    val emailVerified: Boolean,
    val keyAttached: Boolean,
    val createdAt: Instant,
    val approvedAt: Instant? = null,
    val rejectedAt: Instant? = null,
    val landedAt: Instant? = null,
    /**
     * The applicant's raw L1 identifier, `prof:<address>` — the node an
     * approval's vouch points at, which the device checks the vouch it
     * signs against (signing/Intent.kt). Null before the key is attached,
     * when nothing is approvable.
     */
    val graphId: String? = null,
    /** Null for an ask-link staging: the row heads the list on its own. */
    val inviteLink: QueueLink? = null,
) {
    /** Both approvability proofs are in: the reader can approve it now. */
    val approvable: Boolean get() = emailVerified && keyAttached

    /** Neither approved, closed nor landed. */
    val waiting: Boolean get() = approvedAt == null && rejectedAt == null && landedAt == null
}

/** Why an ask link stages nobody for this reader right now. */
enum class AskLinkUnusableReason {
    /** The asker is already in. */
    LANDED,

    /** The asker already waits in the reader's own queue. */
    WAITING_ON_VIEWER,

    /** A reason this build cannot name: read as the link being unusable, no case drawn. */
    UNKNOWN,
}

/** The anonymous pre-stage view of an ask link. */
data class AskLinkCheck(
    val usable: Boolean,
    val applicantHandle: String,
    /** Null while usable. */
    val reason: AskLinkUnusableReason?,
)

/** The applicant's own application, as `User.application` answers it by precedence. */
data class ApplicantApplication(
    val id: String,
    val approvedAt: Instant?,
    val rejectedAt: Instant?,
    val landedAt: Instant?,
    /** The member whose approval is in play — never named "inviter". */
    val approver: ActorRef?,
)

/** What the applicant's card reads. */
data class MyApplication(
    /** The account's ask link id; null for an account that never applied. */
    val askLink: String?,
    val application: ApplicantApplication?,
)
