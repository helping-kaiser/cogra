package com.cogra.feature.profile.avatar

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
import com.cogra.domain.media.CropWindow
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

/**
 * The profile-picture flow, end to end on the JVM.
 *
 * The rule worth pinning hardest is [AvatarFlowViewModel]'s own reason
 * for holding the profile: `prepareProfileUpdate` is complete-state, so
 * an avatar-only change that forgot the bio would silently clear it.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AvatarFlowViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private class ScriptedProfiles(private val sealer: SealingWriteRepository) :
        ThrowingProfileRepository() {
        var mine: Outcome<ProfileView?> = Outcome.Success(
            testProfile(
                id = "u1",
                handle = "jakob",
                displayName = "Jakob",
                bio = "Old bio",
                websiteUrl = "https://example.test",
            ),
        )
        var prepareOutcome: Outcome<List<PreparedWriteView>>? = null
        var lastUpdate: Triple<String, String?, String?>? = null
        var lastAvatar: MediaFieldUpdate? = null
        var prepareCalls = 0

        override suspend fun myProfile(): Outcome<ProfileView?> = mine

        override suspend fun prepareProfileUpdate(
            displayName: String,
            bio: String?,
            websiteUrl: String?,
            avatar: MediaFieldUpdate,
        ): Outcome<List<PreparedWriteView>> {
            prepareCalls += 1
            lastUpdate = Triple(displayName, bio, websiteUrl)
            lastAvatar = avatar
            return prepareOutcome ?: Outcome.Success(listOf(sealer.stage(Family.REGISTRATION)))
        }
    }

    private class ScriptedMedia : ThrowingMediaRepository() {
        var outcome: Outcome<MediaAssetView> = Outcome.Success(
            MediaAssetView("m1", "https://media/m1", null, FieldStatus.NORMAL, 1f),
        )
        var calls = 0

        override suspend fun uploadMedia(picture: ProcessedPicture): Outcome<MediaAssetView> {
            calls += 1
            return outcome
        }
    }

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
        AvatarFlowViewModel(profiles, media, processor, WriteSigner(sealer, identity))

    /** Picked, cropped, and stepped on to the seal — the happy path's setup. */
    private fun startedAtSeal(crop: CropSpec? = null): AvatarFlowViewModel {
        val vm = viewModel()
        vm.start()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onPicked("content://pick/1")
        crop?.let { vm.onCropCommitted(it) }
        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()
        return vm
    }

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    // -- The stages --

    @Test
    fun pickingResetsTheFlowToAFreshCropStage() = runTest(dispatcher) {
        val vm = startedAtSeal()
        assertThat(vm.state.value.step).isEqualTo(AvatarStep.Seal)

        vm.onPicked("content://pick/2")

        val s = vm.state.value
        assertThat(s.step).isEqualTo(AvatarStep.Crop)
        assertThat(s.uri).isEqualTo("content://pick/2")
        assertThat(s.upload).isEqualTo(AvatarUpload.Idle)
    }

    @Test
    fun backStepsOnceAndThenReportsUnhandledSoTheRouteLeaves() = runTest(dispatcher) {
        val vm = startedAtSeal()

        assertThat(vm.onBack()).isTrue()
        assertThat(vm.state.value.step).isEqualTo(AvatarStep.Crop)
        // Nothing earlier than the crop: the route takes it from here.
        assertThat(vm.onBack()).isFalse()
    }

    @Test
    fun theFramingSurvivesSteppingOnAndBack() = runTest(dispatcher) {
        val window = CropWindow(0.1f, 0.1f, 0.9f, 0.9f)
        val vm = startedAtSeal(CropSpec(targetRatio = 1f, window = window))

        vm.onBack()

        assertThat(vm.state.value.crop?.window).isEqualTo(window)
    }

    @Test
    fun nextWithNothingPickedDoesNothing() = runTest(dispatcher) {
        val vm = viewModel()

        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.step).isEqualTo(AvatarStep.Crop)
        assertThat(media.calls).isEqualTo(0)
    }

    // -- The upload --

    @Test
    fun leavingTheCropStageUploadsTheFramedPicture() = runTest(dispatcher) {
        val window = CropWindow(0.2f, 0.2f, 0.8f, 0.8f)
        val vm = startedAtSeal(CropSpec(targetRatio = 1f, window = window))

        assertThat(media.calls).isEqualTo(1)
        assertThat(processor.lastCrop?.window).isEqualTo(window)
        assertThat(vm.state.value.upload).isEqualTo(AvatarUpload.Done("m1"))
        assertThat(vm.state.value.canSign).isTrue()
    }

    /** The circle is a mask on a square, so an untouched crop is still 1:1. */
    @Test
    fun anUntouchedCropUploadsTheSquare() = runTest(dispatcher) {
        startedAtSeal()

        assertThat(processor.lastCrop?.targetRatio).isEqualTo(1f)
        assertThat(processor.lastCrop?.window).isNull()
    }

    @Test
    fun bytesThatDoNotDecodeNeverReachTheWire() = runTest(dispatcher) {
        processor.processed = null
        val vm = startedAtSeal()

        assertThat(media.calls).isEqualTo(0)
        assertThat(vm.state.value.upload).isInstanceOf(AvatarUpload.Failed::class.java)
        assertThat(vm.state.value.canSign).isFalse()
    }

    @Test
    fun aRefusedUploadCarriesTheServersOwnWords() = runTest(dispatcher) {
        media.outcome = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "too large")))
        val vm = startedAtSeal()

        assertThat((vm.state.value.upload as AvatarUpload.Failed).message).isEqualTo("too large")
        assertThat(vm.state.value.problem).isEqualTo("too large")
    }

    @Test
    fun aFailedUploadCanBeRetriedOnItsOwn() = runTest(dispatcher) {
        media.outcome = Outcome.Failed(IOException("down"))
        val vm = startedAtSeal()
        assertThat(vm.state.value.upload).isInstanceOf(AvatarUpload.Failed::class.java)

        media.outcome = Outcome.Success(
            MediaAssetView("m2", "https://media/m2", null, FieldStatus.NORMAL, 1f),
        )
        vm.onRetryUpload()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.upload).isEqualTo(AvatarUpload.Done("m2"))
    }

    @Test
    fun anAlreadyLandedPictureIsNotUploadedTwice() = runTest(dispatcher) {
        val vm = startedAtSeal()
        assertThat(media.calls).isEqualTo(1)

        vm.onRetryUpload()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.calls).isEqualTo(1)
    }

    // -- The seal --

    /** The reason the profile is held at all. */
    @Test
    fun theSignedUpdateResendsEveryFieldBesideTheNewPicture() = runTest(dispatcher) {
        val vm = startedAtSeal()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.lastUpdate)
            .isEqualTo(Triple("Jakob", "Old bio", "https://example.test"))
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Set("m1"))
        assertThat(vm.state.value.saved).isTrue()
    }

    /**
     * Without the held profile there is nothing safe to send: a bare
     * picture would clear the bio the author never touched.
     */
    @Test
    fun aProfileThatCouldNotBeReadStopsTheSignRatherThanClearingFields() = runTest(dispatcher) {
        profiles.mine = Outcome.Failed(IOException("down"))
        val vm = startedAtSeal()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun signingWaitsForThePicturesId() = runTest(dispatcher) {
        processor.processed = null
        val vm = startedAtSeal()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(vm.state.value.submitting).isFalse()
    }

    @Test
    fun aRefusedChangeSurfacesTheServersWordsAndSignsNothing() = runTest(dispatcher) {
        profiles.prepareOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "handle is moderated")))
        val vm = startedAtSeal()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        val s = vm.state.value
        assertThat(s.refusal).isEqualTo("handle is moderated")
        assertThat(s.submitting).isFalse()
        assertThat(s.saved).isFalse()
    }

    @Test
    fun aFailedPrepareIsATransportFaultRatherThanARefusal() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Failed(IOException("down"))
        val vm = startedAtSeal()

        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.transportFailed).isTrue()
        assertThat(vm.state.value.refusal).isNull()
    }

    @Test
    fun theSavedFlagIsAOneShot() = runTest(dispatcher) {
        val vm = startedAtSeal()
        vm.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()

        vm.onSavedConsumed()

        assertThat(vm.state.value.saved).isFalse()
    }
}
