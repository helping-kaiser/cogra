// The slice-1 API surface as repository interfaces (api-spec.md "Auth
// and accounts", "The write flow"). core:network implements them over
// the generated Apollo client; authenticated calls carry the Bearer
// token and single-flight refresh-and-replay on UNAUTHENTICATED
// (android/CLAUDE.md "Auth / tokens").

package com.cogra.domain.repo

import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.LoginGrant
import com.cogra.domain.Outcome
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

    /** Uploads (or replaces) the client-encrypted blob. */
    suspend fun uploadKeyBackup(blob: ByteArray): Outcome<Unit>

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
