package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.Outcome
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** The chronicle filter chips; every visitor lands on Posts. */
enum class ChronicleFilter(val family: Family?) {
    POSTS(Family.PUBLISH),
    COMMENTS(Family.REVIEW),
    EVERYTHING(null),
}

data class ProfileUiState(
    val loading: Boolean = true,
    /** The read in flight, not the empty screen (PostDetail's twin field). */
    val refreshing: Boolean = false,
    val notFound: Boolean = false,
    /** Full-screen only in the nothing-loaded state (the shared rule). */
    val transportFailed: Boolean = false,
    val profile: ProfileView? = null,
    /** The profile belongs to the signed-in viewer — edit unlocks. */
    val own: Boolean = false,
    /** The viewer is an applicant — the invites entry locks. */
    val applicant: Boolean = false,
    val filter: ChronicleFilter = ChronicleFilter.POSTS,
    val rows: List<RecordRow> = emptyList(),
    val rowsLoading: Boolean = false,
    /** A further page failed — the load-more control shows retry. */
    val pageFailed: Boolean = false,
    val endCursor: String? = null,
    val hasMore: Boolean = false,
)

private const val PAGE = 20

/**
 * How many reads wait for a signed edit to land, and how long between
 * them. The dev stack ingests every 2s and closes an epoch every 3s
 * (`development.md`), so a write is visible within a few seconds; the
 * budget is generous against that and still finite, because a wait
 * that cannot fail is a hang.
 */
private const val LANDING_READS = 12
private const val LANDING_POLL = 1_000L

/**
 * One profile — the viewer's own (null handle) or any actor's by
 * handle — with the authored chronicle under the filter chips
 * (roadmap "Slice 2.1": the honest labelled history).
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profiles: ProfileRepository,
    private val account: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state = _state.asStateFlow()

    private var handle: String? = null
    private var started = false

    /** Route entry: null opens the viewer's own profile. */
    fun start(handle: String?) {
        if (started) return
        started = true
        this.handle = handle
        refresh()
    }

    /**
     * An edit was signed on this device — show it once it exists.
     *
     * **A single re-read cannot work here, and that is the whole bug.**
     * The edit is a signed write: `approve` returns while the record is
     * still RELAYING, and the profile read serves only what has LANDED
     * (`crates/postgres-store/src/profile.rs` reads
     * `actor_profile_versions`). So the refetch that fires the instant
     * the editor pops answers with the version the edit replaced, and
     * nothing reads again — the screen sits on stale words until the
     * process dies (F2-8).
     *
     * So this waits for the version rather than for a timer: it re-reads
     * until [ProfileView.updatedAt] moves off the one the screen was
     * holding. Bounded, because a wait that cannot fail is a hang — the
     * ingest pass and the epoch clock are what it is waiting for, and if
     * they never come the screen simply keeps what it has, which is
     * where a single refetch left it anyway.
     */
    fun onEditSaved() {
        val before = _state.value.profile?.updatedAt
        viewModelScope.launch {
            repeat(LANDING_READS) {
                // A read that failed says nothing about the edit — it is
                // not the new version arriving, so the wait goes on.
                val fresh = readProfile()
                if (fresh != null && fresh.updatedAt != before) {
                    // The chronicle gained the edit's own record.
                    loadRows(reset = true)
                    return@launch
                }
                delay(LANDING_POLL)
            }
        }
    }

    fun refresh() {
        // PostDetailViewModel's twin: a profile already on screen keeps
        // its content and shows the pull indicator; only the
        // nothing-loaded state goes full-screen (the shared degrade
        // rule this mirrors).
        _state.update { it.copy(loading = it.profile == null, refreshing = true) }
        viewModelScope.launch {
            if (readProfile() != null) loadRows(reset = true)
        }
    }

    /** One read of the profile this screen is on, folded into state. */
    private suspend fun readProfile(): ProfileView? {
        val viewer = when (val outcome = account.me()) {
            is Outcome.Success -> outcome.value
            is Outcome.Refused -> null
            is Outcome.Failed -> null
        }
        val target = handle
        return when (val outcome = if (target == null) profiles.myProfile() else profiles.profileByHandle(target)) {
            is Outcome.Success -> {
                val profile = outcome.value
                if (profile == null) {
                    _state.update { it.copy(loading = false, refreshing = false, notFound = true) }
                    null
                } else {
                    _state.update {
                        it.copy(
                            loading = false,
                            refreshing = false,
                            notFound = false,
                            transportFailed = false,
                            profile = profile,
                            own = viewer != null && viewer.id == profile.id,
                            applicant = viewer?.accountState == AccountState.APPLICANT,
                        )
                    }
                    profile
                }
            }
            is Outcome.Refused -> {
                // The own-profile read refused: the session is gone; the
                // auth-state holder navigates.
                _state.update { it.copy(loading = false, refreshing = false, notFound = true) }
                null
            }
            is Outcome.Failed -> {
                // The fault reflects the last completed fetch: loaded
                // content stays; only the nothing-loaded state goes
                // full-screen (the shared degrade rule).
                _state.update { it.copy(loading = false, refreshing = false, transportFailed = it.profile == null) }
                null
            }
        }
    }

    fun onFilterChange(filter: ChronicleFilter) {
        if (filter == _state.value.filter) return
        _state.update { it.copy(filter = filter, rows = emptyList(), endCursor = null, hasMore = false) }
        loadRows(reset = true)
    }

    fun onLoadMore() = loadRows(reset = false)

    private fun loadRows(reset: Boolean) {
        val s = _state.value
        val author = s.profile?.id ?: return
        if (s.rowsLoading) return
        _state.update { it.copy(rowsLoading = true, pageFailed = false) }
        viewModelScope.launch {
            val after = if (reset) null else s.endCursor
            when (val outcome = profiles.authorRecords(author, s.filter.family, PAGE, after)) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        rowsLoading = false,
                        rows = if (reset) outcome.value.items else it.rows + outcome.value.items,
                        endCursor = outcome.value.endCursor,
                        hasMore = outcome.value.hasNextPage,
                    )
                }
                is Outcome.Refused -> _state.update { it.copy(rowsLoading = false, pageFailed = true) }
                is Outcome.Failed -> _state.update { it.copy(rowsLoading = false, pageFailed = true) }
            }
        }
    }
}
