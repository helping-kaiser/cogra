// DeleteAccount, the explain-and-request screen (`DeleteAccount.jsx`,
// `DeleteAccount.md`; copy-voice "Deleting the account"; erasure.md §5).
//
// WHICH BODY STANDS IS THE SERVER'S CALL (OS-15): `User.deletionPath` names
// the one deletion verb that will answer, and the screen keys on it alone —
// BY_LINK draws the member's request (the mailed link and the grace),
// IMMEDIATE the applicant's immediate delete. Nothing here reads the
// application: a client-derived lock would unlock a row the server refuses.

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.Outcome
import com.cogra.domain.deletion.AccountDeletionRepository
import com.cogra.domain.deletion.AccountDeletionState
import com.cogra.domain.identity.EndLocalSession
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Which of the board's two cases the reader is in, by the server's path. */
enum class DeleteAccountCase {
    /** BY_LINK: the request, the mailed link, the grace. */
    MEMBER,

    /** IMMEDIATE: deleted at once, in the app. */
    APPLICANT,
}

data class DeleteAccountUiState(
    /** Null until the path is read. */
    val case: DeleteAccountCase? = null,
    /** The path read did not answer, and nothing was known before it. */
    val unreachable: Boolean = false,
    /** `Also remove what I posted` — unticked, the default and the ruling. */
    val includeContent: Boolean = false,
    val inFlight: Boolean = false,
    /** The line above the commitment; the commitment stays as the retry. */
    @StringRes val fault: Int? = null,
)

sealed interface DeleteAccountEvent {
    /** The link went out: the mail screen opens, carrying the recorded choice for its Resend. */
    data class Mailed(val includeContent: Boolean) : DeleteAccountEvent

    /** Neither verb answers from here (LOCKED): back to settings, which says why. */
    data object Locked : DeleteAccountEvent
}

/** The case a path draws; null where neither verb opens. */
internal fun AccountDeletionPath.case(): DeleteAccountCase? = when (this) {
    AccountDeletionPath.BY_LINK -> DeleteAccountCase.MEMBER
    AccountDeletionPath.IMMEDIATE -> DeleteAccountCase.APPLICANT
    // An unknown path is the weaker claim: locked (Models.kt).
    AccountDeletionPath.LOCKED, AccountDeletionPath.UNKNOWN -> null
}

@HiltViewModel
class DeleteAccountViewModel @Inject constructor(
    private val deletions: AccountDeletionRepository,
    private val standing: AccountDeletionState,
    private val endLocalSession: EndLocalSession,
) : ViewModel() {

    private val _state = MutableStateFlow(
        DeleteAccountUiState(case = standing.standing.value?.path?.case()),
    )
    val state = _state.asStateFlow()

    private val _events = Channel<DeleteAccountEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    init {
        readPath()
    }

    fun onRetryRead() {
        _state.update { it.copy(unreachable = false) }
        readPath()
    }

    private fun readPath() {
        viewModelScope.launch {
            when (val read = standing.refresh()) {
                is Outcome.Success -> applyPath(read.value?.path)
                else -> _state.update { if (it.case == null) it.copy(unreachable = true) else it }
            }
        }
    }

    private suspend fun applyPath(path: AccountDeletionPath?) {
        val case = path?.case()
        if (path != null && case == null) {
            _events.send(DeleteAccountEvent.Locked)
            return
        }
        _state.update { it.copy(case = case ?: it.case, unreachable = false) }
    }

    /** Ticks or unticks; nothing is deleted or scheduled (`DeleteAccount.md:17`). */
    fun onToggleSweep() = _state.update { if (it.inFlight) it else it.copy(includeContent = !it.includeContent) }

    /** `Send the confirmation link`: records the request and mails the link; schedules nothing. */
    fun onSend() {
        val s = _state.value
        if (s.inFlight || s.case != DeleteAccountCase.MEMBER) return
        _state.update { it.copy(inFlight = true, fault = null) }
        viewModelScope.launch {
            val outcome = deletions.request(s.includeContent)
            _state.update { it.copy(inFlight = false, fault = faultOf(outcome)) }
            when (outcome) {
                is Outcome.Success -> _events.send(DeleteAccountEvent.Mailed(s.includeContent))
                // The server's path is the arbiter: a refusal means it moved
                // under the screen, so it is read again.
                is Outcome.Refused -> readPath()
                is Outcome.Failed -> Unit
            }
        }
    }

    /**
     * `Delete my account`: the account and its application go at once. The
     * server has ended every session with it, so this device ends its own —
     * the ordinary remote-end path, which leaves the custody set exactly as
     * a session ended elsewhere would — and the shell lands the reader,
     * signed out, on the bare view under `Your account is deleted.`
     */
    fun onDeleteNow() {
        val s = _state.value
        if (s.inFlight || s.case != DeleteAccountCase.APPLICANT) return
        _state.update { it.copy(inFlight = true, fault = null) }
        viewModelScope.launch {
            val outcome = deletions.deleteApplicantAccount()
            if (outcome is Outcome.Success) {
                // Said before the session ends, so the landing knows why it ended.
                standing.markAccountDeleted()
                endLocalSession.end()
                return@launch
            }
            _state.update { it.copy(inFlight = false, fault = faultOf(outcome)) }
            if (outcome is Outcome.Refused) readPath()
        }
    }
}

