// The on-device key ceremony (auth.md "Application" step 3), now a
// logged-in step: the device mints the actor key and L0 address, sends
// only the public halves through `attachActorKey` — approval funds a
// burn to the applicant's own address, so the address must exist before
// approval — and the backup offer rides the same step. The sealed blob
// uploads immediately after the attach; a failed upload parks it for a
// retried flush.

package com.cogra.domain.identity

import com.cogra.crypto.ActorKey
import com.cogra.crypto.KeyBackupException
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.RecoveryCodeLengthException
import com.cogra.crypto.openKeyBackup
import com.cogra.crypto.sealKeyBackup
import com.cogra.crypto.signUpload
import com.cogra.domain.Outcome
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import java.util.Base64
import javax.inject.Inject

/**
 * The signed upload both backup surfaces share (auth.md "Key
 * recovery"): take the server's challenge, prove possession of the
 * actor key over these exact bytes, upload. A session alone must not be
 * able to overwrite the blob.
 */
private suspend fun AccountRepository.uploadSigned(
    seed: ByteArray,
    blob: ByteArray,
): Outcome<Unit> = keyBackupChallenge().flatMap { challenge ->
    uploadKeyBackup(blob, challenge, signUpload(ActorKey.fromSeed(seed), challenge, blob))
}

/** The public outputs of the ceremony — what `attachActorKey` carries. */
data class ActorPublicIdentity(val publicKeyBase64: String, val l0Address: String)

class KeyCeremony @Inject constructor(
    private val identity: IdentityStore,
    private val onboarding: OnboardingRepository,
    private val account: AccountRepository,
) {

    /**
     * Generates and stores a fresh actor key, returning its public
     * outputs. Pre-approval only: overwrites any earlier unbound key —
     * the attached key is replaceable until approval binds the address.
     */
    suspend fun createActorKey(): ActorPublicIdentity {
        val key = ActorKey.generate()
        identity.saveActorSeed(key.seed())
        // A blob parked under the superseded key would never upload:
        // its proof verifies against the key the account now has.
        identity.clearPendingBackupBlob()
        return ActorPublicIdentity(
            publicKeyBase64 = Base64.getEncoder().encodeToString(key.publicKeyBytes()),
            l0Address = key.address(),
        )
    }

    /** The stored key's public outputs; null when no key exists. */
    suspend fun publicIdentity(): ActorPublicIdentity? = identity.actorSeed()?.let { seed ->
        val key = ActorKey.fromSeed(seed)
        ActorPublicIdentity(
            publicKeyBase64 = Base64.getEncoder().encodeToString(key.publicKeyBytes()),
            l0Address = key.address(),
        )
    }

    /**
     * The ceremony's server half: attaches the stored key's public
     * outputs to the viewer's account (the one approvability proof the
     * server cannot see otherwise).
     */
    suspend fun attachActorKey(): Outcome<Unit> {
        val public = checkNotNull(publicIdentity()) { "the ceremony creates the key first" }
        return onboarding.attachActorKey(public.publicKeyBase64, public.l0Address)
    }

    /**
     * The backup offer, accepted: seals the stored seed under a fresh
     * recovery code, parks the blob for [uploadPendingBackup], and
     * returns the code's display form — shown once, never stored.
     * Declining the offer is simply not calling this.
     */
    suspend fun createPendingBackup(): String {
        val seed = checkNotNull(identity.actorSeed()) { "the ceremony creates the key first" }
        val code = RecoveryCode.generate()
        identity.savePendingBackupBlob(sealKeyBackup(seed, code))
        return code.display()
    }

    /**
     * Uploads the parked blob — immediately after the attach, and
     * retried from the status poll while it stays parked. Failure keeps
     * the blob; true when nothing is pending.
     */
    suspend fun uploadPendingBackup(): Boolean {
        val blob = identity.pendingBackupBlob() ?: return true
        val seed = identity.actorSeed() ?: return false
        return when (account.uploadSigned(seed, blob)) {
            is Outcome.Success -> {
                identity.clearPendingBackupBlob()
                true
            }
            else -> false
        }
    }
}

