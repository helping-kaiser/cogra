package com.cogra.core.domain.repository

import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.model.ProfileEdits
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
 * The result of an `editProfile` mutation. As with [AuthOutcome], transport
 * faults are NOT modeled — the repository throws those (an UNAUTHENTICATED
 * fault rides the transport tier, so the refresh-and-replay interceptor sees
 * it); the use-case decides how to surface them.
 */
sealed interface EditProfileOutcome {
    /** The edit landed; the updated viewer is returned. */
    data class Updated(val user: User) : EditProfileOutcome

    /** The backend rejected the edit (e.g. HANDLE_TAKEN, BAD_INPUT). */
    data class Rejected(val errors: List<UserError>) : EditProfileOutcome
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

    /**
     * Append a new layer to the viewer's own profile. Only the changed fields
     * in [edits] are sent; omitted fields are untouched server-side.
     */
    suspend fun editProfile(edits: ProfileEdits): EditProfileOutcome
}
