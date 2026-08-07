package com.cogra.feature.auth

import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.sealKeyBackup
import com.cogra.domain.Outcome
import com.cogra.domain.identity.ActorRestorer
import com.cogra.domain.identity.RestoreResult
import com.cogra.domain.testing.FakeIdentityStore
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
class RestoreViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val identity = FakeIdentityStore()
    private val seed = ActorKey.generate().seed()
    private val code = RecoveryCode.generate()

    private val account = object : ThrowingAccountRepository() {
        override suspend fun keyBackup(): Outcome<ByteArray?> =
            Outcome.Success(sealKeyBackup(seed, code))
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = RestoreViewModel(ActorRestorer(identity, account))

    @Test
    fun aRestoredCodeLandsTheSeedWithoutAnOptIn() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onCodeChange(code.display())
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.restored).isTrue()
        assertThat(identity.seed).isEqualTo(seed)
        assertThat(identity.forgetOnSignOut).isFalse()
    }

    @Test
    fun theCheckedOptInFlagsTheAccountAtRestore() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onCodeChange(code.display())
        vm.onForgetOnSignOutChange(true)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.restored).isTrue()
        assertThat(identity.forgetOnSignOut).isTrue()
    }

    @Test
    fun aWrongCodeSurfacesAndFlagsNothing() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onCodeChange(RecoveryCode.generate().display())
        vm.onForgetOnSignOutChange(true)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.result).isEqualTo(RestoreResult.WrongCode)
        assertThat(identity.forgetOnSignOut).isFalse()
    }
}
