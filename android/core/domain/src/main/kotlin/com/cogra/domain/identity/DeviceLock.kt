// THE DEVICE LOCK ENGINE (sign-out-custody slice L2; auth.md "Device lock").
//
// The protocols, by the packet's numbering (§3.4-§3.6):
// - HOLD: a forget-on account holds a lock (id + secret, inside the
//   Keystore-wrapped store) while signed in, because neither a session ended
//   elsewhere nor an offline sign-out can fetch one when it is needed.
// - LOCK: mark the slot pending, clear the tokens (so nothing writes the
//   account's custody again), lock the custody set in ONE edit, clear the
//   pending mark.
// - END LOCAL SESSION (a session ended elsewhere, [EndLocalSession]): forget
//   off → nothing; a lock held → lock (a backed key purged, the rest locked);
//   no lock held → PR-61's residual. Never asks.
// - UNLOCK (the sign-in's leg, [signIn]): release the secret with the fresh
//   session's token and the password still in hand, put everything back —
//   before the tokens are stored, so no signed-in screen reads a locked slot.
// - RECOVER (every start): finish a lock a process death interrupted, remove
//   a plaintext draft a locked slot left behind.
//
// THE TWO RULED BRANCHES (seam 179 item 3):
// - PR-61 (SC-G1): a forget-on sign-in refuses to complete until the lock is
//   held ([signIn] is not `ready`); a session ended elsewhere on a slot that
//   still holds no lock KEEPS its material — refused by the app (no custody
//   read resolves to a signed-out account), NEVER destroyed.
// - PR-62 (SC-G2): a lock the server can no longer open completes the
//   sign-in, deletes the dead ciphertext, and reports it once.

package com.cogra.domain.identity

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.has
import com.cogra.domain.repo.DeviceLockRepository
import com.cogra.domain.store.HeldLock
import com.cogra.domain.store.LockCustodyStore
import com.cogra.domain.store.TokenStore
import javax.inject.Inject

/** What a session ended elsewhere did to the account's custody. */
enum class LocalSessionEnd {
    /** Not a "don't remember" account: nothing changed. */
    KEPT,

    /** The custody set is locked (key material purged first where a backup is known). */
    LOCKED,

    /** No lock was held (PR-61's residual): everything stays, refused until the next sign-in. */
    REFUSED,
}

/**
 * The sign-in leg's answer. Not [ready] keeps the fresh session for a retry
 * without a second login; [lockLost] is PR-62's dead lock — it happens once,
 * so it must be said once, even when a later press completes the sign-in.
 */
data class SignInLeg(val ready: Boolean, val lockLost: Boolean)

/**
 * The lock procedure both ends share — the explicit answer and the session
 * ended elsewhere. Steps 1-2 mark the slot and clear the tokens BEFORE the
 * custody is read, so no write for the account can land after the read.
 */
internal suspend fun lockHeld(custody: LockCustodyStore, tokens: TokenStore, account: String) {
    custody.setLockPending(account, true)
    tokens.clear()
    custody.lock(account)
    if (custody.isLocked(account)) custody.removeLeftoverDraft(account)
    custody.setLockPending(account, false)
}

