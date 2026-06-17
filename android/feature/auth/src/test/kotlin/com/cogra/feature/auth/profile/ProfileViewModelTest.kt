package com.cogra.feature.auth.profile

import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.usecase.GetMyProfileUseCase
import com.cogra.core.domain.usecase.LogOutUseCase
import com.cogra.feature.auth.testutil.FakeAuthRepository
import com.cogra.feature.auth.testutil.FakeTokenStore
import com.cogra.feature.auth.testutil.MainDispatcherRule
import com.cogra.feature.auth.testutil.testUser
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import java.io.IOException

class ProfileViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val tokenStore = FakeTokenStore(initial = AuthTokens("at", "rt"))
    private val repository = FakeAuthRepository()

    private fun viewModel() = ProfileViewModel(
        GetMyProfileUseCase(repository),
        LogOutUseCase(tokenStore),
    )

    @Test
    fun `loads the viewer profile on init`() = runTest {
        val user = testUser(handle = "bob", displayName = "Bob")
        repository.meUser = user
        val vm = viewModel()

        advanceUntilIdle()

        assertThat(vm.state.value.isLoading).isFalse()
        assertThat(vm.state.value.user).isEqualTo(user)
    }

    @Test
    fun `a stale session is cleared and leaves no user`() = runTest {
        repository.meUser = null
        val vm = viewModel()

        advanceUntilIdle()

        assertThat(vm.state.value.user).isNull()
        assertThat(vm.state.value.errorMessage).isNull()
        assertThat(tokenStore.current()).isNull()
    }

    @Test
    fun `a transport failure surfaces an error and keeps the session`() = runTest {
        repository.meThrows = IOException("offline")
        val vm = viewModel()

        advanceUntilIdle()

        assertThat(vm.state.value.user).isNull()
        assertThat(vm.state.value.errorMessage).isEqualTo("Couldn't load your profile. Try again.")
        assertThat(tokenStore.current()).isEqualTo(AuthTokens("at", "rt"))
    }

    @Test
    fun `logout clears the stored session`() = runTest {
        val vm = viewModel()
        advanceUntilIdle()

        vm.onLogout()
        advanceUntilIdle()

        assertThat(tokenStore.current()).isNull()
    }
}
