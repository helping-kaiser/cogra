// Login — the L2 half of auth (auth.md "Tokens"): a successful pair is
// stored at once; auth-state navigation observes the token store.

package com.cogra.domain.identity

import com.cogra.domain.Outcome
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.TokenStore
import javax.inject.Inject

class LogIn @Inject constructor(
    private val sessions: SessionRepository,
    private val tokens: TokenStore,
) {
    suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<Unit> =
        when (val outcome = sessions.logIn(email, password, deviceLabel)) {
            is Outcome.Success -> {
                tokens.save(outcome.value)
                Outcome.Success(Unit)
            }
            is Outcome.Refused -> outcome
            is Outcome.Failed -> outcome
        }
}
