// ChangeEmailConfirm (`ChangeEmailConfirm.jsx`, `ChangeEmailConfirm.md`;
// copy-voice "Confirm the change", "The change in flight, and its ends").
// S12 lives here: the commit says what pressing it does — `Confirm the
// code` — never "Confirm email change".

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.settings.PendingEmailChange
import com.cogra.domain.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ConfirmEmailUiState(
    val email: String? = null,
    val pending: PendingEmailChange? = null,
    val code: String = "",
    /** The field's line: the wrong code (until the next press) or the disabled code (until a fresh one is sent). */
    @StringRes val codeError: Int? = null,
    /** A fault above the commit: ran out, taken, a spent budget, or no answer. */
    @StringRes val fault: Int? = null,
    val inFlight: Boolean = false,
    val resending: Boolean = false,
    val canceling: Boolean = false,
) {
    val waiting: Boolean get() = code.isEmpty()

    /** G3 (ruled): once the code's side is confirmed, the field and commit go. */
    val codeOwed: Boolean get() = pending?.codeOwed == true
}

/** Where the confirmation leaves for, with what to say over settings. */
sealed interface ConfirmEmailExit {
    /** Both sides landed: `Email changed to <new>.` */
    data class Applied(val newEmail: String) : ConfirmEmailExit

    /** Called off: `Change canceled — your email stays <address>.` */
    data class Canceled(val email: String) : ConfirmEmailExit

    /** Nothing is pending any more (ended elsewhere) — settings reads it. */
    data object Ended : ConfirmEmailExit
}

sealed interface ConfirmEmailEvent {
    data class Snackbar(@StringRes val text: Int, val arg: String? = null) : ConfirmEmailEvent

    data class Exit(val exit: ConfirmEmailExit) : ConfirmEmailEvent
}

