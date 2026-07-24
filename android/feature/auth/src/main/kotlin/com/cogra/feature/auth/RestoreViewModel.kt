package com.cogra.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.identity.ActorRestorer
import com.cogra.domain.identity.RestoreResult
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RestoreUiState(
    val code: String = "",
    val inProgress: Boolean = false,
    val result: RestoreResult? = null,
) {
    val canSubmit: Boolean get() = code.isNotBlank() && !inProgress
    val restored: Boolean get() = result == RestoreResult.Restored
}

/**
 * Key recovery on this device: the account's blob opened with the
 * user's recovery code (auth.md "Key recovery").
 */
@HiltViewModel
class RestoreViewModel @Inject constructor(private val restorer: ActorRestorer) : ViewModel() {

    private val _state = MutableStateFlow(RestoreUiState())
    val state: StateFlow<RestoreUiState> = _state.asStateFlow()

    fun onCodeChange(value: String) = _state.update { it.copy(code = value, result = null) }

    fun onSubmit() {
        val current = _state.value
        if (!current.canSubmit) return
        _state.update { it.copy(inProgress = true, result = null) }
        viewModelScope.launch {
            val result = restorer.restore(current.code)
            _state.update { it.copy(inProgress = false, result = result) }
        }
    }
}
