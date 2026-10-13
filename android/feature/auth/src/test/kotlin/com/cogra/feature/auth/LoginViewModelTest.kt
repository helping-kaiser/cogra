package com.cogra.feature.auth

import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.LoginGrant
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.identity.DeviceLock
import com.cogra.domain.identity.LogIn
import com.cogra.domain.identity.SecurityNotices
import com.cogra.domain.repo.DeviceLockRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.HeldLock
import com.cogra.domain.testing.FakeDeviceLockRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeLockCustodyStore
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

private const val PASSWORD = "a strong password"

private class ScriptedSessions : SessionRepository {
    var logInOutcome: Outcome<LoginGrant> =
        Outcome.Success(LoginGrant(AuthTokens("a", "r", "u1"), reuseDetectedAt = null))
    var lastDeviceLabel: String? = null
    var logIns = 0

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<LoginGrant> {
        logIns++
        lastDeviceLabel = deviceLabel
        return logInOutcome
    }

    override suspend fun refresh(refreshToken: String): Outcome<AuthTokens> = throw UnsupportedOperationException()
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
    private val custody = FakeLockCustodyStore()
    private val locks = FakeDeviceLockRepository().apply { passwords["u1"] = PASSWORD }

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(lockRepo: DeviceLockRepository = locks) =
        LoginViewModel(LogIn(sessions, tokens, identity, notices, DeviceLock(custody, tokens, lockRepo)))

    /** A grant whose token names u1, so the fake server releases u1's locks. */
    private val u1Grant = LoginGrant(AuthTokens("token-u1", "r", "u1"), reuseDetectedAt = null)

    /** u1 signed out with its custody locked under a lock the server holds. */
    private suspend fun lockedU1(): String {
        val issued = (locks.issue("token-u1") as Outcome.Success).value
        custody.forget += "u1"
        custody.custodyOf("u1")["draft"] = byteArrayOf(1)
        custody.holdLock("u1", HeldLock(issued.id, issued.secret))
        custody.lock("u1")
        return issued.id
    }

    private fun LoginViewModel.fillAndSubmit(forget: Boolean = false) {
        onEmailChange("user@example.com")
        onPasswordChange(PASSWORD)
        onForgetOnSignOutChange(forget)
        onSubmit()
    }

    @Test
    fun `sign_in_with_current_credentials_unlocks_before_the_shell_renders`() = runTest(dispatcher) {
        sessions.logInOutcome = Outcome.Success(u1Grant)
        lockedU1()
        // The release records whether the pair was already stored: it must not be.
        val storedAtRelease = mutableListOf<AuthTokens?>()
        val recording = object : DeviceLockRepository by locks {
            override suspend fun release(lock: String, password: String, accessToken: String?): Outcome<ByteArray> {
                storedAtRelease += tokens.current()
                return locks.release(lock, password, accessToken)
            }
        }
        val vm = viewModel(recording)
        vm.fillAndSubmit(forget = true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(storedAtRelease).containsExactly(null)
        assertThat(custody.isLocked("u1")).isFalse()
        assertThat(custody.custodyOf("u1")).containsKey("draft")
        assertThat(tokens.current()).isEqualTo(u1Grant.tokens)
    }

    @Test
    fun `sign_in_unlock_without_an_answer_reads_didnt_send_and_retries_without_a_second_login`() =
        runTest(dispatcher) {
            sessions.logInOutcome = Outcome.Success(u1Grant)
            lockedU1()
            locks.online = false
            val vm = viewModel()
            vm.fillAndSubmit(forget = true)
            dispatcher.scheduler.advanceUntilIdle()
            assertThat(vm.state.value.transportFailed).isTrue()
            assertThat(tokens.current()).isNull()
            assertThat(custody.isLocked("u1")).isTrue()

            locks.online = true
            vm.onSubmit()
            dispatcher.scheduler.advanceUntilIdle()
            assertThat(tokens.current()).isEqualTo(u1Grant.tokens)
            assertThat(sessions.logIns).isEqualTo(1)
        }

    @Test
    fun `a_forget_on_sign_in_refuses_to_complete_until_the_lock_is_held`() = runTest(dispatcher) {
        // PR-61: a ticked box whose lock did not arrive leaves the reader signed out.
        sessions.logInOutcome = Outcome.Success(u1Grant)
        locks.online = false
        val vm = viewModel()
        vm.fillAndSubmit(forget = true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(tokens.current()).isNull()
        assertThat(identity.forgetOnSignOut).isFalse()
    }

    @Test
    fun `a_dead_lock_completes_the_sign_in_and_posts_its_notice_once`() = runTest(dispatcher) {
        // PR-62: the server can no longer open the lock.
        sessions.logInOutcome = Outcome.Success(u1Grant)
        val id = lockedU1()
        locks.rows.remove(id)
        val vm = viewModel()
        vm.fillAndSubmit(forget = true)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(tokens.current()).isEqualTo(u1Grant.tokens)
        assertThat(custody.isLocked("u1")).isFalse()
        assertThat(notices.lockLost.value).isTrue()
    }

    @Test
    fun aChangedCredentialDropsTheHeldSessionAndLogsInAgain() = runTest(dispatcher) {
        sessions.logInOutcome = Outcome.Success(u1Grant)
        locks.online = false
        val vm = viewModel()
        vm.fillAndSubmit(forget = true)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onPasswordChange("another password")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(sessions.logIns).isEqualTo(2)
    }

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
