package com.cogra.core.domain.usecase

import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.User
import com.cogra.core.domain.model.UserError
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.repository.AuthRepository
import com.cogra.core.domain.repository.TokenStore
import javax.inject.Inject

/** Outcome of a login attempt as the UI consumes it. */
sealed interface LoginResult {
    data class Success(val user: User) : LoginResult

    /** Expected, user-actionable failures: client validation or server
     *  `userErrors`, both expressed in the one [UserError] vocabulary. */
    data class Rejected(val errors: List<UserError>) : LoginResult

    /** A transport or unexpected fault — nothing the user can correct. */
    data class Failure(val cause: Throwable) : LoginResult
}

/**
 * Logs in and, on success, persists the issued tokens. Client-side validation
 * runs first so an empty form never hits the network; server `userErrors`
 * (e.g. INVALID_CREDENTIALS) and transport faults are kept distinct so the UI
 * can react differently to each.
 */
class LogInUseCase @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenStore: TokenStore,
) {
    suspend operator fun invoke(
        email: String,
        password: String,
        deviceLabel: String? = null,
    ): LoginResult {
        val validationErrors = validate(email, password)
        if (validationErrors.isNotEmpty()) return LoginResult.Rejected(validationErrors)

        return try {
            when (val outcome = authRepository.logIn(email.trim(), password, deviceLabel)) {
                is AuthOutcome.Authenticated -> {
                    tokenStore.save(outcome.tokens)
                    LoginResult.Success(outcome.user)
                }
                is AuthOutcome.Rejected -> LoginResult.Rejected(outcome.errors)
            }
        } catch (cancellation: kotlinx.coroutines.CancellationException) {
            throw cancellation
        } catch (t: Throwable) {
            LoginResult.Failure(t)
        }
    }

    private fun validate(email: String, password: String): List<UserError> {
        val errors = mutableListOf<UserError>()
        if (email.isBlank()) {
            errors += UserError("Email is required.", ErrorCode.BAD_INPUT, listOf("email"))
        }
        if (password.isEmpty()) {
            errors += UserError("Password is required.", ErrorCode.BAD_INPUT, listOf("password"))
        }
        return errors
    }
}
