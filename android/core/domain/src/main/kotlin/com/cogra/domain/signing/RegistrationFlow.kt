// The app-scoped applicant flow. An applicant browses the read
// surfaces while the application advances (auth.md "Application":
// approval latency is a UX cost, not a wall), so the poll/sign loop
// cannot belong to any one screen: it runs here, above navigation.
// Auto-polling is an onboarding-only mechanism — the loop stops for
// good at membership; from then on every fetch is event-driven (a user
// action with an outcome to collect, or an explicit refresh).

package com.cogra.domain.signing

import com.cogra.domain.di.ApplicationScope
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * One poll/sign loop over [RegistrationSigner.advance], with a
 * stage-aware cadence: fast while the wait is on the server or this
 * device (landing, a staged write to sign, a transport retry), slow
 * while the wait is on a human (verification, approval, a fresh
 * invite). [ensureAdvancing] starts the loop or pokes a running one
 * into an immediate pass — call it on entry, on user actions that
 * change server state, and on a manual refresh. The loop ends at
 * [RegistrationProgress.Member] (and on a device rejection, which no
 * amount of polling repairs).
 */
@Singleton
class RegistrationFlow @Inject constructor(
    private val signer: RegistrationSigner,
    @ApplicationScope private val scope: CoroutineScope,
) {
    private val _progress = MutableStateFlow<RegistrationProgress?>(null)

    /** Null until the first pass of a loop reports. */
    val progress: StateFlow<RegistrationProgress?> = _progress.asStateFlow()

    /** Injectable for tests; the two cadences of the poll. */
    var fastDelayMs: Long = 3_000
    var slowDelayMs: Long = 30_000

    private val pokes = Channel<Unit>(Channel.CONFLATED)
    private var loop: Job? = null
    private var landed = false

    /**
     * Starts the loop unless one is already running; a running loop is
     * poked into an immediate pass instead of waiting out its delay.
     */
    fun ensureAdvancing() {
        if (loop?.isActive == true) {
            pokes.trySend(Unit)
            return
        }
        loop = scope.launch {
            var wasApplicant = false
            while (true) {
                val progress = signer.advance()
                _progress.value = progress
                when (progress) {
                    is RegistrationProgress.Member -> {
                        // The one-shot fires only on a landing this loop
                        // watched happen — a cold open as member greets
                        // nobody.
                        if (wasApplicant) landed = true
                        return@launch
                    }
                    is RegistrationProgress.RejectedByDevice -> return@launch
                    else -> wasApplicant = true
                }
                withTimeoutOrNull(delayFor(progress)) { pokes.receive() }
            }
        }
    }

    private fun delayFor(progress: RegistrationProgress): Long = when (progress) {
        is RegistrationProgress.AwaitingLanding,
        is RegistrationProgress.Failed,
        -> fastDelayMs
        else -> slowDelayMs
    }

    /**
     * True exactly once after a watched landing: the member shell
     * greets the new member on the strength of this, then the signal is
     * spent.
     */
    fun consumeLanded(): Boolean {
        val result = landed
        landed = false
        return result
    }
}
