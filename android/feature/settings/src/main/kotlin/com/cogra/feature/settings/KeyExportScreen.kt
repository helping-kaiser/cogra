// The key-export surface (auth.md "Key export"): the phone shows the
// secrets it holds, each in a portable encoding, so the holder can act
// as their L0 address without CoGra. Purely local — no API call, and
// the seed never crosses the wire. The window is FLAG_SECURE, so the
// key stays out of screenshots and the recents thumbnail.

package com.cogra.feature.settings

import android.view.WindowManager
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CograTopBar
import com.cogra.core.designsystem.KeyGate
import com.cogra.core.designsystem.rememberKeyGate
import com.cogra.domain.identity.ExportedSecret
import com.cogra.domain.identity.SecretKind

@Composable
fun KeyExportRoute(
    onBack: () -> Unit,
    viewModel: KeyExportViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    KeyExportScreen(state = state, onReveal = viewModel::onReveal, onBack = onBack)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KeyExportScreen(
    state: KeyExportUiState,
    onReveal: () -> Unit,
    onBack: () -> Unit,
    keyGate: KeyGate = rememberKeyGate(),
) {
    SecureWindow()
    val gate = rememberKeyGateRunner(keyGate)
    val revealSubtitle = stringResource(R.string.key_gate_export)
    KeyGateWarning(gate)
    Scaffold(
        topBar = {
            CograTopBar(
                title = {
                    Text(
                        text = stringResource(R.string.key_export_title),
                        modifier = Modifier.semantics { heading() },
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("key_export_back"),
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back),
                        )
                    }
                },
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
            Text(stringResource(R.string.key_export_body))
            when {
                state.secrets.isNotEmpty() ->
                    state.secrets.forEach { secret -> SecretCard(secret) }
                state.revealed -> Text(
                    text = stringResource(R.string.key_export_no_actor),
                    modifier = Modifier.testTag("key_export_no_actor"),
                )
                else -> Button(
                    onClick = { gate.run(revealSubtitle, onReveal) },
                    modifier = Modifier.testTag("key_export_reveal"),
                ) {
                    Text(stringResource(R.string.key_export_reveal))
                }
            }
        }
    }
}

/**
 * One secret, both encodings. The labels name the formats exactly —
 * an export nobody can feed to another tool is not an export
 * (design.md §7 keeps implementation vocabulary out of copy elsewhere;
 * here the format IS the content).
 */
@Composable
private fun SecretCard(secret: ExportedSecret) {
    val name = when (secret.kind) {
        SecretKind.ACTOR_KEY -> R.string.key_export_actor_key
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(name),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() },
            )
            SecretBlock(
                label = stringResource(R.string.key_export_pem),
                value = secret.pem,
                testTag = "key_export_pem",
            )
            SecretBlock(
                label = stringResource(R.string.key_export_hex),
                value = secret.hex,
                testTag = "key_export_hex",
            )
        }
    }
}

@Composable
private fun SecretBlock(label: String, value: String, testTag: String) {
    Text(text = label, style = MaterialTheme.typography.labelLarge)
    // Selectable so the key can leave by hand; the clipboard entry is
    // its own change.
    SelectionContainer {
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
            modifier = Modifier.testTag(testTag),
        )
    }
}

/** Keeps the window out of screenshots and the recents thumbnail. */
@Composable
private fun SecureWindow() {
    val window = LocalActivity.current?.window
    DisposableEffect(window) {
        window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onDispose { window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
    }
}
