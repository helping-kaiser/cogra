// Domain views of the slice-1 API vocabulary (api-spec.md). Mapped from
// the generated Apollo types by core:network; nothing here depends on
// the transport.

package com.cogra.domain

import com.cogra.crypto.Family
import java.time.Instant

/** A fresh access + refresh token pair (auth.md "Tokens"). */
data class AuthTokens(
    /** Bearer token, 15-minute lifetime. */
    val accessToken: String,
    /** Rotates on every use — the stored copy is replaced each refresh. */
    val refreshToken: String,
)

/** An active authentication session — one per refresh token. */
data class SessionInfo(
    val id: String,
    val deviceLabel: String?,
    val createdAt: Instant,
    val lastUsedAt: Instant?,
    val expiresAt: Instant,
    val isCurrent: Boolean,
)

/** The viewer's own account. */
data class UserProfile(
    val id: String,
    val handle: String,
    val displayName: String?,
    /** Landing provenance — the reciprocation target; null for genesis actors. */
    val invitedBy: ActorRef?,
)

/** A minimal reference to another actor. */
data class ActorRef(val id: String, val handle: String)

/** The anonymous pre-submit view of an invite link. */
data class InviteCheck(
    val usable: Boolean,
    val inviterHandle: String,
    val expiresAt: Instant,
)

/** The applicant's own view of their application (`application` query). */
data class ApplicationStatus(
    val handle: String,
    val emailVerified: Boolean,
    val approvedAt: Instant?,
    val landedAt: Instant?,
    val expiresAt: Instant,
    /** Null before approval and after landing. */
    val stagedRegistration: StagedWriteView?,
)

/** Handshake progress of a staged write (api-spec.md "The write flow"). */
enum class WriteState { AWAITING_PRE_SIGN, SEALING, AWAITING_APPROVAL, RELAYING, LANDED, EXPIRED }

/** One staged write mid-handshake, as the API serves it. */
data class StagedWriteView(
    val id: String,
    val state: WriteState,
    val family: Family,
    /** The canonical proposal wire bytes, decoded from base64. */
    val canonicalProposal: ByteArray,
    /** The host-sealed verified act wire bytes; null before the seal returns. */
    val verifiedAct: ByteArray?,
    /** L1's record id once LANDED; null before. */
    val recordId: String?,
) {
    override fun equals(other: Any?): Boolean = other is StagedWriteView && other.id == id
    override fun hashCode(): Int = id.hashCode()
}

/** One prepared proposal for the device to verify and pre-sign. */
data class PreparedWriteView(
    val id: String,
    val family: Family,
    /** The canonical proposal wire bytes, decoded from base64. */
    val canonicalProposal: ByteArray,
    val gcAfterEpochs: Int,
) {
    override fun equals(other: Any?): Boolean = other is PreparedWriteView && other.id == id
    override fun hashCode(): Int = id.hashCode()
}

/** An invite link as its issuer sees it. */
data class InviteLinkInfo(
    val id: String,
    val singleUse: Boolean,
    val createdAt: Instant,
    val expiresAt: Instant,
    val revokedAt: Instant?,
    /** The issuer's approval queue. */
    val applicants: List<ApplicantInfo>,
)

/** A staged applicant in the inviter's queue. */
data class ApplicantInfo(
    val id: String,
    val handle: String,
    val emailVerified: Boolean,
    val approvedAt: Instant?,
    val landedAt: Instant?,
)