@HiltViewModel
class ChangeEmailConfirmViewModel @Inject constructor(
    private val settings: SettingsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ConfirmEmailUiState())
    val state = _state.asStateFlow()

    private val _events = Channel<ConfirmEmailEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    init {
        reread()
    }

    /** Reopen lands on the owed side, each side as it stands; nothing pending routes back. */
    private fun reread() {
        viewModelScope.launch {
            when (val read = settings.settingsAccount()) {
                is Outcome.Success -> {
                    val account = read.value
                    _state.update { it.copy(email = account?.email, pending = account?.pendingEmailChange) }
                    if (account != null && account.pendingEmailChange == null) {
                        _events.send(ConfirmEmailEvent.Exit(ConfirmEmailExit.Ended))
                    }
                }
                else -> Unit
            }
        }
    }

    fun onCode(value: String) = _state.update {
        // The disabled-code line stands while typing; the wrong-code line until the press.
        it.copy(code = value.filter(Char::isDigit))
    }

    fun onConfirm() {
        val s = _state.value
        if (s.waiting || s.inFlight || !s.codeOwed) return
        _state.update {
            it.copy(
                inFlight = true,
                fault = null,
                codeError = it.codeError.takeIf { line -> line == R.string.confirm_email_code_disabled },
            )
        }
        viewModelScope.launch {
            val outcome = settings.confirmEmailChange(s.code)
            when {
                outcome is Outcome.Success -> {
                    val after = outcome.value
                    if (after.pending == null) {
                        _state.update { it.copy(inFlight = false) }
                        _events.send(ConfirmEmailEvent.Exit(ConfirmEmailExit.Applied(after.email.orEmpty())))
                    } else {
                        // The code's side landed, the link's still owed: the page stays.
                        _state.update {
                            it.copy(inFlight = false, pending = after.pending, email = after.email, code = "")
                        }
                    }
                }
                outcome is Outcome.Failed -> _state.update { it.copy(inFlight = false, fault = R.string.network_error) }
                outcome.refusedWith(ErrorCode.VERIFICATION_TOKEN_INVALID) ->
                    _state.update { it.copy(inFlight = false, codeError = R.string.confirm_email_wrong_code) }
                outcome.refusedWith(ErrorCode.EMAIL_CHANGE_CODE_DISABLED) ->
                    _state.update { it.copy(inFlight = false, codeError = R.string.confirm_email_code_disabled) }
                outcome.refusedWith(ErrorCode.EMAIL_CHANGE_EXPIRED) ->
                    _state.update { it.copy(inFlight = false, fault = R.string.confirm_email_ran_out) }
                outcome.refusedWith(ErrorCode.EMAIL_IN_USE) ->
                    _state.update { it.copy(inFlight = false, fault = R.string.confirm_email_taken) }
                outcome.refusedWith(ErrorCode.RATE_LIMITED) ->
                    _state.update { it.copy(inFlight = false, fault = R.string.rate_limited) }
                else -> _state.update { it.copy(inFlight = false, fault = R.string.settings_save_failed) }
            }
        }
    }

    /**
     * Resend mails only the sides still owed, and the snackbar is chosen by
     * which sides were owed BEFORE the press (B3; G3 ruled).
     */
    fun onResend() {
        val s = _state.value
        val pending = s.pending ?: return
        if (s.resending) return
        val code = pending.codeOwed
        val link = pending.linkOwed
        _state.update { it.copy(resending = true) }
        viewModelScope.launch {
            val outcome = settings.resendEmailChange()
            when {
                outcome is Outcome.Success -> {
                    _state.update {
                        it.copy(
                            resending = false,
                            pending = outcome.value,
                            fault = it.fault.takeIf { f -> f != R.string.rate_limited },
                            // A fresh code lifts the disabled-code line.
                            codeError = if (code) null else it.codeError,
                        )
                    }
                    _events.send(
                        when {
                            code && link -> ConfirmEmailEvent.Snackbar(R.string.confirm_email_resent_both)
                            code -> ConfirmEmailEvent.Snackbar(R.string.confirm_email_resent_code, s.email)
                            else -> ConfirmEmailEvent.Snackbar(R.string.confirm_email_resent_link, pending.newEmail)
                        },
                    )
                }
                outcome is Outcome.Failed -> {
                    _state.update { it.copy(resending = false) }
                    _events.send(ConfirmEmailEvent.Snackbar(R.string.network_error))
                }
                // A spent budget: B7's line above the commit, and no `Sent again`.
                outcome.refusedWith(ErrorCode.RATE_LIMITED) ->
                    _state.update { it.copy(resending = false, fault = R.string.rate_limited) }
                // The change ended elsewhere: re-read and route by state.
                outcome.refusedWith(ErrorCode.NOT_FOUND) -> {
                    _state.update { it.copy(resending = false) }
                    reread()
                }
                else -> _state.update { it.copy(resending = false, fault = R.string.settings_save_failed) }
            }
        }
    }

    /** No dialog; offline the change still stands. */
    fun onCancel() {
        if (_state.value.canceling) return
        _state.update { it.copy(canceling = true) }
        viewModelScope.launch {
            when (val outcome = settings.cancelEmailChange()) {
                is Outcome.Success -> {
                    _state.update { it.copy(canceling = false) }
                    val email = outcome.value.email ?: _state.value.email.orEmpty()
                    _events.send(ConfirmEmailEvent.Exit(ConfirmEmailExit.Canceled(email)))
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(canceling = false) }
                    _events.send(ConfirmEmailEvent.Snackbar(R.string.network_error))
                }
                is Outcome.Refused -> {
                    _state.update { it.copy(canceling = false) }
                    reread()
                }
            }
        }
    }
}

private val Page = DataNode("changeEmail")

@Composable
fun ChangeEmailConfirmRoute(
    onBack: () -> Unit,
    onExit: (notice: String?) -> Unit,
    viewModel: ChangeEmailConfirmViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    ChangeEmailConfirmScreen(
        state = state,
        events = viewModel.events,
        onBack = onBack,
        onCode = viewModel::onCode,
        onConfirm = viewModel::onConfirm,
        onResend = viewModel::onResend,
        onCancel = viewModel::onCancel,
        onExit = { exit ->
            onExit(
                when (exit) {
                    is ConfirmEmailExit.Applied -> context.getString(R.string.confirm_email_applied, exit.newEmail)
                    is ConfirmEmailExit.Canceled -> context.getString(R.string.confirm_email_canceled, exit.email)
                    ConfirmEmailExit.Ended -> null
                },
            )
        },
    )
}

