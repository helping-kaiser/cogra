package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The profile picture, as the form holds it.
 *
 * The three states are the contract's three (D13) plus the one the form
 * needs while a new picture is on its way: [Held] is what the account
 * already has and the form has not touched, [Cleared] is the explicit
 * clear, [Picked] is a local file mid-upload, and [Uploaded] is the
 * asset the update will name. Only [Cleared] and [Uploaded] change
 * anything; [Held] sends nothing at all, which is what makes "leave it
 * alone" distinguishable from "clear it".
 */
sealed interface ProfileImageState {
    data class Held(val url: String?) : ProfileImageState

    data object Cleared : ProfileImageState

    data class Picked(val uri: String) : ProfileImageState

    data class Uploaded(val mediaId: String, val url: String) : ProfileImageState

    data class Failed(val uri: String, val message: String) : ProfileImageState

    /** What the header should draw right now, or null for the monogram. */
    val previewUrl: Any?
        get() = when (this) {
            is Held -> url
            is Picked -> uri
            is Uploaded -> url
            is Failed -> uri
            Cleared -> null
        }

    /** This state, or the server's picture where the form has none of its own. */
    fun orHeld(url: String?): ProfileImageState =
        if (this is Held) Held(url) else this

    /** The wire value: absent, an explicit clear, or an id. */
    fun toUpdate(): MediaFieldUpdate = when (this) {
        is Held, is Picked, is Failed -> MediaFieldUpdate.Untouched
        Cleared -> MediaFieldUpdate.Clear
        is Uploaded -> MediaFieldUpdate.Set(mediaId)
    }
}

data class ProfileEditUiState(
    val loading: Boolean = true,
    val transportFailed: Boolean = false,
    val displayName: String = "",
    val bio: String = "",
    val websiteUrl: String = "",
    val avatar: ProfileImageState = ProfileImageState.Held(null),
    val submitting: Boolean = false,
    val emptyName: Boolean = false,
    val refused: Boolean = false,
    val signingFailed: Boolean = false,
    /** One-shot: the update signed; the caller pops back and refreshes. */
    val saved: Boolean = false,
) {
    /** A picture is still on its way; saving would name nothing. */
    val imagesPending: Boolean
        get() = avatar is ProfileImageState.Picked
}

/**
 * The profile edit form: pre-filled from the current version, saved as
 * a parallel Registration prepared by the backend and signed here
 * (substrate.md §9). The form holds the full field set — a blanked bio
 * or website clears; the display name cannot blank.
 */
@HiltViewModel
class ProfileEditViewModel @Inject constructor(
    private val profiles: ProfileRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileEditUiState())
    val state = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, transportFailed = false) }
        viewModelScope.launch {
            when (val outcome = profiles.myProfile()) {
                is Outcome.Success -> {
                    val profile = outcome.value
                    if (profile == null) {
                        _state.update { it.copy(loading = false, transportFailed = true) }
                    } else {
                        _state.update {
                            it.copy(
                                loading = false,
                                displayName = profile.displayName.value.orEmpty(),
                                bio = profile.bio.value.orEmpty(),
                                websiteUrl = profile.websiteUrl.value.orEmpty(),
                                // A picture the author has already touched
                                // outranks the one the server holds: a
                                // reload reached from the retry button
                                // would otherwise discard an upload still
                                // in flight.
                                avatar = it.avatar.orHeld(profile.avatar?.url),
                            )
                        }
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, transportFailed = true) }
                is Outcome.Failed -> _state.update { it.copy(loading = false, transportFailed = true) }
            }
        }
    }

    fun onDisplayNameChange(v: String) = _state.update { it.copy(displayName = v, emptyName = false) }
    fun onBioChange(v: String) = _state.update { it.copy(bio = v) }
    fun onWebsiteChange(v: String) = _state.update { it.copy(websiteUrl = v) }
    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    // -- The profile picture (D13) --

    /**
     * A picked avatar: cropped to its fixed shape, processed and
     * uploaded exactly as a post's pictures are — same pipeline, same
     * `uploadMedia`, only the shape differs.
     */
    fun onAvatarPicked(uri: String) = pick(uri)

    /** Back to the monogram, which is the designed placeholder. */
    fun onAvatarCleared() = _state.update { it.copy(avatar = ProfileImageState.Cleared) }

    private fun pick(uri: String) {
        _state.update { it.copy(avatar = ProfileImageState.Picked(uri)) }
        viewModelScope.launch {
            // The fixed crop is centred: the profile form has no
            // framing step, so the picture is taken from the middle of
            // whatever was picked rather than from a corner.
            val processed = processor.process(uri, CropSpec(targetRatio = AVATAR_RATIO))
            val next = if (processed == null) {
                ProfileImageState.Failed(uri, UNREADABLE)
            } else {
                when (val outcome = media.uploadMedia(processed, altText = null)) {
                    is Outcome.Success ->
                        ProfileImageState.Uploaded(outcome.value.id, outcome.value.url)
                    is Outcome.Refused ->
                        ProfileImageState.Failed(uri, outcome.errors.firstOrNull()?.message ?: REFUSED)
                    is Outcome.Failed -> ProfileImageState.Failed(uri, TRANSPORT)
                }
            }
            _state.update { it.copy(avatar = next) }
        }
    }

    fun onSubmit() {
        val s = _state.value
        if (s.submitting || s.imagesPending) return
        if (s.displayName.isBlank()) {
            _state.update { it.copy(emptyName = true) }
            return
        }
        _state.update { it.copy(submitting = true, refused = false, signingFailed = false) }
        viewModelScope.launch {
            val prepared = when (
                val outcome = profiles.prepareProfileUpdate(
                    displayName = s.displayName.trim(),
                    bio = s.bio.ifBlank { null },
                    websiteUrl = s.websiteUrl.trim().ifBlank { null },
                    avatar = s.avatar.toUpdate(),
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    _state.update { it.copy(submitting = false, refused = true) }
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

    private companion object {
        /** D13's fixed crop: a circle-masked square. */
        const val AVATAR_RATIO = 1f

        const val UNREADABLE = "That file could not be read as a picture."
        const val REFUSED = "The server would not take that picture."
        const val TRANSPORT = "The upload could not reach the server."
    }
}
