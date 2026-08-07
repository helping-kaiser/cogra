package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.WriteState
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.testing.FakeIdentityStore
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

private class ScriptedOnboarding : ThrowingOnboardingRepository() {
    var status: ApplicationStatus = ApplicationStatus(AccountState.APPLICANT, null, null, null)
    var polls = 0

    override suspend fun applicationStatus(): Outcome<ApplicationStatus> {
        polls += 1
        return Outcome.Success(status)
    }
}

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class RegistrationFlowTest {

    private val onboarding = ScriptedOnboarding()
    private val identity = FakeIdentityStore()

    private fun flow(scope: kotlinx.coroutines.CoroutineScope, writes: ThrowingWriteRepository = ThrowingWriteRepository()) =
        RegistrationFlow(
            RegistrationSigner(
                onboarding,
                WriteSigner(writes, identity),
                identity,
                KeyCeremony(identity, onboarding, ThrowingAccountRepository()),
            ),
            scope,
        ).apply {
            fastDelayMs = 1_000
            slowDelayMs = 10_000
        }

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
        advanceTimeBy(flow.fastDelayMs)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(1)
        advanceTimeBy(flow.slowDelayMs - flow.fastDelayMs)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(2)

        // Approved: landing is server-actionable, so the poll speeds up.
        onboarding.status = landingWait()
        advanceTimeBy(flow.slowDelayMs)
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(onboarding.polls).isEqualTo(3)
        advanceTimeBy(flow.fastDelayMs)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(4)

        // Member: the loop stops for good — no polling after onboarding.
        onboarding.status = member()
        advanceTimeBy(flow.fastDelayMs)
        runCurrent()
        assertThat(flow.progress.value).isEqualTo(RegistrationProgress.Member)
        val settled = onboarding.polls
        advanceTimeBy(flow.slowDelayMs * 5)
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
        advanceTimeBy(flow.slowDelayMs)
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
        advanceTimeBy(flow.slowDelayMs)
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
        advanceTimeBy(flow.slowDelayMs * 3)
        runCurrent()
        assertThat(onboarding.polls).isEqualTo(settled)
    }
}