@Composable
fun ChangeEmailConfirmScreen(
    state: ConfirmEmailUiState,
    onBack: () -> Unit,
    onCode: (String) -> Unit,
    onConfirm: () -> Unit,
    onResend: () -> Unit,
    onCancel: () -> Unit,
    events: Flow<ConfirmEmailEvent> = emptyFlow(),
    onExit: (ConfirmEmailExit) -> Unit = {},
) {
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current
    LaunchedEffect(events) {
        events.collect { event ->
            when (event) {
                is ConfirmEmailEvent.Snackbar -> {
                    val text = event.arg?.let { context.getString(event.text, it) } ?: context.getString(event.text)
                    launch { snackbar.showSnackbar(text) }
                }
                is ConfirmEmailEvent.Exit -> onExit(event.exit)
            }
        }
    }
    val email = state.email.orEmpty()
    val pending = state.pending
    TaskPage(
        node = Page,
        backLabel = stringResource(R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.confirm_email_title),
        lead = stringResource(R.string.confirm_email_lead),
        snackbar = snackbar,
    ) {
        Spacer(Modifier.height(24.dp))
        if (pending != null) SidesPair(email, pending, onResend)
        CodeAndCommit(state, email, onCode, onConfirm)
        Spacer(Modifier.height(24.dp))
        QuietNote(
            text = stringResource(R.string.confirm_email_note),
            modifier = Modifier.dataNode(Page / "note"),
        )
        Spacer(Modifier.height(16.dp))
        InlineAction(
            text = stringResource(R.string.confirm_email_cancel),
            onClick = onCancel,
            testTag = (Page / "cancel").tag,
        )
    }
}

/** The code's errand — the field and `Confirm the code` — while the code's side is owed (G3). */
@Composable
private fun CodeAndCommit(state: ConfirmEmailUiState, email: String, onCode: (String) -> Unit, onConfirm: () -> Unit) {
    if (state.codeOwed) {
        Spacer(Modifier.height(24.dp))
        CograTextField(
            value = state.code,
            onValueChange = onCode,
            label = stringResource(R.string.confirm_email_code),
            hint = stringResource(R.string.confirm_email_code_hint, email),
            error = state.codeError?.let { stringResource(it) },
            // The `digits` kind: a 6-digit single-use code, the numeric
            // keyboard, and the one-time-code autofill hint.
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { if (!state.waiting) onConfirm() }),
            contentType = ContentType.SmsOtpCode,
            monospace = true,
            node = Page / "code",
        )
        Spacer(Modifier.height(24.dp))
        WaitingCommit(
            label = stringResource(R.string.confirm_email_commit),
            reason = stringResource(R.string.confirm_email_reason),
            waiting = state.waiting,
            onCommit = onConfirm,
            inFlight = state.inFlight,
            inFlightLabel = stringResource(R.string.confirm_email_in_flight),
            fault = state.fault?.let { stringResource(it) },
            faultTestTag = "change_email_confirm_fault",
            node = Page / "commit",
        )
    } else if (state.fault != null) {
        // With the code side spent there is no commit to stand above; a
        // resend's fault keeps the commit's slot in the page's flow.
        Spacer(Modifier.height(24.dp))
        Text(
            text = stringResource(state.fault),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.dataNode(DataNode("change_email_confirm_fault")),
        )
    }
}

/** `Both have to land`: each side's address and where it stands, with Resend on the caption's right. */
@Composable
private fun SidesPair(email: String, pending: PendingEmailChange, onResend: () -> Unit) {
    val pair = Page / "pair"
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.medium)
            .padding(Space.x3)
            .dataNode(pair),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.confirm_email_pair),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .weight(1f)
                    .dataNode(pair / "label"),
            )
            InlineAction(
                text = stringResource(R.string.confirm_email_resend),
                onClick = onResend,
                testTag = (pair / "resend").tag,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Space.x1)) {
            if (pending.requiresCode) {
                Side(
                    label = stringResource(R.string.confirm_email_code_label),
                    value = stringResource(
                        if (pending.codeConfirmed) R.string.confirm_email_confirmed else R.string.confirm_email_waiting,
                        email,
                    ),
                    labelNode = pair / "codeLabel",
                    valueNode = pair / "codeSide",
                )
            }
            Side(
                label = stringResource(R.string.confirm_email_link_label),
                value = stringResource(
                    if (pending.linkConfirmed) R.string.confirm_email_confirmed else R.string.confirm_email_waiting,
                    pending.newEmail,
                ),
                labelNode = pair / "linkLabel",
                valueNode = pair / "linkSide",
            )
        }
    }
}

@Composable
private fun Side(label: String, value: String, labelNode: DataNode, valueNode: DataNode) {
    Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .width(64.dp)
                .dataNode(labelNode),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier
                .weight(1f)
                .dataNode(valueNode),
        )
    }
}
