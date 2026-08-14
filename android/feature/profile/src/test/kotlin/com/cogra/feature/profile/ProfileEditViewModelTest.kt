package com.cogra.feature.profile

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.UserError
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileEditViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private class ScriptedProfiles(private val sealer: SealingWriteRepository) :
        ThrowingProfileRepository() {
        var mine: Outcome<ProfileView?> = Outcome.Success(
            testProfile(id = "u1", handle = "jakob", displayName = "Jakob", bio = "Old bio"),
        )
        var prepareOutcome: Outcome<List<PreparedWriteView>>? = null
        var lastUpdate: Triple<String, String?, String?>? = null

        override suspend fun myProfile(): Outcome<ProfileView?> = mine

        override suspend fun prepareProfileUpdate(
            displayName: String,
            bio: String?,
            websiteUrl: String?,
        ): Outcome<List<PreparedWriteView>> {
            lastUpdate = Triple(displayName, bio, websiteUrl)
            return prepareOutcome ?: Outcome.Success(listOf(sealer.stage(Family.REGISTRATION)))
        }
    }

    private val profiles = ScriptedProfiles(sealer)

    private fun viewModel() = ProfileEditViewModel(profiles, WriteSigner(sealer, identity))

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    @Test
    fun theFormPrefillsFromTheCurrentVersion() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        val s = vm.state.value
        assertThat(s.displayName).isEqualTo("Jakob")
        assertThat(s.bio).isEqualTo("Old bio")
        assertThat(s.websiteUrl).isEmpty()
    }

    @Test
    fun aBlankDisplayNameRefusesLocally() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDisplayNameChange("  ")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.emptyName).isTrue()
        assertThat(profiles.lastUpdate).isNull()
    }

    @Test
    fun aBlankedBioClearsAndTheSaveSigns() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("")
        vm.onWebsiteChange("https://ada.example")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        // The form holds the full field set: a blanked bio rides null
        // (the wire's explicit clear); the saved one-shot fires.
        assertThat(profiles.lastUpdate).isEqualTo(Triple("Jakob", null, "https://ada.example"))
        assertThat(vm.state.value.saved).isTrue()
        assertThat(sealer.staged.values.single().state.name).isEqualTo("RELAYING")
    }

    @Test
    fun aRefusedPrepareSurfaces() = runTest(dispatcher) {
        profiles.prepareOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no fields")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.refused).isTrue()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aTransportFaultOnSubmitSurfaces() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.transportFailed).isTrue()
    }
}
