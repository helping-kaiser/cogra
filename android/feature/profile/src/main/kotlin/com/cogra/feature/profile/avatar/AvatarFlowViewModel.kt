package com.cogra.feature.profile.avatar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.overPictureCap
import com.cogra.domain.profile.Setting
import com.cogra.domain.profile.SignedPicture
import com.cogra.domain.profile.SignedProfile
import com.cogra.domain.profile.SignedProfileFields
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.SentProfile
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.known
import com.cogra.domain.signing.profileExpectation
import com.cogra.domain.signing.profileUpdate
import com.cogra.domain.store.IdentityStore
import com.cogra.feature.profile.ProfileChangeOutcome
import com.cogra.feature.profile.ProfileChanges
import com.cogra.feature.profile.ProfileSealFault
import com.cogra.feature.profile.StillPressing
import com.cogra.feature.profile.outcomeOfUntaken
import com.cogra.feature.profile.refusalOf
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The profile-picture flow: pick → circular crop → seal.
 *
 * **The seal is not decoration.** A profile update is a signed act, so the
 * picture's seal signs through the same [ProfileChanges] the edit's seal does:
 * from the press the change goes on whatever happens to the seal
 * (AvatarSeal.md:31, :65), its wait and its answer then stand under the
 * profile's head (:67-:73), and it signs only for the account that pressed.
 *
 * The picture uploads on leaving the crop stage, which is where the bytes
 * stop changing. The seal waits on the upload: a press while it runs is taken
 * and signs once the picture is up (:13). Because that wait is part of the
 * signing, the upload runs on the application scope and is cancelled with the
 * seal only when nothing was pressed.
 */
@HiltViewModel
class AvatarFlowViewModel @Inject constructor(
    private val profiles: ProfileRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val signer: WriteSigner,
    private val signedProfile: SignedProfile,
    private val identity: IdentityStore,
    private val changes: ProfileChanges,
    @ApplicationScope private val appScope: CoroutineScope,
) : ViewModel() {

    private val _state = MutableStateFlow(AvatarFlowState())
    val state: StateFlow<AvatarFlowState> = _state.asStateFlow()

    private var upload: Job? = null

    /** The running or last upload's answer, which a press waits on. */
    @Volatile
    private var attempt: Deferred<AvatarUpload> = CompletableDeferred(AvatarUpload.Idle)

    fun onPicked(uri: String) = _state.update {
        AvatarFlowState(uri = uri)
    }

    fun onSourceRatio(ratio: Float) = _state.update { it.copy(sourceRatio = ratio) }

    /**
     * The framing, reported by the crop stage after every composition.
     *
     * It goes into the state so it outlives the stage: stepping on to
     * the seal tears the crop composition down, and the author who
     * steps back must find their framing rather than a reset one
     * (jakob 2026-09-01).
     */
    fun onCropCommitted(spec: CropSpec) = _state.update {
        when {
            it.crop == spec -> it
            // A new framing makes the finished upload the wrong picture:
            // leaving the crop again has to send the one now framed.
            it.upload is AvatarUpload.Done -> it.copy(crop = spec, upload = AvatarUpload.Idle)
            else -> it.copy(crop = spec)
        }
    }

    fun onNext() {
        val next = _state.value.advanced() ?: return
        // The stage moves first, so the upload's own Running is the state
        // the seal opens on rather than being overwritten by a copy taken
        // before it started.
        _state.value = next
        startUpload()
    }

    /**
     * The arrow, Back and the system gesture. Before the press, one stage back
     * (AvatarSeal.md:57-59), and only the first stage reports "not handled" so
     * the route leaves. From the press they close the seal and the change goes
     * on (:65): "not handled", so the route leaves.
     */
    fun onBack(): Boolean {
        if (_state.value.signing) {
            changes.close()
            return false
        }
        val back = _state.value.retreated() ?: return false
        _state.value = back
        return true
    }

    /** The seal's commit and its ways out (AvatarSeal.md:13-65): the seal is its own stage. */
    val seal = SealCommit()

    inner class SealCommit internal constructor() {
        /**
         * `Sign the change`: refuses a second press until the signing answers
         * (:25). The signing runs in [ProfileChanges] from the press, its wait
         * for the upload included, so a seal closed on it never cancels it (:31).
         */
        fun onSign() {
            if (!_state.value.canSign) return
            _state.update { it.copy(signing = true, fault = null) }
            val act = AvatarChangeSigning(attempt, AvatarSigningDeps(profiles, signer, signedProfile, identity))
            viewModelScope.launch {
                val outcome = changes.sign(act::sign)
                _state.update { it.answered(outcome) }
            }
        }

        /** The header X: the flow is left (:61), or, from the press, the seal closes and the change goes on (:65). */
        fun onLeave() {
            if (_state.value.signing) changes.close()
        }

        /** The upload gate's Retry: the upload again, the gate running, nothing signed until a press (:23). */
        fun onRetryUpload() = startUpload()

        /** A notice's `Not now`: the seal as it stood before the press (:47, :55); the bug's, the crop (:51). */
        fun onNotNow() = _state.update {
            if (it.fault == ProfileSealFault.Bug) {
                it.copy(step = AvatarStep.Crop, fault = null)
            } else {
                it.copy(fault = null)
            }
        }
    }

    private fun startUpload() {
        val current = _state.value
        val uri = current.uri ?: return
        if (current.upload is AvatarUpload.Done) return
        upload?.cancel()
        _state.update { it.copy(upload = AvatarUpload.Running) }
        val answer = CompletableDeferred<AvatarUpload>()
        attempt = answer
        upload = appScope.launch {
            val next = uploaded(uri, current.crop ?: CropSpec(targetRatio = AVATAR_RATIO), processor, media)
            _state.update { if (attempt === answer) it.copy(upload = next) else it }
            answer.complete(next)
        }.also { job ->
            // A cancelled upload answers too, so a press never waits on it for ever.
            job.invokeOnCompletion { answer.complete(AvatarUpload.Failed(TRANSPORT)) }
        }
    }

    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    /**
     * The seal can go without Back or the X — a sign-out clears the whole stack
     * — and a pressed change still goes on, its answer the head's (:65-:73).
     * Unpressed, the upload has nobody to answer and stops with the seal.
     */
    override fun onCleared() {
        if (_state.value.signing) changes.close() else upload?.cancel()
    }
}

