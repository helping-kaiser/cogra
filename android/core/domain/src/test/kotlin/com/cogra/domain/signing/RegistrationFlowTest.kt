package com.cogra.domain.signing

import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test

private class ScriptedOnboarding : ThrowingOnboardingRepository() {
    var status: ApplicationStatus? = null
    var polls = 0

    override suspend fun application(applicantToken: String): Outcome<ApplicationStatus?> {
        polls += 1
        return Outcome.Success(status)
    }

    override suspend fun claimLandedSession(applicantToken: String, deviceLabel: String?): Outcome<AuthTokens> =
        Outcome.Success(AuthTokens("access", "refresh"))
}

class RegistrationFlowTest {

    private val onboarding = ScriptedOnboarding()
    private val identity = FakeIdentityStore().apply { token = "tok" }
    private val tokens = FakeTokenStore()

    private fun signer() = RegistrationSigner(
        onboarding,
        ThrowingWriteRepository(),
        identity,
        tokens,
        ThrowingAccountRepository(),
    )

    private fun status(verified: Boolean = true, landed: Boolean = false) = ApplicationStatus(
        handle = "joiner",
        emailVerified = verified,
        approvedAt = null,
        landedAt = if (landed) Instant.EPOCH else null,
        expiresAt = Instant.MAX,
        stagedRegistration = null,
    )

    @Test
    fun pollsWhileWaitingThenClaimsAndStops() = runTest {
        onboarding.status = status(verified = false)
        val flow = RegistrationFlow(signer(), backgroundScope, deviceLabel = null)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.AwaitingEmailVerification)

        onboarding.status = status(verified = true)
        advanceTimeBy(flow.pollDelayMs)
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.AwaitingApproval)

        onboarding.status = status(landed = true)
        advanceTimeBy(flow.pollDelayMs)
        runCurrent()
        assertThat(flow.progress.value).isInstanceOf(RegistrationProgress.SessionClaimed::class.java)
        assertThat(tokens.tokens.value).isNotNull()
        assertThat(identity.token).isNull()

        // Terminal: no further polls happen.
        val settled = onboarding.polls
        advanceTimeBy(flow.pollDelayMs * 3)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(settled)
    }

    @Test
    fun ensureAdvancingIsIdempotentWhileALoopRuns() = runTest {
        onboarding.status = status(verified = false)
        val flow = RegistrationFlow(signer(), backgroundScope, deviceLabel = null)
        flow.ensureAdvancing()
        flow.ensureAdvancing()
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(1)
    }

    @Test
    fun aFinishedLoopRestartsForALaterApplication() = runTest {
        identity.token = null
        val flow = RegistrationFlow(signer(), backgroundScope, deviceLabel = null)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.NoApplication)

        identity.token = "tok"
        onboarding.status = status(verified = false)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.AwaitingEmailVerification)
    }

    @Test
    fun consumeClaimedSpendsTheTerminalStateExactlyOnce() = runTest {
        onboarding.status = status(landed = true)
        val flow = RegistrationFlow(signer(), backgroundScope, deviceLabel = null)
        flow.ensureAdvancing()
        runCurrent()

        assertThat(flow.consumeClaimed()).isTrue()
        assertThat(flow.progress.value).isNull()
        assertThat(flow.consumeClaimed()).isFalse()
    }

    @Test
    fun consumeClaimedIsFalseWhileTheFlowStillRuns() = runTest {
        onboarding.status = status(verified = true)
        val flow = RegistrationFlow(signer(), backgroundScope, deviceLabel = null)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.consumeClaimed()).isFalse()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.AwaitingApproval)
    }
}
