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
    /**
     * The actor's picture, when they have one and the read asked. Null
     * is the monogram — the designed placeholder, not a gap (D13).
     */
    val avatar: MediaAssetView? = null,
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

/**
 * Where a node stands relative to L1 finality (substrate.md §6).
 * PENDING is real content whose place in the order is not yet fixed;
 * LANDED is ordered fact. UNKNOWN is the forward-compatible fallback —
 * a state this build cannot name is never presented as pending.
 */
enum class LandingState {
    PENDING,
    LANDED,
    UNKNOWN,
}

/**
 * A node's landing position. `epoch` is the graph's own clock and is
 * null exactly while `state` is PENDING — a pending write has no causal
 * key yet (api-spec.md "Identity and actor interfaces").
 */
data class Landing(
    val state: LandingState,
    val epoch: Int? = null,
) {
    /** Drives the quiet "still settling" marker (design.md §9). */
    val isPending: Boolean get() = state == LandingState.PENDING

    companion object {
        val Pending = Landing(LandingState.PENDING, null)

        fun landed(epoch: Int) = Landing(LandingState.LANDED, epoch)
    }
}

/**
 * One attachment as a reader needs it (api-spec.md `MediaAttachment`).
 *
 * [aspectRatio] is the server's own derivation from the stored bytes
 * (D11) and it is what reserves the tile's space before the picture
 * loads. The contract serves it as a string, so an unparsable or absent
 * value falls back to square rather than to zero — a zero ratio would
 * collapse the tile and defeat the reservation the field exists for.
 *
 * [altText] is authored, never generated: a null one is a decorative
 * asset and must stay a null content description (D20).
 *
 * [mimeType] is what a gallery branches a player on. The server states
 * it from the bytes it validated, so it is read rather than inferred
 * from the URL — a URL is a store path, not a contract.
 *
 * [cover] is a video's poster and null on a still. It answers with its
 * own [status], so a cover redacted on its own reads REDACTED here
 * while the video it covers still plays.
 */
data class MediaAssetView(
    val id: String,
    val url: String,
    val altText: String?,
    /** NORMAL, or REDACTED once the bytes are gone (D15). */
    val status: FieldStatus,
    val aspectRatio: Float,
    val mimeType: String = "",
    /** The clip's length, null on a still (D11 — derived, never sent). */
    val durationMs: Int? = null,
    val cover: MediaAssetView? = null,
) {
    /**
     * Whether this asset plays rather than being drawn once.
     *
     * The one accepted moving format is MP4 (rulings 2026-09-02), but
     * the test is the type's family rather than that one value: a
     * second container would arrive as a server change, and a client
     * that hard-codes `video/mp4` would silently draw it as a broken
     * still instead of refusing it loudly.
     */
    val isVideo: Boolean get() = mimeType.startsWith("video/")

    companion object {
        /** What an absent or unparsable `options.aspectRatio` reads as. */
        const val FALLBACK_RATIO = 1f

        fun ratioOf(raw: String?): Float =
            raw?.toFloatOrNull()?.takeIf { it.isFinite() && it > 0f } ?: FALLBACK_RATIO
    }
}

/**
 * One placement in a gallery being authored (api-spec.md
 * `AttachmentInput`).
 *
 * `displayOrder` and `isCover` are not free values: the contract
 * refuses an entry whose stated index contradicts its array position,
 * so the list's own order decides both and the claim states neither.
 *
 * [altText] is authored here rather than at the upload because it is a
 * fact about this placement: the same asset can read differently in two
 * posts, and correcting a description is a new version of the post
 * rather than a re-upload. Blank is not a description — an undescribed
 * picture carries null.
 */
data class AttachmentClaim(val mediaId: String, val altText: String? = null)

/**
 * A three-valued profile media field: omitted = untouched, explicit
 * null = cleared, a value = replaced (api-spec.md "Content authoring",
 * D13).
 *
 * This differs from the content-edit two-valued rule and is easy to get
 * wrong, so it is a type rather than a nullable string — "leave it
 * alone" and "clear it" are not the same absence.
 */
sealed interface MediaFieldUpdate {
    data object Untouched : MediaFieldUpdate

    data object Clear : MediaFieldUpdate

