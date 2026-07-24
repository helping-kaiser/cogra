package com.cogra.feature.auth

import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.UserError
import com.cogra.domain.identity.LogIn
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.TokenStore
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

class InMemoryTokens : TokenStore {
    override val tokens = MutableStateFlow<AuthTokens?>(null)
    override suspend fun current(): AuthTokens? = tokens.value
    override suspend fun save(tokens: AuthTokens) {
        this.tokens.value = tokens
    }
    override suspend fun clear() {
        tokens.value = null
    }
}

private class ScriptedSessions : SessionRepository {
    var logInOutcome: Outcome<AuthTokens> = Outcome.Success(AuthTokens("a", "r"))
    var lastDeviceLabel: String? = null

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<AuthTokens> {
        lastDeviceLabel = deviceLabel
        return logInOutcome
    }

    override suspend fun refresh(refreshToken: String): Outcome<AuthTokens> = throw UnsupportedOperationException()
    override suspend fun sessions(): Outcome<List<SessionInfo>> = throw UnsupportedOperationException()
    override suspend fun revokeSession(id: String?): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun revokeOtherSessions(): Outcome<Int> = throw UnsupportedOperationException()
}

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val sessions = ScriptedSessions()
    private val tokens = InMemoryTokens()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = LoginViewModel(LogIn(sessions, tokens))

    @Test
    fun successStoresTheTokens() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onEmailChange(" user@example.com ")
        vm.onPasswordChange("a strong password")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(tokens.current()).isEqualTo(AuthTokens("a", "r"))
        assertThat(vm.state.value.inProgress).isFalse()
        assertThat(vm.state.value.error).isNull()
    }

    @Test
    fun aRefusalSurfacesAndTypingClearsIt() = runTest(dispatcher) {
        sessions.logInOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.INVALID_CREDENTIALS, "no match")))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onPasswordChange("wrong")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.error).isEqualTo(ErrorCode.INVALID_CREDENTIALS)
        assertThat(tokens.current()).isNull()
        vm.onPasswordChange("wrong2")
        assertThat(vm.state.value.error).isNull()
    }

    @Test
    fun transportFailureIsItsOwnState() = runTest(dispatcher) {
        sessions.logInOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onPasswordChange("pw pw pw pw pw")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.error).isNull()
    }

    @Test
    fun blankFieldsCannotSubmit() = runTest(dispatcher) {
        val vm = viewModel()
        assertThat(vm.state.value.canSubmit).isFalse()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(sessions.lastDeviceLabel).isNull()
    }
}
