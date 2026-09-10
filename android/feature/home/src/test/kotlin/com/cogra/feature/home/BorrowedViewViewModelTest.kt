package com.cogra.feature.home

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.signing.RegistrationFlow
import com.cogra.domain.signing.RegistrationSigner
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
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
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class ScriptedVantage : ThrowingAccountRepository() {
    var answer: Outcome<ActorRef?> = Outcome.Success(ActorRef("a1", "genesis_mod"))
    var profile: UserProfile? =
        UserProfile("u1", "noa", "noa", AccountState.MEMBER, false, ActorRef("a1", "mira"))
    var reads = 0
    var accountReads = 0

    override suspend fun borrowedView(): Outcome<ActorRef?> {
        reads += 1
        return answer
    }

    override suspend fun me(): Outcome<UserProfile?> {
        accountReads += 1
        return Outcome.Success(profile)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class BorrowedViewViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val account = ScriptedVantage()
    private val identity = FakeIdentityStore().apply { seed = ActorKey.generate().seed() }
    private val onboarding = ThrowingOnboardingRepository()
    private val loopScope = CoroutineScope(dispatcher + SupervisorJob())

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        loopScope.cancel()
        Dispatchers.resetMain()
    }

    /** The flow is never poked here; only its progress channel is read. */
    private fun registrationFlow() = RegistrationFlow(
        RegistrationSigner(
            onboarding,
            WriteSigner(ThrowingWriteRepository(), identity),
            identity,
            KeyCeremony(identity, onboarding, account),
        ),
        loopScope,
        FakeTokenStore(),
    )

    private fun viewModel(signedIn: Boolean) =
        BorrowedViewViewModel(account, registrationFlow()).apply { onSession(signedIn) }

    /**
     * A signed-out reader's wording is settled by the session alone, so
     * the account read is not made at all — the shell already knows.
     */
    @Test
    fun theVantageIsReadOnceAtOpenAndNamed() = runTest(dispatcher) {
        val viewModel = viewModel(signedIn = false)
        advanceUntilIdle()

        assertThat(account.reads).isEqualTo(1)
        assertThat(account.accountReads).isEqualTo(0)
        assertThat(viewModel.state.value.loading).isFalse()
        assertThat(viewModel.state.value.vantage?.handle).isEqualTo("genesis_mod")
        assertThat(viewModel.state.value.reading).isEqualTo(BorrowedViewReading.JOIN)
    }

    /** The landed member's line is the vouch-back ask, and it is theirs. */
    @Test
    fun aLandedMemberStillBorrowingIsGivenTheVouchBackReading() = runTest(dispatcher) {
        account.answer = Outcome.Success(ActorRef("a1", "mira"))
        val viewModel = viewModel(signedIn = true)
        advanceUntilIdle()

        assertThat(viewModel.state.value.vantage?.handle).isEqualTo("mira")
        assertThat(viewModel.state.value.reading).isEqualTo(BorrowedViewReading.VOUCH_BACK)
    }

    @Test
    fun anApplicantIsGivenTheApplicantReading() = runTest(dispatcher) {
        account.answer = Outcome.Success(ActorRef("a1", "mira"))
        account.profile =
            UserProfile("u1", "noa", "noa", AccountState.APPLICANT, false, ActorRef("a1", "mira"))
        val viewModel = viewModel(signedIn = true)
        advanceUntilIdle()

        assertThat(viewModel.state.value.reading).isEqualTo(BorrowedViewReading.APPLICANT)
    }

    /**
     * The band is an honesty label over a feed already on screen, so a
     * read that did not answer must leave it off rather than put an
     * unanswered name under the bar.
     */
    @Test
    fun aRefusedReadNamesNobody() = runTest(dispatcher) {
        account.answer = Outcome.Refused(listOf(UserError(ErrorCode.INTERNAL, "unavailable")))
        val viewModel = viewModel(signedIn = false)
        advanceUntilIdle()

        assertThat(viewModel.state.value.loading).isFalse()
        assertThat(viewModel.state.value.vantage).isNull()
    }

    /**
     * A null answer is the reader's own view — the vouch-back has landed —
     * and the band goes without asking the account anything further.
     */
    @Test
    fun aReaderWithTheirOwnViewIsNamedNoVantage() = runTest(dispatcher) {
        account.answer = Outcome.Success(null)
        val viewModel = viewModel(signedIn = true)
        advanceUntilIdle()

        assertThat(viewModel.state.value.vantage).isNull()
        assertThat(account.accountReads).isEqualTo(0)
    }
}
