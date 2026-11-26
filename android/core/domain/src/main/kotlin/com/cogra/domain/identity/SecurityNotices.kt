// The login's one-time notices, handed from the sign-in to the signed-in
// shell: login navigates away the moment the tokens land, so the shell
// renders them from this holder rather than the login surface.
//
// Two notices ride it:
// - the refresh-token reuse notice (auth.md "Reuse detection",
//   FeedSecurityNotice.md). It is KEPT ON THIS DEVICE in the account's own
//   slot of the identity store, written before the token save, so it stands
//   through leaving the feed and an app restart until `Got it` removes it
//   (FeedSecurityNotice.md:17), and a process death between the sign-in and
//   the first frame does not lose it. It shows only while its own account is
//   the active one — a device-local flag bound to its account, hidden under
//   another, never erased by a switch (auth.md "Multi-account device
//   custody") — and goes with the slot in a forgetting sign-out's purge.
// - the dead device lock (sign-out-custody SC-G2, ruled PR-62): the sign-in
//   found this account's custody locked on this device, the server could no
//   longer open the lock, and the locked copy was deleted — said once,
//   rather than the key going without a word ("Never erase silently"). It
//   lives in memory only, held for the account whose lock it was, and shows
//   only while that account is the active one — the same binding as the
//   reuse notice, so another account signing in here is never told its lock
//   was lost.

package com.cogra.domain.identity

import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecurityNotices @Inject constructor(
    private val identity: IdentityStore,
    private val tokens: TokenStore,
) {

    // A STORE THAT CANNOT WRITE BLOCKS NOTHING (the web's memory fallback,
    // `safe-storage.ts`): a notice the store could not keep is held here for
    // the process's life, by account, and a `Got it` the store could not
    // record hides the kept one for the process's life — the sign-in goes on
    // either way, and the notice is never lost to a write fault.
    private val unkept = MutableStateFlow<Map<String, Instant>>(emptyMap())
    private val dismissedHere = MutableStateFlow<Set<String>>(emptySet())

    /** The active account's pending notice; null once dismissed, when none arrived, or signed out. */
    val reuseDetectedAt: Flow<Instant?> =
        combine(identity.securityNotice.catch { emit(null) }, unkept, dismissedHere, tokens.tokens) {
                kept, held, dismissed, pair ->
            pair?.accountId?.takeUnless { it in dismissed }?.let { account -> kept ?: held[account] }
        }

    /** Every account whose dead lock waits to be said — each is told once (auth.md "Device lock"). */
    private val lockLostFor = MutableStateFlow<Set<String>>(emptySet())

    /** Whether a dead device lock's notice waits to be said to the active account. */
    val lockLost: Flow<Boolean> =
        combine(lockLostFor, tokens.tokens) { owners, pair -> pair?.accountId?.let { it in owners } == true }

    /** Keeps [detectedAt] for [account], the account the sign-in belongs to. Never throws. */
    suspend fun post(detectedAt: Instant, account: String) {
        dismissedHere.update { it - account }
        attempt { identity.keepSecurityNotice(account, detectedAt) }
            ?: unkept.update { it + (account to detectedAt) }
    }

    /** `Got it`: the active account's notice goes for good. Never throws. */
    suspend fun dismiss() {
        val account = tokens.current()?.accountId ?: return
        unkept.update { it - account }
        attempt { identity.dropSecurityNotice() } ?: dismissedHere.update { it + account }
    }

    /** Holds the dead lock's notice for [account], the account whose lock it was. */
    fun postLockLost(account: String) {
        lockLostFor.update { it + account }
    }

    /** `Got it`: the active account's dead-lock notice goes; another account's stays held. */
    suspend fun dismissLockLost() {
        val active = tokens.current()?.accountId ?: return
        lockLostFor.update { it - active }
    }

    /** [write]'s Unit, or null where the store failed it; a cancellation still cancels. */
    private suspend fun attempt(write: suspend () -> Unit): Unit? =
        runCatching { write() }.onFailure { if (it is CancellationException) throw it }.getOrNull()
}
