// One pass over the applicant flow (auth.md "Application", "Approval
// and landing"): read the me-driven status, repair whatever this device
// can repair — a minted-but-unattached key, a parked backup blob — and
// sign the staged Registration the moment it appears, through the same
// session-authorized legs as any other write. Every step tolerates a
// lost response: `advance()` is safe to call repeatedly and continues
// from wherever the flow stopped.

package com.cogra.domain.signing

import com.cogra.domain.AccountState
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.store.IdentityStore
import java.time.Instant
import javax.inject.Inject

/** Where the applicant flow stands after one `advance()` pass. */
sealed interface RegistrationProgress {
    /**
     * Unapproved, with the two approvability proofs as the server sees
     * them; [keyOnDevice] distinguishes "run the ceremony here" from
     * "the key lives on another device".
     */
    data class AwaitingApproval(
        val emailVerified: Boolean,
        val keyAttached: Boolean,
        val keyOnDevice: Boolean,
    ) : RegistrationProgress

    /** Approved and signed (or mid-seal); landing is the server's move. */
    data object AwaitingLanding : RegistrationProgress

    /** The staged Registration awaits a signature this device cannot make. */
    data object AwaitingSigningKey : RegistrationProgress

    /** No live application — expired unapproved, or reaped. A fresh invite re-arms. */
    data object NeedsInvite : RegistrationProgress

    /** Landed: the account is a member; onboarding is over. */
    data object Member : RegistrationProgress

    /** The device refused to sign the sealed Registration. */
    data class RejectedByDevice(val reason: String) : RegistrationProgress

    /** The API refused a step. */
    data class Refused(val errors: List<UserError>) : RegistrationProgress

    /** Transport failed; call `advance()` again. */
    data class Failed(val cause: Exception) : RegistrationProgress
}

class RegistrationSigner @Inject constructor(
    private val onboarding: OnboardingRepository,
    private val writeSigner: WriteSigner,
    private val identity: IdentityStore,
    private val ceremony: KeyCeremony,
) {
    /**
     * One pass over the flow: poll, repair, sign whatever awaits a
     * signature. Idempotent from the caller's view — the next pass
     * continues wherever this one stopped.
     */
    suspend fun advance(): RegistrationProgress {
        val status = when (val read = onboarding.applicationStatus()) {
            is Outcome.Success -> read.value
            is Outcome.Refused -> return RegistrationProgress.Refused(read.errors)
            is Outcome.Failed -> return RegistrationProgress.Failed(read.cause)
        }
        // A session exists from registration on, so a parked blob never
        // waits on a milestone — flush it on every pass until it lands.
        ceremony.uploadPendingBackup()
        if (status.accountState == AccountState.MEMBER) return RegistrationProgress.Member
        val staged = status.stagedRegistration
        if (staged != null) {
            if (identity.actorSeed() == null) return RegistrationProgress.AwaitingSigningKey
            return when (val result = writeSigner.signStaged(staged)) {
                is WriteResult.Done, is WriteResult.AwaitingSeal -> RegistrationProgress.AwaitingLanding
                is WriteResult.Refused -> RegistrationProgress.Refused(result.errors)
                is WriteResult.RejectedByDevice -> RegistrationProgress.RejectedByDevice(result.reason)
                is WriteResult.Failed -> RegistrationProgress.Failed(result.cause)
            }
        }
        val application = status.application ?: return RegistrationProgress.NeedsInvite
        if (application.approvedAt != null) return RegistrationProgress.AwaitingLanding
        if (application.expiresAt.isBefore(Instant.now())) return RegistrationProgress.NeedsInvite
        return RegistrationProgress.AwaitingApproval(
            emailVerified = application.emailVerified,
            keyAttached = application.keyAttached || repairAttach(),
            keyOnDevice = identity.actorSeed() != null,
        )
    }

    /**
     * Crash healing for the gap between minting and attaching: a key
     * that exists only on this device is re-attached silently. False
     * when there is nothing to repair or the attach did not land.
     */
    private suspend fun repairAttach(): Boolean {
        if (identity.actorSeed() == null) return false
        return ceremony.attachActorKey() is Outcome.Success
    }
}