    data class Set(val mediaId: String) : MediaFieldUpdate
}

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
    /** Where this post stands relative to L1 finality. */
    val landing: Landing,
    /** The qualifiers the minting Publish record carried. */
    val license: LicenseChoice,
    /**
     * This post's current topics — the author's own declarations only
     * (hashtag.md §4, §5): third-party tag claims reach a viewer only
     * through the tagger, at a forward-path weight the ranker computes,
     * and the ranker arrives in slice 3.
     */
    val topics: List<TopicClaimView> = emptyList(),
    /** This post's current references — the same author-owned channel as [topics] (D12). */
    val references: List<ReferenceClaimView> = emptyList(),
    /**
     * The gallery, in the author's order, the first entry the cover.
     * Empty on a words post — a post's body is words XOR media (D16),
     * so exactly one of [content]`.value` and this carries it.
     */
    val attachments: List<MediaAssetView> = emptyList(),
    /** The gallery's state — one for the whole set, never per asset (D12). */
    val attachmentsStatus: FieldStatus = FieldStatus.NORMAL,
) {
    /** The body is media rather than words (D16). */
    val isMediaPost: Boolean get() = attachments.isNotEmpty()
}

/** One comment with its current display version. */
data class CommentView(
    val id: String,
    val content: ModeratedField,
    val author: ActorRef?,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** Where this comment stands relative to L1 finality. */
    val landing: Landing,
    /** The qualifiers the minting Review record carried. */
    val license: LicenseChoice,
    /**
     * How many direct replies this comment holds, across every page —
     * the number behind the "View n replies" line (Q49).
     *
     * The thread read **counts** replies rather than carrying them: a
     * prefetched page multiplied the corpus's heaviest document for
     * branches nobody had asked to open, and the count is what the
     * collapsed line actually needs. Expanding one fires its own read.
     */
    val replyCount: Int = 0,
    /** This comment's current topics — the same author-owned channel as [PostView.topics]. */
    val topics: List<TopicClaimView> = emptyList(),
    /** This comment's current references — the same author-owned channel (D12). */
    val references: List<ReferenceClaimView> = emptyList(),
    /**
     * The gallery, at most four and with no cover: a comment is text
     * **plus** optional media, never instead of it (D16).
     */
    val attachments: List<MediaAssetView> = emptyList(),
    val attachmentsStatus: FieldStatus = FieldStatus.NORMAL,
)

/**
 * One standing citation on a piece of content — a chip in the
 * reference row (D16). The bundle key is (author, citing artifact,
 * target) and its records *net*: a bundle reaching `(0, 0)` is
 * withdrawn and never appears here.
 */
data class ReferenceClaimView(
    /**
     * The cited node, typed. Null when CoGra carries no display row for
     * it — the fold reads the record mirror, which reaches further than
     * the display store — in which case [targetId] still names it.
     */
    val target: ReferenceTargetView?,
    /** The cited node's raw L1 identifier, present whether or not [target] resolved. */
    val targetId: String,
    /** How load-bearing the cited thing is here — effort `f`, folded and clipped. */
    val relevance: Double,
    /** Endorsing versus refuting — enthusiasm `e`, folded and clipped. */
    val support: Double,
    /**
     * How many counter-records withdrawing this citation stages — one
     * priced act each (B4). Read off the RAW bundle sums, which is why
     * [relevance] and [support] cannot imply it: the clip has already
     * lost how far past `1` the bundle reaches, and that distance is
     * exactly what decides whether one record can walk it back.
     */
    val withdrawalCost: Int,
    val pending: Boolean,
)

/**
 * What a citation points at. The target's node class is the whole
 * distinction between quoting, embedding and mentioning (D2), so the
 * render reads this and nothing else to decide which chip to draw.
 *
 * Topics are deliberately absent: tagging is what a topic is for, and
 * referencing covers every other passive node (D21).
 */
sealed interface ReferenceTargetView {
    /** A person — the citation is a mention, and the chip opens their profile. */
    data class Profile(
        val id: String,
        val handle: String,
        val displayName: String?,
    ) : ReferenceTargetView

    /** A post or a comment — a quote or an embed, which differ only in the render. */
    data class Content(
        val kind: ReferenceContentKind,
        val id: String,
        val title: String?,
        val snippet: String?,
        val authorHandle: String?,
        val authorDisplayName: String?,
        /**
         * For a comment, the post that carries it — a comment is read
         * inside its post and has no permalink, so this is where its
         * chip lands. Null when the walk ran out of levels; the chip
         * then renders without a destination.
         */
        val containingPostId: String? = null,
    ) : ReferenceTargetView
}

