package com.cogra.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.identity.SecurityNotices
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Whether the active account's security notice waits for `Got it`, and its dismissal (SecurityNoticeCard.kt). */
@HiltViewModel
class SecurityNoticeCardViewModel @Inject constructor(
    private val notices: SecurityNotices,
) : ViewModel() {
    val pending: StateFlow<Boolean> = notices.reuseDetectedAt
        .map { it != null }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), false)

    fun onGotIt() {
        viewModelScope.launch { notices.dismiss() }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
