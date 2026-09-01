package com.cogra.feature.profile.avatar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileView
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import dagger.hilt.android.lifecycle.HiltViewModel
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
 * **The seal is not decoration.** A profile update is a signed act, so
 * this reuses the same `prepareProfileUpdate` + `WriteSigner` machinery
 * every other write goes through — the boarded surface sits on top of it
 * rather than beside it.
 *
 * The picture uploads on leaving the crop stage, which is where the bytes
 * stop changing. The seal then waits on the id, exactly as the post
 * wizard's does.
 */
@HiltViewModel
class AvatarFlowViewModel @Inject constructor(
    private val profiles: ProfileRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(AvatarFlowState())
    val state: StateFlow<AvatarFlowState> = _state.asStateFlow()

    private var upload: Job? = null

    /**
     * The profile as it stands, held so the signed update can resend it
     * unchanged beside the new picture.
     *
     * `prepareProfileUpdate` takes the **full intended field set** — a
     * null bio or website *clears* it — so an avatar-only change still
     * has to state the rest. Sending a bare picture would quietly wipe
     * the author's bio, which is exactly the kind of silent loss the
     * repo's rules exist to prevent.
     */
    private var heldProfile: ProfileView? = null

    /** Loads what the signed update must carry beside the new picture. */
    fun start() {
        if (heldProfile != null) return
        viewModelScope.launch {
            when (val outcome = profiles.myProfile()) {
                is Outcome.Success -> heldProfile = outcome.value
                is Outcome.Refused, is Outcome.Failed ->
                    _state.update { it.copy(transportFailed = true) }
            }
        }
    }

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
        if (it.crop == spec) it else it.copy(crop = spec)
    }

    fun onNext() {
        val current = _state.value
        val next = current.advanced() ?: return
        startUpload()
        _state.value = next
    }

    /**
     * The arrow and the system gesture: one stage back, and only the first
     * stage reports "not handled" so the route leaves.
     */
    fun onBack(): Boolean {
        val back = _state.value.retreated() ?: return false
        _state.value = back
        return true
    }

    fun onRetryUpload() = startUpload()

    private fun startUpload() {
        val current = _state.value
        val uri = current.uri ?: return
        if (current.upload is AvatarUpload.Done) return
        upload?.cancel()
        _state.update { it.copy(upload = AvatarUpload.Running) }
        upload = viewModelScope.launch {
            // The circle is a mask on a square: the stored bytes are the
            // 1:1 crop, and every surface draws the circle over them.
            val spec = current.crop ?: CropSpec(targetRatio = AVATAR_RATIO)
            val picture = processor.process(uri, spec)
            if (picture == null) {
                _state.update { it.copy(upload = AvatarUpload.Failed(UNREADABLE)) }
                return@launch
            }
            // A profile picture carries no description: it is not content
            // a reader reads, and the monogram is its stated fallback.
            val next = when (val outcome = media.uploadMedia(picture)) {
                is Outcome.Success -> AvatarUpload.Done(outcome.value.id)
                is Outcome.Refused ->
                    AvatarUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED)
                is Outcome.Failed -> AvatarUpload.Failed(TRANSPORT)
            }
            _state.update { it.copy(upload = next) }
        }
    }

    fun onSign() {
        val flow = _state.value
        val mediaId = flow.mediaId ?: return
        if (!flow.canSign) return
        _state.update {
            it.copy(submitting = true, refusal = null, signingFailed = false, transportFailed = false)
        }
        val profile = heldProfile
        if (profile == null) {
            // Without the current field set there is nothing safe to
            // send: see [heldProfile].
            _state.update { it.copy(submitting = false, transportFailed = true) }
            return
        }
        viewModelScope.launch {
            val outcome = profiles.prepareProfileUpdate(
                displayName = profile.displayName.value.orEmpty(),
                bio = profile.bio.value,
                websiteUrl = profile.websiteUrl.value,
                avatar = MediaFieldUpdate.Set(mediaId),
            )
            val prepared = when (outcome) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    _state.update {
                        it.copy(
                            submitting = false,
                            refusal = outcome.errors.firstOrNull()?.message ?: REFUSED_CHANGE,
                        )
                    }
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(submitting = false, transportFailed = true) }
                    return@launch
                }
            }
            val results = signer.sign(prepared)
            if (results.all { it is WriteResult.Done }) {
                _state.update { it.copy(submitting = false, saved = true) }
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }

    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    private companion object {
        /** A circle-masked square (D13's fixed avatar crop). */
        const val AVATAR_RATIO = 1f

        const val UNREADABLE = "That file could not be read as a picture."
        const val REFUSED = "The server would not take that picture."
        const val REFUSED_CHANGE = "That change was refused."
        const val TRANSPORT = "The upload could not reach the server."
    }
}
