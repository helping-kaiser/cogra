package com.cogra.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.EdgeSighting
import com.cogra.domain.AccountState
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.ProfileFigures
import com.cogra.domain.ProfileView
import com.cogra.domain.RecordRow
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The profile's tab row (`CHRONICLE_TABS`; Profile.md:21) and what stands
 * below it: Posts the person's post cards (ProfilePosts.md:3), Comments their
 * comment cards (ProfileComments.md:3), and the right-most, Everything, the
 * chronicle of all their acts (Profile.md:23). Every visitor lands on
 * Everything (every board draws `value="everything"`).
 */
enum class ProfileTab(val id: String) {
    POSTS("posts"),
    COMMENTS("comments"),
    EVERYTHING("everything"),
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
    /** The viewer is an applicant — the invites entry and a comment's Reply lock. */
    val applicant: Boolean = false,
    /**
     * This is the member who vouched the viewer in, and the pair is still
     * incomplete: the anchor opens the vouch-back (ProfileOther.md:35) —
     * the card put away or not (VouchBack.md:51).
     */
    val vouchesBack: Boolean = false,
    val tab: ProfileTab = ProfileTab.EVERYTHING,
    /** Everything's chronicle acts, newest first. */
    val rows: List<RecordRow> = emptyList(),
    /** The posts view's cards, in the order the read serves. */
    val posts: List<PostView> = emptyList(),
    /** The comments view's cards, in the order the read serves. */
    val comments: List<ProfileComment> = emptyList(),
    /** A page of the standing tab's list is on its way. */
    val rowsLoading: Boolean = false,
    /** A further page failed — the tail shows `Couldn't load more` with Retry. */
    val pageFailed: Boolean = false,
    val endCursor: String? = null,
    val hasMore: Boolean = false,
    /**
     * The header's figures (`ProfileFigures`; Q35 closed toward the drawn
     * figures, jakob's confirmation pending); null until read, and kept
     * through a failed re-read.
     */
    val figures: ProfileFigures? = null,
) {
    /** How many cards or acts the standing tab lists. */
    val listed: Int
        get() = when (tab) {
            ProfileTab.POSTS -> posts.size
            ProfileTab.COMMENTS -> comments.size
            ProfileTab.EVERYTHING -> rows.size
        }
}

private const val PAGE = 20

