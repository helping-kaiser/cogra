// The deletion band's wiring on the read shell (`FeedDeleting.md`;
// `DeletionBand.prompt.md`). The band itself is a design-system atom; what
// lives here is the read behind it and its one act, the Cancel.

package com.cogra.feature.home

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.v2.atom.DeletionBand
import com.cogra.core.designsystem.v2.atom.forwardCount
import com.cogra.domain.ForwardUnit
import com.cogra.domain.Outcome
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.deletion.bandDeletion
import com.cogra.domain.forwardLadder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

data class DeletionBandUiState(
    /** The confirmed deletion in its grace; null draws no band. */
    val deletion: AccountDeletion? = null,
    /** The moment the count reads from. */
    val now: Instant = Instant.EPOCH,
    val canceling: Boolean = false,
)

/**
 * The band's holder on the read shell. The deletion itself is the app-wide
 * [AccountDeletionState] — a cancel pressed on settings' band or the grace
 * page takes this band away too, and this band's cancel takes theirs
 * (`DeleteAccountCanceled.md:7`).
 *
 * It reads only for a signed-in reader, and forgets the account's standing
 * when the session ends, so no band from one account ever stands over
 * another's feed.
 */
@HiltViewModel
class DeletionBandViewModel @Inject constructor(
    private val deletion: AccountDeletionState,
) : ViewModel() {

    /** The clock the count reads; a test pins it. */
    internal var clock: () -> Instant = Instant::now

    private val _state = MutableStateFlow(DeletionBandUiState())
    val state = _state.asStateFlow()

    private val _snackbars = Channel<Int>(Channel.BUFFERED)

    /** One-shot snackbar lines, as string resources. */
    val snackbars = _snackbars.receiveAsFlow()

    private var signedIn = false

    /** The re-read waiting for the standing deadline. */
    private var atDeadline: Job? = null

    init {
        viewModelScope.launch {
            deletion.standing.collect { standing ->
                val band = standing.bandDeletion().takeIf { signedIn }
                _state.update { it.copy(deletion = band, now = clock()) }
                awaitDeadline(band)
            }
        }
    }

    /** The session the shell resolved. */
    fun onSession(signedIn: Boolean) {
        this.signedIn = signedIn
        if (signedIn) {
            val band = deletion.standing.value.bandDeletion()
            _state.update { it.copy(deletion = band, now = clock()) }
            awaitDeadline(band)
            refresh()
        } else {
            atDeadline?.cancel()
            deletion.clear()
            _state.update { it.copy(deletion = null) }
        }
    }

    /**
     * At the deadline the standing is read again, so the server's answer
     * decides whether the deletion ran (ER-G6): a session the execution
     * ended is refused, the session ends, and the shell lands the reader on
     * the bare view ([AccountDeletionState.onSessionEnded]).
     */
    private fun awaitDeadline(band: AccountDeletion?) {
        atDeadline?.cancel()
        if (band == null) return
        atDeadline = viewModelScope.launch {
            val wait = Duration.between(clock(), band.scheduledFor).toMillis()
            if (wait > 0) delay(wait)
            _state.update { it.copy(now = clock()) }
            deletion.refresh()
        }
    }

    /** Re-reads with the feed's pull and on every return, so a confirm from the mail reaches the band. */
    fun refresh() {
        if (!signedIn) return
        _state.update { it.copy(now = clock()) }
        viewModelScope.launch { deletion.refresh() }
    }

    /**
     * Cancel: the request is abandoned, the band goes, and the canceled
     * snackbar — never with Undo, never a confirmation screen
     * (`FeedDeleting.md:19`). With no answer the network error answers
     * (`:21`) and the band stays.
     */
    fun onCancel() {
        if (_state.value.canceling) return
        _state.update { it.copy(canceling = true) }
        viewModelScope.launch {
            val outcome = deletion.cancel()
            _state.update { it.copy(canceling = false) }
            _snackbars.send(cancelLine(outcome))
        }
    }
}

@StringRes
internal fun cancelLine(outcome: Outcome<Unit>): Int = when (outcome) {
    is Outcome.Success -> R.string.deletion_canceled
    is Outcome.Failed -> R.string.deletion_cancel_no_answer
    is Outcome.Refused -> R.string.deletion_cancel_refused
}

/**
 * The band as the read shell's collapsing top wears it — in the root's band,
 * collapsing and returning with it (`FeedDeleting.md:5`). Its snackbars
 * speak on the shell's host, over the surface the reader was on
 * (`DeleteAccountCanceled.md:3`).
 *
 * [refreshSignal] is the feed's own pull, counted: each new value re-reads.
 */
@Composable
fun DeletionBandRoute(
    signedIn: Boolean,
    refreshSignal: Int = 0,
    node: DataNode? = DataNode("feed") / "deletionBand",
    viewModel: DeletionBandViewModel = hiltViewModel(),
) {
    LaunchedEffect(signedIn) { viewModel.onSession(signedIn) }
    LaunchedEffect(refreshSignal) { if (refreshSignal > 0) viewModel.refresh() }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }
    val host = LocalSnackbarHostState.current
    // Resolved in composition, so a configuration change re-reads them.
    val lines = mapOf(
        R.string.deletion_canceled to stringResource(R.string.deletion_canceled),
        R.string.deletion_cancel_no_answer to stringResource(R.string.deletion_cancel_no_answer),
        R.string.deletion_cancel_refused to stringResource(R.string.deletion_cancel_refused),
    )
    val currentLines by rememberUpdatedState(lines)
    LaunchedEffect(viewModel, host) {
        viewModel.snackbars.collect { line -> currentLines[line]?.let { host?.showSnackbar(it) } }
    }
    val state by viewModel.state.collectAsStateWithLifecycle()
    DeletionBandBanner(state, onCancel = viewModel::onCancel, node = node)
}

@Composable
fun DeletionBandBanner(state: DeletionBandUiState, onCancel: () -> Unit, node: DataNode? = null) {
    val deletion = state.deletion ?: return
    val count = forwardLadder(deletion.scheduledFor, state.now)
    DeletionBand(
        count = forwardCount(count.count, inHours = count.unit == ForwardUnit.HOURS),
        content = deletion.includesContent,
        onCancel = onCancel,
        node = node,
        testTag = "home_deletion_band",
    )
}
