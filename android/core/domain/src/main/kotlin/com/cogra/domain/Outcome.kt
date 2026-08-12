// The two-tier error model of the API, on the client side
// (api-spec.md "Errors are tiered"): expected business outcomes ride as
// data (`Refused`), transport faults as `Failed`. Repositories return
// this; use-cases and ViewModels branch on it.

package com.cogra.domain

/** The shared error vocabulary (api-spec.md `ErrorCode`). */
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
    EMAIL_IN_USE,
    ACTOR_KEY_IN_USE,
    VERIFICATION_TOKEN_INVALID,
    RESET_TOKEN_INVALID,
    REFRESH_TOKEN_INVALID,
    WRITE_RULE_FAILED,
    STAGED_WRITE_EXPIRED,
    SIGNATURE_INVALID,

    /** A code this client version does not know — treat as INTERNAL. */
    UNKNOWN,
}

/**
 * An expected business refusal, carried as data on the payload. The
 * client localizes off [code]; [message] is developer-facing.
 */
data class UserError(
    val code: ErrorCode,
    val message: String,
    /** Path into the nested input naming the offender; null for a whole-operation failure. */
    val field: List<String>? = null,
)

/** The result of one API call, by tier. */
sealed interface Outcome<out T> {
    /** The mutation succeeded; `userErrors` was empty. */
    data class Success<T>(val value: T) : Outcome<T>

    /** The API refused with expected business outcomes. */
    data class Refused(val errors: List<UserError>) : Outcome<Nothing>

    /** Transport failed — network, server fault; retryable. */
    data class Failed(val cause: Exception) : Outcome<Nothing>
}

/** The success value, or null on any refusal or failure. */
fun <T> Outcome<T>.valueOrNull(): T? = (this as? Outcome.Success)?.value

/** Transforms the success value; refusals and failures pass through. */
inline fun <T, R> Outcome<T>.map(transform: (T) -> R): Outcome<R> = when (this) {
    is Outcome.Success -> Outcome.Success(transform(value))
    is Outcome.Refused -> this
    is Outcome.Failed -> this
}

/** Chains an outcome-producing step; refusals and failures pass through. */
inline fun <T, R> Outcome<T>.flatMap(transform: (T) -> Outcome<R>): Outcome<R> = when (this) {
    is Outcome.Success -> transform(value)
    is Outcome.Refused -> this
    is Outcome.Failed -> this
}

fun Outcome.Refused.has(code: ErrorCode): Boolean = errors.any { it.code == code }