/**
 * One profile — the viewer's own (null handle) or any actor's by handle —
 * with the list its tab row stands over: the person's posts and comments as
 * the feed's own cards, and the authored chronicle on Everything (roadmap
 * "Slice 2.1": the honest labelled history).
 *
 * Opening someone else's profile adds the profile to the reader's History
 * ("WHEN a profile opens -> the profile joins History", History.md:11) —
 * a page event, reported to the [SeenTracker] the moment the profile is
 * read, and sent at once: the opening is its own checkpoint. The profile
 * alone: its posts and comments join only as the reader scrolls each fully
 * into view ([onCardsSeen]). The reader's own profile is not reported — it
 * is where History's own door stands (ProfileOwnMenu.md:3, :15), and a
 * reader who has seen nothing must still find History empty there.
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profiles: ProfileRepository,
    private val account: AccountRepository,
    private val seenTracker: SeenTracker,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state = _state.asStateFlow()

    private var handle: String? = null
    private var started = false

    /** The standing tab's read: a tab switch cancels it, so an old tab's page never lands on the new one. */
    private var rowsJob: Job? = null

    /** Route entry: null opens the viewer's own profile. */
    fun start(handle: String?) {
        if (started) return
        started = true
        this.handle = handle
        refresh()
    }

    fun refresh() {
        // PostDetailViewModel's twin: a profile already on screen keeps
        // its content and shows the pull indicator; only the
        // nothing-loaded state goes full-screen (the shared degrade
        // rule this mirrors).
        _state.update { it.copy(loading = it.profile == null, refreshing = true) }
        viewModelScope.launch {
            val read = readProfile() ?: return@launch
            loadRows(reset = true)
            loadFigures(read.id)
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
                    val own = viewer != null && viewer.id == profile.id
                    _state.update {
                        it.copy(
                            loading = false,
                            refreshing = false,
                            notFound = false,
                            transportFailed = false,
                            profile = profile,
                            own = own,
                            applicant = viewer?.accountState == AccountState.APPLICANT,
                            vouchesBack = viewer?.accountState == AccountState.MEMBER &&
                                viewer.invitedBy?.id == profile.id &&
                                !viewer.hasReciprocated,
                        )
                    }
                    if (target != null && !own) {
                        seenTracker.saw(listOf(profile.id))
                        seenTracker.flush()
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

    /**
     * ONLY THE LIST BELOW THE TAB ROW CHANGES (ProfilePosts.md:13): the
     * header stays as it was, and the new tab reads its own list from its
     * first page. A tap on the standing tab changes nothing (:21).
     */
    fun onTabChange(tab: ProfileTab) {
        if (tab == _state.value.tab) return
        _state.update {
            it.copy(
                tab = tab,
                rows = emptyList(),
                posts = emptyList(),
                comments = emptyList(),
                endCursor = null,
                hasMore = false,
                pageFailed = false,
            )
        }
        loadRows(reset = true)
    }

    fun onLoadMore() = loadRows(reset = false)

    /**
     * RETRY ASKS AGAIN FOR THE PAGE THAT DID NOT ARRIVE (ProfileMoreFailed.md):
     * the first page when nothing has landed yet, else the next one.
     */
    fun onRetryPage() {
        val s = _state.value
        loadRows(reset = s.listed == 0 && s.endCursor == null)
    }

    /** Post and comment cards that stood fully in the viewport, in order (History.md:11). */
    fun onCardsSeen(nodeIds: List<String>) = seenTracker.saw(nodeIds)

    /** Tall cards with an edge on screen; each joins once both edges have been (History.md:13). */
    fun onCardEdgesSeen(sightings: List<EdgeSighting>) =
        sightings.forEach { seenTracker.sawEdges(it.nodeId, top = it.top, bottom = it.bottom) }

    /** The reading paused — the scroll rested or the reader left. */
    fun onSeenCheckpoint() = seenTracker.flush()

    /**
     * The header's figures, read beside the list. A failed read leaves
     * the figures as they were: the header draws what it has, never a false
     * zero.
     */
    private fun loadFigures(actorId: String) {
        viewModelScope.launch {
            val figures = (profiles.figures(actorId) as? Outcome.Success)?.value ?: return@launch
            _state.update { it.copy(figures = figures) }
        }
    }

    private fun loadRows(reset: Boolean) {
        val s = _state.value
        val author = s.profile?.id ?: return
        if (reset) {
            rowsJob?.cancel()
        } else if (rowsJob?.isActive == true || !s.hasMore) {
            return
        }
        val after = if (reset) null else s.endCursor
        _state.update { it.copy(rowsLoading = true, pageFailed = false) }
        rowsJob = viewModelScope.launch {
            when (s.tab) {
                ProfileTab.POSTS -> land(profiles.profilePosts(author, after)) { page ->
                    copy(posts = joined(posts, page.items, reset) { it.id })
                }
                ProfileTab.COMMENTS -> land(profiles.profileComments(author, after)) { page ->
                    copy(comments = joined(comments, page.items, reset) { it.comment.id })
                }
                ProfileTab.EVERYTHING -> land(profiles.authorRecords(author, PAGE, after)) { page ->
                    copy(rows = joined(rows, page.items, reset) { it.id })
                }
            }
        }
    }

    /** One page of the standing tab's list, folded in: its items, its cursor, or the failed tail. */
    private fun <T> land(outcome: Outcome<Page<T>>, into: ProfileUiState.(Page<T>) -> ProfileUiState) {
        when (outcome) {
            is Outcome.Success -> _state.update {
                it.into(outcome.value).copy(
                    rowsLoading = false,
                    endCursor = outcome.value.endCursor,
                    hasMore = outcome.value.hasNextPage,
                )
            }
            // The rows already on screen stay as they were, readable and live
            // (ProfileMoreFailed.md:7); a first page that fails stands the
            // same quiet row with Retry where the list would have.
            is Outcome.Refused, is Outcome.Failed -> _state.update { it.copy(rowsLoading = false, pageFailed = true) }
        }
    }
}

/**
 * A page joined to the list: a first page replaces it; a further page joins
 * below it, any item it already holds skipped — a thing that lands between two
 * fetches can move below the cursor the walk resumes from (web's
 * `appendDeduped`).
 */
private fun <T> joined(current: List<T>, page: List<T>, reset: Boolean, key: (T) -> String): List<T> {
    if (reset) return page
    val held = current.mapTo(HashSet(), key)
    return current + page.filterNot { key(it) in held }
}
