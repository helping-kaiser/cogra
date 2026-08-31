// The slice-1 API surface as repository interfaces (api-spec.md "Auth
// and accounts", "The write flow"). core:network implements them over
// the generated Apollo client (android/CLAUDE.md "Auth / tokens").

package com.cogra.domain.repo

import com.cogra.crypto.Family
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.AuthTokens
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.CommentView
import com.cogra.domain.HashtagView
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.LicenseChoice
import com.cogra.domain.LoginGrant
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ReferenceCandidateView
import com.cogra.domain.SelfMarkView
import com.cogra.domain.SessionInfo
import com.cogra.domain.StagedWriteView
import com.cogra.domain.TaggedContentView
import com.cogra.domain.UserProfile
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.references.ReferenceClaim
import com.cogra.domain.topics.TagClaim
import java.time.Instant

/**
 * The joining flow (auth.md "Application"): registration creates the
 * account and returns an ordinary session; every later step is
 * session-authorized — there is no applicant token.
 */
interface OnboardingRepository {
    /** Null when the id references no link. */
    suspend fun checkInviteLink(id: String): Outcome<InviteCheck?>

    /** Creates the account in the applicant state; the first session. */
    suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens>

    suspend fun verifyEmail(verificationToken: String): Outcome<Unit>

    suspend fun resendVerificationEmail(email: String): Outcome<Unit>

    /** The key ceremony's server half; replaceable until approval. */
    suspend fun attachActorKey(actorPubkeyBase64: String, l0Address: String): Outcome<Unit>

    /** Re-arms an expired, never-approved application with a fresh link. */
    suspend fun applyWithInvite(inviteLink: String): Outcome<Unit>

    /** The me-driven status poll — also the crash-repair hook. */
    suspend fun applicationStatus(): Outcome<ApplicationStatus>
}

/** Login, refresh, and session management — the L2 half of auth. */
interface SessionRepository {
    suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<LoginGrant>

    /** Consumes the current refresh token; the caller replaces the stored pair. */
    suspend fun refresh(refreshToken: String): Outcome<AuthTokens>

    suspend fun sessions(): Outcome<List<SessionInfo>>

    /** Revokes the given session, or the current one when null. */
    suspend fun revokeSession(id: String?): Outcome<Unit>

    suspend fun revokeOtherSessions(): Outcome<Int>
}

/** The client legs of the write path (architecture.md "The write path"). */
interface WriteRepository {
    /** The host key seals verify against; cached per process. */
    suspend fun hostPublicKey(): Outcome<ByteArray>

    suspend fun prepareStance(targetId: String, pDirected: Double, pInterest: Double): Outcome<List<PreparedWriteView>>

    suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView>

    suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView>

    /** The confirm-side observation read; null when not the viewer's. */
    suspend fun stagedWrite(id: String): Outcome<StagedWriteView?>
}

/** The viewer's own account: profile, key backup, credentials, invites. */
interface AccountRepository {
    /** Null when the session is gone. */
    suspend fun me(): Outcome<UserProfile?>

    /** The uploaded backup blob (decoded from base64); null when none. */
    suspend fun keyBackup(): Outcome<ByteArray?>

    /** The challenge an upload must spend (auth.md "Key recovery"). */
    suspend fun keyBackupChallenge(): Outcome<ByteArray>

    /**
     * Uploads (or replaces) the client-encrypted blob. The signature is
     * the actor key's proof over the challenge and these exact bytes —
     * a session alone must not be able to overwrite the blob.
     */
    suspend fun uploadKeyBackup(blob: ByteArray, challenge: ByteArray, signature: ByteArray): Outcome<Unit>

    suspend fun changePassword(currentPassword: String, newPassword: String): Outcome<Unit>

    suspend fun changeHandle(handle: String): Outcome<Unit>

    suspend fun requestPasswordReset(email: String): Outcome<Unit>

    suspend fun confirmPasswordReset(resetToken: String, newPassword: String): Outcome<Unit>

    suspend fun requestEmailChange(newEmail: String, currentPassword: String): Outcome<Unit>

