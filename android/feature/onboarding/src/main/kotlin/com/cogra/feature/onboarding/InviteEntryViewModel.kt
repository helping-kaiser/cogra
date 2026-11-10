package com.cogra.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.InviteCheck
import com.cogra.domain.Outcome
import com.cogra.domain.extractInviteId
import com.cogra.domain.repo.OnboardingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Where a checked link sends the reader on (consumed once by the route). */
sealed interface InviteEntryExit {
    /** The link checks out: Join opens holding it, under its inviter. */
    data class Join(val inviteId: String, val inviterHandle: String) : InviteEntryExit

    /** A link opened from outside the app is dead: the landing stays, one snackbar says so. */
    data object DeadArrival : InviteEntryExit
}

data class InviteEntryUiState(
    val input: String = "",
    /** The unusable reading (`JoinInvalid`): the same field and ways out under its own heading. */
    val invalid: Boolean = false,
    val inFlight: Boolean = false,
    /** The press found nothing in the field that reads as a link. */
    val notALink: Boolean = false,
    /** No answer reached the device: the line above Continue, Continue the retry. */
    val noAnswer: Boolean = false,
    val exit: InviteEntryExit? = null,
) {
    /** Continue waits while the field is empty (InviteEntry.md, JoinInvalid.md:41). */
    val waiting: Boolean get() = input.isEmpty()
}

/**
 * THE INVITE DOOR (auth.md "Application" step 1; InviteEntry.md,
 * JoinInvalid.md): the link is checked anonymously before the form. The
 * field takes a full invite URL or the bare id (auth.md "Link URLs").
 *
 * A link read and refused — unknown or no longer usable — brings the
 * door's unusable reading, so a different link can be pasted right there.
 * A link opened from outside the app never shows that reading: a dead one
 * leaves the landing as it was under one snackbar (JoinInvalid.md:9-11).
 */
@HiltViewModel
class InviteEntryViewModel @Inject constructor(
    private val onboarding: OnboardingRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(InviteEntryUiState())
    val state = _state.asStateFlow()

    fun onInputChange(value: String) = _state.update {
        // The format line, once it stands, re-checks as the text changes.
        it.copy(input = value, notALink = it.notALink && extractInviteId(value) == null)
    }

    /** A link opened from outside the app: checked at once, its id already extracted. */
    fun onArrival(id: String) {
        _state.update { InviteEntryUiState(input = id, inFlight = true) }
        check(id, arrival = true)
    }

    fun onContinue() {
        val current = _state.value
        if (current.inFlight || current.waiting) return
        val id = extractInviteId(current.input) ?: run {
            _state.update { it.copy(notALink = true, noAnswer = false) }
            return
        }
        _state.update { it.copy(inFlight = true, notALink = false, noAnswer = false) }
        check(id, arrival = false)
    }

    fun onExitConsumed() = _state.update { it.copy(exit = null) }

    private fun check(id: String, arrival: Boolean) {
        viewModelScope.launch {
            val outcome = onboarding.checkInviteLink(id)
            _state.update { answered(it.copy(inFlight = false), outcome, id, arrival) }
        }
    }

    private fun answered(state: InviteEntryUiState, outcome: Outcome<InviteCheck?>, id: String, arrival: Boolean) =
        when (outcome) {
            is Outcome.Success -> when (val check = outcome.value) {
                null -> refused(state, arrival)
                else -> if (check.usable) {
                    state.copy(exit = InviteEntryExit.Join(id, check.inviterHandle))
                } else {
                    refused(state, arrival)
                }
            }
            is Outcome.Refused -> refused(state, arrival)
            is Outcome.Failed -> state.copy(noAnswer = true)
        }

    private fun refused(state: InviteEntryUiState, arrival: Boolean) =
        if (arrival) state.copy(exit = InviteEntryExit.DeadArrival) else state.copy(invalid = true)
}