/**
 * The line above the commitment. No answer is the drawn `That didn't send.
 * Try again.`; a refusal the boards draw no line for — the spent mail budget
 * included, whose own line waits on its design ruling — reads the house
 * `That didn't go through.`
 */
@StringRes
internal fun faultOf(outcome: Outcome<*>): Int? = when (outcome) {
    is Outcome.Success -> null
    is Outcome.Failed -> R.string.network_error
    is Outcome.Refused -> R.string.settings_save_failed
}

@Composable
fun DeleteAccountRoute(
    onBack: () -> Unit,
    onMailed: (includeContent: Boolean) -> Unit,
    /** Back to settings, with the locked row's own line (Settings.md :40). */
    onLocked: (notice: String) -> Unit,
    viewModel: DeleteAccountViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val locked = stringResource(R.string.settings_ending_locked)
    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is DeleteAccountEvent.Mailed -> onMailed(event.includeContent)
                DeleteAccountEvent.Locked -> onLocked(locked)
            }
        }
    }
    DeleteAccountScreen(
        state = state,
        onBack = onBack,
        onToggleSweep = viewModel::onToggleSweep,
        onSend = viewModel::onSend,
        onDeleteNow = viewModel::onDeleteNow,
        onRetryRead = viewModel::onRetryRead,
    )
}

/**
 * The task-flow column (`Restore`'s and the credential screens'): heading,
 * the consequence, the one choice, one commitment, the thing to know last.
 * Back goes to settings and sends nothing (`DeleteAccount.md:25`). No typed
 * confirmation, no password, no are-you-sure (`:13`).
 */
@Composable
fun DeleteAccountScreen(
    state: DeleteAccountUiState,
    onBack: () -> Unit,
    onToggleSweep: () -> Unit,
    onSend: () -> Unit,
    onDeleteNow: () -> Unit,
    onRetryRead: () -> Unit = {},
) {
    val page = DeleteAccountPage
    TaskPage(
        node = page,
        backLabel = stringResource(R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.delete_account_title),
        lead = when {
            state.case == DeleteAccountCase.MEMBER -> stringResource(R.string.delete_account_member_body)
            state.case == DeleteAccountCase.APPLICANT -> stringResource(R.string.delete_account_applicant_body)
            state.unreachable -> stringResource(R.string.error_transport)
            else -> ""
        },
    ) {
        when (state.case) {
            DeleteAccountCase.MEMBER -> MemberRequest(state, onToggleSweep, onSend)
            DeleteAccountCase.APPLICANT -> {
                Spacer(Modifier.height(24.dp))
                DeletionCommit(
                    label = stringResource(R.string.delete_account_delete),
                    onCommit = onDeleteNow,
                    inFlight = state.inFlight,
                    fault = state.fault?.let { stringResource(it) },
                    node = (page / "commit").keyed("applicant"),
                )
            }
            null -> if (state.unreachable) {
                Spacer(Modifier.height(24.dp))
                DeletionCommit(
                    label = stringResource(R.string.retry),
                    onCommit = onRetryRead,
                    node = DataNode("delete_account_retry"),
                )
            }
        }
    }
}

@Composable
private fun MemberRequest(state: DeleteAccountUiState, onToggleSweep: () -> Unit, onSend: () -> Unit) {
    val page = DeleteAccountPage
    Spacer(Modifier.height(24.dp))
    Inset(
        label = stringResource(R.string.delete_account_goes),
        lines = listOf(
            stringResource(R.string.delete_account_goes_profile),
            stringResource(R.string.delete_account_goes_link),
            stringResource(R.string.delete_account_goes_sessions),
        ),
        node = page / "goes",
    )
    Spacer(Modifier.height(24.dp))
    Inset(
        label = stringResource(R.string.delete_account_stays),
        lines = listOf(stringResource(R.string.delete_account_stays_signed)),
        node = page / "stays",
    )
    Spacer(Modifier.height(24.dp))
    SweepChoice(checked = state.includeContent, onToggle = onToggleSweep)
    Spacer(Modifier.height(24.dp))
    DeletionCommit(
        label = stringResource(R.string.delete_account_send),
        onCommit = onSend,
        inFlight = state.inFlight,
        inFlightLabel = stringResource(R.string.delete_account_sending),
        fault = state.fault?.let { stringResource(it) },
        node = (page / "commit").keyed("member"),
    )
    Spacer(Modifier.height(24.dp))
    QuietNote(
        text = stringResource(R.string.delete_account_note),
        modifier = Modifier.dataNode(page / "note"),
    )
}

/**
 * What goes, or what stays: `ChangeEmailConfirm`'s inset, because the two
 * are readings a reader has to hold at once — the caption, then its lines.
 */
@Composable
private fun Inset(label: String, lines: List<String>, node: DataNode) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.medium)
            .padding(Space.x3)
            .dataNode(node),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.dataNode(node / "label"),
        )
        lines.forEach { line ->
            Text(text = line, style = MaterialTheme.typography.bodySmall)
        }
    }
}
