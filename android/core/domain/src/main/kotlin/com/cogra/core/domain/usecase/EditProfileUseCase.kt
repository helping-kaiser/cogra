package com.cogra.core.domain.usecase

import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.ProfileEdits
import com.cogra.core.domain.model.User
import com.cogra.core.domain.model.UserError
import com.cogra.core.domain.repository.AuthRepository
import com.cogra.core.domain.repository.EditProfileOutcome
import javax.inject.Inject

/** Outcome of an edit-profile attempt as the UI consumes it. */
sealed interface EditProfileResult {
    data class Success(val user: User) : EditProfileResult

    /** Expected, user-actionable failures: server `userErrors` (HANDLE_TAKEN,
     *  BAD_INPUT) or the client's no-changes guard. */
    data class Rejected(val errors: List<UserError>) : EditProfileResult

    /** A transport or unexpected fault — nothing the user can correct. */
    data class Failure(val cause: Throwable) : EditProfileResult
}

/**
 * Applies a set of profile edits. An empty change set never hits the network —
 * the backend would reject it as BAD_INPUT, and the screen already gates Save
 * on having changes, so this is the defensive floor. Server `userErrors` and
 * transport faults are kept distinct so the UI can react to each.
 */
class EditProfileUseCase @Inject constructor(
    private val authRepository: AuthRepository,
) {
    suspend operator fun invoke(edits: ProfileEdits): EditProfileResult {
        if (!edits.hasChanges) {
            return EditProfileResult.Rejected(
                listOf(UserError("No changes to save.", ErrorCode.BAD_INPUT)),
            )
        }
        return try {
            when (val outcome = authRepository.editProfile(edits)) {
                is EditProfileOutcome.Updated -> EditProfileResult.Success(outcome.user)
                is EditProfileOutcome.Rejected -> EditProfileResult.Rejected(outcome.errors)
            }
        } catch (cancellation: kotlinx.coroutines.CancellationException) {
            throw cancellation
        } catch (t: Throwable) {
            EditProfileResult.Failure(t)
        }
    }
}
