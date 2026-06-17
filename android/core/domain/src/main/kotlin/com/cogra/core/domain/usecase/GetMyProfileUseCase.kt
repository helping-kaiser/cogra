package com.cogra.core.domain.usecase

import com.cogra.core.domain.model.User
import com.cogra.core.domain.repository.AuthRepository
import javax.inject.Inject

/** Result of loading the viewer's own profile. */
sealed interface ProfileResult {
    data class Loaded(val user: User) : ProfileResult

    /** Authenticated request resolved to no viewer — token missing or stale. */
    data object Unauthenticated : ProfileResult

    data class Failure(val cause: Throwable) : ProfileResult
}

/** Loads the viewer's own User via the `me` query. */
class GetMyProfileUseCase @Inject constructor(
    private val authRepository: AuthRepository,
) {
    suspend operator fun invoke(): ProfileResult =
        try {
            authRepository.me()?.let(ProfileResult::Loaded) ?: ProfileResult.Unauthenticated
        } catch (cancellation: kotlinx.coroutines.CancellationException) {
            throw cancellation
        } catch (t: Throwable) {
            ProfileResult.Failure(t)
        }
}
