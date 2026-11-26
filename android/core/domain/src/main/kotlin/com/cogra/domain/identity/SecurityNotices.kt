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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecurityNotices @Inject constructor(
    private val identity: IdentityStore,
    private val tokens: TokenStore,
) {

    /** The active account's pending notice; null once dismissed, when none arrived, or signed out. */
    val reuseDetectedAt: Flow<Instant?> = identity.securityNotice

    /** The account whose dead lock waits to be said. */
    private val lockLostFor = MutableStateFlow<String?>(null)

    /** Whether a dead device lock's notice waits to be said to the active account. */
    val lockLost: Flow<Boolean> =
        combine(lockLostFor, tokens.tokens) { owner, pair -> owner != null && owner == pair?.accountId }

    /** Keeps [detectedAt] for [account], the account the sign-in belongs to. */
    suspend fun post(detectedAt: Instant, account: String) {
        identity.keepSecurityNotice(account, detectedAt)
    }

    /** `Got it`: the active account's notice goes for good. */
    suspend fun dismiss() {
        identity.dropSecurityNotice()
    }

    /** Holds the dead lock's notice for [account], the account whose lock it was. */
    fun postLockLost(account: String) {
        lockLostFor.value = account
    }

    /** `Got it`: the active account's dead-lock notice goes; another account's stays held. */
    suspend fun dismissLockLost() {
        val active = tokens.current()?.accountId
        lockLostFor.compareAndSet(active, null)
    }
}
