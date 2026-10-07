// The recovery-code flows Settings' Recovery code row opens.
//
// DRIFT (the YourKey-and-backup-replacement packet): `SettingsBackup`,
// `SettingsBackupNone` and their states are that packet's boards. Until
// it lands, this INTERIM route holds the backup surface the page used to
// carry inline — enable late or replace the code — moved off the page
// unchanged, so the rebuilt page keeps every door it had.

package com.cogra.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.KeyGate
import com.cogra.core.designsystem.RecoveryCodeConfirm
import com.cogra.core.designsystem.rememberKeyGate
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.BackupManager
import com.cogra.domain.identity.recoveryCodePrefixDiverged
import com.cogra.domain.identity.recoveryCodeTypedBack
import com.cogra.domain.store.IdentityStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class BackupUiState(
    val actorPresent: Boolean = false,
    val busy: Boolean = false,
    /** A fresh backup code to display exactly once; cleared on confirm. */
    val newBackupCode: String? = null,
    /** One-shot snackbar fault; consumed after display. */
    val fault: ErrorCode? = null,
    val transportFault: Boolean = false,
)

@HiltViewModel
class BackupViewModel @Inject constructor(
    private val backup: BackupManager,
    private val identity: IdentityStore,
) : ViewModel() {
    private val _state = MutableStateFlow(BackupUiState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val present = identity.actorSeed() != null
            _state.update { it.copy(actorPresent = present) }
        }
    }

    /** Enable late or replace the code — recovery serves the newest blob. */
    fun onCreateBackup() {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, fault = null, transportFault = false) }
        viewModelScope.launch {
            when (val outcome = backup.enableOrReplace()) {
                is Outcome.Success -> _state.update { it.copy(busy = false, newBackupCode = outcome.value) }
                is Outcome.Refused -> _state.update { it.copy(busy = false, fault = outcome.errors.first().code) }
                is Outcome.Failed -> _state.update { it.copy(busy = false, transportFault = true) }
            }
        }
    }

    fun onBackupCodeSaved() = _state.update { it.copy(newBackupCode = null) }

    fun onFaultShown() = _state.update { it.copy(fault = null, transportFault = false) }
}

@Composable
fun BackupRoute(
    onBack: () -> Unit,
    onExportKey: () -> Unit,
    viewModel: BackupViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    BackupScreen(
        state = state,
        onBack = onBack,
        onCreateBackup = viewModel::onCreateBackup,
        onBackupCodeSaved = viewModel::onBackupCodeSaved,
        onExportKey = onExportKey,
        onFaultShown = viewModel::onFaultShown,
    )
}

@Composable
fun BackupScreen(
    state: BackupUiState,
    onBack: () -> Unit,
    onCreateBackup: () -> Unit,
    onBackupCodeSaved: () -> Unit,
    onExportKey: () -> Unit,
    onFaultShown: () -> Unit,
    keyGate: KeyGate = rememberKeyGate(),
) {
    val snackbar = remember { SnackbarHostState() }
    val faultText = when {
        state.transportFault -> stringResource(R.string.error_transport)
        state.fault != null -> stringResource(R.string.error_generic)
        else -> null
    }
    LaunchedEffect(faultText) {
        if (faultText != null) {
            snackbar.showSnackbar(faultText)
            onFaultShown()
        }
    }
    // Replacing the code destroys the old backup and reveals a new secret,
    // so the phone confirms who is holding it first.
    val gate = rememberKeyGateRunner(keyGate)
    val replaceSubtitle = stringResource(R.string.key_gate_replace)
    KeyGateWarning(gate)
    Scaffold(
        topBar = {
            PageHeader(
                title = stringResource(R.string.settings_backup),
                onBack = onBack,
                backContentDescription = stringResource(R.string.back_to_settings),
                testTag = "settings_backup_header",
            )
        },
        snackbarHost = { CograSnackbarHost(snackbar, testTag = "settings_backup_snackbar") },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            when (val code = state.newBackupCode) {
                null -> BackupOffer(state, onCreate = { gate.run(replaceSubtitle, onCreateBackup) }, onExportKey)
                else -> RecoveryCodeConfirm(
                    code = code,
                    explainer = stringResource(R.string.settings_backup_code_explainer),
                    matches = { recoveryCodeTypedBack(code, it) },
                    diverged = { recoveryCodePrefixDiverged(code, it) },
                    onConfirmed = onBackupCodeSaved,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

/** Today's offer, unchanged: enable or replace the code, and the way to the key. */
@Composable
private fun BackupOffer(state: BackupUiState, onCreate: () -> Unit, onExportKey: () -> Unit) {
    Text(
        stringResource(if (state.actorPresent) R.string.settings_backup_body else R.string.settings_backup_no_actor),
    )
    Button(
        onClick = onCreate,
        enabled = state.actorPresent && !state.busy,
        modifier = Modifier.testTag("settings_backup_create"),
    ) {
        Text(stringResource(R.string.settings_backup_create))
    }
    if (state.actorPresent) {
        TextButton(
            onClick = onExportKey,
            modifier = Modifier.testTag("settings_export_key"),
        ) {
            Text(stringResource(R.string.key_export_reveal))
        }
    }
}
