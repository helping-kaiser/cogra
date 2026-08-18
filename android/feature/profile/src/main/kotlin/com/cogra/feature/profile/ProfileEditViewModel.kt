package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileEditUiState(
    val loading: Boolean = true,
    val transportFailed: Boolean = false,
    val displayName: String = "",
    val bio: String = "",
    val websiteUrl: String = "",
    val submitting: Boolean = false,
    val emptyName: Boolean = false,
    val refused: Boolean = false,
    val signingFailed: Boolean = false,
    /** One-shot: the update signed; the caller pops back and refreshes. */
    val saved: Boolean = false,
)

/**
 * The profile edit form: pre-filled from the current version, saved as
 * a parallel Registration prepared by the backend and signed here
 * (substrate.md §9). The form holds the full field set — a blanked bio
 * or website clears; the display name cannot blank.
 */
@HiltViewModel
class ProfileEditViewModel @Inject constructor(
    private val profiles: ProfileRepository,
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

    fun onSubmit() {
        val s = _state.value
        if (s.submitting) return
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
}
