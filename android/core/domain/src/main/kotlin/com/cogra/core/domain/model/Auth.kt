package com.cogra.core.domain.model

/**
 * The session token pair. The access token is a short-lived JWT sent as a
 * Bearer header; the refresh token is opaque and rotated on every use, so the
 * client must overwrite its stored copy each refresh (auth.md §Tokens).
 */
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
)

/**
 * The one error vocabulary shared across both error tiers, mirroring the
 * schema's `ErrorCode`. [UNKNOWN] is a client-only fallback for a code this
 * build of the app does not recognize, so a newer server never crashes an
 * older client.
 */
enum class ErrorCode {
    UNAUTHENTICATED,
    FORBIDDEN,
    NOT_FOUND,
    BAD_INPUT,
    RATE_LIMITED,
    INTERNAL,
    INVALID_CREDENTIALS,
    INVITE_UNUSABLE,
    HANDLE_TAKEN,
    WEAK_PASSWORD,
    REGISTRATION_IN_PROGRESS,
    VERIFICATION_TOKEN_INVALID,
    REFRESH_TOKEN_INVALID,
    UNKNOWN,
}

/**
 * A recoverable, expected failure the end user should see and act on,
 * mirroring the schema's `UserError`. [field] points at the offending input
 * (e.g. `["email"]`) or is empty for a whole-operation failure.
 */
data class UserError(
    val message: String,
    val code: ErrorCode,
    val field: List<String> = emptyList(),
)
