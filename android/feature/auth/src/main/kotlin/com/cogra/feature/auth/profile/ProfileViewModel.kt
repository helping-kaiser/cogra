package com.cogra.feature.auth.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.domain.model.User
import com.cogra.core.domain.usecase.GetMyProfileUseCase
import com.cogra.core.domain.usecase.LogOutUseCase
import com.cogra.core.domain.usecase.ProfileResult
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** UI state for the profile screen — exactly one of [user]/[errorMessage] is
 *  set once [isLoading] is false. */
data class ProfileUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val errorMessage: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val getMyProfile: GetMyProfileUseCase,
    private val logOut: LogOutUseCase,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            val next = when (val result = getMyProfile()) {
                is ProfileResult.Loaded -> ProfileUiState(isLoading = false, user = result.user)
                // An authenticated request that resolves no viewer means a stale
                // session; clearing it returns the app to login.
                ProfileResult.Unauthenticated -> {
                    logOut()
                    ProfileUiState(isLoading = false)
                }
                is ProfileResult.Failure -> ProfileUiState(
                    isLoading = false,
                    errorMessage = "Couldn't load your profile. Try again.",
                )
            }
            _state.value = next
        }
    }

    fun onLogout() {
        viewModelScope.launch { logOut() }
    }
}
