// The key ceremony, a logged-in step after the registration (auth.md
// "Application"). The invite door and the form live in InviteEntryScreen.kt
// and JoinScreen.kt.

package com.cogra.feature.onboarding

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.RecoveryCodeConfirm
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.domain.identity.recoveryCodePrefixDiverged
import com.cogra.domain.identity.recoveryCodeTypedBack


@Composable
fun KeyCeremonyRoute(
    onDone: () -> Unit,
    onBack: () -> Unit,
    viewModel: KeyCeremonyViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.done) {
        if (state.done) onDone()
    }
    KeyCeremonyScreen(
        state = state,
        onAcceptBackup = viewModel::onAcceptBackup,
        onCodeSaved = viewModel::onCodeSaved,
        onDeclineBackup = viewModel::onDeclineBackup,
        onCancelDecline = viewModel::onCancelDecline,
        onConfirmDecline = viewModel::onConfirmDecline,
        onBack = onBack,
    )
}

@Composable
fun KeyCeremonyScreen(
    state: KeyCeremonyUiState,
    onAcceptBackup: () -> Unit,
    onCodeSaved: () -> Unit,
    onDeclineBackup: () -> Unit,
    onCancelDecline: () -> Unit,
    onConfirmDecline: () -> Unit,
    onBack: () -> Unit = {},
) {
    // While the code is on screen this is a trap (design/readme.md, the
    // entry flow): the code is shown once and never stored, so a back
    // gesture that leaves takes the actor with it. The typed-back
    // confirmation is the only way out, and back is swallowed rather than
    // answered — there is nowhere safe for it to go.
    BackHandler(enabled = state.recoveryCode != null) {}

    Scaffold(
        topBar = {
            // The band's arrow is the same door the gesture is: while the
            // trap holds, it is not drawn either.
            PageHeader(
                onBack = onBack.takeIf { state.recoveryCode == null },
                testTag = "key_ceremony_header",
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = stringResource(R.string.backup_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            Text(stringResource(R.string.backup_explainer))
            when (state.attachError) {
                AttachError.NETWORK -> ErrorLine(R.string.error_transport, testTag = "ceremony_attach_error")
                AttachError.KEY_IN_USE -> ErrorLine(R.string.error_key_in_use, testTag = "ceremony_key_in_use")
                null -> Unit
            }
            if (state.inProgress) {
                CircularProgressIndicator(modifier = Modifier.testTag("backup_progress"))
            }
            when (val code = state.recoveryCode) {
                null -> {
                    Button(
                        onClick = onAcceptBackup,
                        enabled = !state.inProgress,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("backup_accept"),
                    ) {
                        Text(stringResource(R.string.backup_accept))
                    }
                    OutlinedButton(
                        onClick = onDeclineBackup,
                        enabled = !state.inProgress,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("backup_decline"),
                    ) {
                        Text(stringResource(R.string.backup_decline))
                    }
                }
                else -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        RecoveryCodeConfirm(
                            code = code,
                            explainer = stringResource(R.string.backup_code_explainer),
                            matches = { recoveryCodeTypedBack(code, it) },
                            diverged = { recoveryCodePrefixDiverged(code, it) },
                            onConfirmed = onCodeSaved,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
            }
        }
    }
    if (state.confirmingDecline) {
        AlertDialog(
            onDismissRequest = onCancelDecline,
            title = { Text(stringResource(R.string.backup_decline_title)) },
            text = {
                Text(
                    text = stringResource(R.string.backup_decline_consequence),
                    modifier = Modifier.testTag("backup_decline_consequence"),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = onConfirmDecline,
                    modifier = Modifier.testTag("backup_decline_confirm"),
                ) {
                    Text(stringResource(R.string.backup_decline_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = onCancelDecline, modifier = Modifier.testTag("backup_decline_cancel")) {
                    Text(stringResource(R.string.backup_decline_cancel))
                }
            },
        )
    }
}