    suspend fun confirmEmailChange(code: String): Outcome<Unit>

    // The inviter surface.
    suspend fun inviteLinks(): Outcome<List<InviteLinkInfo>>

    suspend fun createInviteLink(
        expiresAt: Instant,
        prefillPDirected: Double,
        prefillPInterest: Double,
        singleUse: Boolean,
    ): Outcome<InviteLinkInfo>

    suspend fun revokeInviteLink(id: String): Outcome<Unit>

    /** The priced vouch; returns the inviter's own Opinion writes to sign. */
    suspend fun approveApplication(
        applicationId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>>
}

/**
 * The content surface (api-spec.md "Content authoring"; roadmap
 * "Slice 2"): prepare verbs stage device-signed writes; reads serve
 * the display store.
 */
interface ContentRepository {
    /**
     * The chronological listing, newest first — pending entries first,
     * then landed entries in landing order. `includePending = false`
     * serves only what has landed on L1, for a reader who wants the
     * settled graph (api-spec.md "Pending entries come first, in their
     * own cursor namespace"); true is the API's own default.
     */
    suspend fun posts(
        first: Int,
        after: String?,
        includePending: Boolean = true,
    ): Outcome<Page<PostView>>

    /** One post with its first comments page; null for an unknown id. */
    suspend fun post(
        id: String,
        commentsFirst: Int,
        commentsAfter: String?,
        includePending: Boolean = true,
    ): Outcome<PostDetail?>

    /** A further comments page of one post. */
    suspend fun comments(
        postId: String,
        first: Int,
        after: String?,
        includePending: Boolean = true,
    ): Outcome<Page<CommentView>>

    /**
     * [tags] are the topics declared at creation (post.md §3, D15: no
     * autocomplete). The server stages one Tag write per claim, at the
     * parameters the claim carries (api-spec.md `TagInput`).
     */
    suspend fun preparePost(
        title: String?,
        description: String?,
        content: String?,
        license: LicenseChoice,
        tags: List<TagClaim> = emptyList(),
        references: List<ReferenceClaim> = emptyList(),
        /**
         * The gallery in the author's order — the array position is the
         * order and the first entry is the cover, so nothing here
         * carries an index that could disagree with itself (D16, D9).
         * Exactly one of [content] and this is non-empty.
         */
        attachments: List<AttachmentClaim> = emptyList(),
        /**
         * The author's own sensitive mark, and the reason that rides the
         * veil with it. Omitted means unmarked; a reason without the mark
         * is refused on `["sensitiveReason"]`, and a blank one counts as
         * none.
         */
        sensitive: Boolean = false,
        sensitiveReason: String? = null,
    ): Outcome<PreparedContentView>

    /**
     * The author's own sensitive mark on one post; null for an unknown
     * id. Read on its own rather than off [post] — the detail read's
     * fragment is priced per feed entry and per comment, and this is
     * wanted once, when an edit opens.
     */
    suspend fun postSelfMark(id: String): Outcome<SelfMarkView?>

    /**
     * The full intended field set — the edit form holds every field, so
     * all of them ride as present values; a null title/description
     * clears.
     *
     * [sensitive] and [sensitiveReason] are the author's own mark, and
     * they are not optional here: an edit record carries the complete
     * content state, so a mark the edit does not re-state is a mark the
     * edit removes. The caller passes what it read from [postSelfMark],
     * unchanged, unless the author moved the switch.
     */
    suspend fun preparePostEdit(
        id: String,
        title: String?,
        description: String?,
        content: String,
        sensitive: Boolean = false,
        sensitiveReason: String? = null,
    ): Outcome<PreparedContentView>