/** A circle-masked square (D13's fixed avatar crop). */
private const val AVATAR_RATIO = 1f

private const val UNREADABLE = "That file could not be read as a picture."

/** The sentence the composers say, word for word. */
private const val TOO_BIG = "That picture is too big — a picture can be up to 10 MB."

private const val REFUSED = "The server would not take that picture."
private const val TRANSPORT = "The upload could not reach the server."

/** One upload of the framed picture: refused before it leaves where it can never be taken. */
private suspend fun uploaded(
    uri: String,
    spec: CropSpec,
    processor: MediaProcessor,
    media: MediaRepository,
): AvatarUpload {
    // The circle is a mask on a square: the stored bytes are the 1:1 crop,
    // and every surface draws the circle over them.
    val picture = processor.process(uri, spec) ?: return AvatarUpload.Refused(UNREADABLE)
    // The same ten megabytes a post's media takes (HT-19, jakob's ruling): one
    // asset kind through one `uploadMedia`, weighed on the encode's output like
    // every other still.
    if (picture.overPictureCap()) return AvatarUpload.Refused(TOO_BIG)
    // A profile picture carries no description: it is not content a reader
    // reads, and the monogram is its stated fallback.
    return when (val outcome = media.uploadMedia(picture)) {
        is Outcome.Success -> AvatarUpload.Done(outcome.value.id, outcome.value.known(), outcome.value.url)
        is Outcome.Refused -> AvatarUpload.Refused(outcome.errors.firstOrNull()?.message ?: REFUSED)
        is Outcome.Failed -> AvatarUpload.Failed(TRANSPORT)
    }
}

