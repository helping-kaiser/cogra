// The shell's read of the account's sensitive-content choice
// (settings packet §3.1a): the app reads `me.preferences`, never a copy of
// its own, and a signed-out reader reads veiled.

package com.cogra.app.navigation

import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.UserProfile
import com.cogra.domain.settings.SensitiveContentChoice
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AccountPreferencesViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val tokens = FakeTokenStore()
    private val sensitive = SensitiveContentChoice()

    /** The account's `me` read, answering the level set here. */
    private val account = object : ThrowingAccountRepository() {
        var level: Int? = null
        var reads = 0

        override suspend fun me(): Outcome<UserProfile?> {
            reads++
            return Outcome.Success(
                UserProfile(
                    id = "u1",
                    handle = "sol",
                    displayName = null,
                    accountState = AccountState.MEMBER,
                    hasReciprocated = true,
                    invitedBy = null,
                    contentFilteringSeverityLevel = level,
                ),
            )
        }
    }

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun idle() = dispatcher.scheduler.advanceUntilIdle()

    @Test
    fun `a_choice_made_on_another_device_reads_here`() = runTest(dispatcher) {
        account.level = 0
        tokens.save(AuthTokens("a", "r", "u1"))
        val vm = AccountPreferencesViewModel(tokens, account, sensitive)
        idle()
        assertThat(vm.alwaysUnveil.value).isTrue()
        assertThat(account.reads).isEqualTo(1)
    }

    @Test
    fun `an account that never chose reads veiled`() = runTest(dispatcher) {
        tokens.save(AuthTokens("a", "r", "u1"))
        val vm = AccountPreferencesViewModel(tokens, account, sensitive)
        idle()
        assertThat(vm.alwaysUnveil.value).isFalse()
    }

    @Test
    fun `signed_out_reader_sees_the_veil — and the last account's choice is forgotten`() = runTest(dispatcher) {
        account.level = 0
        tokens.save(AuthTokens("a", "r", "u1"))
        val vm = AccountPreferencesViewModel(tokens, account, sensitive)
        idle()
        assertThat(vm.alwaysUnveil.value).isTrue()

        tokens.clear()
        idle()
        assertThat(vm.alwaysUnveil.value).isFalse()
        assertThat(sensitive.level.value).isNull()
    }

    @Test
    fun `a signed-out start reads nothing`() = runTest(dispatcher) {
        val vm = AccountPreferencesViewModel(tokens, account, sensitive)
        idle()
        assertThat(vm.alwaysUnveil.value).isFalse()
        assertThat(account.reads).isEqualTo(0)
    }
}