    /**
     * [tags] are the topics declared at creation, exactly as on a post
     * (F9): the server stages one Tag write per claim beside the minting
     * Review, and the whole batch is signed in the one pass.
     */
    suspend fun prepareComment(
        target: String,
        content: String,
        license: LicenseChoice,
        tags: List<TagClaim> = emptyList(),
        references: List<ReferenceClaim> = emptyList(),
        /**
         * The gallery, in the author's order — at most
         * [MAX_COMMENT_ATTACHMENTS]. A comment is text **plus** optional
         * media, deliberately asymmetric to a post's exclusive-or: an
         * answer is words first (D16). There is no cover, because a
         * comment's set never leads anything.
         */
        attachments: List<AttachmentClaim> = emptyList(),
    ): Outcome<PreparedContentView>

    /**
     * [attachments] is the gallery the edit leaves standing — complete,
     * not a delta, exactly like the words beside it. An edit that sends
     * an empty list therefore *clears* the gallery, which is what makes
     * removing a picture expressible at all.
     */
    suspend fun prepareCommentEdit(
        id: String,
        content: String,
        attachments: List<AttachmentClaim> = emptyList(),
    ): Outcome<PreparedContentView>

    /** A further page of one comment's direct replies (expand). */
    suspend fun commentReplies(
        commentId: String,
        first: Int,
        after: String?,
        includePending: Boolean = true,
    ): Outcome<Page<CommentView>>

    companion object {
        /**
         * api-spec.md `PrepareCommentInput`: at most four per comment
         * (D9). A comment gallery is a supporting picture, not an album
         * — which is why it is four where a post's is ten.
         */
        const val MAX_COMMENT_ATTACHMENTS = 4
    }
}

/**
 * Everything the stance control needs (roadmap "Slice 2.2"; design.md
 * §8): the pick it stages, the bundle fold it *shows* — current
 * standing, where a pick lands it, the severance quote — and severance's
 * own staging, the one gesture stated as an intent rather than as a
 * pair.
 *
 * Every read defaults to counting records that have not landed on L1:
 * a stance still settling is one the author already made.
 */
interface StanceRepository {
    /**
     * Stages the stance record for [pick] toward [target]. The record
     * carries the two values verbatim — the client never computes a
     * delta against the bundle (design.md §8.1).
     */
    suspend fun prepareStance(target: String, pick: StancePair): Outcome<List<PreparedWriteView>>

    /** The viewer's current netted stance toward [target]. */
    suspend fun standing(target: String, includePending: Boolean = true): Outcome<StanceStanding>

    /**
     * Where [pick] would land the viewer's bundle toward [target] — the
     * backend's fold, and the authority.
     *
     * The stance pad no longer asks this under the thumb: a round trip
     * per pick put the landing about a second behind the face, so the
     * pad folds the served raw sums locally for display instead
     * (design.md §8.3, `localLanding`). This stays as the authoritative
     * answer for any surface that needs one rather than a live readout.
     */
    suspend fun projection(
        target: String,
        pick: StancePair,
        includePending: Boolean = true,
    ): Outcome<StanceProjection>

    /** What reaching `(0, 0)` toward [target] would take — the confirm's read side. */
    suspend fun severanceQuote(target: String, includePending: Boolean = true): Outcome<SeveranceQuote>

    /**
     * Stages the severance batch: the counter-records that net the
     * viewer's bundle toward [target] to `(0, 0)`, each its own priced
     * act for this device to sign.
     */
    suspend fun prepareSeverance(target: String): Outcome<List<PreparedWriteView>>
}

/**
 * The profile surface (api-spec.md "Actors"; roadmap "Slice 2.1"):
 * public reads by handle, the viewer's own profile, the authored
 * chronicle, and the parallel-Registration update.
 */
interface ProfileRepository {
    /** Null when the handle resolves to no user. */
    suspend fun profileByHandle(handle: String): Outcome<ProfileView?>

    /** The viewer's own profile; null when the session is gone. */
    suspend fun myProfile(): Outcome<ProfileView?>

    /**
     * The actor's chronicle, newest first — every record, or one
     * family's when [family] is set (the profile filter chips).
     */
    suspend fun authorRecords(
        authorId: String,
        family: Family?,
        first: Int,
        after: String?,
    ): Outcome<Page<RecordRow>>

