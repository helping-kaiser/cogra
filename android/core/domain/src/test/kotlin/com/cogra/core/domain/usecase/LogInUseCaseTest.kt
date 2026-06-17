package com.cogra.core.domain.usecase

import com.cogra.core.domain.fake.FakeAuthRepository
import com.cogra.core.domain.fake.FakeTokenStore
import com.cogra.core.domain.fake.testTokens
import com.cogra.core.domain.fake.testUser
import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.model.UserError
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException

class LogInUseCaseTest {

    @Test
    fun `blank email is rejected before any network call`() = runTest {
        val repo = FakeAuthRepository()
        val store = FakeTokenStore()
        val useCase = LogInUseCase(repo, store)

        val result = useCase("", "pw")

        assertThat(result).isInstanceOf(LoginResult.Rejected::class.java)
        val errors = (result as LoginResult.Rejected).errors
        assertThat(errors.map { it.field }).contains(listOf("email"))
        assertThat(errors.all { it.code == ErrorCode.BAD_INPUT }).isTrue()
        assertThat(repo.logInCalls).isEqualTo(0)
        assertThat(store.current()).isNull()
    }

    @Test
    fun `blank password is rejected before any network call`() = runTest {
        val repo = FakeAuthRepository()
        val useCase = LogInUseCase(repo, FakeTokenStore())

        val result = useCase("a@b.com", "")

        assertThat(result).isInstanceOf(LoginResult.Rejected::class.java)
        assertThat((result as LoginResult.Rejected).errors.map { it.field })
            .contains(listOf("password"))
        assertThat(repo.logInCalls).isEqualTo(0)
    }

    @Test
    fun `success persists the issued tokens and returns the user`() = runTest {
        val user = testUser()
        val repo = FakeAuthRepository(logInOutcome = AuthOutcome.Authenticated(testTokens, user))
        val store = FakeTokenStore()
        val useCase = LogInUseCase(repo, store)

        val result = useCase("a@b.com", "pw")

        assertThat(result).isEqualTo(LoginResult.Success(user))
        assertThat(store.current()).isEqualTo(testTokens)
    }

    @Test
    fun `email is trimmed before it reaches the repository`() = runTest {
        var seenEmail: String? = null
        val repo = object : FakeAuthRepository(
            logInOutcome = AuthOutcome.Authenticated(testTokens, testUser()),
        ) {
            override suspend fun logIn(email: String, password: String, deviceLabel: String?) =
                super.logIn(email, password, deviceLabel).also { seenEmail = email }
        }
        val useCase = LogInUseCase(repo, FakeTokenStore())

        useCase("  a@b.com  ", "pw")

        assertThat(seenEmail).isEqualTo("a@b.com")
    }

    @Test
    fun `server rejection is surfaced and no tokens are stored`() = runTest {
        val rejection = UserError("nope", ErrorCode.INVALID_CREDENTIALS)
        val repo = FakeAuthRepository(logInOutcome = AuthOutcome.Rejected(listOf(rejection)))
        val store = FakeTokenStore()
        val useCase = LogInUseCase(repo, store)

        val result = useCase("a@b.com", "pw")

        assertThat(result).isEqualTo(LoginResult.Rejected(listOf(rejection)))
        assertThat(store.current()).isNull()
    }

    @Test
    fun `transport failure becomes Failure and stores nothing`() = runTest {
        val boom = IOException("offline")
        val repo = FakeAuthRepository(logInThrows = boom)
        val store = FakeTokenStore()
        val useCase = LogInUseCase(repo, store)

        val result = useCase("a@b.com", "pw")

        assertThat(result).isInstanceOf(LoginResult.Failure::class.java)
        assertThat((result as LoginResult.Failure).cause).isEqualTo(boom)
        assertThat(store.current()).isNull()
    }
}
