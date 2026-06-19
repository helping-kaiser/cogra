package com.cogra.feature.auth.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.domain.model.ProfileEdits
import com.cogra.core.domain.usecase.EditProfileResult
import com.cogra.core.domain.usecase.EditProfileUseCase
import com.cogra.core.domain.usecase.GetMyProfileUseCase
import com.cogra.core.domain.usecase.ProfileResult
import com.cogra.feature.auth.toDisplayMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * UI state for the edit-profile form. The form is prefilled from the current
 * profile ([isLoading] covers that fetch; [loadError] its failure). [canSave]
 * is true only when the display name is non-blank and at least one field
 * differs from its original — so an unchanged form can't submit. [saved] is a
 * one-shot the route consumes to pop back.
 */
data class EditProfileUiState(
    val isLoading: Boolean = true,
    val loadError: Boolean = false,
    val handle: String = "",
    val displayName: String = "",
    val bio: String = "",
    val websiteUrl: String = "",
    val isSubmitting: Boolean = false,
    val canSave: Boolean = false,
    val errorMessage: String? = null,
    val saved: Boolean = false,
)

@HiltViewModel
class EditProfileViewModel @Inject constructor(
    private val getMyProfile: GetMyProfileUseCase,
    private val editProfile: EditProfileUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(EditProfileUiState())
    val state: StateFlow<EditProfileUiState> = _state.asStateFlow()

    // The prefilled values to diff against, so only changed fields are sent.
    private var origHandle = ""
    private var origDisplayName = ""
    private var origBio = ""
    private var origWebsite = ""

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(isLoading = true, loadError = false) }
        viewModelScope.launch {
            when (val result = getMyProfile()) {
                is ProfileResult.Loaded -> {
                    val user = result.user
                    origHandle = user.handle.value.orEmpty()
                    origDisplayName = user.displayName.value.orEmpty()
                    origBio = user.bio.value.orEmpty()
                    origWebsite = user.websiteUrl.value.orEmpty()
                    _state.value = EditProfileUiState(
                        isLoading = false,
                        handle = origHandle,
                        displayName = origDisplayName,
                        bio = origBio,
                        websiteUrl = origWebsite,
                    )
                }
                // A stale session or transport fault: the form has nothing to
                // edit, so surface a retry rather than a blank form.
                ProfileResult.Unauthenticated, is ProfileResult.Failure ->
                    _state.update { it.copy(isLoading = false, loadError = true) }
            }
        }
    }

    fun onHandleChange(value: String) = edit { it.copy(handle = value) }
    fun onDisplayNameChange(value: String) = edit { it.copy(displayName = value) }
    fun onBioChange(value: String) = edit { it.copy(bio = value) }
    fun onWebsiteUrlChange(value: String) = edit { it.copy(websiteUrl = value) }

    private fun edit(transform: (EditProfileUiState) -> EditProfileUiState) {
        _state.update { recompute(transform(it).copy(errorMessage = null)) }
    }

    private fun recompute(state: EditProfileUiState): EditProfileUiState =
        state.copy(
            canSave = !state.isSubmitting &&
                state.displayName.isNotBlank() &&
                pendingEdits(state).hasChanges,
        )

    /** The change set: each field is sent only when it differs from its
     *  original. An emptied optional field stays as `""` — the clear signal. */
    private fun pendingEdits(state: EditProfileUiState) = ProfileEdits(
        handle = state.handle.trim().takeIf { it != origHandle },
        displayName = state.displayName.trim().takeIf { it != origDisplayName },
        bio = state.bio.trim().takeIf { it != origBio },
        websiteUrl = state.websiteUrl.trim().takeIf { it != origWebsite },
    )

    fun onSave() {
        val current = _state.value
        if (current.isSubmitting || !current.canSave) return
        _state.update { it.copy(isSubmitting = true, canSave = false, errorMessage = null) }

        viewModelScope.launch {
            val message = when (val result = editProfile(pendingEdits(current))) {
                is EditProfileResult.Success -> {
                    _state.update { it.copy(isSubmitting = false, saved = true) }
                    return@launch
                }
                is EditProfileResult.Rejected ->
                    result.errors.firstOrNull()?.toDisplayMessage() ?: "Couldn't save your profile."
                is EditProfileResult.Failure ->
                    "Couldn't reach the server. Check your connection."
            }
            _state.update { recompute(it.copy(isSubmitting = false, errorMessage = message)) }
        }
    }
}
