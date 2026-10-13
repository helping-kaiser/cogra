// DeleteAccountPending, the grace page (`DeleteAccountPending.jsx`,
// `DeleteAccountPending.md`; erasure.md §5 step 3). What the settings row
// opens once the deletion is confirmed: the deadline in full, and `Cancel`,
// the band's word for the same act. The band steps aside on this one page —
// the page itself is the deletion's.

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.domain.Outcome
import com.cogra.domain.dateLine
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.forwardLadder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

data class DeleteAccountPendingUiState(
    /** The confirmed deletion; null until known. */
    val deletion: AccountDeletion? = null,
    /** The moment the count reads from. */
    val now: Instant = Instant.EPOCH,
    val inFlight: Boolean = false,
    @StringRes val fault: Int? = null,
)

sealed interface DeleteAccountPendingEvent {
    /** Called off: settings returns with the canceled snackbar, the band gone. */
    data object Canceled : DeleteAccountPendingEvent

    /** Nothing stands any more (canceled on another device): settings returns as it is. */
    data object Gone : DeleteAccountPendingEvent
}

@HiltViewModel
class DeleteAccountPendingViewModel @Inject constructor(
    private val standing: AccountDeletionState,
) : ViewModel() {

    /** The clock the count reads; a test pins it. */
    internal var clock: () -> Instant = Instant::now

    private val _state = MutableStateFlow(DeleteAccountPendingUiState())
    val state = _state.asStateFlow()

    private val _events = Channel<DeleteAccountPendingEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    /** Reads on every arrival: another device may have canceled meanwhile. */
    fun refresh() {
        _state.update { it.copy(deletion = standing.standing.value?.deletion ?: it.deletion, now = clock()) }
        viewModelScope.launch {
            val read = standing.refresh()
            if (read !is Outcome.Success) return@launch
            val deletion = read.value?.deletion
            if (deletion == null) {
                _events.send(DeleteAccountPendingEvent.Gone)
            } else {
                _state.update { it.copy(deletion = deletion, now = clock()) }
            }
        }
    }

    /**
     * `Cancel`: called off with no dialog and no Undo (`DeleteAccountPending.md:11`).
     * With no answer the network error answers and the deletion still stands (`:15`).
     */
    fun onCancel() {
        if (_state.value.inFlight) return
        _state.update { it.copy(inFlight = true, fault = null) }
        viewModelScope.launch {
            val outcome = standing.cancel()
            _state.update { it.copy(inFlight = false, fault = faultOf(outcome)) }
            if (outcome is Outcome.Success) _events.send(DeleteAccountPendingEvent.Canceled)
        }
    }
}

@Composable
fun DeleteAccountPendingRoute(
    onBack: () -> Unit,
    onCanceled: (notice: String) -> Unit,
    viewModel: DeleteAccountPendingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notice = stringResource(R.string.deletion_canceled)
    LaunchedEffect(viewModel) { viewModel.refresh() }
    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                DeleteAccountPendingEvent.Canceled -> onCanceled(notice)
                DeleteAccountPendingEvent.Gone -> onBack()
            }
        }
    }
    DeleteAccountPendingScreen(state = state, onBack = onBack, onCancel = viewModel::onCancel)
}

/**
 * `DeleteAccount`'s column with its request spent: the row's heading, the
 * deadline and what holds until it, and `Cancel` as the one commitment.
 */
@Composable
fun DeleteAccountPendingScreen(
    state: DeleteAccountPendingUiState,
    onBack: () -> Unit,
    onCancel: () -> Unit,
) {
    val page = DeleteAccountPage
    val deletion = state.deletion
    TaskPage(
        node = page,
        backLabel = stringResource(R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.delete_account_title),
        lead = deletion?.let {
            stringResource(
                R.string.delete_pending_body,
                forwardLadder(it.scheduledFor, state.now).words(),
                dateLine(it.scheduledFor),
            )
        }.orEmpty(),
    ) {
        if (deletion != null) {
            Spacer(Modifier.height(24.dp))
            DeletionCommit(
                label = stringResource(R.string.delete_pending_cancel),
                onCommit = onCancel,
                inFlight = state.inFlight,
                inFlightLabel = stringResource(R.string.delete_pending_canceling),
                fault = state.fault?.let { stringResource(it) },
                node = page / "cancel",
            )
        }
    }
}