class DeviceLock @Inject constructor(
    private val custody: LockCustodyStore,
    private val tokens: TokenStore,
    private val locks: DeviceLockRepository,
) {

    /** HOLD (§3.4): a forget-on slot obtains a lock unless it holds one. True once one is held. */
    suspend fun ensureHeld(account: String, accessToken: String? = null): Boolean {
        if (custody.heldLock(account) != null) return true
        // A locked slot is never re-keyed: a fresh lock there would leave the
        // locked set with no id to release it by.
        if (custody.isLocked(account)) return false
        val issued = locks.issue(accessToken) as? Outcome.Success ?: return false
        val replaced = custody.holdLock(account, HeldLock(issued.value.id, issued.value.secret))
        replaced?.let { discardServerHalf(it, accessToken) }
        return true
    }

    /**
     * The Settings switch's half (§3.4, Settings.md:119): turned on, the
     * signed-in account obtains its lock; turned off, it discards it. Best
     * effort behind a switch that already flipped — a hold that did not land
     * is retried at the next start ([retryHoldOnStart]).
     */
    suspend fun followForgetSwitch(on: Boolean) {
        val account = tokens.current()?.accountId ?: return
        if (on) ensureHeld(account) else discard(account)
    }

    /** HOLD's fourth reconcile point: a signed-in forget-on start that holds no lock asks again. */
    suspend fun retryHoldOnStart() {
        val account = tokens.current()?.accountId ?: return
        if (custody.forgetOnSignOut(account)) ensureHeld(account)
    }

    /** Ends the opt-in: the server half discarded (best effort), the local half dropped. */
    suspend fun discard(account: String, accessToken: String? = null) {
        val id = custody.lockId(account) ?: return
        // NEVER while locked: the server half is then the only way back to
        // the locked set, and discarding it would erase the key.
        if (custody.isLocked(account)) return
        custody.dropLock(account)
        discardServerHalf(id, accessToken)
    }

    /**
     * LOCK (§3.5), the explicit answer's procedure — offline by construction:
     * the secret is already held. False when none is held: the tokens are
     * cleared and nothing else changes.
     */
    suspend fun lock(account: String): Boolean {
        if (custody.heldLock(account) == null) {
            tokens.clear()
            return false
        }
        lockHeld(custody, tokens, account)
        return true
    }

    /**
     * The whole sign-in leg, run with the fresh session in hand and BEFORE its
     * tokens are stored: unlock, then the opt-in's lock — re-held or obtained
     * when [forget] is ticked (PR-61: [SignInLeg.ready] only once one is
     * held), discarded when it is not.
     */
    suspend fun signIn(account: String, password: String, accessToken: String, forget: Boolean): SignInLeg {
        val unlocked = unlock(account, password, accessToken) ?: return SignInLeg(ready = false, lockLost = false)
        val lockLost = unlocked == Unlocked.DEAD
        val ready = when {
            // The released lock stays this slot's lock: held again, never re-minted.
            unlocked == Unlocked.OPENED && forget -> true
            forget -> ensureHeld(account, accessToken)
            else -> {
                discard(account, accessToken)
                true
            }
        }
        return SignInLeg(ready, lockLost)
    }

    private enum class Unlocked { NONE, OPENED, DEAD }

    /** UNLOCK (§3.5); null when no answer settled anything — keep the session and retry. */
    private suspend fun unlock(account: String, password: String, accessToken: String): Unlocked? {
        if (!custody.isLocked(account)) return Unlocked.NONE
        val id = custody.lockId(account) ?: return dead(account)
        return when (val released = locks.release(id, password, accessToken)) {
            is Outcome.Success -> {
                // The secret goes back into custody as this slot's held lock
                // only when the unlock lands; a set that will not open under
                // the server's own secret can never open again.
                if (!custody.unlock(account, released.value)) return dead(account)
                custody.holdLock(account, HeldLock(id, released.value))
                Unlocked.OPENED
            }
            is Outcome.Refused -> if (released.has(ErrorCode.NOT_FOUND)) dead(account) else null
            is Outcome.Failed -> null
        }
    }

    private suspend fun dead(account: String): Unlocked {
        custody.deleteDeadLockedSet(account)
        return Unlocked.DEAD
    }

    /** RECOVER: interrupted locks finished, leftover plaintext drafts of locked slots removed. */
    suspend fun recover() {
        for (account in custody.lockSlots()) {
            // The pending mark is written while the secret is held, and the
            // secret goes only in the lock's own edit — so a pending slot that
            // is not locked still holds it, and the lock finishes with it.
            if (custody.isLockPending(account) && !custody.isLocked(account)) custody.lock(account)
            if (custody.isLocked(account)) custody.removeLeftoverDraft(account)
            custody.setLockPending(account, false)
        }
    }

    private suspend fun discardServerHalf(id: String, accessToken: String?) {
        // Best effort: an orphaned row opens nothing without this device's
        // ciphertext, and it dies with the account.
        locks.discard(id, accessToken)
    }
}
