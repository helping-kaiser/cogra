package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
import com.cogra.domain.MediaAssetView
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.ProfileView
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.profile.SignedProfile
import com.cogra.domain.profile.over
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
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before

/**
 * The profile edit's test harness: the scripted repositories, the session, the
 * signing holder and the helpers both of its test classes drive the edit with.
 */
@OptIn(ExperimentalCoroutinesApi::class)
abstract class ProfileEditHarness {
    protected val dispatcher = StandardTestDispatcher()
    protected val actor = ActorKey.generate()
    protected val identity = FakeIdentityStore().apply { seed = actor.seed() }
    protected val sealer = SealingWriteRepository(actor)

    protected class ScriptedProfiles(private val sealer: SealingWriteRepository) :
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
    protected class ScriptedMedia : ThrowingMediaRepository() {
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
    protected class ScriptedProcessor : ThrowingMediaProcessor() {
        var processed: ProcessedPicture? = ProcessedPicture(ByteArray(4), 100, 100)
        var lastCrop: CropSpec? = null

        override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? {
            lastCrop = crop
            return processed
        }
    }

    protected val profiles = ScriptedProfiles(sealer)
    protected val media = ScriptedMedia()
    protected val processor = ScriptedProcessor()
    protected val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", TEST_PROFILE_ID) }
    protected val signedProfile = SignedProfile(session, TestScope(dispatcher))
    protected val changes = ProfileChanges(session, TestScope(dispatcher))

    protected fun viewModel() = ProfileEditViewModel(
        profiles,
        media,
        processor,
        WriteSigner(sealer, identity),
        signedProfile,
        changes,
        identity,
    )

    /** Save opens the seal; its commit signs. */
    protected fun ProfileEditViewModel.save() {
        onSubmit()
        seal.onSign()
    }

    @Before
    fun setDispatcher() = Dispatchers.setMain(dispatcher)

    @After
    fun resetDispatcher() = Dispatchers.resetMain()

    protected fun laid() = signedProfile.laid.value.over(TEST_PROFILE_ID)

    protected suspend fun line() = changes.line.first()

    /** The ViewModel in a store, cleared the way a popped back-stack entry clears it. */
    protected fun storedViewModel(store: ViewModelStore): ProfileEditViewModel =
        ViewModelProvider(
            store,
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = viewModel() as T
            },
        )[ProfileEditViewModel::class.java]

    protected fun switchTo(account: String?) {
        session.tokens.value = account?.let { AuthTokens("a2", "r2", it) }
    }
}
