// The settings-side use of the device gate (core:designsystem's
// KeyGate): every action that reveals or replaces key material asks the
// phone first. A phone that cannot ask gets a warning and the choice,
// never a wall — the person locked out would be the holder, and the
// lost-code holder is exactly who export exists for.

package com.cogra.feature.settings

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.KeyGate
import com.cogra.core.designsystem.KeyGateResult
import com.cogra.core.designsystem.openScreenLockSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Runs actions behind the gate and holds the one pending warning. */
@Stable
internal class KeyGateRunner(
    private val scope: CoroutineScope,
    private val gate: KeyGate,
    private val title: String,
) {
    /** The action waiting on the warning's answer; null when none is. */
    var pending by mutableStateOf<(() -> Unit)?>(null)
        private set

    fun run(subtitle: String, action: () -> Unit) {
        scope.launch {
            when (gate.confirm(title, subtitle)) {
                KeyGateResult.Granted -> action()
                KeyGateResult.Denied -> Unit
                KeyGateResult.Unavailable -> pending = action
            }
        }
    }

    fun dismiss() {
        pending = null
    }

    fun continueAnyway() {
        val action = pending ?: return
        pending = null
        action()
    }
}

@Composable
internal fun rememberKeyGateRunner(gate: KeyGate): KeyGateRunner {
    val scope = rememberCoroutineScope()
    val title = stringResource(R.string.key_gate_title)
    return remember(scope, gate, title) { KeyGateRunner(scope, gate, title) }
}

/** The no-lock warning. Setting a lock is the emphasized answer. */
@Composable
internal fun KeyGateWarning(runner: KeyGateRunner) {
    if (runner.pending == null) return
    val context = LocalContext.current
    AlertDialog(
        onDismissRequest = runner::dismiss,
        title = { Text(stringResource(R.string.key_gate_no_lock_title)) },
        text = { Text(stringResource(R.string.key_gate_no_lock_body)) },
        confirmButton = {
            TextButton(
                onClick = {
                    runner.dismiss()
                    openScreenLockSettings(context)
                },
                modifier = Modifier.testTag("key_gate_set_lock"),
            ) {
                Text(stringResource(R.string.key_gate_no_lock_set))
            }
        },
        dismissButton = {
            TextButton(
                onClick = runner::continueAnyway,
                modifier = Modifier.testTag("key_gate_continue"),
            ) {
                Text(stringResource(R.string.key_gate_no_lock_continue))
            }
        },
        modifier = Modifier.testTag("key_gate_no_lock"),
    )
}
