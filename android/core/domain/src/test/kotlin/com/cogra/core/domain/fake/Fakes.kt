package com.cogra.core.domain.fake

import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.model.FieldModerationStatus
import com.cogra.core.domain.model.ModeratedText
import com.cogra.core.domain.model.ModerationStatus
import com.cogra.core.domain.model.NetworkRole
import com.cogra.core.domain.model.ProfileEdits
import com.cogra.core.domain.model.User
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.repository.AuthRepository
import com.cogra.core.domain.repository.EditProfileOutcome
import com.cogra.core.domain.repository.TokenStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

internal fun testUser(id: String = "user-1", handle: String = "alice"): User =
    User(
        id = id,
        handle = ModeratedText(handle, FieldModerationStatus.NORMAL),
        displayName = ModeratedText("Alice", FieldModerationStatus.NORMAL),
        bio = ModeratedText("hello", FieldModerationStatus.NORMAL),
        websiteUrl = ModeratedText(null, FieldModerationStatus.NORMAL),
        networkRole = NetworkRole.MEMBER,
        moderationStatus = ModerationStatus.NORMAL,
        createdAt = "2026-06-17T00:00:00Z",
        updatedAt = "2026-06-17T00:00:00Z",
    )

internal val testTokens = AuthTokens(accessToken = "access", refreshToken = "refresh")

/** Configurable fake: each call returns the queued outcome or throws.
 *  Open so a test can override a single method to capture arguments. */
internal open class FakeAuthRepository(
    var logInOutcome: AuthOutcome? = null,
    var logInThrows: Throwable? = null,
    var meUser: User? = null,
    var meThrows: Throwable? = null,
    var editProfileOutcome: EditProfileOutcome? = null,
    var editProfileThrows: Throwable? = null,
) : AuthRepository {
    var logInCalls = 0
        private set

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): AuthOutcome {
        logInCalls++
        logInThrows?.let { throw it }
        return logInOutcome ?: error("no logInOutcome configured")
    }

    override suspend fun me(): User? {
        meThrows?.let { throw it }
        return meUser
    }

    override suspend fun editProfile(edits: ProfileEdits): EditProfileOutcome {
        editProfileThrows?.let { throw it }
        return editProfileOutcome ?: error("no editProfileOutcome configured")
    }
}

/** In-memory TokenStore backed by a StateFlow, mirroring the real contract. */
internal class FakeTokenStore(initial: AuthTokens? = null) : TokenStore {
    private val state = MutableStateFlow(initial)

    override val tokens: Flow<AuthTokens?> = state.asStateFlow()

    override suspend fun current(): AuthTokens? = state.value

    override suspend fun save(tokens: AuthTokens) {
        state.value = tokens
    }

    override suspend fun clear() {
        state.value = null
    }
}
