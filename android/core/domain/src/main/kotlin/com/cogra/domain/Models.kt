// Domain views of the slice-1 API vocabulary (api-spec.md). Mapped from
// the generated Apollo types by core:network; nothing here depends on
// the transport.

package com.cogra.domain

import com.cogra.crypto.Family
import java.time.Instant

/** A fresh access + refresh token pair (auth.md "Tokens"). */
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    /**
     * The account the pair authenticates (`AuthSession.user.id`) — the
     * custody key the identity store scopes its material by (auth.md
     * "Multi-account device custody").
     */
    val accountId: String,
)

/**
 * A successful login's payload: the token pair plus the pending
 * refresh-token-reuse security event, delivered exactly once by the
 * first login after detection (auth.md "Reuse detection").
 */
data class LoginGrant(
    val tokens: AuthTokens,
    val reuseDetectedAt: Instant?,
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
    /**
     * Whether the viewer's reciprocal Opinion toward [invitedBy] exists —
     * graph-derived, mirror-confirmed or in flight (auth.md
     * "Reciprocation is the joiner's own act"). Vacuously true without
     * an inviter.
     */
    val hasReciprocated: Boolean,
    /** Landing provenance — the reciprocation target; null for genesis actors. */
    val invitedBy: ActorRef?,
)

/** A minimal reference to another actor, as the actor chip renders it. */
data class ActorRef(
    val id: String,
    val handle: String,
    /** The current display name; null when the read did not ask. */
    val displayName: String? = null,
)

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
    /**
     * The account's attached actor public key (base64), null before the
     * ceremony — what the repair-attach verifies the device slot
     * against (auth.md "Multi-account device custody").
     */
    val actorPubkey: String?,
)

/** Handshake progress of a staged write (api-spec.md "The write flow"). */
enum class WriteState {
    AWAITING_PRE_SIGN,
    SEALING,
    AWAITING_APPROVAL,
    RELAYING,
    LANDED,
    EXPIRED,

    /** A state this client version does not know — refuse to act, keep material. */
    UNKNOWN,
}

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
    /** A suggestion, never a commitment — seeds the approval form. */
    val prefillPDirected: Double,
    val prefillPInterest: Double,
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

/** Client mirror of the server's minimum handle length (auth.md "Application"). */
const val MIN_HANDLE_LENGTH = 3

/** The house prefill for a stance dimension — sliders and link prefills start here. */
const val DEFAULT_STANCE = 0.1


// ---------------------------------------------------------------------
// Content (slice 2 — api-spec.md "Content nodes", "Content authoring")
// ---------------------------------------------------------------------

/** Per-field moderation state; UNKNOWN renders like REDACTED (hide). */
enum class FieldStatus {
    NORMAL,
    SENSITIVE,
    REDACTED,
    UNKNOWN,
}

/**
 * Text carrying its own moderation status. `value` is null when the
 * field is redacted or unset — `status` disambiguates; empty is a
 * value, null never is.
 */
data class ModeratedField(
    val value: String?,
    val status: FieldStatus,
)

/** One post with its current display version. */
data class PostView(
    val id: String,
    val title: ModeratedField,
    val description: ModeratedField,
    val content: ModeratedField,
    /** Null when no account fronts the author (system actors). */
    val author: ActorRef?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/** One comment with its current display version. */
data class CommentView(
    val id: String,
    val content: ModeratedField,
    val author: ActorRef?,
    val createdAt: Instant,
    val updatedAt: Instant,
    /**
     * The first page of direct replies, when the read prefetched one
     * (the thread read carries one level; deeper levels load on
     * expand). Null when the read did not ask.
     */
    val replies: Page<CommentView>? = null,
)

/** One forward page of a keyset connection. */
data class Page<T>(
    val items: List<T>,
    /** The cursor to continue from; null when the page is empty. */
    val endCursor: String?,
    val hasNextPage: Boolean,
)

/** A post with its first page of comments — the detail read. */
data class PostDetail(
    val post: PostView,
    val comments: Page<CommentView>,
)

/**
 * AI-provenance oversight, three-valued
 * (platform-guidelines.md §5): the declaration is mandatory at
 * authoring time.
 */
enum class OversightChoice {
    NONE,
    CONDITIONAL,
    FULL,
}

/** License qualifiers, declared at authoring and immutable. */
data class LicenseChoice(
    val attributionRequired: Boolean,
    val oversight: OversightChoice,
)

/**
 * A prepared content write: the node id the content will serve under
 * once landed, plus the writes for this device to sign.
 */
data class PreparedContentView(
    val node: String,
    val writes: List<PreparedWriteView>,
)


// ---------------------------------------------------------------------
// Profiles (slice 2.1 — api-spec.md "Actors", roadmap "Slice 2.1")
// ---------------------------------------------------------------------

/** An actor's public profile — the newest profile version's fields. */
data class ProfileView(
    val id: String,
    val handle: String,
    val displayName: ModeratedField,
    val bio: ModeratedField,
    val websiteUrl: ModeratedField,
)

/** A tappable link from a chronicle row into the content it touched. */
sealed interface RecordLink {
    /** The row opens this post. */
    data class ToPost(val postId: String) : RecordLink
}

/**
 * One row of an actor's chronicle — the `records(author:)` read
 * rendered as an honest labelled history (roadmap "Slice 2.1"). The
 * label derives from family + genesis; the snippet is the touched
 * content's current text, when CoGra carries a display row for it.
 */
data class RecordRow(
    /** L1's record identifier — the list key. */
    val id: String,
    val family: Family,
    /** True when the record minted its node (created), false on updates. */
    val genesis: Boolean,
    val snippet: String?,
    val link: RecordLink?,
)
