// DeleteAccountConfirmed, what the mailed link opens (`DeleteAccountConfirmed.jsx`,
// `DeleteAccountConfirmed.md`; erasure.md §5 step 2). The App Link on
// `/delete-account?token=` lands here (auth.md "Link URLs").
//
// OPENING THE LINK IS THE CONFIRMATION, signed in or not: the token is the
// capability, so the landing calls `confirmAccountDeletion` with no session
// and states what that started — the deadline in the band's own sentence,
// the date under it, and that any device can cancel. A re-open inside the
// grace is the same landing counting the days left; the grace never
// restarts (`:5`). When the request left the content sweep off, the landing
// offers it again; it never offers to take it back out (`:19`-`:23`).

package com.cogra.feature.settings

import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.dateLine
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.deletion.AccountDeletionRepository
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

/** What the landing stands on, one per answer the confirm can give. */
sealed interface ConfirmedLanding {
    data object Loading : ConfirmedLanding

    /** The deletion is confirmed; its grace runs to [deletion]'s deadline. */
    data class Confirmed(val deletion: AccountDeletion) : ConfirmedLanding

    /** No answer reached the device: nothing confirmed yet, and Retry. */
    data object Unreachable : ConfirmedLanding

    /**
     * A dead link — one `DELETION_TOKEN_INVALID` whatever the cause (used,
     * replaced, canceled, unknown): DeleteLinkExpired, the one landing that
     * never says which happened (ER-G1).
     */
    data object Dead : ConfirmedLanding

    /** Any other refusal: it did not go through, and the way on. */
    data object Refused : ConfirmedLanding
}

data class DeleteAccountConfirmedUiState(
    val landing: ConfirmedLanding = ConfirmedLanding.Loading,
    /** The moment the heading counts from. */
    val now: Instant = Instant.EPOCH,
    /** `Also remove what I posted` on the landing — unticked until the reader ticks it. */
    val sweepTicked: Boolean = false,
    val adding: Boolean = false,
    @StringRes val fault: Int? = null,
)

sealed interface DeleteAccountConfirmedEvent {
    /** The sweep joined: `Added — what you posted goes too.` */
    data object Added : DeleteAccountConfirmedEvent
}

@HiltViewModel
class DeleteAccountConfirmedViewModel @Inject constructor(
    private val deletions: AccountDeletionRepository,
    private val standing: AccountDeletionState,
) : ViewModel() {

    /** The clock the heading counts from; a test pins it. */
    internal var clock: () -> Instant = Instant::now

    private val _state = MutableStateFlow(DeleteAccountConfirmedUiState())
    val state = _state.asStateFlow()

    private val _events = Channel<DeleteAccountConfirmedEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    private var token: String? = null
    private var signedIn = false

    fun start(token: String, signedIn: Boolean) {
        if (this.token != null) return
        this.token = token
        this.signedIn = signedIn
        confirm()
    }

    fun onRetry() {
        _state.update { it.copy(landing = ConfirmedLanding.Loading) }
        confirm()
    }

    private fun confirm() {
        val token = token ?: return
        viewModelScope.launch {
            val outcome = deletions.confirm(token, includeContent = false)
            _state.update { it.copy(landing = landingOf(outcome), now = clock()) }
            if (outcome is Outcome.Success) bandFollows()
        }
    }

    /** Ticks or unticks; nothing changes until `Add it to the deletion` (`:25`). */
    fun onToggleSweep() = _state.update { if (it.adding) it else it.copy(sweepTicked = !it.sweepTicked) }

    /**
     * `Add it to the deletion`: with the box ticked the sweep joins; unticked,
     * the re-call adds nothing and the deletion stands account-only, exactly
     * as the link left it (`:27`, `:29`). With no answer the box keeps its
     * tick, the line stands and the commitment is the retry (`:33`).
     */
    fun onAdd() {
        val s = _state.value
        val token = token ?: return
        if (s.adding || s.landing !is ConfirmedLanding.Confirmed) return
        _state.update { it.copy(adding = true, fault = null) }
        viewModelScope.launch {
            val outcome = deletions.confirm(token, includeContent = s.sweepTicked)
            val deletion = (outcome as? Outcome.Success)?.value
            // A confirm answers the deletion it confirmed; none is a fault.
            val answered = outcome !is Outcome.Success || deletion != null
            _state.update {
                it.copy(
                    adding = false,
                    fault = if (answered) faultOf(outcome) else R.string.network_error,
                    landing = deletion?.let { d -> ConfirmedLanding.Confirmed(d) } ?: it.landing,
                    now = clock(),
                )
            }
            if (deletion != null) {
                bandFollows()
                if (deletion.includesContent && s.sweepTicked) _events.send(DeleteAccountConfirmedEvent.Added)
            }
        }
    }

    /**
     * The band follows the confirmation on this device — read from the
     * signed-in account's own standing, never from the link's answer: the
     * link may be another account's than the session here.
     */
    private suspend fun bandFollows() {
        if (signedIn) standing.refresh()
    }

    private fun landingOf(outcome: Outcome<AccountDeletion?>): ConfirmedLanding = when (outcome) {
        // A confirm answers the deletion it confirmed; none is a server fault.
        is Outcome.Success -> outcome.value?.let { ConfirmedLanding.Confirmed(it) } ?: ConfirmedLanding.Unreachable
        is Outcome.Failed -> ConfirmedLanding.Unreachable
        is Outcome.Refused -> when {
            outcome.refusedWith(ErrorCode.DELETION_TOKEN_INVALID) -> ConfirmedLanding.Dead
            else -> ConfirmedLanding.Refused
        }
    }
}

