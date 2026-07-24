// The staged-Registration flow after approval (auth.md "Approval and
// landing"): the device polls its application, runs the same
// two-signature handshake through the applicant-token twins, claims the
// first session once landed, and uploads the pending key-backup blob —
// the blob waits on-device because before landing there is no actor to
// lose. Every step tolerates a lost response: `advance()` is safe to
// call repeatedly and continues from wherever the flow stopped.

package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.crypto.HandshakeException
import com.cogra.crypto.WireException
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import javax.inject.Inject

/** Where the applicant flow stands after one `advance()` pass. */
sealed interface RegistrationProgress {
    /** No applicant token on the device — nothing to advance. */
    data object NoApplication : RegistrationProgress

    /** The token authorizes nothing — expired or already consumed. */
    data object ApplicationGone : RegistrationProgress

    /** The email is not verified yet; the application can still expire. */
    data object AwaitingEmailVerification : RegistrationProgress

    /** Verified, waiting on the inviter's priced approval. */
    data object AwaitingApproval : RegistrationProgress

    /** Signed (or mid-seal); the Registration is on its way to landing. */
    data object AwaitingLanding : RegistrationProgress

    /** Landed and the first session is claimed; onboarding is complete. */
    data class SessionClaimed(val backupUploaded: Boolean) : RegistrationProgress

    /** The device refused to sign the sealed Registration. */
    data class RejectedByDevice(val reason: String) : RegistrationProgress

    /** The API refused a step. */
    data class Refused(val errors: List<UserError>) : RegistrationProgress

    /** Transport failed; call `advance()` again. */
    data class Failed(val cause: Exception) : RegistrationProgress
}

class RegistrationSigner @Inject constructor(
    private val onboarding: OnboardingRepository,
    private val writes: WriteRepository,
    private val identity: IdentityStore,
    private val tokens: TokenStore,
    private val account: AccountRepository,
) {
    /**
     * One pass over the flow: poll, sign whatever awaits a signature,
     * claim once landed. Idempotent from the caller's view — the next
     * pass continues wherever this one stopped.
     */
    suspend fun advance(deviceLabel: String?): RegistrationProgress {
        val token = identity.applicantToken() ?: return RegistrationProgress.NoApplication
        val status = when (val read = onboarding.application(token)) {
            is Outcome.Success -> read.value ?: return RegistrationProgress.ApplicationGone
            is Outcome.Refused -> return RegistrationProgress.Refused(read.errors)
            is Outcome.Failed -> return RegistrationProgress.Failed(read.cause)
        }
        return when {
            status.landedAt != null -> claim(token, deviceLabel)
            status.stagedRegistration != null -> signRegistration(token, status)
            !status.emailVerified -> RegistrationProgress.AwaitingEmailVerification
            else -> RegistrationProgress.AwaitingApproval
        }
    }

    private suspend fun signRegistration(token: String, status: ApplicationStatus): RegistrationProgress {
        val staged = checkNotNull(status.stagedRegistration)
        val seed = identity.actorSeed() ?: throw NoActorKeyException()
        val key = ActorKey.fromSeed(seed)
        return when (staged.state) {
            WriteState.AWAITING_PRE_SIGN -> {
                val step = try {
                    preSignStep(key, staged.canonicalProposal)
                } catch (e: WireException) {
                    return RegistrationProgress.RejectedByDevice(e.message ?: "malformed proposal")
                }
                identity.saveHandshake(staged.id, step.pre)
                when (val submitted = onboarding.submitRegistration(token, step.signatureBase64)) {
                    is Outcome.Success -> approve(token, key, submitted.value.id, submitted.value.verifiedAct)
                    is Outcome.Refused -> RegistrationProgress.Refused(submitted.errors)
                    is Outcome.Failed -> RegistrationProgress.Failed(submitted.cause)
                }
            }
            WriteState.AWAITING_APPROVAL -> approve(token, key, staged.id, staged.verifiedAct)
            // Mid-seal or already signed: landing is the server's move.
            WriteState.SEALING, WriteState.RELAYING, WriteState.LANDED ->
                RegistrationProgress.AwaitingLanding
            // The staging expired; the next poll serves the automatic
            // re-stage (api-spec: "re-staged automatically").
            WriteState.EXPIRED -> {
                identity.clearHandshake(staged.id)
                RegistrationProgress.AwaitingApproval
            }
        }
    }

    private suspend fun approve(
        token: String,
        key: ActorKey,
        stagedId: String,
        verifiedAct: ByteArray?,
    ): RegistrationProgress {
        if (verifiedAct == null) return RegistrationProgress.AwaitingLanding
        val pre = identity.handshake(stagedId)
            ?: return RegistrationProgress.Refused(
                listOf(UserError(ErrorCode.INTERNAL, "handshake material lost — awaiting re-stage")),
            )
        val host = when (val read = writes.hostPublicKey()) {
            is Outcome.Success -> read.value
            is Outcome.Refused -> return RegistrationProgress.Refused(read.errors)
            is Outcome.Failed -> return RegistrationProgress.Failed(read.cause)
        }
        val witnessSignature = try {
            approveStep(key, pre, verifiedAct, host)
        } catch (e: HandshakeException) {
            identity.clearHandshake(stagedId)
            return RegistrationProgress.RejectedByDevice(e.message ?: "verification failed")
        } catch (e: WireException) {
            identity.clearHandshake(stagedId)
            return RegistrationProgress.RejectedByDevice(e.message ?: "malformed verified act")
        }
        return when (val approved = onboarding.approveRegistration(token, witnessSignature)) {
            is Outcome.Success -> {
                identity.clearHandshake(stagedId)
                RegistrationProgress.AwaitingLanding
            }
            is Outcome.Refused -> RegistrationProgress.Refused(approved.errors)
            is Outcome.Failed -> RegistrationProgress.Failed(approved.cause)
        }
    }

    private suspend fun claim(token: String, deviceLabel: String?): RegistrationProgress {
        when (val claimed = onboarding.claimLandedSession(token, deviceLabel)) {
            is Outcome.Success -> tokens.save(claimed.value)
            is Outcome.Refused -> return RegistrationProgress.Refused(claimed.errors)
            is Outcome.Failed -> return RegistrationProgress.Failed(claimed.cause)
        }
        identity.clearApplicantToken()
        return RegistrationProgress.SessionClaimed(backupUploaded = uploadPendingBackup())
    }

    /**
     * Uploads the blob sealed at ceremony time, now that a landed
     * session exists. Failure keeps the blob for a later retry — the
     * claim itself is not rolled back.
     */
    suspend fun uploadPendingBackup(): Boolean {
        val blob = identity.pendingBackupBlob() ?: return true
        return when (account.uploadKeyBackup(blob)) {
            is Outcome.Success -> {
                identity.clearPendingBackupBlob()
                true
            }
            else -> false
        }
    }
}
