package com.cogra.feature.profile.avatar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.MediaAssetView
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.UserError
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.CropWindow
import com.cogra.domain.media.PICTURE_MAX_BYTES
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.profile.Setting
import com.cogra.domain.profile.SignedPicture
import com.cogra.domain.profile.SignedProfile
import com.cogra.domain.profile.SignedProfileFields
import com.cogra.domain.profile.over
import com.cogra.domain.signing.SentProfile
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.known
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.SealingWriteRepository
import com.cogra.domain.testing.TEST_PROFILE_ID
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingMediaRepository
import com.cogra.domain.testing.ThrowingProfileRepository
import com.cogra.domain.testing.faithfulProfileUpdate
import com.cogra.domain.testing.fakeUpload
import com.cogra.domain.testing.testProfile
import com.cogra.feature.profile.ProfileChangeLine
import com.cogra.feature.profile.ProfileChanges
import com.cogra.feature.profile.ProfileSealFault
import com.cogra.feature.profile.SealGate
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.io.IOException

/**
 * The profile-picture flow, end to end on the JVM.
 *
 * The rule worth pinning hardest is the signing's own reason for reading the
 * profile: `prepareProfileUpdate` is complete-state, so an avatar-only change
 * that forgot the bio would silently clear it. The seal's states follow
 * AvatarSeal.md line by line.
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
                id = TEST_PROFILE_ID,
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
            return prepareOutcome ?: Outcome.Success(
                sealer.stageFaithful(
                    faithfulProfileUpdate(TEST_PROFILE_ID, SentProfile(displayName, bio, websiteUrl, avatar)),
                ),
            )
        }
    }

    private class ScriptedMedia : ThrowingMediaRepository() {
        var outcome: Outcome<MediaAssetView> = Outcome.Success(fakeUpload("m1"))
        var calls = 0

        /** The upload hangs until the test lets it through: a picture still on its way. */
        var gate: CompletableDeferred<Unit>? = null

        override suspend fun uploadMedia(picture: ProcessedPicture): Outcome<MediaAssetView> {
            calls += 1
            gate?.await()
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
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", TEST_PROFILE_ID) }
    private val signedProfile = SignedProfile(session, TestScope(dispatcher))
    private val changes = ProfileChanges(session, TestScope(dispatcher))

    private fun viewModel() = AvatarFlowViewModel(
        profiles,
        media,
        processor,
        WriteSigner(sealer, identity),
        signedProfile,
        identity,
        changes,
        TestScope(dispatcher),
    )

    /** Picked, cropped, and stepped on to the seal — the happy path's setup. */
    private fun startedAtSeal(crop: CropSpec? = null, vm: AvatarFlowViewModel = viewModel()): AvatarFlowViewModel {
        vm.onPicked("content://pick/1")
        crop?.let { vm.onCropCommitted(it) }
        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()
        return vm
    }

    private suspend fun line() = changes.line.first()

    private fun laid() = signedProfile.laid.value.over(TEST_PROFILE_ID)

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

    // -- The upload and its gate (AvatarSeal.md:13-23) --

    @Test
    fun leavingTheCropStageUploadsTheFramedPicture() = runTest(dispatcher) {
        val window = CropWindow(0.2f, 0.2f, 0.8f, 0.8f)
        val vm = startedAtSeal(CropSpec(targetRatio = 1f, window = window))

        assertThat(media.calls).isEqualTo(1)
        assertThat(processor.lastCrop?.window).isEqualTo(window)
        val m1 = fakeUpload("m1")
        assertThat(vm.state.value.upload).isEqualTo(AvatarUpload.Done("m1", m1.known(), m1.url))
        assertThat(vm.state.value.gate).isNull()
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
    fun theSealOpensOnTheRunningGateWithTheCommitEnabled() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        val vm = startedAtSeal()

        assertThat(vm.state.value.upload).isEqualTo(AvatarUpload.Running)
        assertThat(vm.state.value.gate).isEqualTo(SealGate.Uploading)
        assertThat(vm.state.value.canSign).isTrue()
    }

    /** Bytes that are no picture can never be taken: the refused reading, no Retry. */
    @Test
    fun bytesThatDoNotDecodeAreRefusedAndNeverReachTheWire() = runTest(dispatcher) {
        processor.processed = null
        val vm = startedAtSeal()

        assertThat(media.calls).isEqualTo(0)
        assertThat(vm.state.value.gate).isEqualTo(SealGate.Refused)
        assertThat(vm.state.value.canSign).isFalse()
    }

    /**
     * HT-19, jakob's ruling: the profile picture takes the same ten-megabyte
     * cap a post's media does — refused before it leaves, as asking again
     * cannot make it smaller.
     */
    @Test
    fun aPictureOverTheStillCapIsRefusedAndNeverReachesTheWire() = runTest(dispatcher) {
        val overCap = (PICTURE_MAX_BYTES + 1).toInt()
        processor.processed = ProcessedPicture(ByteArray(overCap), 4000, 4000)
        val vm = startedAtSeal()

        assertThat(media.calls).isEqualTo(0)
        assertThat(vm.state.value.gate).isEqualTo(SealGate.Refused)
        assertThat(vm.state.value.canSign).isFalse()
    }

    /** The server refused the picture: the refused reading (:17), its words kept in the state only. */
    @Test
    fun aRefusedUploadIsTheRefusedReading() = runTest(dispatcher) {
        media.outcome = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "too large")))
        val vm = startedAtSeal()

        assertThat(vm.state.value.upload).isEqualTo(AvatarUpload.Refused("too large"))
        assertThat(vm.state.value.gate).isEqualTo(SealGate.Refused)
        assertThat(vm.state.value.canSign).isFalse()
    }

    /** No answer from the upload: the failed reading with Retry; Retry re-gates and signs nothing (:15, :23). */
    @Test
    fun aFailedUploadIsRetriedOnItsOwnAndSignsNothing() = runTest(dispatcher) {
        media.outcome = Outcome.Failed(IOException("down"))
        val vm = startedAtSeal()
        assertThat(vm.state.value.gate).isEqualTo(SealGate.Failed)
        assertThat(vm.state.value.canSign).isFalse()

        media.gate = CompletableDeferred()
        media.outcome = Outcome.Success(fakeUpload("m2"))
        vm.seal.onRetryUpload()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.gate).isEqualTo(SealGate.Uploading)
        assertThat(vm.state.value.canSign).isTrue()

        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        val m2 = fakeUpload("m2")
        assertThat(vm.state.value.upload).isEqualTo(AvatarUpload.Done("m2", m2.known(), m2.url))
        assertThat(profiles.prepareCalls).isEqualTo(0)
    }

    /** The seal opens on the upload already running, not on a copy taken before it started. */
    @Test
    fun theSealOpensOnTheUploadInFlight() = runTest(dispatcher) {
        val vm = viewModel()
        vm.onPicked("content://pick/1")

        vm.onNext()

        assertThat(vm.state.value.step).isEqualTo(AvatarStep.Seal)
        assertThat(vm.state.value.upload).isEqualTo(AvatarUpload.Running)
    }

    /** A new framing after the upload finished sends the picture now framed. */
    @Test
    fun aNewFramingAfterTheUploadSendsTheNewPicture() = runTest(dispatcher) {
        val vm = startedAtSeal(CropSpec(targetRatio = 1f, window = CropWindow(0.1f, 0.1f, 0.9f, 0.9f)))
        assertThat(media.calls).isEqualTo(1)

        vm.onBack()
        val reframed = CropSpec(targetRatio = 1f, window = CropWindow(0.3f, 0.3f, 0.7f, 0.7f))
        vm.onCropCommitted(reframed)
        vm.onNext()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.calls).isEqualTo(2)
        assertThat(processor.lastCrop).isEqualTo(reframed)
    }

    @Test
    fun anAlreadyLandedPictureIsNotUploadedTwice() = runTest(dispatcher) {
        val vm = startedAtSeal()
        assertThat(media.calls).isEqualTo(1)

        vm.seal.onRetryUpload()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.calls).isEqualTo(1)
    }

    // -- The seal's commit --

    /** The reason the profile is read at all. */
    @Test
    fun theSignedUpdateResendsEveryFieldBesideTheNewPicture() = runTest(dispatcher) {
        val vm = startedAtSeal()

        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.lastUpdate).isEqualTo(Triple("Jakob", "Old bio", "https://example.test"))
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Set("m1"))
        assertThat(vm.state.value.saved).isTrue()
        assertThat(vm.state.value.signing).isFalse()
    }

    /**
     * A profile with no bio or website re-states them as cleared, which the
     * server stages as the empty string; the device must sign that rather
     * than refuse its own gesture.
     */
    @Test
    fun aProfileWithoutBioOrWebsiteStillSigns() = runTest(dispatcher) {
        profiles.mine = Outcome.Success(testProfile(id = TEST_PROFILE_ID, handle = "jakob", displayName = "Jakob"))
        val vm = startedAtSeal()

        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.lastUpdate).isEqualTo(Triple("Jakob", null, null))
        assertThat(vm.state.value.fault).isNull()
        assertThat(vm.state.value.saved).isTrue()
    }

    /**
     * Without the profile as it stands there is nothing safe to send: a bare
     * picture would clear the bio the author never touched. No answer is the
     * fault line (:39).
     */
    @Test
    fun aProfileThatCouldNotBeReadStopsTheSignRatherThanClearingFields() = runTest(dispatcher) {
        profiles.mine = Outcome.Failed(IOException("down"))
        val vm = startedAtSeal()

        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Offline)
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aRefusedUploadTakesNoPress() = runTest(dispatcher) {
        processor.processed = null
        val vm = startedAtSeal()

        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(vm.state.value.signing).isFalse()
    }

    /** A press while the upload runs is taken and signs once the picture is up (:13). */
    @Test
    fun aPressWhileTheUploadRunsWaitsForItThenSigns() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        val vm = startedAtSeal()

        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.signing).isTrue()
        assertThat(profiles.prepareCalls).isEqualTo(0)

        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(vm.state.value.saved).isTrue()
    }

    /** The upload fails under a held press: the press drops and nothing is signed (:21). */
    @Test
    fun anUploadFailingUnderAHeldPressDropsThePress() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        media.outcome = Outcome.Failed(IOException("down"))
        val vm = startedAtSeal()

        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        val s = vm.state.value
        assertThat(s.signing).isFalse()
        assertThat(s.saved).isFalse()
        assertThat(s.fault).isNull()
        assertThat(s.gate).isEqualTo(SealGate.Failed)
        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(sealer.staged).isEmpty()
    }

    @Test
    fun theCommitRefusesASecondPressUntilItAnswers() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        val vm = startedAtSeal()
        vm.seal.onSign()
        vm.seal.onSign()
        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(1)
    }

    @Test
    fun theWriteRuleIsItsNoticeAndNotNowRestsTheSeal() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Refused(listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "write rule")))
        val vm = startedAtSeal()
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.WriteRule)

        vm.seal.onNotNow()
        assertThat(vm.state.value.fault).isNull()
        assertThat(vm.state.value.step).isEqualTo(AvatarStep.Seal)
    }

    /** Any other refusal is a bug (:49); its Not now returns the crop with the picture as it was (:51). */
    @Test
    fun aRefusedChangeIsTheBugAndNotNowReturnsTheCrop() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "handle is moderated")))
        val window = CropWindow(0.2f, 0.2f, 0.8f, 0.8f)
        val vm = startedAtSeal(CropSpec(targetRatio = 1f, window = window))
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Bug)
        assertThat(vm.state.value.saved).isFalse()

        vm.seal.onNotNow()
        assertThat(vm.state.value.step).isEqualTo(AvatarStep.Crop)
        assertThat(vm.state.value.crop?.window).isEqualTo(window)
    }

    @Test
    fun aFailedPrepareIsTheFaultLine() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Failed(IOException("down"))
        val vm = startedAtSeal()

        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Offline)
        assertThat(laid()).isNull()
    }

    @Test
    fun theSavedFlagIsAOneShot() = runTest(dispatcher) {
        val vm = startedAtSeal()
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()

        vm.onSavedConsumed()

        assertThat(vm.state.value.saved).isFalse()
    }

    // -- A TAKEN PICTURE IS LAID OVER THE PROFILE'S HEAD (AvatarSeal.md:37) --

    @Test
    fun aTakenPictureLaysThePictureAlone() = runTest(dispatcher) {
        val vm = startedAtSeal()
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.saved).isTrue()
        // The fields re-stated beside it are not the change's.
        assertThat(laid()).isEqualTo(SignedProfileFields(avatar = Setting(SignedPicture("m1", "https://media/m1"))))
    }

    @Test
    fun aPictureThatDidNotSignLaysNothing() = runTest(dispatcher) {
        // The device refuses a payload that is not what the flow re-stated.
        profiles.prepareOutcome = Outcome.Success(
            sealer.stageFaithful(
                faithfulProfileUpdate(
                    TEST_PROFILE_ID,
                    SentProfile("Mallory", "Old bio", "https://example.test", MediaFieldUpdate.Set("m1")),
                ),
            ),
        )
        val vm = startedAtSeal()
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Bug)
        assertThat(signedProfile.laid.value).isNull()
    }

    // -- CLOSE FROM THE PRESS: THE CHANGE GOES ON (AvatarSeal.md:31, :65-:73) --

    /** The ViewModel in a store, cleared the way a popped back-stack entry clears it. */
    private fun stored(store: ViewModelStore): AvatarFlowViewModel =
        ViewModelProvider(
            store,
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = viewModel() as T
            },
        )[AvatarFlowViewModel::class.java]

    @Test
    fun closedWhileItWaitsOnTheUploadTheChangeGoesOnAndLands() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        val landed = mutableListOf<Unit>()
        backgroundScope.launch { changes.landed.collect { landed += it } }
        val store = ViewModelStore()
        val vm = startedAtSeal(vm = stored(store))
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()

        // Back from the press closes the seal: the route leaves, and the entry is cleared.
        assertThat(vm.onBack()).isFalse()
        store.clear()
        assertThat(line()).isEqualTo(ProfileChangeLine.Signing)

        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(laid()?.avatar).isEqualTo(Setting(SignedPicture("m1", "https://media/m1")))
        assertThat(line()).isNull()
        assertThat(landed).hasSize(1)
    }

    /** Airplane mode after Close: `That didn't sign.` under the head, the old head kept (:69). */
    @Test
    fun aClosedChangeThatDidNotSignStandsUnderTheHead() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        profiles.prepareOutcome = Outcome.Failed(IOException("down"))
        val store = ViewModelStore()
        val vm = startedAtSeal(vm = stored(store))
        vm.seal.onSign()
        vm.seal.onLeave()
        store.clear()
        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)
        assertThat(signedProfile.laid.value).isNull()
    }

    @Test
    fun aSealLeftUnpressedSignsNothing() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        val store = ViewModelStore()
        startedAtSeal(vm = stored(store))
        store.clear()
        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(line()).isNull()
    }

    // -- THE KEY NOT ON THIS DEVICE (AvatarSeal.md:53-:55): never a crash --

    @Test
    fun aPressWithoutTheKeyIsTheKeyNoticeAndPreparesNothing() = runTest(dispatcher) {
        val vm = startedAtSeal()
        identity.seed = null
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.KeyAbsent)
        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(signedProfile.laid.value).isNull()

        vm.seal.onNotNow()
        assertThat(vm.state.value.fault).isNull()
        assertThat(vm.state.value.step).isEqualTo(AvatarStep.Seal)
    }

    /** The key goes while the upload runs: the signer finds none, and nothing is signed. */
    @Test
    fun aKeyGoneBeforeTheSigningIsTheKeyNoticeNotACrash() = runTest(dispatcher) {
        media.gate = CompletableDeferred()
        val vm = startedAtSeal()
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        identity.seed = null
        media.gate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.KeyAbsent)
        assertThat(sealer.staged.values.map { it.state.name }).doesNotContain("RELAYING")
    }
}
