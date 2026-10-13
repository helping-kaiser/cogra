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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
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
     * never two stand (`DeleteAccountMail.md:13`, `:21`).
     */
    fun onResend(includeContent: Boolean) {
        if (_state.value.inFlight) return
        _state.update { it.copy(inFlight = true, fault = null) }
        viewModelScope.launch {
            val outcome = deletions.request(includeContent)
            _state.update { it.copy(inFlight = false, fault = faultOf(outcome)) }
        }
    }
}

@Composable
fun DeleteAccountMailRoute(
    includeContent: Boolean,
    onBack: () -> Unit,
    viewModel: DeleteAccountMailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }
    DeleteAccountMailScreen(
        state = state,
        onBack = onBack,
        onResend = { viewModel.onResend(includeContent) },
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
) {
    val page = DeleteAccountPage
    TaskPage(
        node = page,
        backLabel = stringResource(R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.delete_mail_title),
        lead = state.email?.let { stringResource(R.string.delete_mail_body, it) }.orEmpty(),
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