    /**
     * The full intended field set — the edit form holds every field.
     * The display name always carries a value (the clear is refused
     * server-side); a null bio/websiteUrl clears.
     */
    suspend fun prepareProfileUpdate(
        displayName: String,
        bio: String?,
        websiteUrl: String?,
        /**
         * Three-valued, unlike the fields above: untouched, cleared, or
         * replaced (D13). The distinction is the whole reason it is a
         * type — "leave the picture alone" and "go back to the
         * monogram" are different requests, and a nullable id cannot
         * say which one it means.
         */
        avatar: MediaFieldUpdate = MediaFieldUpdate.Untouched,
    ): Outcome<List<PreparedWriteView>>
}

/**
 * The topic surface (hashtag.md; roadmap "Slice 2.3"): the naming
 * service's own read (a topic's name and its tagged content), the
 * standalone Tag gesture the chip row's add/remove rides, and the
 * follow control — Affinity toward a Type, addressed by name rather
 * than by id, since a Type anchors vacuously and a topic nobody has
 * tagged yet has no id to look up (D4).
 *
 * Follow/unfollow reuse the generic stance machinery `StanceRepository`
 * already exposes for posts, comments, and profiles; the difference is
 * only the target shape (a name, not a UUID) and the plain toggle this
 * slice ships instead of the pad (D10 — the redesign pass revisits).
 */
interface TopicRepository {
    /** Null only for a name the substrate cannot carry (D3's ASCII charset). */
    suspend fun hashtag(name: String): Outcome<HashtagView?>

    /**
     * The content currently tagged with this topic — the author-owned
     * channel only, same as [ContentRepository]'s post/comment reads
     * (hashtag.md §5, D8).
     */
    suspend fun taggedContent(
        name: String,
        limit: Int? = null,
        includePending: Boolean = true,
    ): Outcome<List<TaggedContentView>>

    /**
     * Stages one standalone Tag on existing content — the chip row's
     * add gesture and, at `pDirected = 0`, its remove gesture
     * (hashtag.md §4). Never reachable from the post/comment editor
     * (post.md §3, D14).
     */
    suspend fun prepareTag(
        target: String,
        name: String,
        pDirected: Double? = null,
        pInterest: Double? = null,
    ): Outcome<List<PreparedWriteView>>
}

/**
 * The reference surface (roadmap "Slice 2.4"): the finder that turns
 * what an author types into a citable target (D20), the standalone
 * gesture that hangs a citation off already-published content (D10),
 * and the withdrawal that nets one away (D11).
 *
 * References declared at creation ride the content write's own input
 * instead — [ContentRepository.preparePost] and
 * [ContentRepository.prepareComment] carry them, exactly as tags do.
 */
interface ReferenceRepository {
    /**
     * What the finder offers for [query] — exact matches only: a handle
     * bare or `@`-sigilled, or a UUID. Topics are not offered (D21).
     * An empty or unresolvable query yields an empty list rather than an error,
     * because a finder runs on every keystroke and most of what it is
     * asked is a prefix of something still being typed. Real search
     * arrives in slice 2.7 behind this same call.
     */
    suspend fun referenceCandidates(query: String, limit: Int? = null): Outcome<List<ReferenceCandidateView>>

    /**
     * Stages one standalone citation on existing content — the edit
     * screen's add gesture. Citations are never edit fields: changing
     * what a post cites is its own priced act (post.md §3).
     */
    suspend fun prepareReference(
        artifact: String,
        target: String,
        relevance: Double? = null,
        support: Double? = null,
    ): Outcome<List<PreparedWriteView>>

    /**
     * Stages the counter-records that net one citation bundle to
     * `(0, 0)` (D11). Both parameters are signed, so a withdrawal is
     * the severance shape rather than the tag rule beside it — the
     * returned batch length *is* the gesture's cost, which is why the
     * server assembles it instead of the client authoring a single
     * negating record that would silently under-net.
     */
    suspend fun prepareReferenceWithdrawal(
        artifact: String,
        target: String,
    ): Outcome<List<PreparedWriteView>>
}
