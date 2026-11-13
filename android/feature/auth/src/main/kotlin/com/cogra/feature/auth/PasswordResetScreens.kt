// Reset (design/designs/canonical/Reset.dc.html, behavior/Reset.md;
// copy-voice "The reset"): the reset's request step (auth.md "Password
// reset" step 1). The new password is set where the mailed link lands,
// ResetNew (ResetNewScreen.kt); a spent link lands on ResetExpired.

package com.cogra.feature.auth

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.has
import com.cogra.domain.repo.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Reset's registered prefix (`nodes.json` `Reset` → `reset`). */
private val RESET = DataNode("reset")

/** The status line's tag: the board draws the rest state only, so no node is registered for it. */
const val RESET_STATUS_TAG = "reset_requested"

data class ResetUiState(
    val email: String = "",
    val inFlight: Boolean = false,
    /** A press was answered: the status line stands (Reset.md:11, :31). */
    val requested: Boolean = false,
    /** The form's own fault above the commit; the field keeps what was typed (:19). */
    @StringRes val fault: Int? = null,
) {
    /** Reset.md:35 — Send reset link waits while Email is empty. */
    val waiting: Boolean get() = email.isEmpty()
}

/**
 * THE ANSWER IS THE SAME EITHER WAY (Reset.md:11-13): the request verb is
 * silent by design, so every answer it gives reads as the status line, and
 * nothing on the screen says whether the address has an account. The only
 * visible refusal is the per-IP window's RATE_LIMITED, which sent nothing
 * and names no account (`requestPasswordReset`'s contract).
 */
@HiltViewModel
class PasswordResetViewModel @Inject constructor(
    private val account: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ResetUiState())
    val state = _state.asStateFlow()

    fun onEmailChange(v: String) = _state.update { it.copy(email = v) }

    fun onRequest() {
        val current = _state.value
        if (current.waiting || current.inFlight) return
        _state.update { it.copy(inFlight = true, fault = null) }
        viewModelScope.launch {
            val outcome = account.requestPasswordReset(current.email.trim())
            _state.update {
                val settled = it.copy(inFlight = false)
                when {
                    outcome is Outcome.Success -> settled.copy(requested = true)
                    outcome is Outcome.Failed -> settled.copy(fault = R.string.reset_no_answer)
                    outcome is Outcome.Refused && outcome.has(ErrorCode.RATE_LIMITED) ->
                        settled.copy(fault = R.string.reset_rate_limited)
                    else -> settled.copy(fault = R.string.reset_not_through)
                }
            }
        }
    }
}

@Composable
fun PasswordResetRoute(
    /** The header's back arrow: SignIn opens (Reset.md:3). */
    onBack: () -> Unit,
    viewModel: PasswordResetViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    PasswordResetScreen(
        state = state,
        onEmailChange = viewModel::onEmailChange,
        onRequest = viewModel::onRequest,
        onBack = onBack,
    )
}

/** The header with its back arrow, the email, the commit, the status line once answered, the quiet note. */
@Composable
fun PasswordResetScreen(
    state: ResetUiState,
    onEmailChange: (String) -> Unit,
    onRequest: () -> Unit,
    onBack: () -> Unit = {},
) {
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = { PageHeader(onBack = onBack, node = RESET / "header") },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 32.dp),
        ) {
            Text(
                text = stringResource(R.string.reset_title),
                style = MaterialTheme.typography.headlineSmall,
                // The board's `<h1>` is a block: its node spans the column.
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { heading() }
                    .dataNode(RESET / "title"),
            )
            Text(
                text = stringResource(R.string.reset_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .dataNode(RESET / "body"),
            )
            Spacer(Modifier.height(32.dp))
            CograTextField(
                value = state.email,
                onValueChange = onEmailChange,
                label = stringResource(R.string.login_email),
                // The `email` kind with the board's `enterKeyHint="go"`.
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    autoCorrectEnabled = false,
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Go,
                ),
                keyboardActions = KeyboardActions(onGo = { if (!state.waiting) onRequest() }),
                contentType = ContentType.EmailAddress,
                node = RESET / "email",
            )
            Spacer(Modifier.height(24.dp))
            WaitingCommit(
                label = stringResource(R.string.reset_request),
                reason = stringResource(R.string.reset_waiting),
                waiting = state.waiting,
                onCommit = onRequest,
                inFlight = state.inFlight,
                inFlightLabel = stringResource(R.string.reset_in_flight),
                fault = state.fault?.let { stringResource(it) },
                faultTestTag = "reset.fault",
                node = RESET / "commit",
            )
            if (state.requested) {
                Text(
                    text = stringResource(R.string.reset_requested),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp)
                        .semantics { liveRegion = LiveRegionMode.Polite }
                        .testTag(RESET_STATUS_TAG),
                )
            }
            Spacer(Modifier.height(24.dp))
            QuietNote(
                text = stringResource(R.string.reset_note),
                modifier = Modifier.dataNode(RESET / "note"),
            )
        }
    }
}
