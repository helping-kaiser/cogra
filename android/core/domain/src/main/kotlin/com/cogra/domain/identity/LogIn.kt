// Login — the L2 half of auth (auth.md "Tokens"): a successful pair is
// stored once the device lock's leg has finished; auth-state navigation
// observes the token store.
//
// THE DEVICE LOCK'S LEG RIDES INSIDE THE PRESS (sign-out-custody §3.5). The
// fresh session is held, NOT stored, while the leg runs: a locked slot of
// this account is released with the password still in hand and put back,
// and a ticked "don't remember" obtains its lock — the sign-in refuses to
// complete until one is held (PR-61). Only then is the pair stored, so no
// signed-in screen ever reads a locked slot. A leg that gets no answer keeps
// the session for the retry press, which runs the leg again without a second
// login (SignIn.md:71).

package com.cogra.domain.identity

import com.cogra.domain.LoginGrant
import com.cogra.domain.Outcome
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import javax.inject.Inject

/** The device lock's leg got no answer that settles it; the session is held for the retry. */
class SignInLegUnanswered : Exception("the device lock's sign-in leg got no answer")

class LogIn @Inject constructor(
    private val sessions: SessionRepository,
    private val tokens: TokenStore,
    private val identity: IdentityStore,
    private val notices: SecurityNotices,
    private val deviceLock: DeviceLock,
) {
    /** A session the leg did not finish with — the retry runs the leg again on it. */
    private var held: LoginGrant? = null

    /** PR-62's dead lock, seen on an earlier press of this sign-in and not yet said. */
    private var lockLost = false

    /** Credentials changed: a session held for the old ones is not this sign-in's. */
    fun forgetHeldSession() {
        held = null
    }

    /**
     * [forgetOnSignOut] is the login form's "don't remember me" opt-in
     * (auth.md "Sign-out"); each login records the checkbox as the
     * account's current choice, so an unchecked login also clears an
     * earlier opt-in.
     */
    suspend fun logIn(
        email: String,
        password: String,
        deviceLabel: String?,
        forgetOnSignOut: Boolean,
    ): Outcome<Unit> {
        val grant = held ?: when (val outcome = sessions.logIn(email, password, deviceLabel)) {
            is Outcome.Success -> outcome.value
            is Outcome.Refused -> return outcome
            is Outcome.Failed -> return outcome
        }
        val leg = deviceLock.signIn(grant.tokens.accountId, password, grant.tokens.accessToken, forgetOnSignOut)
        if (leg.lockLost) lockLost = true
        if (!leg.ready) {
            held = grant
            return Outcome.Failed(SignInLegUnanswered())
        }
        held = null
        // The notices post before the token save: saving flips auth-driven
        // navigation, and the shell dialog must already be pending when
        // Home renders (auth.md "Reuse detection" — delivered exactly once,
        // so a dropped notice never comes back).
        grant.reuseDetectedAt?.let(notices::post)
        if (lockLost) {
            lockLost = false
            notices.postLockLost()
        }
        // Saving first makes the account active, so the flag lands in the
        // right slot.
        tokens.save(grant.tokens)
        identity.setForgetOnSignOut(forgetOnSignOut)
        return Outcome.Success(Unit)
    }
}
