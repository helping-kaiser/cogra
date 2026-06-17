package com.cogra.core.domain.repository

import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.model.User
import com.cogra.core.domain.model.UserError

/**
 * The result of an authentication attempt against the backend. Transport and
 * unexpected faults are NOT modeled here — the repository throws those, and
 * the use-case layer decides how to surface them.
 */
sealed interface AuthOutcome {
    /** Credentials matched: a fresh token pair and the viewer's User. */
    data class Authenticated(val tokens: AuthTokens, val user: User) : AuthOutcome

    /** The backend returned `userErrors` (e.g. INVALID_CREDENTIALS). */
    data class Rejected(val errors: List<UserError>) : AuthOutcome
}

/**
 * Authentication and viewer-identity calls. The implementation maps the
 * generated Apollo types to domain types; it does not touch token storage —
 * persistence is the use-case layer's job, keeping this a pure network mapper.
 */
interface AuthRepository {
    suspend fun logIn(email: String, password: String, deviceLabel: String?): AuthOutcome

    /**
     * Resolve the current access token to the viewer's own User. Null when the
     * request is unauthenticated or the token no longer resolves.
     */
    suspend fun me(): User?
}
