package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileView
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionDirection
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Whose page this is — the three readings every board chip draws (`whose`). */
enum class StancesWhose { OWN, OTHER, DELETED }

data class ProfileStancesUiState(
    /** Nothing read yet: the loading line stands. */
    val loading: Boolean = true,
    /** The pull-down's read in flight, over what stands. */
    val refreshing: Boolean = false,
    val notFound: Boolean = false,
    /** A read failed with nothing to show in its place: the fault and Retry stand. */
    val failed: Boolean = false,
    val profile: ProfileView? = null,
    /** The page is the reader's own — by identity, whichever door opened it. */
    val own: Boolean = false,
    val direction: OpinionDirection = OpinionDirection.ON,
    /** The rows of [direction], strongest first; null until that direction has been read. */
    val rows: List<HeldOpinion>? = null,
) {
    val whose: StancesWhose
        get() = when {
            own -> StancesWhose.OWN
            profile?.deleted == true -> StancesWhose.DELETED
            else -> StancesWhose.OTHER
        }
}

/**
 * THE OPINIONS PAGE (ProfileStances.md): one person's opinions in two
 * directions, a tab each, never one merged list.
 *
 * The person is read first — the title, whose words the tabs speak, and the
 * id the directions are read by — then the tab standing now. A tab switch
 * reads the other set in place; a read the reader has moved past never lands
 * on the tab standing now ([request]). The pull-down re-reads both, keeping
 * what stands until the answer arrives.
 *
 * THE READER IS NEVER A ROW ON THEIR OWN PAGE (ProfileStances.md:21): an
 * opinion the reader holds on themselves names the reader, who is the page.
 */
@HiltViewModel
class ProfileStancesViewModel @Inject constructor(
    private val profiles: ProfileRepository,
    private val account: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileStancesUiState())
    val state = _state.asStateFlow()

    private var handle: String? = null
    private var started = false

    /** Which person read is live: a newer one must not be overwritten by an older answer. */
    private var personRequest = 0

    /** Which set read is live: a set the reader has tabbed away from never lands. */
    private var rowsRequest = 0

    /** Route entry: a null [handle] is the reader's own page (the Profile tab's root). */
    fun start(handle: String?) {
        if (started) return
        started = true
        this.handle = handle
        refresh()
    }

    /** The first read, Retry, and the pull-down: the person, then the tab standing now. */
    fun refresh() {
        val asked = ++personRequest
        _state.update { it.copy(loading = it.rows == null, refreshing = true, failed = false) }
        viewModelScope.launch {
            val viewer = (account.me() as? Outcome.Success)?.value
            val target = handle
            val read = if (target == null) profiles.myProfile() else profiles.profileByHandle(target)
            if (asked != personRequest) return@launch
            val profile = when (read) {
                is Outcome.Success -> read.value
                is Outcome.Refused, is Outcome.Failed -> {
                    _state.update {
                        it.copy(loading = false, refreshing = false, failed = it.profile == null || it.rows == null)
                    }
                    return@launch
                }
            }
            if (profile == null) {
                _state.update { it.copy(loading = false, refreshing = false, notFound = true) }
                return@launch
            }
            _state.update {
                it.copy(
                    notFound = false,
                    profile = profile,
                    own = target == null || (viewer != null && viewer.id == profile.id),
                )
            }
            readRows(profile.id, _state.value.direction)
        }
    }

    /** A tab tap: the list swaps in place to the other direction (ProfileStances.md:29, :31). */
    fun onDirection(next: OpinionDirection) {
        val current = _state.value
        if (next == current.direction) return
        ++rowsRequest
        _state.update { it.copy(direction = next, rows = null, failed = false, loading = true) }
        // Before the person has answered, the person's read reads this tab.
        val profile = current.profile ?: return
        viewModelScope.launch { readRows(profile.id, next) }
    }

    private suspend fun readRows(actorId: String, direction: OpinionDirection) {
        val asked = ++rowsRequest
        val outcome = profiles.opinions(actorId, direction)
        if (asked != rowsRequest) return
        when (outcome) {
            is Outcome.Success -> _state.update { state ->
                val rows = if (state.own) outcome.value.filter { it.holder.actorId != actorId } else outcome.value
                state.copy(loading = false, refreshing = false, failed = false, rows = rows)
            }
            // What stands stays; only an empty place goes to the fault.
            is Outcome.Refused, is Outcome.Failed -> _state.update {
                it.copy(loading = false, refreshing = false, failed = it.rows == null)
            }
        }
    }
}
