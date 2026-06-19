package com.cogra.core.domain.usecase

import com.cogra.core.domain.fake.FakeAuthRepository
import com.cogra.core.domain.fake.testUser
import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.ProfileEdits
import com.cogra.core.domain.model.UserError
import com.cogra.core.domain.repository.EditProfileOutcome
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException

class EditProfileUseCaseTest {

    private val repository = FakeAuthRepository()
    private fun useCase() = EditProfileUseCase(repository)

    @Test
    fun `an empty change set is rejected without touching the network`() = runTest {
        // editProfileOutcome is unconfigured: if the repository were called it
        // would error, so a clean Rejected proves the guard short-circuits.
        val result = useCase().invoke(ProfileEdits())

        assertThat(result).isInstanceOf(EditProfileResult.Rejected::class.java)
        assertThat((result as EditProfileResult.Rejected).errors.single().code)
            .isEqualTo(ErrorCode.BAD_INPUT)
    }

    @Test
    fun `a successful edit returns the updated user`() = runTest {
        val updated = testUser(handle = "neo")
        repository.editProfileOutcome = EditProfileOutcome.Updated(updated)

        val result = useCase().invoke(ProfileEdits(displayName = "Neo"))

        assertThat(result).isEqualTo(EditProfileResult.Success(updated))
    }

    @Test
    fun `server userErrors map to Rejected`() = runTest {
        repository.editProfileOutcome = EditProfileOutcome.Rejected(
            listOf(UserError("taken", ErrorCode.HANDLE_TAKEN, listOf("handle"))),
        )

        val result = useCase().invoke(ProfileEdits(handle = "taken"))

        assertThat(result).isInstanceOf(EditProfileResult.Rejected::class.java)
        assertThat((result as EditProfileResult.Rejected).errors.single().code)
            .isEqualTo(ErrorCode.HANDLE_TAKEN)
    }

    @Test
    fun `a transport fault maps to Failure`() = runTest {
        repository.editProfileThrows = IOException("offline")

        val result = useCase().invoke(ProfileEdits(bio = "hi"))

        assertThat(result).isInstanceOf(EditProfileResult.Failure::class.java)
    }
}
