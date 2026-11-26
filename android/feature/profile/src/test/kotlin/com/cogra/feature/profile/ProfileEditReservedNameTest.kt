package com.cogra.feature.profile

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.UserError
import com.cogra.domain.profile.SignedProfile
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.TEST_PROFILE_ID
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * A reserved display name is refused on the Display name field itself
 * (ProfileEdit.md:81): the name stays typed, the field's line reads
 * "That name isn't available.", nothing is signed, and the line stands
 * through typing until the next press of Save (ProfileEdit.md:85).
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class ProfileEditReservedNameTest {

    @get:Rule
    val compose = createComposeRule()

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private class RefusingProfiles : ThrowingProfileRepository() {
        var prepareOutcome: Outcome<List<PreparedWriteView>> = Outcome.Refused(emptyList())
        var prepareCalls = 0

        override suspend fun myProfile(): Outcome<ProfileView?> =
            Outcome.Success(testProfile(id = TEST_PROFILE_ID, handle = "jakob", displayName = "Jakob"))

        override suspend fun prepareProfileUpdate(
            displayName: String,
            bio: String?,
            websiteUrl: String?,
            avatar: MediaFieldUpdate,
        ): Outcome<List<PreparedWriteView>> {
            prepareCalls += 1
            return prepareOutcome
        }
    }

    private val profiles = RefusingProfiles()
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", TEST_PROFILE_ID) }

    private fun reserved(field: List<String>? = listOf("displayName")) =
        Outcome.Refused(listOf(UserError(ErrorCode.DISPLAY_NAME_RESERVED, "the display name is reserved", field)))

    private fun viewModel() = ProfileEditViewModel(
        profiles,
        ThrowingMediaRepository(),
        ThrowingMediaProcessor(),
        WriteSigner(sealer, identity),
        SignedProfile(session, TestScope(dispatcher)),
        ProfileChanges(session, TestScope(dispatcher)),
        identity,
    )

    /** Save opens the seal; its commit signs. */
    private fun ProfileEditViewModel.save() {
        onSubmit()
        seal.onSign()
    }

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    @Test
    fun aReservedNameSetsTheFieldLineAndNoGenericRefusal() = runTest(dispatcher) {
        profiles.prepareOutcome = reserved()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDisplayNameChange("CoGra")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()

        val s = vm.state.value
        assertThat(s.nameReserved).isTrue()
        assertThat(s.fault).isNull()
        // The name's line stands under its field: the edit comes back from the seal.
        assertThat(s.stage).isEqualTo(ProfileEditStage.Form)
        assertThat(s.displayName).isEqualTo("CoGra")
        assertThat(s.signing).isFalse()
        assertThat(s.saved).isFalse()
        assertThat(sealer.staged).isEmpty()
    }

    @Test
    fun typingKeepsTheLine() = runTest(dispatcher) {
        profiles.prepareOutcome = reserved()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDisplayNameChange("CoGra Two")
        assertThat(vm.state.value.nameReserved).isTrue()
        assertThat(vm.state.value.displayName).isEqualTo("CoGra Two")
    }

    @Test
    fun theNextSavePressClearsIt() = runTest(dispatcher) {
        profiles.prepareOutcome = reserved()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        profiles.prepareOutcome = Outcome.Success(emptyList())
        vm.onDisplayNameChange("Someone")
        vm.onSubmit()
        assertThat(vm.state.value.nameReserved).isFalse()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.nameReserved).isFalse()
    }

    @Test
    fun aSavePressThatStopsAtTheEmptyNameGuardStillClearsIt() = runTest(dispatcher) {
        profiles.prepareOutcome = reserved()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.nameReserved).isTrue()

        vm.onDisplayNameChange("")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.emptyName).isTrue()
        assertThat(vm.state.value.nameReserved).isFalse()

        vm.onDisplayNameChange("A new name")
        assertThat(vm.state.value.nameReserved).isFalse()
    }

    @Test
    fun anotherCodeReadsAsTheSealsBugNotice() = runTest(dispatcher) {
        profiles.prepareOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no fields", listOf("displayName"))))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Bug)
        assertThat(vm.state.value.nameReserved).isFalse()
    }

    @Test
    fun theReservedCodeOnAnotherFieldReadsAsTheBugNotice() = runTest(dispatcher) {
        profiles.prepareOutcome = reserved(field = listOf("bio"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Bug)
        assertThat(vm.state.value.nameReserved).isFalse()
    }

    @Test
    fun theFieldTakesTheLineAndNoGenericRefusalRenders() {
        compose.setContent {
            ProfileEditScreen(
                state = ProfileEditUiState(loading = false, displayName = "CoGra", nameReserved = true),
                onDisplayNameChange = {},
                onBioChange = {},
                onWebsiteChange = {},
                onPickAvatar = {},
                onClearAvatar = {},
                onSubmit = {},
                onRetry = {},
                onBack = {},
            )
        }
        compose.onNodeWithTag("profile_edit_display_name_error").assertTextEquals("That name isn't available.")
        compose.onNodeWithTag("profile_edit_refused").assertDoesNotExist()
    }
}
