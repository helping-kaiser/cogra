package com.cogra.feature.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.hidden.HiddenView
import com.cogra.domain.notifications.Notification
import com.cogra.domain.notifications.NotificationBell
import com.cogra.domain.notifications.NotificationsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What the list has read, as the screen renders it. */
data class NotificationsUiState(
    val notifications: List<Notification> = emptyList(),
    val loading: Boolean = true,
    /** The first read failed with nothing loaded: the transport line stands. */
    val failed: Boolean = false,
    val loadingMore: Boolean = false,
    /** A next page did not arrive: `Couldn't load more` with Retry ends the list. */
    val moreFailed: Boolean = false,
    val endCursor: String? = null,
    val hasNextPage: Boolean = false,
    /** The rows opened on this visit: their dots go at the tap, before the server's mark. */
    val opened: Set<String> = emptySet(),
)

/**
 * The list's reads and its two read marks (Notifications.md:29, :31).
 *
 * OPENING CLEARS THE BELL, locally and at once, and the server's seen pointer
 * moves to the newest row the read holds, so a row that arrives after the read
 * still lights the bell at the next root load. Tapping a row clears its own
 * dot. Both marks go silently through the bell's queue ([NotificationBell]).
 *
 * A HIDDEN ACCOUNT'S ROWS LEAVE AT ONCE (PR-11). The server drops them from
 * every read, the held rows are laid under the reader's own hidden set
 * ([hidden], the one store the feed filters by), and the list reads again
 * whenever it comes back on screen ([resumed]).
 */
@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val repository: NotificationsRepository,
    private val bell: NotificationBell,
    private val hiddenSet: HiddenSet,
) : ViewModel() {
    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    /** The reader's hidden set, as the tap left it. */
    val hidden: StateFlow<HiddenView> = hiddenSet.view

    /** Which read is live: a newer one must not be overwritten by an older answer. */
    private var request = 0
    private var shown = false

    init {
        viewModelScope.launch { bell.listOpened() }
        viewModelScope.launch { hiddenSet.ensure() }
        read()
    }

    /** The first page — on arrival, on Retry, and on every return to the screen. */
    fun read() {
        val asked = ++request
        _state.update { it.copy(loading = it.notifications.isEmpty()) }
        viewModelScope.launch {
            val page = (repository.page(after = null) as? Outcome.Success)?.value
            if (asked != request) return@launch
            if (page == null) {
                _state.update { it.copy(loading = false, failed = it.notifications.isEmpty()) }
                return@launch
            }
            _state.update {
                it.copy(
                    notifications = page.notifications,
                    loading = false,
                    failed = false,
                    moreFailed = false,
                    endCursor = page.endCursor,
                    hasNextPage = page.hasNextPage,
                )
            }
            // Everything this read holds is seen; an empty list sends nothing.
            page.notifications.firstOrNull()?.let { newest -> bell.markSeen(newest.createdAt) }
        }
    }

    /** The screen came back on: re-read after the first showing. */
    fun resumed() {
        if (shown) read()
        shown = true
    }

    fun loadMore() {
        val current = _state.value
        if (current.loadingMore || !current.hasNextPage || current.endCursor == null) return
        _state.update { it.copy(loadingMore = true, moreFailed = false) }
        viewModelScope.launch {
            val page = (repository.page(after = current.endCursor) as? Outcome.Success)?.value
            if (page == null) {
                // THE ROWS ON SCREEN STAY, and the fault ends the list.
                _state.update { it.copy(loadingMore = false, moreFailed = true) }
                return@launch
            }
            _state.update { state ->
                val held = state.notifications.map { it.id }.toSet()
                state.copy(
                    notifications = state.notifications + page.notifications.filterNot { it.id in held },
                    loadingMore = false,
                    endCursor = page.endCursor,
                    hasNextPage = page.hasNextPage,
                )
            }
        }
    }

    /** A row was tapped: its dot goes now, and the server is told behind it. */
    fun opened(row: Notification) {
        _state.update { it.copy(opened = it.opened + row.id) }
        if (row.readAt == null) viewModelScope.launch { bell.markRead(row.id) }
    }
}

/**
 * A root's fresh load of the bell (FeedUnread.md:3, :5). Scoped to the root's
 * back-stack entry, so it asks once per entry: a return by back or the bar
 * reuses the entry and never asks again (:9); the root's own pull asks anew
 * ([pulled]).
 */
@HiltViewModel
class RootBellViewModel @Inject constructor(private val bell: NotificationBell) : ViewModel() {
    init {
        viewModelScope.launch { bell.freshRootLoad() }
    }

    fun pulled() {
        viewModelScope.launch { bell.freshRootLoad() }
    }
}

/** The shell's view of the bell's dot: one state every root band shows. */
@HiltViewModel
class BellViewModel @Inject constructor(bell: NotificationBell) : ViewModel() {
    val lit: StateFlow<Boolean> = bell.lit
}