/** The seal as the signing's answer leaves it. */
private fun AvatarFlowState.answered(outcome: ProfileChangeOutcome): AvatarFlowState = when (outcome) {
    ProfileChangeOutcome.Taken -> copy(signing = false, saved = true)
    // The held press drops; the gate says why, and Sign the change reads itself again (:21).
    ProfileChangeOutcome.UploadFailed -> copy(signing = false)
    ProfileChangeOutcome.Offline -> copy(signing = false, fault = ProfileSealFault.Offline)
    ProfileChangeOutcome.WriteRule -> copy(signing = false, fault = ProfileSealFault.WriteRule)
    ProfileChangeOutcome.KeyAbsent -> copy(signing = false, fault = ProfileSealFault.KeyAbsent)
    // A picture-only change sets no name: a refusal of one is no reading of this seal's.
    ProfileChangeOutcome.Bug, ProfileChangeOutcome.NameReserved -> copy(signing = false, fault = ProfileSealFault.Bug)
    // Another account is active: nothing was prepared or signed for it.
    ProfileChangeOutcome.Foreign -> copy(signing = false)
}

/** What the picture's signing signs with. */
private class AvatarSigningDeps(
    val profiles: ProfileRepository,
    val signer: WriteSigner,
    val head: SignedProfile,
    val identity: IdentityStore,
)

/**
 * One signing of the new picture: wait for its upload, re-state the profile
 * as it stands beside it, sign, and — taken — lay the picture over the head
 * (AvatarSeal.md:37). It holds values only, never the ViewModel: it may
 * outlive it, and it is what the head's Retry signs again.
 */
private class AvatarChangeSigning(
    private val upload: Deferred<AvatarUpload>,
    private val deps: AvatarSigningDeps,
) {
    suspend fun sign(pressing: StillPressing): ProfileChangeOutcome = with(deps) {
        if (!pressing.holds()) return ProfileChangeOutcome.Foreign
        // Pressed GIVEN the key is not on this device: the notice, and nothing
        // prepared or signed (:53).
        if (identity.actorSeed() == null) return ProfileChangeOutcome.KeyAbsent
        val picture = upload.await() as? AvatarUpload.Done ?: return ProfileChangeOutcome.UploadFailed
        // `prepareProfileUpdate` takes the FULL intended field set — a null bio
        // or website clears it — so a picture-only change re-states the rest
        // as it stands now. A bare picture would silently wipe the bio.
        val profile = when (val read = profiles.myProfile()) {
            is Outcome.Success -> read.value ?: return ProfileChangeOutcome.Offline
            is Outcome.Refused, is Outcome.Failed -> return ProfileChangeOutcome.Offline
        }
        val sent = SentProfile(
            displayName = profile.displayName.value.orEmpty(),
            bio = profile.bio.value,
            websiteUrl = profile.websiteUrl.value,
            avatar = MediaFieldUpdate.Set(picture.mediaId),
        )
        val prepared = when (
            val outcome = profiles.prepareProfileUpdate(sent.displayName, sent.bio, sent.websiteUrl, sent.avatar)
        ) {
            is Outcome.Success -> outcome.value
            is Outcome.Refused -> return refusalOf(outcome.errors)
            is Outcome.Failed -> return ProfileChangeOutcome.Offline
        }
        // The account may have changed while the upload or the prepare ran.
        if (!pressing.holds()) return ProfileChangeOutcome.Foreign
        signPrepared(prepared, sent, picture, profile.id)
    }

    /** The prepared change, signed and — taken — laid over the head. */
    private suspend fun signPrepared(
        prepared: List<PreparedWriteView>,
        sent: SentProfile,
        picture: AvatarUpload.Done,
        profileId: String,
    ): ProfileChangeOutcome = with(deps) {
        // One profile update on this device's own profile, its payload held to
        // the fields it re-states and the avatar this device uploaded
        // (PayloadExpectation.kt).
        val ledger = picture.known?.let { mapOf(picture.mediaId to it) }.orEmpty()
        val expected = profileExpectation(profileId, sent, ledger)
        val signing = head.begin()
        val results = try {
            signer.sign(prepared, Expectation(listOf(profileUpdate(expected))))
        } catch (_: NoActorKeyException) {
            // The key went between the press and the signing: nothing was signed.
            return ProfileChangeOutcome.KeyAbsent
        }
        if (!results.all { it is WriteResult.Done }) return outcomeOfUntaken(results)
        // Taken: the fields re-stated beside it are not the change's, so only
        // the picture is laid.
        picture.url?.let {
            head.lay(signing, profileId, SignedProfileFields(avatar = Setting(SignedPicture(picture.mediaId, it))))
        }
        ProfileChangeOutcome.Taken
    }
}
