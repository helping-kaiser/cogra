// The slice-1 API surface as repository interfaces (api-spec.md "Auth
// and accounts", "The write flow"). core:network implements them over
// the generated Apollo client (android/CLAUDE.md "Auth / tokens").

package com.cogra.domain.repo

import com.cogra.crypto.Family
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentView
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
import com.cogra.domain.SessionInfo
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserProfile
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
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

    suspend fun preparePost(
        title: String?,
        description: String?,
        content: String,
        license: LicenseChoice,
    ): Outcome<PreparedContentView>

    /**
     * The full intended field set — the edit form holds every field, so
     * all three ride as present values; a null title/description clears.
     */
    suspend fun preparePostEdit(
        id: String,
        title: String?,
        description: String?,
        content: String,
    ): Outcome<PreparedContentView>

    suspend fun prepareComment(
        target: String,
        content: String,
        license: LicenseChoice,
    ): Outcome<PreparedContentView>

    suspend fun prepareCommentEdit(id: String, content: String): Outcome<PreparedContentView>

    /** A further page of one comment's direct replies (expand). */
    suspend fun commentReplies(
        commentId: String,
        first: Int,
        after: String?,
        includePending: Boolean = true,
    ): Outcome<Page<CommentView>>
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
    ): Outcome<List<PreparedWriteView>>
}
