// ChangeHandle + ChangeHandleConfirm (`ChangeHandleBody` in `_shared.jsx`,
// `ChangeHandleConfirm.jsx`, both sidecars). The press asks first; seam
// 053.8: a taken handle arrives after the dialog's `Change it`, so the
// dialog closes onto the field's line.

package com.cogra.feature.settings

import androidx.annotation.StringRes
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.handleValid
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.settings.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChangeHandleUiState(
    /** The handle the account has now — the lead and the dialog name it. */
    val current: String = "",
    val handle: String = "",
    /** The field's line: the format line (re-checks live once pressed) or the taken line. */
    @StringRes val error: Int? = null,
    val pressed: Boolean = false,
    val dialogOpen: Boolean = false,
    val inFlight: Boolean = false,
    /** No answer reached the device: the line stands in the dialog and `Change it` reads `Retry`. */
    val dialogFault: Boolean = false,
    /** The handle the change landed on — the route's cue to return. */
    val changedTo: String? = null,
) {
    val waiting: Boolean get() = handle.isEmpty()
}

@HiltViewModel
class ChangeHandleViewModel @Inject constructor(
    private val account: AccountRepository,
    private val settings: SettingsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ChangeHandleUiState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val handle = (settings.settingsAccount() as? Outcome.Success)?.value?.handle.orEmpty()
            _state.update { it.copy(current = handle) }
        }
    }

    /** Handles are always lowercase: the field folds case as it is typed. */
    fun onHandle(value: String) = _state.update { s ->
        val folded = value.lowercase()
        val line = when {
            s.error == R.string.change_handle_taken -> null
            s.pressed && !handleValid(folded) -> R.string.change_handle_malformed
            else -> null
        }
        s.copy(handle = folded, error = line)
    }

    /** A malformed handle answers on the field and never opens the dialog. */
    fun onCommit() {
        val s = _state.value
        if (s.waiting || s.dialogOpen) return
        if (!handleValid(s.handle)) {
            _state.update { it.copy(pressed = true, error = R.string.change_handle_malformed) }
            return
        }
        _state.update { it.copy(pressed = true, error = null, dialogOpen = true, dialogFault = false) }
    }

    /** Keep it, the scrim, Back: closes onto the form, the handle still typed — never while in flight. */
    fun onKeep() {
        if (_state.value.inFlight) return
        _state.update { it.copy(dialogOpen = false, dialogFault = false) }
    }

    fun onChangeIt() {
        val s = _state.value
        if (s.inFlight) return
        _state.update { it.copy(inFlight = true, dialogFault = false) }
        viewModelScope.launch {
            val outcome = account.changeHandle(s.handle)
            _state.update {
                when {
                    outcome is Outcome.Success -> it.copy(inFlight = false, dialogOpen = false, changedTo = s.handle)
                    outcome is Outcome.Failed -> it.copy(inFlight = false, dialogFault = true)
                    // 053.8: the dialog closes onto the form, the field saying why.
                    outcome.refusedWith(ErrorCode.HANDLE_TAKEN) ->
                        it.copy(inFlight = false, dialogOpen = false, error = R.string.change_handle_taken)
                    outcome.refusedWith(ErrorCode.BAD_INPUT) ->
                        it.copy(inFlight = false, dialogOpen = false, error = R.string.change_handle_malformed)
                    else -> it.copy(inFlight = false, dialogFault = true)
                }
            }
        }
    }
}

private val Page = DataNode("changeHandle")

@Composable
fun ChangeHandleRoute(
    onBack: () -> Unit,
    onDone: (notice: String) -> Unit,
    viewModel: ChangeHandleViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val notice = state.changedTo?.let { stringResource(R.string.change_handle_done, it) }
    LaunchedEffect(notice) { notice?.let(onDone) }
    ChangeHandleScreen(
        state = state,
        onBack = onBack,
        onHandle = viewModel::onHandle,
        onCommit = viewModel::onCommit,
        onChangeIt = viewModel::onChangeIt,
        onKeep = viewModel::onKeep,
    )
}

