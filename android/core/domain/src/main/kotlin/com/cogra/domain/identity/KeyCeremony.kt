// The on-device key ceremony (auth.md "Application" step 3), now a
// logged-in step: the device mints the actor key and address, sends
// only the public halves through `attachActorKey` — approval funds an
// admission burn to the applicant's own address, so the address must exist before
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
import com.cogra.domain.store.DeviceData
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.LockCustodyStore
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
data class ActorPublicIdentity(val publicKeyBase64: String, val realizationAddress: String)

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
        // A fresh key has no backup until one uploads (the device lock reads
        // this flag as "backup positively known", sign-out-custody §3.2).
        identity.setKeyBacked(false)
        // A blob parked under the superseded key would never upload:
        // its proof verifies against the key the account now has.
        identity.clearPendingBackupBlob()
        return ActorPublicIdentity(
            publicKeyBase64 = Base64.getEncoder().encodeToString(key.publicKeyBytes()),
            realizationAddress = key.address(),
        )
    }

    /** The stored key's public outputs; null when no key exists. */
    suspend fun publicIdentity(): ActorPublicIdentity? = identity.actorSeed()?.let { seed ->
        val key = ActorKey.fromSeed(seed)
        ActorPublicIdentity(
            publicKeyBase64 = Base64.getEncoder().encodeToString(key.publicKeyBytes()),
            realizationAddress = key.address(),
        )
    }

    /**
     * The ceremony's server half: attaches the stored key's public
     * outputs to the viewer's account (the one approvability proof the
     * server cannot see otherwise).
     */
    suspend fun attachActorKey(): Outcome<Unit> {
        val public = checkNotNull(publicIdentity()) { "the ceremony creates the key first" }
        return onboarding.attachActorKey(public.publicKeyBase64, public.realizationAddress)
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
                identity.setKeyBacked(true)
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
        return account.uploadSigned(seed, sealKeyBackup(seed, code)).map {
            identity.setKeyBacked(true)
            code.display()
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
    private val tokens: TokenStore,
    private val deviceLock: DeviceLock,
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
        // Restored from the backup: the backup is positively known.
        identity.setKeyBacked(true)
        if (forgetOnSignOut) {
            identity.setForgetOnSignOut(true)
            // The opt-in's lock (sign-out-custody §3.4). Best effort here —
            // the restore is already signed in, and a lock that did not
            // arrive is retried at the next start.
            tokens.current()?.accountId?.let { deviceLock.ensureHeld(it) }
        }
        return RestoreResult.Restored
    }
}

/**
 * The local half of a session ended from ELSEWHERE — the refresh
 * machinery's token clear (`REFRESH_TOKEN_INVALID`: sign out everywhere
 * else, a password changed or reset, a reused token caught). It never
 * asks, and it never purges an only copy (sign-out-custody §3.2, §3.6;
 * SignOutConfirm.md:23):
 * - a remembered account: the tokens go, nothing else;
 * - a "don't remember" account holding its device lock: the custody set
 *   is LOCKED — the key, the draft and its sealed copies, unusable until
 *   this account signs in here again, online, with its current password
 *   (a backed key is purged instead, as it survives in its backup);
 * - a "don't remember" account that never obtained its lock (PR-61's
 *   residual): the material is KEPT, refused by the app until the next
 *   sign-in — NEVER destroyed. A backed key is still purged.
 *
 * The account is read before anything clears, because every step names it.
 */
class EndLocalSession @Inject constructor(
    private val custody: LockCustodyStore,
    private val tokens: TokenStore,
) {
    suspend fun end(): LocalSessionEnd {
        val account = tokens.current()?.accountId
        if (account == null || !custody.forgetOnSignOut(account)) {
            tokens.clear()
            return LocalSessionEnd.KEPT
        }
        if (custody.heldLock(account) != null) {
            lockHeld(custody, tokens, account)
            return LocalSessionEnd.LOCKED
        }
        tokens.clear()
        custody.purgeBackedKeyMaterial(account)
        return LocalSessionEnd.REFUSED
    }
}

/**
 * The explicit sign-out (Settings.md "Sign out"): revoke the current
 * session server-side (best effort — a dead network must not trap the
 * reader signed in), then end it locally. The actor key stays in its
 * account's slot — signing out is not losing the actor — unless the
 * account opted into "don't remember me", which clears the account's
 * whole custody set: the key, the draft and every other piece of its
 * slot, in one edit.
 *
 * Whether a forgetting sign-out may run without asking first — the only
 * copy of an unbacked key — is the caller's question (SignOutConfirm);
 * by the time this runs, the reader has answered it.
 */
class SignOut @Inject constructor(
    private val sessions: SessionRepository,
    private val identity: IdentityStore,
    private val tokens: TokenStore,
    private val device: DeviceData,
    private val deviceLock: DeviceLock,
) {
    suspend fun signOut() {
        val forget = identity.forgetOnSignOut()
        // The opt-in's lock ends with the slot it guarded (sign-out-custody
        // §3.3): its server half discarded while a session still names it.
        if (forget) discardLock()
        sessions.revokeSession(null)
        if (forget) identity.purgeCustodySet()
        tokens.clear()
    }

    private suspend fun discardLock() {
        tokens.current()?.accountId?.let { deviceLock.discard(it) }
    }

    /**
     * Erase everything from this app (EraseConfirm.md:21), the answer the
     * dialog asked for: the session is revoked first — best effort, while a
     * token still names it — then everything on this device goes in one
     * edit ([DeviceData]), every account's custody set, the device's
     * choices and the seen record with its watermark among it, so the shell
     * lands on sign-in with nothing remembered. It touches no other wire.
     */
    suspend fun eraseEverything() {
        // The erase gains one step (sign-out-custody §3.5 ERASE): the lock's
        // server half goes first, while a session still exists to name it.
        discardLock()
        sessions.revokeSession(null)
        device.eraseEverything()
        // Already gone with the rest; said again so a wipe that failed
        // still ends the session.
        tokens.clear()
    }
}
