// REMOVE — THE THINK-TWICE DIALOG
// (design/designs/canonical/screens/RemoveConfirm.jsx).
//
// THE SAFE ACTION IS THE FILLED ONE. `Keep it` carries the fill and sits where
// the thumb lands; Remove is a text button in `error`. The weight of a removal
// belongs on the confirmation rather than on the menu row that opened it, which
// is why the row itself is drawn like every other.
//
// THE WORDS ARE THE DESIGN HERE, verbatim from the board: what leaves, what
// stays in its place, and that it cannot be taken back.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.v2.token.Space

@Composable
internal fun RemoveConfirm(
    onDismiss: () -> Unit,
    onRemove: () -> Unit,
    testTag: String = "post_remove_confirm",
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag(testTag),
        title = { Text(stringResource(R.string.content_remove_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Space.x3)) {
                Text(
                    stringResource(R.string.content_remove_body),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    stringResource(R.string.content_remove_permanent),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        },
        // Material puts the confirming action on the right; here the CONFIRM
        // slot is the safe one, because the safe action is the filled one.
        confirmButton = {
            Button(
                onClick = onDismiss,
                modifier = Modifier.testTag("${testTag}_keep"),
            ) {
                Text(stringResource(R.string.content_remove_keep))
            }
        },
        dismissButton = {
            TextButton(
                onClick = onRemove,
                modifier = Modifier.testTag("${testTag}_remove"),
            ) {
                Text(
                    stringResource(R.string.content_remove_confirm),
                    color = MaterialTheme.colorScheme.error,
                )
            }
        },
    )
}
