package com.cogra.feature.profile

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.UserError
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
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

        var lastAvatar: MediaFieldUpdate? = null

        override suspend fun prepareProfileUpdate(
            displayName: String,
            bio: String?,
            websiteUrl: String?,
            avatar: MediaFieldUpdate,
        ): Outcome<List<PreparedWriteView>> {
            lastUpdate = Triple(displayName, bio, websiteUrl)
            lastAvatar = avatar
            return prepareOutcome ?: Outcome.Success(listOf(sealer.stage(Family.REGISTRATION)))
        }
    }

    /** The upload half of the avatar path, scripted per test. */
    private class ScriptedMedia : ThrowingMediaRepository() {
        var outcome: Outcome<MediaAssetView> = Outcome.Success(
            MediaAssetView("m1", "https://media/m1", null, FieldStatus.NORMAL, 1f),
        )
        var calls = 0

        override suspend fun uploadMedia(
            picture: ProcessedPicture,
            altText: String?,
        ): Outcome<MediaAssetView> {
            calls += 1
            return outcome
        }
    }

    /** The pipeline, scripted: null is "these bytes are not a picture". */
    private class ScriptedProcessor : ThrowingMediaProcessor() {
        var processed: ProcessedPicture? = ProcessedPicture(ByteArray(4), 100, 100)
        var lastCrop: CropSpec? = null

        override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? {
            lastCrop = crop
            return processed
        }
    }

    private val profiles = ScriptedProfiles(sealer)
    private val media = ScriptedMedia()
    private val processor = ScriptedProcessor()

    private fun viewModel() =
        ProfileEditViewModel(profiles, media, processor, WriteSigner(sealer, identity))

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

    // -- The three-valued profile media fields (D13) --
    //
    // The whole point of the type is that "leave it alone" and "clear
    // it" are different requests, and only one of the three states
    // sends anything at all. Each arm is pinned separately, because a
    // bug here silently deletes someone's picture.

    @Test
    fun anUntouchedPictureSendsNothing() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Untouched)
        assertThat(media.calls).isEqualTo(0)
    }

    @Test
    fun aClearedPictureSendsTheExplicitClear() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarCleared()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Clear)
    }

    @Test
    fun aPickedPictureUploadsAndSendsItsId() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Set("m1"))
        assertThat(media.calls).isEqualTo(1)
    }

    @Test
    fun theAvatarCropIsSquare() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(processor.lastCrop?.targetRatio).isEqualTo(1f)
    }

    @Test
    fun aFailedUploadLeavesThePictureUntouchedRatherThanCleared() = runTest(dispatcher) {
        media.outcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        // A failed upload must never read as a clear: the account keeps
        // whatever picture it had.
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Untouched)
        assertThat(vm.state.value.avatar).isInstanceOf(ProfileImageState.Failed::class.java)
    }

    @Test
    fun savingWaitsForAPictureStillOnItsWay() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        // The upload has not run yet: submitting now would name no id.
        vm.onSubmit()
        assertThat(vm.state.value.imagesPending).isTrue()
        assertThat(profiles.lastUpdate).isNull()
    }

    @Test
    fun undecodableBytesNeverReachTheWire() = runTest(dispatcher) {
        processor.processed = null
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(media.calls).isEqualTo(0)
        assertThat(vm.state.value.avatar).isInstanceOf(ProfileImageState.Failed::class.java)
    }
}
