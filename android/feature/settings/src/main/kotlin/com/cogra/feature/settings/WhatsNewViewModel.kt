package com.cogra.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.release.Release
import com.cogra.domain.release.ReleaseRegistry
import com.cogra.domain.release.RunningVersion
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What's new's one read: the app's releases, and the version running here to place in them. */
sealed interface WhatsNewUiState {
    data object Loading : WhatsNewUiState

    /** The read failed with nothing loaded (copy-voice, faults by code). */
    data object Failed : WhatsNewUiState

    data class Ready(val releases: List<Release>, val running: String) : WhatsNewUiState
}

@HiltViewModel
class WhatsNewViewModel @Inject constructor(
    private val registry: ReleaseRegistry,
    private val running: RunningVersion,
) : ViewModel() {

    private val _state = MutableStateFlow<WhatsNewUiState>(WhatsNewUiState.Loading)
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            _state.value = when (val read = registry.releases()) {
                is Outcome.Success -> WhatsNewUiState.Ready(read.value, running.name)
                is Outcome.Refused, is Outcome.Failed -> WhatsNewUiState.Failed
            }
        }
    }
}
