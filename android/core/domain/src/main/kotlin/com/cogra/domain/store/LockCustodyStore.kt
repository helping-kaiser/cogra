package com.cogra.domain.store

/** The device lock as the device holds it while the account is signed in (auth.md "Device lock"). */
class HeldLock(val id: String, val secret: ByteArray)

/**
 * The device lock's custody operations (sign-out-custody slice L2).
 *
 * A "don't remember" account keeps nothing usable on the device once its
 * session ends. With a backup, its key material is purged; without one, the
 * device holds the only copy of the key, so the account's custody set — its
 * whole identity slot, its draft and the draft's sealed copies — is LOCKED
 * instead: encrypted under a secret the server holds and releases only
 * behind the account's current password (seam 035 conditions 1-3).
 *
 * EVERY CALL NAMES ITS ACCOUNT. A lock runs while the session is ending,
 * after the tokens were cleared, and an unlock runs before the fresh session
 * is stored (sign-out-custody §3.5, "never through activeAccountId()") — the
 * one place the account-implicit [IdentityStore] shape cannot serve.
 *
 * Every change below is ONE atomic edit of the underlying store, so a process
 * death leaves a slot either before or after it, never between.
 *
 * One function per such edit: the protocols compose them, and folding two
 * into one would hide a step the packet names (TooManyFunctions, by design).
 */
@Suppress("TooManyFunctions")
interface LockCustodyStore {
    /** The account's "don't remember" flag, by name. */
    suspend fun forgetOnSignOut(account: String): Boolean

    /** The held lock (id + secret), or null — none issued, or locked (the secret goes at lock). */
    suspend fun heldLock(account: String): HeldLock?

    /** Holds a lock; answers the id it replaced, so the caller can discard that one's server half. */
    suspend fun holdLock(account: String, lock: HeldLock): String?

    /** The lock's id — while signed in and while locked alike. */
    suspend fun lockId(account: String): String?

    /** Forgets the lock locally, id and secret. Never touches a locked set. */
    suspend fun dropLock(account: String)

    suspend fun setLockPending(account: String, pending: Boolean)

    suspend fun isLockPending(account: String): Boolean

    /**
     * THE LOCK (sign-out-custody §3.5 LOCK steps 3-4), one edit: every custody
     * name of the account is read, encrypted under the held secret, written
     * as a locked record, and its plaintext removed, together with the secret
     * itself. Where the backup is positively known (the account's `backed`
     * flag) the key material — seed, pending blob, handshakes — is purged
     * rather than locked: it survives in its backup.
     *
     * Conditional: it locks only while the secret is held and no locked set
     * exists, and answers whether it did — so a second lock racing the first
     * never overwrites a locked set.
     */
    suspend fun lock(account: String): Boolean

    suspend fun isLocked(account: String): Boolean

    /**
     * THE UNLOCK, one edit: every locked record opened under [secret] and put
     * back, the locked records removed. All or nothing: a record that will not
     * open leaves everything as it was and answers false.
     */
    suspend fun unlock(account: String, secret: ByteArray): Boolean

    /**
     * DELETES A LOCKED SET THE SERVER CAN NO LONGER OPEN — the one deletion of
     * locked material there is (PR-62: complete the sign-in, delete the dead
     * ciphertext, say so once). The lock's id and pending mark go with it.
     */
    suspend fun deleteDeadLockedSet(account: String)

    /**
     * Purges the key material of a slot whose backup is positively known, and
     * nothing else — decided inside the edit by the `backed` flag, so an
     * unbacked key is never what this removes.
     */
    suspend fun purgeBackedKeyMaterial(account: String)

    /**
     * Removes a plaintext draft (and sealed copies) that a LOCKED slot left
     * behind — a write that landed after the lock. A slot that is not locked
     * keeps its draft.
     */
    suspend fun removeLeftoverDraft(account: String)

    /** Every account whose slot is locked or holds an unfinished lock. */
    suspend fun lockSlots(): Set<String>
}