@Composable
fun ChangeHandleScreen(
    state: ChangeHandleUiState,
    onBack: () -> Unit,
    onHandle: (String) -> Unit,
    onCommit: () -> Unit,
    onChangeIt: () -> Unit,
    onKeep: () -> Unit,
) {
    val commitFocus = remember { FocusRequester() }
    TaskPage(
        node = Page,
        backLabel = stringResource(R.string.back_to_settings),
        onBack = onBack,
        title = stringResource(R.string.change_handle_title),
        lead = stringResource(R.string.change_handle_lead, state.current),
    ) {
        Spacer(Modifier.height(32.dp))
        CograTextField(
            value = state.handle,
            onValueChange = onHandle,
            label = stringResource(R.string.change_handle_field),
            hint = stringResource(R.string.change_handle_hint),
            error = state.error?.let { stringResource(it) },
            // The `handle` kind: no caps, no correction, and never the
            // username — it is not what the reader signs in with.
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                keyboardType = KeyboardType.Ascii,
                imeAction = ImeAction.Go,
            ),
            keyboardActions = KeyboardActions(onGo = { if (!state.waiting) onCommit() }),
            node = Page / "handle",
        )
        Spacer(Modifier.height(24.dp))
        WaitingCommit(
            label = stringResource(R.string.change_handle_commit),
            reason = stringResource(R.string.change_handle_reason),
            waiting = state.waiting,
            onCommit = onCommit,
            node = Page / "commit",
            modifier = Modifier
                .focusRequester(commitFocus)
                .focusable(),
        )
        Spacer(Modifier.height(24.dp))
        QuietNote(
            text = stringResource(R.string.change_handle_note),
            modifier = Modifier.dataNode(Page / "note"),
        )
    }
    if (state.dialogOpen) {
        ChangeHandleConfirm(
            state = state,
            onChangeIt = onChangeIt,
            onKeep = {
                onKeep()
                // Closing onto the form returns focus to the commit.
                runCatching { commitFocus.requestFocus() }
            },
        )
    }
}

/**
 * The think-twice. `Keep it` is filled and `Change it` is the quiet answer,
 * with no error colour. In flight, Keep it, the scrim and Back are locked
 * but never dimmed, and `Change it` reads `Changing handle…` only past
 * 200 ms.
 */
@Composable
private fun ChangeHandleConfirm(
    state: ChangeHandleUiState,
    onChangeIt: () -> Unit,
    onKeep: () -> Unit,
) {
    val dialog = Page / "dialog"
    val titleFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { titleFocus.requestFocus() } }
    val late = rememberParticiple(state.inFlight)
    AlertDialog(
        onDismissRequest = onKeep,
        properties = DialogProperties(
            dismissOnBackPress = !state.inFlight,
            dismissOnClickOutside = !state.inFlight,
        ),
        modifier = Modifier.dataNode(dialog),
        title = {
            Text(
                text = stringResource(R.string.change_handle_dialog_title, state.handle),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier
                    .semantics { heading() }
                    .focusRequester(titleFocus)
                    .focusable()
                    .dataNode(dialog / "title"),
            )
        },
        text = { HandleDialogBody(state) },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CograButton(
                    text = stringResource(
                        when {
                            late -> R.string.change_handle_dialog_in_flight
                            state.dialogFault -> R.string.retry
                            else -> R.string.change_handle_dialog_change
                        },
                    ),
                    onClick = onChangeIt,
                    kind = ButtonKind.Text,
                    modifier = Modifier.dataNode(dialog / "change"),
                )
                CograButton(
                    text = stringResource(R.string.change_handle_dialog_keep),
                    onClick = onKeep,
                    modifier = Modifier.dataNode(dialog / "keep"),
                )
            }
        },
    )
}

/** The cost, said unsoftened — and, with no answer, the dialog's own fault line (it answers in itself, K1). */
@Composable
private fun HandleDialogBody(state: ChangeHandleUiState) {
    val dialog = Page / "dialog"
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = stringResource(R.string.change_handle_dialog_body, state.current),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.dataNode(dialog / "body"),
        )
        if (state.dialogFault) {
            Text(
                text = stringResource(R.string.network_error),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .dataNode(DataNode("change_handle_dialog_fault")),
            )
        }
    }
}
