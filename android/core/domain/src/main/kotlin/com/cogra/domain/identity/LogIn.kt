// Login — the L2 half of auth (auth.md "Tokens"): a successful pair is
// stored at once; auth-state navigation observes the token store.

package com.cogra.domain.identity

import com.cogra.domain.Outcome
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import javax.inject.Inject

class LogIn @Inject constructor(
    private val sessions: SessionRepository,
    private val tokens: TokenStore,
    private val identity: IdentityStore,
) {
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
    ): Outcome<Unit> =
        when (val outcome = sessions.logIn(email, password, deviceLabel)) {
            is Outcome.Success -> {
                // Saving first makes the account active, so the flag
                // lands in the right slot.
                tokens.save(outcome.value)
                identity.setForgetOnSignOut(forgetOnSignOut)
                Outcome.Success(Unit)
            }
            is Outcome.Refused -> outcome
            is Outcome.Failed -> outcome
        }
}
