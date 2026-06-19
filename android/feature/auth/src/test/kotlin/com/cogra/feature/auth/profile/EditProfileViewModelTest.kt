package com.cogra.feature.auth.profile

import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.UserError
import com.cogra.core.domain.repository.EditProfileOutcome
import com.cogra.core.domain.usecase.EditProfileUseCase
import com.cogra.core.domain.usecase.GetMyProfileUseCase
import com.cogra.feature.auth.testutil.FakeAuthRepository
import com.cogra.feature.auth.testutil.MainDispatcherRule
import com.cogra.feature.auth.testutil.testUser
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import java.io.IOException

class EditProfileViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    // testUser(): handle "alice", displayName "Alice", bio "hello world", website null.
    private val repository = FakeAuthRepository()

    private fun viewModel() =
        EditProfileViewModel(GetMyProfileUseCase(repository), EditProfileUseCase(repository))

    @Test
    fun `prefills the form from the current profile`() = runTest {
        val vm = viewModel()
        advanceUntilIdle()

        val state = vm.state.value
        assertThat(state.isLoading).isFalse()
        assertThat(state.handle).isEqualTo("alice")
        assertThat(state.displayName).isEqualTo("Alice")
        assertThat(state.bio).isEqualTo("hello world")
        assertThat(state.websiteUrl).isEqualTo("")
        assertThat(state.canSave).isFalse()
    }

    @Test
    fun `canSave stays false until a field actually changes`() = runTest {
        val vm = viewModel()
        advanceUntilIdle()

        // Re-typing the original value is not a change.
        vm.onDisplayNameChange("Alice")
        assertThat(vm.state.value.canSave).isFalse()

        vm.onDisplayNameChange("Alice B.")
        assertThat(vm.state.value.canSave).isTrue()
    }

    @Test
    fun `a blank display name disables save`() = runTest {
        val vm = viewModel()
        advanceUntilIdle()

        vm.onDisplayNameChange("   ")
        assertThat(vm.state.value.canSave).isFalse()
    }

    @Test
    fun `save sends only the changed fields and marks saved`() = runTest {
        repository.editProfileOutcome = EditProfileOutcome.Updated(testUser())
        val vm = viewModel()
        advanceUntilIdle()

        vm.onBioChange("new bio")
        vm.onSave()
        advanceUntilIdle()

        assertThat(vm.state.value.saved).isTrue()
        val edits = repository.lastEdits!!
        assertThat(edits.bio).isEqualTo("new bio")
        assertThat(edits.displayName).isNull()
        assertThat(edits.handle).isNull()
        assertThat(edits.websiteUrl).isNull()
    }

    @Test
    fun `clearing the bio sends an empty string`() = runTest {
        repository.editProfileOutcome = EditProfileOutcome.Updated(testUser())
        val vm = viewModel()
        advanceUntilIdle()

        vm.onBioChange("")
        assertThat(vm.state.value.canSave).isTrue()
        vm.onSave()
        advanceUntilIdle()

        assertThat(repository.lastEdits!!.bio).isEqualTo("")
    }

    @Test
    fun `a rejected edit surfaces a localized message and is not saved`() = runTest {
        repository.editProfileOutcome = EditProfileOutcome.Rejected(
            listOf(UserError("x", ErrorCode.HANDLE_TAKEN, listOf("handle"))),
        )
        val vm = viewModel()
        advanceUntilIdle()

        vm.onHandleChange("taken")
        vm.onSave()
        advanceUntilIdle()

        assertThat(vm.state.value.saved).isFalse()
        assertThat(vm.state.value.isSubmitting).isFalse()
        assertThat(vm.state.value.errorMessage).isEqualTo("That handle is already taken.")
    }

    @Test
    fun `a transport failure surfaces a connection message`() = runTest {
        repository.editProfileThrows = IOException("offline")
        val vm = viewModel()
        advanceUntilIdle()

        vm.onBioChange("changed")
        vm.onSave()
        advanceUntilIdle()

        assertThat(vm.state.value.errorMessage)
            .isEqualTo("Couldn't reach the server. Check your connection.")
    }

    @Test
    fun `a prefill failure shows the load error`() = runTest {
        repository.meThrows = IOException("offline")
        val vm = viewModel()
        advanceUntilIdle()

        assertThat(vm.state.value.isLoading).isFalse()
        assertThat(vm.state.value.loadError).isTrue()
    }
}
