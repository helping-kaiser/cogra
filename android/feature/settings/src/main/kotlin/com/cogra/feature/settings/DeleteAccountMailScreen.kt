// DeleteAccountMail, where the request lands (`DeleteAccountMail.jsx`,
// `DeleteAccountMail.md`; erasure.md §5 step 2). The confirmation is the
// mailed link, so the one thing this screen owes the reader is that nothing
// is scheduled yet — and the address it went to, named rather than
// described. It claims no expiry, and no deletion band stands: nothing is
// confirmed, so there is nothing to count down.

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.domain.Outcome
import com.cogra.domain.deletion.AccountDeletionRepository
import com.cogra.domain.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DeleteAccountMailUiState(
    /** The account's address, which the body names; null until the read answers. */
    val email: String? = null,
    val inFlight: Boolean = false,
    @StringRes val fault: Int? = null,
)

@HiltViewModel
class DeleteAccountMailViewModel @Inject constructor(
    private val deletions: AccountDeletionRepository,
    private val settings: SettingsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DeleteAccountMailUiState())
    val state = _state.asStateFlow()

    private val _resent = Channel<String>(Channel.BUFFERED)

    /** The Resend answered: the address the fresh link went to, for its snackbar (`:13`). */
    val resent = _resent.receiveAsFlow()

    /** Reads the address the link went to — the account's own, verified. */
    fun refresh() {
        if (_state.value.email != null) return
        viewModelScope.launch {
            val email = (settings.settingsAccount() as? Outcome.Success)?.value?.email
            _state.update { it.copy(email = email ?: it.email) }
        }
    }

    /**
     * `Resend the link`: the same request again, with the choice the request
     * screen recorded — it supersedes the earlier one, so its link dies and
     * never two stand (`DeleteAccountMail.md:13`, `:21`). Answered, the
     * snackbar names the address; a spent budget says its line above the
     * Resend instead and sends nothing (`:15`).
     */
    fun onResend(includeContent: Boolean) {
        if (_state.value.inFlight) return
        _state.update { it.copy(inFlight = true, fault = null) }
        viewModelScope.launch {
            val outcome = deletions.request(includeContent)
            _state.update { it.copy(inFlight = false, fault = faultOf(outcome)) }
            // With no address read, nothing is claimed about where it went.
            val email = _state.value.email
            if (outcome is Outcome.Success && email != null) _resent.send(email)
        }
    }
}

@Composable
fun DeleteAccountMailRoute(
    includeContent: Boolean,
    onBack: () -> Unit,
    /** The deletion band, should a confirm elsewhere start the grace while this is open. */
    deletionBand: @Composable () -> Unit = {},
    viewModel: DeleteAccountMailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }
    val snackbar = remember { SnackbarHostState() }
    val resentLine = stringResource(R.string.delete_mail_resent)
    val currentResentLine by rememberUpdatedState(resentLine)
    LaunchedEffect(viewModel) {
        viewModel.resent.collect { email -> snackbar.showSnackbar(currentResentLine.format(email)) }
    }
    DeleteAccountMailScreen(
        state = state,
        onBack = onBack,
        onResend = { viewModel.onResend(includeContent) },
        snackbar = snackbar,
        deletionBand = deletionBand,
    )
}

/**
 * The entry flow's mail-sent idiom: the heading is the errand, the paragraph
 * the address and what the link does, the quiet note what holds until then,
 * and the outlined Resend in content flow. Back returns to settings and
 * withdraws nothing (`DeleteAccountMail.md:27`).
 */
@Composable
fun DeleteAccountMailScreen(
    state: DeleteAccountMailUiState,
    onBack: () -> Unit,
    onResend: () -> Unit,
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
    deletionBand: @Composable () -> Unit = {},
) {
    val page = DeleteAccountPage
    TaskPage(
        node = page,
        backLabel = stringResource(R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.delete_mail_title),
        lead = state.email?.let { stringResource(R.string.delete_mail_body, it) }.orEmpty(),
        snackbar = snackbar,
        deletionBand = deletionBand,
    ) {
        Spacer(Modifier.height(24.dp))
        QuietNote(
            text = stringResource(R.string.delete_mail_note),
            modifier = Modifier.dataNode(page / "note"),
        )
        Spacer(Modifier.height(24.dp))
        DeletionCommit(
            label = stringResource(R.string.delete_mail_resend),
            onCommit = onResend,
            inFlight = state.inFlight,
            inFlightLabel = stringResource(R.string.delete_mail_resending),
            fault = state.fault?.let { stringResource(it) },
            kind = ButtonKind.Outlined,
            node = page / "resend",
        )
    }
}
