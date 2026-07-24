// The on-device key ceremony (auth.md "Application" step 3): the actor
// key and L0 address are generated before the application submit —
// approval funds a burn to the applicant's own address, so the address
// must exist first. The backup offer rides the same step; the sealed
// blob waits on-device and uploads on the first session after landing.
// The recovery code is returned for display exactly once and never
// stored (auth.md "Key recovery").

package com.cogra.domain.identity

import com.cogra.crypto.ActorKey
import com.cogra.crypto.KeyBackupException
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.openKeyBackup
import com.cogra.crypto.sealKeyBackup
import com.cogra.domain.Outcome
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import java.util.Base64
import javax.inject.Inject

/** The public outputs of the ceremony — what rides the application submit. */
data class ActorPublicIdentity(val publicKeyBase64: String, val l0Address: String)

class KeyCeremony @Inject constructor(private val identity: IdentityStore) {

    /**
     * Generates and stores a fresh actor key, returning its public
     * outputs. Pre-submit only: overwrites any earlier unlanded key.
     */
    suspend fun createActorKey(): ActorPublicIdentity {
        val key = ActorKey.generate()
        identity.saveActorSeed(key.seed())
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
     * The backup offer, accepted: seals the stored seed under a fresh
     * recovery code, parks the blob for the first-session upload, and
     * returns the code's display form — shown once, never stored.
     * Declining the offer is simply not calling this.
     */
    suspend fun createPendingBackup(): String {
        val seed = checkNotNull(identity.actorSeed()) { "the ceremony creates the key first" }
        val code = RecoveryCode.generate()
        identity.savePendingBackupBlob(sealKeyBackup(seed, code))
        return code.display()
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
        return when (val uploaded = account.uploadKeyBackup(sealKeyBackup(seed, code))) {
            is Outcome.Success -> Outcome.Success(code.display())
            is Outcome.Refused -> uploaded
            is Outcome.Failed -> uploaded
        }
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

    /** The input is not a recovery code at all. */
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
    suspend fun restore(codeInput: String): RestoreResult {
        val code = try {
            RecoveryCode.fromInput(codeInput)
        } catch (e: KeyBackupException) {
            return RestoreResult.MalformedCode(e.message ?: "invalid recovery code")
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
        return RestoreResult.Restored
    }
}

/**
 * Sign-out: revoke the current session server-side (best effort — a
 * dead network must not trap the user signed in) and forget the local
 * tokens. The actor key stays: signing out is not losing the actor.
 */
class SignOut @Inject constructor(
    private val sessions: SessionRepository,
    private val tokens: TokenStore,
) {
    suspend fun signOut() {
        sessions.revokeSession(null)
        tokens.clear()
    }
}
