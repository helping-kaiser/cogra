package com.cogra.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.domain.usecase.ObserveAuthStateUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** Top-level auth gate driving the login <-> profile swap. */
sealed interface AuthUiState {
    /** Before the stored session has been read. */
    data object Loading : AuthUiState
    data object LoggedOut : AuthUiState
    data object LoggedIn : AuthUiState
}

@HiltViewModel
class RootViewModel @Inject constructor(
    observeAuthState: ObserveAuthStateUseCase,
) : ViewModel() {

    val authState: StateFlow<AuthUiState> =
        observeAuthState()
            .map { loggedIn -> if (loggedIn) AuthUiState.LoggedIn else AuthUiState.LoggedOut }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
                initialValue = AuthUiState.Loading,
            )

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
