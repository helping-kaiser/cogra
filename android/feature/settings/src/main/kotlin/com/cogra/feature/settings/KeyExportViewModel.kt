package com.cogra.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.identity.ExportActorKey
import com.cogra.domain.identity.ExportedSecret
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class KeyExportUiState(
    /** Empty until the gate is passed — a secret is never held early. */
    val secrets: List<ExportedSecret> = emptyList(),
    /** Whether the reveal ran, which is what tells empty from not-yet. */
    val revealed: Boolean = false,
)

@HiltViewModel
class KeyExportViewModel @Inject constructor(
    private val exportActorKey: ExportActorKey,
) : ViewModel() {

    private val _state = MutableStateFlow(KeyExportUiState())
    val state = _state.asStateFlow()

    /** Called only behind the device gate; the screen owns that gate. */
    fun onReveal() {
        if (_state.value.revealed) return
        viewModelScope.launch {
            val secrets = exportActorKey()
            _state.update { it.copy(secrets = secrets, revealed = true) }
        }
    }
}
