// ChangePassword (`ChangePassword.jsx`, `ChangePassword.md`; copy-voice
// "Change your password"). A pessimistic credential act: nothing changes
// until the server says so.

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograPasswordField
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.domain.ErrorCode
import com.cogra.domain.MIN_PASSWORD_LENGTH
import com.cogra.domain.Outcome
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChangePasswordUiState(
    /** The account's address, carried as the hidden username. */
    val account: String? = null,
    val current: String = "",
    val newPassword: String = "",
    /** `That password isn't right.` — stands until the next press. */
    @StringRes val currentError: Int? = null,
    /** The length lines re-check live once pressed; the breach line stands until the next press. */
    @StringRes val newError: Int? = null,
    /** Whether a press has happened — from then the length lines re-check as the reader types. */
    val pressed: Boolean = false,
    /** A form-level fault above the commit: no answer, or a tripped re-auth budget (B7). */
    @StringRes val fault: Int? = null,
    val inFlight: Boolean = false,
    val done: Boolean = false,
) {
    val waiting: Boolean get() = current.isEmpty() || newPassword.isEmpty()
}

/** The local length lines, or null — the client knows 12 and 128 from the registration rules. */
@StringRes
internal fun passwordLengthLine(password: String): Int? {
    val length = password.scalarLength()
    return when {
        length < MIN_PASSWORD_LENGTH -> R.string.password_too_short
        length > PASSWORD_MAX -> R.string.password_too_long
        else -> null
    }
}

@HiltViewModel
class ChangePasswordViewModel @Inject constructor(
    private val account: AccountRepository,
    private val settings: SettingsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ChangePasswordUiState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val email = (settings.settingsAccount() as? Outcome.Success)?.value?.email
            _state.update { it.copy(account = email) }
        }
    }

    fun onCurrent(value: String) = _state.update { it.copy(current = value) }

    fun onNew(value: String) = _state.update { s ->
        // A length line re-checks live; a breach line stands until the press.
        val live = if (s.pressed && s.newError != R.string.password_breached) passwordLengthLine(value) else s.newError
        s.copy(newPassword = value, newError = live)
    }

    fun onCommit() {
        val s = _state.value
        if (s.waiting || s.inFlight) return
        val length = passwordLengthLine(s.newPassword)
        if (length != null) {
            _state.update { it.copy(pressed = true, newError = length, currentError = null, fault = null) }
            return
        }
        _state.update { it.copy(pressed = true, inFlight = true, newError = null, currentError = null, fault = null) }
        viewModelScope.launch {
            val outcome = account.changePassword(s.current, s.newPassword)
            _state.update {
                when {
                    outcome is Outcome.Success -> it.copy(inFlight = false, done = true)
                    outcome is Outcome.Failed -> it.copy(inFlight = false, fault = R.string.network_error)
                    outcome.refusedWith(ErrorCode.INVALID_CREDENTIALS) ->
                        it.copy(inFlight = false, currentError = R.string.wrong_password)
                    // The length lines are local, so a WEAK_PASSWORD past
                    // them is the breach check's — the one server-only answer.
                    outcome.refusedWith(ErrorCode.WEAK_PASSWORD) ->
                        it.copy(inFlight = false, newError = R.string.password_breached)
                    outcome.refusedWith(ErrorCode.RATE_LIMITED) ->
                        it.copy(inFlight = false, fault = R.string.rate_limited)
                    else -> it.copy(inFlight = false, fault = R.string.settings_save_failed)
                }
            }
        }
    }
}

private val Page = DataNode("changePassword")

@Composable
fun ChangePasswordRoute(
    onBack: () -> Unit,
    onDone: (notice: String) -> Unit,
    viewModel: ChangePasswordViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notice = stringResource(R.string.change_password_done)
    LaunchedEffect(state.done) { if (state.done) onDone(notice) }
    ChangePasswordScreen(state, onBack, viewModel::onCurrent, viewModel::onNew, viewModel::onCommit)
}

@Composable
fun ChangePasswordScreen(
    state: ChangePasswordUiState,
    onBack: () -> Unit,
    onCurrent: (String) -> Unit,
    onNew: (String) -> Unit,
    onCommit: () -> Unit,
) {
    TaskPage(
        node = Page,
        backLabel = stringResource(R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.change_password_title),
        lead = stringResource(R.string.change_password_lead),
    ) {
        Spacer(Modifier.height(32.dp))
        CograPasswordField(
            value = state.current,
            onValueChange = onCurrent,
            label = stringResource(R.string.change_password_current),
            error = state.currentError?.let { stringResource(it) },
            account = state.account,
            imeAction = ImeAction.Next,
            node = Page / "current",
        )
        Spacer(Modifier.height(24.dp))
        CograPasswordField(
            value = state.newPassword,
            onValueChange = onNew,
            label = stringResource(R.string.change_password_new),
            newPassword = true,
            hint = stringResource(R.string.change_password_new_hint),
            error = state.newError?.let { stringResource(it) },
            imeAction = ImeAction.Go,
            onImeAction = { if (!state.waiting) onCommit() },
            node = Page / "password",
        )
        Spacer(Modifier.height(24.dp))
        WaitingCommit(
            label = stringResource(R.string.change_password_commit),
            reason = stringResource(R.string.change_password_reason),
            waiting = state.waiting,
            onCommit = onCommit,
            inFlight = state.inFlight,
            inFlightLabel = stringResource(R.string.change_password_in_flight),
            fault = state.fault?.let { stringResource(it) },
            faultTestTag = "change_password_fault",
            node = Page / "commit",
        )
        Spacer(Modifier.height(24.dp))
        QuietNote(
            text = stringResource(R.string.change_password_note),
            modifier = Modifier.dataNode(Page / "note"),
        )
    }
}