@Composable
fun DeleteAccountConfirmedRoute(
    token: String,
    signedIn: Boolean,
    onGoToFeed: () -> Unit,
    onSignIn: () -> Unit,
    /** The dead link's way on with a session (DeleteLinkExpired.md:17). */
    onBackToSettings: () -> Unit,
    viewModel: DeleteAccountConfirmedViewModel = hiltViewModel(),
) {
    LaunchedEffect(token, signedIn) { viewModel.start(token, signedIn) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val added = stringResource(R.string.delete_confirmed_added)
    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                DeleteAccountConfirmedEvent.Added -> snackbar.showSnackbar(added)
            }
        }
    }
    DeleteAccountConfirmedScreen(
        state = state,
        signedIn = signedIn,
        onToggleSweep = viewModel::onToggleSweep,
        onAdd = viewModel::onAdd,
        onRetry = viewModel::onRetry,
        onGoToFeed = onGoToFeed,
        onSignIn = onSignIn,
        onBackToSettings = onBackToSettings,
        snackbar = snackbar,
    )
}

/**
 * A mail-link landing: no back arrow — a mail link has no previous screen of
 * ours — and `VerifyExpired`'s left column, because it carries a form
 * control. The way on is the plain text button: `Go to the feed` with a
 * session; signed out, one quiet line says the link was enough and the way
 * on reads `Sign in` (`:35`-`:41`).
 */
@Composable
fun DeleteAccountConfirmedScreen(
    state: DeleteAccountConfirmedUiState,
    signedIn: Boolean,
    onToggleSweep: () -> Unit,
    onAdd: () -> Unit,
    onRetry: () -> Unit,
    onGoToFeed: () -> Unit,
    onSignIn: () -> Unit,
    onBackToSettings: () -> Unit = {},
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
) {
    if (state.landing == ConfirmedLanding.Loading) return
    if (state.landing == ConfirmedLanding.Dead) {
        DeadLinkLanding(signedIn = signedIn, onBackToSettings = onBackToSettings, onSignIn = onSignIn)
        return
    }
    val page = DeleteAccountPage
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        snackbarHost = { CograSnackbarHost(snackbar, testTag = "deleteAccount_snackbar") },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
        ) {
            when (val landing = state.landing) {
                is ConfirmedLanding.Confirmed -> ConfirmedBody(landing.deletion, state, onToggleSweep, onAdd)
                ConfirmedLanding.Unreachable -> {
                    Lead(stringResource(R.string.error_transport))
                    Spacer(Modifier.height(24.dp))
                    DeletionCommit(
                        label = stringResource(R.string.retry),
                        onCommit = onRetry,
                        node = DataNode("delete_confirmed_retry"),
                    )
                }
                ConfirmedLanding.Refused -> Lead(stringResource(R.string.settings_save_failed))
                ConfirmedLanding.Loading, ConfirmedLanding.Dead -> Unit
            }
            if (!signedIn) {
                Spacer(Modifier.height(24.dp))
                QuietNote(
                    text = stringResource(R.string.delete_confirmed_signed_out),
                    modifier = Modifier.dataNode(DataNode("delete_confirmed_signed_out")),
                )
            }
            Spacer(Modifier.height(if (signedIn) 24.dp else 8.dp))
            CograButton(
                text = stringResource(if (signedIn) R.string.delete_confirmed_feed else R.string.linked_sign_in),
                onClick = if (signedIn) onGoToFeed else onSignIn,
                kind = ButtonKind.Text,
                modifier = Modifier
                    .fillMaxWidth()
                    .dataNode(page / "onward"),
            )
        }
    }
}

