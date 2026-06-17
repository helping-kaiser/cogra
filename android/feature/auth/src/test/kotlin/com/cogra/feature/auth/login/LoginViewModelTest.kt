package com.cogra.feature.auth.login

import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.UserError
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.usecase.LogInUseCase
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

class LoginViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val tokenStore = FakeTokenStore()
    private val repository = FakeAuthRepository()

    private fun viewModel() = LoginViewModel(LogInUseCase(repository, tokenStore))

    @Test
    fun `canSubmit is false until both fields are filled`() {
        val vm = viewModel()
        assertThat(vm.state.value.canSubmit).isFalse()

        vm.onEmailChange("a@b.com")
        assertThat(vm.state.value.canSubmit).isFalse()

        vm.onPasswordChange("pw")
        assertThat(vm.state.value.canSubmit).isTrue()
    }

    @Test
    fun `successful login persists tokens and clears submitting`() = runTest {
        repository.logInOutcome = AuthOutcome.Authenticated(AuthTokens("at", "rt"), testUser())
        val vm = viewModel()
        vm.onEmailChange("a@b.com")
        vm.onPasswordChange("pw")

        vm.onSubmit()
        advanceUntilIdle()

        assertThat(vm.state.value.isSubmitting).isFalse()
        assertThat(vm.state.value.errorMessage).isNull()
        assertThat(tokenStore.current()).isEqualTo(AuthTokens("at", "rt"))
    }

    @Test
    fun `invalid credentials surface a localized message and store nothing`() = runTest {
        repository.logInOutcome = AuthOutcome.Rejected(
            listOf(UserError("bad", ErrorCode.INVALID_CREDENTIALS)),
        )
        val vm = viewModel()
        vm.onEmailChange("a@b.com")
        vm.onPasswordChange("wrong")

        vm.onSubmit()
        advanceUntilIdle()

        assertThat(vm.state.value.errorMessage).isEqualTo("Email or password is incorrect.")
        assertThat(tokenStore.current()).isNull()
    }

    @Test
    fun `transport failure surfaces a connection message`() = runTest {
        repository.logInThrows = IOException("offline")
        val vm = viewModel()
        vm.onEmailChange("a@b.com")
        vm.onPasswordChange("pw")

        vm.onSubmit()
        advanceUntilIdle()

        assertThat(vm.state.value.errorMessage)
            .isEqualTo("Couldn't reach the server. Check your connection.")
    }

    @Test
    fun `editing a field clears a previous error`() = runTest {
        repository.logInThrows = IOException("offline")
        val vm = viewModel()
        vm.onEmailChange("a@b.com")
        vm.onPasswordChange("pw")
        vm.onSubmit()
        advanceUntilIdle()
        assertThat(vm.state.value.errorMessage).isNotNull()

        vm.onEmailChange("a@b.co")

        assertThat(vm.state.value.errorMessage).isNull()
    }
}
