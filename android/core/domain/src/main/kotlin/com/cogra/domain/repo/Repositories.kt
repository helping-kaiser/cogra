// The slice-1 API surface as repository interfaces (api-spec.md "Auth
// and accounts", "The write flow"). core:network implements them over
// the generated Apollo client (android/CLAUDE.md "Auth / tokens").

package com.cogra.domain.repo

import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentView
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
    /** The chronological listing, newest first. */
    suspend fun posts(first: Int, after: String?): Outcome<Page<PostView>>

    /** One post with its first comments page; null for an unknown id. */
    suspend fun post(id: String, commentsFirst: Int, commentsAfter: String?): Outcome<PostDetail?>

    /** A further comments page of one post. */
    suspend fun comments(postId: String, first: Int, after: String?): Outcome<Page<CommentView>>

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
}
