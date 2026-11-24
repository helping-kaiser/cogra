// THE KEY THAT DID NOT ATTACH (ApplicantFeed.md:37-39) through the real poll:
// the pass's repair attach keeps its reason, and Retry sends the SAME key again
// at once, the card leaving with the pass that reads it attached. Its own
// class: HomeViewModelTest is near detekt's LargeClass line.

package com.cogra.feature.home

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.ReaderStanding
import com.cogra.domain.UserError
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
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.util.Base64

private class ApplicantAccount : ThrowingAccountRepository() {
    override suspend fun me(): Outcome<UserProfile?> =
        Outcome.Success(UserProfile("u1", "joiner", "joiner", AccountState.APPLICANT, false, invitedBy = null))
}

/** The server: no key attached until an attach goes through. */
private class AttachingOnboarding : ThrowingOnboardingRepository() {
    var attachOutcome: Outcome<Unit> = Outcome.Failed(IOException("lost"))
    val attachedKeys = mutableListOf<String>()
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
        attachedKeys += actorPubkeyBase64
        if (attachOutcome is Outcome.Success) attached = true
        return attachOutcome
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class KeyAttachRetryTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val account = ApplicantAccount()
    private val onboarding = AttachingOnboarding()
    private val loopScope = CoroutineScope(dispatcher + SupervisorJob())

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** The poll loop dies with the test body, or runTest's drain feeds it forever. */
    private fun retryTest(body: suspend kotlinx.coroutines.test.TestScope.() -> Unit) = runTest(dispatcher) {
        try {
            body()
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

    private fun HomeViewModel.awaiting() = state.value.progress as RegistrationProgress.AwaitingApproval

    private val ownKey get() = Base64.getEncoder().encodeToString(actor.publicKeyBytes())

    @Test
    fun aKeyThatDidNotAttachReadsFailedAndRetryAttachesTheSameKeySoTheCardLeaves() = retryTest {
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.awaiting().keyAttached).isFalse()
        assertThat(vm.awaiting().attachFault).isEqualTo(AttachFault.FAILED)

        onboarding.attachOutcome = Outcome.Success(Unit)
        vm.onRetryAttach()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.awaiting().keyAttached).isTrue()
        assertThat(vm.awaiting().attachFault).isNull()
        // The same key both times: no mint, no other key.
        assertThat(onboarding.attachedKeys).isNotEmpty()
        assertThat(onboarding.attachedKeys.toSet()).containsExactly(ownKey)
        assertThat(identity.seed).isEqualTo(actor.seed())
    }

    @Test
    fun aRetryTheServerRefusesAsAnotherAccountsKeyReadsKeyInUse() = retryTest {
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.awaiting().attachFault).isEqualTo(AttachFault.FAILED)

        onboarding.attachOutcome = Outcome.Refused(listOf(UserError(ErrorCode.ACTOR_KEY_IN_USE, "in use")))
        vm.onRetryAttach()
        dispatcher.scheduler.runCurrent()
        assertThat(vm.awaiting().keyAttached).isFalse()
        assertThat(vm.awaiting().attachFault).isEqualTo(AttachFault.KEY_IN_USE)
    }

    @Test
    fun retryPassesAtOnceRatherThanWaitingOutThePollsDelay() = retryTest {
        val vm = viewModel()
        dispatcher.scheduler.runCurrent()
        val before = onboarding.attachedKeys.size
        vm.onRetryAttach()
        dispatcher.scheduler.runCurrent()
        assertThat(onboarding.attachedKeys.size).isEqualTo(before + 1)
    }
}
