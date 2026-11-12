// ResetNew (design/designs/canonical/ResetNew.dc.html, behavior/ResetNew.md;
// copy-voice "Reset your password"): the reset mail's link lands here and
// the new password is set, asked for twice (seam 275-1).

package com.cogra.feature.auth

import androidx.activity.compose.BackHandler
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.CograPasswordField
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.domain.ErrorCode
import com.cogra.domain.MAX_PASSWORD_LENGTH
import com.cogra.domain.MIN_PASSWORD_LENGTH
import com.cogra.domain.Outcome
import com.cogra.domain.repo.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** ResetNew's registered prefix (`nodes.json` `ResetNew` → `reset`). */
private val RESET = DataNode("reset")

data class ResetNewUiState(
    val password: String = "",
    val confirm: String = "",
    /** New password's local length line: from a press it re-checks as the text changes. */
    @StringRes val passwordLine: Int? = null,
    /** The breach line the server answered: it stands until the next press (ResetNew.md:35). */
    @StringRes val breachLine: Int? = null,
    /** Repeat password's mismatch line: re-checks as either password changes, goes once they match. */
    @StringRes val confirmLine: Int? = null,
    /** The form's own fault above the commit; the fields keep what was typed. */
    @StringRes val fault: Int? = null,
    val inFlight: Boolean = false,
    /** The new password is taken: SignIn opens. */
    val done: Boolean = false,
    /** The link was spent or ran out while the form stood open. */
    val expired: Boolean = false,
) {
    /** ResetNew.md:49 — Set the new password waits while either field is empty. */
    val waiting: Boolean get() = password.isEmpty() || confirm.isEmpty()

    val newPasswordLine: Int? get() = breachLine ?: passwordLine
}

/** Counted in Unicode scalar values, the unit every ruled length is stated in. */
@StringRes
private fun lengthLine(password: String): Int? {
    val length = password.codePointCount(0, password.length)
    return when {
        length < MIN_PASSWORD_LENGTH -> R.string.reset_new_short
        length > MAX_PASSWORD_LENGTH -> R.string.reset_new_long
        else -> null
    }
}

@StringRes
private fun differLine(password: String, confirm: String): Int? =
    if (password == confirm) null else R.string.reset_new_differ

/**
 * The new-password step of the reset (auth.md "Password reset" step 3).
 *
 * THE FIELDS ANSWER ON THE PRESS, as on Join: typing never marks a field
 * before the next press; a press checks both fields on their own, and only a
 * well-formed, matching pair goes out. A local line once raised re-checks as
 * the text changes; the breach line the server answered stands until the
 * next press.
 */
@HiltViewModel
class ResetNewViewModel @Inject constructor(
    private val account: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ResetNewUiState())
    val state = _state.asStateFlow()

    fun onPasswordChange(value: String) = _state.update {
        it.copy(
            password = value,
            passwordLine = it.passwordLine?.let { _ -> lengthLine(value) },
            confirmLine = it.confirmLine?.let { _ -> differLine(value, it.confirm) },
        )
    }

    fun onConfirmChange(value: String) = _state.update {
        it.copy(confirm = value, confirmLine = it.confirmLine?.let { _ -> differLine(it.password, value) })
    }

    fun onSubmit(token: String) {
        val current = _state.value
        if (current.inFlight || current.waiting) return
        val length = lengthLine(current.password)
        val differ = differLine(current.password, current.confirm)
        _state.update { it.copy(passwordLine = length, confirmLine = differ, breachLine = null, fault = null) }
        // ResetNew.md:27 — a mismatch NEVER changes the password.
        if (length != null || differ != null) return
        _state.update { it.copy(inFlight = true) }
        viewModelScope.launch {
            val outcome = account.confirmPasswordReset(token, current.password)
            _state.update { state ->
                val settled = state.copy(inFlight = false)
                when (outcome) {
                    is Outcome.Success -> settled.copy(done = true)
                    is Outcome.Failed -> settled.copy(fault = R.string.reset_new_no_answer)
                    is Outcome.Refused -> when (outcome.errors.first().code) {
                        ErrorCode.RESET_TOKEN_INVALID -> settled.copy(expired = true)
                        ErrorCode.WEAK_PASSWORD -> settled.copy(breachLine = R.string.reset_new_breached)
                        ErrorCode.RATE_LIMITED -> settled.copy(fault = R.string.reset_new_rate_limited)
                        else -> settled.copy(fault = R.string.reset_new_not_through)
                    }
                }
            }
        }
    }
}

