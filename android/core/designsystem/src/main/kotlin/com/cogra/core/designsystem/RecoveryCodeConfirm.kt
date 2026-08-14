// A recovery code shown for keeping, and the gate in front of
// dismissing it (auth.md "Key recovery"). The code is displayed exactly
// once and never persisted, so "I've written it down" is earned rather
// than clicked: the reader types the code back, or pastes the one they
// copied. Nothing checks that anything left the screen otherwise, and
// on a client that wiped its seed a missed code is an unrecoverable
// actor.
//
// The code renders bare, without a surface of its own — like the web
// component it mirrors, it expects to sit inside a Card, and a box on a
// filled card is a second surface saying the same thing twice.
//
// The typed-back text is pure view state, so it lives here rather than
// in a ViewModel; the rule for reading it belongs to the domain, which
// is why [matches] arrives as a parameter.

package com.cogra.core.designsystem

import android.content.ClipData
import android.content.ClipDescription
import android.os.Build
import android.os.PersistableBundle
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/**
 * Renders [code] with its [explainer] and the confirmation that
 * dismisses it, calling [onConfirmed] once the reader has answered with
 * the code itself. [matches] decides what counts as that code.
 *
 * Test tags: `recovery_code`, `recovery_code_copy`,
 * `recovery_code_copied`, `recovery_code_typed_back`,
 * `recovery_code_saved`.
 */
@Composable
fun RecoveryCodeConfirm(
    code: String,
    explainer: String,
    matches: (String) -> Boolean,
    onConfirmed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    var typedBack by rememberSaveable { mutableStateOf("") }
    var copied by rememberSaveable { mutableStateOf(false) }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = code,
            style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Monospace),
            modifier = Modifier.testTag("recovery_code"),
        )
        Text(explainer)
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(
                onClick = {
                    scope.launch {
                        clipboard.setClipEntry(sensitiveClip(code))
                        copied = true
                    }
                },
                modifier = Modifier.testTag("recovery_code_copy"),
            ) {
                Text(stringResource(R.string.recovery_code_copy))
            }
            // Android 13 and up confirms the copy itself; a second
            // message on top of it is the anti-pattern the platform's
            // copy/paste guidance calls out.
            if (copied && Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
                Text(
                    text = stringResource(R.string.recovery_code_copied),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.testTag("recovery_code_copied"),
                )
            }
        }
        OutlinedTextField(
            value = typedBack,
            onValueChange = { typedBack = it },
            label = { Text(stringResource(R.string.recovery_code_type_back)) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("recovery_code_typed_back"),
        )
        Button(
            onClick = onConfirmed,
            enabled = matches(typedBack),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("recovery_code_saved"),
        ) {
            Text(stringResource(R.string.recovery_code_saved))
        }
    }
}

/**
 * The clip carrying a recovery code. `EXTRA_IS_SENSITIVE` is what makes
 * Android 13+ mask the content in its paste preview instead of
 * rendering the secret in a floating bubble; the platform asks every
 * app to set it regardless of the API level it targets. The label stays
 * empty — it is the one part of a clip the preview still shows.
 */
private fun sensitiveClip(code: String): ClipEntry {
    val clip = ClipData.newPlainText("", code)
    clip.description.extras = PersistableBundle().apply {
        putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
    }
    return ClipEntry(clip)
}
