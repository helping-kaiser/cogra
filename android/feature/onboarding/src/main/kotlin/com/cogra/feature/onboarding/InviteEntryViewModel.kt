package com.cogra.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.InviteCheck
import com.cogra.domain.Outcome
import com.cogra.domain.repo.OnboardingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class InviteEntryUiState(
    val input: String = "",
    val inProgress: Boolean = false,
    /** The pre-submit view; set after a successful check. */
    val check: InviteCheck? = null,
    /** The id the check ran for — what Continue carries forward. */
    val inviteId: String? = null,
    val notFound: Boolean = false,
    val malformed: Boolean = false,
    val transportFailed: Boolean = false,
) {
    val canContinue: Boolean get() = check?.usable == true && inviteId != null
}

/**
 * The link-open gate (auth.md "Application" step 1): the capability is
 * checked anonymously before the form and the key ceremony. Accepts a
 * full invite URL or the bare id — the paste fallback of auth.md
 * "Link URLs".
 */
@HiltViewModel
class InviteEntryViewModel @Inject constructor(
    private val onboarding: OnboardingRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(InviteEntryUiState())
    val state = _state.asStateFlow()

    fun onInputChange(value: String) = _state.update {
        InviteEntryUiState(input = value)
    }

    /** A deep-linked open lands here with the id already extracted. */
    fun onDeepLink(id: String) {
        _state.update { InviteEntryUiState(input = id) }
        onCheck()
    }

    fun onCheck() {
        val id = extractId(_state.value.input) ?: run {
            _state.update { it.copy(malformed = true) }
            return
        }
        _state.update { it.copy(inProgress = true, notFound = false, malformed = false, transportFailed = false) }
        viewModelScope.launch {
            when (val outcome = onboarding.checkInviteLink(id)) {
                is Outcome.Success -> _state.update {
                    when (val check = outcome.value) {
                        null -> it.copy(inProgress = false, notFound = true)
                        else -> it.copy(inProgress = false, check = check, inviteId = id)
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(inProgress = false, notFound = true) }
                is Outcome.Failed -> _state.update { it.copy(inProgress = false, transportFailed = true) }
            }
        }
    }

    companion object {
        private val UUID_PATTERN =
            Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

        /** The last UUID in the input — handles `/join/<id>` URLs and bare ids. */
        fun extractId(input: String): String? =
            UUID_PATTERN.findAll(input.trim()).lastOrNull()?.value?.lowercase()
    }
}