@Composable
fun ResetNewRoute(
    token: String,
    /** The new password is taken: SignIn opens (ResetNew.md:23). */
    onSignIn: () -> Unit,
    /** The link was spent or ran out while the form stood open (ResetNew.md:41). */
    onExpired: () -> Unit,
    /** System Back: the platform leaves to wherever the link was opened from (ResetNew.md:47). */
    onLeave: () -> Unit,
    viewModel: ResetNewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.done) { if (state.done) onSignIn() }
    LaunchedEffect(state.expired) { if (state.expired) onExpired() }
    BackHandler(onBack = onLeave)
    ResetNewScreen(
        state = state,
        onPasswordChange = viewModel::onPasswordChange,
        onConfirmChange = viewModel::onConfirmChange,
        onSubmit = { viewModel.onSubmit(token) },
    )
}

/** ResetNew.md:5 — no header and no back arrow; the page scrolls (:45). */
@Composable
fun ResetNewScreen(
    state: ResetNewUiState,
    onPasswordChange: (String) -> Unit,
    onConfirmChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Scaffold(modifier = Modifier.dataNodeSurface()) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
        ) {
            Text(
                text = stringResource(R.string.reset_new_title),
                style = MaterialTheme.typography.headlineSmall,
                // The board's `<h1>` is a block: its node spans the column.
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { heading() }
                    .dataNode(RESET / "title"),
            )
            Text(
                text = stringResource(R.string.reset_new_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(top = 8.dp)
                    .dataNode(RESET / "body"),
            )
            Spacer(Modifier.height(32.dp))
            PasswordPair(state, onPasswordChange, onConfirmChange, onSubmit)
            Spacer(Modifier.height(24.dp))
            WaitingCommit(
                label = stringResource(R.string.reset_new_commit),
                reason = stringResource(R.string.reset_new_waiting),
                waiting = state.waiting,
                onCommit = onSubmit,
                inFlight = state.inFlight,
                inFlightLabel = stringResource(R.string.reset_new_in_flight),
                fault = state.fault?.let { stringResource(it) },
                faultTestTag = "reset.fault",
                node = RESET / "commit",
            )
            Spacer(Modifier.height(24.dp))
            QuietNote(
                text = stringResource(R.string.reset_new_note),
                modifier = Modifier.dataNode(RESET / "note"),
            )
        }
    }
}

/** New password and, under it, Repeat password (ResetNew.md:7-11). */
@Composable
private fun PasswordPair(
    state: ResetNewUiState,
    onPasswordChange: (String) -> Unit,
    onConfirmChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    // The board's hidden username names the account; the link check
    // tells this client no address, so none is carried (a design gap
    // reported with the lane).
    CograPasswordField(
        value = state.password,
        onValueChange = onPasswordChange,
        label = stringResource(R.string.reset_new_password_label),
        newPassword = true,
        hint = stringResource(R.string.reset_new_hint),
        error = state.newPasswordLine?.let { stringResource(it) },
        imeAction = ImeAction.Next,
        node = RESET / "password",
    )
    Spacer(Modifier.height(24.dp))
    // ResetNew.md:7, 11 — masked alike, its own reveal, no hint.
    CograPasswordField(
        value = state.confirm,
        onValueChange = onConfirmChange,
        label = stringResource(R.string.reset_new_confirm),
        newPassword = true,
        error = state.confirmLine?.let { stringResource(it) },
        onImeAction = { if (!state.waiting) onSubmit() },
        node = RESET / "confirm",
    )
}
