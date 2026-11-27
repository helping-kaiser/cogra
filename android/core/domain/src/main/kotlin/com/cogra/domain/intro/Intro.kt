// The intro's account state (OnboardingSteps.md): five cards shown once
// per account, on whichever device signs in first. The seen flag is the
// account's (`UserPreferences.hasSeenOnboarding`), never device memory.

package com.cogra.domain.intro

import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome

/** What the intro stands on, read once per feed entry. */
data class IntroAccount(
    /** Whether the account has already been shown the intro, on any device. */
    val hasSeen: Boolean,
    /**
     * Whose face the fifth card wears (OnboardingVouch.md: "the actual
     * link-issuer's avatar"): the member who vouched a landed account in,
     * or, before landing, the applicant's link issuer. Null for an account
     * with neither (a genesis actor).
     */
    val inviter: ActorRef?,
)

interface IntroRepository {
    /** The viewer's intro state; null when nobody is signed in. */
    suspend fun introAccount(): Outcome<IntroAccount?>

    /** Sets the account's seen flag — the moment the intro first shows. */
    suspend fun markIntroSeen(): Outcome<Unit>
}
