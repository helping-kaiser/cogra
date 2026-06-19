package com.cogra.feature.auth.testutil

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

fun testUser(handle: String = "alice", displayName: String = "Alice"): User =
    User(
        id = "u1",
        handle = ModeratedText(handle, FieldModerationStatus.NORMAL),
        displayName = ModeratedText(displayName, FieldModerationStatus.NORMAL),
        bio = ModeratedText("hello world", FieldModerationStatus.NORMAL),
        websiteUrl = ModeratedText(null, FieldModerationStatus.NORMAL),
        networkRole = NetworkRole.MEMBER,
        moderationStatus = ModerationStatus.NORMAL,
        createdAt = "2026-06-17T00:00:00Z",
        updatedAt = "2026-06-17T00:00:00Z",
    )

class FakeAuthRepository(
    var logInOutcome: AuthOutcome = AuthOutcome.Authenticated(
        AuthTokens("at", "rt"),
        testUser(),
    ),
    var logInThrows: Throwable? = null,
    var meUser: User? = testUser(),
    var meThrows: Throwable? = null,
    var editProfileOutcome: EditProfileOutcome = EditProfileOutcome.Updated(testUser()),
    var editProfileThrows: Throwable? = null,
) : AuthRepository {
    /** The change set passed to the most recent [editProfile] call. */
    var lastEdits: ProfileEdits? = null
        private set

    override suspend fun logIn(email: String, password: String, deviceLabel: String?): AuthOutcome {
        logInThrows?.let { throw it }
        return logInOutcome
    }

    override suspend fun me(): User? {
        meThrows?.let { throw it }
        return meUser
    }

    override suspend fun editProfile(edits: ProfileEdits): EditProfileOutcome {
        lastEdits = edits
        editProfileThrows?.let { throw it }
        return editProfileOutcome
    }
}

class FakeTokenStore(initial: AuthTokens? = null) : TokenStore {
    private val stateFlow = MutableStateFlow(initial)
    override val tokens: Flow<AuthTokens?> = stateFlow.asStateFlow()
    override suspend fun current(): AuthTokens? = stateFlow.value
    override suspend fun save(tokens: AuthTokens) {
        stateFlow.value = tokens
    }

    override suspend fun clear() {
        stateFlow.value = null
    }
}
