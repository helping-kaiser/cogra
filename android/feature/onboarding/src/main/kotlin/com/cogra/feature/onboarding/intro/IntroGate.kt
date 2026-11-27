// THE INTRO OPENS BY ITSELF ONCE (OnboardingSteps.md:3-5): on the reader's
// first authenticated feed entry, from applicant on, given the account's
// seen flag is unset — and never once it is set, on any device. The flag is
// the account's, so the gate asks the server, never the device.

package com.cogra.feature.onboarding.intro

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.intro.IntroRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Whether the intro is due over this feed entry: read once per entry. A
 * read that fails or refuses opens nothing — an intro that cannot be
 * marked seen would return on every entry.
 */
@HiltViewModel
class IntroGateViewModel @Inject constructor(private val intro: IntroRepository) : ViewModel() {

    private val _due = MutableStateFlow(false)
    val due: StateFlow<Boolean> = _due.asStateFlow()

    init {
        viewModelScope.launch {
            val read = intro.introAccount()
            if (read is Outcome.Success && read.value?.hasSeen == false) _due.value = true
        }
    }

    /** The intro has opened; this entry never opens it again. */
    fun opened() {
        _due.value = false
    }
}

/** Opens the intro over the feed it stands on, once, when [IntroGateViewModel] says it is due. */
@Composable
fun IntroGate(viewModel: IntroGateViewModel, onOpen: () -> Unit) {
    val due by viewModel.due.collectAsStateWithLifecycle()
    LaunchedEffect(due) {
        if (due) {
            viewModel.opened()
            onOpen()
        }
    }
}
