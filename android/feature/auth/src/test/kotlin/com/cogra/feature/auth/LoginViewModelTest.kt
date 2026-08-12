package com.cogra.feature.auth

import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.LoginGrant
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.UserError
import com.cogra.domain.identity.LogIn
import com.cogra.domain.identity.SecurityNotices
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

private class ScriptedSessions : SessionRepository {
    var logInOutcome: Outcome<LoginGrant> =
        Outcome.Success(LoginGrant(AuthTokens("a", "r", "u1"), reuseDetectedAt = null))
    var lastDeviceLabel: String? = null

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<LoginGrant> {
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
    private val tokens = FakeTokenStore()
    private val identity = FakeIdentityStore()
    private val notices = SecurityNotices()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = LoginViewModel(LogIn(sessions, tokens, identity, notices))

    @Test
    fun successStoresTheTokens() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onEmailChange(" user@example.com ")
        vm.onPasswordChange("a strong password")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(tokens.current()).isEqualTo(AuthTokens("a", "r", "u1"))
        assertThat(vm.state.value.inProgress).isFalse()
        assertThat(vm.state.value.error).isNull()
        // A clean grant posts no security notice.
        assertThat(notices.reuseDetectedAt.value).isNull()
    }

    @Test
    fun aReuseNoticePostsToTheHolderBeforeTheTokensLand() = runTest(dispatcher) {
        val detectedAt = Instant.parse("2026-08-10T09:30:00Z")
        sessions.logInOutcome =
            Outcome.Success(LoginGrant(AuthTokens("a", "r", "u1"), detectedAt))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onPasswordChange("a strong password")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        // The shell dialog reads the holder after auth-driven navigation;
        // the login succeeded normally alongside it.
        assertThat(notices.reuseDetectedAt.value).isEqualTo(detectedAt)
        assertThat(tokens.current()).isEqualTo(AuthTokens("a", "r", "u1"))
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

    @Test
    fun theDontRememberOptInIsPersistedAtLogin() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onPasswordChange("a strong password")
        vm.onForgetOnSignOutChange(true)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.forgetOnSignOut).isTrue()
    }

    @Test
    fun anUncheckedLoginClearsAnEarlierOptIn() = runTest(dispatcher) {
        // Each login records the checkbox as the account's current
        // choice (auth.md "Sign-out": default off).
        identity.forgetOnSignOut = true
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onPasswordChange("a strong password")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.forgetOnSignOut).isFalse()
    }

    @Test
    fun aRefusedLoginRecordsNoOptIn() = runTest(dispatcher) {
        sessions.logInOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.INVALID_CREDENTIALS, "no match")))
        val vm = viewModel()
        vm.onEmailChange("user@example.com")
        vm.onPasswordChange("wrong")
        vm.onForgetOnSignOutChange(true)
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(identity.forgetOnSignOut).isFalse()
    }
}
