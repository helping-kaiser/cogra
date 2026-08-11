// The in-memory hand-off for the login security notice (auth.md "Reuse
// detection"): the backend delivers the event exactly once on the
// LogInPayload, and login navigates away immediately, so the app shell
// renders it from this holder rather than the login surface. Process
// death before rendering loses the notice — the accepted narrow-carrier
// trade-off (auth.md).

package com.cogra.domain.identity

import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

@Singleton
class SecurityNotices @Inject constructor() {

    private val _reuseDetectedAt = MutableStateFlow<Instant?>(null)

    /** The pending notice; null once dismissed or when none arrived. */
    val reuseDetectedAt: StateFlow<Instant?> = _reuseDetectedAt.asStateFlow()

    fun post(detectedAt: Instant) {
        _reuseDetectedAt.value = detectedAt
    }

    fun dismiss() {
        _reuseDetectedAt.value = null
    }
}
