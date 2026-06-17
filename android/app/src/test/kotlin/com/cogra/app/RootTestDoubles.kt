package com.cogra.app

import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.model.FieldModerationStatus
import com.cogra.core.domain.model.ModeratedText
import com.cogra.core.domain.model.ModerationStatus
import com.cogra.core.domain.model.NetworkRole
import com.cogra.core.domain.model.User
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.repository.AuthRepository
import com.cogra.core.domain.repository.TokenStore
import com.cogra.core.network.di.NetworkModule
import dagger.Binds
import dagger.Module
import dagger.hilt.components.SingletonComponent
import dagger.hilt.testing.TestInstallIn
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/** In-memory session store backed by a StateFlow; the test mutates it to drive
 *  the root's login <-> profile branch. */
@Singleton
class FakeTokenStore @Inject constructor() : TokenStore {
    private val state = MutableStateFlow<AuthTokens?>(null)

    override val tokens: Flow<AuthTokens?> = state.asStateFlow()
    override suspend fun current(): AuthTokens? = state.value
    override suspend fun save(tokens: AuthTokens) {
        state.value = tokens
    }

    override suspend fun clear() {
        state.value = null
    }
}

/** Returns whatever viewer the test configures, so the profile branch can load
 *  deterministically without a network. */
@Singleton
class FakeAuthRepository @Inject constructor() : AuthRepository {
    var viewer: User? = null

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): AuthOutcome =
        error("login is not exercised by the root test")

    override suspend fun me(): User? = viewer
}

/** Replaces the Apollo/Keystore-backed network graph with in-memory fakes so the
 *  root composable can be driven through the real Hilt graph on the JVM. */
@Module
@TestInstallIn(components = [SingletonComponent::class], replaces = [NetworkModule::class])
interface FakeNetworkModule {
    @Binds
    @Singleton
    fun tokenStore(impl: FakeTokenStore): TokenStore

    @Binds
    @Singleton
    fun authRepository(impl: FakeAuthRepository): AuthRepository
}

internal fun testUser(displayName: String = "Alice", handle: String = "alice"): User =
    User(
        id = "user-1",
        handle = ModeratedText(handle, FieldModerationStatus.NORMAL),
        displayName = ModeratedText(displayName, FieldModerationStatus.NORMAL),
        bio = ModeratedText("hello", FieldModerationStatus.NORMAL),
        websiteUrl = ModeratedText(null, FieldModerationStatus.NORMAL),
        networkRole = NetworkRole.MEMBER,
        moderationStatus = ModerationStatus.NORMAL,
        createdAt = "2026-06-17T00:00:00Z",
        updatedAt = "2026-06-17T00:00:00Z",
    )
