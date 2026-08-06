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

/**
 * A user account's service state (auth.md "Account states"): it gates
 * acting, never reading. The client gates acting mutations on MEMBER —
 * a FORBIDDEN from an acting call is a client bug, not a state to
 * render (api-spec.md "Conventions").
 */
enum class AccountState {
    GUEST,
    APPLICANT,
    MEMBER,

    /** A state this client version does not know — gate acting. */
    UNKNOWN,
}

/** The viewer's own account. */
data class UserProfile(
    val id: String,
    val handle: String,
    val displayName: String?,
    val accountState: AccountState,
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

/** The viewer's own application row (`User.application`). */
data class ApplicationView(
    val handle: String,
    /** One of the two approvability proofs. */
    val emailVerified: Boolean,
    /** The other proof: the device-minted key and L0 address are attached. */
    val keyAttached: Boolean,
    val approvedAt: Instant?,
    val landedAt: Instant?,
    val expiresAt: Instant,
)

/**
 * The me-driven onboarding status poll (api-spec.md "Auth and
 * accounts"): the account state, the latest application, and the staged
 * Registration riding the ordinary staged-write surface.
 */
data class ApplicationStatus(
    val accountState: AccountState,
    /** Null when the account has none (expired and reaped). */
    val application: ApplicationView?,
    /** The unexpired staged Registration; null when none is staged. */
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
    val applications: List<ApplicationInfo>,
)

/** An application in the inviter's queue. */
data class ApplicationInfo(
    val id: String,
    val handle: String,
    val emailVerified: Boolean,
    val keyAttached: Boolean,
    val approvedAt: Instant?,
    val landedAt: Instant?,
)
