// The app-scoped applicant flow. An applicant browses the read
// surfaces while the application advances (auth.md "Application":
// approval latency is a UX cost, not a wall), so the poll/sign loop
// cannot belong to any one screen: it runs here, above navigation.
// Auto-polling is an onboarding-only mechanism — the loop stops for
// good at membership; from then on every fetch is event-driven (a user
// action with an outcome to collect, or an explicit refresh). The loop
// is also session-bound: the end of the session that started it — or a
// switch to another account — stops it and resets the flow's state, so
// a signed-out device never polls and a new session starts clean.

package com.cogra.domain.signing

import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.store.TokenStore
import java.util.concurrent.atomic.AtomicBoolean
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
 * amount of polling repairs) — and with its session: watching the
 * token store, the flow cancels the loop and drops its state the
 * moment the session ends or changes account, so nothing outlives the
 * account it belongs to. A refusal keeps the loop alive — transient
 * refusals (a rate limit) self-heal on a later pass, and the one that
 * cannot (the ended session's UNAUTHENTICATED) is exactly what the
 * session watch cancels.
 */
@Singleton
class RegistrationFlow(
    private val signer: RegistrationSigner,
    private val scope: CoroutineScope,
    tokens: TokenStore,
    private val fastDelayMs: Long = 3_000,
    private val slowDelayMs: Long = 30_000,
) {
    @Inject constructor(
        signer: RegistrationSigner,
        @ApplicationScope scope: CoroutineScope,
        tokens: TokenStore,
    ) : this(signer, scope, tokens, fastDelayMs = 3_000, slowDelayMs = 30_000)

    private val _progress = MutableStateFlow<RegistrationProgress?>(null)

    /** Null until the first pass of a loop reports. */
    val progress: StateFlow<RegistrationProgress?> = _progress.asStateFlow()

    private val pokes = Channel<Unit>(Channel.CONFLATED)
    private var loop: Job? = null
    private val landed = AtomicBoolean(false)

    init {
        // Session end and account switch reset the flow. Signing IN
        // never resets: a loop can only have been started by the new
        // session's own surfaces, and every switch passes through the
        // sign-out (or reuse-detected) token clear first.
        scope.launch {
            var current: String? = null
            tokens.tokens.collect { pair ->
                val previous = current
                current = pair?.accountId
                if (previous != null && current != previous) reset()
            }
        }
    }

    /**
     * Starts the loop unless one is already running; a running loop is
     * poked into an immediate pass instead of waiting out its delay.
     */
    @Synchronized
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
                        if (wasApplicant) landed.set(true)
                        return@launch
                    }
                    is RegistrationProgress.RejectedByDevice -> return@launch
                    else -> wasApplicant = true
                }
                withTimeoutOrNull(delayFor(progress)) { pokes.receive() }
            }
        }
    }

    @Synchronized
    private fun reset() {
        loop?.cancel()
        loop = null
        pokes.tryReceive()
        _progress.value = null
        landed.set(false)
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
    fun consumeLanded(): Boolean = landed.getAndSet(false)
}
