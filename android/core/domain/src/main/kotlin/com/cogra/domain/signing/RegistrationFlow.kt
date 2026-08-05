// The app-scoped applicant flow. A staged applicant browses the read
// surfaces while the application advances (auth.md "Application": a
// staged applicant can already read — approval latency is a UX cost,
// not a wall), so the poll/sign loop cannot belong to any one screen:
// it runs here, above navigation, and keeps signing and claiming no
// matter where the user is.

package com.cogra.domain.signing

import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.di.DeviceLabel
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * One poll/sign loop over [RegistrationSigner.advance]: polls the
 * application, signs the staged Registration the moment it appears,
 * claims the first session once landed — `advance()` is idempotent, so
 * the loop just keeps calling it (auth.md "Approval and landing").
 * Claiming flips the token store and the app's auth-state navigation
 * takes over. Screens observe [progress]; the loop ends on a terminal
 * state and [ensureAdvancing] restarts it for a later application.
 */
@Singleton
class RegistrationFlow @Inject constructor(
    private val signer: RegistrationSigner,
    @ApplicationScope private val scope: CoroutineScope,
    @DeviceLabel private val deviceLabel: String?,
) {
    private val _progress = MutableStateFlow<RegistrationProgress?>(null)

    /** Null until the first pass of a loop reports. */
    val progress: StateFlow<RegistrationProgress?> = _progress.asStateFlow()

    /** Injectable for tests; the applicant poll cadence. */
    var pollDelayMs: Long = 3_000

    private var loop: Job? = null

    /** Starts the loop unless one is already running. */
    fun ensureAdvancing() {
        if (loop?.isActive == true) return
        loop = scope.launch {
            while (true) {
                val progress = signer.advance(deviceLabel)
                _progress.value = progress
                if (progress is RegistrationProgress.SessionClaimed ||
                    progress is RegistrationProgress.NoApplication
                ) {
                    break
                }
                delay(pollDelayMs)
            }
        }
    }

    /**
     * True exactly once after a claim: the member shell greets the new
     * member on the strength of this, then the terminal state is spent.
     */
    fun consumeClaimed(): Boolean {
        val claimed = _progress.value is RegistrationProgress.SessionClaimed
        if (claimed) {
            _progress.value = null
        }
        return claimed
    }
}