/**
 * The backup settings surface, post-landing: enable late or replace the
 * code — a new code re-encrypts and re-uploads; recovery serves the
 * newest blob (auth.md "Key recovery").
 */
class BackupManager @Inject constructor(
    private val identity: IdentityStore,
    private val account: AccountRepository,
) {
    /** Returns the new code's display form on success. */
    suspend fun enableOrReplace(): Outcome<String> {
        val seed = identity.actorSeed()
            ?: return Outcome.Failed(IllegalStateException("no actor key on this device"))
        val code = RecoveryCode.generate()
        return account.uploadSigned(seed, sealKeyBackup(seed, code)).map { code.display() }
    }
}

/** How a restore attempt ended. */
sealed interface RestoreResult {
    /** The seed is on this device; the actor is restored. */
    data object Restored : RestoreResult

    /** The account has no uploaded backup. */
    data object NoBackup : RestoreResult

    /** The blob would not open — mistyped code (or a tampered blob). */
    data object WrongCode : RestoreResult

    /** The input is not a recovery code's length — characters missing. */
    data class MalformedCode(val reason: String) : RestoreResult

    data class Failed(val cause: Exception) : RestoreResult
}

/**
 * Key recovery / second-device mobility — one mechanism (auth.md "Key
 * recovery"): login gives the session, the code opens the blob.
 */
class ActorRestorer @Inject constructor(
    private val identity: IdentityStore,
    private val account: AccountRepository,
) {
    /**
     * [forgetOnSignOut] is the restore form's "don't remember me"
     * opt-in (auth.md "Sign-out"). Checked, it flags the account;
     * unchecked, it leaves the login-time choice standing — restore is
     * an extra chance to opt out, not a silent revocation.
     */
    suspend fun restore(codeInput: String, forgetOnSignOut: Boolean): RestoreResult {
        val code = try {
            RecoveryCode.fromInput(codeInput)
        } catch (e: RecoveryCodeLengthException) {
            return RestoreResult.MalformedCode(e.message ?: "invalid recovery code")
        } catch (e: KeyBackupException) {
            // A full-length code that will not decode is a wrong code,
            // which is what the GCM tag would have said anyway.
            return RestoreResult.WrongCode
        }
        val blob = when (val read = account.keyBackup()) {
            is Outcome.Success -> read.value ?: return RestoreResult.NoBackup
            is Outcome.Refused -> return RestoreResult.Failed(
                IllegalStateException("keyBackup refused: ${read.errors}"),
            )
            is Outcome.Failed -> return RestoreResult.Failed(read.cause)
        }
        val seed = try {
            openKeyBackup(blob, code)
        } catch (e: KeyBackupException) {
            return RestoreResult.WrongCode
        }
        identity.saveActorSeed(seed)
        if (forgetOnSignOut) identity.setForgetOnSignOut(true)
        return RestoreResult.Restored
    }
}

/**
 * The local half of ending a session, shared by sign-out and the
 * refresh machinery's reuse-detected token clear: purge the account's
 * identity material when it opted out of being remembered (auth.md
 * "Sign-out"), then forget the tokens — in that order, because the
 * purge needs the tokens to know which account's slot to clear.
 */
class EndLocalSession @Inject constructor(
    private val identity: IdentityStore,
    private val tokens: TokenStore,
) {
    suspend fun end() {
        if (identity.forgetOnSignOut()) identity.purge()
        tokens.clear()
    }
}

/**
 * Sign-out: revoke the current session server-side (best effort — a
 * dead network must not trap the user signed in) and forget the local
 * tokens. The actor key stays in its account's slot — signing out is
 * not losing the actor — unless the account opted into "don't remember
 * me", which purges its material.
 */
class SignOut @Inject constructor(
    private val sessions: SessionRepository,
    private val endLocalSession: EndLocalSession,
) {
    suspend fun signOut() {
        sessions.revokeSession(null)
        endLocalSession.end()
    }
}
