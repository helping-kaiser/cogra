// THE FAULT LINE LEAVES WITH THE RETRY THAT WENT THROUGH (design's reading of
// the `attach` key card, seam 464 on 460.4; ApplicantFeed.md:37-39). On the
// app a Retry is the poll's own pass — `onRetryAttach` pokes
// `RegistrationFlow`, and the pass's repair attach and its report of the key
// attached are one emission — so no state ever stands between an attach that
// went through and the card leaving. Pinned here through every progress the
// screen is handed, not only the last one. Its own class beside
// KeyAttachRetryTest, whose fakes are file-private.

package com.cogra.feature.home

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.Outcome
import com.cogra.domain.ReaderStanding
import com.cogra.domain.UserProfile
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.signing.AttachFault
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationProgress
import com.cogra.domain.signing.RegistrationSigner
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.InMemoryKeptPickStore
import com.cogra.domain.testing.ScriptedInvitesRepository
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

private class RetryingApplicant : ThrowingAccountRepository() {
    override suspend fun me(): Outcome<UserProfile?> =
        Outcome.Success(UserProfile("u1", "joiner", "joiner", AccountState.APPLICANT, false, invitedBy = null))
}

/** The server: no key attached until an attach goes through. */
private class RetryOnboarding : ThrowingOnboardingRepository() {
    var attachOutcome: Outcome<Unit> = Outcome.Failed(IOException("lost"))
    var attaches = 0
    private var attached = false

    override suspend fun applicationStatus(): Outcome<ApplicationStatus> = Outcome.Success(
        ApplicationStatus(
            AccountState.APPLICANT,
            ApplicationView("joiner", emailVerified = true, keyAttached = attached, approvedAt = null, landedAt = null),
            null,
            null,
        ),
    )

    override suspend fun attachActorKey(actorPubkeyBase64: String, realizationAddress: String): Outcome<Unit> {
        attaches += 1
        if (attachOutcome is Outcome.Success) attached = true
        return attachOutcome
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class AttachFaultClearsOnRetryTest {

    private val dispatcher = StandardTestDispatcher()
    private val identity = FakeIdentityStore().apply { seed = ActorKey.generate().seed() }
    private val account = RetryingApplicant()
    private val onboarding = RetryOnboarding()
    private val loopScope = CoroutineScope(dispatcher + SupervisorJob())

    /** Every progress the screen was handed, in order. */
    private val handed = mutableListOf<RegistrationProgress?>()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun retryTest(body: suspend TestScope.(HomeViewModel) -> Unit) = runTest(dispatcher) {
        val vm = viewModel()
        backgroundScope.launch { vm.state.collect { handed += it.progress } }
        try {
            dispatcher.scheduler.runCurrent()
            body(vm)
        } finally {
            loopScope.cancel()
        }
    }

    private fun viewModel(): HomeViewModel {
        val registration = RegistrationFlow(
            RegistrationSigner(
                onboarding,
                WriteSigner(ThrowingWriteRepository(), identity),
                identity,
                KeyCeremony(identity, onboarding, account),
            ),
            loopScope,
            FakeTokenStore(),
            fastDelayMs = 1_000L,
            slowDelayMs = 10_000L,
        )
        return HomeViewModel(
            account,
            WriteSigner(ThrowingWriteRepository(), identity),
            identity,
            onboarding,
            registration,
            ScriptedInvitesRepository(),
            "https://cogra.example",
            InMemoryKeptPickStore(),
            ReaderStanding(),
        )
    }

    /** What the screen was handed after the first [from] progresses. */
    private fun handedSince(from: Int) = handed.drop(from).filterIsInstance<RegistrationProgress.AwaitingApproval>()

    @Test
    fun aRetryThatGoesThroughNeverLeavesTheFaultLineStanding() = retryTest { vm ->
        assertThat(handedSince(0).last().attachFault).isEqualTo(AttachFault.FAILED)
        val mark = handed.size

        onboarding.attachOutcome = Outcome.Success(Unit)
        vm.onRetryAttach()
        dispatcher.scheduler.runCurrent()

        val after = handedSince(mark)
        assertThat(after).isNotEmpty()
        // No progress after the Retry carries the fault: the line is gone
        // with the very emission that reads the key attached.
        assertThat(after.map { it.attachFault }).doesNotContain(AttachFault.FAILED)
        // And the card leaves (ApplicantFeed.md:39): the key reads attached
        // here, the state StatusBanners draws no key card for.
        assertThat(after.first().keyAttached).isTrue()
        assertThat(after.first().keyOnDevice).isTrue()
    }

    @Test
    fun aRetryThatFailsKeepsTheFaultLine() = retryTest { vm ->
        val before = onboarding.attaches

        vm.onRetryAttach()
        dispatcher.scheduler.runCurrent()

        // The same fault again is an equal state, so the screen is handed
        // nothing new: what it holds is what stands.
        assertThat(onboarding.attaches).isEqualTo(before + 1)
        val now = vm.state.value.progress as RegistrationProgress.AwaitingApproval
        assertThat(now.keyAttached).isFalse()
        assertThat(now.attachFault).isEqualTo(AttachFault.FAILED)
    }

    @Test
    fun aFailedRetryThenOneThatGoesThroughClearsTheLine() = retryTest { vm ->
        vm.onRetryAttach()
        dispatcher.scheduler.runCurrent()
        assertThat((vm.state.value.progress as RegistrationProgress.AwaitingApproval).attachFault)
            .isEqualTo(AttachFault.FAILED)
        val mark = handed.size

        onboarding.attachOutcome = Outcome.Success(Unit)
        vm.onRetryAttach()
        dispatcher.scheduler.runCurrent()

        val after = handedSince(mark)
        assertThat(after.map { it.attachFault }).doesNotContain(AttachFault.FAILED)
        assertThat(after.last().keyAttached).isTrue()
    }
}
