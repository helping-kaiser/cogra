package com.cogra.core.domain.usecase

import app.cash.turbine.test
import com.cogra.core.domain.fake.FakeAuthRepository
import com.cogra.core.domain.fake.FakeTokenStore
import com.cogra.core.domain.fake.testTokens
import com.cogra.core.domain.fake.testUser
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException

class GetMyProfileUseCaseTest {

    @Test
    fun `returns Loaded when me resolves a user`() = runTest {
        val user = testUser()
        val useCase = GetMyProfileUseCase(FakeAuthRepository(meUser = user))

        assertThat(useCase()).isEqualTo(ProfileResult.Loaded(user))
    }

    @Test
    fun `returns Unauthenticated when me resolves null`() = runTest {
        val useCase = GetMyProfileUseCase(FakeAuthRepository(meUser = null))

        assertThat(useCase()).isEqualTo(ProfileResult.Unauthenticated)
    }

    @Test
    fun `returns Failure on transport fault`() = runTest {
        val boom = IOException("offline")
        val useCase = GetMyProfileUseCase(FakeAuthRepository(meThrows = boom))

        val result = useCase()

        assertThat(result).isInstanceOf(ProfileResult.Failure::class.java)
        assertThat((result as ProfileResult.Failure).cause).isEqualTo(boom)
    }
}

class AuthStateUseCasesTest {

    @Test
    fun `observe emits false then true as a session is stored`() = runTest {
        val store = FakeTokenStore()
        val observe = ObserveAuthStateUseCase(store)

        observe().test {
            assertThat(awaitItem()).isFalse()
            store.save(testTokens)
            assertThat(awaitItem()).isTrue()
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `logout clears stored tokens`() = runTest {
        val store = FakeTokenStore(initial = testTokens)
        val logout = LogOutUseCase(store)

        logout()

        assertThat(store.current()).isNull()
    }
}
