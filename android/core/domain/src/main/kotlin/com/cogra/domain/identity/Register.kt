// Registration — the account plus the ordinary first session (auth.md
// "Application" step 2): a successful pair is stored at once, exactly
// as for login; auth-state navigation observes the token store. The
// key ceremony and email verification follow as logged-in steps.

package com.cogra.domain.identity

import com.cogra.domain.Outcome
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.store.TokenStore
import javax.inject.Inject

class Register @Inject constructor(
    private val onboarding: OnboardingRepository,
    private val tokens: TokenStore,
) {
    suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<Unit> =
        when (val outcome = onboarding.register(inviteLink, handle, email, password, deviceLabel)) {
            is Outcome.Success -> {
                tokens.save(outcome.value)
                Outcome.Success(Unit)
            }
            is Outcome.Refused -> outcome
            is Outcome.Failed -> outcome
        }
}
