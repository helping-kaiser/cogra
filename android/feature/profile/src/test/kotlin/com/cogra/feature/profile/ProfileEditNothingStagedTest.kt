package com.cogra.feature.profile

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.MediaFieldUpdate
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The edit signs only when a change is staged, never by comparing the fields'
 * bytes (ProfileEdit.md:39-49): with nothing staged Save stands visible and
 * inert under `Nothing to sign yet` and the seal never opens; a change staged
 * and typed back still signs, the row naming the staged parts
 * (ProfileEditSeal.md:5).
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ProfileEditNothingStagedTest : ProfileEditHarness() {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theEditOpensWithNothingStaged() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.anythingStaged).isFalse()
        assertThat(vm.state.value.canSubmit).isFalse()
    }

    @Test
    fun saveWithNothingStagedNeverOpensTheSealAndSignsNothing() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Form)
        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(sealer.staged).isEmpty()
    }

    @Test
    fun aChangeTypedBackStillSignsAndTheRowNamesIt() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("New bio")
        vm.onBioChange("Old bio")
        vm.onSubmit()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Seal)
        assertThat(vm.state.value.changeSummary).isEqualTo("A new bio")
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(vm.state.value.saved).isTrue()
    }

    /** The row names what is staged, not what differs: a field never typed in is never named. */
    @Test
    fun theRowNamesOnlyTheStagedParts() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onWebsiteChange("https://ada.example")
        assertThat(vm.state.value.changeSummary).isEqualTo("A new website")
    }

    @Test
    fun theRemovedPictureAloneIsStaged() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarCleared()
        vm.onSubmit()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Seal)
        assertThat(vm.state.value.changeSummary).isEqualTo("The picture removed")
    }

    @Test
    fun aNewPictureAloneIsStaged() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Set("m1"))
    }

    // -- The form as drawn (ProfileEdit.jsx, `rest` and `changed`) --

    private fun render(state: ProfileEditUiState, onSubmit: () -> Unit = {}) {
        compose.setContent {
            ProfileEditScreen(
                state = state,
                onDisplayNameChange = {},
                onBioChange = {},
                onWebsiteChange = {},
                onPickAvatar = {},
                onClearAvatar = {},
                onSubmit = onSubmit,
                onRetry = {},
                onBack = {},
            )
        }
    }

    @Test
    fun atRestTheLineStandsOnAnInertSave() {
        var presses = 0
        render(ProfileEditUiState(loading = false, displayName = "Sol"), onSubmit = { presses += 1 })
        compose.onNodeWithTag("profileEdit.acts.line").performScrollTo().assertTextEquals("Nothing to sign yet")
        compose.onNodeWithTag("profile_edit_save").performScrollTo().assertIsNotEnabled().performClick()
        assertThat(presses).isEqualTo(0)
    }

    @Test
    fun aStagedChangeTakesTheLineAwayAndSaveAnswers() {
        render(ProfileEditUiState(loading = false, displayName = "Sol", staged = setOf(ProfileField.Bio)))
        compose.onNodeWithTag("profileEdit.acts.line").assertDoesNotExist()
        compose.onNodeWithTag("profile_edit_save").performScrollTo().assertIsEnabled()
    }

    @Test
    fun aStagedRemovalTakesTheLineAwayToo() {
        render(ProfileEditUiState(loading = false, displayName = "Sol", avatar = ProfileImageState.Cleared))
        compose.onNodeWithTag("profileEdit.acts.line").assertDoesNotExist()
        compose.onNodeWithTag("profile_edit_save").performScrollTo().assertIsEnabled()
    }
}
