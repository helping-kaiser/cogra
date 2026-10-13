// The in-memory hand-off for the login's one-time notices: the backend
// delivers the reuse event exactly once on the LogInPayload, and login
// navigates away immediately, so the app shell renders the notices from
// this holder rather than the login surface. Process death before
// rendering loses them — the accepted narrow-carrier trade-off (auth.md).
//
// Two notices ride it:
// - the refresh-token reuse notice (auth.md "Reuse detection");
// - the dead device lock (sign-out-custody SC-G2, ruled PR-62): the sign-in
//   found this account's custody locked on this device, the server could no
//   longer open the lock, and the locked copy was deleted — said once,
//   rather than the key going without a word ("Never erase silently").

package com.cogra.domain.identity

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecurityNotices @Inject constructor() {

    private val _reuseDetectedAt = MutableStateFlow<Instant?>(null)

    /** The pending notice; null once dismissed or when none arrived. */
    val reuseDetectedAt: StateFlow<Instant?> = _reuseDetectedAt.asStateFlow()

    private val _lockLost = MutableStateFlow(false)

    /** Whether a dead device lock's notice waits to be said. */
    val lockLost: StateFlow<Boolean> = _lockLost.asStateFlow()

    fun post(detectedAt: Instant) {
        _reuseDetectedAt.value = detectedAt
    }

    fun dismiss() {
        _reuseDetectedAt.value = null
    }

    fun postLockLost() {
        _lockLost.value = true
    }

    fun dismissLockLost() {
        _lockLost.value = false
    }
}
