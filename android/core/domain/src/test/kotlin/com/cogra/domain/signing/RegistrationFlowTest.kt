package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.TestHost
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.cogra.domain.testing.testProposalBytes
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import java.util.Base64
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test

private const val FAST_DELAY_MS = 1_000L
private const val SLOW_DELAY_MS = 10_000L

private class ScriptedOnboarding : ThrowingOnboardingRepository() {
    var status: ApplicationStatus = ApplicationStatus(AccountState.APPLICANT, null, null, null)
    var refusal: List<UserError>? = null
    var polls = 0

    override suspend fun applicationStatus(): Outcome<ApplicationStatus> {
        polls += 1
        refusal?.let { return Outcome.Refused(it) }
        return Outcome.Success(status)
    }
}

private fun sessionFor(accountId: String, generation: Int = 0) =
    AuthTokens(accessToken = "access-$generation", refreshToken = "refresh-$generation", accountId = accountId)

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class RegistrationFlowTest {

    private val onboarding = ScriptedOnboarding()
    private val identity = FakeIdentityStore()
    private val tokens = FakeTokenStore().apply { tokens.value = sessionFor("account-a") }

    private fun flow(scope: kotlinx.coroutines.CoroutineScope, writes: ThrowingWriteRepository = ThrowingWriteRepository()) =
        RegistrationFlow(
            RegistrationSigner(
                onboarding,
                WriteSigner(writes, identity),
                identity,
                KeyCeremony(identity, onboarding, ThrowingAccountRepository()),
            ),
            scope,
            tokens,
            fastDelayMs = FAST_DELAY_MS,
            slowDelayMs = SLOW_DELAY_MS,
        )

    private fun application(approved: Boolean = false, landed: Boolean = false) = ApplicationView(
        handle = "joiner",
        emailVerified = true,
        keyAttached = true,
        approvedAt = if (approved) Instant.EPOCH else null,
        landedAt = if (landed) Instant.EPOCH else null,
        expiresAt = Instant.MAX,
    )

    private fun waiting() = ApplicationStatus(AccountState.APPLICANT, application(), null, null)

    private fun landingWait() = ApplicationStatus(AccountState.APPLICANT, application(approved = true), null, null)

    private fun member() = ApplicationStatus(AccountState.MEMBER, application(landed = true), null, null)

    @Test
    fun theCadenceIsSlowOnHumanWaitsAndFastOnLanding() = runTest {
        onboarding.status = waiting()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isInstanceOf(RegistrationProgress.AwaitingApproval::class.java)
        assertThat(onboarding.polls).isEqualTo(1)

        // A human wait polls at the slow cadence: nothing at fast delay.
        advanceTimeBy(FAST_DELAY_MS)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(1)
        advanceTimeBy(SLOW_DELAY_MS - FAST_DELAY_MS)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(2)

        // Approved: landing is server-actionable, so the poll speeds up.
        onboarding.status = landingWait()
        advanceTimeBy(SLOW_DELAY_MS)
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(onboarding.polls).isEqualTo(3)
        advanceTimeBy(FAST_DELAY_MS)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(4)

        // Member: the loop stops for good — no polling after onboarding.
        onboarding.status = member()
        advanceTimeBy(FAST_DELAY_MS)
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.Member)
        val settled = onboarding.polls
        advanceTimeBy(SLOW_DELAY_MS * 5)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(settled)
    }

    @Test
    fun aPokeTriggersAnImmediatePassInsteadOfASecondLoop() = runTest {
        onboarding.status = waiting()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(1)

        // Poking a running loop advances now, without a parallel loop.
        flow.ensureAdvancing()
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(2)

        // Still one cadence afterwards.
        advanceTimeBy(SLOW_DELAY_MS)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(3)
    }

    @Test
    fun aWatchedLandingGreetsExactlyOnce() = runTest {
        onboarding.status = waiting()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.consumeLanded()).isFalse()

        onboarding.status = member()
        advanceTimeBy(SLOW_DELAY_MS)
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.Member)
        assertThat(flow.consumeLanded()).isTrue()
        assertThat(flow.consumeLanded()).isFalse()
    }

    @Test
    fun aColdOpenAsMemberGreetsNobody() = runTest {
        onboarding.status = member()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.Member)
        assertThat(flow.consumeLanded()).isFalse()
    }

    @Test
    fun aFinishedLoopRestartsOnTheNextEnsure() = runTest {
        onboarding.status = member()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(1)

        // A later ensure (a pull-to-refresh) runs a fresh pass.
        flow.ensureAdvancing()
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(2)
    }

    @Test
    fun aDeviceRejectionStopsTheLoop() = runTest {
        val actor = ActorKey.generate()
        identity.seed = actor.seed()
        val host = TestHost()
        val proposal = testProposalBytes(actor, seq = 0u)
        val tamperingWrites = object : ThrowingWriteRepository() {
            override suspend fun hostPublicKey(): Outcome<ByteArray> =
                Outcome.Success(host.key.publicKeyBytes())

            override suspend fun submitProposal(
                stagedWriteId: String,
                signatureBase64: String,
            ): Outcome<StagedWriteView> {
                val sealed = host.seal(
                    proposal,
                    Base64.getDecoder().decode(signatureBase64),
                    actor.publicKeyBytes(),
                )
                sealed[sealed.size - 1] = (sealed[sealed.size - 1].toInt() xor 1).toByte()
                return Outcome.Success(
                    StagedWriteView(
                        id = stagedWriteId,
                        state = WriteState.AWAITING_APPROVAL,
                        family = com.cogra.crypto.Family.REGISTRATION,
                        canonicalProposal = proposal,
                        verifiedAct = sealed,
                        recordId = null,
                    ),
                )
            }
        }
        onboarding.status = ApplicationStatus(
            AccountState.APPLICANT,
            application(approved = true),
            StagedWriteView(
                id = "reg-1",
                state = WriteState.AWAITING_PRE_SIGN,
                family = com.cogra.crypto.Family.REGISTRATION,
                canonicalProposal = proposal,
                verifiedAct = null,
                recordId = null,
            ),
            actorPubkey = null,
        )
        val flow = flow(backgroundScope, tamperingWrites)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isInstanceOf(RegistrationProgress.RejectedByDevice::class.java)

        // No amount of polling repairs a rejection: the loop stops.
        val settled = onboarding.polls
        advanceTimeBy(SLOW_DELAY_MS * 3)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(settled)
    }

    @Test
    fun signOutStopsTheLoopAndResetsTheFlow() = runTest {
        onboarding.status = waiting()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isInstanceOf(RegistrationProgress.AwaitingApproval::class.java)
        assertThat(onboarding.polls).isEqualTo(1)

        // The session ends: the loop dies and the state drops with it.
        tokens.clear()
        runCurrent()
        assertThat(flow.progress.value).isNull()
        advanceTimeBy(SLOW_DELAY_MS * 3)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(1)
    }

    @Test
    fun aTokenRefreshDoesNotDisturbTheLoop() = runTest {
        onboarding.status = waiting()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(1)

        // Rotation replaces the pair but not the account: no reset.
        tokens.save(sessionFor("account-a", generation = 1))
        runCurrent()
        assertThat(flow.progress.value).isNotNull()
        advanceTimeBy(SLOW_DELAY_MS)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(2)
    }

    @Test
    fun anAccountSwitchDropsTheOldAccountsProgressAndGreeting() = runTest {
        onboarding.status = waiting()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        onboarding.status = member()
        advanceTimeBy(SLOW_DELAY_MS)
        runCurrent()
        // Landed as account A, greeting armed but not yet consumed.
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.Member)

        tokens.clear()
        runCurrent()
        tokens.save(sessionFor("account-b"))
        runCurrent()
        // Account B inherits nothing: no progress, no greeting.
        assertThat(flow.progress.value).isNull()
        assertThat(flow.consumeLanded()).isFalse()
    }

    @Test
    fun aFreshSessionStartsACleanLoop() = runTest {
        onboarding.status = member()
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        tokens.clear()
        runCurrent()
        tokens.save(sessionFor("account-b"))
        runCurrent()

        // The new session's own ensure starts a loop from scratch.
        onboarding.status = waiting()
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isInstanceOf(RegistrationProgress.AwaitingApproval::class.java)
        assertThat(onboarding.polls).isEqualTo(2)
    }

    @Test
    fun aRefusalKeepsThePollingAlive() = runTest {
        // A refusal inside a live session (a rate limit) self-heals on a
        // later pass — the loop slows down but never gives up; the
        // refusal that cannot heal (the ended session's UNAUTHENTICATED)
        // dies with the session watch instead.
        onboarding.refusal = listOf(UserError(ErrorCode.RATE_LIMITED, "slow down"))
        val flow = flow(backgroundScope)
        flow.ensureAdvancing()
        runCurrent()
        assertThat(flow.progress.value).isInstanceOf(RegistrationProgress.Refused::class.java)
        assertThat(onboarding.polls).isEqualTo(1)

        advanceTimeBy(SLOW_DELAY_MS)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(2)

        onboarding.refusal = null
        onboarding.status = waiting()
        advanceTimeBy(SLOW_DELAY_MS)
        runCurrent()
        assertThat(flow.progress.value).isInstanceOf(RegistrationProgress.AwaitingApproval::class.java)
    }
}