/**
 * DeleteLinkExpired (`DeleteLinkExpired.jsx`, `.md`; ER-G1): the dead-link
 * family's heading, a body that never says which happened, names no address
 * and claims no expiry, and one way on — `Back to settings` with a session,
 * where the deletion's state reads as it stands, `Sign in` without, holding
 * no link. No header, no arrow, no mark, no Resend: nothing is scheduled and
 * nothing deleted. System Back leaves to wherever the mail link was opened
 * from, never to a CoGra screen in its place (`:23`) — the task goes to the
 * back, so the mail app the link came from is what shows.
 */
@Composable
private fun DeadLinkLanding(signedIn: Boolean, onBackToSettings: () -> Unit, onSignIn: () -> Unit) {
    val activity = LocalActivity.current
    BackHandler { activity?.moveTaskToBack(true) }
    val page = DeleteAccountPage
    Column(
        modifier = Modifier
            .fillMaxSize()
            .dataNodeSurface()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
    ) {
        Text(
            text = stringResource(R.string.delete_dead_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier
                .semantics { heading() }
                .dataNode(page / "title"),
        )
        Lead(stringResource(R.string.delete_dead_body))
        Spacer(Modifier.height(24.dp))
        CograButton(
            text = stringResource(if (signedIn) R.string.back_to_settings else R.string.linked_sign_in),
            onClick = if (signedIn) onBackToSettings else onSignIn,
            kind = ButtonKind.Text,
            modifier = Modifier
                .fillMaxWidth()
                .dataNode(page / "onward"),
        )
    }
}

@Composable
private fun ConfirmedBody(
    deletion: AccountDeletion,
    state: DeleteAccountConfirmedUiState,
    onToggleSweep: () -> Unit,
    onAdd: () -> Unit,
) {
    val page = DeleteAccountPage
    val count = forwardLadder(deletion.scheduledFor, state.now).words()
    Text(
        text = stringResource(
            if (deletion.includesContent) R.string.delete_confirmed_title_content else R.string.delete_confirmed_title,
            count,
        ),
        style = MaterialTheme.typography.headlineSmall,
        modifier = Modifier
            .semantics { heading() }
            .dataNode(page / "title"),
    )
    Lead(stringResource(R.string.delete_confirmed_body, dateLine(deletion.scheduledFor)))
    // Offered only while the sweep is out of the deletion; never the other way.
    if (!deletion.includesContent) {
        Spacer(Modifier.height(24.dp))
        SweepChoice(checked = state.sweepTicked, onToggle = onToggleSweep)
        Spacer(Modifier.height(16.dp))
        DeletionCommit(
            label = stringResource(R.string.delete_confirmed_add),
            onCommit = onAdd,
            inFlight = state.adding,
            inFlightLabel = stringResource(R.string.delete_confirmed_adding),
            fault = state.fault?.let { stringResource(it) },
            kind = ButtonKind.Outlined,
            node = page / "add",
        )
    }
}

@Composable
private fun Lead(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .dataNode(DeleteAccountPage / "body"),
    )
}
