package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.viewModelScope
import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
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
import com.cogra.domain.media.PICTURE_MAX_BYTES
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.profile.Setting
import com.cogra.domain.profile.SignedPicture
import com.cogra.domain.profile.SignedProfile
import com.cogra.domain.profile.SignedProfileFields
import com.cogra.domain.profile.over
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.SentProfile
import com.cogra.domain.signing.WriteSigner
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
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
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

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileEditViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val actor = ActorKey.generate()
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val sealer = SealingWriteRepository(actor)

    private class ScriptedProfiles(private val sealer: SealingWriteRepository) :
        ThrowingProfileRepository() {
        var mine: Outcome<ProfileView?> = Outcome.Success(
            testProfile(id = TEST_PROFILE_ID, handle = "jakob", displayName = "Jakob", bio = "Old bio"),
        )
        var prepareOutcome: Outcome<List<PreparedWriteView>>? = null
        var lastUpdate: Triple<String, String?, String?>? = null
        var prepareCalls = 0

        override suspend fun myProfile(): Outcome<ProfileView?> = mine

        var lastAvatar: MediaFieldUpdate? = null

        /** The prepare hangs until the test lets it through: a change still signing. */
        var prepareGate: CompletableDeferred<Unit>? = null

        override suspend fun prepareProfileUpdate(
            displayName: String,
            bio: String?,
            websiteUrl: String?,
            avatar: MediaFieldUpdate,
        ): Outcome<List<PreparedWriteView>> {
            prepareCalls += 1
            prepareGate?.await()
            lastUpdate = Triple(displayName, bio, websiteUrl)
            lastAvatar = avatar
            return prepareOutcome ?: Outcome.Success(
                sealer.stageFaithful(
                    faithfulProfileUpdate(TEST_PROFILE_ID, SentProfile(displayName, bio, websiteUrl, avatar)),
                ),
            )
        }
    }

    /** The upload half of the avatar path, scripted per test. */
    private class ScriptedMedia : ThrowingMediaRepository() {
        var outcome: Outcome<MediaAssetView> = Outcome.Success(
            fakeUpload("m1"),
        )
        var calls = 0

        override suspend fun uploadMedia(
            picture: ProcessedPicture,
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
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", TEST_PROFILE_ID) }
    private val signedProfile = SignedProfile(session, TestScope(dispatcher))
    private val changes = ProfileChanges(session, TestScope(dispatcher))

    private fun viewModel() =
        ProfileEditViewModel(profiles, media, processor, WriteSigner(sealer, identity), signedProfile, changes)

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
        vm.save()
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
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        // The form holds the full field set: a blanked bio rides null
        // (the wire's explicit clear); the saved one-shot fires.
        assertThat(profiles.lastUpdate).isEqualTo(Triple("Jakob", null, "https://ada.example"))
        assertThat(vm.state.value.saved).isTrue()
        assertThat(sealer.staged.values.single().state.name).isEqualTo("RELAYING")
    }

    /**
     * jakob's hand test: adding a bio to a profile with no website. The
     * website rides as the clear, which the server stages as the empty
     * string, and the device signs it rather than refusing its own gesture.
     */
    @Test
    fun addingABioBesideAnEmptyWebsiteSigns() = runTest(dispatcher) {
        profiles.mine = Outcome.Success(testProfile(id = TEST_PROFILE_ID, handle = "jakob", displayName = "Jakob"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastUpdate).isEqualTo(Triple("Jakob", "Hello", null))
        assertThat(vm.state.value.fault).isNull()
        assertThat(vm.state.value.saved).isTrue()
    }

    @Test
    fun aRefusedPrepareSurfaces() = runTest(dispatcher) {
        profiles.prepareOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no fields")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Bug)
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aTransportFaultOnSubmitSurfaces() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Offline)
        // The form is not swapped for the load's failure screen.
        assertThat(vm.state.value.transportFailed).isFalse()
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
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Untouched)
        assertThat(media.calls).isEqualTo(0)
    }

    @Test
    fun aClearedPictureSendsTheExplicitClear() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarCleared()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Clear)
    }

    @Test
    fun aPickedPictureUploadsAndSendsItsId() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Set("m1"))
        assertThat(media.calls).isEqualTo(1)
    }

    /**
     * The crop's Next brings the picture back to this form (AvatarCrop.md):
     * it uploads framed as the author left it, and the form's one Save
     * signs it with the fields — one prepare, one act, nothing signed
     * before Save.
     */
    @Test
    fun aPictureFramedByTheCropIsSignedWithTheFieldsUnderOneSeal() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        val window = CropWindow(0.1f, 0.2f, 0.7f, 0.8f)

        vm.onAvatarFramed("content://pick/1", window)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(processor.lastCrop).isEqualTo(CropSpec(targetRatio = 1f, window = window))
        assertThat(profiles.prepareCalls).isEqualTo(0)

        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(profiles.lastUpdate).isEqualTo(Triple("Jakob", "Hello", null))
        assertThat(profiles.lastAvatar).isEqualTo(MediaFieldUpdate.Set("m1"))
        assertThat(vm.state.value.saved).isTrue()
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
        vm.save()
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
        vm.save()
        assertThat(vm.state.value.imagesPending).isTrue()
        assertThat(profiles.lastUpdate).isNull()
    }

    /**
     * HT-19, jakob's ruling: a profile picture takes the same ten-megabyte
     * cap a post's media does. It is the same asset kind through the same
     * `uploadMedia`, so a limit this path did not enforce was a hole — the
     * same file was refused for a post and taken here.
     */
    @Test
    fun anAvatarOverThePictureCapNeverReachesTheWire() = runTest(dispatcher) {
        val overCap = (PICTURE_MAX_BYTES + 1).toInt()
        processor.processed = ProcessedPicture(ByteArray(overCap), 4000, 4000)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.calls).isEqualTo(0)
        val failed = vm.state.value.avatar as ProfileImageState.Failed
        // The composers' own sentence, word for word.
        assertThat(failed.message).isEqualTo(ProfileEditViewModel.TOO_BIG)
    }

    /**
     * The cap is on the ENCODED bytes, so the camera photo that used to be
     * refused for a post is taken here as it always was.
     */
    @Test
    fun anAvatarThatEncodesUnderTheCapIsTaken() = runTest(dispatcher) {
        processor.processed = ProcessedPicture(ByteArray(320 * 1024), 1080, 1080)
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(media.calls).isEqualTo(1)
        assertThat(vm.state.value.avatar).isInstanceOf(ProfileImageState.Uploaded::class.java)
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

    // -- A TAKEN CHANGE IS LAID OVER THE PROFILE'S HEAD (ProfileEditSeal.md:45);
    // one still signing or one that did not go through lays nothing
    // (ProfileEditSeal.md:75-79, Profile.md:99) --

    private fun laid() = signedProfile.laid.value.over(TEST_PROFILE_ID)

    @Test
    fun aTakenEditLaysTheFieldsItSet() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDisplayNameChange("Noa")
        vm.onBioChange("")
        vm.onWebsiteChange("https://noa.example")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()

        assertThat(vm.state.value.saved).isTrue()
        // The form states its full field set; the picture it left alone is not laid.
        assertThat(laid()).isEqualTo(
            SignedProfileFields(
                displayName = "Noa",
                bio = Setting(null),
                websiteUrl = Setting("https://noa.example"),
            ),
        )
    }

    @Test
    fun aTakenEditLaysTheNewPicture() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(laid()?.avatar).isEqualTo(Setting(SignedPicture("m1", "https://media/m1")))
    }

    @Test
    fun aTakenEditLaysTheRemovedPicture() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarCleared()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(laid()?.avatar).isEqualTo(Setting(null))
    }

    @Test
    fun aChangeStillSigningLaysNothing() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.signing).isTrue()
        assertThat(signedProfile.laid.value).isNull()

        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(laid()?.bio).isEqualTo(Setting("Hello"))
    }

    @Test
    fun aChangeThatDidNotSignLaysNothing() = runTest(dispatcher) {
        // The device refuses a payload that is not what the form sent.
        profiles.prepareOutcome = Outcome.Success(
            sealer.stageFaithful(
                faithfulProfileUpdate(TEST_PROFILE_ID, SentProfile("Mallory", "Old bio", null)),
            ),
        )
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDisplayNameChange("Noa")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Bug)
        assertThat(signedProfile.laid.value).isNull()

        // A refused prepare never reaches a signing.
        profiles.prepareOutcome = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no fields")))
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(signedProfile.laid.value).isNull()
    }

    // -- THE SEAL (ProfileEditSeal.md): Save opens it, only its commit signs --

    private suspend fun line() = changes.line.first()

    @Test
    fun saveOpensTheSealAndSignsNothing() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.onSubmit()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Seal)
        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(vm.state.value.saved).isFalse()
    }

    @Test
    fun aValidationRefusalKeepsTheForm() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onDisplayNameChange(" ")
        vm.onSubmit()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Form)
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(0)
    }

    @Test
    fun backOnTheSealBeforeThePressReturnsToTheFormAsLeft() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.onSubmit()
        assertThat(vm.seal.onBack()).isTrue()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Form)
        assertThat(vm.state.value.bio).isEqualTo("Hello")
        // From the form, back leaves.
        assertThat(vm.seal.onBack()).isFalse()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(0)
    }

    @Test
    fun signRefusesASecondPressUntilItAnswers() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(vm.state.value.signing).isTrue()

        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.signing).isFalse()
        assertThat(vm.state.value.saved).isTrue()
        assertThat(sealer.staged).hasSize(1)
    }

    @Test
    fun aChangeTakenWhileTheSealStandsLeavesNoHeadLine() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()
        assertThat(line()).isNull()
    }

    @Test
    fun backDuringTheSigningClosesTheSealAndTheChangeGoesOn() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val landed = mutableListOf<Unit>()
        backgroundScope.launch { changes.landed.collect { landed += it } }
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()

        // The route leaves on false: the seal closes, and nothing is cancelled.
        assertThat(vm.seal.onBack()).isFalse()
        vm.viewModelScope.cancel()
        assertThat(line()).isEqualTo(ProfileChangeLine.Signing)
        assertThat(signedProfile.laid.value).isNull()

        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(sealer.staged).hasSize(1)
        assertThat(laid()?.bio).isEqualTo(Setting("Hello"))
        assertThat(line()).isNull()
        assertThat(landed).hasSize(1)
    }

    @Test
    fun theXDuringTheSigningClosesTheSealToo() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onLeave()
        vm.viewModelScope.cancel()
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)
    }

    /** Airplane mode with the seal open: the fault line, the old head, nothing laid. */
    @Test
    fun noAnswerWithTheSealOpenIsTheFaultLineAndKeepsTheOldHead() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        val s = vm.state.value
        assertThat(s.fault).isEqualTo(ProfileSealFault.Offline)
        assertThat(s.stage).isEqualTo(ProfileEditStage.Seal)
        assertThat(s.signing).isFalse()
        assertThat(signedProfile.laid.value).isNull()
        assertThat(line()).isNull()

        // Retry is the commit pressed again.
        profiles.prepareOutcome = null
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.saved).isTrue()
        assertThat(laid()?.bio).isEqualTo(Setting("Hello"))
    }

    /** Airplane mode after Close: `That didn't sign.` with Retry, the old head, nothing laid. */
    @Test
    fun aClosedChangeThatDidNotSignStandsUnderTheHeadUntilRetry() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()
        vm.viewModelScope.cancel()
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        val failed = line() as ProfileChangeLine.Failed
        assertThat(signedProfile.laid.value).isNull()

        profiles.prepareGate = CompletableDeferred()
        profiles.prepareOutcome = null
        failed.retry()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isEqualTo(ProfileChangeLine.Signing)
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        assertThat(laid()?.bio).isEqualTo(Setting("Hello"))
    }

    @Test
    fun theWriteRuleIsItsNoticeAndNotNowRestsTheSeal() = runTest(dispatcher) {
        profiles.prepareOutcome =
            Outcome.Refused(listOf(UserError(ErrorCode.WRITE_RULE_FAILED, "write rule")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.WriteRule)
        vm.seal.onNotNow()
        assertThat(vm.state.value.fault).isNull()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Seal)
        assertThat(signedProfile.laid.value).isNull()
    }

    @Test
    fun theBugsNotNowReturnsTheEditAsLeft() = runTest(dispatcher) {
        profiles.prepareOutcome = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "no fields")))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(vm.state.value.fault).isEqualTo(ProfileSealFault.Bug)
        vm.seal.onNotNow()
        assertThat(vm.state.value.stage).isEqualTo(ProfileEditStage.Form)
        assertThat(vm.state.value.bio).isEqualTo("Hello")
    }

    // -- The Profile row's words (ProfileEditSeal.md:5-9) --

    @Test
    fun theRowNamesTheChangedPartsInTheEditsOrder() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onAvatarPicked("content://pick/1")
        dispatcher.scheduler.advanceUntilIdle()
        vm.onWebsiteChange("https://ada.example")
        vm.onBioChange("New bio")
        assertThat(vm.state.value.changeSummary).isEqualTo("A new picture, bio and website")
        vm.onDisplayNameChange("Noa")
        assertThat(vm.state.value.changeSummary).isEqualTo("A new picture, display name, bio and website")
    }

    @Test
    fun aRemovedPictureReadsAloneOrAfterTheOthers() {
        assertThat(profileChangeSummary(emptyList(), removed = true)).isEqualTo("The picture removed")
        assertThat(profileChangeSummary(listOf("bio"), removed = true)).isEqualTo("A new bio, the picture removed")
        assertThat(profileChangeSummary(listOf("display name", "website"), removed = false))
            .isEqualTo("A new display name and website")
        assertThat(profileChangeSummary(emptyList(), removed = false)).isEqualTo(NOTHING_CHANGED)
    }

    // -- A SEAL TORN DOWN WITHOUT Back OR THE X (a sign-out clears the stack) --

    /** The ViewModel in a store, cleared the way a popped back-stack entry clears it. */
    private fun storedViewModel(store: ViewModelStore): ProfileEditViewModel =
        ViewModelProvider(
            store,
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = viewModel() as T
            },
        )[ProfileEditViewModel::class.java]

    @Test
    fun aSealClearedWhileItSignsHandsTheAnswerToTheHead() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val store = ViewModelStore()
        val vm = storedViewModel(store)
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()

        store.clear()
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        // Never lost silently (ProfileEditSeal.md:77): the head carries it.
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)
    }

    @Test
    fun aSealClearedAtRestClosesNothing() = runTest(dispatcher) {
        val store = ViewModelStore()
        val vm = storedViewModel(store)
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSubmit()
        store.clear()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        assertThat(profiles.prepareCalls).isEqualTo(0)
    }

    // -- THE ACCOUNT BOUNDARY: an act prepares and signs only for the account that pressed --

    private fun switchTo(account: String?) {
        session.tokens.value = account?.let { AuthTokens("a2", "r2", it) }
    }

    @Test
    fun aSwitchBeforeThePrepareAnswersSignsNothingForTheOtherAccount() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onBioChange("Hello")
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()

        switchTo("account-b")
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        // The prepare answered, the signing never ran: nothing relays.
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(sealer.staged.values.map { it.state.name }).doesNotContain("RELAYING")
        assertThat(signedProfile.laid.value).isNull()
        // Nothing is drawn under B's head. Stopped by the owner guard, the act
        // signed nothing: it is A's failed line, standing under A's head again
        // (Profile.md:101, "until Retry or the next change" — a switch is neither).
        assertThat(line()).isNull()
        switchTo(TEST_PROFILE_ID)
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)
    }

    @Test
    fun aPressWithAnotherAccountActiveNeverPrepares() = runTest(dispatcher) {
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.onSubmit()
        switchTo(null)
        vm.seal.onSign()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(0)
        assertThat(vm.state.value.signing).isFalse()
    }

    @Test
    fun aRetryHeldPastASwitchDoesNothing() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        val failed = line() as ProfileChangeLine.Failed
        assertThat(profiles.prepareCalls).isEqualTo(1)

        // The line goes at the switch; its Retry, held by a composition, is pressed under B.
        switchTo("account-b")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        profiles.prepareGate = null
        profiles.prepareOutcome = null
        failed.retry()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(1)
        assertThat(signedProfile.laid.value).isNull()

        // Back on A the line stands again (Profile.md:101: a switch is neither Retry
        // nor the next change), and its Retry signs once, under A.
        switchTo(TEST_PROFILE_ID)
        dispatcher.scheduler.advanceUntilIdle()
        val again = line() as ProfileChangeLine.Failed
        again.retry()
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(profiles.prepareCalls).isEqualTo(2)
        assertThat(line()).isNull()
        assertThat(signedProfile.laid.value).isNotNull()
    }

    @Test
    fun aFailedLineIsHiddenUnderAnotherAccountAndStandsAgainUnderItsOwn() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        profiles.prepareOutcome = Outcome.Failed(IOException("offline"))
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()
        profiles.prepareGate?.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)

        switchTo("account-b")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        switchTo(null)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isNull()
        switchTo(TEST_PROFILE_ID)
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(line()).isInstanceOf(ProfileChangeLine.Failed::class.java)
    }

    @Test
    fun aSwitchAfterThePrepareConfirmsNothingToTheOtherAccount() = runTest(dispatcher) {
        profiles.prepareGate = CompletableDeferred()
        val landed = mutableListOf<Unit>()
        backgroundScope.launch { changes.landed.collect { landed += it } }
        val vm = viewModel()
        dispatcher.scheduler.advanceUntilIdle()
        vm.save()
        dispatcher.scheduler.advanceUntilIdle()
        vm.seal.onBack()
        // The prepare already answered for A when B arrives: the act was stopped
        // before signing, so it is A's failed line, never B's snackbar.
        profiles.prepareGate?.complete(Unit)
        switchTo("account-b")
        dispatcher.scheduler.advanceUntilIdle()
        assertThat(landed).isEmpty()
        assertThat(line()).isNull()
    }
}