/** Which content class a [ReferenceTargetView.Content] names. */
enum class ReferenceContentKind {
    POST,
    COMMENT,
}

/**
 * One offer from the reference finder (D20): the typed node for the
 * chip and the L2 id a `ReferenceInput` names it by. The target is
 * non-null where a claim's is nullable — a candidate is only ever
 * built from what CoGra can display.
 */
data class ReferenceCandidateView(
    val target: ReferenceTargetView,
    val targetId: String,
)

/**
 * One current topic claim on a piece of content — a chip in the chip
 * row (hashtag.md §4). The bundle key is (author, content, Type); the
 * newest record in it wins, and relevance 0 is a withdrawal that never
 * appears here.
 */
data class TopicClaimView(
    val hashtag: HashtagView,
    /** Relevance `r` — how much the topic is the content's. */
    val relevance: Double,
    /** Confidence `c` — how firmly the claim is held. */
    val confidence: Double,
    val pending: Boolean,
)

/**
 * A topic: the naming service's canonical Type (hashtag.md §1). Not a
 * `Node` — a Type is anchored vacuously, with no minting record and no
 * author (D2).
 */
data class HashtagView(
    val id: String,
    /** The canonical tag — lowercase, without `#`. */
    val name: ModeratedField,
)

/** Which kind of node a [TaggedContentView] entry names — the topic screen's list. */
enum class TaggedContentKind {
    POST,
    COMMENT,

    /** A node class this build does not yet render on the topic screen. */
    UNKNOWN,
}

/**
 * One node currently tagged with a topic — an entry in
 * [HashtagView]'s content list (`Hashtag.taggedContent`), read from the
 * Type's side of the same current-topics fold.
 */
data class TaggedContentView(
    val kind: TaggedContentKind,
    val id: String,
    val title: String?,
    val snippet: String?,
    val authorHandle: String?,
    val authorDisplayName: String?,
    val relevance: Double,
    val confidence: Double,
    val pending: Boolean,
)

/** One forward page of a keyset connection. */
data class Page<T>(
    val items: List<T>,
    /** The cursor to continue from; null when the page is empty. */
    val endCursor: String?,
    val hasNextPage: Boolean,
)

/**
 * The author's own sensitive mark on one node, read on its own.
 *
 * Not part of [PostView]: the veil a reader sees is the OR of this mark
 * and a moderator's verdict, and only this half is a thing an edit may
 * carry (api-spec.md "Two states, and the statuses are their OR"). The
 * edit form reads it so the record it prepares re-states it.
 */
/**
 * One comment plus the author-only state an edit needs.
 *
 * The mark rides beside the comment rather than on it because it is not
 * thread-readable: a card never shows it, and only its author's edit
 * screen reads it — which is also the one screen that must re-state it
 * or clear it by omission.
 */
data class CommentForEdit(
    val comment: CommentView,
    val selfMark: SelfMarkView,
)

data class SelfMarkView(
    val sensitive: Boolean,
    /** Null when unmarked, and when the mark carries no reason. */
    val reason: String?,
)

/** A post with its first page of comments — the detail read. */
data class PostDetail(
    val post: PostView,
    val comments: Page<CommentView>,
)

/**
 * License qualifiers, declared at authoring and immutable
 * (platform-guidelines.md §5): attribution `a` and provenance `o`, each
 * a degree on [0, 1]. Both are terms over downstream use, never a
 * statement about how the content was made. The declaration is
 * mandatory at authoring time.
 */
data class LicenseChoice(
    val attribution: Double,
    val provenance: Double,
) {
    companion object {
        /**
         * Public Domain: the unique point of zero severity, where a use
         * carries no downstream obligation whatever. CoGra's default.
         */
        val PublicDomain = LicenseChoice(0.0, 0.0)

        /**
         * The degrees CoGra publishes a reading for. The composer
         * offers these and nothing between them — a degree with no
         * published reading is a term no reader could check.
         */
        val TIERS = listOf(0.0, 0.5, 1.0)
    }
}

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
    /** Null for an account that has never set one — the monogram (D13). */
    val avatar: MediaAssetView? = null,
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
